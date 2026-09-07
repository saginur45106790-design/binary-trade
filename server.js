const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// প্ল্যাটফর্ম গ্লোবাল কনফিগারেশন
let PLATFORM_CONFIG = {
  dollarRate: 125.00,
  telegramLink: "https://t.me/yourchannel",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  usdtBep20: "0x71C...BEP20_USDT_ADDR",
  usdtTrc20: "TX9...TRC20_USDT_ADDR",
  btcBep20: "0x89A...BEP20_BTC_ADDR",
  btcNetwork: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  announcementNotice: "📢 স্বাগতম Tredlo V11.0 এ! প্রথম ডিপোজিটে ৫০% বোনাস উপভোগ করুন।"
};

// ইউজার ডাটাবেস (সাসপেন্ড ও ব্যান স্ট্যাটাস সহ)
let users = {
  "85857047": {
    id: "85857047",
    username: "teachsajib@gmail.com",
    name: "MD Sajib Hossain",
    email: "teachsajib@gmail.com",
    phone: "01700000000",
    dob: "2000-01-01",
    address: "Dhaka, Bangladesh",
    zip: "1200",
    password: "password123",
    liveBalance: 10.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false,
    verificationStatus: "Unverified", // Unverified | Pending | Verified
    accountStatus: "Active",          // Active | Suspended | Banned
    nidFront: "",
    nidBack: "",
    registeredAt: "2026-09-01"
  }
};

// ১০টি সম্পূর্ণ স্বতন্ত্র OTC অ্যাসেট
let ASSETS = {
  'EUR_USD': { name: 'EUR/USD (OTC)', ticker: 'EUR_USD', price: 1.08540, basePrice: 1.08540, decimals: 5, vol: 0.00030, payout1m: 77, payout5m: 77, change24h: -1.27, trend: 'NORMAL', trendUntil: 0 },
  'GBP_JPY': { name: 'GBP/JPY (OTC)', ticker: 'GBP_JPY', price: 191.450, basePrice: 191.450, decimals: 3, vol: 0.045, payout1m: 77, payout5m: 80, change24h: 0.21, trend: 'NORMAL', trendUntil: 0 },
  'GBP_USD': { name: 'GBP/USD (OTC)', ticker: 'GBP_USD', price: 1.31210, basePrice: 1.31210, decimals: 5, vol: 0.00035, payout1m: 92, payout5m: 83, change24h: 0.00, trend: 'NORMAL', trendUntil: 0 },
  'EUR_AUD': { name: 'EUR/AUD (OTC)', ticker: 'EUR_AUD', price: 1.62480, basePrice: 1.62480, decimals: 5, vol: 0.00040, payout1m: 94, payout5m: 95, change24h: -0.61, trend: 'NORMAL', trendUntil: 0 },
  'ETH':     { name: 'Ethereum (OTC)', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, vol: 1.60, payout1m: 81, payout5m: 67, change24h: 4.75, trend: 'NORMAL', trendUntil: 0 },
  'SOL':     { name: 'Solana (OTC)', ticker: 'SOL', price: 177.50, basePrice: 177.50, decimals: 2, vol: 0.40, payout1m: 81, payout5m: 64, change24h: -10.94, trend: 'NORMAL', trendUntil: 0 },
  'BNB':     { name: 'Binance Coin (OTC)', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, vol: 0.60, payout1m: 89, payout5m: 75, change24h: 2.33, trend: 'NORMAL', trendUntil: 0 },
  'BTC':     { name: 'Bitcoin (OTC)', ticker: 'BTC', price: 68525.50, basePrice: 68525.50, decimals: 2, vol: 4.80, payout1m: 75, payout5m: 82, change24h: 1.29, trend: 'NORMAL', trendUntil: 0 },
  'SILVER':  { name: 'Silver (OTC)', ticker: 'SILVER', price: 28.520, basePrice: 28.520, decimals: 3, vol: 0.025, payout1m: 88, payout5m: 77, change24h: 0.11, trend: 'NORMAL', trendUntil: 0 },
  'GOLD':    { name: 'Gold (OTC)', ticker: 'GOLD', price: 2350.40, basePrice: 2350.40, decimals: 2, vol: 0.80, payout1m: 92, payout5m: 79, change24h: 0.03, trend: 'NORMAL', trendUntil: 0 }
};

