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
  "demo_user": { liveBalance: 0.03, demoBalance: 11061.07, activeAccount: "demo", control: "normal" }
};
let transactions = [];

let currentPrice = 111.609;
let candleHistory = [];

function initCandles() {
  let nowSec = Math.floor(Date.now() / 1000);
  let nowMinute = Math.floor(nowSec / 60) * 60;
  candleHistory = [];
  for (let i = 40; i > 0; i--) {
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

setInterval(() => {
  let delta = (Math.random() - 0.495) * 0.005;
  currentPrice = parseFloat((currentPrice + delta).toFixed(3));

  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;

  if (nowMinute > currentCandle.time) {
    candleHistory.push({ ...currentCandle });
    if (candleHistory.length > 200) candleHistory.shift();
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
    serverTime: now
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}, 1000);

app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType } = req.body;
  let user = users[username] || users["demo_user"];
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < amount) {
    return res.json({ success: false, message: "Insufficient balance!" });
  }

  if (accountType === 'live') user.liveBalance -= amount;
  else user.demoBalance -= amount;

  let isWin = (Math.random() * 100) < 40;
  if (user.control === 'win') isWin = true;
  if (user.control === 'loss') isWin = false;

  let profit = isWin ? parseFloat((amount * 1.88).toFixed(2)) : 0;
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

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/admin/data', (req, res) => res.json({ users, transactions }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
