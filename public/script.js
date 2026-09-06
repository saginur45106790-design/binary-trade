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

// লার্প ইন্টারপোলেশন
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

// -------------------------------------------------------------
// 🌐 মাল্টি-ল্যাঙ্গুয়েজ i18n ডিকশনারি
// -------------------------------------------------------------
const I18N = {
    en: {
        demo: "DEMO", live: "LIVE", deposit: "Deposit", withdrawal: "Withdrawal", payments: "Payments",
        trades: "Trades", settings: "Settings", logout: "Logout", quickTrading: "Quick trading",
        timer: "Timer", investment: "Investment", payout: "Payout", up: "Up", down: "Down",
        pendingTrade: "PENDING TRADE", beginningOfTrade: "ℹ️ Beginning of trade", endOfTrade: "End of trade",
        sellTrade: "Sell the trade", activeTrades: "Active Trades", liveAccount: "Live Account",
        demoAccount: "Demo Account", interface: "Interface:", language: "Language", timezone: "Timezone",
        theme: "Theme", darkTheme: "Dark Theme", lightTheme: "White Theme"
    },
    bn: {
        demo: "ডেমো", live: "লাইভ", deposit: "ডিপোজিট", withdrawal: "উইথড্র", payments: "পেমেন্টস",
        trades: "ট্রেডস", settings: "সেটিংস", logout: "লগআউট", quickTrading: "কুইক ট্রেডিং",
        timer: "টাইমার", investment: "ইনভেস্টমেন্ট", payout: "পেআউট", up: "আপ (Up)", down: "ডাউন (Down)",
        pendingTrade: "পেন্ডিং ট্রেড", beginningOfTrade: "ℹ️ ট্রেড শুরু", endOfTrade: "ট্রেড সমাপ্তি",
        sellTrade: "আর্লি সেল করুন", activeTrades: "সক্রিয় ট্রেড", liveAccount: "লাইভ একাউন্ট",
        demoAccount: "ডেমো একাউন্ট", interface: "ইন্টারফেস:", language: "ভাষা (Language)", timezone: "টাইমজোন",
        theme: "থিম (Theme)", darkTheme: "ডার্ক থিম", lightTheme: "হোয়াইট থিম"
    },
    hi: {
        demo: "डेमो", live: "लाइव", deposit: "जमा करें", withdrawal: "निकासी", payments: "भुगतान",
        trades: "ट्रेड्स", settings: "सेटिंग्स", logout: "लॉग आउट", quickTrading: "त्वरित ट्रेडिंग",
        timer: "टाइमर", investment: "निवेश", payout: "पेआउट", up: "ऊपर (Up)", down: "नीचे (Down)",
        pendingTrade: "लंबित ट्रेड", beginningOfTrade: "ℹ️ ट्रेड प्रारंभ", endOfTrade: "ट्रेड समाप्ति",
        sellTrade: "ट्रेड बेचें", activeTrades: "सक्रिय ट्रेड्स", liveAccount: "लाइव खाता",
        demoAccount: "डेमो खाता", interface: "इंटरफ़ेस:", language: "भाषा", timezone: "समय क्षेत्र",
        theme: "थीम", darkTheme: "डार्क थीम", lightTheme: "व्हाइट थीम"
    },
    ar: {
        demo: "تجريبي", live: "حقيقي", deposit: "إيداع", withdrawal: "سحب", payments: "المدفوعات",
        trades: "الصفقات", settings: "الإعدادات", logout: "تسجيل الخروج", quickTrading: "التداول السريع",
        timer: "المؤقت", investment: "الاستثمار", payout: "العائد", up: "صعود", down: "هبوط",
        pendingTrade: "صفقة معلقة", beginningOfTrade: "ℹ️ بداية الصفقة", endOfTrade: "نهاية الصفقة",
        sellTrade: "بيع الصفقة", activeTrades: "الصفقات النشطة", liveAccount: "الحساب الحقيقي",
        demoAccount: "الحساب التجريبي", interface: "الواجهة:", language: "اللغة", timezone: "المنطقة الزمنية",
        theme: "المظهر", darkTheme: "الوضع الداكن", lightTheme: "الوضع الفاتح"
    },
    es: {
        demo: "DEMO", live: "REAL", deposit: "Depósito", withdrawal: "Retiro", payments: "Pagos",
        trades: "Operaciones", settings: "Ajustes", logout: "Cerrar sesión", quickTrading: "Trading rápido",
        timer: "Tiempo", investment: "Inversión", payout: "Pago", up: "Arriba", down: "Abajo",
        pendingTrade: "ORDEN PENDIENTE", beginningOfTrade: "ℹ️ Inicio de operación", endOfTrade: "Fin de operación",
        sellTrade: "Vender operación", activeTrades: "Operaciones activas", liveAccount: "Cuenta real",
        demoAccount: "Cuenta demo", interface: "Interfaz:", language: "Idioma", timezone: "Zona horaria",
        theme: "Tema", darkTheme: "Tema oscuro", lightTheme: "Tema claro"
    }
};

