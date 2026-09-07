const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// গ্লোবাল কনফিগারেশন
let PLATFORM_CONFIG = {
  dollarRate: 125.00,
  telegramLink: "https://t.me/yourchannel",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  usdtBrc20: "0x71C...BEP20_USDT_ADDR",
  usdtTrc20: "TX9...TRC20_USDT_ADDR",
  btcBep20: "0x89A...BEP20_BTC_ADDR",
  btcNetwork: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
};

// ইউজার ডাটাবেস
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
    nidFront: "",
    nidBack: "",
    registeredAt: "2026-09-01"
  }
};

// ১০টি সম্পূর্ণ স্বতন্ত্র OTC অ্যাসেট (প্রত্যেকটির আলাদা প্রাইস, ভোলাটিলিটি ও ট্রেন্ড)
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
  { id: 1, title: "Welcome to Platform", body: "Deposit now and get up to 50% extra bonus with instant withdrawal capability!", time: "Just now" }
];

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

// ২৪ ঘণ্টার ১,৪৪০টি ক্যান্ডেল পৃথক পজিশনে তৈরি
function init24HourMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;

  let seedMultipliers = { 'EUR_USD': 1.1, 'GBP_JPY': 0.8, 'GBP_USD': 1.3, 'EUR_AUD': 0.9, 'ETH': 1.5, 'SOL': 1.2, 'BNB': 0.7, 'BTC': 1.4, 'SILVER': 0.6, 'GOLD': 1.0 };

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;
    let seed = seedMultipliers[key] || 1.0;

    for (let i = 1440; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let drift = -(cur - meta.basePrice) * 0.001;
      let delta = (Math.sin(i * seed) * 0.5 + (Math.random() - 0.495)) * meta.vol * 0.65 + drift;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));

      let upperWick = Math.random() * meta.vol * 0.25;
      let lowerWick = Math.random() * meta.vol * 0.25;
      let h = parseFloat((Math.max(o, c) + upperWick + 0.005 * meta.vol).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - lowerWick - 0.005 * meta.vol).toFixed(meta.decimals));

      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
    list.push({ time: currentCandleMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
    candleHistories[key] = list;
  }
}
init24HourMarket();

// প্রতি সেকেন্ডের ক্যান্ডেল আপডেট ইঞ্জিন (কোনো জাম্প নেই, মসৃণ সিঁড়ি মুভমেন্ট)
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

  // ট্রেড অটো-সেটেলমেন্ট
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

      // বোনাস টার্নওভার কাউন্টিং
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

  // লাইভ ব্রডকাস্ট
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

// অথেন্টিকেশন API
app.post('/api/auth/register', (req, res) => {
  const { email, password, phone } = req.body;
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
    nidFront: "",
    nidBack: "",
    registeredAt: new Date().toISOString().split('T')[0]
  };
  res.json({ success: true, userId: newId, user: users[newId] });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  for (let id in users) {
    if ((users[id].email === email || users[id].id === email) && users[id].password === password) {
      return res.json({ success: true, userId: id, user: users[id] });
    }
  }
  res.json({ success: false, message: "Invalid credentials!" });
});

// প্রোফাইল ও কেওয়াইসি সাবমিশন
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
  res.json({ success: true, message: "Profile updated successfully!", user: u });
});

app.post('/api/user/submit-nid', (req, res) => {
  const { id, nidFront, nidBack } = req.body;
  let u = users[id] || users["85857047"];
  u.nidFront = nidFront || "";
  u.nidBack = nidBack || "";
  u.verificationStatus = "Pending";
  res.json({ success: true, message: "Documents submitted for verification!" });
});

// ট্রেডিং ও বোনাস টাস্ক (ডাবল টার্নওভার লজিক)
app.post('/api/bonus/claim', (req, res) => {
  const { userId, targetTrade, freeAmount } = req.body;
  let u = users[userId] || users["85857047"];
  let free = parseFloat(freeAmount);
  u.bonusBalance += free;
  u.liveBalance += free;
  u.hasActiveBonus = true;
  u.requiredTurnover += (free * 2.0); // ডাবল টার্নওভার শর্ত
  res.json({ success: true, message: `Congratulations! $${free} bonus added. 2X Turnover ($${u.requiredTurnover}) activated.` });
});

