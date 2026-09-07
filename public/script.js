const canvas = document.getElementById('tradeCanvas');
const ctx = canvas.getContext('2d');

let candles = [];
let activeTrades = [];
let currentAccount = 'demo';
let demoBalance = 11068.77;
let liveBalance = 10.00;
let panOffset = 0;
let remainingCountdown = 60;

let activeAssetKey = 'BTC';
let activeDecimals = 2;
let currentPayout = 92;
let isLoadingAsset = false;

let renderLivePrice = 68525.50;
let targetLivePrice = 68525.50;

// প্রাকৃতিক মিডিয়াম ক্যান্ডেল সাইজ
let candleWidth = 12;
let candleSpacing = 5;
let initialPinchDistance = null;

let currentMode = 'timer';
let selectedTimerSeconds = 60;
let selectedTimerDisplay = '00:01:00';
let selectedTimeValue = '';

let currentInvestAmount = 1;
let selectedDepMethod = 'Bkash';
let currentTimezoneOffset = 6;

const ASSET_DECIMALS = { 'BTC': 2, 'ETH': 2, 'SOL': 2, 'BNB': 2, 'XRP': 4, 'DOGE': 4, 'TON': 3, 'ADA': 4 };
const ASSET_BASE_PRICES = { 'BTC': 68525.50, 'ETH': 3422.00, 'SOL': 177.50, 'BNB': 591.20, 'XRP': 0.6250, 'DOGE': 0.1425, 'TON': 5.850, 'ADA': 0.4850 };

// ১. অবিরাম সুরক্ষিত ঘড়ি
function syncClock() {
    try {
        let now = new Date();
        let utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        let targetTime = new Date(utcMs + (3600000 * currentTimezoneOffset));

        let hh = String(targetTime.getHours()).padStart(2, '0');
        let mm = String(targetTime.getMinutes()).padStart(2, '0');
        let ss = String(targetTime.getSeconds()).padStart(2, '0');
        
        let clock = document.getElementById('liveUtcClock');
        if (clock) {
            clock.innerHTML = `<span class="live-dot"></span> ${hh}:${mm}:${ss} UTC+6`;
        }

        let sec = Math.floor(now.getTime() / 1000);
        remainingCountdown = 60 - (sec % 60);

        let endText = document.getElementById('endTradeTimeText');
        if (endText) {
            let expDate = new Date(targetTime.getTime() + selectedTimerSeconds * 1000);
            endText.innerText = `${String(expDate.getHours()).padStart(2,'0')}:${String(expDate.getMinutes()).padStart(2,'0')}`;
        }
    } catch (e) {}
}
syncClock();
setInterval(syncClock, 1000);

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

function showChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) el.classList.add('active');
    setTimeout(hideChartLoader, 700);
}
function hideChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) el.classList.remove('active');
}

// ২. অটো-রিকভারি সিঙ্ক
function fullSyncFromServer() {
    fetch(`/api/history/${activeAssetKey}`)
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            candles = d.history.map(c => ({ ...c }));
            activeDecimals = d.meta.decimals;
            currentPayout = d.meta.payout;
            let lastP = candles[candles.length - 1].close;
            targetLivePrice = lastP;
            renderLivePrice = lastP;
        }
    }).catch(() => {});

    fetch('/api/active-trades')
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            activeTrades = d.trades || [];
            updateTradeBadges();
        }
    }).catch(() => {});
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fullSyncFromServer();
});
window.addEventListener('focus', fullSyncFromServer);

