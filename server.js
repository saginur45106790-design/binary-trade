const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ limit: '80mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ১. গ্লোবাল প্ল্যাটফর্ম কনফিগারেশন ও গেটওয়ে সেটিংস
let PLATFORM_CONFIG = {
  maintenanceMode: false,
  dollarRate: 125.00,
  telegramLink: "https://t.me/tredlo_official",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  usdtBep20: "0x71C...BEP20_USDT_ADDR",
  usdtTrc20: "TX9...TRC20_USDT_ADDR",
  btcBep20: "0x89A...BEP20_BTC_ADDR",
  btcNetwork: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  announcementNotice: "📢 স্বাগতম Tredlo V12.0 এ! প্রথম ডিপোজিটে +৭০% বোনাস (কুপন: WELCOME70) উপভোগ করুন।"
};

// রিস্ক ম্যানেজমেন্ট সেটিংস
let RISK_CONFIG = {
  maxTradeAmount: 100.00,
  maxAssetExposure: 500.00,
  sentimentRatio: { buyers: 55, sellers: 45 }
};

// ২. ইউজার ডাটাবেস (কেওয়াইসি, টার্নওভার, সিকিউরিটি ও স্ট্যাটাস সহ)
let users = {
  "85857047": {
    id: "85857047",
    username: "teachsajib@gmail.com",
    name: "MD Sajib Hossain",
    displayName: "Sajib Trader",
    email: "teachsajib@gmail.com",
    phone: "01700000000",
    dob: "2005-01-01",
    country: "Bangladesh",
    city: "Rajshahi",
    address: "Akkelpur, Rajshahi",
    zip: "1200",
    password: "password123",
    twoFactorEnabled: false,
    liveBalance: 10.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false,
    traderLevel: "Starter",
    verificationStatus: "Unverified", // Unverified | Pending | Verified
    accountStatus: "Active",          // Active | Suspended | Banned
    nidFront: "",
    nidBack: "",
    registeredAt: "2026-09-08",
    activeSessions: [{ device: "Mobile Chrome / Android 14", ip: "103.145.78.22", time: "Active Now" }],
    notifPrefs: { emailWithdraw: true, emailDeposit: true, pushTrades: true, pushSignals: true }
  }
};

