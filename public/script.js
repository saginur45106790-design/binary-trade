const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let raw5sBars = [];
let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let currentUser = {
  id: "85857047",
  name: "MD Sajib Hossain",
  displayName: "Sajib Trader",
  email: "teachsajib@gmail.com",
  phone: "01700000000",
  dob: "2005-01-01",
  country: "Bangladesh",
  city: "Rajshahi",
  address: "Akkelpur, Rajshahi",
  zip: "1200",
  liveBalance: 10.00,
  demoBalance: 11068.77,
  bonusBalance: 0.00,
  requiredTurnover: 0.00,
  currentTurnover: 0.00,
  hasActiveBonus: false,
  traderLevel: "Starter",
  verificationStatus: "Unverified"
};

let activeAssetKey = 'EUR_USD';
let activeDecimals = 5;
let currentPayout = 92;
let panOffset = 0;
let remainingCountdown = 60;
let selectedTimerSeconds = 60;
let selectedCandleSeconds = 60;

let renderLivePrice = 1.08540;
let targetLivePrice = 1.08540;
let candleWidth = 13;
let candleSpacing = 5;
let initialPinchDistance = null;

let allAssets = {};
let favoriteAssets = JSON.parse(localStorage.getItem('fav_assets') || '["EUR_USD", "BTC", "GOLD"]');
let currentLang = localStorage.getItem('app_lang') || 'en';

const FLAG_ICONS = {
  'EUR_USD': { flag1: '🇪🇺', flag2: '🇺🇸' },
  'GBP_JPY': { flag1: '🇬🇧', flag2: '🇯🇵' },
  'GBP_USD': { flag1: '🇬🇧', flag2: '🇺🇸' },
  'EUR_AUD': { flag1: '🇪🇺', flag2: '🇦🇺' },
  'ETH':     { flag1: '🔷', flag2: '🇺🇸' },
  'SOL':     { flag1: '🟣', flag2: '🇺🇸' },
  'BNB':     { flag1: '🟡', flag2: '🇺🇸' },
  'BTC':     { flag1: '₿', flag2: '🇺🇸' },
  'SILVER':  { flag1: '🥈', flag2: '🇺🇸' },
  'GOLD':    { flag1: '🪙', flag2: '🇺🇸' }
};

// গ্লোবাল নোটিফিকেশন টোস্ট
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
    let txt = el.innerText || el.textContent;
    navigator.clipboard.writeText(txt.replace('(Copy ID)', '').trim());
    showToast("Copied to clipboard!");
  }
}

// ২৬টি ক্লায়েন্ট পেজ ওপেন ও ক্লোজ রাউটার
function openSheet(id) {
  closeAllSheets();
  let el = document.getElementById(id);
  if (el) el.style.display = 'flex';

  if (id === 'depositSheet') loadDepositData();
  if (id === 'withdrawSheet') loadWithdrawData();
  if (id === 'chatSheet') loadChatHistory();
  if (id === 'trophySheet') renderBonusTasks();
  if (id === 'notifSheet') loadNotifications();
  if (id === 'paymentsHistorySheet') loadAllPayments();
  if (id === 'tradesHistorySheet') loadAllTrades();
  if (id === 'profileSheet') refreshProfileUI();
  if (id === 'signalsSheet') loadSignals();
  if (id === 'tournamentsSheet') loadTournaments();
  if (id === 'leaderboardSheet') loadLeaderboard();
  if (id === 'priceAlertsSheet') loadPriceAlerts();
  if (id === 'analyticsSheet') loadAnalytics();
  if (id === 'activeTradesSheet') updateActiveTradesDrawerLive();
}

