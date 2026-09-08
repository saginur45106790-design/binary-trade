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
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

let PLATFORM_CONFIG = {
  maintenanceMode: false,
  dollarRate: 125.00,
  telegramLink: "https://t.me/tredlo_official",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  usdtBep20: "0x71C...BEP20_USDT_ADDR",
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
    password: "password123",
    liveBalance: 10.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false,
    traderLevel: "Starter",
    verificationStatus: "Unverified",
    accountStatus: "Active",
    nidFront: "",
    nidBack: ""
  }
};

// পয়েন্ট ৫: ডেমো ট্রেড উইন-লস ট্র্যাকার (১০টির মধ্যে ৭টি জিতবে, ৩টি হারবে)
let demoTradeCycles = {}; // { userId: { count: 0, wins: 0 } }

let ASSETS = {
  'EUR_USD': { name: 'EUR/USD (OTC)', ticker: 'EUR_USD', price: 1.08540, basePrice: 1.08540, decimals: 5, vol: 0.00030, payout1m: 92, payout5m: 85, change24h: -1.27, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'GBP_JPY': { name: 'GBP/JPY (OTC)', ticker: 'GBP_JPY', price: 191.450, basePrice: 191.450, decimals: 3, vol: 0.045, payout1m: 88, payout5m: 80, change24h: 0.21, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'GBP_USD': { name: 'GBP/USD (OTC)', ticker: 'GBP_USD', price: 1.35520, basePrice: 1.35520, decimals: 5, vol: 0.00035, payout1m: 86, payout5m: 83, change24h: 0.00, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'EUR_AUD': { name: 'EUR/AUD (OTC)', ticker: 'EUR_AUD', price: 1.62480, basePrice: 1.62480, decimals: 5, vol: 0.00040, payout1m: 94, payout5m: 95, change24h: -0.61, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'ETH':     { name: 'Ethereum (OTC)', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, vol: 1.60, payout1m: 81, payout5m: 67, change24h: 4.75, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'SOL':     { name: 'Solana (OTC)', ticker: 'SOL', price: 181.25, basePrice: 181.25, decimals: 2, vol: 0.40, payout1m: 81, payout5m: 64, change24h: -10.94, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'BNB':     { name: 'Binance Coin (OTC)', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, vol: 0.60, payout1m: 89, payout5m: 75, change24h: 2.33, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'BTC':     { name: 'Bitcoin (OTC)', ticker: 'BTC', price: 68525.50, basePrice: 68525.50, decimals: 2, vol: 4.80, payout1m: 85, payout5m: 82, change24h: 1.29, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'SILVER':  { name: 'Silver (OTC)', ticker: 'SILVER', price: 28.619, basePrice: 28.619, decimals: 3, vol: 0.025, payout1m: 88, payout5m: 77, change24h: 0.11, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'GOLD':    { name: 'Gold (OTC)', ticker: 'GOLD', price: 2350.40, basePrice: 2350.40, decimals: 2, vol: 0.80, payout1m: 92, payout5m: 79, change24h: 0.03, trend: 'NORMAL', trendUntil: 0, enabled: true }
};

let activeServerTrades = [];
let lifetimeTrades = [];
let depositHistory = [];
let withdrawalHistory = [];
let chatMessages = [];
let priceAlerts = [];
let notifications = [{ id: 1, title: "Welcome to Tredlo Terminal", body: PLATFORM_CONFIG.announcementNotice, time: "Just now" }];
let liveSignals = [
  { id: "SIG-101", asset: "EUR_USD", company: "EUR/USD OTC", strategy: "RSI Divergence", direction: "HIGHER", timeframe: "1m", strength: "94%" },
  { id: "SIG-102", asset: "GBP_USD", company: "GBP/USD OTC", strategy: "AI Trend Follow", direction: "LOWER", timeframe: "1m", strength: "89%" }
];
let platformTournaments = [{ id: "TOUR-1", title: "THE CROWN SERIES", prizePool: "$5,000", entryFee: "$2", participants: 474, status: "Active" }];
let globalLeaderboard = [{ rank: 1, name: "Ayesha Sheikh", country: "🇦🇪", deals: 142, profit: "+$34,850.20" }];

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// ২৪ ঘণ্টার হিস্টোরিক্যাল ১ মিনিট ক্যান্ডেলস্টিক
function initMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;
    for (let i = 240; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let delta = (Math.random() - 0.495) * meta.vol * 0.7;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 0.35).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 0.35).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }
    meta.price = cur;
    list.push({ time: currentCandleMinute, open: cur, high: cur, low: cur, close: cur });
    candleHistories[key] = list;
  }
}
initMarket();

// পয়েন্ট ৭: প্রতি সেকেন্ডের অতি মসৃণ ক্যান্ডেল মুভমেন্ট ও ১ মিনিট ফিক্সড ক্যান্ডেল সাইকেল
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);
  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    if (!meta.enabled) continue;

    let trendDrift = 0;
    if (now < meta.trendUntil) {
      if (meta.trend === 'UP') trendDrift = (meta.vol * 0.35) / 60.0;
      else if (meta.trend === 'DOWN') trendDrift = -(meta.vol * 0.35) / 60.0;
    } else {
      trendDrift = -(meta.price - meta.basePrice) * 0.0004 / 60.0;
    }

    let tickNoise = (Math.random() - 0.495) * (meta.vol * 0.035);
    meta.price = parseFloat((meta.price + trendDrift + tickNoise).toFixed(meta.decimals));

    let list = candleHistories[key];
    let lastCandle = list[list.length - 1];

    if (isNewMinute) {
      list.push({ time: nowMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
      if (list.length > 500) list.shift();
    } else {
      if (meta.price > lastCandle.high) lastCandle.high = meta.price;
      if (meta.price < lastCandle.low) lastCandle.low = meta.price;
      lastCandle.close = meta.price;
    }
  }

  if (isNewMinute) currentCandleMinute = nowMinute;

  // পয়েন্ট ৫ ও ৯: ট্রেড সেটেলমেন্ট ও ডেমো ৭০% উইন রেট (১০টিতে ৭টি উইন)
  for (let i = activeServerTrades.length - 1; i >= 0; i--) {
    let tr = activeServerTrades[i];
    if (sec >= tr.expireTime) {
      let isWin = false;
      let user = users[tr.userId] || users["85857047"];

      if (tr.accountType === 'demo') {
        let cycle = demoTradeCycles[tr.userId] || { count: 0, wins: 0 };
        let remainingInCycle = 10 - cycle.count;
        let neededWins = 7 - cycle.wins;

        if (neededWins >= remainingInCycle) isWin = true;
        else if (cycle.wins >= 7) isWin = false;
        else isWin = Math.random() < 0.70;

        cycle.count++;
        if (isWin) cycle.wins++;
        if (cycle.count >= 10) { cycle.count = 0; cycle.wins = 0; }
        demoTradeCycles[tr.userId] = cycle;
      } else {
        let exitP = ASSETS[tr.asset] ? ASSETS[tr.asset].price : tr.entryPrice;
        if (tr.direction === 'UP') isWin = (exitP > tr.entryPrice);
        else if (tr.direction === 'DOWN') isWin = (exitP < tr.entryPrice);
      }

      let payoutRate = ASSETS[tr.asset] ? ASSETS[tr.asset].payout1m : 92;
      let profit = isWin ? parseFloat((tr.amount * (1 + payoutRate / 100)).toFixed(2)) : 0;

      if (isWin) {
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

      let resRecord = {
        id: tr.id,
        userId: tr.userId,
        asset: tr.asset,
        direction: tr.direction,
        amount: tr.amount,
        profit: isWin ? (profit - tr.amount) : -tr.amount,
        isWin,
        accountType: tr.accountType,
        time: new Date().toLocaleTimeString()
      };
      lifetimeTrades.unshift(resRecord);
      activeServerTrades.splice(i, 1);

      let settleMsg = JSON.stringify({
        type: 'TRADE_SETTLED',
        result: {
          tradeId: tr.id,
          isWin,
          profit: isWin ? (profit - tr.amount) : 0,
          balance: (tr.accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
        }
      });
      wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(settleMsg); });
    }
  }

  let tickPayload = {
    type: 'TICK',
    countdown: remainingSec,
    serverTime: now,
    sentiment: { buyers: 58, sellers: 42 },
    assets: {}
  };
  for (let k in ASSETS) {
    if (ASSETS[k].enabled) {
      tickPayload.assets[k] = {
        price: ASSETS[k].price.toFixed(ASSETS[k].decimals),
        candle: candleHistories[k][candleHistories[k].length - 1],
        payout1m: ASSETS[k].payout1m,
        change24h: ASSETS[k].change24h
      };
    }
  }
  let payloadStr = JSON.stringify(tickPayload);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payloadStr); });
}, 1000);

