const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let currentUser = {
  id: "85857047",
  name: "MD Sajib Hossain",
  email: "teachsajib@gmail.com",
  phone: "01700000000",
  liveBalance: 10.00,
  demoBalance: 11068.77,
  bonusBalance: 0.00,
  requiredTurnover: 0.00,
  currentTurnover: 0.00,
  hasActiveBonus: false,
  verificationStatus: "Unverified"
};

let activeAssetKey = 'EUR_USD';
let activeDecimals = 5;
let currentPayout = 77;
let panOffset = 0;
let remainingCountdown = 60;
let selectedTimerSeconds = 60; // 1 মিনিট ফিক্সড

let renderLivePrice = 1.08540;
let targetLivePrice = 1.08540;
let candleWidth = 12;
let candleSpacing = 5;

let allAssets = {};
let favoriteAssets = JSON.parse(localStorage.getItem('fav_assets') || '["EUR_USD", "BTC", "GOLD"]');
let currentLang = localStorage.getItem('app_lang') || 'en';

// ৭টি ভাষার পূর্ণাঙ্গ অভিধান
const I18N = {
  en: { deposit: "Deposit", withdraw: "Withdrawal", up: "Up", down: "Down", exp: "Expiration", inv: "Investment ($)", pay: "Payout:", history: "History", settings: "Settings", save: "Save Details" },
  bn: { deposit: "ডিপোজিট", withdraw: "উইথড্র", up: "আপ", down: "ডাউন", exp: "মেয়াদ", inv: "ইনভেস্টমেন্ট ($)", pay: "পেআউট:", history: "হিস্টোরি", settings: "সেটিংস", save: "সংরক্ষণ করুন" },
  hi: { deposit: "जमा करें", withdraw: "निकासी", up: "ऊपर", down: "नीचे", exp: "समाप्ति", inv: "निवेश ($)", pay: "भुगतान:", history: "इतिहास", settings: "सेटिंग्स", save: "सहेजें" },
  ur: { deposit: "جمع کروائیں", withdraw: "نکلوائیں", up: "اوپر", down: "نیچے", exp: "میعاد", inv: "سرمایہ کاری ($)", pay: "ادائیگی:", history: "تاریخ", settings: "ترتیبات", save: "محفوظ کریں" },
  ar: { deposit: "إيداع", withdraw: "سحب", up: "صعود", down: "هبوط", exp: "انتهاء الصلاحية", inv: "الاستثمار ($)", pay: "العائد:", history: "السجل", settings: "الإعدادات", save: "حفظ" },
  zh: { deposit: "存款", withdraw: "提款", up: "看涨", down: "看跌", exp: "到期时间", inv: "投资额 ($)", pay: "收益率:", history: "历史", settings: "设置", save: "保存" },
  tl: { deposit: "Magdeposito", withdraw: "Mag-withdraw", up: "Itaas", down: "Ibaba", exp: "Oras ng Pagtatapos", inv: "Puhunan ($)", pay: "Bayad:", history: "Kasaysayan", settings: "Mga Setting", save: "I-save" }
};

// গ্লোবাল নোটিফিকেশন টোস্ট
function showToast(msg) {
  let t = document.getElementById('toastMessage');
  if (t) {
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
  }
}

function copyToClipboard(elemId) {
  let el = document.getElementById(elemId);
  if (el) {
    navigator.clipboard.writeText(el.innerText);
    showToast("Copy Success!");
  }
}

// পেজ ও মোডাল রাউটিং
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
  if (pageId === 'profilePage') refreshProfileUI();
}

function closeViewPage(pageId) {
  let el = document.getElementById(pageId);
  if (el) el.style.display = 'none';
}

function closeAllPages() {
  document.querySelectorAll('.app-view-page').forEach(p => p.style.display = 'none');
}

// অথেন্টিকেশন ও ল্যান্ডিং পেজ কন্ট্রোল
function openAuthModal(tab) {
  let authModal = document.getElementById('authViewPage');
  if (authModal) authModal.style.display = 'flex';
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  let boxLog = document.getElementById('authBoxLogin');
  let boxReg = document.getElementById('authBoxReg');
  let title = document.getElementById('authModalHeaderTitle');
  if (tab === 'reg') {
    if (boxLog) boxLog.style.display = 'none';
    if (boxReg) boxReg.style.display = 'block';
    if (title) title.innerText = "Register Trading Account";
  } else {
    if (boxReg) boxReg.style.display = 'none';
    if (boxLog) boxLog.style.display = 'block';
    if (title) title.innerText = "Sign In to Account";
  }
}