app.post('/api/trade', (req, res) => {
  const { userId, amount, direction, accountType, durationSec, asset } = req.body;
  let u = users[userId] || users["85857047"];
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

// ডিপোজিট ও উইথড্রয়াল API
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, method, amount, trxId, screenshot, currency, network } = req.body;
  let dep = {
    id: "DEP-" + Date.now(),
    userId: userId || "85857047",
    method: method || "bKash",
    currency: currency || "BDT",
    network: network || "Default",
    amount: parseFloat(amount),
    trxId: trxId || "TRX-MANUAL",
    screenshot: screenshot || "",
    status: "Pending",
    date: new Date().toLocaleString()
  };
  depositHistory.unshift(dep);
  res.json({ success: true, message: "Deposit request submitted! Awaiting approval." });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, method, amount, accountDetails, network } = req.body;
  let u = users[userId] || users["85857047"];
  let amt = parseFloat(amount);

  // বোনাস টার্নওভার ভ্যালিডেশন
  if (u.hasActiveBonus && u.currentTurnover < u.requiredTurnover) {
    let rem = (u.requiredTurnover - u.currentTurnover).toFixed(2);
    return res.json({
      success: false,
      turnoverBlocked: true,
      message: `Withdrawal Blocked! Complete your 2X Turnover. Remaining: $${rem}`
    });
  }

  if (u.liveBalance < amt) return res.json({ success: false, message: "Insufficient live balance!" });

  u.liveBalance -= amt;
  let w = {
    id: "WIT-" + Date.now(),
    userId: u.id,
    method,
    network: network || "Direct",
    amount: amt,
    accountDetails,
    status: "Pending",
    date: new Date().toLocaleString()
  };
  withdrawalHistory.unshift(w);
  res.json({ success: true, message: "Withdrawal request placed!", balance: u.liveBalance.toFixed(2) });
});

// লাইভ সাপোর্ট মেসেঞ্জার (২৪ ঘণ্টা হিস্ট্রি)
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

// অ্যাডমিন কন্ট্রোল রাউটস
app.get('/api/admin/overview', (req, res) => {
  res.json({
    config: PLATFORM_CONFIG,
    users,
    deposits: depositHistory,
    withdrawals: withdrawalHistory,
    trades: activeServerTrades,
    notifications,
    assets: ASSETS,
    serverTime: Date.now()
  });
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
    return res.json({ success: true, message: `Deposit ${dep.status}!` });
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
      if (u) u.liveBalance += w.amount; // ব্যালেন্স রিফান্ড
    }
    return res.json({ success: true, message: `Withdrawal ${w.status}!` });
  }
  res.json({ success: false, message: "Withdrawal not found!" });
});

app.post('/api/admin/action-kyc', (req, res) => {
  const { userId, action } = req.body;
  let u = users[userId];
  if (u) {
    u.verificationStatus = action === 'approve' ? 'Verified' : 'Unverified';
    return res.json({ success: true, message: `User KYC ${u.verificationStatus}!` });
  }
  res.json({ success: false, message: "User not found!" });
});

app.post('/api/admin/config-update', (req, res) => {
  const { dollarRate, telegramLink, bkashNumber, nagadNumber } = req.body;
  if (dollarRate) PLATFORM_CONFIG.dollarRate = parseFloat(dollarRate);
  if (telegramLink) PLATFORM_CONFIG.telegramLink = telegramLink;
  if (bkashNumber) PLATFORM_CONFIG.bkashNumber = bkashNumber;
  if (nagadNumber) PLATFORM_CONFIG.nagadNumber = nagadNumber;
  res.json({ success: true, message: "Platform settings updated!", config: PLATFORM_CONFIG });
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

app.post('/api/admin/send-notification', (req, res) => {
  const { title, body } = req.body;
  notifications.unshift({ id: Date.now(), title, body, time: new Date().toLocaleTimeString() });
  res.json({ success: true, message: "Notification broadcasted!" });
});

app.get(['/admin', '/admin-secret-panel'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get(['/api/history', '/api/history/:asset*'], (req, res) => {
  let asset = (req.params.asset || req.query.asset || 'EUR_USD').replace('/', '_');
  res.json({ success: true, history: candleHistories[asset] || candleHistories['EUR_USD'], meta: ASSETS[asset] || ASSETS['EUR_USD'] });
});
app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));
app.get('/api/payments/all', (req, res) => res.json({ deposits: depositHistory, withdrawals: withdrawalHistory }));
app.get('/api/trades/lifetime', (req, res) => res.json({ trades: lifetimeTrades }));
app.get('/api/notifications', (req, res) => res.json({ notifications }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Super Platform Engine listening on port ${PORT}`));
