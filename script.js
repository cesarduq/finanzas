// --- ESTADO INICIAL ---
let transactions = JSON.parse(localStorage.getItem('finanzasV7')) || []; 
let assetsChart = null;

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const form = document.getElementById('formTransaction');
const dateInput = document.getElementById('inputDate');

// Iniciar
dateInput.valueAsDate = new Date();
checkTheme();
renderAll();
toggleFormFields();

// --- TEMA OSCURO ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.getElementById('iconMode');
    icon.className = isDark ? 'fa-solid fa-sun text-warning' : 'fa-solid fa-moon text-secondary';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    renderChart(calculateBalances().bal); 
}

function checkTheme() {
    const theme = localStorage.getItem('theme');
    const icon = document.getElementById('iconMode');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        icon.className = 'fa-solid fa-sun text-warning';
    } else {
        icon.className = 'fa-solid fa-moon text-secondary';
    }
}

// --- IMPORTAR / EXPORTAR ---
function exportData() {
    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_Finanzas_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (Array.isArray(json)) {
                transactions = json;
                saveData();
                Swal.fire({icon: 'success', title: 'Restaurado', text: 'Datos cargados.', timer: 1500, showConfirmButton: false});
            }
        } catch (err) { Swal.fire('Error', 'Archivo inválido', 'error'); }
    };
    reader.readAsText(file);
    input.value = '';
}

// --- LOGICA FORMULARIO ---
function toggleFormFields() {
    const type = document.getElementById('inputType').value;
    const groupPerson = document.getElementById('groupPerson');
    const inputPerson = document.getElementById('inputPerson');
    
    if (type === 'loan_out' || type === 'loan_payment') {
        groupPerson.classList.remove('d-none');
        inputPerson.setAttribute('required', 'required');
    } else {
        groupPerson.classList.add('d-none');
        inputPerson.removeAttribute('required');
        inputPerson.value = '';
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('inputType').value;
    const amount = parseFloat(document.getElementById('inputAmount').value);
    
    if (amount <= 0) { Swal.fire('Error', 'Monto inválido', 'error'); return; }

    const newTx = {
        id: Date.now(),
        date: document.getElementById('inputDate').value,
        type: type,
        account: document.getElementById('inputAccount').value,
        amount: amount,
        desc: document.getElementById('inputDesc').value,
        person: document.getElementById('inputPerson').value || null
    };

    transactions.unshift(newTx);
    saveData();
    form.reset();
    dateInput.valueAsDate = new Date();
    toggleFormFields();
    
    const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true});
    Toast.fire({icon: 'success', title: 'Guardado'});
});

// --- CORE ---
function saveData() {
    localStorage.setItem('finanzasV7', JSON.stringify(transactions));
    renderAll();
}

function resetData() {
    Swal.fire({
        title: '¿Borrar todo?', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, borrar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('finanzasV7');
            transactions = [];
            renderAll();
        }
    });
}

function deleteTransaction(id) {
    Swal.fire({
        title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí'
    }).then((result) => {
        if (result.isConfirmed) {
            transactions = transactions.filter(t => t.id !== id);
            saveData();
        }
    });
}

function calculateBalances() {
    let bal = { 'Pichincha': 0, 'Guayaquil': 0, 'Produbanco': 0, 'Binance': 0, 'PeiGo': 0, 'UglyCash': 0, 'Efectivo': 0, 'PorCobrar': 0, 'Total': 0 };
    let debts = {};
    transactions.forEach(t => {
        let val = t.amount;
        if (['ingreso', 'trade_profit', 'loan_payment'].includes(t.type)) {
            if(bal[t.account] !== undefined) bal[t.account] += val;
        } else if (['gasto', 'trade_loss', 'loan_out'].includes(t.type)) {
            if(bal[t.account] !== undefined) bal[t.account] -= val;
        }
        if (t.type === 'loan_out') {
            bal['PorCobrar'] += val;
            debts[t.person] = (debts[t.person] || 0) + val;
        } else if (t.type === 'loan_payment') {
            bal['PorCobrar'] -= val;
            debts[t.person] = (debts[t.person] || 0) - val;
        }
    });
    bal['Total'] = bal['Pichincha'] + bal['Guayaquil'] + bal['Produbanco'] + bal['Binance'] + bal['PeiGo'] + bal['UglyCash'] + bal['Efectivo'] + bal['PorCobrar'];
    return { bal, debts };
}

function renderAll() {
    const { bal, debts } = calculateBalances();
    document.getElementById('lblTotal').innerText = fmt.format(bal['Total']);
    document.getElementById('lblPichincha').innerText = fmt.format(bal['Pichincha']);
    document.getElementById('lblGuayaquil').innerText = fmt.format(bal['Guayaquil']);
    document.getElementById('lblProdubanco').innerText = fmt.format(bal['Produbanco']);
    document.getElementById('lblBinance').innerText = fmt.format(bal['Binance']);
    document.getElementById('lblPeiGo').innerText = fmt.format(bal['PeiGo']);
    document.getElementById('lblUglyCash').innerText = fmt.format(bal['UglyCash']);
    document.getElementById('lblEfectivo').innerText = fmt.format(bal['Efectivo']);
    document.getElementById('lblPorCobrar').innerText = fmt.format(bal['PorCobrar']);
    renderTable();
    renderDebtors(debts);
    renderChart(bal);
}