function closeSheet(id) {
  let el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function closeAllSheets() {
  document.querySelectorAll('.modal-overlay-sheet').forEach(m => m.style.display = 'none');
}

// ১ ও ৬. অথেন্টিকেশন ও ল্যান্ডিং হ্যান্ডলার
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
  if (!email || !pass) return alert("Please enter email/ID and password!");

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
      showToast("Welcome Back! Login Successful.");
      closeSheet('authModal');
      closeSheet('landingModal');
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
  if (!email || !pass) return alert("Please fill all required fields!");

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
      showToast("Registration Complete! Welcome to Tredlo.");
      closeSheet('authModal');
      closeSheet('landingModal');
      refreshProfileUI();
      updateBalanceUI();
    } else {
      alert(d.message);
    }
  });
}

function enterQuickDemo() {
  closeSheet('landingModal');
  selectAccountType('demo');
  showToast("Demo Terminal Activated ($11,068.77)");
}

function handleUserLogout() {
  localStorage.removeItem('auth_user_id');
  location.reload();
}

// ২. অ্যাকাউন্ট স্যুইচার
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

// ৩. টাইমফ্রেম ও ক্যান্ডেল পিরিয়ড সিলেকশন
function selectCandlePeriod(sec, label) {
  selectedCandleSeconds = sec;
  let lbl = document.getElementById('chartTfLabel');
  if (lbl) lbl.innerText = label;
  candles = resampleBars(raw5sBars, selectedCandleSeconds);
  closeSheet('timeframeModal');
  showToast(`Timeframe changed to ${label}`);
}

function resampleBars(baseBars, intervalSec) {
  if (!baseBars || baseBars.length === 0) return [];
  if (intervalSec <= 5) return baseBars.map(b => ({ ...b }));

  let resampled = [];
  let currBucket = null;

  for (let i = 0; i < baseBars.length; i++) {
    let b = baseBars[i];
    let bucketTime = Math.floor(b.time / intervalSec) * intervalSec;

    if (currBucket === null || currBucket.time !== bucketTime) {
      if (currBucket !== null) resampled.push(currBucket);
      currBucket = {
        time: bucketTime,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close
      };
    } else {
      if (b.high > currBucket.high) currBucket.high = b.high;
      if (b.low < currBucket.low) currBucket.low = b.low;
      currBucket.close = b.close;
    }
  }
  if (currBucket !== null) resampled.push(currBucket);
  return resampled;
}

// ৪. অ্যাসেট ও মার্কেট সিলেক্টর
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
  let keys = Object.keys(allAssets);
  keys.sort((a, b) => favoriteAssets.includes(b) - favoriteAssets.includes(a));

  keys.forEach(k => {
    let item = allAssets[k];
    if (!item.enabled) return;
    if (filterQuery && !item.name.toLowerCase().includes(filterQuery.toLowerCase())) return;

    let isFav = favoriteAssets.includes(k);
    let isPos = item.change24h >= 0;
    let flags = FLAG_ICONS[k] || { flag1: '🌐', flag2: '🇺🇸' };

    html += `
      <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="selectAsset('${k}')">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="color:${isFav ? '#f5a623' : '#64748b'}; font-size:16px; cursor:pointer;" onclick="toggleFavorite(event, '${k}')">★</span>
          <span style="font-size:16px;">${flags.flag1}${flags.flag2}</span>
          <div>
            <b>${item.name}</b>
            <small style="color:var(--text-muted); display:block;">1m: ${item.payout1m}% | 5m: ${item.payout5m}%</small>
          </div>
        </div>
        <div style="text-align:right;">
          <b style="color:var(--accent-gold); font-size:14px;">${item.payout1m}%</b>
          <div style="font-weight:700; font-size:11px; color:${isPos ? '#00e676' : '#eb5757'};">
            ${isPos ? '+' : ''}${item.change24h}%
          </div>
        </div>
      </div>
    `;
  });
  box.innerHTML = html;
}

function filterAssetsList() {
  let q = document.getElementById('assetSearchQuery')?.value || '';
  renderOtcList(q);
}

