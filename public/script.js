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
let currentPayout = 84;

// জুম ভেরিয়েবল
let candleWidth = 9;
let candleSpacing = 5;
let initialPinchDistance = null;

let currentMode = 'timer';
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';
let targetExpiryEpoch = 0;
let activeSellTrade = null;

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

// টাচ ও ২ আঙুলে পিঞ্চ জুম
let startX = 0;
let isPanning = false;

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    } else if (e.touches.length === 1) {
        isPanning = true;
        startX = e.touches[0].clientX;
        checkTradeClick(e.touches[0].clientX, e.touches[0].clientY);
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
        let currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        let factor = currentDist / initialPinchDistance;
        if (factor > 1.04 && candleWidth < 22) {
            candleWidth = Math.min(22, candleWidth + 0.35);
            candleSpacing = Math.min(10, candleSpacing + 0.15);
        } else if (factor < 0.96 && candleWidth > 4) {
            candleWidth = Math.max(4, candleWidth - 0.35);
            candleSpacing = Math.max(2, candleSpacing - 0.15);
        }
        initialPinchDistance = currentDist;
        drawChart();
    } else if (e.touches.length === 1 && isPanning) {
        panOffset += (e.touches[0].clientX - startX) * 0.9;
        // প্যান বাউন্ডারি (যাতে ক্যান্ডেল উধাও হয়ে খালি স্ক্রিন না হয়)
        let maxPan = (candleHistory.length * (candleWidth + candleSpacing)) - 100;
        panOffset = Math.max(-50, Math.min(maxPan, panOffset));
        startX = e.touches[0].clientX;
        drawChart();
    }
});

canvas.addEventListener('touchend', () => {
    isPanning = false;
    initialPinchDistance = null;
});

function checkTradeClick(touchX, touchY) {
    const rect = canvas.getBoundingClientRect();
    let x = touchX - rect.left;
    let y = touchY - rect.top;

    if (activeTrades.length > 0) {
        activeSellTrade = activeTrades[0];
        let card = document.getElementById('sellTradeCard');
        card.style.display = 'flex';
        card.style.left = Math.min(x, rect.width - 150) + 'px';
        card.style.top = Math.max(20, y - 40) + 'px';
        document.getElementById('sellRefundVal').innerText = `${(activeSellTrade.amount * 0.25).toFixed(2)} $`;
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
        drawChart();
    });
}

// ঘড়ি ও ট্রেড এক্সপায়ারেশন চেক লুপ
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
        let diffSec = Math.max(0, Math.floor((targetExpiryEpoch - now.getTime()) / 1000));
        let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
        let remS = String(diffSec % 60).padStart(2, '0');
        document.getElementById('sellTimeRem').innerText = `${remM}:${remS}`;
    } else {
        if (activeTrades.length > 0) {
            let earliestExp = Math.min(...activeTrades.map(t => t.expireAt));
            let diffSec = Math.max(0, Math.floor((earliestExp - now.getTime()) / 1000));
            let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
            let remS = String(diffSec % 60).padStart(2, '0');
            document.getElementById('sellTimeRem').innerText = `${remM}:${remS}`;
        }
    }

    // নির্দিষ্ট সময়ের পর ট্রেড সেটেল
    let curTime = now.getTime();
    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (curTime >= trade.expireAt) {
            settleTradeExpiration(trade);
            activeTrades.splice(i, 1);
        }
    }
}
setInterval(syncClockAndTrades, 1000);
syncClockAndTrades();