let currentLang = localStorage.getItem('app_lang') || 'en';
let currentTimezoneOffset = parseFloat(localStorage.getItem('app_tz') || '6'); // ডিফল্ট ঢাকা UTC+6
let currentTheme = localStorage.getItem('app_theme') || 'dark';

function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('app_lang', lang);
    let dict = I18N[lang] || I18N.en;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        let key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerText = dict[key];
    });

    let sel = document.getElementById('langSelect');
    if (sel) sel.value = lang;
}

function changeLanguage(lang) {
    applyLanguage(lang);
}

// -------------------------------------------------------------
// ⏰ টাইমজোন হ্যান্ডলার
// -------------------------------------------------------------
function changeTimezone(offset) {
    currentTimezoneOffset = parseFloat(offset);
    localStorage.setItem('app_tz', offset);
    syncClock();
}

// -------------------------------------------------------------
// 🎨 থিম সুইচার (ডার্ক এবং হোয়াইট থিম)
// -------------------------------------------------------------
function setAppTheme(theme) {
    currentTheme = theme;
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

// ক্যানভাস সাইজ
function fitCanvas() {
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
}
function hideChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) setTimeout(() => { el.classList.remove('active'); }, 300);
}

// টাচ প্যান ও জুম
let startX = 0;
let isPanning = false;

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
        checkTradeClick(e.touches[0].clientX, e.touches[0].clientY);
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

function checkTradeClick(touchX, touchY) {
    const rect = canvas.getBoundingClientRect();
    let x = touchX - rect.left;
    let y = touchY - rect.top;

    let match = activeTrades.find(t => t.asset === activeAssetKey);
    if (match) {
        activeSellTrade = match;
        let card = document.getElementById('sellTradeCard');
        card.style.display = 'flex';
        card.style.left = Math.min(x, rect.width - 150) + 'px';
        card.style.top = Math.max(20, y - 45) + 'px';
        document.getElementById('sellRefundVal').innerText = `${(match.amount * 0.25).toFixed(2)} $`;
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
        updateTradeBadges();
    });
}

function updateTradeBadges() {
    let count = activeTrades.length;
    document.getElementById('openTradesBadge').innerText = count;
    document.getElementById('drawerCount').innerText = count;
    updateTradesDrawerList();
}

function updateTradesDrawerList() {
    let box = document.getElementById('activeTradesList');
    if (activeTrades.length === 0) {
        box.innerHTML = `<p style="padding:15px; color:#6e829c; font-size:12px; text-align:center;">No active trades</p>`;
        return;
    }
    let html = '';
    activeTrades.forEach(t => {
        html += `<div style="padding:10px 14px; border-bottom:1px solid #283348; display:flex; justify-content:space-between; align-items:center;">
            <span>${t.asset} ${t.direction === 'UP' ? '🟢 UP' : '🔴 DOWN'}</span>
            <b>$${t.amount}</b>
        </div>`;
    });
    box.innerHTML = html;
}

