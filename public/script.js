const canvas = document.getElementById('tradeCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let raw5sBars = [];
let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let isGuestDemo = false; // পয়েন্ট ৪: গেস্ট মোড ফ্ল্যাগ

let currentUser = {
  id: "85857047",
  name: "MD Sajib Hossain",
  displayName: "Sajib Trader",
  email: "teachsajib@gmail.com",
  phone: "01700000000",
  liveBalance: 10.00,
  demoBalance: 11068.77,
  verificationStatus: "Unverified"
};

let activeAssetKey = 'EUR_USD';
let activeDecimals = 5;
let currentPayout = 92;
let panOffset = 0;
let remainingCountdown = 60;

let renderLivePrice = 1.08540;
let targetLivePrice = 1.08540;
let candleWidth = 13;
let candleSpacing = 5;
let initialPinchDistance = null;
let allAssets = {};

function showToast(msg) {
  let t = document.getElementById('toastMessage');
  if (t) {
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2800);
  }
}

function copyToClipboard(elemId) {
  let el = document.getElementById(elemId);
  if (el) {
    navigator.clipboard.writeText(el.innerText.trim());
    showToast("Copied to clipboard!");
  }
}

// পয়েন্ট ৪: গেস্ট ডেমো প্রটেকশন ফাংশন
function openSheetProtected(id) {
  if (isGuestDemo) {
    let lockModal = document.getElementById('guestLockModal');
    let lockMsg = document.getElementById('guestLockMsgText');
    if (lockModal) {
      if (lockMsg) lockMsg.innerText = "Please create an account or log in to access this feature!";
      lockModal.style.display = 'flex';
      return;
    }
  }
  openSheet(id);
}

function openSheet(id) {
  closeAllSheets();
  let el = document.getElementById(id);
  if (el) el.style.display = 'flex';
  if (id === 'activeTradesSheet') updateActiveTradesDrawerLive();
}

function closeSheet(id) {
  let el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function closeAllSheets() {
  document.querySelectorAll('.modal-overlay-sheet').forEach(m => m.style.display = 'none');
}

// পয়েন্ট ১ ও ২: লগইন ও রেজিস্ট্রেশন হ্যান্ডলার
function openAuthModal(tab) {
  let authModal = document.getElementById('authModal');
  if (authModal) authModal.style.display = 'flex';
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  let boxLog = document.getElementById('authBoxLogin');
  let boxReg = document.getElementById('authBoxReg');
  let title = document.getElementById('authHeaderTitle');
  if (tab === 'reg') {
    if (boxLog) boxLog.style.display = 'none';
    if (boxReg) boxReg.style.display = 'block';
    if (title) title.innerText = "Create Account";
  } else {
    if (boxReg) boxReg.style.display = 'none';
    if (boxLog) boxLog.style.display = 'block';
    if (title) title.innerText = "Welcome Back";
  }
}

function submitLogin() {
  let email = document.getElementById('authLogEmail').value.trim();
  let pass = document.getElementById('authLogPass').value;
  if (!email || !pass) return alert("Enter email and password!");

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      currentUser = d.user;
      isGuestDemo = false;
      localStorage.setItem('auth_user_id', d.userId);
      showToast("Login Successful!");
      closeSheet('authModal');
      closeSheet('landingModal');
      updateBalanceUI();
    } else {
      alert(d.message);
    }
  });
}

function submitRegister() {
  let name = document.getElementById('authRegName').value.trim();
  let email = document.getElementById('authRegEmail').value.trim();
  let phone = document.getElementById('authRegPhone').value.trim();
  let pass = document.getElementById('authRegPass').value;
  let confirmPass = document.getElementById('authRegConfirmPass').value;
  let isEighteen = document.getElementById('authRegAgeCheck').checked;

  if (!name || !email || !phone || !pass || !confirmPass) return alert("Please fill all required fields!");
  if (pass !== confirmPass) return alert("Passwords do not match!");
  if (!isEighteen) return alert("You must agree to the 18+ age condition!");

  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, password: pass, confirmPassword: confirmPass, isEighteen })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      currentUser = d.user;
      isGuestDemo = false;
      localStorage.setItem('auth_user_id', d.userId);
      showToast("Account Created Successfully!");
      closeSheet('authModal');
      closeSheet('landingModal');
      updateBalanceUI();
    } else {
      alert(d.message);
    }
  });
}

