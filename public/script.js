const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11072.87;
let liveBalance = 10.00;
let panOffset = 0;
let remainingCountdown = 60;

let activeAssetKey = 'BTC';
let activeDecimals = 2;
let currentPayout = 92;
let isLoadingAsset = false;

let renderLivePrice = 68520.50;
let targetLivePrice = 68520.50;

let candleWidth = 9;
let candleSpacing = 4;
let initialPinchDistance = null;

let currentMode = 'timer';
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';

let currentInvestAmount = 1;
let selectedDepMethod = 'Bkash';
let activeSellTrade = null;

let lastTickTime = Date.now();
let ws = null;

const ASSET_DECIMALS = {
    'BTC': 2, 'ETH': 2, 'SOL': 2, 'BNB': 2,
    'XRP': 4, 'DOGE': 4, 'TON': 3, 'ADA': 4
};

function fitCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', fitCanvas);

// লোডার যাতে কখনোই আটকে না থাকে (Failsafe Auto-hide)
function showChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) el.classList.add('active');
    setTimeout(hideChartLoader, 1200);
}
function hideChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) el.classList.remove('active');
}

// -------------------------------------------------------------
// 🔄 ব্যাকগ্রাউন্ড থেকে ফিরে আসলে স্বয়ংক্রিয় সিঙ্ক (Self-Healing Auto-Sync)
// -------------------------------------------------------------
function fullAutoSync() {
    hideChartLoader();
    lastTickTime = Date.now();

    // ১. সার্ভার থেকে লেটেস্ট ২৪ ঘণ্টার ক্যান্ডেল রিফেচ
    fetch(`/api/history/${activeAssetKey}`)
    .then(r => r.json())
    .then(data => {
        if (data.success && data.meta.ticker === activeAssetKey) {
            candles = data.history.map(c => ({ ...c }));
            activeDecimals = data.meta.decimals;
            currentPayout = data.meta.payout;

            let lastP = candles[candles.length - 1].close;
            targetLivePrice = lastP;
            renderLivePrice = lastP;
        }
    }).catch(() => {});

    // ২. ব্যাকগ্রাউন্ডে থাকাকালীন যে ট্রেডগুলোর সময় শেষ হয়েছে, সেগুলো তাৎক্ষণিক সেটেল
    let nowSec = Math.floor(Date.now() / 1000);
    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (nowSec >= trade.expireTime) {
            settleTrade(trade);
            activeTrades.splice(i, 1);
        }
    }
    updateTradeBadges();

    // ৩. ওয়েব-সকেট যদি স্লিপ হয়ে থাকে, রিকানেক্ট করা
    connectWebSocket();
}

// ফোন লক বা মিনিমাইজ করে ফিরে আসার ইভেন্টস
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fullAutoSync();
});
window.addEventListener('focus', fullAutoSync);
window.addEventListener('pageshow', fullAutoSync);

// ওয়াচডগ: কোনো কারণে ৩ সেকেন্ডের বেশি টিক মিস হলে অটো-সিঙ্ক
setInterval(() => {
    if (Date.now() - lastTickTime > 4000) {
        fullAutoSync();
    }
}, 3000);

// -------------------------------------------------------------
// ওয়েব-সকেট রিকানেকশন ইঞ্জিন
// -------------------------------------------------------------
function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            lastTickTime = Date.now();
        };

        ws.onmessage = (event) => {
            lastTickTime = Date.now();
            let msg = JSON.parse(event.data);
            if (msg.type === 'TICK') {
                for (let k in msg.assets) {
                    let el = document.getElementById(`price-tag-${k}`);
                    if (el) el.innerText = msg.assets[k].price;
                }

                if (!isLoadingAsset && candles.length > 0 && msg.assets[activeAssetKey]) {
                    let item = msg.assets[activeAssetKey];
                    targetLivePrice = parseFloat(item.price);

                    let last = candles[candles.length - 1];
                    if (last.time === item.candle.time) {
                        last.high = Math.max(last.high, item.candle.high);
                        last.low = Math.min(last.low, item.candle.low);
                    } else {
                        candles.push({ ...item.candle });
                        if (candles.length > 1440) candles.shift();
                    }
                }
            }
        };

        ws.onclose = () => {
            setTimeout(connectWebSocket, 2000);
        };
    } catch (e) {}
}
connectWebSocket();

