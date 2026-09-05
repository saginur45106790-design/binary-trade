const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candleHistory = [];
let liveCandle = null;
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11061.95;
let liveBalance = 0.03;
let panOffset = 0;
let remainingCountdown = 60;

// বর্তমান সিলেক্টেড কয়েন (ডিফল্ট BTC)
let activeAssetKey = 'BTC';
let activeDecimals = 2;
let currentPayout = 92;

// কয়েন আইকন ম্যাপিং
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

// পিঞ্চ জুম
let candleWidth = 9;
let candleSpacing = 5;
let initialPinchDistance = null;

let currentMode = 'timer';
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';
let targetExpiryEpoch = 0;

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

// নিরাপদে টাচ ড্র্যাগ ও জুম
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
            candleWidth = Math.min(22, candleWidth + 0.4);
            candleSpacing = Math.min(10, candleSpacing + 0.18);
        } else if (factor < 0.96 && candleWidth > 4) {
            candleWidth = Math.max(4, candleWidth - 0.4);
            candleSpacing = Math.max(2, candleSpacing - 0.18);
        }
        initialPinchDistance = currentDist;
        drawChart();
    } else if (e.touches.length === 1 && isPanning) {
        panOffset += (e.touches[0].clientX - startX) * 0.95;
        let maxPan = (candleHistory.length * (candleWidth + candleSpacing)) - 100;
        panOffset = Math.max(-100, Math.min(maxPan, panOffset));
        startX = e.touches[0].clientX;
        drawChart();
    }
}, { passive: true });

canvas.addEventListener('touchend', () => {
    isPanning = false;
    initialPinchDistance = null;
});

// লাইভ ক্লক ও ট্রেড এক্সপায়ারেশন চেক
function syncClockAndTrades() {
    let now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    let ss = String(now.getSeconds()).padStart(2, '0');

    document.getElementById('liveUtcClock').innerText = `🟢 ${hh}:${mm}:${ss} UTC+6`;

    if (currentMode === 'time') {
        if (!targetExpiryEpoch || targetExpiryEpoch <= now.getTime()) {
            let nextMin = new Date(now.getTime() + 60000);
            nextMin.setSeconds(0, 0);
            targetExpiryEpoch = nextMin.getTime();
            selectedTimeValue = `${String(nextMin.getHours()).padStart(2,'0')}:${String(nextMin.getMinutes()).padStart(2,'0')}`;
            document.getElementById('dockTimeValue').innerText = selectedTimeValue;
            renderTimeModeGrid();
        }
    }

    let curSec = Math.floor(now.getTime() / 1000);
    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (curSec >= trade.expireTime) {
            settleTradeExpiration(trade);
            activeTrades.splice(i, 1);
        }
    }
    drawChart();
}
setInterval(syncClockAndTrades, 1000);
syncClockAndTrades();

function settleTradeExpiration(trade) {
    let exitP = (trade.asset === activeAssetKey && liveCandle) 
        ? liveCandle.close 
        : parseFloat(trade.entryPrice);

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
        if (data.isWin) {
            bubble.className = "result-popup-bubble";
            document.getElementById('resProfitVal').innerText = `+${data.profit} $`;
        } else {
            bubble.className = "result-popup-bubble loss";
            document.getElementById('resProfitVal').innerText = `0.00 $`;
        }
        bubble.style.display = 'block';
        bubble.style.top = '48%';
        bubble.style.left = '35%';
        setTimeout(() => { bubble.style.display = 'none'; }, 4000);

        drawChart();
    });
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
            syncClockAndTrades();
        };
        container.appendChild(btn);
    });
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
        document.getElementById('dockTimeValue').innerText = selectedTimeValue;
    } else {
        document.getElementById('tabTimerBtn').classList.add('active');
        document.getElementById('tabTimeBtn').classList.remove('active');
        document.getElementById('gridTimerMode').style.display = 'grid';
        document.getElementById('gridTimeMode').style.display = 'none';
        document.getElementById('dockTimeLabel').innerText = 'Timer';
        document.getElementById('dockTimeValue').innerText = selectedTimerDisplay;
    }
    syncClockAndTrades();
}

function toggleTimePopup() {
    let p = document.getElementById('timeSelectPopup');
    let willOpen = p.style.display !== 'block';
    p.style.display = willOpen ? 'block' : 'none';
    if (willOpen && currentMode === 'time') renderTimeModeGrid();
}

function selectTimer(sec, display) {
    selectedTimerSeconds = sec;
    selectedTimerDisplay = display;
    document.getElementById('dockTimeValue').innerText = display;
    document.querySelectorAll('#gridTimerMode button').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    document.getElementById('timeSelectPopup').style.display = 'none';
    syncClockAndTrades();
}

function resetPan() { panOffset = 0; drawChart(); }