let activeServerTrades = [];
let lifetimeTrades = [];
let depositHistory = [];
let withdrawalHistory = [];
let chatMessages = [];
let notifications = [
  { id: 1, title: "Platform Ready", body: PLATFORM_CONFIG.announcementNotice, time: "Just now" }
];

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// কটেক্স স্টাইলের ১,৪৪০ ক্যান্ডেল তৈরি
function init24HourMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;
  let multipliers = { 'EUR_USD': 1.1, 'GBP_JPY': 0.8, 'GBP_USD': 1.3, 'EUR_AUD': 0.9, 'ETH': 1.5, 'SOL': 1.2, 'BNB': 0.7, 'BTC': 1.4, 'SILVER': 0.6, 'GOLD': 1.0 };

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;
    let seed = multipliers[key] || 1.0;

    for (let i = 1440; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let randShape = Math.random();
      let drift = -(cur - meta.basePrice) * 0.001;
      let delta = (Math.sin(i * seed) * 0.45 + (Math.random() - 0.495)) * meta.vol * 0.6 + drift;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));

      let upperWick = Math.random() * meta.vol * 0.3;
      let lowerWick = Math.random() * meta.vol * 0.3;
      if (randShape > 0.85) lowerWick += meta.vol * 0.5;
      else if (randShape < 0.15) upperWick += meta.vol * 0.5;

      let h = parseFloat((Math.max(o, c) + upperWick + 0.008 * meta.vol).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - lowerWick - 0.008 * meta.vol).toFixed(meta.decimals));

      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
    list.push({ time: currentCandleMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
    candleHistories[key] = list;
  }
}
init24HourMarket();

// প্রতি সেকেন্ডের স্মুথ মার্কেট টিক ও ট্রেন্ড
setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);
  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let trendDrift = 0;

    if (now < meta.trendUntil) {
      if (meta.trend === 'UP') trendDrift = (meta.vol * 0.35) / 60.0;
      else if (meta.trend === 'DOWN') trendDrift = -(meta.vol * 0.35) / 60.0;
    } else {
      meta.trend = 'NORMAL';
      trendDrift = -(meta.price - meta.basePrice) * 0.0004 / 60.0;
    }

    let tickNoise = (Math.random() - 0.495) * (meta.vol * 0.035);
    meta.price = parseFloat((meta.price + trendDrift + tickNoise).toFixed(meta.decimals));

    let list = candleHistories[key];
    let lastCandle = list[list.length - 1];

    if (isNewMinute) {
      list.push({ time: nowMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
      if (list.length > 1440) list.shift();
    } else {
      if (meta.price > lastCandle.high) lastCandle.high = meta.price;
      if (meta.price < lastCandle.low) lastCandle.low = meta.price;
      lastCandle.close = meta.price;
    }
  }

  if (isNewMinute) currentCandleMinute = nowMinute;

  // ট্রেড সেটেলমেন্ট ও ২X টার্নওভার গণনা
  for (let i = activeServerTrades.length - 1; i >= 0; i--) {
    let tr = activeServerTrades[i];
    if (sec >= tr.expireTime) {
      let exitP = ASSETS[tr.asset] ? ASSETS[tr.asset].price : tr.entryPrice;
      let isWin = false;
      let user = users[tr.userId] || users["85857047"];

      if (tr.direction === 'UP') isWin = (exitP > tr.entryPrice);
      else if (tr.direction === 'DOWN') isWin = (exitP < tr.entryPrice);

      let payoutRate = ASSETS[tr.asset] ? (tr.durationSec >= 300 ? ASSETS[tr.asset].payout5m : ASSETS[tr.asset].payout1m) : 85;
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
          user.bonusBalance = 0;
        }
      }

      let resRecord = {
        id: tr.id,
        userId: tr.userId,
        asset: tr.asset,
        direction: tr.direction,
        amount: tr.amount,
        entryPrice: tr.entryPrice,
        exitPrice: exitP,
        profit: isWin ? profit : 0,
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
          profit: resRecord.profit,
          balance: (tr.accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
        }
      });
      wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(settleMsg); });
    }
  }

  let tickPayload = { type: 'TICK', countdown: remainingSec, serverTime: now, assets: {} };
  for (let k in ASSETS) {
    tickPayload.assets[k] = {
      price: ASSETS[k].price.toFixed(ASSETS[k].decimals),
      candle: candleHistories[k][candleHistories[k].length - 1],
      payout1m: ASSETS[k].payout1m,
      payout5m: ASSETS[k].payout5m,
      change24h: ASSETS[k].change24h
    };
  }
  let payloadStr = JSON.stringify(tickPayload);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payloadStr); });
}, 1000);

