const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let users = {
  "demo_user": { liveBalance: 10.00, demoBalance: 11072.87, activeAccount: "demo", control: "normal" }
};

let ASSETS = {
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68520.50, basePrice: 68520.50, decimals: 2, payout: 92, vol: 2.2 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, payout: 90, vol: 0.5 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 177.50, basePrice: 177.50, decimals: 2, payout: 88, vol: 0.10 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, payout: 88, vol: 0.18 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, basePrice: 0.6250, decimals: 4, payout: 85, vol: 0.0003 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, basePrice: 0.1425, decimals: 4, payout: 82, vol: 0.00015 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, basePrice: 5.850, decimals: 3, payout: 86, vol: 0.003 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, basePrice: 0.4850, decimals: 4, payout: 84, vol: 0.0003 }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// ২৪ ঘণ্টার ১,৪৪০টি প্রাকৃতিক ক্যান্ডেল তৈরি
function init24HourMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;

    for (let i = 1440; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let drift = -(cur - meta.basePrice) * 0.0015;
      let delta = (Math.random() - 0.5) * (meta.vol * 0.4) + drift;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * (meta.vol * 0.2)).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * (meta.vol * 0.2)).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
    list.push({
      time: currentCandleMinute,
      open: meta.price,
      high: meta.price,
      low: meta.price,
      close: meta.price
    });
    candleHistories[key] = list;
  }
}
init24HourMarket();

// লাইভ স্মুথ মার্কেট টিক
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let drift = -(meta.price - meta.basePrice) * 0.001;
    let delta = (Math.random() - 0.5) * (meta.vol * 0.25) + drift;
    meta.price = parseFloat((meta.price + delta).toFixed(meta.decimals));

    let list = candleHistories[key];
    let lastCandle = list[list.length - 1];

    if (isNewMinute) {
      list.push({
        time: nowMinute,
        open: meta.price,
        high: meta.price,
        low: meta.price,
        close: meta.price
      });
      if (list.length > 1440) list.shift();
    } else {
      if (meta.price > lastCandle.high) lastCandle.high = meta.price;
      if (meta.price < lastCandle.low) lastCandle.low = meta.price;
      lastCandle.close = meta.price;
    }
  }

  if (isNewMinute) currentCandleMinute = nowMinute;

  let tickPayload = {
    type: 'TICK',
    countdown: remainingSec,
    serverTime: now,
    assets: {}
  };

  for (let key in ASSETS) {
    let list = candleHistories[key];
    tickPayload.assets[key] = {
      price: ASSETS[key].price.toFixed(ASSETS[key].decimals),
      candle: list[list.length - 1],
      payout: ASSETS[key].payout
    };
  }

  let broadcastData = JSON.stringify(tickPayload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(broadcastData);
  });
}, 1000);

let lifetimeTrades = [
  { id: "TR-90214", asset: "BTC/USD (OTC)", direction: "UP", amount: 1.00, entryPrice: "68520.50", exitPrice: "68524.20", profit: 1.92, isWin: true, time: "24/08/2026, 21:14:02", accountType: "live" },
  { id: "TR-90213", asset: "ETH/USD (OTC)", direction: "DOWN", amount: 2.00, entryPrice: "3422.00", exitPrice: "3423.10", profit: 0.00, isWin: false, time: "24/08/2026, 20:45:18", accountType: "live" }
];

let depositHistory = [
  { id: "128385243", date: "24/08/2026, 20:39:08", status: "Failed", amount: 10.00, method: "Bkash (P2C)", type: "Deposit" },
  { id: "126022410", date: "31/07/2026, 14:34:41", status: "Successed", amount: 13.00, method: "Binance Pay", type: "Deposit" }
];

let transactions = [
  { id: "128385243", username: "demo_user", type: "Withdraw", method: "Bkash (P2C)", amount: 10.00, status: "Failed", date: "24.08.2026", details: "017XXXXXXXX" }
];

let supportTickets = [
  {
    id: "TK-849201",
    username: "demo_user",
    category: "Deposit Issue",
    message: "Deposited via bKash, please verify my transaction.",
    screenshot: "",
    status: "Answered",
    createdAt: "24/08/2026, 18:22:10",
    replies: [
      { sender: "Admin Support", message: "Your payment has been successfully approved and added to your balance.", time: "24/08/2026, 18:25:40" }
    ]
  }
];

