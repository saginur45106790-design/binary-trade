const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false }));

// ১০০% নিশ্চিত রুট (Cannot GET / সমস্যা চিরতরে দূর করার জন্য)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tredlo Pro Trading Terminal</title>
        <style>
            body { background: #070c14; color: #fff; font-family: sans-serif; text-align: center; padding: 50px; }
            .card { background: #0f1726; border: 1px solid #1c2b42; border-radius: 12px; padding: 40px; display: inline-block; max-width: 500px; margin-top: 50px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h1 { color: #00b074; margin-bottom: 10px; }
            p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
            .btn { display: inline-block; background: #00b074; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            .btn-admin { background: #2563eb; margin-left: 10px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🚀 Tredlo Engine is Live!</h1>
            <p>আপনার ট্রেডিং প্ল্যাটফর্ম এবং WebSocket ইঞ্জিন সফলভাবে রেন্ডার সার্ভারে রান করছে।</p>
            <a href="/admin" class="btn btn-admin">অ্যাডমিন প্যানেল (Admin Panel)</a>
        </div>
    </body>
    </html>
  `);
});

let PLATFORM_CONFIG = {
  dollarRate: 125.00,
  telegramLink: "https://t.me/tredlo_official",
  bkashNumber: "01700000000",
  nagadNumber: "01800000000",
  announcementNotice: "📢 স্বাগতম Tredlo V12.0 এ! প্রথম ডিপোজিটে +৭০% বোনাস উপভোগ করুন।"
};

let users = {
  "85857047": {
    id: "85857047",
    name: "MD Sajib Hossain",
    email: "teachsajib@gmail.com",
    liveBalance: 10.00,
    demoBalance: 11068.77,
    bonusBalance: 0.00,
    requiredTurnover: 0.00,
    currentTurnover: 0.00,
    hasActiveBonus: false
  }
};

let ASSETS = {
  'EUR_USD': { name: 'EUR/USD (OTC)', price: 1.08540, basePrice: 1.08540, decimals: 5, vol: 0.00030, payout1m: 92, payout5m: 85, change24h: -1.27 },
  'BTC':     { name: 'Bitcoin (OTC)', price: 68525.50, basePrice: 68525.50, decimals: 2, vol: 4.80, payout1m: 85, payout5m: 82, change24h: 1.29 },
  'GOLD':    { name: 'Gold (OTC)', price: 2350.40, basePrice: 2350.40, decimals: 2, vol: 0.80, payout1m: 92, payout5m: 79, change24h: 0.03 }
};

let activeServerTrades = [];
let lifetimeTrades = [];
let depositHistory = [];
let withdrawalHistory = [];
let chatMessages = [];
let candleHistories = {};

function initMarket() {
  let nowSec = Math.floor(Date.now() / 1000);
  let currentCandleMinute = Math.floor(nowSec / 60) * 60;
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let list = [];
    let cur = meta.price;
    for (let i = 100; i > 0; i--) {
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

setInterval(() => {
  let now = Date.now();
  let sec = Math.floor(now / 1000);
  for (let key in ASSETS) {
    let meta = ASSETS[key];
    let tickNoise = (Math.random() - 0.495) * (meta.vol * 0.04);
    meta.price = parseFloat((meta.price + tickNoise).toFixed(meta.decimals));
  }
}, 1000);

app.get('/api/assets', (req, res) => res.json({ success: true, assets: ASSETS }));
app.get('/api/history', (req, res) => res.json({ success: true, history: candleHistories[req.query.asset || 'EUR_USD'] }));

app.get(['/admin', '/admin-secret-panel'], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Admin Dashboard - Tredlo</title></head>
    <body style="background:#070c14; color:#fff; font-family:sans-serif; padding:30px;">
        <h1>👑 Tredlo Admin Control Panel</h1>
        <p>System Status: Active & Secured</p>
        <a href="/" style="color:#00b074;">← Back to Home</a>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Unified Trading Engine running on port ${PORT}`));