function toggleBottomTrades() {
    let el = document.getElementById('bottomTradesDrawer');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function stepAmt(delta) {
    currentInvestAmount = Math.max(1, currentInvestAmount + delta);
    document.getElementById('invAmtInput').value = currentInvestAmount;
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
    document.getElementById('calcPayout').innerText = `${total} $`;
}

function toggleAccountModal() {
    let m = document.getElementById('accountModal');
    m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}
function closeAccountModal(e) {
    if (e.target.id === 'accountModal') document.getElementById('accountModal').style.display = 'none';
}

function switchAccount(type) {
    currentAccount = type;
    document.getElementById('accountModal').style.display = 'none';

    let lbl = document.getElementById('accountLabel');
    let iconWrap = document.getElementById('accountIcon');
    let watermark = document.getElementById('chartWatermark');

    let optLive = document.getElementById('optLiveCard');
    let optDemo = document.getElementById('optDemoCard');
    let radioLive = document.getElementById('radioLiveCircle');
    let radioDemo = document.getElementById('radioDemoCircle');

    if (type === 'live') {
        lbl.innerText = I18N[currentLang]?.live || "LIVE";
        lbl.className = "acc-label live";
        iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#00b074"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
        updateBalanceUI(liveBalance);

        optLive.classList.add('active');
        optDemo.classList.remove('active');
        radioLive.classList.add('active');
        radioDemo.classList.remove('active');

        watermark.style.display = 'none';
    } else {
        lbl.innerText = I18N[currentLang]?.demo || "DEMO";
        lbl.className = "acc-label demo";
        iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#f5a623"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`;
        updateBalanceUI(demoBalance);

        optDemo.classList.add('active');
        optLive.classList.remove('active');
        radioDemo.classList.add('active');
        radioLive.classList.remove('active');

        watermark.style.display = 'block';
        watermark.innerText = 'DEMO';
    }

    fetch('/api/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', type })
    });
}

function resetDemoBalance(event) {
    event.stopPropagation();
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
    document.getElementById('accountBal').innerText = str;
    if (currentAccount === 'live') {
        liveBalance = num;
        document.getElementById('modalLiveBal').innerText = str;
    } else {
        demoBalance = num;
        document.getElementById('modalDemoBal').innerText = str;
    }
}

// -------------------------------------------------------------
// 📋 মেনু মডাল হ্যান্ডলার (স্ক্রিনশট ৮৮৫)
// -------------------------------------------------------------
function openMainMenuModal() {
    document.getElementById('mainMenuModal').style.display = 'flex';
}
function closeMainMenuModal() {
    document.getElementById('mainMenuModal').style.display = 'none';
}

// -------------------------------------------------------------
// ⚙️ সেটিংস মডাল হ্যান্ডলার (স্ক্রিনশট ৮৮৮)
// -------------------------------------------------------------
function openSettingsModal() {
    closeMainMenuModal();
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('langSelect').value = currentLang;
    document.getElementById('tzSelect').value = currentTimezoneOffset;
    setAppTheme(currentTheme);
}
function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

// -------------------------------------------------------------
// 📊 লাইফটাইম ট্রেডস হিস্ট্রি হ্যান্ডলার
// -------------------------------------------------------------
function openTradesHistoryModal() {
    closeMainMenuModal();
    document.getElementById('tradesModal').style.display = 'flex';
    loadLifetimeTrades();
}
function closeTradesHistoryModal() {
    document.getElementById('tradesModal').style.display = 'none';
}