function toggleFavorite(e, k) {
  e.stopPropagation();
  if (favoriteAssets.includes(k)) favoriteAssets = favoriteAssets.filter(x => x !== k);
  else favoriteAssets.push(k);
  localStorage.setItem('fav_assets', JSON.stringify(favoriteAssets));
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
      raw5sBars = d.history.map(c => ({ ...c }));
      candles = resampleBars(raw5sBars, selectedCandleSeconds);
      let last = candles[candles.length - 1];
      targetLivePrice = last.close;
      renderLivePrice = last.close;
    }
  });
}

// ৫ ও ৬. ট্রেড কন্ট্রোল ডক ও এক্সপায়ারেশন
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
  closeSheet('timerModal');
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
      updateActiveTradesDrawerLive();
    } else {
      alert(d.message);
    }
  });
}

// ৭. ট্রেড উইন মোডাল ট্রিগার
function triggerWinPopup(tr, profit) {
  let winModal = document.getElementById('winResultModal');
  let pAmt = document.getElementById('winProfitAmount');
  let aDet = document.getElementById('winAssetDetails');
  if (winModal && pAmt) {
    pAmt.innerText = `+$${profit.toFixed(2)}`;
    if (aDet) aDet.innerText = `${tr.asset || activeAssetKey} • Fixed Time`;
    winModal.style.display = 'flex';
  }
}