// ৩. টাচ প্যান ও জুম (কোনো পপআপ ছাড়াই পিওর ড্র্যাগ)
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
            if (factor > 1.04 && candleWidth < 26) {
                candleWidth = Math.min(26, candleWidth + 0.3);
                candleSpacing = Math.min(10, candleSpacing + 0.15);
            } else if (factor < 0.96 && candleWidth > 7) {
                candleWidth = Math.max(7, candleWidth - 0.3);
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

function updateTradeBadges() {
    let count = activeTrades.length;
    let b1 = document.getElementById('openTradesBadge');
    if (b1) b1.innerText = count;
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
    let watermark = document.getElementById('chartWatermark');
    let optLive = document.getElementById('optLiveCard');
    let optDemo = document.getElementById('optDemoCard');
    let radioLive = document.getElementById('radioLiveCircle');
    let radioDemo = document.getElementById('radioDemoCircle');

    if (type === 'live') {
        if (lbl) { lbl.innerText = "LIVE"; lbl.className = "acc-label live"; }
        updateBalanceUI(liveBalance);
        if (optLive) optLive.classList.add('active');
        if (optDemo) optDemo.classList.remove('active');
        if (radioLive) radioLive.classList.add('active');
        if (radioDemo) radioDemo.classList.remove('active');
        if (watermark) watermark.style.display = 'none';
    } else {
        if (lbl) { lbl.innerText = "DEMO"; lbl.className = "acc-label demo"; }
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

// ৪. ট্রেড প্লেসিং
function placeOrder(direction) {
    let amount = currentInvestAmount;
    let totalSec = (currentMode === 'timer') ? selectedTimerSeconds : 60;
    let last = candles[candles.length - 1];
    let curTime = last ? last.time : Math.floor(Date.now() / 60000) * 60;
    let curPrice = last ? last.close : renderLivePrice;

    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            amount,
            direction,
            accountType: currentAccount,
            durationSec: totalSec,
            asset: activeAssetKey,
            candleTime: curTime,
            clientEntryPrice: curPrice
        })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) return alert(data.message);

        updateBalanceUI(data.balance);
        activeTrades.push(data.trade);
        updateTradeBadges();

        let toast = document.getElementById('tradeOpenToast');
        if (toast) {
            let msg = document.getElementById('toastMsg');
            if (msg) msg.innerText = `Trade opened: ${data.trade.entryPrice} ${activeAssetKey}`;
            toast.style.display = 'flex';
            setTimeout(() => { toast.style.display = 'none'; }, 2500);
        }
    });
}

function showResultBubble(res) {
    updateBalanceUI(res.balance);
    let bubble = document.getElementById('resultBubble');
    let val = document.getElementById('resProfitVal');
    if (bubble && val) {
        bubble.className = res.isWin ? "result-popup-bubble" : "result-popup-bubble loss";
        val.innerText = res.isWin ? `+${res.profit} $` : `0.00 $`;
        bubble.style.display = 'block';
        bubble.style.top = '48%';
        bubble.style.left = '35%';
        setTimeout(() => { bubble.style.display = 'none'; }, 4500);
    }
}