function loadLifetimeTrades() {
    fetch('/api/user/trades')
    .then(r => r.json())
    .then(d => {
        let box = document.getElementById('lifetimeTradesContainer');
        if (!d.trades || d.trades.length === 0) {
            box.innerHTML = `<p style="text-align:center; padding:30px; color:#8fa0b5;">No trades recorded yet.</p>`;
            return;
        }

        let html = '';
        d.trades.forEach(t => {
            html += `
                <div class="hist-card">
                    <div class="hist-row-top">
                        <span>${t.asset} ${t.direction === 'UP' ? '🟢 UP' : '🔴 DOWN'}</span>
                        <span class="${t.isWin ? 'hist-badge-win' : 'hist-badge-loss'}">${t.isWin ? `+$${t.profit.toFixed(2)}` : `-$${t.amount.toFixed(2)}`}</span>
                    </div>
                    <div class="hist-row-sub">
                        <span>Invest: $${t.amount.toFixed(2)} | Entry: ${t.entryPrice} -> Exit: ${t.exitPrice}</span>
                        <span>${t.time}</span>
                    </div>
                </div>
            `;
        });
        box.innerHTML = html;
    });
}

// -------------------------------------------------------------
// 🧾 লাইফটাইম পেমেন্টস (ডিপোজিট ও উইথড্র) হ্যান্ডলার
// -------------------------------------------------------------
function openPaymentsModal() {
    closeMainMenuModal();
    document.getElementById('paymentsModal').style.display = 'flex';
    loadLifetimePayments();
}
function closePaymentsModal() {
    document.getElementById('paymentsModal').style.display = 'none';
}

function loadLifetimePayments() {
    fetch('/api/payments')
    .then(r => r.json())
    .then(d => {
        let box = document.getElementById('lifetimePaymentsContainer');
        let html = '';

        if (d.deposits && d.deposits.length > 0) {
            html += `<div style="font-size:13px; font-weight:800; margin:10px 0 6px; color:#00e676;">Deposits:</div>`;
            d.deposits.forEach(p => {
                html += `
                    <div class="hist-card">
                        <div class="hist-row-top">
                            <span>#${p.id} (${p.method})</span>
                            <span class="hist-badge-win">+$${parseFloat(p.amount).toFixed(2)}</span>
                        </div>
                        <div class="hist-row-sub">
                            <span>${p.status}</span>
                            <span>${p.date}</span>
                        </div>
                    </div>
                `;
            });
        }

        if (d.withdrawals && d.withdrawals.length > 0) {
            html += `<div style="font-size:13px; font-weight:800; margin:14px 0 6px; color:#f5a623;">Withdrawals:</div>`;
            d.withdrawals.forEach(w => {
                html += `
                    <div class="hist-card">
                        <div class="hist-row-top">
                            <span>#${w.id} (${w.method})</span>
                            <span style="color:#f5a623;">-$${parseFloat(w.amount).toFixed(2)}</span>
                        </div>
                        <div class="hist-row-sub">
                            <span>${w.status}</span>
                            <span>${w.date}</span>
                        </div>
                    </div>
                `;
            });
        }

        box.innerHTML = html || `<p style="text-align:center; padding:30px; color:#8fa0b5;">No payment records found.</p>`;
    });
}

// -------------------------------------------------------------
// 🚪 লগআউট হ্যান্ডলার
// -------------------------------------------------------------
function handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.clear();
        alert("Logged out successfully.");
        window.location.reload();
    }
}

function openDepositModal() { document.getElementById('depositModal').style.display = 'flex'; }
function closeDepositModal() { document.getElementById('depositModal').style.display = 'none'; }

function setDepMethod(method, number, note) {
    selectedDepMethod = method;
    document.querySelectorAll('.dep-pill').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('depMethodLabel').innerText = `${method} ${note}:`;
    document.getElementById('depTargetNumber').innerText = number;
}

function submitDepositForm() {
    let amount = document.getElementById('depAmountInput').value;
    let sender = document.getElementById('depSenderInput').value;
    let trx = document.getElementById('depTrxInput').value;

    if (!amount || !trx) return alert("Please enter amount and TrxID!");

    fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'demo_user',
            method: selectedDepMethod,
            amount,
            senderNumber: sender,
            trxId: trx
        })
    })
    .then(r => r.json())
    .then(d => {
        alert(d.message);
        if (d.success) {
            document.getElementById('depAmountInput').value = '';
            document.getElementById('depSenderInput').value = '';
            document.getElementById('depTrxInput').value = '';
            closeDepositModal();
        }
    });
}

