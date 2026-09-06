const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11061.95;
let liveBalance = 10.00;
let panOffset = 0;
let remainingCountdown = 60;

let activeAssetKey = 'BTC';
let activeDecimals = 2;
let currentPayout = 92;
let isSwitchingAsset = false;

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

const ASSET_DECIMALS = {
    'BTC': 2, 'ETH': 2, 'SOL': 2, 'BNB': 2,
    'XRP': 4, 'DOGE': 4, 'TON': 3, 'ADA': 4
};

const COIN_ICONS = {
    'BTC': '<span class="c-logo btc-logo" style="width:20px;height:20px;font-size:11px;">₿</span>',
    'ETH': '<span class="c-logo eth-logo" style="width:20px;height:20px;font-size:11px;">Ξ</span>',
    'SOL': '<span class="c-logo sol-logo" style="width:20px;height:20px;font-size:11px;">◎</span>',
    'BNB': '<span class="c-logo bnb-logo" style="width:20px;height:20px;font-size:11px;">◆</span>',
    'XRP': '<span class="c-logo xrp-logo" style="width:20px;height:20px;font-size:11px;">✕</span>',
    'DOGE': '<span class="c-logo doge-logo" style="width:20px;height:20px;font-size:11px;">Ð</span>',
    'TON': '<span class="c-logo ton-logo" style="width:20px;height:20px;font-size:10px;">💎</span>',
    'ADA': '<span class="c-logo ada-logo" style="width:20px;height:20px;font-size:11px;">₳</span>'
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
    drawChart();
}
window.addEventListener('resize', fitCanvas);

// ব্যাকগ্রাউন্ড থেকে ফিরলে স্মুথ সিঙ্ক
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        selectAsset(activeAssetKey);
    }
});

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
        drawChart();
    } else if (e.touches.length === 1 && isPanning) {
        panOffset += (e.touches[0].clientX - startX) * 0.95;
        let maxPan = (candles.length * (candleWidth + candleSpacing)) - 80;
        panOffset = Math.max(-60, Math.min(maxPan, panOffset));
        startX = e.touches[0].clientX;
        drawChart();
    }
}, { passive: true });

canvas.addEventListener('touchend', () => {
    isPanning = false;
    initialPinchDistance = null;
});

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
    if (e.target.id === 'accountModal') {
        document.getElementById('accountModal').style.display = 'none';
    }
}

function switchAccount(type) {
    currentAccount = type;
    document.getElementById('accountModal').style.display = 'none';

    let lbl = document.getElementById('accountLabel');
    let icon = document.getElementById('accountIcon');
    let watermark = document.getElementById('chartWatermark');

    let optLive = document.getElementById('optLiveCard');
    let optDemo = document.getElementById('optDemoCard');
    let radioLive = document.getElementById('radioLiveCircle');
    let radioDemo = document.getElementById('radioDemoCircle');

    if (type === 'live') {
        lbl.innerText = "LIVE";
        lbl.className = "acc-label live";
        icon.innerText = "✈️";
        updateBalanceUI(liveBalance);

        optLive.classList.add('active');
        optDemo.classList.remove('active');
        radioLive.classList.add('active');
        radioDemo.classList.remove('active');

        watermark.style.display = 'none';
        watermark.innerText = '';
    } else {
        lbl.innerText = "DEMO";
        lbl.className = "acc-label demo";
        icon.innerText = "🎓";
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

    if (!amount || !trx) {
        alert("পরিমাণ এবং Transaction ID লিখুন!");
        return;
    }

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
    document.getElementById('liveUtcClock').innerText = `🟢 ${hh}:${mm}:${ss} UTC+6`;

    let curSec = Math.floor(now.getTime() / 1000);
    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (curSec >= trade.expireTime) {
            settleTrade(trade);
            activeTrades.splice(i, 1);
        }
    }
    drawChart();
}
setInterval(syncClock, 1000);

function settleTrade(trade) {
    let exitP = candles.length > 0 ? candles[candles.length - 1].close : trade.entryPrice;
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
        drawChart();
    });
}