function settleTradeExpiration(trade) {
    document.getElementById('sellTradeCard').style.display = 'none';

    fetch('/api/settle-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            isWin: trade.isWin,
            profit: trade.profit,
            accountType: currentAccount
        })
    })
    .then(r => r.json())
    .then(data => {
        updateBalanceUI(data.balance);

        let bubble = document.getElementById('resultBubble');
        if (trade.isWin) {
            bubble.className = "result-popup-bubble";
            document.getElementById('resProfitVal').innerText = `+${trade.profit} $`;
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

// ক্যানভাস চার্ট - শুধুমাত্র দৃশ্যমান (Visible) ক্যান্ডেল স্কেলিং
function drawChart() {
    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;

    ctx.clearRect(0, 0, width, height);

    let allCandles = [...candleHistory];
    if (liveCandle) allCandles.push(liveCandle);
    if (allCandles.length === 0) return;

    let totalUnit = candleWidth + candleSpacing;
    let baseRightX = width - 85 + panOffset;

    // ১. শুধুমাত্র স্ক্রিনে দৃশ্যমান ক্যান্ডেলগুলো আলাদা করা
    let visibleCandles = [];
    allCandles.forEach((c, index) => {
        let x = baseRightX - ((allCandles.length - 1 - index) * totalUnit);
        if (x >= -40 && x <= width + 40) {
            visibleCandles.push({ candle: c, x: x });
        }
    });

    if (visibleCandles.length === 0) visibleCandles = allCandles.map((c, i) => ({ candle: c, x: baseRightX - ((allCandles.length - 1 - i) * totalUnit) }));

    // ২. শুধুমাত্র দৃশ্যমান ক্যান্ডেল দিয়ে Min/Max ক্যালকুলেশন (ক্যান্ডেল চ্যাপ্টা হবে না)
    let prices = visibleCandles.flatMap(v => [v.candle.high, v.candle.low]);
    activeTrades.forEach(t => prices.push(t.price));

    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let range = (maxP - minP) || 0.040;
    let padY = 35;

    // অনুভূমিক গ্রিড ও প্রাইস স্কেল
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
        ctx.fillText(pVal.toFixed(3), width - 50, y + 4);
    }

    // ক্যান্ডেল আঁকা
    visibleCandles.forEach(v => {
        let c = v.candle;
        let x = v.x;
        let isBull = c.close >= c.open;
        let color = isBull ? '#0faf59' : '#eb5757';

        let highY = height - padY - ((c.high - minP) / range) * (height - padY * 2);
        let lowY = height - padY - ((c.low - minP) / range) * (height - padY * 2);
        let openY = height - padY - ((c.open - minP) / range) * (height - padY * 2);
        let closeY = height - padY - ((c.close - minP) / range) * (height - padY * 2);

        // উইক
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.floor(x + candleWidth / 2) + 0.5, Math.floor(highY));
        ctx.lineTo(Math.floor(x + candleWidth / 2) + 0.5, Math.floor(lowY));
        ctx.stroke();

        // বডি
        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 1.5;
        ctx.fillRect(Math.floor(x), Math.floor(topY), Math.ceil(candleWidth), Math.ceil(h));
    });

    let curTime = new Date();
    let endTradeX = width - 110;

    // এক্সপায়ারেশন ড্যাশ লাইন
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(endTradeX, 0);
    ctx.lineTo(endTradeX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // বটম টাইমলাইন
    ctx.fillStyle = '#6e829c';
    ctx.font = '10px sans-serif';
    for (let step = 0; step < 4; step++) {
        let pastDate = new Date(curTime.getTime() - (step * 8 * 60000));
        let xPos = baseRightX - (step * 8 * totalUnit);
        if (xPos > 20 && xPos < width - 60) {
            let labelStr = `${String(pastDate.getHours()).padStart(2,'0')}:${String(pastDate.getMinutes()).padStart(2,'0')}`;
            ctx.fillText(labelStr, Math.floor(xPos - 12), height - 6);
        }
    }

    // লাইভ প্রাইজ ও কাউন্টডাউন ব্যাজ (00:60 বাগ ফিক্স করা হয়েছে)
    if (liveCandle) {
        let liveY = height - padY - ((liveCandle.close - minP) / range) * (height - padY * 2);

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
        ctx.fillText(liveCandle.close.toFixed(3), width - 51, liveY + 4);

        // সঠিক সময় ফরম্যাট (৬০ হলে ০১:০০ দেখাবে, কখনোই ০০:৬০ নয়)
        let cdM = Math.floor(remainingCountdown / 60);
        let cdS = remainingCountdown % 60;
        let countdownStr = `${String(cdM).padStart(2,'0')}:${String(cdS).padStart(2,'0')}`;

        ctx.fillStyle = 'rgba(23, 29, 42, 0.85)';
        ctx.fillRect(endTradeX - 25, liveY - 9, 50, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`- ${countdownStr}`, endTradeX - 23, liveY + 4);
    }

    // সক্রিয় ট্রেড মার্কার
    activeTrades.forEach(tr => {
        let entryY = height - padY - ((tr.price - minP) / range) * (height - padY * 2);
        let tradeColor = tr.direction === 'UP' ? '#00b074' : '#eb5757';

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tr.startX || (width - 150), entryY);
        ctx.lineTo(endTradeX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(tr.startX || (width - 150), entryY, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(tr.direction === 'UP' ? '↑' : '↓', (tr.startX || (width - 150)) - 3, entryY + 3);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(endTradeX, entryY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onmessage = (event) => {
    let msg = JSON.parse(event.data);
    if (msg.type === 'TICK') {
        liveCandle = msg.candle;
        candleHistory = msg.history;
        remainingCountdown = msg.countdown;
        if (msg.payout && msg.payout !== currentPayout) {
            currentPayout = msg.payout;
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

// ট্রেড প্লেস
function placeOrder(direction) {
    let amount = Number(document.getElementById('invAmt').innerText);

    let totalSec = 60;
    let expireEpoch = 0;

    if (currentMode === 'timer') {
        totalSec = selectedTimerSeconds;
        expireEpoch = Date.now() + (totalSec * 1000);
    } else {
        if (targetExpiryEpoch && targetExpiryEpoch > Date.now()) {
            expireEpoch = targetExpiryEpoch;
            totalSec = Math.floor((targetExpiryEpoch - Date.now()) / 1000);
        } else {
            totalSec = 60;
            expireEpoch = Date.now() + 60000;
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
            durationSec: totalSec
        })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            alert(data.message);
            return;
        }

        updateBalanceUI(data.balance);

        const width = parseFloat(canvas.style.width) || canvas.width;
        let entryX = width - 120 + panOffset;

        let tradeObj = {
            id: Date.now(),
            price: parseFloat(data.entryPrice),
            direction: data.direction,
            amount: amount,
            isWin: data.isWin,
            profit: data.profit,
            expireAt: expireEpoch,
            startX: entryX
        };
        activeTrades.push(tradeObj);

        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} AUD/JPY (OTC)`;
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
    let watermark = document.getElementById('chartWatermark');

    if (type === 'live') {
        lbl.innerText = "LIVE";
        lbl.className = "acc-label live";
        icon.innerText = "✈️";
        watermark.innerText = "LIVE";
        updateBalanceUI(liveBalance);
    } else {
        lbl.innerText = "DEMO";
        lbl.className = "acc-label demo";
        icon.innerText = "🎓";
        watermark.innerText = "DEMO";
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
    document.getElementById('sellTradeCard').style.display = 'none';
}
function switchDrawerPage(page) {
    document.querySelectorAll('.drawer-page-body').forEach(el => el.style.display = 'none');
    let target = document.getElementById('page-' + page);
    if (target) target.style.display = 'block';
}

function toggleToolsMenu() {
    // টুলস মেনু টগল
}

function openAssetModal() { document.getElementById('assetModal').style.display = 'flex'; }
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }
function pickAsset(name, flag, payout) {
    document.getElementById('curName').innerText = name + ' ...';
    document.getElementById('curFlag').innerText = flag;
    currentPayout = payout;
    document.getElementById('curPayout').innerText = payout + '% ▼';
    updatePayoutDisplay();
    closeAssetModal();
}

function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }

setTimeout(fitCanvas, 200);
