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
  "demo_user": { id: "85857047", liveBalance: 10.00, demoBalance: 11070.12, control: "normal" }
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

// সার্ভারে স্থায়ী রানিং ট্রেড ও রেজাল্ট বাফার
let activeServerTrades = [];
let recentTradeResults = [];

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// ২৪ ঘণ্টার ১,৪৪০টি ক্যান্ডেল মেমোরিতে জেনারেট
function init24HourMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;

    for (let i = 1440; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let drift = -(cur - meta.basePrice) * 0.001;
      let delta = (Math.random() - 0.5) * (meta.vol * 0.35) + drift;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * (meta.vol * 0.15)).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * (meta.vol * 0.15)).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
    list.push({ time: currentCandleMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
    candleHistories[key] = list;
  }
}
init24HourMarket();

// প্রতি সেকেন্ডে সার্ভার টিক ও অটোমেটিক ট্রেড সেটেলমেন্ট
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let drift = -(meta.price - meta.basePrice) * 0.0008;
    let delta = (Math.random() - 0.5) * (meta.vol * 0.25) + drift;
    meta.price = parseFloat((meta.price + delta).toFixed(meta.decimals));

    let list = candleHistories[key];
    let lastCandle = list[list.length - 1];

    if (isNewMinute) {
      list.push({ time: nowMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
      if (list.length > 1440) list.shift();
    } else {
      if (meta.price > lastCandle.high) lastCandle.high = meta.price;
      if (meta.price < lastCandle.low) lastCandle.low = meta.price;
      lastCandle.close = meta.price;
    }
  }

  if (isNewMinute) currentCandleMinute = nowMinute;

  // সার্ভার সাইড ট্রেড অটো-সেটেলমেন্ট (ফোন বন্ধ থাকলেও ব্যালেন্স আপডেট হবে)
  for (let i = activeServerTrades.length - 1; i >= 0; i--) {
    let tr = activeServerTrades[i];
    if (sec >= tr.expireTime) {
      let exitP = ASSETS[tr.asset] ? ASSETS[tr.asset].price : tr.entryPrice;
      let isWin = false;
      let user = users[tr.username] || users["demo_user"];

      if (user.control === 'win') isWin = true;
      else if (user.control === 'loss') isWin = false;
      else {
        if (tr.direction === 'UP') isWin = (exitP > tr.entryPrice);
        else if (tr.direction === 'DOWN') isWin = (exitP < tr.entryPrice);
      }

      let profit = isWin ? parseFloat((tr.amount * (1 + (ASSETS[tr.asset]?.payout || 90) / 100)).toFixed(2)) : 0;
      if (isWin) {
        if (tr.accountType === 'live') user.liveBalance += profit;
        else user.demoBalance += profit;
      }

      let resObj = {
        tradeId: tr.id,
        username: tr.username,
        asset: tr.asset,
        isWin,
        profit,
        balance: (tr.accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2),
        time: now
      };

      recentTradeResults.unshift(resObj);
      if (recentTradeResults.length > 50) recentTradeResults.pop();

      activeServerTrades.splice(i, 1);

      // ক্লায়েন্টে রিয়েল-টাইম সেটেল ব্রডকাস্ট
      let settleMsg = JSON.stringify({ type: 'TRADE_SETTLED', result: resObj });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(settleMsg);
      });
    }
  }

  // লাইভ টিক ব্রডকাস্ট
  let tickPayload = { type: 'TICK', countdown: remainingSec, serverTime: now, assets: {} };
  for (let key in ASSETS) {
    tickPayload.assets[key] = {
      price: ASSETS[key].price.toFixed(ASSETS[key].decimals),
      candle: candleHistories[key][candleHistories[key].length - 1],
      payout: ASSETS[key].payout
    };
  }

  let broadcastData = JSON.stringify(tickPayload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(broadcastData);
  });
}, 1000);

app.get('/api/history/:asset', (req, res) => {
  let asset = req.params.asset || 'BTC';
  if (candleHistories[asset]) {
    res.json({ success: true, history: candleHistories[asset], meta: ASSETS[asset], serverTime: Date.now() });
  } else {
    res.json({ success: false });
  }
});

app.get('/api/active-trades', (req, res) => {
  res.json({ success: true, trades: activeServerTrades, results: recentTradeResults });
});

app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType, durationSec, asset, candleTime, clientEntryPrice } = req.body;
  let user = users[username] || users["demo_user"];
  let tradeAmount = Number(amount) || 1;
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < tradeAmount) return res.json({ success: false, message: "Insufficient balance!" });

  if (accountType === 'live') user.liveBalance -= tradeAmount;
  else user.demoBalance -= tradeAmount;

  let selectedAsset = ASSETS[asset] || ASSETS['BTC'];
  let nowSec = Math.floor(Date.now() / 1000);
  let dur = Number(durationSec) || 60;
  let entryP = clientEntryPrice ? parseFloat(clientEntryPrice) : selectedAsset.price;

  let newTrade = {
    id: "TR-" + Date.now(),
    username: username || "demo_user",
    asset: asset || "BTC",
    amount: tradeAmount,
    direction,
    accountType,
    entryPrice: entryP,
    candleTime: candleTime || (Math.floor(nowSec / 60) * 60),
    entryTime: nowSec,
    expireTime: nowSec + dur
  };

  activeServerTrades.push(newTrade);

  res.json({
    success: true,
    trade: newTrade,
    balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
  });
});

app.post('/api/sell-trade', (req, res) => {
  const { tradeId, username, accountType } = req.body;
  let idx = activeServerTrades.findIndex(t => t.id === tradeId);
  if (idx !== -1) {
    let tr = activeServerTrades[idx];
    let user = users[username] || users["demo_user"];
    let refund = parseFloat((tr.amount * 0.25).toFixed(2));
    if (accountType === 'live') user.liveBalance += refund;
    else user.demoBalance += refund;
    activeServerTrades.splice(idx, 1);
    return res.json({ success: true, refund, balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2) });
  }
  res.json({ success: false, message: "Trade already expired!" });
});

app.post('/api/switch-account', (req, res) => {
  let user = users["demo_user"];
  res.json({ success: true, activeAccount: req.body.type, balance: req.body.type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/reset-demo', (req, res) => {
  let user = users["demo_user"];
  user.demoBalance = 11070.12;
  res.json({ success: true, balance: user.demoBalance.toFixed(2) });
});

app.get('/api/user/info', (req, res) => {
  let user = users["demo_user"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance });
});

app.get('/api/tournaments', (req, res) => {
  res.json({
    success: true,
    tournaments: [
      { id: "tour_01", title: "Weekend Battle", status: "ACTIVE NOW", prizePool: "5000 $", entryFee: "1 $", duration: "2 days" },
      { id: "tour_02", title: "Crazy Wednesday", status: "UNTIL START: 2 DAY(S)", prizePool: "7500 $", entryFee: "10 $", duration: "1 day" }
    ]
  });
});

app.get('/api/payments', (req, res) => {
  res.json({
    success: true,
    deposits: [{ id: "128385243", date: "24/08/2026, 20:39:08", status: "Approved", amount: 10.00, method: "Bkash", type: "Deposit" }],
    withdrawals: [{ id: "126022410", date: "31/07/2026, 14:34:41", status: "Approved", amount: 13.00, method: "Binance Pay", type: "Withdraw" }]
  });
});

app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/admin/data', (req, res) => res.json({ users, assets: ASSETS }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rock-solid Engine running on port ${PORT}`));
