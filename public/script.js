// TradingView লাইটওয়েট ক্যান্ডেলস্টিক চার্ট ইনিশিয়ালাইজেশন
const chartContainer = document.getElementById('chart-container');
const chart = LightweightCharts.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: 420,
    layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
    },
    grid: {
        vertLines: { color: '#1f293d' },
        horzLines: { color: '#1f293d' },
    },
    timeScale: {
        timeVisible: true,
        secondsVisible: true,
    },
});

const candlestickSeries = chart.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderDownColor: '#ef5350',
    borderUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    wickUpColor: '#26a69a',
});

// ডেমো ক্যান্ডেল ডাটা জেনারেট করা
let currentTime = Math.floor(Date.now() / 1000) - 300;
let basePrice = 1.0800;
let initialData = [];

for (let i = 0; i < 50; i++) {
    let open = basePrice;
    let close = open + (Math.random() - 0.48) * 0.0020;
    let high = Math.max(open, close) + Math.random() * 0.0010;
    let low = Math.min(open, close) - Math.random() * 0.0010;
    initialData.push({ time: currentTime, open, high, low, close });
    basePrice = close;
    currentTime += 5;
}
candlestickSeries.setData(initialData);

// রিয়েল-টাইম WebSocket প্রাইস ফিড ও ক্যান্ডেল আপডেট
const ws = new WebSocket('ws://' + window.location.host);
ws.onmessage = function(event) {
    let data = JSON.parse(event.data);
    if(data.type === 'PRICE_UPDATE') {
        document.getElementById('price').innerText = data.price;
        
        // সর্বশেষ ক্যান্ডেল লাইভ আপডেট
        let lastCandle = initialData[initialData.length - 1];
        let newClose = parseFloat(data.price);
        lastCandle.close = newClose;
        if(newClose > lastCandle.high) lastCandle.high = newClose;
        if(newClose < lastCandle.low) lastCandle.low = newClose;
        
        candlestickSeries.update(lastCandle);
    }
};

// উইন্ডো রিসাইজ হলে চার্ট ফিট করা
window.addEventListener('resize', () => {
    chart.applyOptions({ width: chartContainer.clientWidth });
});

// ট্রেড প্লেস ফাংশন
function placeTrade(direction) {
    let amount = document.getElementById('amount').value;
    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', amount: Number(amount) })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('balance').innerText = data.balance.toFixed(2);
            let msg = data.isWin ? `🎉 আপনি উইন করেছেন! প্রফিট পেয়েছেন।` : `❌ লস হয়েছে! আবার চেষ্টা করুন।`;
            document.getElementById('result-msg').innerText = msg;
        } else {
            alert(data.message);
        }
    });
}

function openModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function submitDeposit() {
    let method = document.getElementById('depMethod').value;
    let amount = document.getElementById('depAmount').value;
    let trxId = document.getElementById('trxId').value;
    fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', method, amount, trxId })
    }).then(res => res.json()).then(data => {
        alert(data.message);
        closeModal('depositModal');
    });
}

function submitWithdraw() {
    let method = document.getElementById('wdMethod').value;
    let amount = document.getElementById('wdAmount').value;
    let accountNo = document.getElementById('wdAccount').value;
    fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', method, amount, accountNo })
    }).then(res => res.json()).then(data => {
        alert(data.message);
        closeModal('withdrawModal');
    });
}
