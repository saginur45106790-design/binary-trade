const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11072.87;
let liveBalance = 10.00;
let panOffset = 0;
let remainingCountdown = 60;

let activeAssetKey = 'BTC';
let activeDecimals = 2;
let currentPayout = 92;
let isLoadingAsset = false;

// স্মুথ লার্প ইন্টারপোলেশন
let renderLivePrice = 68520.50;
let targetLivePrice = 68520.50;

let candleWidth = 9;
let candleSpacing = 4;
let initialPinchDistance = null;

let currentMode = 'timer';
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';
let targetExpiryEpoch = 0;

let currentInvestAmount = 1;
let selectedDepMethod = 'Bkash';
let activeSellTrade = null;

const ASSET_DECIMALS = {
    'BTC': 2, 'ETH': 2, 'SOL': 2, 'BNB': 2,
    'XRP': 4, 'DOGE': 4, 'TON': 3, 'ADA': 4
};

const COIN_ICONS = {
    'BTC': '<span class="c-logo btc-logo" style="width:20px;height:20px;font-size:11px;">B</span>',
    'ETH': '<span class="c-logo eth-logo" style="width:20px;height:20px;font-size:11px;">E</span>',
    'SOL': '<span class="c-logo sol-logo" style="width:20px;height:20px;font-size:11px;">S</span>',
    'BNB': '<span class="c-logo bnb-logo" style="width:20px;height:20px;font-size:11px;">B</span>',
    'XRP': '<span class="c-logo xrp-logo" style="width:20px;height:20px;font-size:11px;">X</span>',
    'DOGE': '<span class="c-logo doge-logo" style="width:20px;height:20px;font-size:11px;">D</span>',
    'TON': '<span class="c-logo ton-logo" style="width:20px;height:20px;font-size:10px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M12 2L3 9l9 13 9-13-9-7z"/></svg></span>',
    'ADA': '<span class="c-logo ada-logo" style="width:20px;height:20px;font-size:11px;">A</span>'
};

function fitCanvas() {
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

function showChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) el.classList.add('active');
}
function hideChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) setTimeout(() => { el.classList.remove('active'); }, 300);
}

// টাচ স্ক্রোল ও পিঞ্চ জুম
let startX = 0;
let isPanning = false;

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
        checkTradeClick(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
        let currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        let factor = currentDist / initialPinchDistance;
        if (factor > 1.04 && candleWidth < 22) {
            candleWidth = Math.min(22, candleWidth + 0.3);
            candleSpacing = Math.min(10, candleSpacing + 0.15);
        } else if (factor < 0.96 && candleWidth > 4) {
            candleWidth = Math.max(4, candleWidth - 0.3);
            candleSpacing = Math.max(2, candleSpacing - 0.15);
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

function checkTradeClick(touchX, touchY) {
    const rect = canvas.getBoundingClientRect();
    let x = touchX - rect.left;
    let y = touchY - rect.top;

    let match = activeTrades.find(t => t.asset === activeAssetKey);
    if (match) {
        activeSellTrade = match;
        let card = document.getElementById('sellTradeCard');
        card.style.display = 'flex';
        card.style.left = Math.min(x, rect.width - 150) + 'px';
        card.style.top = Math.max(20, y - 45) + 'px';
        document.getElementById('sellRefundVal').innerText = `${(match.amount * 0.25).toFixed(2)} $`;
    }
}

function confirmSellTrade() {
    if (!activeSellTrade) return;
    fetch('/api/sell-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            amount: activeSellTrade.amount,
            accountType: currentAccount
        })
    })
    .then(r => r.json())
    .then(d => {
        activeTrades = activeTrades.filter(t => t.id !== activeSellTrade.id);
        updateBalanceUI(d.balance);
        document.getElementById('sellTradeCard').style.display = 'none';
        updateTradeBadges();
    });
}

