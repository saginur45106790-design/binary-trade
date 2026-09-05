const canvas = document.getElementById('candleCanvas');
const ctx = canvas.getContext('2d');
const livePrice = document.getElementById('livePrice');
const candleCountdown = document.getElementById('candleCountdown');
const balanceDisplay = document.getElementById('balance');
const statusToast = document.getElementById('statusToast');

let candleHistory = [];
let liveCandle = null;
let panOffset = 0;
let isDragging = false;
let startX = 0;

function fitCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawChart();
}
window.addEventListener('resize', fitCanvas);

// টাচ এবং ড্র্যাগ ইভেন্ট (মোবাইলে স্ক্রিন টেনে পেছনের ক্যান্ডেল দেখার জন্য)
canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
});
canvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    let currentX = e.touches[0].clientX;
    let diff = currentX - startX;
    panOffset += diff * 0.7;
    startX = currentX;
    drawChart();
});
canvas.addEventListener('touchend', () => { isDragging = false; });

// মাউস ড্র্যাগ (পিসি বা টেস্টের জন্য)
canvas.addEventListener('mousedown', (e) => { isDragging = true; startX = e.clientX; });
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let diff = e.clientX - startX;
    panOffset += diff * 0.7;
    startX = e.clientX;
    drawChart();
});
window.addEventListener('mouseup', () => { isDragging = false; });

function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allCandles = [...candleHistory];
    if (liveCandle) allCandles.push(liveCandle);
    if (allCandles.length === 0) return;

    let candleWidth = 14;
    let candleSpacing = 6;
    let totalUnit = candleWidth + candleSpacing;

    // হরিজন্টাল গ্রিড লাইন
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
        let y = (canvas.height / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // মিনিমাম ও ম্যাক্সিমাম প্রাইস ক্যালকুলেশন
    let prices = allCandles.flatMap(c => [c.high, c.low]);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let range = (maxP - minP) || 0.00010;
    let padY = 30;

    // সর্বশেষ ক্যান্ডেলকে ডানপাশে সেট রাখা
    let baseRightX = canvas.width - 50 + panOffset;

    allCandles.forEach((c, index) => {
        let x = baseRightX - ((allCandles.length - 1 - index) * totalUnit);

        // স্ক্রিনের বাইরে থাকলে ড্র করার প্রয়োজন নেই
        if (x < -20 || x > canvas.width + 20) return;

        let isBull = c.close >= c.open;
        let color = isBull ? '#00e676' : '#ff334b';

        let highY = canvas.height - padY - ((c.high - minP) / range) * (canvas.height - padY * 2);
        let lowY = canvas.height - padY - ((c.low - minP) / range) * (canvas.height - padY * 2);
        let openY = canvas.height - padY - ((c.open - minP) / range) * (canvas.height - padY * 2);
        let closeY = canvas.height - padY - ((c.close - minP) / range) * (canvas.height - padY * 2);

        // ক্যান্ডেলের উইক (Wick)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // ক্যান্ডেলের বডি (Body)
        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 2;
        ctx.fillRect(x, topY, candleWidth, h);
    });

    // সর্বশেষ লাইভ প্রাইস হরিজন্টাল লাইন
    if (liveCandle) {
        let liveY = canvas.height - padY - ((liveCandle.close - minP) / range) * (canvas.height - padY * 2);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, liveY);
        ctx.lineTo(canvas.width, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ডানপাশের প্রাইস ব্যাজ
        ctx.fillStyle = '#263345';
        ctx.fillRect(canvas.width - 65, liveY - 10, 65, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(liveCandle.close.toFixed(5), canvas.width - 60, liveY + 4);
    }
}

// WebSocket সংযোগ
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onmessage = (event) => {
    let msg = JSON.parse(event.data);
    if (msg.type === 'TICK') {
        livePrice.innerText = msg.price;
        liveCandle = msg.candle;
        candleHistory = msg.history;
        
        let sec = msg.countdown;
        candleCountdown.innerText = `00:${sec < 10 ? '0' + sec : sec}`;

        drawChart();
    }
};

function changeAmt(val) {
    let cur = Number(document.getElementById('tradeAmt').value);
    if (cur + val >= 1) document.getElementById('tradeAmt').value = cur + val;
}

function executeTrade(direction) {
    let amount = Number(document.getElementById('tradeAmt').value);
    statusToast.innerText = `ট্রেড সক্রিয় হয়েছে (${direction})...`;
    statusToast.style.color = '#ffb300';

    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', amount, direction })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            statusToast.innerText = data.message;
            statusToast.style.color = '#ff334b';
            return;
        }
        setTimeout(() => {
            balanceDisplay.innerText = data.balance.toFixed(2);
            if (data.isWin) {
                statusToast.innerText = `উইন! +$${data.profit.toFixed(2)}`;
                statusToast.style.color = '#00e676';
            } else {
                statusToast.innerText = `লস! -$${amount.toFixed(2)}`;
                statusToast.style.color = '#ff334b';
            }
        }, 1500);
    });
}

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

function submitWithdraw() {
    let method = document.getElementById('wdMethod').value;
    let amount = document.getElementById('wdAmount').value;
    let accountNo = document.getElementById('wdAcc').value;
    fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', method, amount, accountNo })
    }).then(r => r.json()).then(d => {
        alert(d.message);
        closeModal('wdModal');
    });
}

setTimeout(fitCanvas, 200);