function submitLogin() {
  let email = document.getElementById('authLogEmail').value.trim();
  let pass = document.getElementById('authLogPass').value;
  if (!email || !pass) return alert("Please enter email and password!");

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      currentUser = d.user;
      localStorage.setItem('auth_user_id', d.userId);
      showToast("Login Successful!");
      closeViewPage('authViewPage');
      closeViewPage('landingPage');
      refreshProfileUI();
      updateBalanceUI();
    } else {
      alert(d.message);
    }
  });
}

function submitRegister() {
  let email = document.getElementById('authRegEmail').value.trim();
  let phone = document.getElementById('authRegPhone').value.trim();
  let pass = document.getElementById('authRegPass').value;
  if (!email || !pass) return alert("Please fill required fields!");

  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, password: pass })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      currentUser = d.user;
      localStorage.setItem('auth_user_id', d.userId);
      showToast("Account Created Successfully!");
      closeViewPage('authViewPage');
      closeViewPage('landingPage');
      refreshProfileUI();
      updateBalanceUI();
    } else {
      alert(d.message);
    }
  });
}

function enterQuickDemo() {
  closeViewPage('landingPage');
  currentAccount = 'demo';
  updateBalanceUI();
  showToast("Entered Demo Terminal");
}

function handleUserLogout() {
  localStorage.removeItem('auth_user_id');
  location.reload();
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

// ১০টি সম্পূর্ণ স্বতন্ত্র OTC অ্যাসেট লোডার
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
  let modeTxt = document.getElementById('accountModeText');
  if (modeTxt) {
    modeTxt.innerText = currentAccount.toUpperCase();
    modeTxt.style.color = currentAccount === 'live' ? 'var(--accent-green)' : 'var(--accent-yellow)';
  }
  updateBalanceUI();
}

function updateBalanceUI() {
  let bal = currentAccount === 'live' ? currentUser.liveBalance : currentUser.demoBalance;
  let balTxt = document.getElementById('accountBalanceText');
  if (balTxt) balTxt.innerText = '$' + bal.toFixed(2);
}

function updatePayoutCalc() {
  let amt = parseFloat(document.getElementById('investAmountInput').value) || 1;
  let total = (amt * (1 + currentPayout / 100)).toFixed(2);
  let pTxt = document.getElementById('payoutCalcText');
  if (pTxt) pTxt.innerText = total + ' $';
}

function selectExpirationTime(sec, label) {
  selectedTimerSeconds = sec;
  let d = document.getElementById('dockTimerDisplay');
  if (d) d.innerText = label;
  closeViewPage('timerSelectModal');
}

// ট্রেড প্লেসিং
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
      durationSec: selectedTimerSeconds,
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

// কটেক্স স্টাইল সরু ও লম্বা ক্যান্ডেলস্টিক রেন্ডার (কোনো কাঁপা-কাঁপি নেই)
function render() {
  requestAnimationFrame(render);
  if (!canvas || !ctx || candles.length === 0) return;

  const w = parseFloat(canvas.style.width) || canvas.width;
  const h = parseFloat(canvas.style.height) || canvas.height;
  ctx.clearRect(0, 0, w, h);

  renderLivePrice += (targetLivePrice - renderLivePrice) * 0.16;
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

  // গ্রিড ও প্রাইস স্কেল
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillStyle = '#7a8ba1';
  ctx.font = '10px monospace';
  for (let i = 1; i <= 5; i++) {
    let y = (h / 6) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - 55, y); ctx.stroke();
    let pVal = maxP - ((y - 30) / (h - 60)) * range;
    ctx.fillText(pVal.toFixed(activeDecimals), w - 50, y + 3);
  }

  // সুষম সরু ক্যান্ডেল ও শ্যাডো
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

  // লাইভ প্রাইস ড্যাশ লাইন ও ব্যাজ
  let liveY = getY(last.close);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath(); ctx.moveTo(0, liveY); ctx.lineTo(w - 55, liveY); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0070f3';
  ctx.fillRect(w - 55, liveY - 9, 54, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(last.close.toFixed(activeDecimals), w - 52, liveY + 3);

  // ১ মিনিটের কাউন্টডাউন পিল
  let expX = baseRightX + (candleWidth + candleSpacing);
  let cdStr = `00:${String(remainingCountdown).padStart(2, '0')}`;
  ctx.fillStyle = '#1c2638';
  ctx.fillRect(expX + 6, liveY - 9, 44, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(cdStr, expX + 10, liveY + 3);
}

// প্রোফাইল ও NID সাবমিশন হ্যান্ডলার
function refreshProfileUI() {
  document.getElementById('profNameDisplay').innerText = currentUser.name;
  document.getElementById('profIdDisplay').innerText = "ID: " + currentUser.id;
  document.getElementById('profNameInput').value = currentUser.name;
  document.getElementById('profEmailInput').value = currentUser.email;
  document.getElementById('profPhoneInput').value = currentUser.phone || '';
  document.getElementById('profDobInput').value = currentUser.dob || '';
  document.getElementById('profAddressInput').value = currentUser.address || '';
  document.getElementById('profZipInput').value = currentUser.zip || '';

  let tag = document.getElementById('profVerifyTag');
  let nidSec = document.getElementById('nidSubmitSection');
  tag.className = "verify-tag " + currentUser.verificationStatus.toLowerCase();
  tag.innerText = currentUser.verificationStatus;

  if (currentUser.verificationStatus === 'Verified') {
    nidSec.style.display = 'none'; // অ্যাপ্রুভ হলে অটো হাইড
  } else {
    nidSec.style.display = 'block'; // আনভেরিফাইড হলে পুনরায় দৃশ্যমান
  }

  let mMail = document.getElementById('menuEmail');
  let mId = document.getElementById('menuUserId');
  if (mMail) mMail.innerText = currentUser.email;
  if (mId) mId.innerText = "ID: " + currentUser.id;
}

function saveProfileDetails() {
  fetch('/api/user/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: currentUser.id,
      name: document.getElementById('profNameInput').value,
      email: document.getElementById('profEmailInput').value,
      phone: document.getElementById('profPhoneInput').value,
      dob: document.getElementById('profDobInput').value,
      address: document.getElementById('profAddressInput').value,
      zip: document.getElementById('profZipInput').value
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      currentUser = d.user;
      showToast(d.message);
      refreshProfileUI();
    }
  });
}