// পয়েন্ট ৩: এক্সপ্লোর ডেমো অ্যাক্টিভেশন
function enterQuickDemo() {
  isGuestDemo = true;
  closeSheet('landingModal');
  selectAccountType('demo');
  showToast("Demo Terminal Activated ($11,068.77)");
}

function selectAccountType(type) {
  currentAccount = type;
  let modeTxt = document.getElementById('accountModeText');
  let radioLive = document.getElementById('radioLiveAcc');
  let radioDemo = document.getElementById('radioDemoAcc');
  if (type === 'live') {
    if (modeTxt) { modeTxt.innerText = "REAL"; modeTxt.style.color = "var(--accent-green)"; }
    if (radioLive) radioLive.checked = true;
    if (radioDemo) radioDemo.checked = false;
  } else {
    if (modeTxt) { modeTxt.innerText = "DEMO"; modeTxt.style.color = "var(--accent-gold)"; }
    if (radioLive) radioLive.checked = false;
    if (radioDemo) radioDemo.checked = true;
  }
  updateBalanceUI();
  closeSheet('accountSwitcherModal');
}

function updateBalanceUI() {
  let bal = currentAccount === 'live' ? currentUser.liveBalance : currentUser.demoBalance;
  let balTxt = document.getElementById('accountBalanceText');
  if (balTxt) balTxt.innerText = '$' + bal.toFixed(2);
  let switchReal = document.getElementById('switchRealBal');
  let switchDemo = document.getElementById('switchDemoBal');
  if (switchReal) switchReal.innerText = '$' + currentUser.liveBalance.toFixed(2);
  if (switchDemo) switchDemo.innerText = '$' + currentUser.demoBalance.toFixed(2);
}

function handleUserLogout() {
  localStorage.removeItem('auth_user_id');
  location.reload();
}

// পয়েন্ট ৪: বিভিন্ন ওটিসি কারেন্সি সিলেক্ট করে ট্রেড নেওয়ার সুবিধা
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

function renderOtcList(filterQuery = '') {
  let box = document.getElementById('otcAssetsList');
  if (!box) return;
  let html = '';
  for (let k in allAssets) {
    let item = allAssets[k];
    if (filterQuery && !item.name.toLowerCase().includes(filterQuery.toLowerCase())) continue;
    html += `
      <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="selectAsset('${k}')">
        <div>
          <b>${item.name}</b>
          <small style="color:var(--text-muted); display:block;">1 MIN CANDLE</small>
        </div>
        <b style="color:var(--accent-gold); font-size:14px;">${item.payout1m}%</b>
      </div>
    `;
  }
  box.innerHTML = html;
}

function filterAssetsList() {
  renderOtcList(document.getElementById('assetSearchQuery')?.value || '');
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
  closeSheet('assetSheet');
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

function updatePayoutCalc() {
  let amt = parseFloat(document.getElementById('investAmountInput').value) || 1;
  let total = (amt * (1 + currentPayout / 100)).toFixed(2);
  let pTxt = document.getElementById('payoutCalcText');
  if (pTxt) pTxt.innerText = total + ' $';
}

// পয়েন্ট ৯: ট্রেড প্লেসমেন্ট ও ডটেড মার্কার
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
      let badge = document.getElementById('activeTradesCountBadge');
      if (badge) badge.innerText = activeTrades.length;
    } else {
      alert(d.message);
    }
  });
}

function updateActiveTradesDrawerLive() {
  let container = document.getElementById('activeTradesContainer');
  let badge = document.getElementById('activeTradesCountBadge');
  if (badge) badge.innerText = activeTrades.length;
  if (!container) return;

  if (activeTrades.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:30px; color:var(--text-muted);">No active deals running right now.</p>';
    return;
  }

  let nowSec = Math.floor(Date.now() / 1000);
  let html = '';
  activeTrades.forEach(tr => {
    let diffSec = Math.max(0, tr.expireTime - nowSec);
    html += `
      <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center;">
        <div><b>${tr.asset} (${tr.direction})</b><small style="display:block; color:var(--text-muted);">Invest: $${tr.amount} | Expire in: ${diffSec}s</small></div>
        <span class="sig-badge-${tr.direction.toLowerCase()}">${tr.direction}</span>
      </div>
    `;
  });
  container.innerHTML = html;
}

