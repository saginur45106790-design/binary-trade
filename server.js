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
  "demo_user": { liveBalance: 0.03, demoBalance: 11061.95, activeAccount: "demo", control: "normal" }
};
let transactions = [];

// টপ ৮টি ক্রিপ্টো কয়েনের কনফিগারেশন
const ASSETS = {
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

// প্রতিটি কয়েনের ৬০ মিনিটের ব্যাকগ্রাউন্ড হিস্ট্রি তৈরি
function initAllAssetCandles() {
  let nowSec = Math.floor(Date.now() / 1000);
  let nowMinute = Math.floor(nowSec / 60) * 60;

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    candleHistories[key] = [];
    let p = meta.price;

    for (let i = 100; i > 0; i--) {
      let t = nowMinute - (i * 60);
      let o = p;
      let delta = (Math.random() - 0.49) * meta.vol * 3;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 1.5).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 1.5).toFixed(meta.decimals));
      candleHistories[key].push({ time: t, open: o, high: h, low: l, close: c });
      p = c;
    }

    currentCandles[key] = {
      time: nowMinute,
      open: p,
      high: p,
      low: p,
      close: p
    };
    meta.price = p;
  }
}
initAllAssetCandles();

// প্রতি সেকেন্ডে ৮টি কয়েনের প্রাইস টিক ও ক্যান্ডেল আপডেট
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let tickPayload = {
    type: 'TICK',
    countdown: remainingSec,
    serverTime: now,
    assets: {}
  };

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let delta = (Math.random() - 0.495) * meta.vol;
    meta.price = parseFloat((meta.price + delta).toFixed(meta.decimals));

    let candle = currentCandles[key];

    if (nowMinute > candle.time) {
      candleHistories[key].push({ ...candle });
      if (candleHistories[key].length > 250) candleHistories[key].shift();
      currentCandles[key] = {
        time: nowMinute,
        open: meta.price,
        high: meta.price,
        low: meta.price,
        close: meta.price
      };
    } else {
      if (meta.price > candle.high) candle.high = meta.price;
      if (meta.price < candle.low) candle.low = meta.price;
      candle.close = meta.price;
    }

    tickPayload.assets[key] = {
      price: meta.price.toFixed(meta.decimals),
      candle: currentCandles[key],
      payout: meta.payout
    };
  }

  let broadcastData = JSON.stringify(tickPayload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(broadcastData);
  });
}, 1000);

// কয়েন পরিবর্তন করলে ফুল হিস্ট্রি পাঠানোর রুট
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
  if (user.control === 'win') {
    isWin = true;
  } else if (user.control === 'loss') {
    isWin = false;
  } else {
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
