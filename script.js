// --- 1. CONFIGURACIÓN DE FIREBASE ---
// Reemplaza esto con lo que copiaste de la consola de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBXFIb4CvHxqZFcI_r_caId6fa9gq731_I",
    authDomain: "finanzas-cesar.firebaseapp.com",
    projectId: "finanzas-cesar",
    storageBucket: "finanzas-cesar.firebasestorage.app",
    messagingSenderId: "38396609942",
    appId: "1:38396609942:web:bef483a9dbb3ff789409b7",
    measurementId: "G-GKZYSCKWQG"
  };

// Inicializar Firebase (Verificamos si ya existe para evitar errores)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// --- VARIABLES GLOBALES ---
let transactions = [];
let assetsChart = null;
let currentUser = null;
const STORAGE_KEY = 'finanzasV7'; // Clave para LocalStorage
const LAST_FORM_KEY = 'finanzasLastForm'; // Clave para guardar último banco y acción

// --- PAGINACIÓN ---
let currentPage = 1;
const itemsPerPage = 11; // Cantidad de transacciones por página

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const form = document.getElementById('formTransaction');
const dateInput = document.getElementById('inputDate');

// --- INICIO DE LA APP ---
initApp();

function initApp() {
    // 1. Configurar fecha de hoy
    if(dateInput) dateInput.valueAsDate = new Date();
    
    // 2. Cargar funciones visuales
    checkTheme();
    toggleFormFields();
    
    // 3. Recuperar último banco y acción utilizados
    restoreLastFormState();
    
    // 4. Cargar datos locales primero (Modo Invitado)
    loadLocalData();
    renderAll();
}

// --- SISTEMA DE AUTENTICACIÓN HÍBRIDO ---
auth.onAuthStateChanged((user) => {
    const statusInd = document.getElementById('statusIndicator');
    const authBtns = document.getElementById('authButtons');
    
    if (user) {
        // --- USUARIO LOGUEADO ---
        currentUser = user;
        if(statusInd) statusInd.innerHTML = '<i class="fa-solid fa-cloud text-success"></i> Modo Nube (Sincronizado)';
        
        if(authBtns) {
            authBtns.innerHTML = `
                <button class="btn btn-danger btn-sm rounded-pill px-3" onclick="logout()">
                    <i class="fa-solid fa-right-from-bracket"></i> Salir
                </button>`;
        }
        
        // Cerrar modal si está abierto
        const modalEl = document.getElementById('modalAuth');
        if(modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if(modal) modal.hide();
        }

        // Sincronizar datos
        syncLocalToCloud();
        
        // Escuchar cambios de la nube en tiempo real
        loadCloudData();

    } else {
        // --- MODO INVITADO (LOCAL) ---
        currentUser = null;
        if(statusInd) statusInd.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Modo Local (Invitado)';
        
        if(authBtns) {
            authBtns.innerHTML = `
                <button class="btn btn-primary btn-sm rounded-pill px-3 fw-bold" data-bs-toggle="modal" data-bs-target="#modalAuth">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Sincronizar
                </button>`;
        }
        
        // Volver a cargar lo local por seguridad
        loadLocalData();
        renderAll();
    }
});

// --- GESTIÓN DE DATOS ---

// 1. Cargar Local
function loadLocalData() {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
        transactions = JSON.parse(local);
    }
}

// 2. Cargar Nube (Listener)
function loadCloudData() {
    if(!currentUser) return;
    db.collection('usuarios').doc(currentUser.uid).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            transactions = data.transactions || [];
            // Guardamos copia en local para que funcione offline
            localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
            renderAll();
        }
    });
}

// 3. Guardar Datos
function saveData() {
    // Siempre guardamos en local primero
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    
    // Guardar último banco y acción utilizados
    saveLastFormState();

    if (currentUser) {
        // Si hay usuario, enviamos a la nube
        db.collection('usuarios').doc(currentUser.uid).set({
            transactions: transactions,
            lastUpdate: new Date()
        }).catch(err => console.error("Error guardando en nube:", err));
    }
    
    renderAll();
}

// --- FUNCIONES PARA GUARDAR/RECUPERAR ESTADO DEL FORMULARIO ---
function saveLastFormState() {
    const account = document.getElementById('inputAccount')?.value;
    const type = document.getElementById('inputType')?.value;
    
    if (account && type) {
        const formState = { account, type };
        localStorage.setItem(LAST_FORM_KEY, JSON.stringify(formState));
    }
}

function restoreLastFormState() {
    const saved = localStorage.getItem(LAST_FORM_KEY);
    if (saved) {
        try {
            const { account, type } = JSON.parse(saved);
            
            const accountSelect = document.getElementById('inputAccount');
            const typeSelect = document.getElementById('inputType');
            
            if (accountSelect && account) {
                accountSelect.value = account;
            }
            if (typeSelect && type) {
                typeSelect.value = type;
                toggleFormFields();
            }
        } catch (e) {
            console.error("Error recuperando estado del formulario:", e);
        }
    }
}

