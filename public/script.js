const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let raw5sBars = [];
let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11068.77;
let liveBalance = 10.00;
let panOffset = 0;

// টাইমফ্রেম সিস্টেম (ডিফল্ট ১ মিনিট = ৬০ সেকেন্ড)
let activeTfSeconds = 60;
let activeTfLabel = '1m';

let activeAssetKey = 'EUR_USD';
let activeDecimals = 5;
let currentPayout = 77;
let isLoadingAsset = false;

let renderLivePrice = 1.08540;
let targetLivePrice = 1.08540;

// কটেক্স ও পকেট অপশন স্ট্যান্ডার্ড ক্যান্ডেল সাইজ
let candleWidth = 14;
let candleSpacing = 5;
let initialPinchDistance = null;

let currentMode = 'timer';
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';

let currentInvestAmount = 1;
let selectedDepMethod = 'Bkash';
let currentTimezoneOffset = 6;

let allAssetsData = {};
let favoriteAssets = JSON.parse(localStorage.getItem('fav_otc_assets') || '["EUR_USD", "BTC", "GOLD"]');

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

// তাৎক্ষণিক ব্যাকআপ ক্যান্ডেল তৈরি (চার্ট যেন কখনো ব্ল্যাক না হয়)
function generateEmergencyFallbackCandles(basePrice = 1.08540, decimals = 5) {
    let list = [];
    let cur = basePrice;
    let nowSec = Math.floor(Date.now() / 5000) * 5;
    for (let i = 400; i > 0; i--) {
        let t = nowSec - (i * 5);
        let delta = (Math.random() - 0.495) * 0.00015;
        let o = cur;
        let c = parseFloat((o + delta).toFixed(decimals));
        let h = parseFloat((Math.max(o, c) + Math.random() * 0.00008).toFixed(decimals));
        let l = parseFloat((Math.min(o, c) - Math.random() * 0.00008).toFixed(decimals));
        list.push({ time: t, open: o, high: h, low: l, close: c });
        cur = c;
    }
    return list;
}
raw5sBars = generateEmergencyFallbackCandles();
candles = resampleBars(raw5sBars, activeTfSeconds);

// -------------------------------------------------------------
// ⏱️ ভিডিও ৯৬৮ অনুযায়ী টাইমফ্রেম রি-স্যাম্পলিং ফাংশন
// -------------------------------------------------------------
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

function setCandleTimeframe(seconds, label) {
    activeTfSeconds = seconds;
    activeTfLabel = label;

    let badge = document.getElementById('activeTfBadgeLabel');
    if (badge) badge.innerText = label;

    document.querySelectorAll('.tf-choice-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.trim().toLowerCase() === label.toLowerCase());
    });

    // ক্যান্ডেল রি-স্যাম্পল ও ড্রপডাউন বন্ধ
    candles = resampleBars(raw5sBars, activeTfSeconds);
    let menu = document.getElementById('timeframeMenu');
    if (menu) menu.style.display = 'none';
}

function toggleTimeframeDialog() {
    let menu = document.getElementById('timeframeMenu');
    if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

// ঘড়ি ও কাউন্টডাউন
function syncClock() {
    try {
        let now = new Date();
        let utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        let targetTime = new Date(utcMs + (3600000 * currentTimezoneOffset));

        let hh = String(targetTime.getHours()).padStart(2, '0');
        let mm = String(targetTime.getMinutes()).padStart(2, '0');
        let ss = String(targetTime.getSeconds()).padStart(2, '0');
        
        let clock = document.getElementById('liveUtcClock');
        if (clock) clock.innerHTML = `<span class="live-dot"></span> ${hh}:${mm}:${ss} UTC+6`;

        updateActiveTradesDrawerLive();
    } catch (e) {}
}
syncClock();
setInterval(syncClock, 1000);

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

// হিস্ট্রি সিঙ্ক
function fullSyncFromServer() {
    fetch(`/api/history?asset=${activeAssetKey}`)
    .then(r => r.json())
    .then(d => {
        if (d.success && d.history && d.history.length > 0) {
            raw5sBars = d.history.map(c => ({ ...c }));
            activeDecimals = d.meta.decimals;
            currentPayout = d.meta.payout1m;
            let lastP = raw5sBars[raw5sBars.length - 1].close;
            targetLivePrice = lastP;
            renderLivePrice = lastP;
            candles = resampleBars(raw5sBars, activeTfSeconds);
        }
    }).catch(() => {});

    fetch('/api/active-trades')
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            activeTrades = d.trades || [];
            updateTradeBadges();
            updateActiveTradesDrawerLive();
        }
    }).catch(() => {});
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fullSyncFromServer();
});
window.addEventListener('focus', fullSyncFromServer);

