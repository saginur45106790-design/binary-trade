const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {
  "demo_user": { liveBalance: 10.00, demoBalance: 11072.87, activeAccount: "demo", control: "normal" }
};

// স্ক্রিনশট ৮৬৫ অনুযায়ী লাইফটাইম ডিপোজিট রেকর্ড
let depositHistory = [
  { id: "128385243", date: "24/08/2026, 20:39:08", status: "Failed", amount: 10.00, method: "Bkash (P2C)", type: "Deposit" },
  { id: "126022410", date: "31/07/2026, 14:34:41", status: "Successed", amount: 13.00, method: "Binance Pay", type: "Deposit" },
  { id: "125912179", date: "30/07/2026, 10:34:34", status: "Successed", amount: 13.00, method: "Binance Pay", type: "Deposit" },
  { id: "125784776", date: "28/07/2026, 22:55:44", status: "Successed", amount: 13.00, method: "Binance Pay", type: "Deposit" },
  { id: "125665239", date: "27/07/2026, 18:57:28", status: "Successed", amount: 13.00, method: "Binance Pay", type: "Deposit" }
];

let transactions = [
  { id: "128385243", username: "demo_user", type: "Withdraw", method: "Bkash (P2C)", amount: 10.00, status: "Failed", date: "24.08.2026", details: "017XXXXXXXX" },
  { id: "126022410", username: "demo_user", type: "Withdraw", method: "Binance Pay", amount: 13.00, status: "Successed", date: "31.07.2026", details: "85857047" },
  { id: "125912179", username: "demo_user", type: "Withdraw", method: "Binance Pay", amount: 13.00, status: "Successed", date: "30.07.2026", details: "85857047" }
];

let ASSETS = {
  'BTC':  { name: 'Bitcoin', ticker: 'BTC', price: 68520.50, basePrice: 68520.50, decimals: 2, payout: 92, vol: 2.5 },
  'ETH':  { name: 'Ethereum', ticker: 'ETH', price: 3422.00, basePrice: 3422.00, decimals: 2, payout: 90, vol: 0.6 },
  'SOL':  { name: 'Solana', ticker: 'SOL', price: 177.50, basePrice: 177.50, decimals: 2, payout: 88, vol: 0.12 },
  'BNB':  { name: 'BNB', ticker: 'BNB', price: 591.20, basePrice: 591.20, decimals: 2, payout: 88, vol: 0.20 },
  'XRP':  { name: 'XRP', ticker: 'XRP', price: 0.6250, basePrice: 0.6250, decimals: 4, payout: 85, vol: 0.0004 },
  'DOGE': { name: 'Dogecoin', ticker: 'DOGE', price: 0.1425, basePrice: 0.1425, decimals: 4, payout: 82, vol: 0.0002 },
  'TON':  { name: 'Toncoin', ticker: 'TON', price: 5.850, basePrice: 5.850, decimals: 3, payout: 86, vol: 0.004 },
  'ADA':  { name: 'Cardano', ticker: 'ADA', price: 0.4850, basePrice: 0.4850, decimals: 4, payout: 84, vol: 0.0004 }
};

let candleHistories = {};
let currentCandleMinute = Math.floor(Date.now() / 60000) * 60;

function initMarketHistory() {
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;

    for (let i = 0; i < 800; i++) {
      let t = currentCandleMinute - (i * 60);
      let delta = (Math.random() - 0.5) * meta.vol * 1.5 - (cur - meta.basePrice) * 0.004;
      let prevClose = parseFloat((cur - delta).toFixed(meta.decimals));
      let o = prevClose;
      let c = cur;
      let h = parseFloat((Math.max(o, c) + Math.random() * meta.vol * 0.8).toFixed(meta.decimals));
      let l = parseFloat((Math.min(o, c) - Math.random() * meta.vol * 0.8).toFixed(meta.decimals));

      list.unshift({ time: t, open: o, high: h, low: l, close: c });
      cur = prevClose;
    }

    list[list.length - 1] = {
      time: currentCandleMinute,
      open: meta.price,
      high: meta.price,
      low: meta.price,
      close: meta.price
    };

    candleHistories[key] = list;
  }
}
initMarketHistory();

setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  let nowMinute = Math.floor(sec / 60) * 60;
  let remainingSec = 60 - (sec % 60);

  let isNewMinute = (nowMinute > currentCandleMinute);

  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let drift = -(meta.price - meta.basePrice) * 0.002;
    let delta = (Math.random() - 0.5) * meta.vol * 0.5 + drift;
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
      if (list.length > 1000) list.shift();
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

// লাইফটাইম পেমেন্টস (ডিপোজিট হিস্ট্রি) API
app.get('/api/payments', (req, res) => {
  res.json({ success: true, deposits: depositHistory });
});

app.get('/api/withdrawals', (req, res) => {
  let list = transactions.filter(t => t.type === 'Withdraw');
  res.json({ success: true, withdrawals: list, liveBalance: users["demo_user"].liveBalance });
});

app.post('/api/withdraw', (req, res) => {
  const { username, amount, method, receiveType, accountId, firstName, lastName } = req.body;
  let user = users[username] || users["demo_user"];
  let numAmt = parseFloat(amount);

  if (!numAmt || numAmt < 10) return res.json({ success: false, message: "Minimum withdrawal amount is $10" });
  if (user.liveBalance < numAmt) return res.json({ success: false, message: "Insufficient balance for withdrawal!" });

  user.liveBalance = parseFloat((user.liveBalance - numAmt).toFixed(2));

  let now = new Date();
  let dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;

  let newTx = {
    id: String(Math.floor(100000000 + Math.random() * 900000000)),
    username: username || "demo_user",
    type: "Withdraw",
    method: method || "Binance Pay",
    amount: numAmt,
    status: "Pending",
    date: dateStr,
    details: accountId
  };

  transactions.unshift(newTx);
  res.json({ success: true, message: "Withdrawal request submitted successfully!", newBalance: user.liveBalance });
});

app.post('/api/deposit', (req, res) => {
  const { username, method, amount, trxId, senderNumber } = req.body;
  let now = new Date();
  let day = String(now.getDate()).padStart(2, '0');
  let month = String(now.getMonth() + 1).padStart(2, '0');
  let year = now.getFullYear();
  let timeStr = now.toTimeString().split(' ')[0];
  let formattedDate = `${day}/${month}/${year}, ${timeStr}`;

  let newDep = {
    id: String(Math.floor(100000000 + Math.random() * 900000000)),
    date: formattedDate,
    status: "Pending",
    amount: parseFloat(amount) || 10.00,
    method: method || "Binance Pay",
    type: "Deposit"
  };

  depositHistory.unshift(newDep);
  res.json({ success: true, message: "Deposit request submitted successfully!" });
});

app.get(['/admin', '/admin-secret-panel'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/data', (req, res) => {
  let totalDeposit = depositHistory.filter(t => t.status === 'Successed').reduce((s, t) => s + Number(t.amount), 0);
  res.json({ users, transactions, depositHistory, assets: ASSETS, totalDeposit });
});

app.post('/api/admin/tx-action', (req, res) => {
  const { txId, status } = req.body;
  let d = depositHistory.find(t => t.id == txId);
  if (d) {
    d.status = status;
    if (status === 'Successed') users["demo_user"].liveBalance += Number(d.amount);
    return res.json({ success: true });
  }
  let tx = transactions.find(t => t.id == txId);
  if (tx) {
    tx.status = status;
    if (status === 'Rejected' && tx.type === 'Withdraw') {
      users[tx.username].liveBalance += Number(tx.amount);
    }
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post('/api/admin/update-payout', (req, res) => {
  const { asset, payout } = req.body;
  if (ASSETS[asset]) {
    ASSETS[asset].payout = Number(payout);
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post('/api/admin/action', (req, res) => {
  const { username, action, value } = req.body;
  if (users[username]) {
    if (action === 'control') users[username].control = value;
    res.json({ success: true });
  } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine running on port ${PORT}`));
