const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candleHistory = [];
let liveCandle = null;
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11061.07;
let liveBalance = 0.03;
let panOffset = 0;
let remainingCountdown = 60;
let isDragging = false;
let startX = 0;

// রেটিনা ও হাই-রেজোলিউশন শার্পনেস ফিক্স (ঝাপসা দূর করার মূল লজিক)
function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    ctx.setTransform(1, 0, 0, 1, 0, 0); // রিসেট
    ctx.scale(dpr, dpr);
    drawChart();
}
window.addEventListener('resize', fitCanvas);

// টাচ প্যান ও ড্র্যাগ
canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
});
canvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    let currentX = e.touches[0].clientX;
    panOffset += (currentX - startX) * 0.9;
    startX = currentX;
    drawChart();
});
canvas.addEventListener('touchend', () => { isDragging = false; });

canvas.addEventListener('mousedown', (e) => { isDragging = true; startX = e.clientX; });
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panOffset += (e.clientX - startX) * 0.9;
    startX = e.clientX;
    drawChart();
});
window.addEventListener('mouseup', () => { isDragging = false; });

function resetPan() {
    panOffset = 0;
    drawChart();
}

// চার্ট রেন্ডার
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

    // হরিজন্টাল গ্রিড ও ডানপাশের প্রাইস স্কেল (ভিডিও অনুযায়ী স্পষ্ট সাদা-ধূসর টেক্সট)
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

    // ভার্টিকাল টাইম গ্রিড ও নিচে সময়ের ব্যাজ (ভিডিওর মতো: 22:48, 23:04, 23:20)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 1; i <= 4; i++) {
        let x = (width / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 20);
        ctx.stroke();
    }
    ctx.fillStyle = '#596a7d';
    ctx.font = '10px sans-serif';
    ctx.fillText('22:48', width * 0.22, height - 6);
    ctx.fillText('23:04', width * 0.44, height - 6);
    ctx.fillText('23:20', width * 0.66, height - 6);
    ctx.fillText('23:36', width * 0.88, height - 6);

    let baseRightX = width - 85 + panOffset;

    // ক্যান্ডেলস্টিক আঁকা (সুস্পষ্ট সবুজ ও লাল কালার)
    allCandles.forEach((c, index) => {
        let x = baseRightX - ((allCandles.length - 1 - index) * totalUnit);
        if (x < -20 || x > width + 20) return;

        let isBull = c.close >= c.open;
        let color = isBull ? '#0faf59' : '#eb5757';

        let highY = height - padY - ((c.high - minP) / range) * (height - padY * 2);
        let lowY = height - padY - ((c.low - minP) / range) * (height - padY * 2);
        let openY = height - padY - ((c.open - minP) / range) * (height - padY * 2);
        let closeY = height - padY - ((c.close - minP) / range) * (height - padY * 2);

        // সুক্ষ্ম ও স্পষ্ট উইক
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.floor(x + candleWidth / 2) + 0.5, Math.floor(highY));
        ctx.lineTo(Math.floor(x + candleWidth / 2) + 0.5, Math.floor(lowY));
        ctx.stroke();

        // ক্যান্ডেল বডি
        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 1.5;
        ctx.fillRect(Math.floor(x), Math.floor(topY), candleWidth, Math.ceil(h));
    });

    // এক্সপায়ারেশন ভার্টিকাল ড্যাশ লাইন (End of trade)
    let endTradeX = width - 110;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(endTradeX, 0);
    ctx.lineTo(endTradeX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // লাইভ ক্যান্ডেলের অনুভূমিক ডটেড লাইন ও নীল প্রাইস পিল
    if (liveCandle) {
        let liveY = height - padY - ((liveCandle.close - minP) / range) * (height - padY * 2);

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, liveY);
        ctx.lineTo(width - 55, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // লাইভ প্রাইস পিল (ভিডিওর মতো নীল রঙের ব্যাজ)
        ctx.fillStyle = '#2a66e4';
        ctx.beginPath();
        ctx.roundRect(width - 56, liveY - 10, 54, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(liveCandle.close.toFixed(3), width - 51, liveY + 4);

        // এক্সপায়ারেশন ড্যাশ লাইনের সাথে কাউন্টডাউন ব্যাজ (যেমন: - 00:07)
        let secStr = remainingCountdown < 10 ? '0' + remainingCountdown : remainingCountdown;
        ctx.fillStyle = 'rgba(23, 29, 42, 0.85)';
        ctx.fillRect(endTradeX - 25, liveY - 9, 50, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`- 00:${secStr}`, endTradeX - 23, liveY + 4);
    }

    // একাধিক সক্রিয় ট্রেডের মার্কার (ডট ও তীরচিহ্ন)
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

// WebSocket কানেকশন
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

// টাইম সিলেক্টর পপআপ টগল (ভিডিওর ০:২২ অংশের মতো)
function toggleTimePopup() {
    let p = document.getElementById('timeSelectPopup');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
}
function selectTime(val) {
    document.getElementById('displayTimeVal').innerText = val;
    document.querySelectorAll('.time-grid button').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    document.getElementById('timeSelectPopup').style.display = 'none';
}
function switchTimeTab(tab) {
    document.querySelectorAll('.t-tab').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// ইনভেস্টমেন্ট অ্যামাউন্ট
function stepAmt(v) {
    let cur = Number(document.getElementById('invAmt').innerText);
    if (cur + v >= 1) {
        document.getElementById('invAmt').innerText = cur + v;
        document.getElementById('calcPayout').innerText = ((cur + v) * 1.92).toFixed(2) + " $";
    }
}

// ট্রেড অর্ডার প্লেস
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

        // টপ নোটিফিকেশন টোস্ট
        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} AUD/JPY (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);

        drawChart();

        // উইন রেজাল্ট বাবল
        setTimeout(() => {
            activeTrades = activeTrades.filter(t => t.id !== tradeObj.id);
            updateBalanceUI(data.balance);

            if (data.isWin) {
                let bubble = document.getElementById('resultBubble');
                document.getElementById('resProfitVal').innerText = `+${data.profit} $`;
                bubble.style.display = 'block';
                bubble.style.top = '50%';
                bubble.style.left = '38%';
                setTimeout(() => { bubble.style.display = 'none'; }, 5000);
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
        lbl.style.color = "#00b074";
        icon.innerText = "✈️";
        document.getElementById('radioLive').checked = true;
        watermark.innerText = "LIVE";
        updateBalanceUI(liveBalance);
    } else {
        lbl.innerText = "DEMO";
        lbl.style.color = "#f5a623";
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
