let currentTimeframe = 60;
function setTimeframe(sec) { currentTimeframe = sec; alert('Timeframe set to ' + sec + 's'); }

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
        document.getElementById('balance').innerText = data.balance.toFixed(2);
        let msg = data.isWin ? `Won! Profit earned.` : `Lost! Better luck next time.`;
        document.getElementById('result-msg').innerText = msg;
    });
}