function submitNidPhotos() {
  let fFile = document.getElementById('nidFrontFile').files[0];
  let bFile = document.getElementById('nidBackFile').files[0];
  if (!fFile || !bFile) return alert("Please select both front and back NID photos!");

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  Promise.all([toBase64(fFile), toBase64(bFile)]).then(([frontB64, backB64]) => {
    fetch('/api/user/submit-nid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentUser.id, nidFront: frontB64, nidBack: backB64 })
    })
    .then(r => r.json())
    .then(d => {
      showToast(d.message);
      currentUser.verificationStatus = "Pending";
      refreshProfileUI();
    });
  });
}

// ট্রফি বোনাস টাস্ক (ডাবল টার্নওভার লজিক)
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
          <small style="color:var(--text-muted); display:block;">Requires 2X Turnover ($${(t.free * 2).toLocaleString()}) to withdraw</small>
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

// ডিপোজিট মেথড পরিবর্তন ও সাবমিশন
function onDepMethodChange() {
  let method = document.getElementById('depMethodSelect').value;
  let binBox = document.getElementById('binanceCoinSelectBox');
  let targetLbl = document.getElementById('depTargetLabel');
  let targetAddr = document.getElementById('depTargetAddress');

  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    let cfg = d.config;
    if (method === 'Binance') {
      binBox.style.display = 'block';
      onCryptoChoiceChange();
    } else if (method === 'bKash') {
      binBox.style.display = 'none';
      targetLbl.innerText = "bKash Personal Number (Send Money):";
      targetAddr.innerText = cfg.bkashNumber;
    } else if (method === 'Nagad') {
      binBox.style.display = 'none';
      targetLbl.innerText = "Nagad Personal Number (Send Money):";
      targetAddr.innerText = cfg.nagadNumber;
    }
  });
}

function onCryptoChoiceChange() {
  let choice = document.getElementById('cryptoAssetChoice').value;
  let targetLbl = document.getElementById('depTargetLabel');
  let targetAddr = document.getElementById('depTargetAddress');

  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    let cfg = d.config;
    if (choice === 'USDT_TRC20') {
      targetLbl.innerText = "Deposit Address (USDT TRC20):";
      targetAddr.innerText = cfg.usdtTrc20;
    } else if (choice === 'USDT_BEP20') {
      targetLbl.innerText = "Deposit Address (USDT BEP20):";
      targetAddr.innerText = cfg.usdtBep20;
    } else if (choice === 'BTC_BEP20') {
      targetLbl.innerText = "Deposit Address (BTC BEP20):";
      targetAddr.innerText = cfg.btcBep20;
    } else {
      targetLbl.innerText = "Deposit Address (BTC Native):";
      targetAddr.innerText = cfg.btcNetwork;
    }
  });
}