// টাচ স্ক্রোল ও পিঞ্চ জুম
let startX = 0;
let isPanning = false;

if (canvas) {
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
        } else if (e.touches.length === 1 && isPanning) {
            panOffset += (e.touches[0].clientX - startX) * 0.95;
            let maxPan = (candles.length * (candleWidth + candleSpacing)) - 80;
            panOffset = Math.max(-60, Math.min(maxPan, panOffset));
            startX = e.touches[0].clientX;
        }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
        isPanning = false;
        initialPinchDistance = null;
    });
}

function stepAmt(delta) {
    currentInvestAmount = Math.max(1, currentInvestAmount + delta);
    let inp = document.getElementById('invAmtInput');
    if (inp) inp.value = currentInvestAmount;
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
    let el = document.getElementById('calcPayout');
    if (el) el.innerText = `${total} $`;
}

function toggleAccountModal() {
    let m = document.getElementById('accountModal');
    if (m) m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}
function closeAccountModal(e) {
    if (e.target.id === 'accountModal') document.getElementById('accountModal').style.display = 'none';
}

function switchAccount(type) {
    currentAccount = type;
    let modal = document.getElementById('accountModal');
    if (modal) modal.style.display = 'none';

    let lbl = document.getElementById('accountLabel');
    let iconWrap = document.getElementById('accountIcon');
    let watermark = document.getElementById('chartWatermark');

    let optLive = document.getElementById('optLiveCard');
    let optDemo = document.getElementById('optDemoCard');
    let radioLive = document.getElementById('radioLiveCircle');
    let radioDemo = document.getElementById('radioDemoCircle');

    if (type === 'live') {
        if (lbl) { lbl.innerText = "LIVE"; lbl.className = "acc-label live"; }
        if (iconWrap) iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#00b074"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
        updateBalanceUI(liveBalance);

        if (optLive) optLive.classList.add('active');
        if (optDemo) optDemo.classList.remove('active');
        if (radioLive) radioLive.classList.add('active');
        if (radioDemo) radioDemo.classList.remove('active');

        if (watermark) watermark.style.display = 'none';
    } else {
        if (lbl) { lbl.innerText = "DEMO"; lbl.className = "acc-label demo"; }
        if (iconWrap) iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#f5a623"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`;
        updateBalanceUI(demoBalance);

        if (optDemo) optDemo.classList.add('active');
        if (optLive) optLive.classList.remove('active');
        if (radioDemo) radioDemo.classList.add('active');
        if (radioLive) radioLive.classList.remove('active');

        if (watermark) { watermark.style.display = 'block'; watermark.innerText = 'DEMO'; }
    }

    fetch('/api/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', type })
    }).catch(() => {});
}

function resetDemoBalance(event) {
    if (event) event.stopPropagation();
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
    let b1 = document.getElementById('accountBal');
    if (b1) b1.innerText = str;
    if (currentAccount === 'live') {
        liveBalance = num;
        let lb = document.getElementById('modalLiveBal');
        if (lb) lb.innerText = str;
    } else {
        demoBalance = num;
        let db = document.getElementById('modalDemoBal');
        if (db) db.innerText = str;
    }
}

function updateTradeBadges() {
    let count = activeTrades.length;
    let b1 = document.getElementById('openTradesBadge');
    let b2 = document.getElementById('drawerCount');
    if (b1) b1.innerText = count;
    if (b2) b2.innerText = count;
}

