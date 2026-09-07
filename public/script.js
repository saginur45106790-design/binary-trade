const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let currentUser = { id: "85857047", liveBalance: 10.00, demoBalance: 11068.77, bonusBalance: 0.00 };
let activeAssetKey = 'EUR_USD';
let activeDecimals = 5;
let currentPayout = 77;
let panOffset = 0;
let remainingCountdown = 60;

let renderLivePrice = 1.08540;
let targetLivePrice = 1.08540;
let candleWidth = 13;
let candleSpacing = 5;

let allAssets = {};
let favoriteAssets = JSON.parse(localStorage.getItem('fav_assets') || '["EUR_USD", "BTC", "GOLD"]');

// বহুভাষিক ডিকশনারি
const I18N = {
  en: { deposit: "Deposit", withdraw: "Withdrawal", up: "Up", down: "Down" },
  bn: { deposit: "ডিপোজিট", withdraw: "উইথড্র", up: "আপ", down: "ডাউন" },
  hi: { deposit: "जमा करें", withdraw: "निकासी", up: "ऊपर", down: "नीचे" },
  ur: { deposit: "جمع کروائیں", withdraw: "نکلوائیں", up: "اوپر", down: "نیچے" },
  ar: { deposit: "إيداع", withdraw: "سحب", up: "صعود", down: "هبوط" },
  zh: { deposit: "存款", withdraw: "提款", up: "看涨", down: "看跌" },
  tl: { deposit: "Magdeposito", withdraw: "Mag-withdraw", up: "Itaas", down: "Ibaba" }
};

// টোস্ট বার্তা
function showToast(msg) {
  let t = document.getElementById('toastMessage');
  t.innerText = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function copyToClipboard(elemId) {
  let txt = document.getElementById(elemId).innerText;
  navigator.clipboard.writeText(txt);
  showToast("Copy Success!");
}

// পেজ রাউটিং
function openViewPage(pageId) {
  document.querySelectorAll('.app-view-page').forEach(p => p.style.display = 'none');
  let el = document.getElementById(pageId);
  if (el) el.style.display = 'flex';
  if (pageId === 'depositPage') loadDepositData();
  if (pageId === 'withdrawPage') loadWithdrawData();
  if (pageId === 'supportChatPage') loadChatHistory();
  if (pageId === 'trophyBonusPage') renderBonusTasks();
  if (pageId === 'notifPage') loadNotifications();
  if (pageId === 'paymentsHistoryPage') loadAllPayments();
  if (pageId === 'tradesHistoryPage') loadAllTrades();
}
function closeViewPage(pageId) {
  let el = document.getElementById(pageId);
  if (el) el.style.display = 'none';
}
function closeAllPages() {
  document.querySelectorAll('.app-view-page').forEach(p => p.style.display = 'none');
}

// ঘড়ি
setInterval(() => {
  let now = new Date();
  let utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  let dhaka = new Date(utc + (3600000 * 6));
  let hh = String(dhaka.getHours()).padStart(2, '0');
  let mm = String(dhaka.getMinutes()).padStart(2, '0');
  let ss = String(dhaka.getSeconds()).padStart(2, '0');
  let clock = document.getElementById('clockUtcLive');
  if (clock) clock.innerText = `${hh}:${mm}:${ss} UTC+6`;
  remainingCountdown = 60 - (Math.floor(now.getTime() / 1000) % 60);
}, 1000);

function fitCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', fitCanvas);

// ১০টি স্বতন্ত্র OTC পেয়ার লোড ও রেন্ডার
function loadAssets() {
  fetch('/api/assets')
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      allAssets = d.assets;
      renderOtcList();
    }
  });
}