// ৮টি কয়েনের যেকোনো একটি বেছে নেওয়া
function selectAsset(key) {
    activeAssetKey = key;
    document.getElementById('chartWatermark').innerText = key;
    document.getElementById('activeCoinIcon').innerHTML = COIN_ICONS[key];
    document.getElementById('curName').innerText = `${key}/USD (OTC)`;

    fetch(`/api/history/${key}`)
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            candleHistory = data.history;
            liveCandle = data.candle;
            activeDecimals = data.meta.decimals;
            currentPayout = data.meta.payout;
            document.getElementById('curPayout').innerText = `${currentPayout}% ▼`;
            updatePayoutDisplay();
            closeAssetModal();
            drawChart();
        }
    });
}

// চার্ট ড্রয়িং ইঞ্জিন
function drawChart() {
    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;

    ctx.clearRect(0, 0, width, height);

    let allCandles = [...candleHistory];
    if (liveCandle) allCandles.push(liveCandle);
    if (allCandles.length === 0) return;

    let totalUnit = candleWidth + candleSpacing;
    let baseRightX = width - 95 + panOffset;
    let latestCandleTime = allCandles[allCandles.length - 1].time;

    function getXForTime(sec) {
        let offsetCandles = (sec - latestCandleTime) / 60;
        return baseRightX + (offsetCandles * totalUnit);
    }

    let visibleCandles = [];
    allCandles.forEach((c) => {
        let x = getXForTime(c.time);
        if (x >= -40 && x <= width + 40) {
            visibleCandles.push({ candle: c, x: x });
        }
    });

    if (visibleCandles.length === 0) visibleCandles = allCandles.map(c => ({ candle: c, x: getXForTime(c.time) }));

    let prices = visibleCandles.flatMap(v => [v.candle.high, v.candle.low]);
    activeTrades.filter(t => t.asset === activeAssetKey).forEach(t => prices.push(t.entryPrice));

    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let range = (maxP - minP) || (0.0001 * Math.pow(10, 4 - activeDecimals));
    let padY = 35;

    function getY(price) {
        return height - padY - ((price - minP) / range) * (height - padY * 2);
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
    visibleCandles.forEach(v => {
        let c = v.candle;
        let x = v.x;
        let isBull = c.close >= c.open;
        let color = isBull ? '#0faf59' : '#eb5757';

        let highY = getY(c.high);
        let lowY = getY(c.low);
        let openY = getY(c.open);
        let closeY = getY(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.floor(x + candleWidth / 2) + 0.5, Math.floor(highY));
        ctx.lineTo(Math.floor(x + candleWidth / 2) + 0.5, Math.floor(lowY));
        ctx.stroke();

        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 1.5;
        ctx.fillRect(Math.floor(x), Math.floor(topY), Math.ceil(candleWidth), Math.ceil(h));
    });

    // বটম টাইমলাইন
    ctx.fillStyle = '#6e829c';
    ctx.font = '10px sans-serif';
    allCandles.forEach((c, idx) => {
        if (idx % 8 === 0) {
            let x = getXForTime(c.time);
            if (x > 10 && x < width - 60) {
                let d = new Date(c.time * 1000);
                let lbl = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                ctx.fillText(lbl, Math.floor(x - 12), height - 6);
            }
        }
    });

    // লাইভ প্রাইজ লাইন
    if (liveCandle) {
        let liveY = getY(liveCandle.close);

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
        ctx.fillText(liveCandle.close.toFixed(activeDecimals), width - 51, liveY + 4);
    }

    let nowSec = Math.floor(Date.now() / 1000);

    // সক্রিয় ট্রেড না থাকলে ডিফল্ট এক্সপায়ারেশন উল্লম্ব লাইন
    let thisAssetTrades = activeTrades.filter(t => t.asset === activeAssetKey);
    if (thisAssetTrades.length === 0) {
        let nextExpirySec = (currentMode === 'time' && targetExpiryEpoch) 
            ? Math.floor(targetExpiryEpoch / 1000) 
            : (latestCandleTime + selectedTimerSeconds);
        let expX = getXForTime(nextExpirySec);

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(expX, 0);
        ctx.lineTo(expX, height - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        if (liveCandle) {
            let liveY = getY(liveCandle.close);
            let cdM = Math.floor(remainingCountdown / 60);
            let cdS = remainingCountdown % 60;
            let cdStr = `${String(cdM).padStart(2,'0')}:${String(cdS).padStart(2,'0')}`;

            ctx.fillStyle = 'rgba(23, 29, 42, 0.85)';
            ctx.fillRect(expX - 25, liveY - 9, 50, 18);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`- ${cdStr}`, expX - 23, liveY + 4);
        }
    }

    // কয়েন স্পেসিফিক সক্রিয় ট্রেড মার্কার
    thisAssetTrades.forEach(tr => {
        let entryX = getXForTime(tr.entryTime);
        let expiryX = getXForTime(tr.expireTime);
        let entryY = getY(tr.entryPrice);
        let tradeColor = tr.direction === 'UP' ? '#00b074' : '#eb5757';

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(expiryX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(expiryX, 0);
        ctx.lineTo(expiryX, height - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(tr.direction === 'UP' ? '↑' : '↓', entryX - 3, entryY + 3);

        let diffSec = Math.max(0, tr.expireTime - nowSec);
        let remM = Math.floor(diffSec / 60);
        let remS = diffSec % 60;
        let remStr = `${String(remM).padStart(2,'0')}:${String(remS).padStart(2,'0')}`;

        ctx.fillStyle = 'rgba(23, 29, 42, 0.9)';
        ctx.fillRect(expiryX - 25, entryY - 9, 50, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`- ${remStr}`, expiryX - 23, entryY + 4);
    });
}

// WebSocket কানেকশন
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onmessage = (event) => {
    let msg = JSON.parse(event.data);
    if (msg.type === 'TICK') {
        remainingCountdown = msg.countdown;

        // মডালের কয়েনগুলোর লাইভ প্রাইজ আপডেট
        for (let k in msg.assets) {
            let el = document.getElementById(`price-tag-${k}`);
            if (el) el.innerText = msg.assets[k].price;
        }

        // বর্তমান ওপেন থাকা চার্টের কয়েন আপডেট
        if (msg.assets[activeAssetKey]) {
            let cur = msg.assets[activeAssetKey];
            liveCandle = cur.candle;
            currentPayout = cur.payout;
            document.getElementById('curPayout').innerText = `${currentPayout}% ▼`;
            updatePayoutDisplay();
        }

        drawChart();
    }
};

function updatePayoutDisplay() {
    let cur = Number(document.getElementById('invAmt').innerText);
    let ratio = 1 + (currentPayout / 100);
    document.getElementById('calcPayout').innerText = (cur * ratio).toFixed(2) + " $";
}

function stepAmt(v) {
    let cur = Number(document.getElementById('invAmt').innerText);
    if (cur + v >= 1) {
        document.getElementById('invAmt').innerText = cur + v;
        updatePayoutDisplay();
    }
}

// ট্রেড নেওয়ার ফাংশন
function placeOrder(direction) {
    let amount = Number(document.getElementById('invAmt').innerText);
    let nowSec = Math.floor(Date.now() / 1000);
    let totalSec = 60;

    if (currentMode === 'timer') {
        totalSec = selectedTimerSeconds;
    } else {
        if (targetExpiryEpoch && targetExpiryEpoch > Date.now()) {
            totalSec = Math.floor((targetExpiryEpoch - Date.now()) / 1000);
        } else {
            totalSec = 60;
        }
    }

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
        if (!data.success) {
            alert(data.message);
            return;
        }

        updateBalanceUI(data.balance);

        let tradeObj = {
            id: Date.now(),
            entryPrice: parseFloat(data.entryPrice),
            entryTime: nowSec,
            expireTime: nowSec + totalSec,
            direction: data.direction,
            amount: amount,
            asset: activeAssetKey
        };
        activeTrades.push(tradeObj);

        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} ${activeAssetKey}/USD (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);

        drawChart();
    });
}