function toggleTimePopup() {
    let p = document.getElementById('timeSelectPopup');
    let willOpen = (p.style.display !== 'block');
    p.style.display = willOpen ? 'block' : 'none';
}

function switchPopupTab(tab) {
    currentMode = tab;
    if (tab === 'time') {
        document.getElementById('tabTimeBtn').classList.add('active');
        document.getElementById('tabTimerBtn').classList.remove('active');
        document.getElementById('gridTimeMode').style.display = 'grid';
        document.getElementById('gridTimerMode').style.display = 'none';
        document.getElementById('dockTimeLabel').innerText = I18N[currentLang]?.time || 'Time';
        document.getElementById('dockTimeValue').innerText = selectedTimeValue || '00:01';
    } else {
        document.getElementById('tabTimerBtn').classList.add('active');
        document.getElementById('tabTimeBtn').classList.remove('active');
        document.getElementById('gridTimerMode').style.display = 'grid';
        document.getElementById('gridTimeMode').style.display = 'none';
        document.getElementById('dockTimeLabel').innerText = I18N[currentLang]?.timer || 'Timer';
        document.getElementById('dockTimeValue').innerText = selectedTimerDisplay;
    }
}

function selectTimer(sec, display) {
    selectedTimerSeconds = sec;
    selectedTimerDisplay = display;
    document.getElementById('dockTimeValue').innerText = display;
    document.querySelectorAll('#gridTimerMode button').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    document.getElementById('timeSelectPopup').style.display = 'none';
}

// -------------------------------------------------------------
// টাইমজোন অনুযায়ী সঠিক সময় ফরম্যাট
// -------------------------------------------------------------
function syncClock() {
    let now = new Date();
    // ব্যবহারকারীর নির্বাচিত টাইমজোনে রূপান্তর
    let utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    let targetTime = new Date(utcMs + (3600000 * currentTimezoneOffset));

    let hh = String(targetTime.getHours()).padStart(2, '0');
    let mm = String(targetTime.getMinutes()).padStart(2, '0');
    let ss = String(targetTime.getSeconds()).padStart(2, '0');
    let sign = currentTimezoneOffset >= 0 ? '+' : '';
    document.getElementById('liveUtcClock').innerHTML = `<span class="live-dot"></span> ${hh}:${mm}:${ss} UTC${sign}${currentTimezoneOffset}`;

    let sec = Math.floor(now.getTime() / 1000);
    remainingCountdown = 60 - (sec % 60);

    if (currentMode === 'time' && selectedTimeValue) {
        document.getElementById('endTradeTimeText').innerText = selectedTimeValue;
    } else {
        let expDate = new Date(targetTime.getTime() + selectedTimerSeconds * 1000);
        document.getElementById('endTradeTimeText').innerText = `${String(expDate.getHours()).padStart(2,'0')}:${String(expDate.getMinutes()).padStart(2,'0')}`;
    }

    for (let i = activeTrades.length - 1; i >= 0; i--) {
        let trade = activeTrades[i];
        if (sec >= trade.expireTime) {
            settleTrade(trade);
            activeTrades.splice(i, 1);
            updateTradeBadges();
        }
    }

    if (activeSellTrade) {
        let diffSec = Math.max(0, activeSellTrade.expireTime - sec);
        let remM = String(Math.floor(diffSec / 60)).padStart(2, '0');
        let remS = String(diffSec % 60).padStart(2, '0');
        document.getElementById('sellTimeRem').innerText = `${remM}:${remS}`;
    }
}
setInterval(syncClock, 1000);

