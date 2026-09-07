const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let users = {
  "85857047": { id: "85857047", username: "demo_user", name: "MD Sajib Hossain", email: "teachsajib@gmail.com", phone: "+8801700000000", liveBalance: 10.00, demoBalance: 11068.77, group: "VIP", status: "Active" }
};

let userGroups = ["Standard", "VIP", "Premium", "New Traders"];

// স্ক্রিনশট ৯৪৮-৯৫৭ অনুযায়ী ১০টি নির্দিষ্ট OTC অ্যাসেট
let ASSETS = {
  'EUR_USD': { name: 'EUR/USD (OTC)', ticker: 'EUR_USD', price: 1.08540, basePrice: 1.08540, decimals: 5, vol: 0.00030, payout1m: 77, payout5m: 77, change24h: -1.27, trend: 'NORMAL', trendUntil: 0 },
  'GBP_JPY': { name: 'GBP/JPY (OTC)', ticker: 'GBP_JPY', price: 191.450, basePrice: 191.450, decimals: 3, vol: 0.045, payout1m: 77, payout5m: 80, change24h: 0.21, trend: 'NORMAL', trendUntil: 0 },
  'GBP_USD': { name: 'GBP/USD (OTC)', ticker: 'GBP_USD', price: 1.31210, basePrice: 1.31210, decimals: 5, vol: 0.00035, payout1m: 92, payout5m: 83, change24h: 0.00, trend: 'NORMAL', trendUntil: 0 },
  'EUR_AUD': { name: 'EUR/AUD (OTC)', ticker: 'EUR_AUD', price: 1.62480, basePrice: 1.62480, decimals: 5, vol: 0.00040, payout1m: 94, payout5m: 95, change24h: -0.61, trend: 'NORMAL', trendUntil: 0 },
  'ETH':     { name: 'Ethereum (OTC)', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, vol: 1.40, payout1m: 81, payout5m: 67, change24h: 4.75, trend: 'NORMAL', trendUntil: 0 },
  'SOL':     { name: 'Solana (OTC)', ticker: 'SOL', price: 177.50, basePrice: 177.50, decimals: 2, vol: 0.40, payout1m: 81, payout5m: 64, change24h: -10.94, trend: 'NORMAL', trendUntil: 0 },
  'BNB':     { name: 'Binance Coin (OTC)', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, vol: 0.60, payout1m: 89, payout5m: 75, change24h: 2.33, trend: 'NORMAL', trendUntil: 0 },
  'BTC':     { name: 'Bitcoin (OTC)', ticker: 'BTC', price: 68525.50, basePrice: 68525.50, decimals: 2, vol: 4.80, payout1m: 75, payout5m: 82, change24h: 1.29, trend: 'NORMAL', trendUntil: 0 },
  'SILVER':  { name: 'Silver (OTC)', ticker: 'SILVER', price: 28.520, basePrice: 28.520, decimals: 3, vol: 0.025, payout1m: 88, payout5m: 77, change24h: 0.11, trend: 'NORMAL', trendUntil: 0 },
  'GOLD':    { name: 'Gold (OTC)', ticker: 'GOLD', price: 2350.40, basePrice: 2350.40, decimals: 2, vol: 0.80, payout1m: 92, payout5m: 79, change24h: 0.03, trend: 'NORMAL', trendUntil: 0 }
};

let activeServerTrades = [];
let recentTradeResults = [];
let candleHistories = {};
let currentCandle5s = Math.floor(Date.now() / 5000) * 5;

// ২৪ ঘণ্টার ৫-সেকেন্ড রেজ্যুলুশন বেস ক্যান্ডেল তৈরি (১৭,২৮০টি বার)
function initMarketEngine() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandle5s = Math.floor(nowSec / 5) * 5;

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;

    for (let i = 2880; i > 0; i--) {
      let t = currentCandle5s - (i * 5);
      let drift = -(cur - meta.basePrice) * 0.001;
      let delta = (Math.random() - 0.495) * (meta.vol * 0.25) + drift;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 0.12).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 0.12).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
    list.push({ time: currentCandle5s, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
    candleHistories[key] = list;
  }
}
initMarketEngine();

