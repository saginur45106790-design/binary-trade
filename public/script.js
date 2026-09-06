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
let attachedScreenshotBase64 = "";

const I18N = {
    en: {
        demo: "DEMO", live: "LIVE", deposit: "Deposit", withdrawal: "Withdrawal", payments: "Payments",
        trades: "Trades", settings: "Settings", logout: "Logout", quickTrading: "Quick trading",
        timer: "Timer", investment: "Investment", payout: "Payout", up: "Up", down: "Down",
        pendingTrade: "PENDING TRADE", beginningOfTrade: "Beginning of trade", endOfTrade: "End of trade",
        sellTrade: "Sell the trade", activeTrades: "Active Trades", liveAccount: "Live Account",
        demoAccount: "Demo Account", interface: "Interface:", language: "Language", timezone: "Timezone",
        theme: "Theme", darkTheme: "Dark Theme", lightTheme: "White Theme"
    },
    bn: {
        demo: "ডেমো", live: "লাইভ", deposit: "ডিপোজিট", withdrawal: "উইথড্র", payments: "পেমেন্টস",
        trades: "ট্রেডস", settings: "সেটিংস", logout: "লগআউট", quickTrading: "কুইক ট্রেডিং",
        timer: "টাইমার", investment: "ইনভেস্টমেন্ট", payout: "পেআউট", up: "আপ (Up)", down: "ডাউন (Down)",
        pendingTrade: "পেন্ডিং ট্রেড", beginningOfTrade: "ট্রেড শুরু", endOfTrade: "ট্রেড সমাপ্তি",
        sellTrade: "আর্লি সেল করুন", activeTrades: "সক্রিয় ট্রেড", liveAccount: "লাইভ একাউন্ট",
        demoAccount: "ডেমো একাউন্ট", interface: "ইন্টারফেস:", language: "ভাষা", timezone: "টাইমজোন",
        theme: "থিম", darkTheme: "ডার্ক থিম", lightTheme: "হোয়াইট থিম"
    }
};

let currentLang = localStorage.getItem('app_lang') || 'en';
let currentTimezoneOffset = parseFloat(localStorage.getItem('app_tz') || '6');
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

function changeLanguage(lang) { applyLanguage(lang); }

function changeTimezone(offset) {
    currentTimezoneOffset = parseFloat(offset);
    localStorage.setItem('app_tz', offset);
    syncClock();
}

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
}
function hideChartLoader() {
    let el = document.getElementById('chartLoader');
    if (el) el.classList.remove('active');
}

// টাচ প্যান ও জুম
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
}

