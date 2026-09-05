const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candleHistory = [];
let liveCandle = null;
let activeTrades = [];
let currentAccount = 'live';
let demoBalance = 11061.07;
let liveBalance = 0.03;
let panOffset = 0;
let remainingCountdown = 60;

// মোড ও টাইমিং ভেরিয়েবল
let currentMode = 'timer'; // ডিফল্ট টাইমার
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';
let selectedTargetEpoch = 0;

// রেটিনা স্ক্রিন স্কেলিং
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

// লাইভ ঘড়ি ও "End of trade" প্রতি সেকেন্ডে আপডেট (মোবাইলের ঘড়ির সাথে ১০০% সিঙ্ক)
function updateClockAndExpiry() {
    let now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    let ss = String(now.getSeconds()).padStart(2, '0');

    // টপ UTC+6 ঘড়ি (মোবাইলের স্ট্যাটাস বারের সাথে মিলবে)
    document.getElementById('liveUtcClock').innerText = `🟢 ${hh}:${mm}:${ss} UTC+6`;

    // End of trade ডায়নামিক ক্যালকুলেশন (কখনোই ভুল বা পুরোনো সময় দেখাবে না)
    if (currentMode === 'timer') {
        let endD = new Date(now.getTime() + selectedTimerSeconds * 1000);
        let eh = String(endD.getHours()).padStart(2, '0');
        let em = String(endD.getMinutes()).padStart(2, '0');
        let es = String(endD.getSeconds()).padStart(2, '0');
        document.getElementById('endTradeSub').innerText = `${eh}:${em}:${es}`;
    } else {
        document.getElementById('endTradeSub').innerText = `${selectedTimeValue}:00`;
    }
}
setInterval(updateClockAndExpiry, 1000);
updateClockAndExpiry();

// TIME মোডের গ্রিড জেনারেশন (বর্তমান রিয়েল মিনিট অনুযায়ী)
function renderTimeModeGrid() {
    let container = document.getElementById('gridTimeMode');
    container.innerHTML = '';

    let now = new Date();
    let offsets = [1, 2, 3, 4, 5, 10, 15, 30, 45, 60, 120, 240];

    offsets.forEach((offset, idx) => {
        let t = new Date(now.getTime() + offset * 60000);
        let hh = String(t.getHours()).padStart(2, '0');
        let mm = String(t.getMinutes()).padStart(2, '0');
        let timeStr = `${hh}:${mm}`;

        if (idx === 0 && !selectedTimeValue) selectedTimeValue = timeStr;

        let btn = document.createElement('button');
        btn.innerText = timeStr;
        if (timeStr === selectedTimeValue) btn.classList.add('selected');

        btn.onclick = () => {
            selectTime(timeStr, t.getTime());
        };
        container.appendChild(btn);
    });
}

function switchPopupTab(tab) {
    currentMode = tab;
    let timerBtn = document.getElementById('tabTimerBtn');
    let timeBtn = document.getElementById('tabTimeBtn');
    let gridTimer = document.getElementById('gridTimerMode');
    let gridTime = document.getElementById('gridTimeMode');

    if (tab === 'time') {
        timeBtn.classList.add('active');
        timerBtn.classList.remove('active');
        gridTime.style.display = 'grid';
        gridTimer.style.display = 'none';
        renderTimeModeGrid();

        document.getElementById('dockTimeLabel').innerText = 'Time';
        document.getElementById('dockTimeValue').innerText = selectedTimeValue;
    } else {
        timerBtn.classList.add('active');
        timeBtn.classList.remove('active');
        gridTimer.style.display = 'grid';
        gridTime.style.display = 'none';

        document.getElementById('dockTimeLabel').innerText = 'Timer';
        document.getElementById('dockTimeValue').innerText = selectedTimerDisplay;
    }
    updateClockAndExpiry();
}