// WebSocket পিং-পং
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// পয়েন্ট ১ ও ২: রেজিস্ট্রেশন ও লগইন (কনফার্ম পাসওয়ার্ড ও ১৮+ শর্ত সহ)
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password, confirmPassword, isEighteen } = req.body;
  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.json({ success: false, message: "Please fill all required fields!" });
  }
  if (password !== confirmPassword) {
    return res.json({ success: false, message: "Passwords do not match!" });
  }
  if (!isEighteen) {
    return res.json({ success: false, message: "You must be 18+ years old to create an account!" });
  }

  for (let id in users) {
    if (users[id].email.toLowerCase() === email.toLowerCase()) {
      return res.json({ success: false, message: "Account already exists with this email!" });
    }
  }

  let newId = String(Math.floor(10000000 + Math.random() * 90000000));
  users[newId] = {
    id: newId,
    username: email,
    name: name.trim(),
    displayName: name.trim().split(' ')[0],
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    password,
    liveBalance: 0.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false,
    traderLevel: "Starter",
    verificationStatus: "Unverified",
    accountStatus: "Active",
    nidFront: "",
    nidBack: ""
  };
  res.json({ success: true, userId: newId, user: users[newId] });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  for (let id in users) {
    let u = users[id];
    if ((u.email.toLowerCase() === (email || "").toLowerCase() || u.id === email) && u.password === password) {
      if (u.accountStatus === 'Banned') return res.json({ success: false, message: "Account is BANNED!" });
      if (u.accountStatus === 'Suspended') return res.json({ success: false, message: "Account is SUSPENDED!" });
      return res.json({ success: true, userId: id, user: u });
    }
  }
  res.json({ success: false, message: "Invalid email or password!" });
});

