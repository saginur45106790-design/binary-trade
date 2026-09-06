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

// বিস্তারিত ইউজার প্রোফাইল ডাটাবেস
let users = {
  "85857047": {
    id: "85857047",
    username: "demo_user",
    name: "MD Sajib Hossain",
    email: "teachsajib@gmail.com",
    phone: "+8801700000000",
    liveBalance: 10.00,
    demoBalance: 11070.12,
    group: "VIP",
    status: "Active",
    registeredAt: "10/01/2026"
  },
  "85857048": {
    id: "85857048",
    username: "user_85857048",
    name: "Rahim Ahmed",
    email: "trader_rahim@gmail.com",
    phone: "+8801811111111",
    liveBalance: 25.50,
    demoBalance: 10000.00,
    group: "Standard",
    status: "Active",
    registeredAt: "15/02/2026"
  },
  "85857049": {
    id: "85857049",
    username: "user_85857049",
    name: "Karim Uddin",
    email: "karim_fx@gmail.com",
    phone: "+8801922222222",
    liveBalance: 50.00,
    demoBalance: 10000.00,
    group: "Premium",
    status: "Active",
    registeredAt: "20/03/2026"
  },
  "85857050": {
    id: "85857050",
    username: "user_85857050",
    name: "Tanvir Hasan",
    email: "tanvir_trade@gmail.com",
    phone: "+8801633333333",
    liveBalance: 5.00,
    demoBalance: 10000.00,
    group: "New Traders",
    status: "Active",
    registeredAt: "01/08/2026"
  }
};

let userGroups = ["Standard", "VIP", "Premium", "New Traders"];

function getUser(identifier) {
  if (users[identifier]) return users[identifier];
  for (let k in users) {
    if (users[k].username === identifier || users[k].id === identifier || users[k].email === identifier) {
      return users[k];
    }
  }
  return users["85857047"];
}

let ASSETS = {
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68520.50, basePrice: 68520.50, decimals: 2, payout: 92, vol: 2.2 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, payout: 90, vol: 0.5 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 177.50, basePrice: 177.50, decimals: 2, payout: 88, vol: 0.10 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, payout: 88, vol: 0.18 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, basePrice: 0.6250, decimals: 4, payout: 85, vol: 0.0003 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, basePrice: 0.1425, decimals: 4, payout: 82, vol: 0.00015 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, basePrice: 5.850, decimals: 3, payout: 86, vol: 0.003 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, basePrice: 0.4850, decimals: 4, payout: 84, vol: 0.0003 }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

function init24HourMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  currentCandleMinute = Math.floor(nowSec / 60) * 60;

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;

    for (let i = 1440; i > 0; i--) {
      let t = currentCandleMinute - (i * 60);
      let drift = -(cur - meta.basePrice) * 0.001;
      let delta = (Math.random() - 0.5) * (meta.vol * 0.35) + drift;
      let o = cur;
      let c = parseFloat((o + delta).toFixed(meta.decimals));
      let h = parseFloat((Math.max(o, c) + Math.random() * (meta.vol * 0.15)).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * (meta.vol * 0.15)).toFixed(meta.decimals));
      list.push({ time: t, open: o, high: h, low: l, close: c });
      cur = c;
    }

    meta.price = cur;
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
init24HourMarket();

setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let drift = -(meta.price - meta.basePrice) * 0.0008;
    let delta = (Math.random() - 0.5) * (meta.vol * 0.25) + drift;
    meta.price = parseFloat((meta.price + delta).toFixed(meta.decimals));

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

  let tickPayload = { type: 'TICK', countdown: remainingSec, serverTime: now, assets: {} };
  for (let key in ASSETS) {
    tickPayload.assets[key] = {
      price: ASSETS[key].price.toFixed(ASSETS[key].decimals),
      candle: candleHistories[key][candleHistories[key].length - 1],
      payout: ASSETS[key].payout
    };
  }

  let broadcastData = JSON.stringify(tickPayload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(broadcastData);
  });
}, 1000);