// ৩. ১০টি সম্পূর্ণ স্বতন্ত্র OTC অ্যাসেট (ভিন্ন প্রাইস, ভোলাটিলিটি ও চার্ট গতি)
let ASSETS = {
  'EUR_USD': { name: 'EUR/USD (OTC)', ticker: 'EUR_USD', type: 'currency', price: 1.08540, basePrice: 1.08540, decimals: 5, vol: 0.00030, payout1m: 92, payout5m: 85, change24h: -1.27, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'GBP_JPY': { name: 'GBP/JPY (OTC)', ticker: 'GBP_JPY', type: 'currency', price: 191.450, basePrice: 191.450, decimals: 3, vol: 0.045, payout1m: 88, payout5m: 80, change24h: 0.21, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'GBP_USD': { name: 'GBP/USD (OTC)', ticker: 'GBP_USD', type: 'currency', price: 1.31210, basePrice: 1.31210, decimals: 5, vol: 0.00035, payout1m: 92, payout5m: 83, change24h: 0.00, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'EUR_AUD': { name: 'EUR/AUD (OTC)', ticker: 'EUR_AUD', type: 'currency', price: 1.62480, basePrice: 1.62480, decimals: 5, vol: 0.00040, payout1m: 94, payout5m: 95, change24h: -0.61, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'ETH':     { name: 'Ethereum (OTC)', ticker: 'ETH', type: 'crypto', price: 3422.00, basePrice: 3422.00, decimals: 2, vol: 1.60, payout1m: 81, payout5m: 67, change24h: 4.75, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'SOL':     { name: 'Solana (OTC)', ticker: 'SOL', type: 'crypto', price: 177.50, basePrice: 177.50, decimals: 2, vol: 0.40, payout1m: 81, payout5m: 64, change24h: -10.94, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'BNB':     { name: 'Binance Coin (OTC)', ticker: 'BNB', type: 'crypto', price: 591.20, basePrice: 591.20, decimals: 2, vol: 0.60, payout1m: 89, payout5m: 75, change24h: 2.33, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'BTC':     { name: 'Bitcoin (OTC)', ticker: 'BTC', type: 'crypto', price: 68525.50, basePrice: 68525.50, decimals: 2, vol: 4.80, payout1m: 85, payout5m: 82, change24h: 1.29, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'SILVER':  { name: 'Silver (OTC)', ticker: 'SILVER', type: 'commodity', price: 28.520, basePrice: 28.520, decimals: 3, vol: 0.025, payout1m: 88, payout5m: 77, change24h: 0.11, trend: 'NORMAL', trendUntil: 0, enabled: true },
  'GOLD':    { name: 'Gold (OTC)', ticker: 'GOLD', type: 'commodity', price: 2350.40, basePrice: 2350.40, decimals: 2, vol: 0.80, payout1m: 92, payout5m: 79, change24h: 0.03, trend: 'NORMAL', trendUntil: 0, enabled: true }
};

let activeServerTrades = [];
let lifetimeTrades = [];
let depositHistory = [];
let withdrawalHistory = [];
let chatMessages = [];
let priceAlerts = [];
let notifications = [
  { id: 1, title: "Welcome to Tredlo Terminal", body: PLATFORM_CONFIG.announcementNotice, time: "Just now" }
];

// ৪. লাইভ ট্রেডিং সিগন্যাল ডাটাবেস (ভিডিও পেজ ১৮)
let liveSignals = [
  { id: "SIG-101", asset: "EUR_USD", company: "EUR/USD OTC", logo: "EUR", strategy: "RSI Divergence", direction: "HIGHER", timeframe: "5m", expirySec: 300, strength: "94%" },
  { id: "SIG-102", asset: "BTC", company: "Bitcoin OTC", logo: "BTC", strategy: "AI Trend Follow", direction: "LOWER", timeframe: "15m", expirySec: 900, strength: "89%" },
  { id: "SIG-103", asset: "GOLD", company: "Gold OTC", logo: "XAU", strategy: "MACD Cross", direction: "HIGHER", timeframe: "5m", expirySec: 300, strength: "91%" },
  { id: "SIG-104", asset: "ETH", company: "Ethereum OTC", logo: "ETH", strategy: "Bollinger Bands", direction: "LOWER", timeframe: "30m", expirySec: 1800, strength: "87%" }
];

// ৫. টুর্নামেন্ট হাব ডাটাবেস (ভিডিও পেজ ১৩)
let platformTournaments = [
  { id: "TOUR-1", title: "THE CROWN SERIES", banner: "crown", prizePool: "$5,000", entryFee: "$2", participants: 474, status: "Active", duration: "2 Days Left" },
  { id: "TOUR-2", title: "Telegram Exclusive Battle", banner: "telegram", prizePool: "$2,500", entryFee: "Free", participants: 812, status: "Active", duration: "18 Hours Left" },
  { id: "TOUR-3", title: "Global Championship 2026", banner: "global", prizePool: "$10,000", entryFee: "$10", participants: 240, status: "Upcoming", duration: "Starts in 2 Days" }
];

// ৬. গ্লোবাল লিডারবোর্ড ডাটা (ভিডিও পেজ ১৭)
let globalLeaderboard = [
  { rank: 1, name: "Ayesha Sheikh", country: "🇦🇪", deals: 142, profit: "+$34,850.20" },
  { rank: 2, name: "Nada Al-Khalaf", country: "🇸🇦", deals: 98, profit: "+$29,448.50" },
  { rank: 3, name: "Toxic Trader", country: "🇧🇩", deals: 215, profit: "+$25,900.00" },
  { rank: 4, name: "Paulo Silva", country: "🇧🇷", deals: 87, profit: "+$21,410.00" },
  { rank: 5, name: "Shaima Khan", country: "🇵🇰", deals: 110, profit: "+$18,920.00" }
];

// কুপন কোড ডাটাবেস
let promoCoupons = {
  "WELCOME70": { bonusPct: 70, active: true, description: "+70% First Deposit Bonus" }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// ৭. ২৪ ঘণ্টার ১,৪৪০টি কটেক্স ক্যান্ডেল জেনারেশন
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

// ৮. রিয়েল-টাইম মার্কেট টিক ও মসৃণ ট্রেন্ড ইঞ্জিন
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

    // প্রাইস অ্যালার্ট লিসেনার
    priceAlerts.filter(a => !a.triggered && a.asset === key).forEach(a => {
      if ((a.condition === 'ABOVE' && meta.price >= a.targetPrice) || (a.condition === 'BELOW' && meta.price <= a.targetPrice)) {
        a.triggered = true;
        notifications.unshift({ id: Date.now(), title: `Price Alert: ${meta.name}`, body: `Price reached ${meta.price}`, time: new Date().toLocaleTimeString() });
      }
    });
  }

  if (isNewMinute) currentCandleMinute = nowMinute;

  // ৯. ট্রেড সেটেলমেন্ট ও ২X টার্নওভার ট্র্যাকিং
  for (let i = activeServerTrades.length - 1; i >= 0; i--) {
    let tr = activeServerTrades[i];
    if (sec >= tr.expireTime) {
      let exitP = ASSETS[tr.asset] ? ASSETS[tr.asset].price : tr.entryPrice;
      let isWin = false;
      let isDraw = (exitP === tr.entryPrice);
      let user = users[tr.userId] || users["85857047"];

      if (tr.direction === 'UP') isWin = (exitP > tr.entryPrice);
      else if (tr.direction === 'DOWN') isWin = (exitP < tr.entryPrice);

      let payoutRate = ASSETS[tr.asset] ? (tr.durationSec >= 300 ? ASSETS[tr.asset].payout5m : ASSETS[tr.asset].payout1m) : 92;
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
        profit: isWin ? profit : (isDraw ? 0 : -tr.amount),
        isWin,
        isDraw,
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
          isDraw,
          profit: resRecord.profit,
          balance: (tr.accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
        }
      });
      wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(settleMsg); });
    }
  }

  // লাইভ ব্রডকাস্ট পে-লোড
  let tickPayload = {
    type: 'TICK',
    countdown: remainingSec,
    serverTime: now,
    sentiment: RISK_CONFIG.sentimentRatio,
    assets: {}
  };
  for (let k in ASSETS) {
    if (ASSETS[k].enabled) {
      tickPayload.assets[k] = {
        price: ASSETS[k].price.toFixed(ASSETS[k].decimals),
        candle: candleHistories[k][candleHistories[k].length - 1],
        payout1m: ASSETS[k].payout1m,
        payout5m: ASSETS[k].payout5m,
        change24h: ASSETS[k].change24h
      };
    }
  }
  let payloadStr = JSON.stringify(tickPayload);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payloadStr); });
}, 1000);

