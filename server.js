const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '-1');
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// মূল ক্লায়েন্ট ইন্টারফেস রুট
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// অ্যাডমিন মাস্টার ড্যাশবোর্ড রুট
app.get(['/admin', '/admin-secret-panel'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// গ্লোবাল কনফিগারেশন ও ডাটাবেस
let PLATFORM_CONFIG = {
  dollarRate: 125.00,
  telegramLink: "https://t.me/tredlo_official",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  usdtTrc20: "TX9...TRC20_USDT_ADDR",
  announcementNotice: "📢 স্বাগতম Tredlo V12.0 এ! প্রথম ডিপোজিটে +৭০% বোনাস (কুপন: WELCOME70) উপভোগ করুন।"
};

let users = {
  "85857047": {
    id: "85857047",
    name: "MD Sajib Hossain",
    displayName: "Sajib Trader",
    email: "teachsajib@gmail.com",
    phone: "01700000000",
    liveBalance: 10.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false,
    verificationStatus: "Unverified",
    accountStatus: "Active",
    nidFront: "",
    nidBack: ""
  }
};

let ASSETS = {
  'EUR_USD': { name: 'EUR/USD (OTC)', ticker: 'EUR_USD', price: 1.08540, basePrice: 1.08540, decimals: 5, vol: 0.00030, payout1m: 92, payout5m: 85, change24h: -1.27, enabled: true },
  'GBP_JPY': { name: 'GBP/JPY (OTC)', ticker: 'GBP_JPY', price: 191.450, basePrice: 191.450, decimals: 3, vol: 0.045, payout1m: 88, payout5m: 80, change24h: 0.21, enabled: true },
  'BTC':     { name: 'Bitcoin (OTC)', ticker: 'BTC', price: 68525.50, basePrice: 68525.50, decimals: 2, vol: 4.80, payout1m: 85, payout5m: 82, change24h: 1.29, enabled: true },
  'GOLD':    { name: 'Gold (OTC)', ticker: 'GOLD', price: 2350.40, basePrice: 2350.40, decimals: 2, vol: 0.80, payout1m: 92, payout5m: 79, change24h: 0.03, enabled: true }
};

let activeServerTrades = [];
let lifetimeTrades = [];
let depositHistory = [];
let withdrawalHistory = [];
let chatMessages = [];
let priceAlerts = [];
let notifications = [{ id: 1, title: "Welcome to Tredlo", body: PLATFORM_CONFIG.announcementNotice, time: "Just now" }];
let liveSignals = [{ id: "SIG-101", asset: "EUR_USD", company: "EUR/USD OTC", strategy: "RSI Divergence", direction: "HIGHER", timeframe: "5m", strength: "94%" }];
let platformTournaments = [{ id: "TOUR-1", title: "THE CROWN SERIES", prizePool: "$5,000", entryFee: "$2", participants: 474, status: "Active" }];
let globalLeaderboard = [{ rank: 1, name: "Ayesha Sheikh", country: "🇦🇪", deals: 142, profit: "+$34,850.20" }];

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

function initMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;
    for (let i = 200; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let delta = (Math.random() - 0.495) * meta.vol;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: Math.max(o, c) + 0.001, low: Math.min(o, c) - 0.001, close: c });
      cur = c;
    }
    candleHistories[key] = list;
  }
}
initMarket();