// টাচ স্ক্রোল
let startX = 0;
let isPanning = false;

if (canvas) {
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            isPanning = false;
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        } else if (e.touches.length === 1) {
            isPanning = true;
            startX = e.touches[0].clientX;
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            let currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            let factor = currentDist / initialPinchDistance;
            if (factor > 1.04 && candleWidth < 26) {
                candleWidth = Math.min(26, candleWidth + 0.3);
                candleSpacing = Math.min(10, candleSpacing + 0.15);
            } else if (factor < 0.96 && candleWidth > 8) {
                candleWidth = Math.max(8, candleWidth - 0.3);
                candleSpacing = Math.max(3, candleSpacing - 0.15);
            }
            initialPinchDistance = currentDist;
        } else if (e.touches.length === 1 && isPanning) {
            panOffset += (e.touches[0].clientX - startX) * 0.95;
            let maxPan = (candles.length * (candleWidth + candleSpacing)) - 80;
            panOffset = Math.max(-60, Math.min(maxPan, panOffset));
            startX = e.touches[0].clientX;
        }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
        isPanning = false;
        initialPinchDistance = null;
    });
}

function updateTradeBadges() {
    let count = activeTrades.length;
    let b1 = document.getElementById('openTradesBadge');
    if (b1) b1.innerText = count;
}

// ব্রিফকেস লাইভ ট্রেড ড্রয়ার
function openActiveTradesDrawer() {
    let m = document.getElementById('activeTradesModal');
    if (m) {
        m.style.display = 'flex';
        updateActiveTradesDrawerLive();
    }
}
function closeActiveTradesDrawer() {
    let m = document.getElementById('activeTradesModal');
    if (m) m.style.display = 'none';
}