// পয়েন্ট ৮: কটেক্স টাচ পিঞ্চ জুম ও প্যানিং
let startX = 0;
let isPanning = false;

if (canvas) {
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isPanning = false;
      initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    } else if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      let currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      let factor = currentDist / initialPinchDistance;
      if (factor > 1.04 && candleWidth < 28) { candleWidth = Math.min(28, candleWidth + 0.35); candleSpacing = Math.min(11, candleSpacing + 0.15); }
      else if (factor < 0.96 && candleWidth > 6) { candleWidth = Math.max(6, candleWidth - 0.35); candleSpacing = Math.max(2, candleSpacing - 0.15); }
      initialPinchDistance = currentDist;
    } else if (e.touches.length === 1 && isPanning) {
      panOffset += (e.touches[0].clientX - startX) * 0.95;
      startX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => { isPanning = false; initialPinchDistance = null; });
}

function resetPan() { panOffset = 0; }

// পয়েন্ট ৬: ছবি ১১০১-এর লাল '1' চিহ্নিত সমস্ত ভিজ্যুয়াল সহ চার্ট রেন্ডারার
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
  let baseRightX = w - 85 + panOffset;
  let N = candles.length;

  function getX(i) { return baseRightX - ((N - 1 - i) * totalUnit); }

  let visible = [];
  for (let i = 0; i < N; i++) {
    let x = getX(i);
    if (x >= -40 && x <= w + 40) visible.push({ ...candles[i], index: i, x });
  }
  if (visible.length === 0) visible = candles.slice(-25).map((c, i) => ({ ...c, index: N - 25 + i, x: getX(N - 25 + i) }));

  let prices = visible.flatMap(v => [v.high, v.low]);
  let minP = Math.min(...prices) - 0.0003;
  let maxP = Math.max(...prices) + 0.0003;
  let range = (maxP - minP) || 0.0001;

  function getY(p) { return h - 35 - ((p - minP) / range) * (h - 70); }

  // সূক্ষ্ম অনুভূমিক গ্রিড লাইন ও ডানপাশের ৫ ডিজিট প্রাইস স্কেল (1101.jpg)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillStyle = '#64748b';
  ctx.font = '10px -apple-system, sans-serif';
  for (let i = 1; i <= 6; i++) {
    let y = (h / 7) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - 60, y); ctx.stroke();
    let pVal = maxP - ((y - 35) / (h - 70)) * range;
    ctx.fillText(pVal.toFixed(activeDecimals), w - 54, y + 3);
  }

  // নিচের টাইম স্কেল গ্রিড (1101.jpg - 19:20, 19:36, 19:52)
  for (let i = 0; i < visible.length; i += 8) {
    let c = visible[i];
    let d = new Date(c.time * 1000);
    let timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    ctx.fillText(timeStr, c.x - 10, h - 10);
  }

  // পয়েন্ট ৬.১: "Beginning of trade" উলম্ব সাদা ড্যাশড লাইন
  let lastCandleX = visible[visible.length - 1].x + candleWidth / 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(lastCandleX, 20);
  ctx.lineTo(lastCandleX, h - 25);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText("Beginning of trade", lastCandleX - 50, 24);

  // পয়েন্ট ৬.১: "End of trade" উলম্ব এক্সপায়ারি লাইন ও 01:20
  let endX = lastCandleX + (totalUnit * 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(endX, 20);
  ctx.lineTo(endX, h - 25);
  ctx.stroke();
  ctx.fillText("End of trade", endX + 6, 24);
  ctx.fillText("01:20", endX + 6, 36);
  ctx.setLineDash([]);

  // কটেক্স ক্যান্ডেলস্টিক বডি ও উইক
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

  // পয়েন্ট ৬.৩: সুইং লো প্রাইস ট্যাগ ব্যাজ (1101.jpg - 1.35475)
  let lowestCandle = visible.reduce((min, c) => c.low < min.low ? c : min, visible[0]);
  let lowestY = getY(lowestCandle.low);
  ctx.fillStyle = 'rgba(20, 28, 45, 0.85)';
  ctx.fillRect(lowestCandle.x - 18, lowestY + 6, 50, 16);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(lowestCandle.low.toFixed(activeDecimals), lowestCandle.x - 14, lowestY + 18);

  // পয়েন্ট ৬.২: লাইভ প্রাইস অনুভূমিক সাদা ড্যাশড লাইন
  let liveY = getY(last.close);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath(); ctx.moveTo(0, liveY); ctx.lineTo(w - 60, liveY); ctx.stroke();
  ctx.setLineDash([]);

  // পয়েন্ট ৬.২: ডার্ক কাউন্টডাউন পিল বক্স (00:21)
  let cdStr = `00:${String(remainingCountdown).padStart(2, '0')}`;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(lastCandleX + 8, liveY - 9, 36, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(cdStr, lastCandleX + 11, liveY + 3);

  // পয়েন্ট ৬.২: ডানপাশের উজ্জ্বল নীল লাইভ প্রাইস ট্যাগ (1.35484)
  ctx.fillStyle = '#0070f3';
  ctx.fillRect(w - 60, liveY - 10, 58, 20);
  ctx.fillStyle = '#fff';
  ctx.fillText(last.close.toFixed(activeDecimals), w - 56, liveY + 4);

  // পয়েন্ট ৯: ট্রেড এন্ট্রি ডটেড লাইন ও অ্যারো মার্কার (▲ / ▼)
  activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
    let entryY = getY(tr.entryPrice);
    let isUp = tr.direction === 'UP';
    let tCol = isUp ? '#00e676' : '#eb5757';

    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = tCol;
    ctx.beginPath();
    ctx.moveTo(0, entryY);
    ctx.lineTo(w - 60, entryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // এন্ট্রি অ্যারো মার্কার
    ctx.fillStyle = tCol;
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(lastCandleX, entryY - 14);
      ctx.lineTo(lastCandleX - 5, entryY - 5);
      ctx.lineTo(lastCandleX + 5, entryY - 5);
    } else {
      ctx.moveTo(lastCandleX, entryY + 14);
      ctx.lineTo(lastCandleX - 5, entryY + 5);
      ctx.lineTo(lastCandleX + 5, entryY + 5);
    }
    ctx.fill();
  });
}