function updateTradeBadges() {
    let count = activeTrades.length;
    document.getElementById('openTradesBadge').innerText = count;
    document.getElementById('drawerCount').innerText = count;
    updateTradesDrawerList();
}

function updateTradesDrawerList() {
    let box = document.getElementById('activeTradesList');
    if (activeTrades.length === 0) {
        box.innerHTML = `<p style="padding:15px; color:#6e829c; font-size:12px; text-align:center;">No active trades</p>`;
        return;
    }
    let html = '';
    activeTrades.forEach(t => {
        html += `<div style="padding:10px 14px; border-bottom:1px solid #283348; display:flex; justify-content:space-between; align-items:center;">
            <span>${t.asset} ${t.direction === 'UP' ? '🟢 UP' : '🔴 DOWN'}</span>
            <b>$${t.amount}</b>
        </div>`;
    });
    box.innerHTML = html;
}

function toggleBottomTrades() {
    let el = document.getElementById('bottomTradesDrawer');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function stepAmt(delta) {
    currentInvestAmount = Math.max(1, currentInvestAmount + delta);
    document.getElementById('invAmtInput').value = currentInvestAmount;
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
    document.getElementById('calcPayout').innerText = `${total} $`;
}

function toggleAccountModal() {
    let m = document.getElementById('accountModal');
    m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}
function closeAccountModal(e) {
    if (e.target.id === 'accountModal') document.getElementById('accountModal').style.display = 'none';
}

function switchAccount(type) {
    currentAccount = type;
    document.getElementById('accountModal').style.display = 'none';

    let lbl = document.getElementById('accountLabel');
    let iconWrap = document.getElementById('accountIcon');
    let watermark = document.getElementById('chartWatermark');

    let optLive = document.getElementById('optLiveCard');
    let optDemo = document.getElementById('optDemoCard');
    let radioLive = document.getElementById('radioLiveCircle');
    let radioDemo = document.getElementById('radioDemoCircle');

    if (type === 'live') {
        lbl.innerText = "LIVE";
        lbl.className = "acc-label live";
        iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#00b074"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
        updateBalanceUI(liveBalance);

        optLive.classList.add('active');
        optDemo.classList.remove('active');
        radioLive.classList.add('active');
        radioDemo.classList.remove('active');

        watermark.style.display = 'none';
    } else {
        lbl.innerText = "DEMO";
        lbl.className = "acc-label demo";
        iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#f5a623"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`;
        updateBalanceUI(demoBalance);

        optDemo.classList.add('active');
        optLive.classList.remove('active');
        radioDemo.classList.add('active');
        radioLive.classList.remove('active');

        watermark.style.display = 'block';
        watermark.innerText = 'DEMO';
    }

    fetch('/api/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', type })
    });
}

function resetDemoBalance(event) {
    event.stopPropagation();
    fetch('/api/reset-demo', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            demoBalance = Number(d.balance);
            updateBalanceUI(demoBalance);
        }
    });
}

function updateBalanceUI(val) {
    let num = Number(val) || 0;
    let str = "$" + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('accountBal').innerText = str;
    if (currentAccount === 'live') {
        liveBalance = num;
        document.getElementById('modalLiveBal').innerText = str;
    } else {
        demoBalance = num;
        document.getElementById('modalDemoBal').innerText = str;
    }
}

function openDepositModal() { document.getElementById('depositModal').style.display = 'flex'; }
function closeDepositModal() { document.getElementById('depositModal').style.display = 'none'; }

function setDepMethod(method, number, note) {
    selectedDepMethod = method;
    document.querySelectorAll('.dep-pill').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('depMethodLabel').innerText = `${method} ${note}:`;
    document.getElementById('depTargetNumber').innerText = number;
}