function renderOtcList() {
  let box = document.getElementById('otcAssetsList');
  if (!box) return;
  let html = '';
  let keys = Object.keys(allAssets);
  keys.sort((a, b) => favoriteAssets.includes(b) - favoriteAssets.includes(a));

  keys.forEach(k => {
    let item = allAssets[k];
    let isFav = favoriteAssets.includes(k);
    let isPos = item.change24h >= 0;
    html += `
      <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="selectAsset('${k}')">
        <div>
          <span style="color:${isFav ? '#f5a623' : '#64748b'}; font-size:16px; margin-right:6px;" onclick="toggleFavorite(event, '${k}')">★</span>
          <b>${item.name}</b>
          <small style="color:var(--text-muted); display:block;">1m: ${item.payout1m}% | 5m: ${item.payout5m}%</small>
        </div>
        <div style="font-weight:800; color:${isPos ? '#00e676' : '#eb5757'};">
          ${isPos ? '+' : ''}${item.change24h}%
        </div>
      </div>
    `;
  });
  box.innerHTML = html;
}

function toggleFavorite(e, k) {
  e.stopPropagation();
  if (favoriteAssets.includes(k)) favoriteAssets = favoriteAssets.filter(x => x !== k);
  else favoriteAssets.push(k);
  localStorage.setItem('fav_assets', JSON.stringify(favoriteAssets));
  renderOtcList();
}

function selectAsset(k) {
  activeAssetKey = k;
  let meta = allAssets[k];
  if (meta) {
    document.getElementById('activeAssetLabel').innerText = meta.name;
    document.getElementById('activeAssetPayout').innerText = `${meta.payout1m}% ▼`;
    activeDecimals = meta.decimals;
    currentPayout = meta.payout1m;
  }
  closeViewPage('assetSelectPage');
  updatePayoutCalc();
  fullSync();
}

function fullSync() {
  fetch(`/api/history?asset=${activeAssetKey}`)
  .then(r => r.json())
  .then(d => {
    if (d.success && d.history) {
      candles = d.history.map(c => ({ ...c }));
      let last = candles[candles.length - 1];
      targetLivePrice = last.close;
      renderLivePrice = last.close;
    }
  });
}

function switchAccountType() {
  currentAccount = currentAccount === 'demo' ? 'live' : 'demo';
  document.getElementById('accountModeText').innerText = currentAccount.toUpperCase();
  document.getElementById('accountModeText').style.color = currentAccount === 'live' ? 'var(--accent-green)' : 'var(--accent-yellow)';
  updateBalanceUI();
}

function updateBalanceUI() {
  let bal = currentAccount === 'live' ? currentUser.liveBalance : currentUser.demoBalance;
  document.getElementById('accountBalanceText').innerText = '$' + bal.toFixed(2);
}

function updatePayoutCalc() {
  let amt = parseFloat(document.getElementById('investAmountInput').value) || 1;
  let total = (amt * (1 + currentPayout / 100)).toFixed(2);
  document.getElementById('payoutCalcText').innerText = total + ' $';
}

function placeOrder(direction) {
  let amt = parseFloat(document.getElementById('investAmountInput').value) || 1;
  fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.id,
      amount: amt,
      direction,
      accountType: currentAccount,
      durationSec: 60,
      asset: activeAssetKey
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showToast(`Trade placed: ${direction} $${amt}`);
      if (currentAccount === 'live') currentUser.liveBalance = parseFloat(d.balance);
      else currentUser.demoBalance = parseFloat(d.balance);
      updateBalanceUI();
      activeTrades.push(d.trade);
      document.getElementById('activeTradesCountBadge').innerText = activeTrades.length;
    } else {
      alert(d.message);
    }
  });
}

