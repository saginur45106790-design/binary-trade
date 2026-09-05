const canvas = document.getElementById('candleCanvas');
const ctx = canvas.getContext('2d');
const priceDisplay = document.getElementById('priceDisplay');
const balanceDisplay = document.getElementById('balance');
const tradeNotice = document.getElementById('tradeNotice');

let candles = [];
let currentLiveCandle = null;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// চার্ট রেন্ডারিং ফাংশন
function renderChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let allData = [...candles];
    if (currentLiveCandle) allData.push(currentLiveCandle);
    if (allData.length === 0) return;

    let prices = allData.flatMap(c => [c.high, c.low]);
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    let priceRange = (maxPrice - minPrice) || 0.00010;

    let candleWidth = canvas.width / (allData.length + 2);
    let padding = 15;

    // গ্রিড লাইন
    ctx.strokeStyle = '#1b202e';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
        let y = (canvas.height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // ক্যান্ডেল আঁকা
    allData.forEach((c, idx) => {
        let x = idx * candleWidth + 10;
        let isUp = c.close >= c.open;
        let color = isUp ? '#00e676' : '#ff1744';

        let highY = canvas.height - padding - ((c.high - minPrice) / priceRange) * (canvas.height - padding * 2);
        let lowY = canvas.height - padding - ((c.low - minPrice) / priceRange) * (canvas.height - padding * 2);
        let openY = canvas.height - padding - ((c.open - minPrice) / priceRange) * (canvas.height - padding * 2);
        let closeY = canvas.height - padding - ((c.close - minPrice) / priceRange) * (canvas.height - padding * 2);

        // উইক (Wick)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth * 0.4, highY);
        ctx.lineTo(x + candleWidth * 0.4, lowY);
        ctx.stroke();

        // বডি (Body)
        ctx.fillStyle = color;
        let bodyY = Math.min(openY, closeY);
        let bodyHeight = Math.abs(closeY - openY) || 2;
        ctx.fillRect(x, bodyY, candleWidth * 0.8, bodyHeight);
    });

    // লাইভ ডটেড প্রাইস লাইন
    if (currentLiveCandle) {
        let lastY = canvas.height - padding - ((currentLiveCandle.close - minPrice) / priceRange) * (canvas.height - padding * 2);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, lastY);
        ctx.lineTo(canvas.width, lastY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// WebSocket কানেকশন
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'TICK') {
        priceDisplay.innerText = data.price;
        currentLiveCandle = data.candle;
        candles = data.history;
        renderChart();
    }
};

// ট্রেড ফাংশন
function executeTrade(direction) {
    let amount = Number(document.getElementById('tradeAmount').value);
    let timeframe = document.getElementById('timeframe').value;

    tradeNotice.innerText = `Trade Active: ${timeframe}s...`;
    tradeNotice.style.color = '#ffb300';

    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', amount, timeframe, direction })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            tradeNotice.innerText = data.message;
            tradeNotice.style.color = '#ff1744';
            return;
        }
        setTimeout(() => {
            balanceDisplay.innerText = data.balance.toFixed(2);
            if (data.isWin) {
                tradeNotice.innerText = `WON: +$${data.profit.toFixed(2)}`;
                tradeNotice.style.color = '#00e676';
            } else {
                tradeNotice.innerText = `LOST: -$${amount.toFixed(2)}`;
                tradeNotice.style.color = '#ff1744';
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
    }).then(r => r.json()).then(d => { alert(d.message); closeModal('depModal'); });
}

function submitWithdraw() {
    let method = document.getElementById('wdMethod').value;
    let amount = document.getElementById('wdAmount').value;
    let accountNo = document.getElementById('wdAcc').value;
    fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', method, amount, accountNo })
    }).then(r => r.json()).then(d => { alert(d.message); closeModal('wdModal'); location.reload(); });
}