function updateBalanceUI(val) {
    let str = "$" + Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById('accountBal').innerText = str;
    if (currentAccount === 'live') {
        liveBalance = Number(val);
        document.getElementById('modalLiveBal').innerText = str;
    } else {
        demoBalance = Number(val);
        document.getElementById('modalDemoBal').innerText = str + " 🔄";
    }
}

function toggleAccountModal() {
    let m = document.getElementById('accountModal');
    m.style.display = m.style.display === 'block' ? 'none' : 'block';
}
function closeAccountModal(e) {
    if (e.target.id === 'accountModal') e.target.style.display = 'none';
}
function switchAccount(type) {
    currentAccount = type;
    document.getElementById('accountModal').style.display = 'none';
    let lbl = document.getElementById('accountLabel');
    let icon = document.getElementById('accountIcon');

    if (type === 'live') {
        lbl.innerText = "LIVE";
        lbl.className = "acc-label live";
        icon.innerText = "✈️";
        updateBalanceUI(liveBalance);
    } else {
        lbl.innerText = "DEMO";
        lbl.className = "acc-label demo";
        icon.innerText = "🎓";
        updateBalanceUI(demoBalance);
    }
}

function openDrawer(pageName) {
    document.getElementById('globalDrawer').style.display = 'flex';
    document.getElementById('drawerPageSelect').value = pageName === 'menu' ? 'profile' : pageName;
    switchDrawerPage(document.getElementById('drawerPageSelect').value);
}
function closeAllDrawers() {
    document.getElementById('globalDrawer').style.display = 'none';
}
function switchDrawerPage(page) {
    document.querySelectorAll('.drawer-page-body').forEach(el => el.style.display = 'none');
    let target = document.getElementById('page-' + page);
    if (target) target.style.display = 'block';
}

function toggleToolsMenu() {}
function openAssetModal() { document.getElementById('assetModal').style.display = 'flex'; }
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }
function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }

// ইনিশিয়াল লোড
selectAsset('BTC');
setTimeout(fitCanvas, 200);