// ১০. অথেন্টিকেশন এপিআই (লগইন ও রেজিস্ট্রেশন)
app.post('/api/auth/register', (req, res) => {
  const { email, password, phone } = req.body;
  if (!email || !password) return res.json({ success: false, message: "Email and password required!" });

  for (let id in users) {
    if (users[id].email.toLowerCase() === email.toLowerCase()) {
      return res.json({ success: false, message: "An account with this email already exists!" });
    }
  }

  let newId = String(Math.floor(10000000 + Math.random() * 90000000));
  users[newId] = {
    id: newId,
    username: email,
    name: email.split('@')[0],
    displayName: email.split('@')[0],
    email,
    phone: phone || "01700000000",
    dob: "2000-01-01",
    country: "Bangladesh",
    city: "Dhaka",
    address: "Bangladesh",
    zip: "1000",
    password,
    twoFactorEnabled: false,
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
    nidBack: "",
    registeredAt: new Date().toISOString().split('T')[0],
    activeSessions: [{ device: "Mobile Browser", ip: "103.145.78.1", time: "Just now" }],
    notifPrefs: { emailWithdraw: true, emailDeposit: true, pushTrades: true, pushSignals: true }
  };
  res.json({ success: true, userId: newId, user: users[newId] });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  for (let id in users) {
    let u = users[id];
    if ((u.email.toLowerCase() === (email || "").toLowerCase() || u.id === email) && u.password === password) {
      if (u.accountStatus === 'Banned') return res.json({ success: false, message: "Your account has been permanently BANNED by Admin!" });
      if (u.accountStatus === 'Suspended') return res.json({ success: false, message: "Your account is temporarily SUSPENDED by Admin!" });
      return res.json({ success: true, userId: id, user: u });
    }
  }
  res.json({ success: false, message: "Invalid credentials provided!" });
});

// ১১. প্রোফাইল, কেওয়াইসি ও অ্যাকাউন্ট সিকিউরিটি
app.get('/api/user/:id', (req, res) => {
  let u = users[req.params.id] || users["85857047"];
  res.json({ success: true, user: u });
});

app.post('/api/user/update', (req, res) => {
  const { id, name, displayName, email, phone, dob, country, city, address, zip } = req.body;
  let u = users[id] || users["85857047"];
  if (name) u.name = name;
  if (displayName) u.displayName = displayName;
  if (email) u.email = email;
  if (phone) u.phone = phone;
  if (dob) u.dob = dob;
  if (country) u.country = country;
  if (city) u.city = city;
  if (address) u.address = address;
  if (zip) u.zip = zip;
  res.json({ success: true, message: "Personal Information Saved Successfully!", user: u });
});