// ৮. পোর্টফোলিও / সক্রিয় ট্রেড লাইভ ড্রয়ার
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
    let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
    let remS = String(diffSec % 60).padStart(2, '0');

    let currentPrice = (tr.asset === activeAssetKey) ? renderLivePrice : tr.entryPrice;
    let isWinning = false;
    if (tr.direction === 'UP') isWinning = (currentPrice > tr.entryPrice);
    else if (tr.direction === 'DOWN') isWinning = (currentPrice < tr.entryPrice);

    let expectedProfit = (tr.amount * (currentPayout / 100)).toFixed(2);

    html += `
      <div class="data-card-wrapper">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <b>${tr.asset}</b>
          <span class="sig-badge-${tr.direction.toLowerCase()}">${tr.direction === 'UP' ? '▲ UP' : '▼ DOWN'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:6px;">
          <span>Invested: <b>$${parseFloat(tr.amount).toFixed(2)}</b></span>
          <span>Time: <b>${remM}:${remS}</b></span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:800;">
          <span style="font-size:11px; color:var(--text-muted);">Current: ${currentPrice.toFixed(activeDecimals)}</span>
          <span style="color:${isWinning ? '#00e676' : '#eb5757'};">
            ${isWinning ? `+ $${expectedProfit}` : `-$${parseFloat(tr.amount).toFixed(2)}`}
          </span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ৯. ট্রেডস হিস্ট্রি (Real vs Demo)
function loadAllTrades() {
  fetch('/api/trades/lifetime').then(r => r.json()).then(d => {
    let box = document.getElementById('allTradesHistoryBox');
    if (!box) return;
    let html = '';
    d.trades.forEach(t => {
      let isDraw = t.isDraw;
      let col = isDraw ? 'var(--text-muted)' : (t.isWin ? '#00e676' : '#eb5757');
      html += `
        <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <b>${t.asset} (${t.direction})</b>
            <small style="color:var(--text-muted); display:block;">Amount: $${t.amount} | ${t.time}</small>
          </div>
          <div style="text-align:right;">
            <b style="color:${col}; font-size:13px;">${isDraw ? '+$0.00' : (t.isWin ? `+$${t.profit}` : `-$${t.amount}`)}</b>
            <small style="color:var(--text-muted); display:block;">${t.accountType.toUpperCase()}</small>
          </div>
        </div>
      `;
    });
    box.innerHTML = html || '<p style="color:var(--text-muted); text-align:center; padding:20px;">No deals recorded yet.</p>';
  });
}

// ১০ ও ১১. ডিপোজিট গেটওয়ে
function onDepMethodChange() {
  let method = document.getElementById('depMethodSelect').value;
  let binBox = document.getElementById('binanceCoinSelectBox');
  let targetLbl = document.getElementById('depTargetLabel');
  let targetAddr = document.getElementById('depTargetAddress');

  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    let cfg = d.config;
    if (method === 'Binance') {
      if (binBox) binBox.style.display = 'block';
      onCryptoChoiceChange();
    } else if (method === 'Nagad') {
      if (binBox) binBox.style.display = 'none';
      if (targetLbl) targetLbl.innerText = "Nagad Personal Number (Send Money):";
      if (targetAddr) targetAddr.innerText = cfg.nagadNumber;
    } else if (method === 'bKash') {
      if (binBox) binBox.style.display = 'none';
      if (targetLbl) targetLbl.innerText = "bKash Personal Number (Send Money):";
      if (targetAddr) targetAddr.innerText = cfg.bkashNumber;
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
      targetLbl.innerText = "Deposit Address (USDT TRC-20):";
      targetAddr.innerText = cfg.usdtTrc20;
    } else if (choice === 'USDT_BEP20') {
      targetLbl.innerText = "Deposit Address (USDT BEP-20):";
      targetAddr.innerText = cfg.usdtBep20;
    } else if (choice === 'BTC_BEP20') {
      targetLbl.innerText = "Deposit Address (BTC BEP-20):";
      targetAddr.innerText = cfg.btcBep20;
    } else {
      targetLbl.innerText = "Deposit Address (BTC Native):";
      targetAddr.innerText = cfg.btcNetwork;
    }
  });
}

function loadDepositData() {
  fetch('/api/admin/overview').then(r => r.json()).then(d => {
    let rDisp = document.getElementById('depDollarRateDisplay');
    if (rDisp) rDisp.innerText = `1 USD = ${d.config.dollarRate.toFixed(2)} BDT`;
    onDepMethodChange();

    let hTable = document.getElementById('depHistoryTable');
    let myDeps = d.deposits.filter(x => x.userId === currentUser.id);
    let html = '';
    myDeps.forEach(dep => {
      html += `
        <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <b>$${dep.amount} (${dep.method})</b>
            <small style="color:var(--text-muted); display:block;">TrxID: ${dep.trxId}</small>
          </div>
          <span class="verify-badge-pill ${dep.status.toLowerCase()}">${dep.status}</span>
        </div>
      `;
    });
    if (hTable) hTable.innerHTML = html || '<p style="color:var(--text-muted); font-size:12px;">No deposit transactions recorded.</p>';
  });
}

function submitDepositOrder() {
  let method = document.getElementById('depMethodSelect').value;
  let amt = document.getElementById('depAmountInput').value;
  let trx = document.getElementById('depTrxInput').value;
  let promo = document.getElementById('depPromoInput')?.value || '';

  if (!amt || !trx) return alert("Please specify the amount and Transaction ID!");

  // ১২. নগদ সিমুলেটর হ্যান্ডলিং
  if (method === 'Nagad') {
    let nagadSheet = document.getElementById('nagadSimulatorSheet');
    let bdtDisp = document.getElementById('nagadTotalBdtDisplay');
    if (nagadSheet && bdtDisp) {
      let bdtTotal = (parseFloat(amt) * 125.00).toFixed(2);
      bdtDisp.innerText = `BDT ${bdtTotal}`;
      nagadSheet.style.display = 'flex';
      return;
    }
  }

  executeDepositPost(method, amt, trx, promo);
}

function confirmNagadSimulatedPayment() {
  let phone = document.getElementById('nagadUserPhone')?.value.trim();
  if (!phone) return alert("Please enter your Nagad phone number!");
  let amt = document.getElementById('depAmountInput').value;
  let trx = document.getElementById('depTrxInput').value || `NAGAD-${Date.now()}`;
  let promo = document.getElementById('depPromoInput')?.value || '';

  closeSheet('nagadSimulatorSheet');
  executeDepositPost('Nagad', amt, trx, promo);
}

function executeDepositPost(method, amt, trx, promo) {
  fetch('/api/wallet/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.id,
      method,
      amount: amt,
      trxId: trx,
      promoCode: promo
    })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    document.getElementById('depAmountInput').value = '';
    document.getElementById('depTrxInput').value = '';
    loadDepositData();
  });
}

// ১৩. টুর্নামেন্টস হাব
function loadTournaments() {
  fetch('/api/tournaments/list').then(r => r.json()).then(d => {
    let box = document.getElementById('tournamentsListContainer');
    if (!box) return;
    let html = '';
    d.tournaments.forEach(tour => {
      html += `
        <div class="tournament-item-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <b style="font-size:15px; color:#fff;">${tour.title}</b>
            <span class="tour-badge-active">${tour.status}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:10px;">
            <span>Prize Pool: <b style="color:var(--accent-gold);">${tour.prizePool}</b></span>
            <span>Fee: <b>${tour.entryFee}</b></span>
            <span>Traders: <b>${tour.participants}</b></span>
          </div>
          <button class="btn-primary-blue" style="background:#00b074; padding:8px 14px;" onclick="joinTournamentAction('${tour.id}')">Join Tournament</button>
        </div>
      `;
    });
    box.innerHTML = html;
  });
}

function joinTournamentAction(tourId) {
  fetch('/api/tournaments/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tournamentId: tourId, userId: currentUser.id })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    loadTournaments();
  });
}

// ১৫. রিওয়ার্ডস ও প্রোমো কুপন
function submitPromoRedeem() {
  let code = document.getElementById('promoCodeInput')?.value.trim().toUpperCase();
  if (!code) return alert("Enter promo code!");

  fetch('/api/rewards/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, code })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    if (d.success) applyCouponToDep(code);
  });
}

function applyCouponToDep(code) {
  let depPromo = document.getElementById('depPromoInput');
  if (depPromo) depPromo.value = code;
  openSheet('depositSheet');
  showToast(`Coupon ${code} applied to deposit form!`);
}

// ১৭. লিডারবোর্ড হাব
function loadLeaderboard() {
  fetch('/api/leaderboard').then(r => r.json()).then(d => {
    let box = document.getElementById('leaderboardListContainer');
    if (!box) return;
    let html = '';
    d.leaderboard.forEach(l => {
      let medal = l.rank === 1 ? '🥇' : (l.rank === 2 ? '🥈' : (l.rank === 3 ? '🥉' : `#${l.rank}`));
      html += `
        <div class="leader-row-item">
          <div style="display:flex; align-items:center; gap:10px;">
            <b style="font-size:16px; min-width:24px;">${medal}</b>
            <span>${l.country}</span>
            <div>
              <b>${l.name}</b>
              <small style="color:var(--text-muted); display:block;">${l.deals} deals today</small>
            </div>
          </div>
          <b style="color:#00e676; font-size:13px;">${l.profit}</b>
        </div>
      `;
    });
    box.innerHTML = html;
  });
}

