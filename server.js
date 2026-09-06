const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// স্ক্রিনশট আপলোডের জন্য 20mb পেলোড লিমিট
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let users = {
  "demo_user": { liveBalance: 10.00, demoBalance: 11072.87, activeAccount: "demo", control: "normal" }
};

// কাস্টমার সাপোর্ট টিকেট ডেটাবেজ
let supportTickets = [
  {
    id: "TKT-85810",
    username: "demo_user",
    subject: "Withdrawal processing time inquiry",
    message: "I submitted a Binance withdrawal request 2 hours ago. When will it be approved?",
    screenshot: "",
    status: "Solved",
    adminReply: "Hello Sajib! Your Binance Pay withdrawal has been reviewed and approved successfully. Funds should reflect in your Binance account within a few minutes.",
    createdAt: "06/09/2026, 15:20:10",
    repliedAt: "06/09/2026, 15:45:00"
  }
];

// ২৪ ঘণ্টার ডায়নামিক বোনাস
let activeBonuses = [
  {
    id: "b_ref_01",
    title: "Invite & Earn Champion",
    type: "Referral Bonus",
    amount: 10.00,
    description: "Invite 1 active friend to trade and claim your instant $10 cash reward!",
    createdAt: Date.now() - (2 * 60 * 60 * 1000),
    claimedBy: []
  },
  {
    id: "b_trd_02",
    title: "Daily Volume Booster",
    type: "Trading Bonus",
    amount: 5.00,
    description: "Complete your daily target today and claim a $5 trading booster bonus!",
    createdAt: Date.now() - (5 * 60 * 60 * 1000),
    claimedBy: []
  }
];

function getValidBonuses() {
  let now = Date.now();
  activeBonuses = activeBonuses.filter(b => (now - b.createdAt) < (24 * 60 * 60 * 1000));
  return activeBonuses;
}

let depositHistory = [
  { id: "128385243", date: "24/08/2026, 20:39:08", status: "Failed", amount: 10.00, method: "Bkash (P2C)", type: "Deposit" },
  { id: "126022410", date: "31/07/2026, 14:34:41", status: "Successed", amount: 13.00, method: "Binance Pay", type: "Deposit" }
];

let transactions = [
  { id: "128385243", username: "demo_user", type: "Withdraw", method: "Bkash (P2C)", amount: 10.00, status: "Failed", date: "24.08.2026", details: "017XXXXXXXX" },
  { id: "126022410", username: "demo_user", type: "Withdraw", method: "Binance Pay", amount: 13.00, status: "Successed", date: "31.07.2026", details: "85857047" }
];

let ASSETS = {
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68520.50, basePrice: 68520.50, decimals: 2, payout: 92, vol: 2.5 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, payout: 90, vol: 0.6 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 177.50, basePrice: 177.50, decimals: 2, payout: 88, vol: 0.12 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, payout: 88, vol: 0.20 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, basePrice: 0.6250, decimals: 4, payout: 85, vol: 0.0004 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, basePrice: 0.1425, decimals: 4, payout: 82, vol: 0.0002 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, basePrice: 5.850, decimals: 3, payout: 86, vol: 0.004 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, basePrice: 0.4850, decimals: 4, payout: 84, vol: 0.0004 }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

function initMarketHistory() {
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;

    for (let i = 400; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let delta = (Math.random() - 0.495) * meta.vol;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 0.4).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 0.4).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
    list.push({ time: currentCandleMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
    candleHistories[key] = list;
  }
}
initMarketHistory();

setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let delta = (Math.random() - 0.495) * (meta.vol * 0.35);
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
      if (list.length > 800) list.shift();
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

// ----------------------------------------------------
// ❓ কাস্টমার সাপোর্ট টিকেট API (সমস্যা ও স্ক্রিনশট)
// ----------------------------------------------------
app.get('/api/support/tickets', (req, res) => {
  let username = req.query.username || "demo_user";
  let userTickets = supportTickets.filter(t => t.username === username);
  res.json({ success: true, tickets: userTickets });
});