function loadDepositData() {
  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    document.getElementById('depDollarRateDisplay').innerText = `1 USD = ${d.config.dollarRate.toFixed(2)} BDT`;
    onDepMethodChange();
    
    // ডিপোজিট হিস্টোরি চার্ট রেন্ডার
    let hTable = document.getElementById('depHistoryTable');
    let myDeps = d.deposits.filter(x => x.userId === currentUser.id);
    let html = '';
    myDeps.forEach(dep => {
      html += `
        <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div><b>$${dep.amount} (${dep.method})</b><small style="color:var(--text-muted); display:block;">TrxID: ${dep.trxId}</small></div>
          <span class="verify-tag ${dep.status.toLowerCase()}">${dep.status}</span>
        </div>
      `;
    });
    hTable.innerHTML = html || '<p style="color:var(--text-muted); font-size:12px;">No deposit records found.</p>';
  });
}

function submitDepositOrder() {
  let amt = document.getElementById('depAmountInput').value;
  let trx = document.getElementById('depTrxInput').value;
  let file = document.getElementById('depScreenshotFile').files[0];
  if (!amt || !trx) return alert("Please enter amount and TrxID!");

  const postDep = (b64) => {
    fetch('/api/wallet/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        method: document.getElementById('depMethodSelect').value,
        amount: amt,
        trxId: trx,
        screenshot: b64 || ""
      })
    })
    .then(r => r.json())
    .then(d => {
      showToast(d.message);
      document.getElementById('depAmountInput').value = '';
      document.getElementById('depTrxInput').value = '';
      loadDepositData();
    });
  };

  if (file) {
    let reader = new FileReader();
    reader.onload = () => postDep(reader.result);
    reader.readAsDataURL(file);
  } else {
    postDep("");
  }
}

// উইথড্রয়াল মেথড ও টার্নওভার হ্যান্ডলার
function onWithMethodChange() {
  let method = document.getElementById('withMethodSelect').value;
  let cryptoBox = document.getElementById('withCryptoNetworkBox');
  let lbl = document.getElementById('withDetailsLabel');
  if (method === 'Binance') {
    cryptoBox.style.display = 'block';
    lbl.innerText = "Binance Wallet Address:";
  } else {
    cryptoBox.style.display = 'none';
    lbl.innerText = method + " Mobile Number:";
  }
}

function loadWithdrawData() {
  fetch(`/api/user/${currentUser.id}`).then(r => r.json()).then(d => {
    currentUser = d.user;
    document.getElementById('wRealBal').innerText = '$' + currentUser.liveBalance.toFixed(2);
    document.getElementById('wBonusBal').innerText = '$' + currentUser.bonusBalance.toFixed(2);
    
    let warn = document.getElementById('turnoverWarnBox');
    if (currentUser.hasActiveBonus && currentUser.currentTurnover < currentUser.requiredTurnover) {
      warn.style.display = 'block';
      let rem = (currentUser.requiredTurnover - currentUser.currentTurnover).toFixed(2);
      warn.innerHTML = `⚠️ <b>Withdrawal Restricted!</b> Complete your 2X Turnover requirement on free bonus. Remaining: $${rem}`;
    } else {
      warn.style.display = 'none';
    }

    // উইথড্রয়াল হিস্টোরি চার্ট রেন্ডার
    fetch('/api/payments/all').then(r => r.json()).then(pd => {
      let wTable = document.getElementById('withHistoryTable');
      let myWiths = pd.withdrawals.filter(x => x.userId === currentUser.id);
      let html = '';
      myWiths.forEach(w => {
        html += `
          <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div><b>$${w.amount} (${w.method})</b><small style="color:var(--text-muted); display:block;">Details: ${w.accountDetails}</small></div>
            <span class="verify-tag ${w.status.toLowerCase()}">${w.status}</span>
          </div>
        `;
      });
      wTable.innerHTML = html || '<p style="color:var(--text-muted); font-size:12px;">No withdrawal records found.</p>';
    });
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
      accountDetails: details,
      network: document.getElementById('withNetworkSelect')?.value || "Direct"
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.turnoverBlocked) {
      alert(d.message);
    } else if (d.success) {
      showToast(d.message);
      document.getElementById('withAmountInput').value = '';
      document.getElementById('withAccountDetails').value = '';
      loadWithdrawData();
      updateBalanceUI();
    } else {
      alert(d.message);
    }
  });
}