app.post('/api/user/submit-nid', (req, res) => {
  const { id, nidFront, nidBack } = req.body;
  let u = users[id] || users["85857047"];
  if (!nidFront || !nidBack) return res.json({ success: false, message: "Upload both sides of your National ID!" });
  u.nidFront = nidFront;
  u.nidBack = nidBack;
  u.verificationStatus = "Pending";
  res.json({ success: true, message: "NID submitted! Verification Status: Pending." });
});

app.post('/api/user/change-password', (req, res) => {
  const { id, currentPassword, newPassword } = req.body;
  let u = users[id] || users["85857047"];
  if (u.password !== currentPassword) return res.json({ success: false, message: "Current password does not match!" });
  u.password = newPassword;
  res.json({ success: true, message: "Password updated successfully!" });
});

app.post('/api/user/statement', (req, res) => {
  let userId = req.body.userId || "85857047";
  let myTrades = lifetimeTrades.filter(t => t.userId === userId);
  let myDeposits = depositHistory.filter(d => d.userId === userId);
  res.json({ success: true, trades: myTrades, deposits: myDeposits, generatedAt: new Date().toLocaleString() });
});

// ১২. ট্রেডিং ও অর্ডার এক্সিকিউশন
app.post('/api/trade', (req, res) => {
  const { userId, amount, direction, accountType, durationSec, asset } = req.body;
  let u = users[userId] || users["85857047"];
  if (u.accountStatus !== 'Active') return res.json({ success: false, message: `Account is currently ${u.accountStatus}!` });

  let tradeAmount = parseFloat(amount) || 1;
  if (tradeAmount > RISK_CONFIG.maxTradeAmount) return res.json({ success: false, message: `Maximum trade amount is $${RISK_CONFIG.maxTradeAmount}!` });

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

// ১৩. ডিপোজিট ও উইথড্রয়াল প্রসেসিং
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, method, amount, trxId, screenshot, promoCode } = req.body;
  let amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0 || !trxId) return res.json({ success: false, message: "Valid amount & Transaction ID required!" });

  let promoBonus = 0;
  if (promoCode && promoCoupons[promoCode]) {
    promoBonus = (amt * promoCoupons[promoCode].bonusPct) / 100;
  }

  let dep = {
    id: "DEP-" + Date.now(),
    userId: userId || "85857047",
    method: method || "Binance",
    amount: amt,
    bonusAmount: promoBonus,
    trxId: trxId.trim(),
    screenshot: screenshot || "",
    status: "Pending",
    date: new Date().toLocaleString()
  };
  depositHistory.unshift(dep);
  res.json({ success: true, message: "Deposit submitted! Status is Pending Approval." });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, method, amount, accountDetails, network } = req.body;
  let u = users[userId] || users["85857047"];
  let amt = parseFloat(amount);

  if (isNaN(amt) || amt <= 0 || !accountDetails) return res.json({ success: false, message: "Valid amount and account details required!" });

  if (u.hasActiveBonus && u.currentTurnover < u.requiredTurnover) {
    let rem = (u.requiredTurnover - u.currentTurnover).toFixed(2);
    return res.json({ success: false, turnoverBlocked: true, message: `Withdrawal restricted! Complete your 2X turnover requirement. Remaining: $${rem}` });
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
  res.json({ success: true, message: "Withdrawal request placed!", balance: u.liveBalance.toFixed(2) });
});

// ১৪. সিগন্যালস ও অ্যালার্টস এপিআই
app.get('/api/signals/list', (req, res) => res.json({ success: true, signals: liveSignals }));
app.post('/api/alerts/create', (req, res) => {
  const { asset, targetPrice, condition } = req.body;
  priceAlerts.push({ id: Date.now(), asset, targetPrice: parseFloat(targetPrice), condition: condition || 'ABOVE', triggered: false });
  res.json({ success: true, message: "Price alert created successfully!" });
});
app.get('/api/alerts/list', (req, res) => res.json({ success: true, alerts: priceAlerts }));