function checkTradeClick(touchX, touchY) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = touchX - rect.left;
    let y = touchY - rect.top;

    let match = activeTrades.find(t => t.asset === activeAssetKey);
    if (match) {
        activeSellTrade = match;
        let card = document.getElementById('sellTradeCard');
        if (card) {
            card.style.display = 'flex';
            card.style.left = Math.min(x, rect.width - 150) + 'px';
            card.style.top = Math.max(20, y - 45) + 'px';
            let refVal = document.getElementById('sellRefundVal');
            if (refVal) refVal.innerText = `${(match.amount * 0.25).toFixed(2)} $`;
        }
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
        let card = document.getElementById('sellTradeCard');
        if (card) card.style.display = 'none';
        updateTradeBadges();
    });
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
        if (lbl) { lbl.innerText = I18N[currentLang]?.live || "LIVE"; lbl.className = "acc-label live"; }
        if (iconWrap) iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#00b074"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
        updateBalanceUI(liveBalance);

        if (optLive) optLive.classList.add('active');
        if (optDemo) optDemo.classList.remove('active');
        if (radioLive) radioLive.classList.add('active');
        if (radioDemo) radioDemo.classList.remove('active');

        if (watermark) watermark.style.display = 'none';
    } else {
        if (lbl) { lbl.innerText = I18N[currentLang]?.demo || "DEMO"; lbl.className = "acc-label demo"; }
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

// -------------------------------------------------------------
// মোডাল হ্যান্ডলারস
// -------------------------------------------------------------
function openMainMenuModal() {
    let m = document.getElementById('mainMenuModal');
    if (m) m.style.display = 'flex';
}
function closeMainMenuModal() {
    let m = document.getElementById('mainMenuModal');
    if (m) m.style.display = 'none';
}

function openHelpModal() {
    let m = document.getElementById('helpModal');
    if (m) m.style.display = 'flex';
}
function closeHelpModal() {
    let m = document.getElementById('helpModal');
    if (m) m.style.display = 'none';
}

function openTournamentsModal() {
    let m = document.getElementById('tournamentsModal');
    if (m) m.style.display = 'flex';
    loadTournamentsData();
}
function closeTournamentsModal() {
    let m = document.getElementById('tournamentsModal');
    if (m) m.style.display = 'none';
}

function loadTournamentsData() {
    fetch('/api/tournaments')
    .then(r => r.json())
    .then(d => {
        let box = document.getElementById('tournamentsListContainer');
        if (!box) return;
        let html = '';
        d.tournaments.forEach(t => {
            html += `
                <div class="tournament-card-item">
                    <span class="tour-pill-badge">${t.status}</span>
                    <div class="tour-content-row">
                        <span class="tour-name">${t.title}</span>
                        <div class="tour-prize-block">
                            <div style="font-size:10px; color:#7e92aa; font-weight:700;">PRIZE POOL</div>
                            <div class="tour-prize-val">${t.prizePool}</div>
                        </div>
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

function openSupportTicketForm() {
    closeHelpModal();
    let m = document.getElementById('supportModal');
    if (m) m.style.display = 'flex';
    switchSupportTab('new');
}
function closeSupportModal() {
    let m = document.getElementById('supportModal');
    if (m) m.style.display = 'none';
}

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
        attachedScreenshotBase64 = evt.target.result;
        let img = document.getElementById('previewImgElem');
        let box = document.getElementById('screenshotPreviewBox');
        if (img) img.src = attachedScreenshotBase64;
        if (box) box.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeAttachedImage() {
    attachedScreenshotBase64 = "";
    let inp = document.getElementById('ticketScreenshot');
    let box = document.getElementById('screenshotPreviewBox');
    if (inp) inp.value = "";
    if (box) box.style.display = 'none';
}

function submitSupportTicket() {
    let catElem = document.getElementById('ticketCategory');
    let msgElem = document.getElementById('ticketMessage');
    let category = catElem ? catElem.value : "General";
    let message = msgElem ? msgElem.value.trim() : "";

    if (!message) return alert("Please explain your problem!");

    fetch('/api/support/create-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: "demo_user",
            category,
            message,
            screenshot: attachedScreenshotBase64
        })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            alert(d.message);
            if (msgElem) msgElem.value = "";
            removeAttachedImage();
            switchSupportTab('tickets');
        } else {
            alert(d.message);
        }
    });
}

function loadUserTickets() {
    fetch('/api/support/tickets?username=demo_user')
    .then(r => r.json())
    .then(d => {
        let container = document.getElementById('userTicketListContainer');
        if (!container) return;

        if (!d.tickets || d.tickets.length === 0) {
            container.innerHTML = `<p style="color:#6e829c; font-size:13px; text-align:center; padding:25px;">No support tickets created yet.</p>`;
            return;
        }

        let html = '';
        d.tickets.forEach(tk => {
            let statusCls = tk.status.toLowerCase();
            let shotHtml = tk.screenshot ? `<img src="${tk.screenshot}" class="tk-shot-thumb" onclick="window.open('${tk.screenshot}')" title="Click to view">` : '';

            let repliesHtml = '';
            if (tk.replies && tk.replies.length > 0) {
                tk.replies.forEach(rp => {
                    repliesHtml += `
                        <div class="tk-reply-box">
                            <div style="font-size:11px; font-weight:800; color:#0070f3; display:flex; justify-content:space-between;">
                                <span>${rp.sender}</span>
                                <span>${rp.time}</span>
                            </div>
                            <div style="font-size:13px; color:#ffffff; margin-top:4px;">${rp.message}</div>
                        </div>
                    `;
                });
            } else {
                repliesHtml = `<div style="font-size:11px; color:#f5a623; margin-top:8px;">Under review by support.</div>`;
            }

            html += `
                <div class="ticket-card-item">
                    <div class="tk-header">
                        <span class="tk-id">${tk.id} - ${tk.category}</span>
                        <span class="tk-status ${statusCls}">${tk.status}</span>
                    </div>
                    <div class="tk-msg">${tk.message}</div>
                    ${shotHtml}
                    ${repliesHtml}
                </div>
            `;
        });
        container.innerHTML = html;
    });
}

function openSettingsModal() {
    closeMainMenuModal();
    let m = document.getElementById('settingsModal');
    if (m) m.style.display = 'flex';
    let l = document.getElementById('langSelect');
    let tz = document.getElementById('tzSelect');
    if (l) l.value = currentLang;
    if (tz) tz.value = currentTimezoneOffset;
    setAppTheme(currentTheme);
}
function closeSettingsModal() {
    let m = document.getElementById('settingsModal');
    if (m) m.style.display = 'none';
}

function openTradesHistoryModal() {
    closeMainMenuModal();
    let m = document.getElementById('tradesModal');
    if (m) m.style.display = 'flex';
    loadLifetimeTrades();
}
function closeTradesHistoryModal() {
    let m = document.getElementById('tradesModal');
    if (m) m.style.display = 'none';
}

function loadLifetimeTrades() {
    fetch('/api/user/trades')
    .then(r => r.json())
    .then(d => {
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
                    <div class="hist-row-sub">
                        <span>Invest: $${t.amount.toFixed(2)}</span>
                        <span>${t.time}</span>
                    </div>
                </div>
            `;
        });
        box.innerHTML = html;
    });
}

function openPaymentsModal() {
    closeMainMenuModal();
    let m = document.getElementById('paymentsModal');
    if (m) m.style.display = 'flex';
    loadLifetimePayments();
}
function closePaymentsModal() {
    let m = document.getElementById('paymentsModal');
    if (m) m.style.display = 'none';
}

function loadLifetimePayments() {
    fetch('/api/payments')
    .then(r => r.json())
    .then(d => {
        let box = document.getElementById('lifetimePaymentsContainer');
        if (!box) return;
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
                        <div class="hist-row-sub"><span>${p.status}</span><span>${p.date}</span></div>
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
                        <div class="hist-row-sub"><span>${w.status}</span><span>${w.date}</span></div>
                    </div>
                `;
            });
        }
        box.innerHTML = html || `<p style="text-align:center; padding:30px; color:#8fa0b5;">No records found.</p>`;
    });
}

function handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.clear();
        window.location.reload();
    }
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
        if (lbl) lbl.innerText = I18N[currentLang]?.time || 'Time';
        if (val) val.innerText = selectedTimeValue || '00:01';
    } else {
        if (b1) b1.classList.add('active');
        if (b2) b2.classList.remove('active');
        if (g1) g1.style.display = 'grid';
        if (g2) g2.style.display = 'none';
        if (lbl) lbl.innerText = I18N[currentLang]?.timer || 'Timer';
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
    let utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    let targetTime = new Date(utcMs + (3600000 * currentTimezoneOffset));

    let hh = String(targetTime.getHours()).padStart(2, '0');
    let mm = String(targetTime.getMinutes()).padStart(2, '0');
    let ss = String(targetTime.getSeconds()).padStart(2, '0');
    let sign = currentTimezoneOffset >= 0 ? '+' : '';
    let clock = document.getElementById('liveUtcClock');
    if (clock) {
        clock.innerHTML = `<span class="live-dot"></span> ${hh}:${mm}:${ss} UTC${sign}${currentTimezoneOffset}`;
    }

    let sec = Math.floor(now.getTime() / 1000);
    remainingCountdown = 60 - (sec % 60);

    let endText = document.getElementById('endTradeTimeText');
    if (endText) {
        let expDate = new Date(targetTime.getTime() + selectedTimerSeconds * 1000);
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
    activeDecimals = (key === 'XRP' || key === 'DOGE' || key === 'ADA') ? 4 : (key === 'TON' ? 3 : 2);
    let cur = document.getElementById('curName');
    if (cur) cur.innerText = `${key}/USD (OTC)`;

    fetch(`/api/history/${key}`)
    .then(r => r.json())
    .then(data => {
        if (data.success && data.meta.ticker === activeAssetKey) {
            candles = data.history.map(c => ({...c}));
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
// ক্যানভাস রেন্ডার লুপ
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
applyLanguage(currentLang);
setAppTheme(currentTheme);
selectAsset('BTC');
switchAccount('demo');
requestAnimationFrame(render);
setTimeout(hideChartLoader, 600); // নিশ্চিন্ত আনলক