function submitDepositForm() {
    let amount = document.getElementById('depAmountInput').value;
    let sender = document.getElementById('depSenderInput').value;
    let trx = document.getElementById('depTrxInput').value;

    if (!amount || !trx) return alert("Please enter amount and TrxID!");

    fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            method: selectedDepMethod,
            amount,
            senderNumber: sender,
            trxId: trx
        })
    })
    .then(r => r.json())
    .then(d => {
        alert(d.message);
        if (d.success) {
            document.getElementById('depAmountInput').value = '';
            document.getElementById('depSenderInput').value = '';
            document.getElementById('depTrxInput').value = '';
            closeDepositModal();
        }
    });
}

function toggleTimePopup() {
    let p = document.getElementById('timeSelectPopup');
    let willOpen = (p.style.display !== 'block');
    p.style.display = willOpen ? 'block' : 'none';
    if (willOpen && currentMode === 'time') renderTimeModeGrid();
}

function switchPopupTab(tab) {
    currentMode = tab;
    if (tab === 'time') {
        document.getElementById('tabTimeBtn').classList.add('active');
        document.getElementById('tabTimerBtn').classList.remove('active');
        document.getElementById('gridTimeMode').style.display = 'grid';
        document.getElementById('gridTimerMode').style.display = 'none';
        renderTimeModeGrid();
        document.getElementById('dockTimeLabel').innerText = 'Time';
        document.getElementById('dockTimeValue').innerText = selectedTimeValue || '00:01';
    } else {
        document.getElementById('tabTimerBtn').classList.add('active');
        document.getElementById('tabTimeBtn').classList.remove('active');
        document.getElementById('gridTimerMode').style.display = 'grid';
        document.getElementById('gridTimeMode').style.display = 'none';
        document.getElementById('dockTimeLabel').innerText = 'Timer';
        document.getElementById('dockTimeValue').innerText = selectedTimerDisplay;
    }
}

function selectTimer(sec, display) {
    selectedTimerSeconds = sec;
    selectedTimerDisplay = display;
    document.getElementById('dockTimeValue').innerText = display;
    document.querySelectorAll('#gridTimerMode button').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    document.getElementById('timeSelectPopup').style.display = 'none';
}

function renderTimeModeGrid() {
    let container = document.getElementById('gridTimeMode');
    container.innerHTML = '';
    let now = new Date();
    let offsets = [1, 2, 3, 4, 5, 10, 15, 30, 45, 60, 120, 240];

    offsets.forEach((offset) => {
        let t = new Date(now.getTime() + offset * 60000);
        let timeStr = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
        let btn = document.createElement('button');
        btn.innerText = timeStr;
        if (timeStr === selectedTimeValue) btn.classList.add('selected');
        btn.onclick = () => {
            selectedTimeValue = timeStr;
            let targetD = new Date(t);
            targetD.setSeconds(0, 0);
            targetExpiryEpoch = targetD.getTime();
            document.getElementById('dockTimeValue').innerText = timeStr;
            toggleTimePopup();
        };
        container.appendChild(btn);
    });
}

function syncClock() {
    let now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    let ss = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('liveUtcClock').innerHTML = `<span class="live-dot"></span> ${hh}:${mm}:${ss} UTC+6`;

    // ১ মিনিটের ক্যান্ডেল টাইমার হিসেব (ঘড়ির কাঁটা অনুযায়ী প্রতি সেকেন্ডে কমবে)
    let sec = Math.floor(now.getTime() / 1000);
    remainingCountdown = 60 - (sec % 60);

    // End of trade টেক্সট
    if (currentMode === 'time' && selectedTimeValue) {
        document.getElementById('endTradeTimeText').innerText = selectedTimeValue;
    } else {
        let expDate = new Date(now.getTime() + selectedTimerSeconds * 1000);
        document.getElementById('endTradeTimeText').innerText = `${String(expDate.getHours()).padStart(2,'0')}:${String(expDate.getMinutes()).padStart(2,'0')}`;
    }

    // ট্রেড এক্সপায়ারি চেক
    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (sec >= trade.expireTime) {
            settleTrade(trade);
            activeTrades.splice(i, 1);
            updateTradeBadges();
        }
    }

    if (activeSellTrade) {
        let diffSec = Math.max(0, activeSellTrade.expireTime - sec);
        let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
        let remS = String(diffSec % 60).padStart(2, '0');
        document.getElementById('sellTimeRem').innerText = `${remM}:${remS}`;
    }
}
setInterval(syncClock, 1000);