// প্রতি সেকেন্ডের টিক ও ট্রেড ইঞ্জিন
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let tickNoise = (Math.random() - 0.495) * (meta.vol * 0.04);
    meta.price = parseFloat((meta.price + tickNoise).toFixed(meta.decimals));
    let list = candleHistories[key];
    if (list && list.length > 0) {
      let last = list[list.length - 1];
      last.close = meta.price;
      if (meta.price > last.high) last.high = meta.price;
      if (meta.price < last.low) last.low = meta.price;
    }
  }

  for (let i = activeServerTrades.length - 1; i >= 0; i--) {
    let tr = activeServerTrades[i];
    if (sec >= tr.expireTime) {
      let exitP = ASSETS[tr.asset] ? ASSETS[tr.asset].price : tr.entryPrice;
      let isWin = tr.direction === 'UP' ? (exitP > tr.entryPrice) : (exitP < tr.entryPrice);
      let isDraw = (exitP === tr.entryPrice);
      let user = users[tr.userId] || users["85857047"];

      let payoutRate = ASSETS[tr.asset] ? ASSETS[tr.asset].payout1m : 92;
      let profit = isWin ? parseFloat((tr.amount * (1 + payoutRate / 100)).toFixed(2)) : (isDraw ? tr.amount : 0);

      if (isWin || isDraw) {
        if (tr.accountType === 'live') user.liveBalance += profit;
        else user.demoBalance += profit;
      }

      if (user.hasActiveBonus && tr.accountType === 'live') {
        user.currentTurnover += tr.amount;
        if (user.currentTurnover >= user.requiredTurnover) {
          user.hasActiveBonus = false;
          user.requiredTurnover = 0;
          user.currentTurnover = 0;
        }
      }

      let resRecord = { id: tr.id, userId: tr.userId, asset: tr.asset, direction: tr.direction, amount: tr.amount, profit: isWin ? profit : -tr.amount, isWin, isDraw, accountType: tr.accountType, time: new Date().toLocaleTimeString() };
      lifetimeTrades.unshift(resRecord);
      activeServerTrades.splice(i, 1);

      let settleMsg = JSON.stringify({ type: 'TRADE_SETTLED', result: { tradeId: tr.id, isWin, isDraw, profit: resRecord.profit, balance: (tr.accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2) } });
      wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(settleMsg); });
    }
  }

  let tickPayload = JSON.stringify({ type: 'TICK', serverTime: now, assets: ASSETS, sentiment: { buyers: 55, sellers: 45 } });
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(tickPayload); });
}, 1000);

// API এন্ডপয়েন্টস
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  for (let id in users) {
    if (users[id].email.toLowerCase() === (email || "").toLowerCase() && users[id].password === password) {
      return res.json({ success: true, userId: id, user: users[id] });
    }
  }
  res.json({ success: true, userId: "85857047", user: users["85857047"] });
});

app.get('/api/user/:id', (req, res) => res.json({ success: true, user: users[req.params.id] || users["85857047"] }));
app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));
app.get('/api/history', (req, res) => res.json({ success: true, history: candleHistories[req.query.asset || 'EUR_USD'] }));

app.post('/api/trade', (req, res) => {
  const { userId, amount, direction, accountType, durationSec, asset } = req.body;
  let u = users[userId] || users["85857047"];
  let amt = parseFloat(amount) || 1;
  let bal = accountType === 'live' ? u.liveBalance : u.demoBalance;
  if (bal < amt) return res.json({ success: false, message: "Insufficient balance!" });

  if (accountType === 'live') u.liveBalance -= amt;
  else u.demoBalance -= amt;

  let trade = { id: "TR-" + Date.now(), userId: u.id, asset: asset || 'EUR_USD', amount: amt, direction, accountType, entryPrice: ASSETS[asset || 'EUR_USD'].price, expireTime: Math.floor(Date.now() / 1000) + (parseInt(durationSec) || 60) };
  activeServerTrades.push(trade);
  res.json({ success: true, trade, balance: (accountType === 'live' ? u.liveBalance : u.demoBalance).toFixed(2) });
});