function renderTable() {
    const tbody = document.getElementById('transactionTableBody');
    const filter = document.getElementById('filterAccount').value;
    tbody.innerHTML = '';
    const filtered = transactions.filter(t => filter === 'all' || t.account === filter);

    if(filtered.length === 0) {
        // CORREGIDO: Eliminado bg-light para que se vea bien en Dark Mode
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">No hay movimientos registrados aún.</td></tr>';
        return;
    }

    filtered.forEach(t => {
        let color = '', sign = '', label = '', icon = '';
        switch(t.type) {
            case 'ingreso': color = 'text-success'; sign = '+'; label = 'Ingreso'; icon='fa-arrow-down'; break;
            case 'gasto': color = 'text-danger'; sign = '-'; label = 'Gasto'; icon='fa-arrow-up'; break;
            case 'trade_profit': color = 'text-success'; sign = '+'; label = 'Profit'; icon='fa-chart-line'; break;
            case 'trade_loss': color = 'text-danger'; sign = '-'; label = 'Loss'; icon='fa-chart-line'; break;
            case 'loan_out': color = 'text-warning'; sign = '-'; label = `Préstamo (${t.person})`; icon='fa-hand-holding-dollar'; break;
            case 'loan_payment': color = 'text-primary'; sign = '+'; label = `Pago (${t.person})`; icon='fa-hand-holding-dollar'; break;
        }
        const row = `<tr>
            <td class="ps-4 small opacity-75">${t.date}</td>
            <td><span class="badge bg-secondary badge-account">${t.account}</span></td>
            <td><div class="d-flex align-items-center"><i class="fa-solid ${icon} me-2 small text-muted"></i>${t.desc}</div></td>
            <td class="small">${label}</td>
            <td class="text-end fw-bold ${color}">${sign}${fmt.format(t.amount)}</td>
            <td class="text-center pe-4"><button class="btn btn-sm text-danger border-0" onclick="deleteTransaction(${t.id})"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function renderDebtors(debts) {
    const container = document.getElementById('debtCardsContainer');
    const msg = document.getElementById('noDebtsMsg');
    container.innerHTML = '';
    let count = 0;
    for (const [person, amount] of Object.entries(debts)) {
        if (Math.abs(amount) > 0.01) {
            count++;
            const card = `<div class="col-md-6 mb-3">
                <div class="card card-custom debtor-card h-100 p-3 border-0 shadow-sm" style="border-left: 4px solid #8E54E9 !important; cursor:pointer;" onclick="viewPersonHistory('${person}')">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="fw-bold mb-1">${person}</h6><small class="text-muted">Click para ver detalles</small></div>
                        <h5 class="text-primary fw-bold mb-0">${fmt.format(amount)}</h5>
                    </div>
                </div>
            </div>`;
            container.innerHTML += card;
        }
    }
    msg.style.display = (count === 0) ? 'block' : 'none';
}

function renderChart(bal) {
    const ctx = document.getElementById('assetsChart').getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#cbd5e1' : '#475569'; 

    const data = {
        labels: ['Pichincha', 'Guayaquil', 'Produbanco', 'Binance', 'PeiGo', 'Ugly', 'Efectivo', 'Por Cobrar'],
        datasets: [{
            data: [bal['Pichincha'], bal['Guayaquil'], bal['Produbanco'], bal['Binance'], bal['PeiGo'], bal['UglyCash'], bal['Efectivo'], bal['PorCobrar']].map(v => Math.max(0,v)),
            backgroundColor: ['#FFDD00', '#E3007E', '#1e3a8a', '#F3BA2F', '#00D1D1', '#1a1a1a', '#4b5563', '#8E54E9'],
            borderWidth: 0, hoverOffset: 4
        }]
    };

    if (assetsChart) {
        assetsChart.data = data;
        assetsChart.options.plugins.legend.labels.color = textColor; 
        assetsChart.update();
    } else {
        assetsChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, boxWidth: 10, font: { size: 11 } } }
                }
            }
        });
    }
}

function viewPersonHistory(person) {
    const modalEl = document.getElementById('modalPersonHistory');
    document.getElementById('modalPersonTitle').innerText = `Historial: ${person}`;
    const tbody = document.getElementById('personHistoryBody');
    tbody.innerHTML = '';
    const history = transactions.filter(t => t.person === person);
    let balance = 0;
    history.forEach(t => {
        let type = '', color = '', sign = '';
        if (t.type === 'loan_out') {
            type = 'Préstamo';
            color = 'text-warning';
            sign = '+';
            balance += t.amount;
        } else {
            type = 'Pago';
            color = 'text-success';
            sign = '-';
            balance -= t.amount;
        }
        tbody.innerHTML += `<tr><td class="ps-3"><small>${t.date}</small></td><td>${type}</td><td class="small text-muted">${t.desc||'-'}</td><td class="text-end pe-3 fw-bold ${color}">${sign}${fmt.format(t.amount)}</td></tr>`;
    });
    document.getElementById('modalPersonBalance').innerText = fmt.format(balance);
    new bootstrap.Modal(modalEl).show();
}
// Poner año actual en el footer
document.getElementById('year').innerText = new Date().getFullYear();