// 4. Sincronizar Local -> Nube
function syncLocalToCloud() {
    const localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    
    if (localData.length > 0) {
        // Leemos la nube primero para no borrar datos antiguos
        db.collection('usuarios').doc(currentUser.uid).get().then((doc) => {
            let cloudTx = [];
            if(doc.exists) {
                cloudTx = doc.data().transactions || [];
            }
            
            // Unir arrays (Local + Nube)
            const combined = [...cloudTx, ...localData];
            
            // Eliminar duplicados basados en ID
            const unique = combined.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
            
            // Ordenar por fecha
            unique.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Guardar fusión en Nube
            db.collection('usuarios').doc(currentUser.uid).set({
                transactions: unique,
                lastUpdate: new Date()
            }).then(() => {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success', 
                    title: 'Sincronizado correctamente', showConfirmButton: false, timer: 3000
                });
            });
        });
    }
}

// --- ACCIONES DE AUTENTICACIÓN ---

// Login
if(document.getElementById('authForm')) {
    document.getElementById('authForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPass').value;
        auth.signInWithEmailAndPassword(email, pass).catch(handleAuthError);
    });
}

// Registro
function registerUser() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    
    if(pass.length < 6) { 
        handleAuthError({message: "La contraseña debe tener al menos 6 caracteres."}); 
        return; 
    }
    
    auth.createUserWithEmailAndPassword(email, pass).catch(handleAuthError);
}

// Manejo de Errores Auth
function handleAuthError(error) {
    const errEl = document.getElementById('authError');
    if(errEl) {
        let msg = error.message;
        if(error.code === 'auth/email-already-in-use') msg = "Ese correo ya está registrado.";
        if(error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
        if(error.code === 'auth/user-not-found') msg = "Usuario no encontrado.";
        
        errEl.innerText = msg;
        errEl.style.display = 'block';
    }
}

// Logout
function logout() {
    auth.signOut().then(() => {
        Swal.fire({
            toast: true, position: 'top-end', icon: 'info', 
            title: 'Sesión cerrada. Modo local activado.', showConfirmButton: false, timer: 2000
        });
    });
}

// --- FORMULARIO Y TRANSACCIONES ---

if(form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('inputType').value;
        const amount = parseFloat(document.getElementById('inputAmount').value);
        const accountFrom = document.getElementById('inputAccount').value;
        const accountTo = document.getElementById('inputAccountTo').value;
        const desc = document.getElementById('inputDesc').value;
        const date = document.getElementById('inputDate').value;
        const person = document.getElementById('inputPerson').value;
        
        if (amount <= 0) { Swal.fire('Error', 'Monto inválido', 'error'); return; }
        if (type === 'transfer' && accountFrom === accountTo) {
            Swal.fire('Error', 'La cuenta origen y destino son iguales', 'warning'); return;
        }

        const baseTx = { id: Date.now(), date: date, amount: amount, desc: desc };

        if (type === 'transfer') {
            const txOut = { ...baseTx, id: Date.now(), type: 'transfer_out', account: accountFrom, desc: `Transferencia a ${accountTo} - ${desc}`, person: null };
            const txIn = { ...baseTx, id: Date.now() + 1, type: 'transfer_in', account: accountTo, desc: `Transferencia desde ${accountFrom} - ${desc}`, person: null };
            transactions.unshift(txIn);
            transactions.unshift(txOut);
        } else {
            transactions.unshift({ ...baseTx, type: type, account: accountFrom, person: person || null });
        }

        saveData();
        
        // Resetear solo los campos de entrada, NO el banco y acción
        document.getElementById('inputAmount').value = '';
        document.getElementById('inputDesc').value = '';
        document.getElementById('inputPerson').value = '';
        dateInput.valueAsDate = new Date();
        // NO llamamos a toggleFormFields() para mantener la visibilidad de campos
        
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true});
        Toast.fire({icon: 'success', title: 'Guardado'});
    });
}

// --- FUNCIONES VISUALES Y HELPERS ---

// Controlar campos del formulario
function toggleFormFields() {
    const type = document.getElementById('inputType').value;
    const groupPerson = document.getElementById('groupPerson');
    const inputPerson = document.getElementById('inputPerson');
    const lblAccount = document.getElementById('lblAccount');
    const groupAccountTo = document.getElementById('groupAccountTo');
    
    // Resetear
    groupPerson.classList.add('d-none');
    inputPerson.removeAttribute('required');
    groupAccountTo.classList.add('d-none');
    lblAccount.innerText = "Cuenta";

    if (type === 'loan_out' || type === 'loan_payment') {
        groupPerson.classList.remove('d-none');
        inputPerson.setAttribute('required', 'required');
    } 
    else if (type === 'transfer') {
        lblAccount.innerText = "Desde (Origen)";
        groupAccountTo.classList.remove('d-none');
    }
}