function toggleTimePopup() {
    let p = document.getElementById('timeSelectPopup');
    let willOpen = p.style.display !== 'block';
    p.style.display = willOpen ? 'block' : 'none';
    if (willOpen && currentMode === 'time') renderTimeModeGrid();
}

function selectTime(val, epoch) {
    selectedTimeValue = val;
    selectedTargetEpoch = epoch;
    document.getElementById('dockTimeValue').innerText = val;
    document.getElementById('timeSelectPopup').style.display = 'none';
    updateClockAndExpiry();
}

function selectTimer(sec, display) {
    selectedTimerSeconds = sec;
    selectedTimerDisplay = display;
    document.getElementById('dockTimeValue').innerText = display;
    document.querySelectorAll('#gridTimerMode button').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    document.getElementById('timeSelectPopup').style.display = 'none';
    updateClockAndExpiry();
}

function resetPan() { panOffset = 0; drawChart(); }

// মূল ক্যানভাস চার্ট ও সম্পূর্ণ ডায়নামিক টাইমলাইন
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

    // অনুভূমিক মূল্য গ্রিড
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

    // ক্যান্ডেল আঁকা এবং ১০০% রিয়েল ডায়নামিক বটম টাইমলাইন
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

        // প্রতি ৮ ক্যান্ডেল পর পর আসল ক্যান্ডেলের টাইমস্ট্যাম্প অনুযায়ী নিচের টাইমলাইন আঁকা
        if (index % 8 === 0) {
            let cDate = new Date(c.time * 1000);
            let ch = String(cDate.getHours()).padStart(2, '0');
            let cm = String(cDate.getMinutes()).padStart(2, '0');
            let timeStr = `${ch}:${cm}`;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.beginPath();
            ctx.moveTo(Math.floor(x + candleWidth / 2) + 0.5, 0);
            ctx.lineTo(Math.floor(x + candleWidth / 2) + 0.5, height - 20);
            ctx.stroke();

            ctx.fillStyle = '#6e829c';
            ctx.font = '10px sans-serif';
            ctx.fillText(timeStr, Math.floor(x - 6), height - 6);
        }
    });

    // এক্সপায়ারেশন ড্যাশ লাইন (End of trade)
    let endTradeX = width - 110;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(endTradeX, 0);
    ctx.lineTo(endTradeX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // লাইভ প্রাইজ ও কাউন্টডাউন
    if (liveCandle) {
        let liveY = height - padY - ((liveCandle.close - minP) / range) * (height - padY * 2);

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, liveY);
        ctx.lineTo(width - 55, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // লাইভ নীল প্রাইজ পিল
        ctx.fillStyle = '#0070f3';
        ctx.beginPath();
        ctx.roundRect(width - 56, liveY - 10, 54, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(liveCandle.close.toFixed(3), width - 51, liveY + 4);

        // লাইভ কাউন্টডাউন ব্যাজ (যেমন: - 00:11)
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

        let tradeObj = { id: Date.now(), price: parseFloat(data.entryPrice), direction: data.direction };
        activeTrades.push(tradeObj);

        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} AUD/JPY (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3500);

        drawChart();

        setTimeout(() => {
            activeTrades = activeTrades.filter(t => t.id !== tradeObj.id);
            updateBalanceUI(data.balance);

            if (data.isWin) {
                let bubble = document.getElementById('resultBubble');
                document.getElementById('resProfitVal').innerText = `+${data.profit} $`;
                bubble.style.display = 'block';
                bubble.style.top = '48%';
                bubble.style.left = '35%';
                setTimeout(() => { bubble.style.display = 'none'; }, 4000);
            }
            drawChart();
        }, 3000);
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

function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function submitDeposit() {
    let method = document.getElementById('depMethod').value;
    let amount = document.getElementById('depAmount').value;
    let trxId = document.getElementById('depTrx').value;
    fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', method, amount, trxId })
    }).then(r => r.json()).then(d => {
        alert(d.message);
        closeModal('depModal');
    });
}

setTimeout(fitCanvas, 200);