function toggleBottomTrades() {
    let el = document.getElementById('bottomTradesDrawer');
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function openDepositModal() { let m = document.getElementById('depositModal'); if (m) m.style.display = 'flex'; }
function closeDepositModal() { let m = document.getElementById('depositModal'); if (m) m.style.display = 'none'; }

function setDepMethod(method, number, note) {
    selectedDepMethod = method;
    document.querySelectorAll('.dep-pill').forEach(p => p.classList.remove('active'));
    if (event) event.target.classList.add('active');
    let l = document.getElementById('depMethodLabel');
    let n = document.getElementById('depTargetNumber');
    if (l) l.innerText = `${method} ${note}:`;
    if (n) n.innerText = number;
}

function submitDepositForm() {
    let amtElem = document.getElementById('depAmountInput');
    let sElem = document.getElementById('depSenderInput');
    let trxElem = document.getElementById('depTrxInput');
    let amount = amtElem ? amtElem.value : "";
    let sender = sElem ? sElem.value : "";
    let trx = trxElem ? trxElem.value : "";

    if (!amount || !trx) return alert("Please enter amount and TrxID!");

    fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', method: selectedDepMethod, amount, senderNumber: sender, trxId: trx })
    })
    .then(r => r.json())
    .then(d => {
        alert(d.message);
        if (d.success) {
            if (amtElem) amtElem.value = '';
            if (sElem) sElem.value = '';
            if (trxElem) trxElem.value = '';
            closeDepositModal();
        }
    });
}

function toggleTimePopup() {
    let p = document.getElementById('timeSelectPopup');
    if (p) p.style.display = (p.style.display !== 'block') ? 'block' : 'none';
}

function switchPopupTab(tab) {
    currentMode = tab;
    let b1 = document.getElementById('tabTimerBtn');
    let b2 = document.getElementById('tabTimeBtn');
    let g1 = document.getElementById('gridTimerMode');
    let g2 = document.getElementById('gridTimeMode');
    let lbl = document.getElementById('dockTimeLabel');
    let val = document.getElementById('dockTimeValue');

    if (tab === 'time') {
        if (b2) b2.classList.add('active');
        if (b1) b1.classList.remove('active');
        if (g2) g2.style.display = 'grid';
        if (g1) g1.style.display = 'none';
        if (lbl) lbl.innerText = 'Time';
        if (val) val.innerText = selectedTimeValue || '00:01';
    } else {
        if (b1) b1.classList.add('active');
        if (b2) b2.classList.remove('active');
        if (g1) g1.style.display = 'grid';
        if (g2) g2.style.display = 'none';
        if (lbl) lbl.innerText = 'Timer';
        if (val) val.innerText = selectedTimerDisplay;
    }
}

function selectTimer(sec, display) {
    selectedTimerSeconds = sec;
    selectedTimerDisplay = display;
    let val = document.getElementById('dockTimeValue');
    if (val) val.innerText = display;
    document.querySelectorAll('#gridTimerMode button').forEach(b => b.classList.remove('selected'));
    if (event) event.target.classList.add('selected');
    let p = document.getElementById('timeSelectPopup');
    if (p) p.style.display = 'none';
}

function syncClock() {
    let now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    let ss = String(now.getSeconds()).padStart(2, '0');
    let clock = document.getElementById('liveUtcClock');
    if (clock) {
        clock.innerHTML = `<span class="live-dot"></span> ${hh}:${mm}:${ss} UTC+6`;
    }

    let sec = Math.floor(now.getTime() / 1000);
    remainingCountdown = 60 - (sec % 60);

    let endText = document.getElementById('endTradeTimeText');
    if (endText) {
        let expDate = new Date(now.getTime() + selectedTimerSeconds * 1000);
        endText.innerText = `${String(expDate.getHours()).padStart(2,'0')}:${String(expDate.getMinutes()).padStart(2,'0')}`;
    }

    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (sec >= trade.expireTime) {
            settleTrade(trade);
            activeTrades.splice(i, 1);
            updateTradeBadges();
        }
    }
}
setInterval(syncClock, 1000);

function settleTrade(trade) {
    let exitP = candles.length > 0 ? candles[candles.length - 1].close : trade.entryPrice;
    let card = document.getElementById('sellTradeCard');
    if (card) card.style.display = 'none';

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
        if (bubble) {
            bubble.className = data.isWin ? "result-popup-bubble" : "result-popup-bubble loss";
            let val = document.getElementById('resProfitVal');
            if (val) val.innerText = data.isWin ? `+${data.profit} $` : `0.00 $`;
            bubble.style.display = 'block';
            bubble.style.top = '48%';
            bubble.style.left = '35%';
            setTimeout(() => { bubble.style.display = 'none'; }, 4000);
        }
    });
}