// Borrar Item
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

// Reset Total
function resetData() {
    Swal.fire({
        title: '¿Borrar todo?', text: currentUser ? "Se borrará de tu cuenta en la Nube." : "Se borrará de este dispositivo.", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, borrar todo'
    }).then((result) => {
        if (result.isConfirmed) {
            transactions = [];
            saveData();
        }
    });
}

// Modo Oscuro / Claro
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.getElementById('iconMode');
    if(icon) icon.className = isDark ? 'fa-solid fa-sun text-warning' : 'fa-solid fa-moon text-secondary';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if(assetsChart) renderChart(calculateBalances().bal); 
}

function checkTheme() {
    const theme = localStorage.getItem('theme');
    const icon = document.getElementById('iconMode');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if(icon) icon.className = 'fa-solid fa-sun text-warning';
    } else {
        if(icon) icon.className = 'fa-solid fa-moon text-secondary';
    }
}

// Cálculos
function calculateBalances() {
    let bal = { 
        'Pichincha': 0, 
        'DeUna': 0,
        'Guayaquil': 0,
        'PeiGo': 0,
        'Produbanco': 0, 
        'Binance': 0, 
        'UglyCash': 0, 
        'Efectivo': 0, 
        'PorCobrar': 0, 
        'Total': 0 
    };
    let debts = {};
    
    transactions.forEach(t => {
        let val = t.amount;
        
        // Sumas
        if (['ingreso', 'trade_profit', 'loan_payment', 'transfer_in'].includes(t.type)) {
            if(bal[t.account] !== undefined) bal[t.account] += val;
        } 
        // Restas
        else if (['gasto', 'trade_loss', 'loan_out', 'transfer_out'].includes(t.type)) {
            if(bal[t.account] !== undefined) bal[t.account] -= val;
        }
        
        // Deudas
        if (t.type === 'loan_out') {
            bal['PorCobrar'] += val;
            debts[t.person] = (debts[t.person] || 0) + val;
        } else if (t.type === 'loan_payment') {
            bal['PorCobrar'] -= val;
            debts[t.person] = (debts[t.person] || 0) - val;
        }
    });
    
    // SUMA TOTAL CON TODOS LOS BANCOS
    bal['Total'] = bal['Pichincha'] + bal['Guayaquil'] + bal['Produbanco'] + bal['Binance'] + bal['PeiGo'] + bal['UglyCash'] + bal['Efectivo'] + bal['PorCobrar'];
    return { bal, debts };
}

// Renderizar Todo
function renderAll() {
    const { bal, debts } = calculateBalances();
    
    if(document.getElementById('lblTotal')) document.getElementById('lblTotal').innerText = fmt.format(bal['Total']);
    if(document.getElementById('lblPichincha')) document.getElementById('lblPichincha').innerText = fmt.format(bal['Pichincha']);
    if(document.getElementById('lblDeUna')) document.getElementById('lblDeUna').innerText = fmt.format(bal['DeUna']);
    
    // Nuevos Bancos
    if(document.getElementById('lblGuayaquil')) document.getElementById('lblGuayaquil').innerText = fmt.format(bal['Guayaquil']);
    if(document.getElementById('lblPeiGo')) document.getElementById('lblPeiGo').innerText = fmt.format(bal['PeiGo']);

    if(document.getElementById('lblProdubanco')) document.getElementById('lblProdubanco').innerText = fmt.format(bal['Produbanco']);
    if(document.getElementById('lblBinance')) document.getElementById('lblBinance').innerText = fmt.format(bal['Binance']);
    if(document.getElementById('lblUglyCash')) document.getElementById('lblUglyCash').innerText = fmt.format(bal['UglyCash']);
    if(document.getElementById('lblEfectivo')) document.getElementById('lblEfectivo').innerText = fmt.format(bal['Efectivo']);
    if(document.getElementById('lblPorCobrar')) document.getElementById('lblPorCobrar').innerText = fmt.format(bal['PorCobrar']);
    
    renderTable();
    renderDebtors(debts);
    renderChart(bal);
}