let tournamentsList = [
  { id: "tour_01", title: "Weekend Battle", status: "ACTIVE NOW", prizePool: "5000 $", entryFee: "1 $", duration: "2 days" },
  { id: "tour_02", title: "Crazy Wednesday", status: "UNTIL START: 2 DAY(S)", prizePool: "7500 $", entryFee: "10 $", duration: "1 day" },
  { id: "tour_03", title: "Grand Pro League", status: "UNTIL START: 4 DAY(S)", prizePool: "15000 $", entryFee: "15 $", duration: "3 days" },
  { id: "tour_04", title: "Daily Sprint", status: "UNTIL START: 5 DAY(S)", prizePool: "2500 $", entryFee: "0 $", duration: "1 day" }
];

app.get('/api/history/:asset', (req, res) => {
  let asset = req.params.asset || 'BTC';
  if (candleHistories[asset]) {
    res.json({ success: true, history: candleHistories[asset], meta: ASSETS[asset] });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType, durationSec, asset } = req.body;
  let user = users[username] || users["demo_user"];
  let tradeAmount = Number(amount) || 1;
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < tradeAmount) return res.json({ success: false, message: "Insufficient balance!" });

  if (accountType === 'live') user.liveBalance -= tradeAmount;
  else user.demoBalance -= tradeAmount;

  let selectedAsset = ASSETS[asset] || ASSETS['BTC'];
  res.json({
    success: true,
    entryPrice: selectedAsset.price.toFixed(selectedAsset.decimals),
    balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2),
    direction,
    amount: tradeAmount,
    durationSec,
    asset
  });
});

app.post('/api/settle-trade', (req, res) => {
  const { username, entryPrice, exitPrice, direction, amount, accountType, asset } = req.body;
  let user = users[username] || users["demo_user"];
  let selectedAsset = ASSETS[asset] || ASSETS['BTC'];
  let tradeAmount = Number(amount) || 1;

  let isWin = false;
  if (user.control === 'win') isWin = true;
  else if (user.control === 'loss') isWin = false;
  else {
    if (direction === 'UP') isWin = (Number(exitPrice) > Number(entryPrice));
    else if (direction === 'DOWN') isWin = (Number(exitPrice) < Number(entryPrice));
  }

  let profit = isWin ? parseFloat((tradeAmount * (1 + selectedAsset.payout / 100)).toFixed(2)) : 0;
  if (isWin) {
    if (accountType === 'live') user.liveBalance += profit;
    else user.demoBalance += profit;
  }

  let newTradeRecord = {
    id: "TR-" + Math.floor(10000 + Math.random() * 90000),
    asset: `${asset}/USD (OTC)`,
    direction,
    amount: tradeAmount,
    entryPrice: String(entryPrice),
    exitPrice: String(exitPrice),
    profit,
    isWin,
    time: new Date().toLocaleString(),
    accountType: accountType || "demo"
  };
  lifetimeTrades.unshift(newTradeRecord);

  res.json({
    success: true,
    isWin,
    profit,
    balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
  });
});

app.post('/api/sell-trade', (req, res) => {
  const { username, amount, accountType } = req.body;
  let user = users[username] || users["demo_user"];
  let refundAmt = parseFloat((Number(amount) * 0.25).toFixed(2));

  if (accountType === 'live') user.liveBalance += refundAmt;
  else user.demoBalance += refundAmt;

  res.json({
    success: true,
    refund: refundAmt,
    balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
  });
});

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/reset-demo', (req, res) => {
  let user = users["demo_user"];
  user.demoBalance = 11072.87;
  res.json({ success: true, balance: user.demoBalance.toFixed(2) });
});

app.get('/api/user/info', (req, res) => {
  let user = users["demo_user"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance, activeAccount: user.activeAccount });
});

app.get('/api/tournaments', (req, res) => res.json({ success: true, tournaments: tournamentsList }));
app.get('/api/support/tickets', (req, res) => res.json({ success: true, tickets: supportTickets }));

app.post('/api/support/create-ticket', (req, res) => {
  const { username, category, message, screenshot } = req.body;
  let newTicket = {
    id: "TK-" + Math.floor(100000 + Math.random() * 900000),
    username: username || "demo_user",
    category: category || "General Support",
    message: message || "",
    screenshot: screenshot || "",
    status: "Pending",
    createdAt: new Date().toLocaleString(),
    replies: []
  };
  supportTickets.unshift(newTicket);
  res.json({ success: true, message: "Ticket submitted successfully!", ticket: newTicket });
});

app.get('/api/user/trades', (req, res) => res.json({ success: true, trades: lifetimeTrades }));
app.get('/api/payments', (req, res) => res.json({ success: true, deposits: depositHistory, withdrawals: transactions }));

app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/admin/data', (req, res) => {
  res.json({ users, assets: ASSETS, tickets: supportTickets });
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Trading Engine running on port ${PORT}`));