function selectAsset(key) {
    if (activeAssetKey === key && candles.length > 0) {
        closeAssetModal();
        return;
    }
    isLoadingAsset = true;
    candles = [];
    showChartLoader();
    closeAssetModal();

    activeAssetKey = key;
    activeDecimals = ASSET_DECIMALS[key] || 2;
    let cur = document.getElementById('curName');
    if (cur) cur.innerText = `${key}/USD (OTC)`;

    fetch(`/api/history/${key}`)
    .then(r => r.json())
    .then(data => {
        if (data.success && data.meta.ticker === activeAssetKey) {
            candles = data.history.map(c => ({ ...c }));
            activeDecimals = data.meta.decimals;
            currentPayout = data.meta.payout;
            let pOut = document.getElementById('curPayout');
            if (pOut) pOut.innerText = `${currentPayout}% ▼`;
            updatePayoutCalc();

            let lastP = candles[candles.length - 1].close;
            targetLivePrice = lastP;
            renderLivePrice = lastP;
        }
    })
    .catch(() => {})
    .finally(() => {
        isLoadingAsset = false;
        hideChartLoader();
    });
}

// -------------------------------------------------------------
// ক্যানভাস রেন্ডার লুপ (মাখনের মতো স্মুথ)
// -------------------------------------------------------------
function render() {
    requestAnimationFrame(render);
    if (!canvas || !ctx) return;

    const width = parseFloat(canvas.style.width) || canvas.width;
    const height = parseFloat(canvas.style.height) || canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (candles.length === 0 || isLoadingAsset) return;

    let isLightTheme = document.body.classList.contains('theme-light');

    renderLivePrice += (targetLivePrice - renderLivePrice) * 0.18;
    candles[candles.length - 1].close = parseFloat(renderLivePrice.toFixed(activeDecimals));

    let totalUnit = candleWidth + candleSpacing;
    let baseRightX = width - 85 + panOffset;
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

    ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = isLightTheme ? '#57606a' : '#7a8ba1';
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

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.85)';
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

    let expX = baseRightX + (candleWidth + candleSpacing);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(expX, 0);
    ctx.lineTo(expX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    let cdS = remainingCountdown % 60;
    let candleTimerStr = (remainingCountdown === 60) ? '01:00' : `00:${String(cdS).padStart(2, '0')}`;

    let pillW = 54;
    let pillH = 20;
    let pillX = expX + 6;
    let pillY = liveY - (pillH / 2);

    ctx.fillStyle = isLightTheme ? '#ffffff' : '#1c2638';
    ctx.strokeStyle = isLightTheme ? '#d0d7de' : '#2d3e56';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isLightTheme ? '#0f172a' : '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(candleTimerStr, pillX + 10, pillY + 14);

    activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
        let entryX = getX(tr.startCandleIdx);
        let entryY = getY(tr.entryPrice);
        let isUp = (tr.direction === 'UP');
        let tradeColor = isUp ? '#00e676' : '#eb5757';

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(expX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(isUp ? '↑' : '↓', entryX - 2.8, entryY + 3.2);

        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(expX, entryY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

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

        updateTradeBadges();

        let toast = document.getElementById('tradeOpenToast');
        if (toast) {
            let msg = document.getElementById('toastMsg');
            if (msg) msg.innerText = `Trade opened: ${data.entryPrice} ${activeAssetKey}`;
            toast.style.display = 'flex';
            setTimeout(() => { toast.style.display = 'none'; }, 3000);
        }
    });
}

function resetPan() { panOffset = 0; }
function openAssetModal() { let m = document.getElementById('assetModal'); if (m) m.style.display = 'flex'; }
function closeAssetModal() { let m = document.getElementById('assetModal'); if (m) m.style.display = 'none'; }
function closeResult() { let r = document.getElementById('resultBubble'); if (r) r.style.display = 'none'; }
function closeToast() { let t = document.getElementById('tradeOpenToast'); if (t) t.style.display = 'none'; }
function closeAllDrawers() {
    let d1 = document.getElementById('bottomTradesDrawer');
    let d2 = document.getElementById('sellTradeCard');
    if (d1) d1.style.display = 'none';
    if (d2) d2.style.display = 'none';
}
function toggleToolsMenu() {}

// বুটস্ট্র্যাপ
fitCanvas();
selectAsset('BTC');
switchAccount('demo');
requestAnimationFrame(render);
setTimeout(hideChartLoader, 700);