function updateActiveTradesDrawerLive() {
    let countHeader = document.getElementById('activeTradesCountHeader');
    let container = document.getElementById('activeTradesLiveListContainer');
    if (!container) return;

    if (countHeader) countHeader.innerText = activeTrades.length;
    if (activeTrades.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:35px; color:#8fa0b5; font-size:13px;">No active trades running right now.</p>`;
        return;
    }

    let nowSec = Math.floor(Date.now() / 1000);
    let html = '';

    activeTrades.forEach(tr => {
        let diffSec = Math.max(0, tr.expireTime - nowSec);
        let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
        let remS = String(diffSec % 60).padStart(2, '0');

        let currentPrice = (tr.asset === activeAssetKey) ? renderLivePrice : (candles[candles.length - 1]?.close || tr.entryPrice);
        let isWinning = false;
        if (tr.direction === 'UP') isWinning = (currentPrice > tr.entryPrice);
        else if (tr.direction === 'DOWN') isWinning = (currentPrice < tr.entryPrice);

        let payoutPct = currentPayout || 90;
        let expectedProfit = (tr.amount * (payoutPct / 100)).toFixed(2);
        let assetName = allAssetsData[tr.asset]?.name || tr.asset;

        html += `
            <div class="active-trade-card">
                <div class="at-head">
                    <span class="at-asset">${assetName}</span>
                    <span class="at-badge ${tr.direction.toLowerCase()}">${tr.direction === 'UP' ? '▲ UP' : '▼ DOWN'}</span>
                </div>
                <div class="at-body-row">
                    <span>Invested: <b style="color:#fff;">$${parseFloat(tr.amount).toFixed(2)}</b></span>
                    <span>Entry: <b style="color:#fff;">${tr.entryPrice}</b></span>
                </div>
                <div class="at-body-row">
                    <span>Current: <b style="color:#fff;">${currentPrice.toFixed(activeDecimals)}</b></span>
                    <span class="at-timer-tag">⏳ ${remM}:${remS}</span>
                </div>
                <div class="at-profit-row">
                    <span>Status:</span>
                    <span class="at-status-live ${isWinning ? 'win' : 'loss'}">
                        ${isWinning ? `🟢 PROFIT: +$${expectedProfit} (+${payoutPct}%)` : `🔴 LOSS: -$${parseFloat(tr.amount).toFixed(2)}`}
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// অ্যাসেট মেনু ও ফেভারিট স্টার
function openAssetModal() {
    let m = document.getElementById('assetModal');
    if (m) {
        m.style.display = 'flex';
        loadOtcAssetsList();
    }
}
function closeAssetModal() {
    let m = document.getElementById('assetModal');
    if (m) m.style.display = 'none';
}

function loadOtcAssetsList() {
    fetch('/api/assets')
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            allAssetsData = d.assets;
            renderOtcAssetRows('');
        }
    });
}

function renderOtcAssetRows(searchFilter) {
    let container = document.getElementById('otcAssetListContainer');
    if (!container) return;

    let html = '';
    let keys = Object.keys(allAssetsData);

    keys.sort((a, b) => {
        let isFavA = favoriteAssets.includes(a);
        let isFavB = favoriteAssets.includes(b);
        return isFavB - isFavA;
    });

    keys.forEach(k => {
        let item = allAssetsData[k];
        if (searchFilter && !item.name.toLowerCase().includes(searchFilter.toLowerCase())) return;

        let isFav = favoriteAssets.includes(k);
        let isPos = (item.change24h >= 0);
        let changeStr = (isPos ? '+' : '') + item.change24h.toFixed(2) + '%';
        let flag1 = FLAG_ICONS[k]?.flag1 || '🌐';
        let flag2 = FLAG_ICONS[k]?.flag2 || '🇺🇸';

        html += `
            <div class="otc-asset-row" onclick="selectAsset('${k}')">
                <div class="otc-left-col">
                    <span class="star-fav-btn ${isFav ? '' : 'unfav'}" onclick="toggleFavoriteAsset(event, '${k}')">★</span>
                    <div class="flag-pair-wrap">
                        <span class="flag-circle flag-1">${flag1}</span>
                        <span class="flag-circle flag-2">${flag2}</span>
                    </div>
                    <div class="otc-title-box">
                        <span class="otc-pair-name">${item.name}</span>
                        <span class="otc-payout-subtitle">Profit 1+ min <b>${item.payout1m}%</b> &nbsp; 5+ min <b>${item.payout5m}%</b></span>
                    </div>
                </div>
                <div class="otc-right-col">
                    <div class="otc-change-pill ${isPos ? 'up' : 'down'}">
                        <span class="arrow-circle-trend ${isPos ? 'up' : 'down'}">${isPos ? '↑' : '↓'}</span>
                        <span>${changeStr}</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function filterOtcList(val) { renderOtcAssetRows(val); }

function toggleFavoriteAsset(e, key) {
    e.stopPropagation();
    if (favoriteAssets.includes(key)) {
        favoriteAssets = favoriteAssets.filter(item => item !== key);
    } else {
        favoriteAssets.push(key);
    }
    localStorage.setItem('fav_otc_assets', JSON.stringify(favoriteAssets));
    renderOtcAssetRows(document.getElementById('assetSearchInput')?.value || '');
}

function selectAsset(key) {
    activeAssetKey = key;
    let item = allAssetsData[key] || {};
    activeDecimals = item.decimals || 2;
    currentPayout = item.payout1m || 80;

    let cur = document.getElementById('curName');
    let pOut = document.getElementById('curPayout');
    if (cur) cur.innerText = item.name || key;
    if (pOut) pOut.innerText = `${currentPayout}% ▼`;

    closeAssetModal();
    updatePayoutCalc();
    fullSyncFromServer();
}

function stepAmt(delta) {
    currentInvestAmount = Math.max(1, currentInvestAmount + delta);
    let inp = document.getElementById('invAmtInput');
    if (inp) inp.value = currentInvestAmount;
    updatePayoutCalc();
}

function onInvestInput(val) {
    let num = Number(val);
    if (!isNaN(num) && num >= 1) {
        currentInvestAmount = num;
        updatePayoutCalc();
    }
}

function updatePayoutCalc() {
    let ratio = 1 + (currentPayout / 100);
    let total = (currentInvestAmount * ratio).toFixed(2);
    let el = document.getElementById('calcPayout');
    if (el) el.innerText = `${total} $`;
}

function toggleAccountModal() {
    let m = document.getElementById('accountModal');
    if (m) m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}
function closeAccountModal(e) {
    if (e.target.id === 'accountModal') document.getElementById('accountModal').style.display = 'none';
}

function switchAccount(type) {
    currentAccount = type;
    let modal = document.getElementById('accountModal');
    if (modal) modal.style.display = 'none';

    let lbl = document.getElementById('accountLabel');
    let watermark = document.getElementById('chartWatermark');
    let optLive = document.getElementById('optLiveCard');
    let optDemo = document.getElementById('optDemoCard');
    let radioLive = document.getElementById('radioLiveCircle');
    let radioDemo = document.getElementById('radioDemoCircle');

    if (type === 'live') {
        if (lbl) { lbl.innerText = "LIVE"; lbl.className = "acc-label live"; }
        updateBalanceUI(liveBalance);
        if (optLive) optLive.classList.add('active');
        if (optDemo) optDemo.classList.remove('active');
        if (radioLive) radioLive.classList.add('active');
        if (radioDemo) radioDemo.classList.remove('active');
        if (watermark) watermark.style.display = 'none';
    } else {
        if (lbl) { lbl.innerText = "DEMO"; lbl.className = "acc-label demo"; }
        updateBalanceUI(demoBalance);
        if (optDemo) optDemo.classList.add('active');
        if (optLive) optLive.classList.remove('active');
        if (radioDemo) radioDemo.classList.add('active');
        if (radioLive) radioLive.classList.remove('active');
        if (watermark) { watermark.style.display = 'block'; watermark.innerText = 'DEMO'; }
    }

    fetch('/api/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', type })
    }).catch(() => {});
}