// লাইভ সাপোর্ট মেসেঞ্জার ও ছবি পাঠানো
function loadChatHistory() {
  fetch('/api/support/messages').then(r => r.json()).then(d => {
    let box = document.getElementById('chatMessagesContainer');
    let html = '';
    d.messages.forEach(m => {
      let isUser = m.sender === 'User';
      html += `
        <div class="chat-bubble ${isUser ? 'user' : 'admin'}">
          <div>${m.text}</div>
          ${m.image ? `<img src="${m.image}" style="max-width:160px; border-radius:6px; margin-top:6px; display:block;">` : ''}
          <small style="font-size:9px; opacity:0.75; display:block; text-align:right; margin-top:2px;">${m.timeStr}</small>
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

function sendChatImage(event) {
  let file = event.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = () => {
    fetch('/api/support/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'User', userId: currentUser.id, text: "", image: reader.result })
    })
    .then(() => loadChatHistory());
  };
  reader.readAsDataURL(file);
}

// নোটিফিকেশন, পেমেন্টস ও ট্রেডস হিস্ট্রি লোডার
function loadNotifications() {
  fetch('/api/notifications').then(r => r.json()).then(d => {
    let box = document.getElementById('notificationsList');
    let html = '';
    d.notifications.forEach(n => {
      html += `
        <div class="card-box" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b>${n.title}</b><small style="color:var(--text-muted);">${n.time}</small>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">${n.body}</p>
        </div>
      `;
    });
    box.innerHTML = html || '<p style="color:var(--text-muted); text-align:center; padding:20px;">No notifications yet.</p>';
    document.getElementById('notifBadgeCount').innerText = d.notifications.length;
  });
}

function loadAllPayments() {
  fetch('/api/payments/all').then(r => r.json()).then(d => {
    let box = document.getElementById('allPaymentsHistoryBox');
    let html = '';
    html += '<h4 style="margin-bottom:6px;">Deposits:</h4>';
    d.deposits.forEach(p => {
      html += `<div class="card-box" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><div><b>$${p.amount} (${p.method})</b><small style="color:var(--text-muted); display:block;">${p.date}</small></div><span class="verify-tag ${p.status.toLowerCase()}">${p.status}</span></div>`;
    });
    html += '<h4 style="margin:12px 0 6px;">Withdrawals:</h4>';
    d.withdrawals.forEach(w => {
      html += `<div class="card-box" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><div><b>$${w.amount} (${w.method})</b><small style="color:var(--text-muted); display:block;">${w.date}</small></div><span class="verify-tag ${w.status.toLowerCase()}">${w.status}</span></div>`;
    });
    box.innerHTML = html;
  });
}

function loadAllTrades() {
  fetch('/api/trades/lifetime').then(r => r.json()).then(d => {
    let box = document.getElementById('allTradesHistoryBox');
    let html = '';
    d.trades.forEach(t => {
      html += `
        <div class="card-box" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div><b>${t.asset} (${t.direction})</b><small style="color:var(--text-muted); display:block;">Invest: $${t.amount} | ${t.time}</small></div>
          <span style="font-weight:800; color:${t.isWin ? '#00e676' : '#eb5757'};">${t.isWin ? `+$${t.profit}` : `-$${t.amount}`}</span>
        </div>
      `;
    });
    box.innerHTML = html || '<p style="color:var(--text-muted); text-align:center; padding:20px;">No trade records yet.</p>';
  });
}

// সেটিংস: থিম, ৭ ভাষা ও টেলিগ্রাম পার্টনার
function applyThemeMode(mode) {
  document.body.className = mode === 'light' ? 'theme-light' : '';
  localStorage.setItem('app_theme', mode);
}

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('app_lang', lang);
  showToast("Language Updated: " + lang.toUpperCase());
}

function openPartnerTelegram() {
  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    window.open(d.config.telegramLink, '_blank');
  });
}

function resetPan() { panOffset = 0; }

// ওয়েবসকেট ইঞ্জিন
function initWS() {
  let ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
  ws.onmessage = (e) => {
    let msg = JSON.parse(e.data);
    if (msg.type === 'TICK' && msg.assets[activeAssetKey]) {
      targetLivePrice = parseFloat(msg.assets[activeAssetKey].price);
    } else if (msg.type === 'TRADE_SETTLED') {
      showToast(msg.result.isWin ? `Profit! +$${msg.result.profit}` : "Trade Lost");
      loadUserData();
    } else if (msg.type === 'CHAT_MSG') {
      loadChatHistory();
    }
  };
  ws.onclose = () => setTimeout(initWS, 1500);
}

function loadUserData() {
  let savedId = localStorage.getItem('auth_user_id') || "85857047";
  fetch(`/api/user/${savedId}`).then(r => r.json()).then(d => {
    currentUser = d.user;
    updateBalanceUI();
    refreshProfileUI();
  });
}

// টার্মিনাল বুটস্ট্র্যাপ
fitCanvas();
loadAssets();
fullSync();
initWS();
loadUserData();
requestAnimationFrame(render);