app.get('/api/user/:id', (req, res) => res.json({ success: true, user: users[req.params.id] || users["85857047"] }));
app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));
app.get('/api/history', (req, res) => {
  let asset = (req.query.asset || 'EUR_USD').replace('/', '_');
  res.json({ success: true, history: candleHistories[asset] || candleHistories['EUR_USD'], meta: ASSETS[asset] || ASSETS['EUR_USD'] });
});

// ট্রেড এক্সিকিউশন
app.post('/api/trade', (req, res) => {
  const { userId, amount, direction, accountType, asset } = req.body;
  let u = users[userId] || users["85857047"];
  let tradeAmount = parseFloat(amount) || 1;
  let bal = accountType === 'live' ? u.liveBalance : u.demoBalance;
  if (bal < tradeAmount) return res.json({ success: false, message: "Insufficient balance!" });

  if (accountType === 'live') u.liveBalance -= tradeAmount;
  else u.demoBalance -= tradeAmount;

  let cleanAsset = (asset || "EUR_USD").replace('/', '_');
  let nowSec = Math.floor(Date.now() / 1000);
  let currentPrice = ASSETS[cleanAsset] ? ASSETS[cleanAsset].price : 1.08540;

  let trade = {
    id: "TR-" + Date.now(),
    userId: u.id,
    asset: cleanAsset,
    amount: tradeAmount,
    direction,
    accountType,
    entryPrice: currentPrice,
    entryTime: nowSec,
    durationSec: 60,
    expireTime: nowSec + 60
  };
  activeServerTrades.push(trade);
  res.json({ success: true, trade, balance: (accountType === 'live' ? u.liveBalance : u.demoBalance).toFixed(2) });
});