function updateBalanceUI(val) {
    let num = Number(val) || 0;
    let str = "$" + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let b1 = document.getElementById('accountBal');
    if (b1) b1.innerText = str;
    if (currentAccount === 'live') {
        liveBalance = num;
        let lb = document.getElementById('modalLiveBal');
        if (lb) lb.innerText = str;
    } else {
        demoBalance = num;
        let db = document.getElementById('modalDemoBal');
        if (db) db.innerText = str;
    }
}

// ট্রেড প্লেস
function placeOrder(direction) {
    let amount = currentInvestAmount;
    let totalSec = (currentMode === 'timer') ? selectedTimerSeconds : 60;
    let last = candles[candles.length - 1];
    let curTime = last ? last.time : Math.floor(Date.now() / 1000);
    let curPrice = last ? last.close : renderLivePrice;

    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            amount,
            direction,
            accountType: currentAccount,
            durationSec: totalSec,
            asset: activeAssetKey,
            candleTime: curTime,
            clientEntryPrice: curPrice
        })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) return alert(data.message);

        updateBalanceUI(data.balance);
        activeTrades.push(data.trade);
        updateTradeBadges();
        updateActiveTradesDrawerLive();

        let toast = document.getElementById('tradeOpenToast');
        if (toast) {
            let msg = document.getElementById('toastMsg');
            let assetName = allAssetsData[activeAssetKey]?.name || activeAssetKey;
            if (msg) msg.innerText = `Trade opened: ${data.trade.entryPrice} on ${assetName}`;
            toast.style.display = 'flex';
            setTimeout(() => { toast.style.display = 'none'; }, 2500);
        }
    });
}