// অথেন্টিকেশন (সাসপেন্ড বা ব্যান চেক সহ)
app.post('/api/auth/register', (req, res) => {
  const { email, password, phone } = req.body;
  if (!email || !password) return res.json({ success: false, message: "Email and password required!" });

  for (let id in users) {
    if (users[id].email.toLowerCase() === email.toLowerCase()) {
      return res.json({ success: false, message: "Account already exists!" });
    }
  }

  let newId = String(Math.floor(10000000 + Math.random() * 90000000));
  users[newId] = {
    id: newId,
    username: email,
    name: email.split('@')[0],
    email,
    phone: phone || "01700000000",
    dob: "2000-01-01",
    address: "Bangladesh",
    zip: "1000",
    password,
    liveBalance: 0.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false,
    verificationStatus: "Unverified",
    accountStatus: "Active",
    nidFront: "",
    nidBack: "",
    registeredAt: new Date().toISOString().split('T')[0]
  };
  res.json({ success: true, userId: newId, user: users[newId] });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  for (let id in users) {
    let u = users[id];
    if ((u.email.toLowerCase() === (email || "").toLowerCase() || u.id === email) && u.password === password) {
      if (u.accountStatus === 'Banned') {
        return res.json({ success: false, message: "Your account is permanently BANNED by Admin!" });
      }
      if (u.accountStatus === 'Suspended') {
        return res.json({ success: false, message: "Your account is temporarily SUSPENDED by Admin!" });
      }
      return res.json({ success: true, userId: id, user: u });
    }
  }
  res.json({ success: false, message: "Invalid email or password!" });
});

// প্রোফাইল ও কেওয়াইসি
app.get('/api/user/:id', (req, res) => {
  let u = users[req.params.id] || users["85857047"];
  res.json({ success: true, user: u });
});

app.post('/api/user/update', (req, res) => {
  const { id, name, email, phone, dob, address, zip } = req.body;
  let u = users[id] || users["85857047"];
  if (name) u.name = name;
  if (email) u.email = email;
  if (phone) u.phone = phone;
  if (dob) u.dob = dob;
  if (address) u.address = address;
  if (zip) u.zip = zip;
  res.json({ success: true, message: "Profile details updated!", user: u });
});

app.post('/api/user/submit-nid', (req, res) => {
  const { id, nidFront, nidBack } = req.body;
  let u = users[id] || users["85857047"];
  if (!nidFront || !nidBack) return res.json({ success: false, message: "Upload both sides of NID!" });
  u.nidFront = nidFront;
  u.nidBack = nidBack;
  u.verificationStatus = "Pending";
  res.json({ success: true, message: "NID documents submitted! Status is Pending." });
});

// বোনাস ও ট্রেডিং
app.post('/api/bonus/claim', (req, res) => {
  const { userId, targetTrade, freeAmount } = req.body;
  let u = users[userId] || users["85857047"];
  let free = parseFloat(freeAmount);
  u.bonusBalance += free;
  u.liveBalance += free;
  u.hasActiveBonus = true;
  u.requiredTurnover += (free * 2.0);
  res.json({ success: true, message: `Bonus claimed! $${free} added. 2X Turnover ($${u.requiredTurnover.toFixed(2)}) activated.`, user: u });
});

app.post('/api/trade', (req, res) => {
  const { userId, amount, direction, accountType, durationSec, asset } = req.body;
  let u = users[userId] || users["85857047"];
  if (u.accountStatus !== 'Active') return res.json({ success: false, message: `Account is ${u.accountStatus}!` });

  let tradeAmount = parseFloat(amount) || 1;
  let bal = accountType === 'live' ? u.liveBalance : u.demoBalance;
  if (bal < tradeAmount) return res.json({ success: false, message: "Insufficient balance!" });

  if (accountType === 'live') u.liveBalance -= tradeAmount;
  else u.demoBalance -= tradeAmount;

  let cleanAsset = (asset || "EUR_USD").replace('/', '_');
  let nowSec = Math.floor(Date.now() / 1000);
  let dur = parseInt(durationSec) || 60;
  let currentPrice = ASSETS[cleanAsset] ? ASSETS[cleanAsset].price : 1.08540;

  let trade = {
    id: "TR-" + Date.now(),
    userId: u.id,
    asset: cleanAsset,
    amount: tradeAmount,
    direction,
    accountType,
    entryPrice: currentPrice,
    candleTime: Math.floor(nowSec / 60) * 60,
    entryTime: nowSec,
    durationSec: dur,
    expireTime: nowSec + dur
  };
  activeServerTrades.push(trade);
  res.json({ success: true, trade, balance: (accountType === 'live' ? u.liveBalance : u.demoBalance).toFixed(2) });
});