let lifetimeTrades = [
  { id: "TR-90214", username: "demo_user", asset: "BTC/USD (OTC)", direction: "UP", amount: 1.00, entryPrice: "68520.50", exitPrice: "68524.20", profit: 1.92, isWin: true, time: "24/08/2026, 21:14:02", accountType: "live" }
];

let depositHistory = [
  { id: "128385243", username: "demo_user", date: "24/08/2026, 20:39:08", status: "Approved", amount: 10.00, method: "Bkash", trxId: "TRX9921", type: "Deposit" }
];

let transactions = [
  { id: "128385243", username: "demo_user", type: "Withdraw", method: "Bkash (P2C)", amount: 10.00, status: "Approved", date: "24.08.2026", details: "017XXXXXXXX" }
];

let supportTickets = [];
let tournamentsList = [
  { id: "tour_01", title: "Weekend Battle", status: "ACTIVE NOW", prizePool: "5000 $", entryFee: "1 $", duration: "2 days" }
];

app.get('/api/history/:asset', (req, res) => {
  let asset = req.params.asset || 'BTC';
  if (candleHistories[asset]) {
    res.json({ success: true, history: candleHistories[asset], meta: ASSETS[asset] });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/trade', (req, res) => {
  const { username, amount, direction, accountType, durationSec, asset } = req.body;
  let user = getUser(username);
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
  let user = getUser(username);
  let selectedAsset = ASSETS[asset] || ASSETS['BTC'];
  let tradeAmount = Number(amount) || 1;

  let isWin = false;
  if (direction === 'UP') isWin = (Number(exitPrice) > Number(entryPrice));
  else if (direction === 'DOWN') isWin = (Number(exitPrice) < Number(entryPrice));

  let profit = isWin ? parseFloat((tradeAmount * (1 + selectedAsset.payout / 100)).toFixed(2)) : 0;
  if (isWin) {
    if (accountType === 'live') user.liveBalance += profit;
    else user.demoBalance += profit;
  }

  let newTradeRecord = {
    id: "TR-" + Math.floor(10000 + Math.random() * 90000),
    username: user.username,
    asset: `${asset}/USD (OTC)`,
    direction,
    amount: tradeAmount,
    entryPrice: String(entryPrice),
    exitPrice: String(exitPrice),
    profit,
    isWin,
    time: new Date().toLocaleString(),
    accountType: accountType || "demo"
  };
  lifetimeTrades.unshift(newTradeRecord);

  res.json({
    success: true,
    isWin,
    profit,
    balance: (accountType === 'live' ? user.liveBalance : user.demoBalance).toFixed(2)
  });
});

app.post('/api/switch-account', (req, res) => {
  const { username, type } = req.body;
  let user = getUser(username);
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/reset-demo', (req, res) => {
  let user = users["85857047"];
  user.demoBalance = 11070.12;
  res.json({ success: true, balance: user.demoBalance.toFixed(2) });
});

app.get('/api/user/info', (req, res) => {
  let user = users["85857047"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance });
});

app.get('/api/tournaments', (req, res) => res.json({ success: true, tournaments: tournamentsList }));
app.get('/api/support/tickets', (req, res) => res.json({ success: true, tickets: supportTickets }));
app.get('/api/user/trades', (req, res) => res.json({ success: true, trades: lifetimeTrades }));
app.get('/api/payments', (req, res) => res.json({ success: true, deposits: depositHistory, withdrawals: transactions }));

// -------------------------------------------------------------
// অ্যাডমিন ড্যাশবোর্ড ও ইউজার ডিরেক্টরি API
// -------------------------------------------------------------
app.get(['/admin', '/admin-secret-panel'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/overview', (req, res) => {
  let totalUsers = Object.keys(users).length;
  let totalDeposits = depositHistory.filter(d => d.status === 'Approved').reduce((s, d) => s + Number(d.amount), 0);
  let totalWithdrawals = transactions.filter(t => t.status === 'Approved').reduce((s, t) => s + Number(t.amount), 0);
  let pendingDeposits = depositHistory.filter(d => d.status === 'Pending').length;
  let pendingWithdrawals = transactions.filter(t => t.status === 'Pending').length;

  res.json({
    totalUsers,
    totalDeposits,
    totalWithdrawals,
    pendingDeposits,
    pendingWithdrawals,
    users,
    groups: userGroups,
    deposits: depositHistory,
    withdrawals: transactions,
    trades: lifetimeTrades,
    assets: ASSETS
  });
});

