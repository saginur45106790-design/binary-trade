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

// ইউজার ডাটাবেস
let users = {
  "demo_user": { id: "85857047", email: "teachsajib@gmail.com", liveBalance: 10.00, demoBalance: 11070.12, status: "Active" },
  "user_85857048": { id: "85857048", email: "trader_rahim@gmail.com", liveBalance: 25.50, demoBalance: 10000.00, status: "Active" },
  "user_85857049": { id: "85857049", email: "karim_fx@gmail.com", liveBalance: 50.00, demoBalance: 10000.00, status: "Active" }
};

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
    list.push({ time: currentCandleMinute, open: meta.price, high: meta.price, low: meta.price, close: meta.price });
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

let lifetimeTrades = [];
let transactions = [
  { id: "128385243", username: "demo_user", type: "Withdraw", method: "Bkash (P2C)", amount: 10.00, status: "Failed", date: "24.08.2026", details: "017XXXXXXXX" },
  { id: "126022410", username: "demo_user", type: "Withdraw", method: "Binance Pay", amount: 13.00, status: "Approved", date: "31.07.2026", details: "85857047" }
];
let depositHistory = [
  { id: "128385243", username: "demo_user", date: "24/08/2026, 20:39:08", status: "Approved", amount: 10.00, method: "Bkash", trxId: "TRX9921", type: "Deposit" }
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
  let user = users[username] || users["demo_user"];
  let tradeAmount = Number(amount) || 1;
  let targetBal = accountType === 'live' ? user.liveBalance : user.demoBalance;

  if (targetBal < tradeAmount) return res.json({ success: false, message: "অপর্যাপ্ত ব্যালেন্স!" });

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
  if (direction === 'UP') isWin = (Number(exitPrice) > Number(entryPrice));
  else if (direction === 'DOWN') isWin = (Number(exitPrice) < Number(entryPrice));

  let profit = isWin ? parseFloat((tradeAmount * (1 + selectedAsset.payout / 100)).toFixed(2)) : 0;
  if (isWin) {
    if (accountType === 'live') user.liveBalance += profit;
    else user.demoBalance += profit;
  }

  let newTradeRecord = {
    id: "TR-" + Math.floor(10000 + Math.random() * 90000),
    username: username || "demo_user",
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
  let user = users[username] || users["demo_user"];
  res.json({ success: true, activeAccount: type, balance: type === 'live' ? user.liveBalance : user.demoBalance });
});

app.post('/api/reset-demo', (req, res) => {
  let user = users["demo_user"];
  user.demoBalance = 11070.12;
  res.json({ success: true, balance: user.demoBalance.toFixed(2) });
});

app.get('/api/user/info', (req, res) => {
  let user = users["demo_user"];
  res.json({ liveBalance: user.liveBalance, demoBalance: user.demoBalance });
});

app.get('/api/user/trades', (req, res) => res.json({ success: true, trades: lifetimeTrades }));
app.get('/api/payments', (req, res) => res.json({ success: true, deposits: depositHistory, withdrawals: transactions }));

// -------------------------------------------------------------
// অ্যাডমিন প্যানেল এপিআই রুটস
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
    deposits: depositHistory,
    withdrawals: transactions,
    trades: lifetimeTrades,
    assets: ASSETS
  });
});

// অ্যাডমিন: ব্যালেন্স অ্যাড / ক্রেডিট / ডেবিট
app.post('/api/admin/adjust-balance', (req, res) => {
  const { username, amount, type } = req.body;
  let user = users[username];
  if (!user) return res.json({ success: false, message: "ব্যবহারকারী পাওয়া যায়নি!" });

  let delta = parseFloat(amount);
  if (isNaN(delta) || delta <= 0) return res.json({ success: false, message: "সঠিক পরিমাণ প্রদান করুন।" });

  if (type === 'add') {
    user.liveBalance = parseFloat((user.liveBalance + delta).toFixed(2));
  } else if (type === 'deduct') {
    if (user.liveBalance < delta) return res.json({ success: false, message: "ব্যবহারকারীর লাইভ ব্যালেন্স অপর্যাপ্ত!" });
    user.liveBalance = parseFloat((user.liveBalance - delta).toFixed(2));
  }

  res.json({ success: true, message: `ব্যালেন্স সফলভাবে আপডেট হয়েছে। বর্তমান ব্যালেন্স: $${user.liveBalance.toFixed(2)}`, newBalance: user.liveBalance });
});

// অ্যাডমিন: ডিপোজিট অনুমোদন বা বাতিল
app.post('/api/admin/deposit-action', (req, res) => {
  const { id, action } = req.body;
  let dep = depositHistory.find(d => d.id === id);
  if (!dep) return res.json({ success: false, message: "ডিপোজিট রিকোয়েস্ট পাওয়া যায়নি।" });

  if (action === 'approve') {
    dep.status = 'Approved';
    if (users[dep.username]) {
      users[dep.username].liveBalance += parseFloat(dep.amount);
    }
  } else {
    dep.status = 'Rejected';
  }

  res.json({ success: true, message: `ডিপোজিট রিকোয়েস্ট ${action === 'approve' ? 'অনুমোদিত' : 'বাতিল'} হয়েছে।` });
});

// অ্যাডমিন: উইথড্রয়াল অনুমোদন বা বাতিল
app.post('/api/admin/withdraw-action', (req, res) => {
  const { id, action } = req.body;
  let w = transactions.find(t => t.id === id);
  if (!w) return res.json({ success: false, message: "উইথড্রয়াল রিকোয়েস্ট পাওয়া যায়নি।" });

  if (action === 'approve') {
    w.status = 'Approved';
  } else {
    w.status = 'Rejected';
    // বাতিল হলে টাকা ব্যবহারকারীর অ্যাকাউন্টে ফেরত
    if (users[w.username]) {
      users[w.username].liveBalance += parseFloat(w.amount);
    }
  }

  res.json({ success: true, message: `উইথড্রয়াল রিকোয়েস্ট ${action === 'approve' ? 'অনুমোদিত' : 'বাতিল'} হয়েছে।` });
});

// অ্যাডমিন: ক্রিপ্টো পেআউট শতাংশ পরিবর্তন
app.post('/api/admin/update-payout', (req, res) => {
  const { asset, payout } = req.body;
  if (ASSETS[asset]) {
    let p = parseInt(payout);
    if (p >= 10 && p <= 98) {
      ASSETS[asset].payout = p;
      return res.json({ success: true, message: `${asset} এর পেআউট ${p}% এ সেট করা হয়েছে।` });
    }
  }
  res.json({ success: false, message: "সঠিক পেআউট মান প্রদান করুন (১০-৯৮%)।" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Trading Engine & Admin Portal running on port ${PORT}`));