// ওয়ালেট
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, method, amount, trxId, screenshot } = req.body;
  let amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0 || !trxId) return res.json({ success: false, message: "Valid amount & TrxID required!" });

  let dep = {
    id: "DEP-" + Date.now(),
    userId: userId || "85857047",
    method: method || "Binance",
    amount: amt,
    trxId: trxId.trim(),
    screenshot: screenshot || "",
    status: "Pending",
    date: new Date().toLocaleString()
  };
  depositHistory.unshift(dep);
  res.json({ success: true, message: "Deposit request submitted! Status is Pending." });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, method, amount, accountDetails, network } = req.body;
  let u = users[userId] || users["85857047"];
  let amt = parseFloat(amount);

  if (isNaN(amt) || amt <= 0 || !accountDetails) return res.json({ success: false, message: "Valid amount & details required!" });

  if (u.hasActiveBonus && u.currentTurnover < u.requiredTurnover) {
    let rem = (u.requiredTurnover - u.currentTurnover).toFixed(2);
    return res.json({ success: false, turnoverBlocked: true, message: `Withdrawal restricted! 2X turnover remaining: $${rem}` });
  }

  if (u.liveBalance < amt) return res.json({ success: false, message: "Insufficient live balance!" });

  u.liveBalance -= amt;
  let w = {
    id: "WIT-" + Date.now(),
    userId: u.id,
    method: method || "bKash",
    network: network || "Direct",
    amount: amt,
    accountDetails: accountDetails.trim(),
    status: "Pending",
    date: new Date().toLocaleString()
  };
  withdrawalHistory.unshift(w);
  res.json({ success: true, message: "Withdrawal placed!", balance: u.liveBalance.toFixed(2) });
});

// লাইভ সাপোর্ট মেসেঞ্জার (২৪ ঘণ্টা মেমোরি)
app.get('/api/support/messages', (req, res) => {
  let cutoff = Date.now() - (24 * 60 * 60 * 1000);
  chatMessages = chatMessages.filter(m => m.timestamp >= cutoff);
  res.json({ success: true, messages: chatMessages });
});

app.post('/api/support/send', (req, res) => {
  const { sender, text, image, userId } = req.body;
  let msg = {
    id: Date.now(),
    sender: sender || "User",
    userId: userId || "85857047",
    text: text || "",
    image: image || "",
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString()
  };
  chatMessages.push(msg);

  let chatBroadcast = JSON.stringify({ type: 'CHAT_MSG', message: msg });
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(chatBroadcast); });
  res.json({ success: true, message: msg });
});

// -------------------------------------------------------------
// অ্যাডমিন ড্যাশবোর্ড API (স্ক্রিনশট ১০১৩ কাউন্টস ও ফিচারসমূহ)
// -------------------------------------------------------------
app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/admin/overview', (req, res) => {
  let pendingKycCount = 0;
  let totalUsersCount = Object.keys(users).length;
  for (let id in users) {
    if (users[id].verificationStatus === 'Pending') pendingKycCount++;
  }

  let pendingDepositsCount = depositHistory.filter(d => d.status === 'Pending').length;
  let pendingWithdrawalsCount = withdrawalHistory.filter(w => w.status === 'Pending').length;
  let supportMessagesCount = chatMessages.filter(m => m.sender === 'User').length;

  res.json({
    success: true,
    counts: {
      pendingKyc: pendingKycCount,
      pendingDeposits: pendingDepositsCount,
      pendingWithdrawals: pendingWithdrawalsCount,
      supportMessages: supportMessagesCount,
      totalUsers: totalUsersCount
    },
    config: PLATFORM_CONFIG,
    users,
    deposits: depositHistory,
    withdrawals: withdrawalHistory,
    trades: activeServerTrades,
    assets: ASSETS,
    serverTime: Date.now()
  });
});

// ইউজার অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন (Active / Suspended / Banned)
app.post('/api/admin/user-status', (req, res) => {
  const { userId, status } = req.body;
  if (users[userId]) {
    users[userId].accountStatus = status;
    return res.json({ success: true, message: `User ID ${userId} status updated to: ${status}!` });
  }
  res.json({ success: false, message: "User not found!" });
});