function settleTrade(trade) {
    let exitP = candles.length > 0 ? candles[candles.length - 1].close : trade.entryPrice;
    document.getElementById('sellTradeCard').style.display = 'none';

    fetch('/api/settle-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            entryPrice: trade.entryPrice,
            exitPrice: exitP,
            direction: trade.direction,
            amount: trade.amount,
            accountType: currentAccount,
            asset: trade.asset
        })
    })
    .then(r => r.json())
    .then(data => {
        updateBalanceUI(data.balance);
        let bubble = document.getElementById('resultBubble');
        bubble.className = data.isWin ? "result-popup-bubble" : "result-popup-bubble loss";
        document.getElementById('resProfitVal').innerText = data.isWin ? `+${data.profit} $` : `0.00 $`;
        bubble.style.display = 'block';
        bubble.style.top = '48%';
        bubble.style.left = '35%';
        setTimeout(() => { bubble.style.display = 'none'; }, 4000);
    });
}

// কয়েন স্যুইচিং
function selectAsset(key) {
    if (activeAssetKey === key && candles.length > 0) {
        closeAssetModal();
        return;
    }
    isLoadingAsset = true;
    candles = [];
    showChartLoader();
    closeAssetModal();

    activeAssetKey = key;
    activeDecimals = ASSET_DECIMALS[key] || 2;
    document.getElementById('activeCoinIcon').innerHTML = COIN_ICONS[key] || '';
    document.getElementById('curName').innerText = `${key}/USD (OTC)`;

    fetch(`/api/history/${key}`)
    .then(r => r.json())
    .then(data => {
        if (data.success && data.meta.ticker === activeAssetKey) {
            candles = data.history.map(c => ({...c}));
            activeDecimals = data.meta.decimals;
            currentPayout = data.meta.payout;
            document.getElementById('curPayout').innerText = `${currentPayout}% ▼`;
            updatePayoutCalc();

            let lastP = candles[candles.length - 1].close;
            targetLivePrice = lastP;
            renderLivePrice = lastP;
            isLoadingAsset = false;
            hideChartLoader();
        }
    }).catch(() => {
        isLoadingAsset = false;
        hideChartLoader();
    });
}