// -------------------------------------------------------------
// ৫. ক্যানভাস রেন্ডার (মিডিয়াম ক্যান্ডেল ও টাইম-বক্স ছাড়া স্ক্রিনশট ৮৭৪ মার্কার)
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
    candles[candles.length - 1].high = Math.max(candles[candles.length - 1].high, candles[candles.length - 1].close);
    candles[candles.length - 1].low = Math.min(candles[candles.length - 1].low, candles[candles.length - 1].close);

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

    let rawMinP = Math.min(...prices);
    let rawMaxP = Math.max(...prices);
    let rawRange = rawMaxP - rawMinP;

    // প্রাকৃতিক ব্যালেন্সড স্কেলিং বাফার
    let activeVol = (ASSET_BASE_PRICES[activeAssetKey] ? (ASSET_BASE_PRICES[activeAssetKey] * 0.00015) : 1.0);
    let pad = Math.max(rawRange * 0.18, activeVol);

    let minP = rawMinP - pad;
    let maxP = rawMaxP + pad;
    let range = (maxP - minP) || 0.01;
    let padY = 32;

    function getY(p) {
        return height - padY - ((p - minP) / range) * (height - padY * 2);
    }

    // গ্রিড
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

    // মিডিয়াম ক্যান্ডেলস্টিক রেন্ডার
    visibleCandles.forEach(c => {
        let isBull = c.close >= c.open;
        let color = isBull ? '#0faf59' : '#eb5757';

        let highY = getY(c.high);
        let lowY = getY(c.low);
        let openY = getY(c.open);
        let closeY = getY(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
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

    // -------------------------------------------------------------
    // ট্রেড মার্কার (কোনো শেষ সময় বক্স থাকবে না - শুধু অ্যারো ও লাইন)
    // -------------------------------------------------------------
    activeTrades.filter(t => t.asset === activeAssetKey).forEach(tr => {
        let candle = candles.find(c => c.time === tr.candleTime);
        let cIdx = candle ? candles.indexOf(candle) : candles.findIndex(c => c.time <= tr.entryTime && tr.entryTime < c.time + 60);
        if (cIdx === -1) cIdx = candles.length - 1;

        let entryX = getX(cIdx);
        let entryY = getY(tr.entryPrice);
        let isUp = (tr.direction === 'UP');
        let tradeColor = isUp ? '#00e676' : '#eb5757';

        // অনুভূমিক ড্যাশ লাইন
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(expX, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ১. সার্কেল + অ্যারো আইকন
        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(isUp ? '↑' : '↓', entryX - 2.8, entryY + 3.2);

        // ২. সাথে সংযুক্ত ছোট সাদা ডট
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(entryX + 9, entryY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // ৩. শেষ প্রান্তে ছোট ডট (কোনো টাইম বক্স নেই)
        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.arc(expX, entryY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ৬. WebSocket ইঞ্জিন
function connectWS() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onmessage = (event) => {
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
                    if (item.candle.time - last.time > 60) {
                        fullSyncFromServer();
                        return;
                    }

                    if (last.time === item.candle.time) {
                        last.high = Math.max(last.high, item.candle.high);
                        last.low = Math.min(last.low, item.candle.low);
                    } else {
                        candles.push({ ...item.candle });
                        if (candles.length > 1440) candles.shift();
                    }
                }
            } else if (msg.type === 'TRADE_SETTLED') {
                activeTrades = activeTrades.filter(t => t.id !== msg.result.tradeId);
                updateTradeBadges();
                showResultBubble(msg.result);
            }
        };

        ws.onclose = () => setTimeout(connectWS, 1500);
    } catch (e) {}
}
connectWS();

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
    .finally(() => {
        isLoadingAsset = false;
        hideChartLoader();
    });
}

// মোডাল হ্যান্ডলারস
function openMainMenuModal() { let m = document.getElementById('mainMenuModal'); if (m) m.style.display = 'flex'; }
function closeMainMenuModal() { let m = document.getElementById('mainMenuModal'); if (m) m.style.display = 'none'; }
function openHelpModal() { let m = document.getElementById('helpModal'); if (m) m.style.display = 'flex'; }
function closeHelpModal() { let m = document.getElementById('helpModal'); if (m) m.style.display = 'none'; }
function openTournamentsModal() {
    let m = document.getElementById('tournamentsModal');
    if (m) m.style.display = 'flex';
    fetch('/api/tournaments').then(r => r.json()).then(d => {
        let box = document.getElementById('tournamentsListContainer');
        if (!box) return;
        let html = '';
        d.tournaments.forEach(t => {
            html += `
                <div class="tournament-card-item">
                    <span class="tour-pill-badge">${t.status}</span>
                    <div class="tour-content-row">
                        <span class="tour-name">${t.title}</span>
                        <div class="tour-prize-block"><div style="font-size:10px; color:#7e92aa; font-weight:700;">PRIZE POOL</div><div class="tour-prize-val">${t.prizePool}</div></div>
                    </div>
                    <div class="tour-specs-row">
                        <div class="tour-spec-item"><b>${t.entryFee}</b><span>Entry fee</span></div>
                        <div class="tour-spec-item"><b>${t.duration}</b><span>Duration</span></div>
                    </div>
                    <button class="btn-tour-details" onclick="alert('Joining ${t.title}...')">Details</button>
                </div>
            `;
        });
        box.innerHTML = html;
    });
}
function closeTournamentsModal() { document.getElementById('tournamentsModal').style.display = 'none'; }

function openSupportTicketForm() { closeHelpModal(); let m = document.getElementById('supportModal'); if (m) m.style.display = 'flex'; switchSupportTab('new'); }
function closeSupportModal() { document.getElementById('supportModal').style.display = 'none'; }

function switchSupportTab(tab) {
    let btn1 = document.getElementById('tabMyTicketsBtn');
    let btn2 = document.getElementById('tabNewTicketBtn');
    let v1 = document.getElementById('viewUserTickets');
    let v2 = document.getElementById('viewNewTicketForm');

    if (tab === 'tickets') {
        if (btn1) btn1.classList.add('active');
        if (btn2) btn2.classList.remove('active');
        if (v1) v1.style.display = 'block';
        if (v2) v2.style.display = 'none';
        loadUserTickets();
    } else {
        if (btn2) btn2.classList.add('active');
        if (btn1) btn1.classList.remove('active');
        if (v2) v2.style.display = 'block';
        if (v1) v1.style.display = 'none';
    }
}

function previewUserScreenshot(e) {
    let file = e.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('previewImgElem').src = evt.target.result;
        document.getElementById('screenshotPreviewBox').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeAttachedImage() {
    document.getElementById('ticketScreenshot').value = "";
    document.getElementById('screenshotPreviewBox').style.display = 'none';
}

function submitSupportTicket() {
    let category = document.getElementById('ticketCategory').value;
    let message = document.getElementById('ticketMessage').value.trim();
    if (!message) return alert("Please explain your problem!");

    fetch('/api/support/create-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: "demo_user", category, message, screenshot: "" })
    })
    .then(r => r.json())
    .then(d => {
        alert(d.message);
        document.getElementById('ticketMessage').value = "";
        removeAttachedImage();
        switchSupportTab('tickets');
    });
}

function loadUserTickets() {
    fetch('/api/support/tickets?username=demo_user').then(r => r.json()).then(d => {
        let container = document.getElementById('userTicketListContainer');
        if (!container) return;
        if (!d.tickets || d.tickets.length === 0) {
            container.innerHTML = `<p style="color:#6e829c; font-size:13px; text-align:center; padding:25px;">No support tickets created yet.</p>`;
            return;
        }
        let html = '';
        d.tickets.forEach(tk => {
            html += `<div class="ticket-card-item"><div class="tk-header"><span class="tk-id">${tk.id} - ${tk.category}</span><span class="tk-status ${tk.status.toLowerCase()}">${tk.status}</span></div><div class="tk-msg">${tk.message}</div></div>`;
        });
        container.innerHTML = html;
    });
}

function openSettingsModal() { closeMainMenuModal(); document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }
function openTradesHistoryModal() {
    closeMainMenuModal();
    document.getElementById('tradesModal').style.display = 'flex';
    fetch('/api/user/trades').then(r => r.json()).then(d => {
        let box = document.getElementById('lifetimeTradesContainer');
        if (!box) return;
        if (!d.trades || d.trades.length === 0) {
            box.innerHTML = `<p style="text-align:center; padding:30px; color:#8fa0b5;">No trades recorded yet.</p>`;
            return;
        }
        let html = '';
        d.trades.forEach(t => {
            html += `
                <div class="hist-card">
                    <div class="hist-row-top">
                        <span>${t.asset} ${t.direction === 'UP' ? 'UP' : 'DOWN'}</span>
                        <span class="${t.isWin ? 'hist-badge-win' : 'hist-badge-loss'}">${t.isWin ? `+$${t.profit.toFixed(2)}` : `-$${t.amount.toFixed(2)}`}</span>
                    </div>
                    <div class="hist-row-sub"><span>Invest: $${t.amount.toFixed(2)}</span><span>${t.time}</span></div>
                </div>
            `;
        });
        box.innerHTML = html;
    });
}
function closeTradesHistoryModal() { document.getElementById('tradesModal').style.display = 'none'; }

function openPaymentsModal() {
    closeMainMenuModal();
    document.getElementById('paymentsModal').style.display = 'flex';
    fetch('/api/payments').then(r => r.json()).then(d => {
        let box = document.getElementById('lifetimePaymentsContainer');
        if (!box) return;
        let html = '';
        if (d.deposits && d.deposits.length > 0) {
            html += `<div style="font-size:13px; font-weight:800; margin:10px 0 6px; color:#00e676;">Deposits:</div>`;
            d.deposits.forEach(p => {
                html += `<div class="hist-card"><div class="hist-row-top"><span>#${p.id} (${p.method})</span><span class="hist-badge-win">+$${parseFloat(p.amount).toFixed(2)}</span></div><div class="hist-row-sub"><span>${p.status}</span><span>${p.date}</span></div></div>`;
            });
        }
        if (d.withdrawals && d.withdrawals.length > 0) {
            html += `<div style="font-size:13px; font-weight:800; margin:14px 0 6px; color:#f5a623;">Withdrawals:</div>`;
            d.withdrawals.forEach(w => {
                html += `<div class="hist-card"><div class="hist-row-top"><span>#${w.id} (${w.method})</span><span style="color:#f5a623;">-$${parseFloat(w.amount).toFixed(2)}</span></div><div class="hist-row-sub"><span>${w.status}</span><span>${w.date}</span></div></div>`;
            });
        }
        box.innerHTML = html || `<p style="text-align:center; padding:30px; color:#8fa0b5;">No records found.</p>`;
    });
}
function closePaymentsModal() { document.getElementById('paymentsModal').style.display = 'none'; }

function openDepositModal() { let m = document.getElementById('depositModal'); if (m) m.style.display = 'flex'; }
function closeDepositModal() { let m = document.getElementById('depositModal'); if (m) m.style.display = 'none'; }
function resetPan() { panOffset = 0; }
function openAssetModal() { let m = document.getElementById('assetModal'); if (m) m.style.display = 'flex'; }
function closeAssetModal() { let m = document.getElementById('assetModal'); if (m) m.style.display = 'none'; }
function closeResult() { let r = document.getElementById('resultBubble'); if (r) r.style.display = 'none'; }
function closeToast() { let t = document.getElementById('tradeOpenToast'); if (t) t.style.display = 'none'; }
function closeAllDrawers() {}

function toggleTimePopup() { let p = document.getElementById('timeSelectPopup'); if (p) p.style.display = (p.style.display !== 'block') ? 'block' : 'none'; }
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

function changeLanguage(lang) { localStorage.setItem('app_lang', lang); }
function changeTimezone(offset) { currentTimezoneOffset = parseFloat(offset); localStorage.setItem('app_tz', offset); }
function setAppTheme(theme) {
    localStorage.setItem('app_theme', theme);
    let btnDark = document.getElementById('btnThemeDark');
    let btnLight = document.getElementById('btnThemeLight');
    if (theme === 'light') {
        document.body.classList.add('theme-light');
        if (btnLight) btnLight.classList.add('active');
        if (btnDark) btnDark.classList.remove('active');
    } else {
        document.body.classList.remove('theme-light');
        if (btnDark) btnDark.classList.add('active');
        if (btnLight) btnLight.classList.remove('active');
    }
}

function handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.clear();
        window.location.reload();
    }
}

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

// বুটস্ট্র্যাপ
fitCanvas();
selectAsset('BTC');
switchAccount('demo');
fullSyncFromServer();
requestAnimationFrame(render);
setTimeout(hideChartLoader, 600);
