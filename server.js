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
  "demo_user": { liveBalance: 0.03, demoBalance: 11061.95, activeAccount: "demo", control: "normal" }
};
let transactions = [];

let currentPrice = 111.950;
let candleHistory = [];
let currentPayout = 84; // ডাইনামিক পেআউট (৮৪% -> ৭৮%)

function initCandles() {
  let nowSec = Math.floor(Date.now() / 1000);
  let nowMinute = Math.floor(nowSec / 60) * 60;
  candleHistory = [];
  for (let i = 45; i > 0; i--) {
    let t = nowMinute - (i * 60);
    let o = currentPrice;
    let delta = (Math.random() - 0.49) * 0.025;
    let c = parseFloat((o + delta).toFixed(3));
    let h = parseFloat((Math.max(o, c) + Math.random() * 0.012).toFixed(3));
    let l = parseFloat((Math.min(o, c) - Math.random() * 0.012).toFixed(3));
    candleHistory.push({ time: t, open: o, high: h, low: l, close: c });
    currentPrice = c;
  }
}
initCandles();

let currentCandle = {
  time: Math.floor(Date.now() / 60000) * 60,
  open: currentPrice,
  high: currentPrice,
  low: currentPrice,
  close: currentPrice
};

// মার্কেট প্রাইস ও লাইভ ক্যান্ডেল ইঞ্জিন
let payoutCounter = 0;
setInterval(() => {
  let delta = (Math.random() - 0.495) * 0.005;
  currentPrice = parseFloat((currentPrice + delta).toFixed(3));

  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;

  // ডাইনামিক পেআউট শিফটিং (ভিডিও অনুযায়ী ৮৪% ও ৭৮% এর মধ্যে মুভ হবে)
  payoutCounter++;
  if (payoutCounter % 40 === 0) {
    currentPayout = currentPayout === 84 ? 78 : 84;
  }

  if (nowMinute > currentCandle.time) {
    candleHistory.push({ ...currentCandle });
    if (candleHistory.length > 250) candleHistory.shift();
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

  let remainingSec = 60 - (sec % 60);

  let payload = JSON.stringify({
    type: 'TICK',
    price: currentPrice.toFixed(3),
    candle: currentCandle,
    history: candleHistory,
    countdown: remainingSec,
    payout: currentPayout,
    serverTime: now
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}, 1000);

// ট্রেড এক্সিকিউশন
app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType } = req.body;
  let user = users[username] || users["demo_user"];
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < amount) {
    return res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });
  }

  if (accountType === 'live') user.liveBalance -= amount;
  else user.demoBalance -= amount;

  // উইন/লস কন্ট্রোল (এডমিন প্যানেল থেকে ওভাররাইড সম্ভব)
  let isWin = false;
  if (user.control === 'win') isWin = true;
  else if (user.control === 'loss') isWin = false;
  else isWin = (Math.random() * 100) < 40; // সাধারণ মোডে ৪০% উইন চান্স

  let profitRatio = 1 + (currentPayout / 100);
  let profit = isWin ? parseFloat((amount * profitRatio).toFixed(2)) : 0;
  if (isWin) {
    if (accountType === 'live') user.liveBalance += profit;
    else user.demoBalance += profit;
  }

  let finalBal = accountType === 'live' ? user.liveBalance : user.demoBalance;
  res.json({
    success: true,
    isWin,
    profit,
    entryPrice: currentPrice.toFixed(3),
    balance: finalBal.toFixed(2),
    direction,
    amount
  });
});

// আর্লি ক্যাশআউট / Sell Trade API
app.post('/api/sell-trade', (req, res) => {
  const { username, amount, accountType } = req.body;
  let user = users[username] || users["demo_user"];
  
  // আংশিক ক্যাশআউট রিফান্ড (যেমন ১ ডলারের ট্রেডে ০.২৫ ডলার ব্যাক)
  let refundAmt = parseFloat((amount * 0.25).toFixed(2));
  if (accountType === 'live') user.liveBalance += refundAmt;
  else user.demoBalance += refundAmt;

  let finalBal = accountType === 'live' ? user.liveBalance : user.demoBalance;
  res.json({ success: true, refund: refundAmt, balance: finalBal.toFixed(2) });
});

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/admin/data', (req, res) => res.json({ users, transactions }));

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