// -------------------------------------------------------------
// ক্যানভাস রেন্ডার লুপ (১ মিনিটের ক্যান্ডেল কাউন্টডাউন ও নো-টাইম ট্রেড মার্কার)
// -------------------------------------------------------------
function render() {
    requestAnimationFrame(render);

    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (candles.length === 0 || isLoadingAsset) return;

    // মসৃণ লার্প ইন্টারপোলেশন
    renderLivePrice += (targetLivePrice - renderLivePrice) * 0.18;
    candles[candles.length - 1].close = parseFloat(renderLivePrice.toFixed(activeDecimals));

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

    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let range = (maxP - minP) || (0.001 * Math.pow(10, 4 - activeDecimals));
    let padY = 35;

    function getY(p) {
        return height - padY - ((p - minP) / range) * (height - padY * 2);
    }

    // অনুভূমিক গ্রিড
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

    // ক্যান্ডেল আঁকা
    visibleCandles.forEach(c => {
        let isBull = c.close >= c.open;
        let color = isBull ? '#0faf59' : '#eb5757';

        let highY = getY(c.high);
        let lowY = getY(c.low);
        let openY = getY(c.open);
        let closeY = getY(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.floor(c.x + candleWidth / 2) + 0.5, Math.floor(highY));
        ctx.lineTo(Math.floor(c.x + candleWidth / 2) + 0.5, Math.floor(lowY));
        ctx.stroke();

        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 1.5;
        ctx.fillRect(Math.floor(c.x), Math.floor(topY), Math.ceil(candleWidth), Math.ceil(h));
    });

    let last = candles[candles.length - 1];
    let liveY = getY(last.close);

    // অনুভূমিক সাদা ড্যাশ লাইন
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, liveY);
    ctx.lineTo(width - 55, liveY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ডানপাশের নীল সলিড প্রাইস ব্যাজ
    ctx.fillStyle = '#0070f3';
    ctx.beginPath();
    ctx.roundRect(width - 56, liveY - 10, 54, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(last.close.toFixed(activeDecimals), width - 51, liveY + 4);

    // উলম্ব এক্সপায়ারেশন ড্যাশ লাইন (End of trade)
    let expX = baseRightX + (candleWidth + candleSpacing);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(expX, 0);
    ctx.lineTo(expX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // -------------------------------------------------------------
    // ১ মিনিট ক্যান্ডেল টাইম (ট্রেড নিলেও কখনোই আটকাবে না)
    // -------------------------------------------------------------
    let cdS = remainingCountdown % 60;
    let candleTimerStr = (remainingCountdown === 60) ? '01:00' : `00:${String(cdS).padStart(2, '0')}`;

    // সাইড টাইম পিল
    let pillW = 54;
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
    ctx.fillText(candleTimerStr, pillX + 10, pillY + 14);

    // বটম টাইম স্কেল
    ctx.fillStyle = '#6e829c';
    ctx.font = '10px sans-serif';
    visibleCandles.forEach(v => {
        if (v.index % 8 === 0) {
            let d = new Date(v.time * 1000);
            let lbl = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            ctx.fillText(lbl, Math.floor(v.x - 12), height - 6);
        }
    });

    // -------------------------------------------------------------
    // ট্রেডার রা ট্রেড নিলে শুধু আইকন দেখা যাবে (কোনো টাইম কাউন্ট/কাউন্টার থাকবে না)
    // -------------------------------------------------------------
    activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
        let entryX = getX(tr.startCandleIdx);
        let entryY = getY(tr.entryPrice);
        let isUp = (tr.direction === 'UP');
        let tradeColor = isUp ? '#00e676' : '#eb5757';

        // অনুভূমিক ড্যাশ লাইন
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(expX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ক্যান্ডেলের এন্ট্রি পয়েন্টে সলিড সার্কেল + অ্যারো আইকন
        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(isUp ? '↑' : '↓', entryX - 2.8, entryY + 3.2);

        // শেষ প্রান্তে ছোট এক্সপায়ারেশন ডট (কোনো টাইম টেক্সট নেই)
        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(expX, entryY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// WebSocket কানেকশন
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onmessage = (event) => {
    let msg = JSON.parse(event.data);
    if (msg.type === 'TICK') {
        for (let k in msg.assets) {
            let el = document.getElementById(`price-tag-${k}`);
            if (el) el.innerText = msg.assets[k].price;
        }

        if (!isLoadingAsset && candles.length > 0 && msg.assets[activeAssetKey]) {
            let item = msg.assets[activeAssetKey];
            targetLivePrice = parseFloat(item.price);

            let last = candles[candles.length - 1];
            if (last.time === item.candle.time) {
                last.high = Math.max(last.high, item.candle.high);
                last.low = Math.min(last.low, item.candle.low);
            } else {
                candles.push({ ...item.candle });
                if (candles.length > 800) candles.shift();
            }
        }
    }
};

function placeOrder(direction) {
    let amount = currentInvestAmount;
    let nowSec = Math.floor(Date.now() / 1000);
    let totalSec = (currentMode === 'timer') ? selectedTimerSeconds : 60;

    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            amount,
            direction,
            accountType: currentAccount,
            durationSec: totalSec,
            asset: activeAssetKey
        })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) return alert(data.message);

        updateBalanceUI(data.balance);

        activeTrades.push({
            id: Date.now(),
            entryPrice: parseFloat(data.entryPrice),
            entryTime: nowSec,
            expireTime: nowSec + totalSec,
            direction: data.direction,
            amount,
            asset: activeAssetKey,
            startCandleIdx: candles.length - 1
        });

        updateTradeBadges();

        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} ${activeAssetKey}/USD (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    });
}