// কটেক্স ক্যান্ডেলস্টিক রেন্ডার
function render() {
  requestAnimationFrame(render);
  if (!canvas || !ctx || candles.length === 0) return;

  const w = parseFloat(canvas.style.width) || canvas.width;
  const h = parseFloat(canvas.style.height) || canvas.height;
  ctx.clearRect(0, 0, w, h);

  renderLivePrice += (targetLivePrice - renderLivePrice) * 0.18;
  let last = candles[candles.length - 1];
  last.close = parseFloat(renderLivePrice.toFixed(activeDecimals));
  last.high = Math.max(last.high, last.close);
  last.low = Math.min(last.low, last.close);

  let totalUnit = candleWidth + candleSpacing;
  let baseRightX = w - 80 + panOffset;
  let N = candles.length;

  function getX(i) { return baseRightX - ((N - 1 - i) * totalUnit); }

  let visible = [];
  for (let i = 0; i < N; i++) {
    let x = getX(i);
    if (x >= -30 && x <= w + 30) visible.push({ ...candles[i], x });
  }
  if (visible.length === 0) visible = candles.slice(-25).map((c, i) => ({ ...c, x: getX(N - 25 + i) }));

  let prices = visible.flatMap(v => [v.high, v.low]);
  let minP = Math.min(...prices) - (allAssets[activeAssetKey]?.vol || 0.0003);
  let maxP = Math.max(...prices) + (allAssets[activeAssetKey]?.vol || 0.0003);
  let range = (maxP - minP) || 0.0001;

  function getY(p) { return h - 30 - ((p - minP) / range) * (h - 60); }

  // গ্রিড ও প্রাইস
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillStyle = '#7a8ba1';
  ctx.font = '10px monospace';
  for (let i = 1; i <= 5; i++) {
    let y = (h / 6) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - 55, y); ctx.stroke();
    let pVal = maxP - ((y - 30) / (h - 60)) * range;
    ctx.fillText(pVal.toFixed(activeDecimals), w - 50, y + 3);
  }

  // কটেক্স সরু ও লম্বা ক্যান্ডেল
  visible.forEach(c => {
    let isBull = c.close >= c.open;
    let col = isBull ? '#0faf59' : '#eb5757';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(c.x + candleWidth / 2, getY(c.high));
    ctx.lineTo(c.x + candleWidth / 2, getY(c.low));
    ctx.stroke();

    ctx.fillStyle = col;
    let topY = Math.min(getY(c.open), getY(c.close));
    let ch = Math.abs(getY(c.close) - getY(c.open)) || 1.5;
    ctx.fillRect(c.x, topY, candleWidth, ch);
  });

  // লাইভ প্রাইস বার
  let liveY = getY(last.close);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath(); ctx.moveTo(0, liveY); ctx.lineTo(w - 55, liveY); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0070f3';
  ctx.fillRect(w - 55, liveY - 9, 54, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(last.close.toFixed(activeDecimals), w - 52, liveY + 3);
}

// বোনাস টাস্ক রেন্ডার (ডাবল টার্নওভার শর্ত সহ)
function renderBonusTasks() {
  let box = document.getElementById('bonusTasksList');
  let tasks = [
    { trade: 10, free: 5 }, { trade: 30, free: 10 }, { trade: 50, free: 20 },
    { trade: 100, free: 30 }, { trade: 200, free: 50 }, { trade: 500, free: 100 },
    { trade: 1000, free: 250 }, { trade: 10000, free: 1000 }, { trade: 100000, free: 10000 }, { trade: 1000000, free: 100000 }
  ];
  let html = '';
  tasks.forEach(t => {
    html += `
      <div class="card-box" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>Trade $${t.trade.toLocaleString()} ➔ Get $${t.free.toLocaleString()} FREE</b>
          <small style="color:var(--text-muted); display:block;">Turnover requirement: 2X ($${(t.free * 2).toLocaleString()})</small>
        </div>
        <button class="btn-block-action" style="width:auto; padding:6px 14px; margin-top:0;" onclick="claimBonusTask(${t.trade}, ${t.free})">Join Now</button>
      </div>
    `;
  });
  box.innerHTML = html;
}

function claimBonusTask(trade, free) {
  fetch('/api/bonus/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, targetTrade: trade, freeAmount: free })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    loadUserData();
  });
}

// ডিপোজিট ও উইথড্র
function loadDepositData() {
  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    document.getElementById('depDollarRateDisplay').innerText = `1 USD = ${d.config.dollarRate.toFixed(2)} BDT`;
  });
}

