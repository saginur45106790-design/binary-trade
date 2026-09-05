const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candleHistory = [];
let liveCandle = null;
let activeTrades = []; // একাধিক ট্রেডের তালিকা
let currentAccount = 'demo';
let demoBalance = 11061.07;
let liveBalance = 0.03;
let panOffset = 0;

function fitCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawChart();
}
window.addEventListener('resize', fitCanvas);

// চার্ট রেন্ডার ইঞ্জিন
function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allCandles = [...candleHistory];
    if (liveCandle) allCandles.push(liveCandle);
    if (allCandles.length === 0) return;

    let candleWidth = 12;
    let candleSpacing = 6;
    let totalUnit = candleWidth + candleSpacing;

    // অনুভূমিক গ্রিড লাইন এবং ডানপাশের প্রাইস স্কেল
    let prices = allCandles.flatMap(c => [c.high, c.low]);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let range = (maxP - minP) || 0.040;
    let padY = 40;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6e829c';
    ctx.font = '10px sans-serif';

    for (let i = 1; i <= 6; i++) {
        let y = (canvas.height / 7) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width - 55, y);
        ctx.stroke();

        let pVal = maxP - ((y - padY) / (canvas.height - padY * 2)) * range;
        ctx.fillText(pVal.toFixed(3), canvas.width - 50, y + 3);
    }

    let baseRightX = canvas.width - 70 + panOffset;

    // ক্যান্ডেলসমূহ আঁকা
    allCandles.forEach((c, index) => {
        let x = baseRightX - ((allCandles.length - 1 - index) * totalUnit);
        if (x < -20 || x > canvas.width + 20) return;

        let isBull = c.close >= c.open;
        let color = isBull ? '#00b074' : '#eb5757';

        let highY = canvas.height - padY - ((c.high - minP) / range) * (canvas.height - padY * 2);
        let lowY = canvas.height - padY - ((c.low - minP) / range) * (canvas.height - padY * 2);
        let openY = canvas.height - padY - ((c.open - minP) / range) * (canvas.height - padY * 2);
        let closeY = canvas.height - padY - ((c.close - minP) / range) * (canvas.height - padY * 2);

        // উইক
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // বডি
        ctx.fillStyle = color;
        let topY = Math.min(openY, closeY);
        let h = Math.abs(closeY - openY) || 2;
        ctx.fillRect(x, topY, candleWidth, h);
    });

    // শেষ প্রান্তের ট্রেড সমাপ্তির উলম্ব ডটেড লাইন (End of trade)
    let endTradeX = canvas.width - 90;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(endTradeX, 0);
    ctx.lineTo(endTradeX, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // বর্তমান লাইভ প্রাইস অনুভূমিক লাইন
    if (liveCandle) {
        let liveY = canvas.height - padY - ((liveCandle.close - minP) / range) * (canvas.height - padY * 2);

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, liveY);
        ctx.lineTo(canvas.width - 55, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // নীল প্রাইস ব্যাজ
        ctx.fillStyle = '#2a66e4';
        ctx.beginPath();
        ctx.roundRect(canvas.width - 58, liveY - 10, 56, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(liveCandle.close.toFixed(3), canvas.width - 52, liveY + 4);
    }

    // স্ক্রিনশট ৭৪৭ ও ৭৪৮ এর মতো সক্রিয় একাধিক ট্রেড মার্কার
    activeTrades.forEach(tr => {
        let entryY = canvas.height - padY - ((tr.price - minP) / range) * (canvas.height - padY * 2);
        
        ctx.strokeStyle = tr.direction === 'UP' ? '#00b074' : '#eb5757';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, entryY);
        ctx.lineTo(canvas.width - 55, entryY);
        ctx.stroke();

        // লাল/সবুজ গোল ডট ও তীরচিহ্ন
        ctx.fillStyle = tr.direction === 'UP' ? '#00b074' : '#eb5757';
        ctx.beginPath();
        ctx.arc(canvas.width - 110, entryY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '8px sans-serif';
        ctx.fillText(tr.direction === 'UP' ? '↑' : '↓', canvas.width - 113, entryY + 3);
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
        drawChart();
    }
};

// ইনভেস্টমেন্ট পরিবর্তন
function stepAmt(v) {
    let cur = Number(document.getElementById('invAmt').innerText);
    if (cur + v >= 1) {
        document.getElementById('invAmt').innerText = cur + v;
        document.getElementById('calcPayout').innerText = ((cur + v) * 1.88).toFixed(2) + " $";
    }
}

// ট্রেড অর্ডার এক্সিকিউশন
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

        // স্ক্রিনশট ৭৪৭/৭৪৮ এর মতো চার্টে ট্রেড মার্কার যোগ
        let tradeObj = {
            id: Date.now(),
            price: parseFloat(data.entryPrice),
            direction: data.direction
        };
        activeTrades.push(tradeObj);

        // স্ক্রিনশট ৭৪৮ এর মতো টপ গ্রিন নোটিফিকেশন টোস্ট
        let toast = document.getElementById('tradeOpenToast');
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} AUD/JPY (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);

        drawChart();

        // ট্রেড ফলাফল (স্ক্রিনশট ৭৫১ এর মতো গ্রিন রেজাল্ট বাবল)
        setTimeout(() => {
            activeTrades = activeTrades.filter(t => t.id !== tradeObj.id);
            updateBalanceUI(data.balance);

            if (data.isWin) {
                let bubble = document.getElementById('resultBubble');
                document.getElementById('resProfitVal').innerText = `+${data.profit} $`;
                bubble.style.display = 'block';
                bubble.style.top = '48%';
                bubble.style.left = '35%';
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

// অ্যাকাউন্ট স্যুইচিং (লাইভ <-> ডেমো)
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