app.post('/api/wallet/deposit', (req, res) => {
  const { userId, method, amount, trxId, promoCode } = req.body;
  depositHistory.unshift({ id: "DEP-" + Date.now(), userId: userId || "85857047", method: method || "Binance", amount: parseFloat(amount), trxId, status: "Pending", date: new Date().toLocaleString() });
  res.json({ success: true, message: "Deposit submitted! Status is Pending Approval." });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, amount, accountDetails } = req.body;
  let u = users[userId] || users["85857047"];
  let amt = parseFloat(amount);
  if (u.hasActiveBonus && u.currentTurnover < u.requiredTurnover) {
    return res.json({ success: false, turnoverBlocked: true, message: `Withdrawal restricted! 2X Turnover remaining.` });
  }
  u.liveBalance -= amt;
  withdrawalHistory.unshift({ id: "WIT-" + Date.now(), userId: u.id, amount: amt, accountDetails, status: "Pending", date: new Date().toLocaleString() });
  res.json({ success: true, message: "Withdrawal placed!", balance: u.liveBalance.toFixed(2) });
});

app.get('/api/signals/list', (req, res) => res.json({ success: true, signals: liveSignals }));
app.get('/api/tournaments/list', (req, res) => res.json({ success: true, tournaments: platformTournaments }));
app.get('/api/leaderboard', (req, res) => res.json({ success: true, leaderboard: globalLeaderboard }));
app.get('/api/support/messages', (req, res) => res.json({ success: true, messages: chatMessages }));
app.post('/api/support/send', (req, res) => {
  chatMessages.push({ id: Date.now(), sender: req.body.sender || 'User', text: req.body.text, timeStr: new Date().toLocaleTimeString() });
  res.json({ success: true });
});
app.post('/api/bonus/claim', (req, res) => {
  let u = users[req.body.userId || "85857047"];
  let free = parseFloat(req.body.freeAmount || 5);
  u.liveBalance += free;
  u.bonusBalance += free;
  u.hasActiveBonus = true;
  u.requiredTurnover += (free * 2);
  res.json({ success: true, message: `Bonus $${free} claimed! 2X turnover activated.` });
});
app.get('/api/payments/all', (req, res) => res.json({ deposits: depositHistory, withdrawals: withdrawalHistory }));
app.get('/api/trades/lifetime', (req, res) => res.json({ trades: lifetimeTrades }));
app.get('/api/notifications', (req, res) => res.json({ notifications, announcement: PLATFORM_CONFIG.announcementNotice }));

// Admin API
app.get('/api/admin/overview', (req, res) => {
  res.json({ success: true, counts: { pendingKyc: 0, pendingDeposits: depositHistory.filter(d=>d.status==='Pending').length, pendingWithdrawals: withdrawalHistory.filter(w=>w.status==='Pending').length, supportMessages: chatMessages.length, totalUsers: 1, totalVolume: lifetimeTrades.reduce((s,t)=>s+t.amount,0).toFixed(2), totalDepositsVolume: 100, totalWithdrawalsVolume: 0 }, config: PLATFORM_CONFIG, users, deposits: depositHistory, withdrawals: withdrawalHistory, assets: ASSETS, signals: liveSignals, tournaments: platformTournaments });
});
app.post('/api/admin/adjust-balance', (req, res) => {
  let u = users[req.body.userId];
  if(u) {
    if(req.body.actionType === 'add') u.liveBalance += parseFloat(req.body.amount);
    else u.liveBalance = Math.max(0, u.liveBalance - parseFloat(req.body.amount));
  }
  res.json({ success: true, message: "Balance updated!" });
});
app.post('/api/admin/action-deposit', (req, res) => {
  let d = depositHistory.find(x => x.id === req.body.id);
  if(d) {
    d.status = req.body.action === 'approve' ? 'Approved' : 'Rejected';
    if(d.status === 'Approved') users[d.userId].liveBalance += d.amount;
  }
  res.json({ success: true, message: "Deposit processed!" });
});
app.post('/api/admin/action-withdraw', (req, res) => {
  let w = withdrawalHistory.find(x => x.id === req.body.id);
  if(w) {
    w.status = req.body.action === 'approve' ? 'Approved' : 'Rejected';
    if(w.status === 'Rejected') users[w.userId].liveBalance += w.amount;
  }
  res.json({ success: true, message: "Withdrawal processed!" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Unified Trading Engine running on port ${PORT}`));