function submitDepositOrder() {
  let amt = document.getElementById('depAmountInput').value;
  let trx = document.getElementById('depTrxInput').value;
  if (!amt || !trx) return alert("Please enter amount and TrxID!");

  fetch('/api/wallet/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.id,
      method: document.getElementById('depMethodSelect').value,
      amount: amt,
      trxId: trx
    })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    closeViewPage('depositPage');
  });
}

function loadWithdrawData() {
  fetch(`/api/user/${currentUser.id}`).then(r => r.json()).then(d => {
    let u = d.user;
    currentUser = u;
    document.getElementById('wRealBal').innerText = '$' + u.liveBalance.toFixed(2);
    document.getElementById('wBonusBal').innerText = '$' + u.bonusBalance.toFixed(2);
    let warn = document.getElementById('turnoverWarnBox');
    if (u.hasActiveBonus && u.currentTurnover < u.requiredTurnover) {
      warn.style.display = 'block';
      warn.innerText = `⚠️ Turnover Incomplete! Complete $${(u.requiredTurnover - u.currentTurnover).toFixed(2)} more trades to unlock withdrawals.`;
    } else {
      warn.style.display = 'none';
    }
  });
}

function submitWithdrawOrder() {
  let amt = document.getElementById('withAmountInput').value;
  let details = document.getElementById('withAccountDetails').value;
  if (!amt || !details) return alert("Please fill amount and account details!");

  fetch('/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.id,
      method: document.getElementById('withMethodSelect').value,
      amount: amt,
      accountDetails: details
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.turnoverBlocked) {
      alert(d.message);
    } else if (d.success) {
      showToast(d.message);
      closeViewPage('withdrawPage');
      loadUserData();
    } else {
      alert(d.message);
    }
  });
}

// লাইভ সাপোর্ট মেসেঞ্জার
function loadChatHistory() {
  fetch('/api/support/messages').then(r => r.json()).then(d => {
    let box = document.getElementById('chatMessagesContainer');
    let html = '';
    d.messages.forEach(m => {
      let isUser = m.sender === 'User';
      html += `
        <div class="chat-bubble ${isUser ? 'user' : 'admin'}">
          <div>${m.text}</div>
          ${m.image ? `<img src="${m.image}" style="max-width:140px; border-radius:4px; margin-top:4px;">` : ''}
          <small style="font-size:9px; opacity:0.7; display:block; text-align:right;">${m.timeStr}</small>
        </div>
      `;
    });
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  });
}

function sendChatMessage() {
  let txt = document.getElementById('chatTextInput').value.trim();
  if (!txt) return;
  fetch('/api/support/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: 'User', userId: currentUser.id, text: txt })
  })
  .then(() => {
    document.getElementById('chatTextInput').value = '';
    loadChatHistory();
  });
}

function applyThemeMode(mode) {
  document.body.className = mode === 'light' ? 'theme-light' : '';
  localStorage.setItem('app_theme', mode);
}

function applyLanguage(lang) {
  localStorage.setItem('app_lang', lang);
  showToast("Language Updated!");
}

function openPartnerTelegram() {
  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    window.open(d.config.telegramLink, '_blank');
  });
}

function resetPan() { panOffset = 0; }

// ওয়েবসকেট
function initWS() {
  let ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
  ws.onmessage = (e) => {
    let msg = JSON.parse(e.data);
    if (msg.type === 'TICK' && msg.assets[activeAssetKey]) {
      targetLivePrice = parseFloat(msg.assets[activeAssetKey].price);
    } else if (msg.type === 'TRADE_SETTLED') {
      showToast(msg.result.isWin ? `Win! +$${msg.result.profit}` : "Trade Lost");
      loadUserData();
    } else if (msg.type === 'CHAT_MSG') {
      loadChatHistory();
    }
  };
  ws.onclose = () => setTimeout(initWS, 1500);
}

function loadUserData() {
  fetch(`/api/user/${currentUser.id}`).then(r => r.json()).then(d => {
    currentUser = d.user;
    updateBalanceUI();
  });
}

// ইনিশিয়ালাইজেশন
fitCanvas();
loadAssets();
fullSync();
initWS();
loadUserData();
requestAnimationFrame(render);