// অ্যাডমিন থেকে সরাসরি ব্যালেন্স যোগ বা বিয়োগ
app.post('/api/admin/adjust-balance', (req, res) => {
  const { userId, amount, actionType } = req.body;
  let u = users[userId];
  if (!u) return res.json({ success: false, message: "User not found!" });
  let val = parseFloat(amount) || 0;
  if (actionType === 'add') u.liveBalance += val;
  else u.liveBalance = Math.max(0, u.liveBalance - val);
  res.json({ success: true, message: `Balance updated: $${u.liveBalance.toFixed(2)}` });
});

// গ্লোবাল নোটিশ ব্যানার আপডেট
app.post('/api/admin/update-announcement', (req, res) => {
  const { noticeText } = req.body;
  if (noticeText) {
    PLATFORM_CONFIG.announcementNotice = noticeText.trim();
    notifications.unshift({ id: Date.now(), title: "Official Announcement", body: PLATFORM_CONFIG.announcementNotice, time: new Date().toLocaleTimeString() });
    return res.json({ success: true, message: "Global Announcement Banner updated successfully!" });
  }
  res.json({ success: false, message: "Notice text is required!" });
});

app.post('/api/admin/action-deposit', (req, res) => {
  const { id, action } = req.body;
  let dep = depositHistory.find(d => d.id === id);
  if (dep) {
    dep.status = action === 'approve' ? 'Approved' : 'Rejected';
    if (action === 'approve') {
      let u = users[dep.userId];
      if (u) u.liveBalance += dep.amount;
    }
    return res.json({ success: true, message: `Deposit marked as ${dep.status}!` });
  }
  res.json({ success: false, message: "Deposit not found!" });
});

app.post('/api/admin/action-withdraw', (req, res) => {
  const { id, action } = req.body;
  let w = withdrawalHistory.find(item => item.id === id);
  if (w) {
    w.status = action === 'approve' ? 'Approved' : 'Rejected';
    if (action === 'reject') {
      let u = users[w.userId];
      if (u) u.liveBalance += w.amount;
    }
    return res.json({ success: true, message: `Withdrawal marked as ${w.status}!` });
  }
  res.json({ success: false, message: "Withdrawal not found!" });
});

app.post('/api/admin/action-kyc', (req, res) => {
  const { userId, action } = req.body;
  let u = users[userId];
  if (u) {
    u.verificationStatus = action === 'approve' ? 'Verified' : 'Unverified';
    if (action === 'reject') {
      u.nidFront = "";
      u.nidBack = "";
    }
    return res.json({ success: true, message: `KYC for ${userId} is now ${u.verificationStatus}!` });
  }
  res.json({ success: false, message: "User not found!" });
});

app.post('/api/admin/config-update', (req, res) => {
  const { dollarRate, telegramLink, bkashNumber, nagadNumber } = req.body;
  if (dollarRate) PLATFORM_CONFIG.dollarRate = parseFloat(dollarRate);
  if (telegramLink) PLATFORM_CONFIG.telegramLink = telegramLink;
  if (bkashNumber) PLATFORM_CONFIG.bkashNumber = bkashNumber;
  if (nagadNumber) PLATFORM_CONFIG.nagadNumber = nagadNumber;
  res.json({ success: true, message: "Settings saved!", config: PLATFORM_CONFIG });
});

app.post('/api/admin/set-trend', (req, res) => {
  const { asset, direction, minutes } = req.body;
  if (ASSETS[asset]) {
    ASSETS[asset].trend = direction || 'NORMAL';
    ASSETS[asset].trendUntil = Date.now() + ((parseInt(minutes) || 5) * 60 * 1000);
    return res.json({ success: true, message: `${ASSETS[asset].name} smooth trend set to ${direction} for ${minutes}m.` });
  }
  res.json({ success: false, message: "Asset not found!" });
});

app.get('/api/history', (req, res) => {
  let asset = (req.query.asset || 'EUR_USD').replace('/', '_');
  res.json({ success: true, history: candleHistories[asset] || candleHistories['EUR_USD'], meta: ASSETS[asset] || ASSETS['EUR_USD'] });
});
app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));
app.get('/api/payments/all', (req, res) => res.json({ deposits: depositHistory, withdrawals: withdrawalHistory }));
app.get('/api/trades/lifetime', (req, res) => res.json({ trades: lifetimeTrades }));
app.get('/api/notifications', (req, res) => res.json({ notifications, announcement: PLATFORM_CONFIG.announcementNotice }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Master Engine running on port ${PORT}`));