// ১৫. টুর্নামেন্টস ও লিডারবোর্ড এপিআই
app.get('/api/tournaments/list', (req, res) => res.json({ success: true, tournaments: platformTournaments }));
app.post('/api/tournaments/join', (req, res) => {
  const { tournamentId, userId } = req.body;
  let tour = platformTournaments.find(t => t.id === tournamentId);
  if (tour) {
    tour.participants++;
    return res.json({ success: true, message: `You have successfully joined ${tour.title}!` });
  }
  res.json({ success: false, message: "Tournament not found!" });
});
app.get('/api/leaderboard', (req, res) => res.json({ success: true, leaderboard: globalLeaderboard }));

// ১৬. রিওয়ার্ডস, কুপন ও বোনাস টাস্ক
app.post('/api/rewards/redeem', (req, res) => {
  const { userId, code } = req.body;
  if (promoCoupons[code] && promoCoupons[code].active) {
    let u = users[userId] || users["85857047"];
    return res.json({ success: true, message: `Promo code ${code} activated! +${promoCoupons[code].bonusPct}% Bonus will apply on your next deposit.` });
  }
  res.json({ success: false, message: "Invalid or expired promo code!" });
});

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

// ১৭. লাইভ সাপোর্ট মেসেঞ্জার (২৪ ঘণ্টার মেমোরি)
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

// ১৮. অ্যানালিটিক্স ও ট্রেডিং স্ট্যাটস
app.get('/api/analytics/:userId', (req, res) => {
  let userId = req.params.userId || "85857047";
  let myTrades = lifetimeTrades.filter(t => t.userId === userId);
  let total = myTrades.length;
  let wins = myTrades.filter(t => t.isWin).length;
  let netProfit = myTrades.reduce((sum, t) => sum + t.profit, 0);
  let winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  res.json({
    success: true,
    stats: {
      totalTrades: total,
      netProfit: netProfit.toFixed(2),
      winRate: `${winRate}%`,
      bestStreak: 4,
      tradesProfit: wins,
      minTradeAmount: 1,
      maxTradeAmount: 100
    }
  });
});

// -------------------------------------------------------------
// ১৯. অ্যাডমিন মাস্টার ড্যাশবোর্ড API (১২টি মডিউল ও ৭২টি অপশন)
// -------------------------------------------------------------
app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/admin/overview', (req, res) => {
  let pendingKycCount = 0;
  for (let id in users) { if (users[id].verificationStatus === 'Pending') pendingKycCount++; }

  let totalVol = lifetimeTrades.reduce((s, t) => s + Number(t.amount), 0);
  let totalDep = depositHistory.filter(d => d.status === 'Approved').reduce((s, d) => s + Number(d.amount), 0);
  let totalWith = withdrawalHistory.filter(w => w.status === 'Approved').reduce((s, w) => s + Number(w.amount), 0);

  res.json({
    success: true,
    counts: {
      pendingKyc: pendingKycCount,
      pendingDeposits: depositHistory.filter(d => d.status === 'Pending').length,
      pendingWithdrawals: withdrawalHistory.filter(w => w.status === 'Pending').length,
      supportMessages: chatMessages.filter(m => m.sender === 'User').length,
      totalUsers: Object.keys(users).length,
      totalVolume: totalVol.toFixed(2),
      totalDepositsVolume: totalDep.toFixed(2),
      totalWithdrawalsVolume: totalWith.toFixed(2)
    },
    config: PLATFORM_CONFIG,
    users,
    deposits: depositHistory,
    withdrawals: withdrawalHistory,
    trades: activeServerTrades,
    assets: ASSETS,
    signals: liveSignals,
    tournaments: platformTournaments,
    serverTime: Date.now()
  });
});

// ইউজার অ্যাকাউন্ট ব্যান/সাসপেন্ড ও ব্যালেন্স অ্যাডজাস্টমেন্ট
app.post('/api/admin/user-status', (req, res) => {
  const { userId, status } = req.body;
  if (users[userId]) {
    users[userId].accountStatus = status;
    return res.json({ success: true, message: `User ID ${userId} status updated to: ${status}!` });
  }
  res.json({ success: false, message: "User not found!" });
});

app.post('/api/admin/adjust-balance', (req, res) => {
  const { userId, amount, actionType } = req.body;
  let u = users[userId];
  if (!u) return res.json({ success: false, message: "User not found!" });
  let val = parseFloat(amount) || 0;
  if (actionType === 'add') u.liveBalance += val;
  else u.liveBalance = Math.max(0, u.liveBalance - val);
  res.json({ success: true, message: `User balance updated: $${u.liveBalance.toFixed(2)}` });
});

