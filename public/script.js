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

let currentMode = 'time'; // 'time' অথবা 'timer'
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = ''; 
let targetExpiryEpoch = 0;

// রেটিনা স্ক্রিন শার্পনেস
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

// রিয়েল ঘড়ির সাথে অটো-সিঙ্ক ও কাউন্টডাউন ইঞ্জিন
function syncLiveClockAndExpiry() {
    let now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    let ss = String(now.getSeconds()).padStart(2, '0');

    // টপ লাইভ ঘড়ি (ফোনের ঘড়ির সাথে সেকেন্ডে সেকেন্ডে মিলবে)
    document.getElementById('liveUtcClock').innerText = `🟢 ${hh}:${mm}:${ss} UTC+6`;

    if (currentMode === 'time') {
        // যদি টার্গেট সময় পার হয়ে যায় বা সেট না থাকে, পরবর্তী মিনিট অটো সেট হবে
        if (!targetExpiryEpoch || targetExpiryEpoch <= now.getTime()) {
            let nextMin = new Date(now.getTime() + 60000);
            nextMin.setSeconds(0, 0);
            targetExpiryEpoch = nextMin.getTime();
            selectedTimeValue = `${String(nextMin.getHours()).padStart(2,'0')}:${String(nextMin.getMinutes()).padStart(2,'0')}`;
            document.getElementById('dockTimeValue').innerText = selectedTimeValue;
        }

        // End of trade এ কত মিনিট-সেকেন্ড বাকি তা লাইভ কাউন্টডাউন (ভিডিওর মতো MM:SS)
        let diffSec = Math.max(0, Math.floor((targetExpiryEpoch - now.getTime()) / 1000));
        let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
        let remS = String(diffSec % 60).padStart(2, '0');
        document.getElementById('endTradeSub').innerText = `${remM}:${remS}`;
    } else {
        // TIMER মোড
        let remM = String(Math.floor(remainingCountdown / 60)).padStart(2, '0');
        let remS = String(remainingCountdown % 60).padStart(2, '0');
        document.getElementById('endTradeSub').innerText = `${remM}:${remS}`;
    }
}
setInterval(syncLiveClockAndExpiry, 1000);
syncLiveClockAndExpiry();

// TIME মোডের ৩×৪ গ্রিড (বর্তমান লাইভ মিনিট থেকে ডায়নামিক ক্যালকুলেশন)
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
            syncLiveClockAndExpiry();
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
    syncLiveClockAndExpiry();
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
    document.getElementById('timeSelectPopup').style.display = 'none';
    syncLiveClockAndExpiry();
}

function resetPan() { panOffset = 0; drawChart(); }