// প্রতি সেকেন্ডের টিক ও ট্রেন্ড এক্সিকিউশন
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let now5s = Math.floor(sec / 5) * 5;
  let isNew5s = (now5s > currentCandle5s);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    
    let trendDrift = 0;
    if (now < meta.trendUntil) {
      if (meta.trend === 'UP') trendDrift = meta.vol * 0.35;
      else if (meta.trend === 'DOWN') trendDrift = -meta.vol * 0.35;
    } else {
      meta.trend = 'NORMAL';
      trendDrift = -(meta.price - meta.basePrice) * 0.0008;
    }

    let delta = (Math.random() - 0.495) * (meta.vol * 0.2) + trendDrift;
    meta.price = parseFloat((meta.price + delta).toFixed(meta.decimals));

    let list = candleHistories[key];
    let lastCandle = list[list.length - 1];

    if (isNew5s) {
      list.push({ time: now5s, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
      if (list.length > 3500) list.shift();
    } else {
      if (meta.price > lastCandle.high) lastCandle.high = meta.price;
      if (meta.price < lastCandle.low) lastCandle.low = meta.price;
      lastCandle.close = meta.price;
    }
  }

  if (isNew5s) currentCandle5s = now5s;

  // রানিং ট্রেড অটো-সেটেলমেন্ট
  for (let i = activeServerTrades.length - 1; i >= 0; i--) {
    let tr = activeServerTrades[i];
    if (sec >= tr.expireTime) {
      let exitP = ASSETS[tr.asset] ? ASSETS[tr.asset].price : tr.entryPrice;
      let isWin = false;
      let user = users["85857047"];

      if (tr.direction === 'UP') isWin = (exitP > tr.entryPrice);
      else if (tr.direction === 'DOWN') isWin = (exitP < tr.entryPrice);

      let payoutRate = ASSETS[tr.asset] ? ASSETS[tr.asset].payout1m : 90;
      let profit = isWin ? parseFloat((tr.amount * (1 + payoutRate / 100)).toFixed(2)) : 0;

      if (isWin) {
        if (tr.accountType === 'live') user.liveBalance += profit;
        else user.demoBalance += profit;
      }

      let resObj = {
        tradeId: tr.id,
        username: tr.username,
        asset: tr.asset,
        isWin,
        profit,
        balance: (tr.accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2),
        time: now
      };

      recentTradeResults.unshift(resObj);
      activeServerTrades.splice(i, 1);

      let settleMsg = JSON.stringify({ type: 'TRADE_SETTLED', result: resObj });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(settleMsg);
      });
    }
  }

  // লাইভ টিক ব্রডকাস্ট
  let tickPayload = { type: 'TICK', serverTime: now, assets: {} };
  for (let key in ASSETS) {
    tickPayload.assets[key] = {
      price: ASSETS[key].price.toFixed(ASSETS[key].decimals),
      candle5s: candleHistories[key][candleHistories[key].length - 1],
      payout1m: ASSETS[key].payout1m,
      payout5m: ASSETS[key].payout5m,
      change24h: ASSETS[key].change24h
    };
  }

  let broadcastData = JSON.stringify(tickPayload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(broadcastData);
  });
}, 1000);

// এপিআই রুটস
app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));

// হিস্ট্রি এপিআই (যেকোনো রিকোয়েস্টে শতভাগ নিশ্চয়তার সাথে ডাটা প্রদান)
app.get(['/api/history', '/api/history/:asset*'], (req, res) => {
  let asset = req.params.asset || req.query.asset || 'EUR_USD';
  asset = asset.replace('/', '_');
  let data = candleHistories[asset] || candleHistories['EUR_USD'];
  let meta = ASSETS[asset] || ASSETS['EUR_USD'];
  res.json({ success: true, history: data, meta: meta, serverTime: Date.now() });
});