// গ্লোবাল নোটিশ ব্যানার আপডেট
app.post('/api/admin/update-announcement', (req, res) => {
  const { noticeText } = req.body;
  if (noticeText) {
    PLATFORM_CONFIG.announcementNotice = noticeText.trim();
    notifications.unshift({ id: Date.now(), title: "Official Announcement", body: PLATFORM_CONFIG.announcementNotice, time: new Date().toLocaleTimeString() });
    return res.json({ success: true, message: "Global Notice updated successfully!" });
  }
  res.json({ success: false, message: "Text required!" });
});

// গেটওয়ে, ডিপোজিট, উইথড্র ও কেওয়াইসি অ্যাকশন
app.post('/api/admin/action-deposit', (req, res) => {
  const { id, action } = req.body;
  let dep = depositHistory.find(d => d.id === id);
  if (dep) {
    dep.status = action === 'approve' ? 'Approved' : 'Rejected';
    if (action === 'approve') {
      let u = users[dep.userId];
      if (u) u.liveBalance += (dep.amount + (dep.bonusAmount || 0));
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
    if (action === 'reject') { u.nidFront = ""; u.nidBack = ""; }
    return res.json({ success: true, message: `KYC for ${userId} is now ${u.verificationStatus}!` });
  }
  res.json({ success: false, message: "User not found!" });
});

// সিগন্যাল তৈরি ও ডিলিট
app.post('/api/admin/signals/create', (req, res) => {
  const { asset, strategy, direction, timeframe } = req.body;
  let sig = {
    id: "SIG-" + Date.now(),
    asset: asset || "EUR_USD",
    company: ASSETS[asset] ? ASSETS[asset].name : asset,
    logo: asset,
    strategy: strategy || "AI Algorithm",
    direction: direction || "HIGHER",
    timeframe: timeframe || "5m",
    expirySec: 300,
    strength: "92%"
  };
  liveSignals.unshift(sig);
  res.json({ success: true, message: "Signal created successfully!", signal: sig });
});

app.post('/api/admin/signals/delete', (req, res) => {
  const { signalId } = req.body;
  liveSignals = liveSignals.filter(s => s.id !== signalId);
  res.json({ success: true, message: "Signal removed!" });
});

// মসৃণ ট্রেন্ড ও পেআউট কনফিগারেশন
app.post('/api/admin/set-trend', (req, res) => {
  const { asset, direction, minutes } = req.body;
  if (ASSETS[asset]) {
    ASSETS[asset].trend = direction || 'NORMAL';
    ASSETS[asset].trendUntil = Date.now() + ((parseInt(minutes) || 5) * 60 * 1000);
    return res.json({ success: true, message: `${ASSETS[asset].name} smooth trend set to ${direction} for ${minutes}m.` });
  }
  res.json({ success: false, message: "Asset not found!" });
});

app.post('/api/admin/set-payout', (req, res) => {
  const { asset, payout1m, payout5m } = req.body;
  if (ASSETS[asset]) {
    if (payout1m) ASSETS[asset].payout1m = parseInt(payout1m);
    if (payout5m) ASSETS[asset].payout5m = parseInt(payout5m);
    return res.json({ success: true, message: `${ASSETS[asset].name} payout updated!` });
  }
  res.json({ success: false, message: "Asset not found!" });
});

app.post('/api/admin/config-update', (req, res) => {
  const { dollarRate, telegramLink, bkashNumber, nagadNumber } = req.body;
  if (dollarRate) PLATFORM_CONFIG.dollarRate = parseFloat(dollarRate);
  if (telegramLink) PLATFORM_CONFIG.telegramLink = telegramLink;
  if (bkashNumber) PLATFORM_CONFIG.bkashNumber = bkashNumber;
  if (nagadNumber) PLATFORM_CONFIG.nagadNumber = nagadNumber;
  res.json({ success: true, message: "Platform configuration saved!", config: PLATFORM_CONFIG });
});

// কমন হিস্ট্রি রুটস
app.get('/api/history', (req, res) => {
  let asset = (req.query.asset || 'EUR_USD').replace('/', '_');
  res.json({ success: true, history: candleHistories[asset] || candleHistories['EUR_USD'], meta: ASSETS[asset] || ASSETS['EUR_USD'] });
});
app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));
app.get('/api/payments/all', (req, res) => res.json({ deposits: depositHistory, withdrawals: withdrawalHistory }));
app.get('/api/trades/lifetime', (req, res) => res.json({ trades: lifetimeTrades }));
app.get('/api/notifications', (req, res) => res.json({ notifications, announcement: PLATFORM_CONFIG.announcementNotice }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Trading Engine running on port ${PORT}`));