function settleTrade(trade) {
    let exitP = candles.length > 0 ? candles[candles.length - 1].close : trade.entryPrice;
    document.getElementById('sellTradeCard').style.display = 'none';

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
        bubble.className = data.isWin ? "result-popup-bubble" : "result-popup-bubble loss";
        document.getElementById('resProfitVal').innerText = data.isWin ? `+${data.profit} $` : `0.00 $`;
        bubble.style.display = 'block';
        bubble.style.top = '48%';
        bubble.style.left = '35%';
        setTimeout(() => { bubble.style.display = 'none'; }, 4000);
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
    activeDecimals = (key === 'XRP' || key === 'DOGE' || key === 'ADA') ? 4 : (key === 'TON' ? 3 : 2);
    document.getElementById('curName').innerText = `${key}/USD (OTC)`;

    fetch(`/api/history/${key}`)
    .then(r => r.json())
    .then(data => {
        if (data.success && data.meta.ticker === activeAssetKey) {
            candles = data.history.map(c => ({...c}));
            activeDecimals = data.meta.decimals;
            currentPayout = data.meta.payout;
            document.getElementById('curPayout').innerText = `${currentPayout}% ▼`;
            updatePayoutCalc();

            let lastP = candles[candles.length - 1].close;
            targetLivePrice = lastP;
            renderLivePrice = lastP;
            isLoadingAsset = false;
            hideChartLoader();
        }
    }).catch(() => {
        isLoadingAsset = false;
        hideChartLoader();
    });
}

// -------------------------------------------------------------
// ক্যানভাস রেন্ডার লুপ (ডার্ক ও হোয়াইট থিম রেসপন্সিভ)
// -------------------------------------------------------------
function render() {
    requestAnimationFrame(render);

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

    // ক্যান্ডেল আঁকা
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

    // লাইভ ড্যাশ লাইন
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, liveY);
    ctx.lineTo(width - 55, liveY);
    ctx.stroke();
    ctx.setLineDash([]);

    // প্রাইস ব্যাজ
    ctx.fillStyle = '#0070f3';
    ctx.beginPath();
    ctx.roundRect(width - 56, liveY - 10, 54, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(last.close.toFixed(activeDecimals), width - 51, liveY + 4);

    // এক্সপায়ারেশন ড্যাশ লাইন
    let expX = baseRightX + (candleWidth + candleSpacing);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(expX, 0);
    ctx.lineTo(expX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // ১ মিনিটের কাউন্টডাউন পিল
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

    // বটম টাইম স্কেল
    ctx.fillStyle = isLightTheme ? '#57606a' : '#6e829c';
    ctx.font = '10px sans-serif';
    visibleCandles.forEach(v => {
        if (v.index % 8 === 0) {
            let d = new Date(v.time * 1000);
            let lbl = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            ctx.fillText(lbl, Math.floor(v.x - 12), height - 6);
        }
    });

    // ট্রেড মার্কার
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

// WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

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
            if (last.time === item.candle.time) {
                last.high = Math.max(last.high, item.candle.high);
                last.low = Math.min(last.low, item.candle.low);
            } else {
                candles.push({ ...item.candle });
                if (candles.length > 800) candles.shift();
            }
        }
    }
};

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
        document.getElementById('toastMsg').innerText = `Trade opened with price: ${data.entryPrice} ${activeAssetKey}/USD (OTC)`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    });
}

function resetPan() { panOffset = 0; }
function openAssetModal() { document.getElementById('assetModal').style.display = 'flex'; }
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }
function closeResult() { document.getElementById('resultBubble').style.display = 'none'; }
function closeToast() { document.getElementById('tradeOpenToast').style.display = 'none'; }
function closeAllDrawers() {
    document.getElementById('bottomTradesDrawer').style.display = 'none';
    document.getElementById('sellTradeCard').style.display = 'none';
}
function toggleToolsMenu() {}

// ইনিশিয়ালাইজেশন
fitCanvas();
applyLanguage(currentLang);
setAppTheme(currentTheme);
selectAsset('BTC');
switchAccount('demo');
requestAnimationFrame(render);