// গ্রুপ অ্যাসাইনমেন্ট (একক বা একাধিক ইউজার আইডি)
app.post('/api/admin/assign-group', (req, res) => {
  const { userIds, groupName } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.json({ success: false, message: "কমপক্ষে একটি ইউজার আইডি নির্বাচন করুন!" });
  }

  let updatedCount = 0;
  userIds.forEach(id => {
    let cleanId = String(id).trim();
    if (users[cleanId]) {
      users[cleanId].group = groupName || "Standard";
      updatedCount++;
    }
  });

  res.json({
    success: true,
    message: `${updatedCount} জন ব্যবহারকারীকে সফলভাবে '${groupName}' গ্রুপে যুক্ত করা হয়েছে।`
  });
});

// নতুন গ্রুপ তৈরি
app.post('/api/admin/create-group', (req, res) => {
  const { name } = req.body;
  let cleanName = String(name).trim();
  if (!cleanName) return res.json({ success: false, message: "গ্রুপের নাম প্রদান করুন!" });

  if (!userGroups.includes(cleanName)) {
    userGroups.push(cleanName);
    return res.json({ success: true, message: `নতুন গ্রুপ '${cleanName}' তৈরি হয়েছে।`, groups: userGroups });
  }
  res.json({ success: false, message: "এই নামে ইতিমধ্যে গ্রুপ রয়েছে!" });
});

// ইউজার ব্যালেন্স ক্রেডিট/ডেবিট
app.post('/api/admin/adjust-balance', (req, res) => {
  const { userId, amount, type } = req.body;
  let user = users[userId];
  if (!user) return res.json({ success: false, message: "ব্যবহারকারী পাওয়া যায়নি!" });

  let delta = parseFloat(amount);
  if (isNaN(delta) || delta <= 0) return res.json({ success: false, message: "সঠিক পরিমাণ লিখুন।" });

  if (type === 'add') {
    user.liveBalance = parseFloat((user.liveBalance + delta).toFixed(2));
  } else if (type === 'deduct') {
    if (user.liveBalance < delta) return res.json({ success: false, message: "ব্যালেন্সের চেয়ে বেশি ডেবিট করা যাবে না!" });
    user.liveBalance = parseFloat((user.liveBalance - delta).toFixed(2));
  }

  res.json({ success: true, message: `ব্যালেন্স সফলভাবে আপডেট হয়েছে। বর্তমান ব্যালেন্স: $${user.liveBalance.toFixed(2)}` });
});

// ইউজার স্ট্যাটাস পরিবর্তন (Active / Blocked)
app.post('/api/admin/toggle-user-status', (req, res) => {
  const { userId, status } = req.body;
  if (users[userId]) {
    users[userId].status = status || "Active";
    return res.json({ success: true, message: `ইউজার ID ${userId} এখন ${status}।` });
  }
  res.json({ success: false, message: "ব্যবহারকারী খুঁজে পাওয়া যায়নি।" });
});

// পেআউট আপডেট
app.post('/api/admin/update-payout', (req, res) => {
  const { asset, payout } = req.body;
  if (ASSETS[asset]) {
    let p = parseInt(payout);
    if (p >= 10 && p <= 98) {
      ASSETS[asset].payout = p;
      return res.json({ success: true, message: `${asset} পেআউট ${p}% এ সেট করা হয়েছে।` });
    }
  }
  res.json({ success: false, message: "সঠিক পেআউট মান প্রদান করুন (১০-৯৮%)।" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine running on port ${PORT}`));