// কয়েন সিলেক্ট করার সময় ডেটা রেস-কন্ডিশন ফিক্স
function selectAsset(key) {
    isSwitchingAsset = true;
    activeAssetKey = key;
    activeDecimals = ASSET_DECIMALS[key] || 2;
    document.getElementById('activeCoinIcon').innerHTML = COIN_ICONS[key];
    document.getElementById('curName').innerText = `${key}/USD (OTC)`;

    fetch(`/api/history/${key}`)
    .then(r => r.json())
    .then(data => {
        if (data.success && data.meta.ticker === activeAssetKey) {
            candles = data.history;
            activeDecimals = data.meta.decimals;
            currentPayout = data.meta.payout;
            document.getElementById('curPayout').innerText = `${currentPayout}% ▼`;
            updatePayoutCalc();
            closeAssetModal();
            isSwitchingAsset = false;
            drawChart();
        }
    });
}

function drawChart() {
    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (candles.length === 0 || isSwitchingAsset) return;

    let totalUnit = candleWidth + candleSpacing;
    let baseRightX = width - 80 + panOffset;
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

    // ক্যান্ডেলস্টিক রেন্ডার (কোনো স্পাইক ছাড়া স্মুথ সংযোগ)
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

    // লাইভ ড্যাশ লাইন
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, liveY);
    ctx.lineTo(width - 55, liveY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#0070f3';
    ctx.beginPath();
    ctx.roundRect(width - 56, liveY - 10, 54, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(last.close.toFixed(activeDecimals), width - 51, liveY + 4);

    // এক্সপায়ারেশন ড্যাশ লাইন
    let expX = baseRightX + (candleWidth + candleSpacing);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(expX, 0);
    ctx.lineTo(expX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    let cdM = Math.floor(remainingCountdown / 60);
    let cdS = remainingCountdown % 60;
    let cdStr = `${String(cdM).padStart(2,'0')}:${String(cdS).padStart(2,'0')}`;

    ctx.fillStyle = 'rgba(23, 29, 42, 0.85)';
    ctx.fillRect(expX - 25, liveY - 9, 50, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`- ${cdStr}`, expX - 23, liveY + 4);

    // Quotex স্টাইল ট্রেড লাইন ও অ্যারো
    activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
        let entryX = getX(tr.startCandleIdx);
        let entryY = getY(tr.entryPrice);
        let isUp = (tr.direction === 'UP');
        let tradeColor = isUp ? '#00e676' : '#ff334b';

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(expX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        let arrowLen = 18;
        let targetArrowY = isUp ? (entryY - arrowLen) : (entryY + arrowLen);

        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(entryX, targetArrowY);
        ctx.stroke();

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        if (isUp) {
            ctx.moveTo(entryX - 5, entryY - arrowLen + 6);
            ctx.lineTo(entryX, entryY - arrowLen);
            ctx.lineTo(entryX + 5, entryY - arrowLen + 6);
        } else {
            ctx.moveTo(entryX - 5, entryY + arrowLen - 6);
            ctx.lineTo(entryX, entryY + arrowLen);
            ctx.lineTo(entryX + 5, entryY + arrowLen - 6);
        }
        ctx.fill();

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(isUp ? '▲' : '▼', entryX - 3.5, entryY + 3);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.roundRect(expX - 2, entryY - 9, 44, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`$${tr.amount}`, expX + 3, entryY + 4);
    });
}

// WebSocket কানেকশন (কয়েন মিসম্যাচ গার্ড সহ)
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onmessage = (event) => {
    let msg = JSON.parse(event.data);
    if (msg.type === 'TICK') {
        remainingCountdown = msg.countdown;

        for (let k in msg.assets) {
            let el = document.getElementById(`price-tag-${k}`);
            if (el) el.innerText = msg.assets[k].price;
        }

        if (!isSwitchingAsset && msg.assets[activeAssetKey]) {
            let item = msg.assets[activeAssetKey];
            if (candles.length > 0) {
                let last = candles[candles.length - 1];
                if (last.time === item.candle.time) {
                    candles[candles.length - 1] = item.candle;
                } else {
                    candles.push(item.candle);
                    if (candles.length > 1000) candles.shift();
                }
            }
        }
        drawChart();
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

        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened: $${amount} on ${activeAssetKey}`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);

        drawChart();
    });
}

function resetPan() { panOffset = 0; drawChart(); }
function openAssetModal() { document.getElementById('assetModal').style.display = 'flex'; }
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }
function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }

function openDrawer(page) { document.getElementById('globalDrawer').style.display = 'flex'; }
function closeAllDrawers() { document.getElementById('globalDrawer').style.display = 'none'; }
function toggleToolsMenu() {}

selectAsset('BTC');
switchAccount('demo');
setTimeout(fitCanvas, 200);