function showResultBubble(res) {
    updateBalanceUI(res.balance);
    let bubble = document.getElementById('resultBubble');
    let val = document.getElementById('resProfitVal');
    if (bubble && val) {
        bubble.className = res.isWin ? "result-popup-bubble" : "result-popup-bubble loss";
        val.innerText = res.isWin ? `+${res.profit} $` : `0.00 $`;
        bubble.style.display = 'block';
        bubble.style.top = '48%';
        bubble.style.left = '35%';
        setTimeout(() => { bubble.style.display = 'none'; }, 4500);
    }
}

// -------------------------------------------------------------
// ক্যানভাস রেন্ডার লুপ (টাইমফ্রেম-সচেতন ক্যান্ডেল ও কাউন্টডাউন)
// -------------------------------------------------------------
function render() {
    requestAnimationFrame(render);
    if (!canvas || !ctx) return;

    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;
    ctx.clearRect(0, 0, width, height);

    // লাইভ ইন্টারপোলেশন
    renderLivePrice += (targetLivePrice - renderLivePrice) * 0.18;
    if (candles.length > 0) {
        let last = candles[candles.length - 1];
        last.close = parseFloat(renderLivePrice.toFixed(activeDecimals));
        last.high = Math.max(last.high, last.close);
        last.low = Math.min(last.low, last.close);
    }

    let totalUnit = candleWidth + candleSpacing;
    let baseRightX = width - 85 + panOffset;
    let N = candles.length;

    function getX(i) {
        return baseRightX - ((N - 1 - i) * totalUnit);
    }

    let visibleCandles = [];
    for (let i = 0; i < N; i++) {
        let x = getX(i);
        if (x >= -40 && x <= width + 40) {
            visibleCandles.push({ ...candles[i], x, index: i });
        }
    }

    if (visibleCandles.length === 0) {
        visibleCandles = candles.map((c, i) => ({ ...c, x: getX(i), index: i }));
    }

    let prices = visibleCandles.flatMap(v => [v.high, v.low]);
    activeTrades.filter(t => t.asset === activeAssetKey).forEach(t => prices.push(t.entryPrice));

    let rawMinP = Math.min(...prices);
    let rawMaxP = Math.max(...prices);
    let rawRange = rawMaxP - rawMinP;

    let activeVol = (allAssetsData[activeAssetKey] ? (allAssetsData[activeAssetKey].vol * 0.8) : 0.0005);
    let pad = Math.max(rawRange * 0.18, activeVol);

    let minP = rawMinP - pad;
    let maxP = rawMaxP + pad;
    let range = (maxP - minP) || 0.0001;
    let padY = 32;

    function getY(p) {
        return height - padY - ((p - minP) / range) * (height - padY * 2);
    }

    // ব্যাকগ্রাউন্ড গ্রিড ও প্রাইস স্কেল
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7a8ba1';
    ctx.font = '11px -apple-system, sans-serif';

    for (let i = 1; i <= 6; i++) {
        let y = (height / 7) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width - 55, y);
        ctx.stroke();

        let pVal = maxP - ((y - padY) / (height - padY * 2)) * range;
        ctx.fillText(pVal.toFixed(activeDecimals), width - 50, y + 4);
    }

    // ক্যান্ডেলস্টিক রেন্ডার (ভিডিও ৯৬৮ ও কোটেক্স সাইজ)
    visibleCandles.forEach(c => {
        let isBull = c.close >= c.open;
        let color = isBull ? '#0faf59' : '#eb5757';

        let highY = getY(c.high);
        let lowY = getY(c.low);
        let openY = getY(c.open);
        let closeY = getY(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(Math.floor(c.x + candleWidth / 2) + 0.5, Math.floor(highY));
        ctx.lineTo(Math.floor(c.x + candleWidth / 2) + 0.5, Math.floor(lowY));
        ctx.stroke();

        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 1.5;
        ctx.fillRect(Math.floor(c.x), Math.floor(topY), Math.ceil(candleWidth), Math.ceil(h));
    });

    if (candles.length > 0) {
        let last = candles[candles.length - 1];
        let liveY = getY(last.close);

        // লাইভ প্রাইস ড্যাশ লাইন
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(0, liveY);
        ctx.lineTo(width - 55, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ডানের ব্লু প্রাইস ব্যাজ
        ctx.fillStyle = '#0070f3';
        ctx.beginPath();
        ctx.roundRect(width - 56, liveY - 10, 54, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(last.close.toFixed(activeDecimals), width - 51, liveY + 4);

        // ভার্টিক্যাল ড্যাশড এক্সপায়ারেশন লাইন
        let expX = baseRightX + (candleWidth + candleSpacing);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(expX, 0);
        ctx.lineTo(expX, height - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        // টাইমফ্রেম অনুযায়ী ডায়নামিক ক্যান্ডেল কাউন্টডাউন
        let nowSec = Math.floor(Date.now() / 1000);
        let remSec = activeTfSeconds - (nowSec % activeTfSeconds);
        let candleTimerStr = '';

        if (activeTfSeconds < 60) {
            candleTimerStr = `00:${String(remSec).padStart(2, '0')}`;
        } else if (activeTfSeconds < 3600) {
            let m = Math.floor(remSec / 60);
            let s = remSec % 60;
            candleTimerStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        } else {
            let h = Math.floor(remSec / 3600);
            let m = Math.floor((remSec % 3600) / 60);
            let s = remSec % 60;
            candleTimerStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        let pillW = 56;
        let pillH = 20;
        let pillX = expX + 6;
        let pillY = liveY - (pillH / 2);

        ctx.fillStyle = '#1c2638';
        ctx.strokeStyle = '#2d3e56';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(candleTimerStr, pillX + 8, pillY + 14);
    }

    // ট্রেড মার্কার
    activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
        let candle = candles.find(c => c.time === tr.candleTime);
        let cIdx = candle ? candles.indexOf(candle) : candles.findIndex(c => c.time <= tr.entryTime && tr.entryTime < c.time + activeTfSeconds);
        if (cIdx === -1) cIdx = candles.length - 1;

        let entryX = getX(cIdx);
        let entryY = getY(tr.entryPrice);
        let isUp = (tr.direction === 'UP');
        let tradeColor = isUp ? '#00e676' : '#eb5757';
        let expX = baseRightX + (candleWidth + candleSpacing);

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(expX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(isUp ? '↑' : '↓', entryX - 2.8, entryY + 3.2);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(entryX + 9, entryY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(expX, entryY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// WebSocket ইঞ্জিন
function connectWS() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onmessage = (event) => {
            let msg = JSON.parse(event.data);
            if (msg.type === 'TICK') {
                if (msg.assets[activeAssetKey]) {
                    let item = msg.assets[activeAssetKey];
                    targetLivePrice = parseFloat(item.price);

                    if (raw5sBars.length > 0 && item.candle5s) {
                        let last = raw5sBars[raw5sBars.length - 1];
                        if (last.time === item.candle5s.time) {
                            last.high = Math.max(last.high, item.candle5s.high);
                            last.low = Math.min(last.low, item.candle5s.low);
                            last.close = item.candle5s.close;
                        } else {
                            raw5sBars.push({ ...item.candle5s });
                            if (raw5sBars.length > 3500) raw5sBars.shift();
                        }
                        candles = resampleBars(raw5sBars, activeTfSeconds);
                    }
                }
            } else if (msg.type === 'TRADE_SETTLED') {
                activeTrades = activeTrades.filter(t => t.id !== msg.result.tradeId);
                updateTradeBadges();
                updateActiveTradesDrawerLive();
                showResultBubble(msg.result);
            }
        };

        ws.onclose = () => setTimeout(connectWS, 1500);
    } catch (e) {}
}
connectWS();

// বুটস্ট্র্যাপ
fitCanvas();
loadOtcAssetsList();
fullSyncFromServer();
requestAnimationFrame(render);
setTimeout(() => {
    let loader = document.getElementById('chartLoader');
    if (loader) loader.classList.remove('active');
}, 500);