// ঘড়ি ও কাউন্টডাউন
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

  updateActiveTradesDrawerLive();
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

// WebSocket
function initWS() {
  let ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
  setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'PING' })); }, 20000);

  ws.onmessage = (e) => {
    let msg = JSON.parse(e.data);
    if (msg.type === 'TICK') {
      if (msg.assets && msg.assets[activeAssetKey]) {
        targetLivePrice = parseFloat(msg.assets[activeAssetKey].price);
      }
    } else if (msg.type === 'BALANCE_UPDATE') {
      if (msg.userId === currentUser.id) {
        currentUser.liveBalance = parseFloat(msg.liveBalance);
        currentUser.demoBalance = parseFloat(msg.demoBalance);
        updateBalanceUI();
      }
    } else if (msg.type === 'TRADE_SETTLED') {
      let r = msg.result;
      activeTrades = activeTrades.filter(t => t.id !== r.tradeId);
      updateActiveTradesDrawerLive();
      if (r.isWin) {
        let winModal = document.getElementById('winResultModal');
        let pAmt = document.getElementById('winProfitAmount');
        if (winModal && pAmt) {
          pAmt.innerText = `+$${r.profit.toFixed(2)}`;
          winModal.style.display = 'flex';
        }
      } else {
        showToast("Trade Closed: Loss");
      }
      if (currentAccount === 'live') currentUser.liveBalance = parseFloat(r.balance);
      else currentUser.demoBalance = parseFloat(r.balance);
      updateBalanceUI();
    }
  };

  ws.onclose = () => setTimeout(initWS, 1500);
}

fitCanvas();
loadAssets();
fullSync();
initWS();
requestAnimationFrame(render);