app.get('/api/active-trades', (req, res) => res.json({ success: true, trades: activeServerTrades, results: recentTradeResults }));

app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType, durationSec, asset, candleTime, clientEntryPrice } = req.body;
  let user = users["85857047"];
  let tradeAmount = Number(amount) || 1;
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < tradeAmount) return res.json({ success: false, message: "Insufficient balance!" });

  if (accountType === 'live') user.liveBalance -= tradeAmount;
  else user.demoBalance -= tradeAmount;

  let cleanAsset = (asset || "EUR_USD").replace('/', '_');
  let selectedAsset = ASSETS[cleanAsset] || ASSETS['EUR_USD'];
  let nowSec = Math.floor(Date.now() / 1000);
  let dur = Number(durationSec) || 60;
  let entryP = clientEntryPrice ? parseFloat(clientEntryPrice) : selectedAsset.price;

  let newTrade = {
    id: "TR-" + Date.now(),
    username: "demo_user",
    asset: cleanAsset,
    amount: tradeAmount,
    direction,
    accountType,
    entryPrice: entryP,
    candleTime: candleTime || (Math.floor(nowSec / 5) * 5),
    entryTime: nowSec,
    expireTime: nowSec + dur
  };

  activeServerTrades.push(newTrade);
  res.json({ success: true, trade: newTrade, balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2) });
});

app.post('/api/switch-account', (req, res) => {
  let user = users["85857047"];
  res.json({ success: true, activeAccount: req.body.type, balance: req.body.type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/reset-demo', (req, res) => {
  let user = users["85857047"];
  user.demoBalance = 11068.77;
  res.json({ success: true, balance: user.demoBalance.toFixed(2) });
});

app.get('/api/user/info', (req, res) => {
  let user = users["85857047"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance });
});

// অ্যাডমিন রাউটস
app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get(['/api/admin/overview', '/api/admin/data'], (req, res) => {
  res.json({
    success: true,
    totalUsers: Object.keys(users).length,
    totalDeposits: 10.00,
    users,
    groups: userGroups,
    assets: ASSETS,
    serverTime: Date.now()
  });
});

app.post('/api/admin/set-otc-trend', (req, res) => {
  const { asset, direction, durationMinutes } = req.body;
  if (ASSETS[asset]) {
    let mins = Math.max(1, parseInt(durationMinutes) || 5);
    ASSETS[asset].trend = direction || 'NORMAL';
    ASSETS[asset].trendUntil = Date.now() + (mins * 60 * 1000);
    return res.json({ success: true, message: `${ASSETS[asset].name} ট্রেন্ড ${direction} এ ${mins} মিনিটের জন্য সেট করা হয়েছে।` });
  }
  res.json({ success: false, message: "অ্যাসেট পাওয়া যায়নি।" });
});

app.post('/api/admin/set-otc-payout', (req, res) => {
  const { asset, payout1m, payout5m } = req.body;
  if (ASSETS[asset]) {
    if (payout1m) ASSETS[asset].payout1m = parseInt(payout1m);
    if (payout5m) ASSETS[asset].payout5m = parseInt(payout5m);
    return res.json({ success: true, message: `${ASSETS[asset].name} পেআউট আপডেট করা হয়েছে।` });
  }
  res.json({ success: false, message: "অ্যাসেট পাওয়া যায়নি।" });
});

app.post('/api/admin/adjust-balance', (req, res) => {
  const { userId, amount, type } = req.body;
  let user = users[userId];
  if (!user) return res.json({ success: false, message: "ব্যবহারকারী পাওয়া যায়নি!" });
  let delta = parseFloat(amount) || 0;
  if (type === 'add') user.liveBalance += delta;
  else user.liveBalance = Math.max(0, user.liveBalance - delta);
  res.json({ success: true, message: `ব্যালেন্স সফলভাবে আপডেট হয়েছে: $${user.liveBalance.toFixed(2)}` });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Pro Engine running on port ${PORT}`));