function resetPan() { panOffset = 0; }
function openAssetModal() { document.getElementById('assetModal').style.display = 'flex'; }
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }
function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }
function closeAllDrawers() {
    document.getElementById('bottomTradesDrawer').style.display = 'none';
    document.getElementById('sellTradeCard').style.display = 'none';
}
function toggleToolsMenu() {}

// ইনিশিয়ালাইজেশন
fitCanvas();
selectAsset('BTC');
switchAccount('demo');
requestAnimationFrame(render);

// -------------------------------------------------------------
// 🏆 ট্রফি আইকন: ২৪ ঘণ্টার বোনাস ও অফার হ্যান্ডলার
// -------------------------------------------------------------
let loadedBonuses = [];

function openTournamentsBonusModal() {
    document.getElementById('bonusTournamentsModal').style.display = 'flex';
    fetchBonuses();
}

function closeTournamentsBonusModal() {
    document.getElementById('bonusTournamentsModal').style.display = 'none';
}

function fetchBonuses() {
    fetch('/api/bonuses')
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            loadedBonuses = d.bonuses || [];
            updateTrophyBadge();
            renderBonusCards();
        }
    });
}

function updateTrophyBadge() {
    let uncalimedCount = loadedBonuses.filter(b => !b.claimedBy || !b.claimedBy.includes("demo_user")).length;
    let badge = document.getElementById('trophyBadge');
    if (badge) {
        badge.innerText = uncalimedCount;
        badge.style.display = uncalimedCount > 0 ? 'flex' : 'none';
    }
}

function renderBonusCards() {
    let container = document.getElementById('activeBonusCardsContainer');
    if (!container) return;

    if (loadedBonuses.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#6e829c; font-size:13px;">No active 24h bonus right now. Check back soon!</div>`;
        return;
    }

    let now = Date.now();
    let html = '';

    loadedBonuses.forEach(b => {
        let msLeft = Math.max(0, (24 * 60 * 60 * 1000) - (now - b.createdAt));
        let hrs = Math.floor(msLeft / (1000 * 60 * 60));
        let mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));

        let isClaimed = (b.claimedBy && b.claimedBy.includes("demo_user"));

        html += `
            <div class="bonus-offer-card">
                <div class="b-card-top">
                    <div>
                        <span class="b-type-pill">${b.type}</span>
                        <div class="b-title">${b.title}</div>
                    </div>
                    <div class="b-reward">+$${parseFloat(b.amount).toFixed(2)}</div>
                </div>
                <div class="b-desc">${b.description}</div>
                <div class="b-card-bottom">
                    <div class="b-timer-tag">⏳ ${hrs}h ${mins}m left</div>
                    <button class="btn-claim-bonus ${isClaimed ? 'claimed' : ''}" 
                            onclick="${isClaimed ? '' : `claimBonusReward('${b.id}')`}">
                        ${isClaimed ? 'Claimed ✔' : 'Join & Claim'}
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function claimBonusReward(bonusId) {
    fetch('/api/bonuses/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            bonusId: bonusId,
            username: "demo_user",
            accountType: currentAccount
        })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            updateBalanceUI(d.newBalance);
            let toast = document.getElementById('tradeOpenToast');
            document.getElementById('toastMsg').innerText = d.message;
            toast.style.display = 'flex';
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
            fetchBonuses();
        } else {
            alert(d.message);
        }
    });
}

// প্রতি ২ মিনিটে ব্যাকগ্রাউন্ডে বোনাস রিফ্রেশ
setInterval(fetchBonuses, 120000);
fetchBonuses();