// ১৮. সিগন্যালস ইঞ্জিন
function loadSignals() {
  fetch('/api/signals/list').then(r => r.json()).then(d => {
    let box = document.getElementById('signalsListContainer');
    if (!box) return;
    let html = '';
    d.signals.forEach(sig => {
      let isHigher = sig.direction === 'HIGHER';
      html += `
        <div class="signal-item-card">
          <div class="sig-head-row">
            <b>${sig.company}</b>
            <span class="${isHigher ? 'sig-badge-higher' : 'sig-badge-lower'}">${sig.direction}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:8px;">
            <span>Algorithm: <b>${sig.strategy}</b></span>
            <span>Strength: <b style="color:#00e676;">${sig.strength}</b></span>
            <span>Time: <b>${sig.timeframe}</b></span>
          </div>
          <button class="btn-primary-blue" style="padding:6px 12px; background:var(--bg-dark); border:1px solid var(--border-subtle);" onclick="copySignalAction('${sig.asset}', '${isHigher ? 'UP' : 'DOWN'}')">
            Copy Signal ➔
          </button>
        </div>
      `;
    });
    box.innerHTML = html;
  });
}

function copySignalAction(assetKey, dir) {
  selectAsset(assetKey);
  placeOrder(dir);
  closeSheet('signalsSheet');
}

