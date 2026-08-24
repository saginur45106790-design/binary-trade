let currentTimeframe = 60;
function setTimeframe(sec) {
    currentTimeframe = sec;
    document.querySelectorAll('.timeframes button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

const ws = new WebSocket('ws://' + window.location.host);
ws.onmessage = function(event) {
    let data = JSON.parse(event.data);
    if(data.type === 'PRICE_UPDATE') {
        document.getElementById('price').innerText = data.price;
    }
};

function placeTrade(direction) {
    let amount = document.getElementById('amount').value;
    fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo_user', amount: Number(amount), timeframe: currentTimeframe })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('balance').innerText = data.balance.toFixed(2);
            let msg = data.isWin ? `🎉 Won! Profit earned.` : `❌ Lost! Better luck next time.`;
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
        location.reload();
    });
}