// Renderizar Tabla
// --- FUNCIÓN RENDER TABLE CON PAGINACIÓN ---
function renderTable() {
    const tbody = document.getElementById('transactionTableBody');
    const filterEl = document.getElementById('filterAccount');
    const paginationDiv = document.getElementById('paginationControls');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const pageIndicator = document.getElementById('pageIndicator');

    if(!tbody || !filterEl) return;

    // 1. Filtrar datos
    const filter = filterEl.value;
    const filtered = transactions.filter(t => filter === 'all' || t.account === filter);

    // 2. Validaciones iniciales
    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">No hay movimientos.</td></tr>';
        if(paginationDiv) paginationDiv.style.setProperty('display', 'none', 'important');
        return;
    }

    // 3. Cálculos de Paginación
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    
    // Asegurar que la página actual sea válida
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Calcular índices para cortar el array
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // Obtener solo los items de ESTA página
    const paginatedItems = filtered.slice(startIndex, endIndex);

    // 4. Renderizar Filas
    tbody.innerHTML = '';
    paginatedItems.forEach(t => {
        let color = '', sign = '', label = '', icon = '';
        switch(t.type) {
            case 'ingreso': color = 'text-success'; sign = '+'; label = 'Ingreso'; icon='fa-arrow-down'; break;
            case 'gasto': color = 'text-danger'; sign = '-'; label = 'Gasto'; icon='fa-arrow-up'; break;
            case 'transfer_out': color = 'text-danger'; sign = '-'; label = 'Envío Transf.'; icon='fa-arrow-right-from-bracket'; break;
            case 'transfer_in': color = 'text-success'; sign = '+'; label = 'Recibo Transf.'; icon='fa-arrow-right-to-bracket'; break;
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

    // 5. Actualizar Controles de Paginación
    if(paginationDiv) {
        // Mostrar paginación solo si hay más de 1 página (o más items que el límite)
        if (totalPages > 1) {
            paginationDiv.style.removeProperty('display'); // Mostrar (quita el display:none)
            paginationDiv.classList.add('d-flex');         // Asegura flex
            
            pageIndicator.innerText = `Página ${currentPage} de ${totalPages}`;
            
            // Deshabilitar botones si estamos en el límite
            btnPrev.disabled = (currentPage === 1);
            btnNext.disabled = (currentPage === totalPages);
        } else {
            paginationDiv.style.setProperty('display', 'none', 'important');
        }
    }
}

// Renderizar Deudores
function renderDebtors(debts) {
    const container = document.getElementById('debtCardsContainer');
    const msg = document.getElementById('noDebtsMsg');
    if(!container) return;

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
    if(msg) msg.style.display = (count === 0) ? 'block' : 'none';
}

// Renderizar Gráfico
function renderChart(bal) {
    const canvas = document.getElementById('assetsChart');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#cbd5e1' : '#475569'; 

    const data = {
        labels: ['Pichincha', 'De Una', 'Guayaquil', 'PeiGo', 'Produbanco', 'Binance', 'Ugly', 'Efectivo', 'Por Cobrar'],
        datasets: [{
            data: [
                bal['Pichincha'], 
                bal['DeUna'],
                bal['Guayaquil'], 
                bal['PeiGo'],
                bal['Produbanco'], 
                bal['Binance'], 
                bal['UglyCash'], 
                bal['Efectivo'], 
                bal['PorCobrar']
            ].map(v => Math.max(0,v)),
            backgroundColor: [
                '#FFDD00', // Pichincha (Amarillo)
                '#1E90FF', // De Una (Azul Dodger)
                '#E3007E', // Guayaquil (Magenta)
                '#00D1D1', // PeiGo (Cyan/Turquesa)
                '#141E30', // Produbanco (Azul Oscuro)
                '#F0B90B', // Binance (Dorado)
                '#1f2937', // Ugly (Gris Oscuro)
                '#485563', // Efectivo (Gris)
                '#8E2DE2'  // Por Cobrar (Morado)
            ],
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

// Ver historial persona
function viewPersonHistory(person) {
    const modalEl = document.getElementById('modalPersonHistory');
    if(!modalEl) return;
    
    document.getElementById('modalPersonTitle').innerText = `Historial: ${person}`;
    const tbody = document.getElementById('personHistoryBody');
    tbody.innerHTML = '';
    const history = transactions.filter(t => t.person === person);
    let balance = 0;
    history.forEach(t => {
        let type = '', color = '';
        if (t.type === 'loan_out') { type = 'Préstamo'; color = 'text-warning'; balance += t.amount; }
        else { type = 'Pago'; color = 'text-success'; balance -= t.amount; }
        tbody.innerHTML += `<tr><td class="ps-3"><small>${t.date}</small></td><td>${type}</td><td class="small text-muted">${t.desc||'-'}</td><td class="text-end pe-3 fw-bold ${color}">${fmt.format(t.amount)}</td></tr>`;
    });
    document.getElementById('modalPersonBalance').innerText = fmt.format(balance);
    new bootstrap.Modal(modalEl).show();
}

// Exportar JSON
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

// Importar JSON
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

// --- FUNCIONES DE CONTROL PAGINACIÓN ---
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    // Necesitamos saber el total para no pasarnos, lo recalculamos rápido
    const filter = document.getElementById('filterAccount').value;
    const totalItems = transactions.filter(t => filter === 'all' || t.account === filter).length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}