// ক্যানভাস চার্ট ও টাইমলাইন
function drawChart() {
    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;

    ctx.clearRect(0, 0, width, height);

    let allCandles = [...candleHistory];
    if (liveCandle) allCandles.push(liveCandle);
    if (allCandles.length === 0) return;

    let candleWidth = 9;
    let candleSpacing = 5;
    let totalUnit = candleWidth + candleSpacing;

    let prices = allCandles.flatMap(c => [c.high, c.low]);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let range = (maxP - minP) || 0.040;
    let padY = 35;

    // হরিজন্টাল গ্রিড ও প্রাইস স্কেল
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

    let baseRightX = width - 85 + panOffset;

    // ক্যান্ডেল আঁকা
    allCandles.forEach((c, index) => {
        let x = baseRightX - ((allCandles.length - 1 - index) * totalUnit);
        if (x < -30 || x > width + 30) return;

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
        ctx.fillRect(Math.floor(x), Math.floor(topY), candleWidth, Math.ceil(h));
    });

    let curTime = new Date();
    let endTradeX = width - 110;

    // এক্সপায়ারেশন ড্যাশ লাইন (End of trade)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(endTradeX, 0);
    ctx.lineTo(endTradeX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // বর্তমান লাইভ ঘড়ি অনুযায়ী টাইমলাইনের লেবেল (নিচে)
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

    // লাইভ প্রাইজ ও কাউন্টডাউন ব্যাজ
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

        let secStr = remainingCountdown < 10 ? '0' + remainingCountdown : remainingCountdown;
        ctx.fillStyle = 'rgba(23, 29, 42, 0.85)';
        ctx.fillRect(endTradeX - 25, liveY - 9, 50, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`- 00:${secStr}`, endTradeX - 23, liveY + 4);
    }

    // ট্রেড মার্কার
    activeTrades.forEach(tr => {
        let entryY = height - padY - ((tr.price - minP) / range) * (height - padY * 2);

        ctx.strokeStyle = tr.direction === 'UP' ? '#0faf59' : '#eb5757';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, entryY);
        ctx.lineTo(width - 55, entryY);
        ctx.stroke();

        ctx.fillStyle = tr.direction === 'UP' ? '#0faf59' : '#eb5757';
        ctx.beginPath();
        ctx.arc(width - 130, entryY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(tr.direction === 'UP' ? '↑' : '↓', width - 133, entryY + 3);
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
        drawChart();
    }
};

function stepAmt(v) {
    let cur = Number(document.getElementById('invAmt').innerText);
    if (cur + v >= 1) {
        document.getElementById('invAmt').innerText = cur + v;
        document.getElementById('calcPayout').innerText = ((cur + v) * 1.88).toFixed(2) + " $";
    }
}

function placeOrder(direction) {
    let amount = Number(document.getElementById('invAmt').innerText);

    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            amount,
            direction,
            accountType: currentAccount
        })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            alert(data.message);
            return;
        }

        let tradeObj = { id: Date.now(), price: parseFloat(data.entryPrice), direction: data.direction, amount };
        activeTrades.push(tradeObj);

        document.getElementById('openTradesBadge').innerText = activeTrades.length;
        document.getElementById('drawerCount').innerText = activeTrades.length;

        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} AUD/JPY (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);

        updateTradesDrawer();
        drawChart();

        setTimeout(() => {
            activeTrades = activeTrades.filter(t => t.id !== tradeObj.id);
            document.getElementById('openTradesBadge').innerText = activeTrades.length;
            document.getElementById('drawerCount').innerText = activeTrades.length;
            updateBalanceUI(data.balance);

            if (data.isWin) {
                let bubble = document.getElementById('resultBubble');
                document.getElementById('resProfitVal').innerText = `+${data.profit} $`;
                bubble.style.display = 'block';
                bubble.style.top = '48%';
                bubble.style.left = '35%';
                setTimeout(() => { bubble.style.display = 'none'; }, 4000);
            }
            updateTradesDrawer();
            drawChart();
        }, 3000);
    });
}

function updateTradesDrawer() {
    let box = document.getElementById('activeTradesList');
    if (activeTrades.length === 0) {
        box.innerHTML = `<p style="padding:15px; color:#6e829c; font-size:12px; text-align:center;">No active trades</p>`;
        return;
    }
    let html = '';
    activeTrades.forEach(t => {
        html += `<div style="padding:10px; border-bottom:1px solid #283348; display:flex; justify-content:space-between;">
            <span>AUD/JPY (OTC) ${t.direction === 'UP' ? '🟢 UP' : '🔴 DOWN'}</span>
            <b>$${t.amount}</b>
        </div>`;
    });
    box.innerHTML = html;
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
        document.getElementById('radioLive').checked = true;
        watermark.innerText = "LIVE";
        updateBalanceUI(liveBalance);
    } else {
        lbl.innerText = "DEMO";
        lbl.className = "acc-label demo";
        icon.innerText = "🎓";
        document.getElementById('radioDemo').checked = true;
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
    document.getElementById('chartToolsSidebar').style.display = 'none';
}
function switchDrawerPage(page) {
    document.querySelectorAll('.drawer-page-body').forEach(el => el.style.display = 'none');
    let target = document.getElementById('page-' + page);
    if (target) target.style.display = 'block';
}

function toggleToolsMenu() {
    let el = document.getElementById('chartToolsSidebar');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}
function setTimeframe(tf) {
    document.querySelectorAll('.tf-grid button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    toggleToolsMenu();
}

function toggleBottomTrades() {
    let el = document.getElementById('bottomTradesDrawer');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function openAssetModal() { document.getElementById('assetModal').style.display = 'flex'; }
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }
function pickAsset(name, flag, payout) {
    document.getElementById('curName').innerText = name + ' ...';
    document.getElementById('curFlag').innerText = flag;
    document.getElementById('curPayout').innerText = payout + '% ▼';
    closeAssetModal();
}

function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }

setTimeout(fitCanvas, 200);