// ডিপোজিট ও উইথড্রয়াল (২X টার্নওভার সহ)
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, method, amount, trxId, promoCode } = req.body;
  let amt = parseFloat(amount);
  if (!amt || !trxId) return res.json({ success: false, message: "Amount & TrxID required!" });
  let bonus = promoCode === 'WELCOME70' ? (amt * 0.7) : 0;
  depositHistory.unshift({ id: "DEP-" + Date.now(), userId: userId || "85857047", method, amount: amt, bonusAmount: bonus, trxId: trxId.trim(), status: "Pending", date: new Date().toLocaleString() });
  res.json({ success: true, message: "Deposit submitted! Pending Approval." });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, method, amount, accountDetails } = req.body;
  let u = users[userId] || users["85857047"];
  let amt = parseFloat(amount);
  if (u.hasActiveBonus && u.currentTurnover < u.requiredTurnover) {
    return res.json({ success: false, turnoverBlocked: true, message: `Withdrawal restricted! Complete 2X turnover requirement.` });
  }
  if (u.liveBalance < amt) return res.json({ success: false, message: "Insufficient live balance!" });
  u.liveBalance -= amt;
  withdrawalHistory.unshift({ id: "WIT-" + Date.now(), userId: u.id, method, amount: amt, accountDetails: accountDetails.trim(), status: "Pending", date: new Date().toLocaleString() });
  res.json({ success: true, message: "Withdrawal request placed!", balance: u.liveBalance.toFixed(2) });
});

app.get('/api/signals/list', (req, res) => res.json({ success: true, signals: liveSignals }));
app.get('/api/tournaments/list', (req, res) => res.json({ success: true, tournaments: platformTournaments }));
app.get('/api/leaderboard', (req, res) => res.json({ success: true, leaderboard: globalLeaderboard }));
app.get('/api/support/messages', (req, res) => res.json({ success: true, messages: chatMessages }));
app.post('/api/support/send', (req, res) => {
  let msg = { id: Date.now(), sender: req.body.sender || "User", text: req.body.text || "", timeStr: new Date().toLocaleTimeString() };
  chatMessages.push(msg);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CHAT_MSG', message: msg })); });
  res.json({ success: true });
});
app.get('/api/notifications', (req, res) => res.json({ notifications, announcement: PLATFORM_CONFIG.announcementNotice }));

// অ্যাডমিন ওভারভিউ
app.get('/api/admin/overview', (req, res) => {
  let totalVol = lifetimeTrades.reduce((s, t) => s + Number(t.amount), 0);
  let totalDep = depositHistory.filter(d => d.status === 'Approved').reduce((s, d) => s + Number(d.amount), 0);
  let totalWith = withdrawalHistory.filter(w => w.status === 'Approved').reduce((s, w) => s + Number(w.amount), 0);
  res.json({
    success: true,
    counts: { pendingKyc: 0, pendingDeposits: depositHistory.filter(d => d.status === 'Pending').length, pendingWithdrawals: withdrawalHistory.filter(w => w.status === 'Pending').length, supportMessages: chatMessages.length, totalUsers: Object.keys(users).length, totalVolume: totalVol.toFixed(2), totalDepositsVolume: totalDep.toFixed(2), totalWithdrawalsVolume: totalWith.toFixed(2) },
    config: PLATFORM_CONFIG,
    users,
    deposits: depositHistory,
    withdrawals: withdrawalHistory,
    trades: activeServerTrades,
    assets: ASSETS,
    signals: liveSignals,
    tournaments: platformTournaments
  });
});

app.post('/api/admin/adjust-balance', (req, res) => {
  let u = users[req.body.userId];
  if (u) {
    if (req.body.actionType === 'add') u.liveBalance += parseFloat(req.body.amount);
    else u.liveBalance = Math.max(0, u.liveBalance - parseFloat(req.body.amount));
    let sync = JSON.stringify({ type: 'BALANCE_UPDATE', userId: u.id, liveBalance: u.liveBalance.toFixed(2), demoBalance: u.demoBalance.toFixed(2) });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(sync); });
  }
  res.json({ success: true, message: "Balance updated!" });
});

app.post('/api/admin/action-deposit', (req, res) => {
  let dep = depositHistory.find(d => d.id === req.body.id);
  if (dep) {
    dep.status = req.body.action === 'approve' ? 'Approved' : 'Rejected';
    if (req.body.action === 'approve') users[dep.userId].liveBalance += (dep.amount + (dep.bonusAmount || 0));
  }
  res.json({ success: true, message: "Deposit processed!" });
});

app.post('/api/admin/action-withdraw', (req, res) => {
  let w = withdrawalHistory.find(item => item.id === req.body.id);
  if (w) {
    w.status = req.body.action === 'approve' ? 'Approved' : 'Rejected';
    if (req.body.action === 'reject') users[w.userId].liveBalance += w.amount;
  }
  res.json({ success: true, message: "Withdrawal processed!" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Institutional Engine running on port ${PORT}`));