// ১৯. প্রাইস অ্যালার্টস
function loadPriceAlerts() {
  fetch('/api/alerts/list').then(r => r.json()).then(d => {
    let box = document.getElementById('activeAlertsList');
    if (!box) return;
    let html = '';
    d.alerts.forEach(a => {
      html += `
        <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <b>${a.asset}</b>
            <small style="color:var(--text-muted); display:block;">Condition: ${a.condition} ${a.targetPrice}</small>
          </div>
          <span class="verify-badge-pill ${a.triggered ? 'verified' : 'unverified'}">${a.triggered ? 'Triggered' : 'Active'}</span>
        </div>
      `;
    });
    box.innerHTML = html || '<p style="color:var(--text-muted); font-size:12px;">No active alerts set.</p>';
  });
}

function submitCreatePriceAlert() {
  let target = document.getElementById('alertTargetPriceInput')?.value;
  let cond = document.getElementById('alertConditionSelect')?.value || 'ABOVE';
  if (!target) return alert("Enter target price!");

  fetch('/api/alerts/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: activeAssetKey, targetPrice: target, condition: cond })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    document.getElementById('alertTargetPriceInput').value = '';
    loadPriceAlerts();
  });
}

// ২১. পার্সোনাল ডাটা, কেওয়াইসি ও স্টেটমেন্ট
function refreshProfileUI() {
  document.getElementById('profNameDisplay').innerText = currentUser.name;
  document.getElementById('profIdDisplay').innerText = "ID: " + currentUser.id;
  document.getElementById('profNameInput').value = currentUser.name;
  document.getElementById('profDisplayNameInput').value = currentUser.displayName || currentUser.name;
  document.getElementById('profEmailInput').value = currentUser.email;
  document.getElementById('profPhoneInput').value = currentUser.phone || '';

  let tag = document.getElementById('profVerifyTag');
  let nidSec = document.getElementById('nidSubmitSection');
  tag.className = "verify-badge-pill " + currentUser.verificationStatus.toLowerCase();
  tag.innerText = currentUser.verificationStatus;

  if (currentUser.verificationStatus === 'Verified') {
    nidSec.style.display = 'none';
  } else {
    nidSec.style.display = 'block';
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
      displayName: document.getElementById('profDisplayNameInput').value,
      email: document.getElementById('profEmailInput').value,
      phone: document.getElementById('profPhoneInput').value
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
  if (!fFile || !bFile) return alert("Select both front and back NID photos!");

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

function generateAccountStatement() {
  fetch('/api/user/statement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id })
  })
  .then(r => r.json())
  .then(d => {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(d, null, 2));
    let dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `Statement_${currentUser.id}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast("Statement Downloaded!");
  });
}

// ২৩. পাসওয়ার্ড আপডেট
function submitChangePassword() {
  let curP = document.getElementById('curPassInput')?.value;
  let newP = document.getElementById('newPassInput')?.value;
  if (!curP || !newP) return alert("Enter current and new password!");

  fetch('/api/user/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentUser.id, currentPassword: curP, newPassword: newP })
  })
  .then(r => r.json())
  .then(d => {
    showToast(d.message);
    if (d.success) {
      document.getElementById('curPassInput').value = '';
      document.getElementById('newPassInput').value = '';
    }
  });
}

// ২৪. ট্রেডিং স্ট্যাটস ও অ্যানালিটিক্স
function loadAnalytics() {
  fetch(`/api/analytics/${currentUser.id}`).then(r => r.json()).then(d => {
    let s = d.stats;
    document.getElementById('statTotalTrades').innerText = s.totalTrades;
    document.getElementById('statNetProfit').innerText = `$${s.netProfit}`;
    document.getElementById('statWinRate').innerText = s.winRate;
    document.getElementById('statBestStreak').innerText = s.bestStreak;
  });
}

// ২৫. উইথড্রয়াল ও ২X টার্নওভার কমপ্লায়েন্স
function onWithMethodChange() {
  let method = document.getElementById('withMethodSelect').value;
  let lbl = document.getElementById('withDetailsLabel');
  let inp = document.getElementById('withAccountDetails');
  if (method === 'Binance') {
    lbl.innerText = "Binance Wallet Address (USDT):";
    inp.placeholder = "Enter USDT wallet address";
  } else {
    lbl.innerText = method + " Account Number:";
    inp.placeholder = "01XXXXXXXXX";
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
      warn.innerHTML = `⚠️ <b>Withdrawal Restricted!</b> Complete your 2X Turnover requirement on bonus funds. Remaining: $${rem}`;
    } else {
      warn.style.display = 'none';
    }

    fetch('/api/payments/all').then(r => r.json()).then(pd => {
      let wTable = document.getElementById('withHistoryTable');
      let myWiths = pd.withdrawals.filter(x => x.userId === currentUser.id);
      let html = '';
      myWiths.forEach(w => {
        html += `
          <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div><b>$${w.amount} (${w.method})</b><small style="color:var(--text-muted); display:block;">${w.accountDetails}</small></div>
            <span class="verify-badge-pill ${w.status.toLowerCase()}">${w.status}</span>
          </div>
        `;
      });
      wTable.innerHTML = html || '<p style="color:var(--text-muted); font-size:12px;">No withdrawal transactions recorded.</p>';
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
      accountDetails: details
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

// ২৬. হেল্প সেন্টার ও টিকিট সাবমিশন
function submitSupportTicket() {
  let sub = document.getElementById('ticketSubject')?.value.trim();
  let msg = document.getElementById('ticketMessage')?.value.trim();
  if (!sub || !msg) return alert("Fill subject and message!");

  fetch('/api/support/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: 'User', userId: currentUser.id, text: `[Ticket: ${sub}] ${msg}` })
  })
  .then(() => {
    showToast("Support Ticket Submitted!");
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
    closeSheet('helpSheet');
  });
}

// লাইভ সাপোর্ট মেসেঞ্জার (২৪ ঘণ্টা মেমোরি)
function loadChatHistory() {
  fetch('/api/support/messages').then(r => r.json()).then(d => {
    let box = document.getElementById('chatMessagesContainer');
    let html = '';
    d.messages.forEach(m => {
      let isUser = m.sender === 'User';
      html += `
        <div class="chat-bubble-msg ${isUser ? 'user' : 'admin'}">
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

// নোটিফিকেশন ও পেমেন্ট হিস্ট্রি লোডার
function loadNotifications() {
  fetch('/api/notifications').then(r => r.json()).then(d => {
    let box = document.getElementById('notificationsList');
    let html = '';
    d.notifications.forEach(n => {
      html += `
        <div class="data-card-wrapper" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b>${n.title}</b><small style="color:var(--text-muted);">${n.time}</small>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">${n.body}</p>
        </div>
      `;
    });
    box.innerHTML = html || '<p style="color:var(--text-muted); text-align:center; padding:20px;">No new notifications.</p>';
    document.getElementById('notifBadgeCount').innerText = d.notifications.length;
  });
}

function loadAllPayments() {
  fetch('/api/payments/all').then(r => r.json()).then(d => {
    let box = document.getElementById('allPaymentsHistoryBox');
    let html = '<h4 style="margin-bottom:6px;">Deposits:</h4>';
    d.deposits.forEach(p => {
      html += `<div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><div><b>$${p.amount} (${p.method})</b><small style="color:var(--text-muted); display:block;">${p.date}</small></div><span class="verify-badge-pill ${p.status.toLowerCase()}">${p.status}</span></div>`;
    });
    html += '<h4 style="margin:12px 0 6px;">Withdrawals:</h4>';
    d.withdrawals.forEach(w => {
      html += `<div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><div><b>$${w.amount} (${w.method})</b><small style="color:var(--text-muted); display:block;">${w.date}</small></div><span class="verify-badge-pill ${w.status.toLowerCase()}">${w.status}</span></div>`;
    });
    box.innerHTML = html;
  });
}

// বোনাস টাস্ক ক্লেইম
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
      <div class="data-card-wrapper" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>Trade $${t.trade.toLocaleString()} ➔ Get $${t.free.toLocaleString()} FREE</b>
          <small style="color:var(--text-muted); display:block;">Turnover requirement: 2X ($${(t.free * 2).toLocaleString()})</small>
        </div>
        <button class="btn-primary-blue" style="width:auto; padding:6px 14px; background:#00b074;" onclick="claimBonusTask(${t.trade}, ${t.free})">Join Now</button>
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

// সেটিংস: থিম ও ভাষা
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

// কটেক্স ক্যান্ডেলস্টিক চার্ট রেন্ডার ইঞ্জিন
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

  // কটেক্স ক্যান্ডেলস্টিক রেন্ডার
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

  // লাইভ কাউন্টডাউন পিল
  let expX = baseRightX + (candleWidth + candleSpacing);
  let cdStr = `00:${String(remainingCountdown).padStart(2, '0')}`;
  ctx.fillStyle = '#1c2638';
  ctx.fillRect(expX + 6, liveY - 9, 44, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(cdStr, expX + 10, liveY + 3);

  // সক্রিয় ট্রেড মার্কারসমূহ
  activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
    let entryY = getY(tr.entryPrice);
    let isUp = tr.direction === 'UP';
    let tCol = isUp ? '#00e676' : '#eb5757';

    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = tCol;
    ctx.beginPath();
    ctx.moveTo(0, entryY);
    ctx.lineTo(w - 55, entryY);
    ctx.stroke();
    ctx.setLineDash([]);
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

// টাচ স্ক্রোল ও জুম
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
      if (factor > 1.04 && candleWidth < 26) { candleWidth = Math.min(26, candleWidth + 0.3); candleSpacing = Math.min(10, candleSpacing + 0.15); }
      else if (factor < 0.96 && candleWidth > 8) { candleWidth = Math.max(8, candleWidth - 0.3); candleSpacing = Math.max(3, candleSpacing - 0.15); }
      initialPinchDistance = currentDist;
    } else if (e.touches.length === 1 && isPanning) {
      panOffset += (e.touches[0].clientX - startX) * 0.95;
      let maxPan = (candles.length * (candleWidth + candleSpacing)) - 80;
      panOffset = Math.max(-60, Math.min(maxPan, panOffset));
      startX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => { isPanning = false; initialPinchDistance = null; });
}

// সেন্ট্রাল ওয়েবসকেট ইঞ্জিন
function initWS() {
  let ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
  ws.onmessage = (e) => {
    let msg = JSON.parse(e.data);
    if (msg.type === 'TICK') {
      if (msg.assets && msg.assets[activeAssetKey]) {
        targetLivePrice = parseFloat(msg.assets[activeAssetKey].price);
      }
      if (msg.sentiment) {
        let bBar = document.getElementById('sentimentBuyersBar');
        let sBar = document.getElementById('sentimentSellersBar');
        if (bBar && sBar) {
          bBar.style.height = `${msg.sentiment.buyers}%`;
          sBar.style.height = `${msg.sentiment.sellers}%`;
        }
      }
    } else if (msg.type === 'TRADE_SETTLED') {
      let r = msg.result;
      let tr = activeTrades.find(t => t.id === r.tradeId) || { asset: activeAssetKey };
      activeTrades = activeTrades.filter(t => t.id !== r.tradeId);
      updateActiveTradesDrawerLive();
      loadUserData();
      if (r.isWin) {
        triggerWinPopup(tr, r.profit);
      } else {
        showToast(r.isDraw ? "Trade Drawn! Funds Refunded." : "Trade Closed: Loss");
      }
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