app.post('/api/support/create', (req, res) => {
  const { username, subject, message, screenshot } = req.body;
  if (!subject || !message) {
    return res.json({ success: false, message: "Please enter subject and problem details!" });
  }

  let now = new Date();
  let timeStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}, ${now.toTimeString().split(' ')[0]}`;

  let newTicket = {
    id: "TKT-" + Math.floor(10000 + Math.random() * 90000),
    username: username || "demo_user",
    subject: subject.trim(),
    message: message.trim(),
    screenshot: screenshot || "",
    status: "Pending",
    adminReply: "",
    createdAt: timeStr,
    repliedAt: ""
  };

  supportTickets.unshift(newTicket);
  res.json({ success: true, message: "Your support request has been submitted to Admin!", ticket: newTicket });
});

// অ্যাডমিন থেকে সাপোর্ট রিপ্লাই
app.post('/api/admin/support-reply', (req, res) => {
  const { ticketId, adminReply } = req.body;
  let t = supportTickets.find(item => item.id === ticketId);
  if (!t) return res.json({ success: false, message: "Ticket not found!" });

  let now = new Date();
  let timeStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}, ${now.toTimeString().split(' ')[0]}`;

  t.adminReply = adminReply.trim();
  t.status = "Solved";
  t.repliedAt = timeStr;

  res.json({ success: true, message: "Solution sent to user successfully!" });
});

// ----------------------------------------------------
// বোনাস API
// ----------------------------------------------------
app.get('/api/bonuses', (req, res) => {
  let list = getValidBonuses();
  res.json({ success: true, bonuses: list, username: "demo_user" });
});

app.post('/api/bonuses/claim', (req, res) => {
  const { bonusId, username, accountType } = req.body;
  let validList = getValidBonuses();
  let b = validList.find(item => item.id === bonusId);

  if (!b) return res.json({ success: false, message: "Bonus expired!" });

  let user = users[username] || users["demo_user"];
  if (b.claimedBy && b.claimedBy.includes(username || "demo_user")) {
    return res.json({ success: false, message: "You already claimed this bonus!" });
  }

  let amt = Number(b.amount) || 0;
  if (accountType === 'live') user.liveBalance = parseFloat((user.liveBalance + amt).toFixed(2));
  else user.demoBalance = parseFloat((user.demoBalance + amt).toFixed(2));

  b.claimedBy = b.claimedBy || [];
  b.claimedBy.push(username || "demo_user");

  res.json({
    success: true,
    message: `Congratulations! $${amt.toFixed(2)} bonus added.`,
    newBalance: accountType === 'live' ? user.liveBalance : user.demoBalance
  });
});

app.post('/api/admin/create-bonus', (req, res) => {
  const { title, type, amount, description } = req.body;
  let newBonus = {
    id: "b_" + Date.now(),
    title: title.trim(),
    type: type || "Trading Bonus",
    amount: parseFloat(amount) || 5.00,
    description: description ? description.trim() : "Special 24-hour reward offer!",
    createdAt: Date.now(),
    claimedBy: []
  };
  activeBonuses.unshift(newBonus);
  res.json({ success: true, message: "Bonus published!", bonus: newBonus });
});

app.post('/api/admin/delete-bonus', (req, res) => {
  const { bonusId } = req.body;
  activeBonuses = activeBonuses.filter(b => b.id !== bonusId);
  res.json({ success: true, message: "Bonus deleted." });
});

app.get('/api/payments', (req, res) => res.json({ success: true, deposits: depositHistory }));
app.get('/api/withdrawals', (req, res) => res.json({ success: true, withdrawals: transactions, liveBalance: users["demo_user"].liveBalance }));

app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/admin/data', (req, res) => {
  let bonuses = getValidBonuses();
  let totalDeposit = depositHistory.filter(t => t.status === 'Successed').reduce((s, t) => s + Number(t.amount), 0);
  res.json({ users, transactions, depositHistory, assets: ASSETS, bonuses, supportTickets, totalDeposit });
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
