// --- 1. CONFIGURACIÓN DE FIREBASE ---
// Reemplaza esto con lo que copiaste de la consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBXFIb4CvHxqZFcI_r_caId6fa9gq731_I",
  authDomain: "finanzas-cesar.firebaseapp.com",
  projectId: "finanzas-cesar",
  storageBucket: "finanzas-cesar.firebasestorage.app",
  messagingSenderId: "38396609942",
  appId: "1:38396609942:web:bef483a9dbb3ff789409b7",
  measurementId: "G-GKZYSCKWQG",
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
let editingId = null;
const STORAGE_KEY = "finanzasV7"; // Clave para LocalStorage
const LAST_FORM_KEY = "finanzasLastForm"; // Clave para guardar último banco y acción

// --- PAGINACIÓN ---
let currentPage = 1;
const itemsPerPage = 11; // Cantidad de transacciones por página

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const form = document.getElementById("formTransaction");
const dateInput = document.getElementById("inputDate");

// --- SISTEMA DE PRECIOS EN TIEMPO REAL & COTIZACIONES DE MERCADO ---
const LIVE_PRICES_KEY = "finanzas_live_prices_v2";
let liveMarketPrices = {
  SP500: { price: 546.50, change: 0.45, ticker: "VOO", name: "Vanguard S&P 500 ETF" },
  Nasdaq: { price: 494.30, change: 0.68, ticker: "QQQ", name: "Invesco QQQ (NASDAQ-100)" },
  lastUpdated: null,
};

function loadCachedLivePrices() {
  const cached = localStorage.getItem(LIVE_PRICES_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.SP500 && parsed.Nasdaq) {
        liveMarketPrices = parsed;
      }
    } catch (e) {}
  }
}

async function fetchLivePrices(isManual = false) {
  const icon = document.getElementById("iconRefreshPrices");
  if (icon) icon.classList.add("fa-spin");

  const symbols = [
    { key: "SP500", ticker: "VOO", fallback: 546.50 },
    { key: "Nasdaq", ticker: "QQQ", fallback: 494.30 }
  ];

  let updatedCount = 0;

  for (const item of symbols) {
    try {
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${item.ticker}?interval=1d`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const resp = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          const currentPrice = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
          const changePct = prevClose > 0 ? (((currentPrice - prevClose) / prevClose) * 100) : 0;

          liveMarketPrices[item.key].price = currentPrice;
          liveMarketPrices[item.key].change = changePct;
          updatedCount++;
        }
      }
    } catch (err) {
      console.warn(`No se pudo obtener precio en vivo para ${item.ticker}, usando precio en caché:`, err);
    }
  }

  liveMarketPrices.lastUpdated = new Date().toISOString();
  localStorage.setItem(LIVE_PRICES_KEY, JSON.stringify(liveMarketPrices));

  if (icon) icon.classList.remove("fa-spin");

  updateLiveTickersUI();
  renderAll();

  if (isManual) {
    const Toast = Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2500,
    });
    Toast.fire({
      icon: updatedCount > 0 ? "success" : "info",
      title: updatedCount > 0 ? "Precios de mercado actualizados" : "Cotizaciones sincronizadas (modo offline)",
    });
  }
}

function updateLiveTickersUI() {
  const spPriceEl = document.getElementById("lblLivePriceSP500");
  const spChangeEl = document.getElementById("lblLiveChangeSP500");
  const nasPriceEl = document.getElementById("lblLivePriceNasdaq");
  const nasChangeEl = document.getElementById("lblLiveChangeNasdaq");

  if (spPriceEl && liveMarketPrices.SP500) {
    spPriceEl.innerText = fmt.format(liveMarketPrices.SP500.price);
  }
  if (spChangeEl && liveMarketPrices.SP500) {
    const chg = liveMarketPrices.SP500.change || 0;
    spChangeEl.innerText = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
    spChangeEl.className = chg >= 0 ? "badge bg-success-subtle text-success p-1 small" : "badge bg-danger-subtle text-danger p-1 small";
  }

  if (nasPriceEl && liveMarketPrices.Nasdaq) {
    nasPriceEl.innerText = fmt.format(liveMarketPrices.Nasdaq.price);
  }
  if (nasChangeEl && liveMarketPrices.Nasdaq) {
    const chg = liveMarketPrices.Nasdaq.change || 0;
    nasChangeEl.innerText = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
    nasChangeEl.className = chg >= 0 ? "badge bg-info-subtle text-info p-1 small" : "badge bg-danger-subtle text-danger p-1 small";
  }
}

// --- INICIO DE LA APP ---
initApp();

function initApp() {
  // 0. Cargar cotizaciones cacheadas y consultar en segundo plano
  loadCachedLivePrices();
  setTimeout(() => fetchLivePrices(false), 800);

  // 1. Configurar fecha de hoy solo si no hay una guardada
  const saved = localStorage.getItem(LAST_FORM_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.date && dateInput) {
        dateInput.value = parsed.date;
      } else if (dateInput) {
        dateInput.valueAsDate = new Date();
      }
    } catch (e) {
      if (dateInput) dateInput.valueAsDate = new Date();
    }
  } else {
    if (dateInput) dateInput.valueAsDate = new Date();
  }

  // 2. Cargar funciones visuales
  checkTheme();
  toggleFormFields();

  // 3. Recuperar último banco y acción utilizados
  restoreLastFormState();

  // 4. Cargar datos locales primero (Modo Invitado)
  loadLocalData();
  renderAll();
  updateLiveTickersUI();
}

// --- SISTEMA DE AUTENTICACIÓN HÍBRIDO ---
auth.onAuthStateChanged((user) => {
  const statusInd = document.getElementById("statusIndicator");
  const authBtns = document.getElementById("authButtons");

  if (user) {
    // --- USUARIO LOGUEADO ---
    currentUser = user;

    const changePassEl = document.getElementById("menuChangePassword");
    if (changePassEl) changePassEl.style.display = "block";

    if (statusInd)
      statusInd.innerHTML =
        '<i class="fa-solid fa-cloud text-success"></i> Modo Nube (Sincronizado)';

    if (authBtns) {
      authBtns.innerHTML = `
                <button class="btn btn-danger btn-sm rounded-pill px-3" onclick="logout()">
                    <i class="fa-solid fa-right-from-bracket"></i> Salir
                </button>`;
    }

    // Cerrar modal si está abierto
    const modalEl = document.getElementById("modalAuth");
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    // Sincronizar datos
    syncLocalToCloud();

    // Escuchar cambios de la nube en tiempo real
    loadCloudData();
  } else {
    // --- MODO INVITADO (LOCAL) ---
    currentUser = null;

    const changePassEl = document.getElementById("menuChangePassword");
    if (changePassEl) changePassEl.style.display = "none";

    if (statusInd)
      statusInd.innerHTML =
        '<i class="fa-solid fa-hard-drive"></i> Modo Local (Invitado)';

    if (authBtns) {
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
  if (!currentUser) return;
  db.collection("usuarios")
    .doc(currentUser.uid)
    .onSnapshot((doc) => {
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
    db.collection("usuarios")
      .doc(currentUser.uid)
      .set({
        transactions: transactions,
        lastUpdate: new Date(),
      })
      .catch((err) => console.error("Error guardando en nube:", err));
  }

  renderAll();
}

// --- FUNCIONES PARA GUARDAR/RECUPERAR ESTADO DEL FORMULARIO ---
function saveLastFormState() {
  const account = document.getElementById("inputAccount")?.value;
  const type = document.getElementById("inputType")?.value;
  const date = document.getElementById("inputDate")?.value;

  if (account && type) {
    const formState = { account, type, date: date || null };
    localStorage.setItem(LAST_FORM_KEY, JSON.stringify(formState));
  }
}

function restoreLastFormState() {
  const saved = localStorage.getItem(LAST_FORM_KEY);
  if (saved) {
    try {
      const { account, type, date } = JSON.parse(saved);

      const accountSelect = document.getElementById("inputAccount");
      const typeSelect = document.getElementById("inputType");

      if (accountSelect && account) {
        accountSelect.value = account;
      }
      if (typeSelect && type) {
        typeSelect.value = type;
        toggleFormFields();
      }
      // Restaurar fecha si existe
      if (date && dateInput) {
        dateInput.value = date;
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
    db.collection("usuarios")
      .doc(currentUser.uid)
      .get()
      .then((doc) => {
        let cloudTx = [];
        if (doc.exists) {
          cloudTx = doc.data().transactions || [];
        }

        // Unir arrays (Local + Nube)
        const combined = [...cloudTx, ...localData];

        // Eliminar duplicados basados en ID
        const unique = combined.filter(
          (v, i, a) => a.findIndex((t) => t.id === v.id) === i,
        );

        // Ordenar por fecha
        unique.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Guardar fusión en Nube
        db.collection("usuarios")
          .doc(currentUser.uid)
          .set({
            transactions: unique,
            lastUpdate: new Date(),
          })
          .then(() => {
            Swal.fire({
              toast: true,
              position: "top-end",
              icon: "success",
              title: "Sincronizado correctamente",
              showConfirmButton: false,
              timer: 3000,
            });
          });
      });
  }
}

// --- ACCIONES DE AUTENTICACIÓN ---

// Login
if (document.getElementById("authForm")) {
  document.getElementById("authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;
    auth.signInWithEmailAndPassword(email, pass).catch(handleAuthError);
  });
}

// Registro
function registerUser() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;

  if (pass.length < 6) {
    handleAuthError({
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
    return;
  }

  auth.createUserWithEmailAndPassword(email, pass).catch(handleAuthError);
}

// Manejo de Errores Auth
function handleAuthError(error) {
  const errEl = document.getElementById("authError");
  if (errEl) {
    let msg = error.message;
    if (error.code === "auth/email-already-in-use")
      msg = "Ese correo ya está registrado.";
    if (error.code === "auth/wrong-password") msg = "Contraseña incorrecta.";
    if (error.code === "auth/user-not-found") msg = "Usuario no encontrado.";

    errEl.innerText = msg;
    errEl.style.display = "block";
  }
}

// Logout
function logout() {
  auth.signOut().then(() => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "Sesión cerrada. Modo local activado.",
      showConfirmButton: false,
      timer: 2000,
    });
  });
}

// --- FORMULARIO Y TRANSACCIONES ---

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("inputType").value;
    const amount = parseFloat(document.getElementById("inputAmount").value);
    const accountFrom = document.getElementById("inputAccount").value;
    const accountTo = document.getElementById("inputAccountTo").value;
    const desc = document.getElementById("inputDesc").value;
    const date = document.getElementById("inputDate").value;
    const person = document.getElementById("inputPerson").value;

    if (amount <= 0) {
      Swal.fire("Error", "Monto inválido", "error");
      return;
    }
    if (type === "transfer" && accountFrom === accountTo) {
      Swal.fire("Error", "La cuenta origen y destino son iguales", "warning");
      return;
    }

  const commission = (type === "transfer" || type === "invest") ? (parseFloat(document.getElementById("inputCommission").value) || 0) : 0;
    const baseTx = { id: Date.now(), date: date, amount: amount, desc: desc };

    if (type === "invest") {
      const investAsset = document.getElementById("inputInvestAsset")?.value || "SP500";
      const sharePrice = parseFloat(document.getElementById("inputSharePrice")?.value) || (liveMarketPrices[investAsset]?.price || 500);
      const netAmount = Math.max(0, amount - commission);
      const shares = sharePrice > 0 ? (netAmount / sharePrice) : 0;
      const commNote = commission > 0 ? ` (comisión: ${fmt.format(commission)})` : '';
      const assetLabel = investAsset === "SP500" ? "S&P 500 (VOO)" : "NASDAQ-100 (QQQ)";

      if (editingId !== null) {
        transactions = transactions.filter(t => t.id !== editingId);
        editingId = null;
        document.querySelector('#formTransaction button[type="submit"]').innerHTML = 'Guardar';
      }

      const txOut = {
        ...baseTx,
        id: Date.now(),
        type: "transfer_out",
        account: accountFrom,
        commission: commission > 0 ? commission : undefined,
        desc: desc ? `Inversión en ${assetLabel} (${shares.toFixed(4)} acc @ ${fmt.format(sharePrice)})${commNote} - ${desc}` : `Inversión en ${assetLabel} (${shares.toFixed(4)} acc @ ${fmt.format(sharePrice)})${commNote}`,
        person: null,
      };
      const txIn = {
        ...baseTx,
        id: Date.now() + 1,
        type: "transfer_in",
        account: investAsset,
        amount: netAmount,
        sharePrice: sharePrice,
        shares: shares,
        commission: commission > 0 ? commission : undefined,
        desc: desc ? `Compra ${assetLabel} (${shares.toFixed(4)} acc @ ${fmt.format(sharePrice)})${commNote} - ${desc}` : `Compra ${assetLabel} (${shares.toFixed(4)} acc @ ${fmt.format(sharePrice)})${commNote}`,
        person: null,
      };

      transactions.unshift(txIn);
      transactions.unshift(txOut);
    } else if (type === "transfer") {
      if (editingId !== null) {
        // Delete the original transaction being edited
        transactions = transactions.filter(t => t.id !== editingId);
        editingId = null;
        document.querySelector('#formTransaction button[type="submit"]').innerHTML = 'Guardar';
      }
      const amountIn = Math.max(0, amount - commission);
      const commissionNote = commission > 0 ? ` (comisión: ${fmt.format(commission)})` : '';
      const txOut = {
        ...baseTx,
        id: Date.now(),
        type: "transfer_out",
        account: accountFrom,
        commission: commission > 0 ? commission : undefined,
        desc: `Transferencia a ${accountTo}${commissionNote} - ${desc}`,
        person: null,
      };
      const txIn = {
        ...baseTx,
        id: Date.now() + 1,
        type: "transfer_in",
        account: accountTo,
        amount: amountIn,
        desc: `Transferencia desde ${accountFrom}${commissionNote} - ${desc}`,
        person: null,
      };
      transactions.unshift(txIn);
      transactions.unshift(txOut);
    } else {
      if (editingId !== null) {
        const idx = transactions.findIndex(t => t.id === editingId);
        if (idx !== -1) {
          transactions[idx] = { ...transactions[idx], date, amount, desc, type, account: accountFrom, person: person || null };
        }
        editingId = null;
        document.querySelector('#formTransaction button[type="submit"]').innerHTML = '<i class="fa-solid fa-save me-2"></i>Guardar';
      } else {
        transactions.unshift({
          ...baseTx,
          type: type,
          account: accountFrom,
          person: person || null,
        });
      }
    }

    saveData();

    // Resetear solo los campos de entrada, NO el banco, acción ni fecha
    document.getElementById("inputAmount").value = "";
    document.getElementById("inputDesc").value = "";
    document.getElementById("inputPerson").value = "";
    document.getElementById("inputCommission").value = "";
    if (document.getElementById("inputSharePrice")) document.getElementById("inputSharePrice").value = "";
    updateInvestPreview();

    const Toast = Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });
    Toast.fire({ icon: "success", title: "Guardado" });
  });
}

// --- FUNCIONES VISUALES Y HELPERS ---

// Controlar campos del formulario
function toggleFormFields() {
  const type = document.getElementById("inputType")?.value;
  const groupPerson = document.getElementById("groupPerson");
  const inputPerson = document.getElementById("inputPerson");
  const lblAccount = document.getElementById("lblAccount");
  const groupAccountTo = document.getElementById("groupAccountTo");
  const groupInvestAsset = document.getElementById("groupInvestAsset");
  const groupSharePrice = document.getElementById("groupSharePrice");
  const groupCommission = document.getElementById("groupCommission");
  const invPreviewBox = document.getElementById("invPreviewBox");

  // Resetear
  if (groupPerson) {
    groupPerson.classList.add("d-none");
    if (inputPerson) inputPerson.removeAttribute("required");
  }
  if (groupAccountTo) groupAccountTo.classList.add("d-none");
  if (groupInvestAsset) groupInvestAsset.classList.add("d-none");
  if (groupSharePrice) groupSharePrice.classList.add("d-none");
  if (groupCommission) groupCommission.classList.add("d-none");
  if (invPreviewBox) invPreviewBox.classList.add("d-none");
  if (lblAccount) lblAccount.innerText = "Cuenta";

  if (
    type === "loan_out" ||
    type === "loan_payment" ||
    type === "debt_in" ||
    type === "debt_payment"
  ) {
    if (groupPerson) groupPerson.classList.remove("d-none");
    if (inputPerson) inputPerson.setAttribute("required", "required");
  } else if (type === "transfer") {
    if (lblAccount) lblAccount.innerText = "Desde (Origen)";
    if (groupAccountTo) groupAccountTo.classList.remove("d-none");
    if (groupCommission) groupCommission.classList.remove("d-none");
    updateCommissionHint();
  } else if (type === "invest") {
    if (lblAccount) lblAccount.innerText = "Desde (Broker)";
    const accSelect = document.getElementById("inputAccount");
    if (accSelect && (!accSelect.value || accSelect.value === "Airtm")) {
      accSelect.value = "Hapi";
    }
    if (groupInvestAsset) groupInvestAsset.classList.remove("d-none");
    if (groupSharePrice) groupSharePrice.classList.remove("d-none");
    if (groupCommission) groupCommission.classList.remove("d-none");
    if (invPreviewBox) invPreviewBox.classList.remove("d-none");
    onInvestAssetChange();
    updateInvestPreview();
  }
}

// Al cambiar el activo seleccionado en el formulario de inversión
function onInvestAssetChange() {
  const asset = document.getElementById("inputInvestAsset")?.value || "SP500";
  const sharePriceInput = document.getElementById("inputSharePrice");
  const sharePriceHint = document.getElementById("sharePriceHint");
  const livePrice = liveMarketPrices[asset]?.price || (asset === "SP500" ? 546.50 : 494.30);
  const ticker = liveMarketPrices[asset]?.ticker || (asset === "SP500" ? "VOO" : "QQQ");

  if (sharePriceInput && !sharePriceInput.value) {
    sharePriceInput.value = livePrice.toFixed(2);
  }
  if (sharePriceHint) {
    sharePriceHint.innerHTML = `<i class="fa-solid fa-circle-info me-1"></i>Cotización actual de <strong>${ticker}</strong>: ${fmt.format(livePrice)}`;
  }
  updateInvestPreview();
}

// Botón "Usar precio actual"
function useLivePriceInForm() {
  const asset = document.getElementById("inputInvestAsset")?.value || "SP500";
  const sharePriceInput = document.getElementById("inputSharePrice");
  const livePrice = liveMarketPrices[asset]?.price || (asset === "SP500" ? 546.50 : 494.30);
  if (sharePriceInput) {
    sharePriceInput.value = livePrice.toFixed(2);
    updateInvestPreview();
  }
}

// Actualiza el preview dinámico en vivo del formulario de inversión
function updateInvestPreview() {
  const previewBox = document.getElementById("invPreviewBox");
  if (!previewBox) return;

  const type = document.getElementById("inputType")?.value;
  if (type !== "invest") {
    previewBox.classList.add("d-none");
    return;
  }

  previewBox.classList.remove("d-none");

  const asset = document.getElementById("inputInvestAsset")?.value || "SP500";
  const amount = parseFloat(document.getElementById("inputAmount")?.value) || 0;
  const commission = parseFloat(document.getElementById("inputCommission")?.value) || 0;
  const sharePrice = parseFloat(document.getElementById("inputSharePrice")?.value) || (liveMarketPrices[asset]?.price || 500);

  const netInvested = Math.max(0, amount - commission);
  const shares = sharePrice > 0 ? (netInvested / sharePrice) : 0;

  const assetBadge = document.getElementById("invPreviewAssetBadge");
  const totalDebited = document.getElementById("invPreviewTotalDebited");
  const commEl = document.getElementById("invPreviewCommission");
  const netEl = document.getElementById("invPreviewNetInvested");
  const unitPriceEl = document.getElementById("invPreviewUnitPrice");
  const sharesEl = document.getElementById("invPreviewSharesCount");

  if (assetBadge) {
    assetBadge.innerText = asset === "SP500" ? "S&P 500 (VOO)" : "NASDAQ-100 (QQQ)";
    assetBadge.className = asset === "SP500" ? "badge bg-success-subtle text-success" : "badge bg-info-subtle text-info";
  }
  if (totalDebited) totalDebited.innerText = fmt.format(amount);
  if (commEl) commEl.innerText = fmt.format(commission);
  if (netEl) netEl.innerText = fmt.format(netInvested);
  if (unitPriceEl) unitPriceEl.innerText = fmt.format(sharePrice) + " / acc";
  if (sharesEl) sharesEl.innerText = `${shares.toFixed(4)} acciones`;
}

// Actualiza el hint de comisión con el monto neto que recibirá el destino
function updateCommissionHint() {
  const hint = document.getElementById("commissionHint");
  if (!hint) return;
  const type = document.getElementById("inputType")?.value;
  const amount = parseFloat(document.getElementById("inputAmount")?.value) || 0;
  const commission = parseFloat(document.getElementById("inputCommission")?.value) || 0;
  const accountTo = document.getElementById("inputAccountTo")?.value || "destino";

  if (type === "transfer") {
    if (amount > 0 && commission > 0) {
      const net = Math.max(0, amount - commission);
      hint.innerHTML = `<i class="fa-solid fa-circle-info me-1 text-warning"></i>${accountTo} recibirá <strong>${fmt.format(net)}</strong>`;
    } else {
      hint.innerHTML = "";
    }
  } else if (type === "invest") {
    if (commission > 0) {
      hint.innerHTML = `<i class="fa-solid fa-circle-info me-1 text-warning"></i>Se descontará de tu saldo de Hapi junto con la compra.`;
    } else {
      hint.innerHTML = "";
    }
  }
}

// Filtrar tabla por banco al hacer clic en tarjeta
function filterByAccount(account) {
  const filterEl = document.getElementById("filterAccount");
  if (!filterEl) return;
  filterEl.value = account;
  currentPage = 1;
  renderTable();
  // Activar pestaña Historial
  const historialTab = document.querySelector('[data-bs-target="#tab-historial"]');
  if (historialTab) {
    const tabInstance = bootstrap.Tab.getOrCreateInstance(historialTab);
    tabInstance.show();
  }
  // Scroll suave a la tabla
  const tableEl = document.getElementById("transactionTableBody");
  if (tableEl) tableEl.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Calcular balance ANTES de cada transacción por cuenta
function computeRunningBalances() {
  // Ordenar cronológicamente (más antigua primero)
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id);

  const running = {}; // balance actual de cada cuenta
  const prevBalMap = new Map(); // id -> balance ANTES de la tx

  const addTypes = ["ingreso", "trade_profit", "loan_payment", "transfer_in"];
  const subTypes = ["gasto", "trade_loss", "loan_out", "transfer_out", "debt_payment"];

  sorted.forEach((t) => {
    if (running[t.account] === undefined) running[t.account] = 0;
    // Guardar balance ANTES de aplicar esta tx
    prevBalMap.set(t.id, running[t.account]);
    // Aplicar
    if (addTypes.includes(t.type)) {
      running[t.account] += t.amount;
    } else if (subTypes.includes(t.type)) {
      running[t.account] -= t.amount;
    }
  });

  return prevBalMap;
}

// Borrar Item
function deleteTransaction(id) {
  Swal.fire({
    title: "¿Eliminar?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Sí",
  }).then((result) => {
    if (result.isConfirmed) {
      transactions = transactions.filter((t) => t.id !== id);
      saveData();
    }
  });
}

// Reset Total
function resetData() {
  Swal.fire({
    title: "¿Borrar todo?",
    text: currentUser
      ? "Se borrará de tu cuenta en la Nube."
      : "Se borrará de este dispositivo.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Sí, borrar todo",
  }).then((result) => {
    if (result.isConfirmed) {
      transactions = [];
      saveData();
    }
  });
}

// Modo Oscuro / Claro
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  const icon = document.getElementById("iconMode");
  if (icon)
    icon.className = isDark
      ? "fa-solid fa-sun text-warning"
      : "fa-solid fa-moon text-secondary";
  localStorage.setItem("theme", isDark ? "dark" : "light");
  if (assetsChart) renderChart(calculateBalances().bal);
  if (projectionChart) onProjectionInputChange();
  if (typeof updateSummary === "function" && document.getElementById("summaryStartDate")) updateSummary();
}

function checkTheme() {
  const theme = localStorage.getItem("theme");
  const icon = document.getElementById("iconMode");
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    if (icon) icon.className = "fa-solid fa-sun text-warning";
  } else {
    if (icon) icon.className = "fa-solid fa-moon text-secondary";
  }
}

// Calcula métricas de inversión (Shares, DCA / Costo promedio, Ganancia/Pérdida no realizada)
function calculateInvestmentMetrics(bal) {
  if (!bal) bal = calculateBalances().bal;

  const assets = ["SP500", "Nasdaq"];
  const metrics = {};

  assets.forEach((asset) => {
    const txs = transactions
      .filter((t) => (t.account === asset || (t.type === "transfer_in" && t.account === asset)) && ["ingreso", "transfer_in"].includes(t.type))
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id);

    let totalDeposited = 0;
    let totalShares = 0;
    const defaultPrice = asset === "SP500" ? 546.50 : 494.30;
    const currentPrice = liveMarketPrices[asset]?.price || defaultPrice;

    txs.forEach((t) => {
      totalDeposited += t.amount;
      if (t.shares && t.shares > 0) {
        totalShares += t.shares;
      } else if (t.sharePrice && t.sharePrice > 0) {
        totalShares += t.amount / t.sharePrice;
      } else {
        totalShares += t.amount / defaultPrice;
      }
    });

    const avgCost = totalShares > 0 ? (totalDeposited / totalShares) : 0;
    const currentMarketVal = totalShares > 0 ? (totalShares * currentPrice) : (bal[asset] || 0);
    const unrealizedPL = currentMarketVal - totalDeposited;
    const unrealizedPLPct = totalDeposited > 0 ? ((unrealizedPL / totalDeposited) * 100) : 0;

    metrics[asset] = {
      txCount: txs.length,
      firstTx: txs.length > 0 ? txs[0] : null,
      totalDeposited,
      totalShares,
      avgCost,
      currentPrice,
      currentMarketVal,
      unrealizedPL,
      unrealizedPLPct,
    };
  });

  return metrics;
}

// Cálculos
function calculateBalances() {
  let bal = {
    Pichincha: 0,
    DeUna: 0,
    Guayaquil: 0,
    PeiGo: 0,
    Produbanco: 0,
    Binance: 0,
    UglyCash: 0,
    Efectivo: 0,
    Airtm: 0,
    Hapi: 0,
    Morse: 0,
    SP500: 0,
    Nasdaq: 0,
    PorCobrar: 0,
    Total: 0,
  };
  let debts = {};

  transactions.forEach((t) => {
    let val = t.amount;

    // Sumas
    if (
      ["ingreso", "trade_profit", "loan_payment", "transfer_in"].includes(
        t.type,
      )
    ) {
      if (bal[t.account] !== undefined) bal[t.account] += val;
    }
    // Restas
    else if (
      ["gasto", "trade_loss", "loan_out", "transfer_out", "debt_payment"].includes(t.type)
    ) {
      if (bal[t.account] !== undefined) bal[t.account] -= val;
    }

    // Deudas (Todas interactúan con PorCobrar)
    if (t.type === "loan_out") {
      bal["PorCobrar"] += val;
      debts[t.person] = (debts[t.person] || 0) + val;
    } else if (t.type === "loan_payment") {
      bal["PorCobrar"] -= val;
      debts[t.person] = (debts[t.person] || 0) - val;
    } else if (t.type === "debt_in") {
      bal["PorCobrar"] -= val;
      debts[t.person] = (debts[t.person] || 0) - val;
    } else if (t.type === "debt_payment") {
      bal["PorCobrar"] += val;
      debts[t.person] = (debts[t.person] || 0) + val;
    }
  });

  // SUMA TOTAL CON TODOS LOS BANCOS Y BROKER
  bal["Total"] =
    bal["Pichincha"] +
    bal["Guayaquil"] +
    bal["Produbanco"] +
    bal["Binance"] +
    bal["PeiGo"] +
    bal["UglyCash"] +
    bal["Efectivo"] +
    bal["Hapi"] +
    bal["Airtm"] +
    bal["Morse"] +
    bal["SP500"] +
    bal["Nasdaq"] +
    bal["PorCobrar"];
  return { bal, debts };
}

// Renderizar Todo
function renderAll() {
  const { bal, debts } = calculateBalances();
  const invMetrics = calculateInvestmentMetrics(bal);

  if (document.getElementById("lblTotal"))
    document.getElementById("lblTotal").innerText = fmt.format(bal["Total"]);
  if (document.getElementById("lblPichincha"))
    document.getElementById("lblPichincha").innerText = fmt.format(
      bal["Pichincha"],
    );
  if (document.getElementById("lblDeUna"))
    document.getElementById("lblDeUna").innerText = fmt.format(bal["DeUna"]);

  // Nuevos Bancos
  if (document.getElementById("lblGuayaquil"))
    document.getElementById("lblGuayaquil").innerText = fmt.format(
      bal["Guayaquil"],
    );
  if (document.getElementById("lblPeiGo"))
    document.getElementById("lblPeiGo").innerText = fmt.format(bal["PeiGo"]);

  if (document.getElementById("lblProdubanco"))
    document.getElementById("lblProdubanco").innerText = fmt.format(
      bal["Produbanco"],
    );
  if (document.getElementById("lblBinance"))
    document.getElementById("lblBinance").innerText = fmt.format(
      bal["Binance"],
    );
  if (document.getElementById("lblUglyCash"))
    document.getElementById("lblUglyCash").innerText = fmt.format(
      bal["UglyCash"],
    );
  if (document.getElementById("lblEfectivo"))
    document.getElementById("lblEfectivo").innerText = fmt.format(
      bal["Efectivo"],
    );
  if (document.getElementById("lblAirtm"))
    document.getElementById("lblAirtm").innerText = fmt.format(bal["Airtm"]);
  if (document.getElementById("lblHapi"))
    document.getElementById("lblHapi").innerText = fmt.format(bal["Hapi"]);
  if (document.getElementById("lblMorse"))
    document.getElementById("lblMorse").innerText = fmt.format(bal["Morse"]);
  if (document.getElementById("lblSP500"))
    document.getElementById("lblSP500").innerText = fmt.format(bal["SP500"]);
  if (document.getElementById("lblNasdaq"))
    document.getElementById("lblNasdaq").innerText = fmt.format(bal["Nasdaq"]);
  if (document.getElementById("lblPorCobrar"))
    document.getElementById("lblPorCobrar").innerText = fmt.format(
      bal["PorCobrar"],
    );

  // Chips P&L badges en tarjeta Hapi
  const spPLChip = document.getElementById("chipSP500PL");
  const nasPLChip = document.getElementById("chipNasdaqPL");

  if (spPLChip && invMetrics.SP500) {
    if (invMetrics.SP500.totalDeposited > 0) {
      const pl = invMetrics.SP500.unrealizedPLPct;
      spPLChip.innerText = `${pl >= 0 ? "+" : ""}${pl.toFixed(1)}%`;
      spPLChip.className = pl >= 0 ? "hapi-chip-pl pl-pos" : "hapi-chip-pl pl-neg";
      spPLChip.classList.remove("d-none");
    } else {
      spPLChip.classList.add("d-none");
    }
  }

  if (nasPLChip && invMetrics.Nasdaq) {
    if (invMetrics.Nasdaq.totalDeposited > 0) {
      const pl = invMetrics.Nasdaq.unrealizedPLPct;
      nasPLChip.innerText = `${pl >= 0 ? "+" : ""}${pl.toFixed(1)}%`;
      nasPLChip.className = pl >= 0 ? "hapi-chip-pl pl-pos" : "hapi-chip-pl pl-neg";
      nasPLChip.classList.remove("d-none");
    } else {
      nasPLChip.classList.add("d-none");
    }
  }

  renderTable();
  renderDebtors(debts);
  renderChart(bal);
  if (document.getElementById("summaryStartDate")) {
    updateSummary();
  }
  updateProjectionActualsDisplay(bal, invMetrics);
}

// Renderizar Tabla
// --- FUNCIÓN RENDER TABLE CON PAGINACIÓN ---
function renderTable() {
  const tbody = document.getElementById("transactionTableBody");
  const filterEl = document.getElementById("filterAccount");
  const paginationDiv = document.getElementById("paginationControls");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const pageIndicator = document.getElementById("pageIndicator");

  if (!tbody || !filterEl) return;

  // 1. Filtrar datos
  const filter = filterEl.value;
  const filtered = transactions.filter(
    (t) => filter === "all" || t.account === filter,
  );

  // 2. Validaciones iniciales
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-5">No hay movimientos.</td></tr>';
    if (paginationDiv)
      paginationDiv.style.setProperty("display", "none", "important");
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
  tbody.innerHTML = "";
  const prevBalMap = computeRunningBalances();
  paginatedItems.forEach((t) => {
    let color = "",
      sign = "",
      label = "",
      icon = "";
    switch (t.type) {
      case "ingreso":
        color = "text-success";
        sign = "+";
        label = "Ingreso";
        icon = "fa-arrow-down";
        break;
      case "gasto":
        color = "text-danger";
        sign = "-";
        label = "Gasto";
        icon = "fa-arrow-up";
        break;
      case "transfer_out":
        color = "text-danger";
        sign = "-";
        label = "Envío Transf.";
        icon = "fa-arrow-right-from-bracket";
        break;
      case "transfer_in":
        color = "text-success";
        sign = "+";
        label = "Recibo Transf.";
        icon = "fa-arrow-right-to-bracket";
        break;
      case "trade_profit":
        color = "text-success";
        sign = "+";
        label = "Profit";
        icon = "fa-chart-line";
        break;
      case "trade_loss":
        color = "text-danger";
        sign = "-";
        label = "Loss";
        icon = "fa-chart-line";
        break;
      case "loan_out":
        color = "text-warning";
        sign = "-";
        label = `Préstamo (${t.person})`;
        icon = "fa-hand-holding-dollar";
        break;
      case "loan_payment":
        color = "text-primary";
        sign = "+";
        label = `Pago (${t.person})`;
        icon = "fa-hand-holding-dollar";
        break;
      case "debt_in":
        color = "text-warning";
        sign = "-";
        label = `Asumir Deuda (${t.person})`;
        icon = "fa-file-invoice-dollar";
        break;
      case "debt_payment":
        color = "text-danger";
        sign = "-";
        label = `Pagar Deuda (${t.person})`;
        icon = "fa-credit-card";
        break;
    }

    const prevBal = prevBalMap.get(t.id);
    const prevBalHtml = prevBal !== undefined
      ? `<span class="tx-prev-balance">${fmt.format(prevBal)}</span>`
      : "";

    const row = `<tr>
            <td class="ps-4 small opacity-75">${t.date}</td>
            <td><span class="badge bg-secondary badge-account">${t.account}</span></td>
            <td><div class="d-flex align-items-center"><i class="fa-solid ${icon} me-2 small text-muted"></i>${t.desc}</div></td>
            <td class="small">${label}</td>
            <td class="text-end">
              <span class="fw-bold ${color}">${sign}${fmt.format(t.amount)}</span>
              ${prevBalHtml}
            </td>
            <td class="text-center pe-4">
              <button class="btn btn-sm text-primary border-0 me-1" onclick="editTransaction(${t.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm text-danger border-0" onclick="deleteTransaction(${t.id})"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>`;
    tbody.innerHTML += row;
  });

  // 5. Actualizar Controles de Paginación
  if (paginationDiv) {
    // Mostrar paginación solo si hay más de 1 página (o más items que el límite)
    if (totalPages > 1) {
      paginationDiv.style.removeProperty("display"); // Mostrar (quita el display:none)
      paginationDiv.classList.add("d-flex"); // Asegura flex

      pageIndicator.innerText = `Página ${currentPage} de ${totalPages}`;

      // Deshabilitar botones si estamos en el límite
      btnPrev.disabled = currentPage === 1;
      btnNext.disabled = currentPage === totalPages;
    } else {
      paginationDiv.style.setProperty("display", "none", "important");
    }
  }
}

// Renderizar Deudores
function renderDebtors(debts) {
  const container = document.getElementById("debtCardsContainer");
  const msg = document.getElementById("noDebtsMsg");
  const datalist = document.getElementById("personList");
  
  if (datalist) {
    datalist.innerHTML = "";
    Object.keys(debts).forEach((person) => {
      datalist.innerHTML += `<option value="${person}"></option>`;
    });
  }

  if (!container) return;
  container.innerHTML = "";
  
  let count = Object.keys(debts).length;
  
  for (const [person, amount] of Object.entries(debts)) {
    let colorClass, lbl, borderCol;
    if (amount > 0.01) {
      colorClass = "text-success";
      lbl = "Te debe:";
      borderCol = "#20cc9c"; // Greenish
    } else if (amount < -0.01) {
      colorClass = "text-danger";
      lbl = "Le debes:";
      borderCol = "#d33"; // Redish
    } else {
      colorClass = "text-muted";
      lbl = "Saldado:";
      borderCol = "#9ca3af"; // Gray
    }

    const card = `<div class="col-md-6 mb-3">
              <div class="card card-custom debtor-card h-100 p-3 border-0 shadow-sm" style="border-left: 4px solid ${borderCol} !important; cursor:pointer;" onclick="viewPersonHistory('${person}')">
                  <div class="d-flex justify-content-between align-items-center">
                      <div><h6 class="fw-bold mb-1">${person}</h6><small class="text-muted">Click para ver detalles</small></div>
                      <div class="text-end">
                          <small class="text-muted d-block" style="font-size:0.75rem">${lbl}</small>
                          <h5 class="${colorClass} fw-bold mb-0">${fmt.format(Math.abs(amount))}</h5>
                      </div>
                  </div>
              </div>
          </div>`;
    container.innerHTML += card;
  }
  if (msg) msg.style.display = count === 0 ? "block" : "none";
}

// Renderizar Gráfico
function renderChart(bal) {
  const canvas = document.getElementById("assetsChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const isDark = document.body.classList.contains("dark-mode");
  const textColor = isDark ? "#cbd5e1" : "#475569";

  const data = {
    labels: [
      "Pichincha",
      "De Una",
      "Guayaquil",
      "PeiGo",
      "Produbanco",
      "Binance",
      "Ugly",
      "Efectivo",
      "Hapi",
      "Airtm",
      "Morse",
      "S&P 500",
      "NASDAQ",
      "Por Cobrar",
    ],
    datasets: [
      {
        data: [
          bal["Pichincha"],
          bal["DeUna"],
          bal["Guayaquil"],
          bal["PeiGo"],
          bal["Produbanco"],
          bal["Binance"],
          bal["UglyCash"],
          bal["Efectivo"],
          bal["Hapi"],
          bal["Airtm"],
          bal["Morse"],
          bal["SP500"],
          bal["Nasdaq"],
          bal["PorCobrar"],
        ].map((v) => Math.max(0, v)),
        backgroundColor: [
          "#FFDD00", // Pichincha
          "#1E90FF", // De Una
          "#E3007E", // Guayaquil
          "#00D1D1", // PeiGo
          "#141E30", // Produbanco
          "#F0B90B", // Binance
          "#1f2937", // Ugly
          "#485563", // Efectivo
          "#7c3aed", // Hapi
          "#00AEEF", // Airtm
          "#ff7e5f", // Morse
          "#00a651", // S&P 500
          "#283593", // NASDAQ
          "#8E2DE2", // Por Cobrar
        ],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  if (assetsChart) {
    assetsChart.data = data;
    assetsChart.options.plugins.legend.labels.color = textColor;
    assetsChart.update();
  } else {
    assetsChart = new Chart(ctx, {
      type: "doughnut",
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor, boxWidth: 10, font: { size: 11 } },
          },
        },
      },
    });
  }
}

// Estado de navegación de historial de persona y ciclos
let personHistoryState = {
  person: "",
  cycles: [],
  allTxs: [],
  selectedCycleIndex: 0,
};

// Ver historial persona con separación inteligente por ciclos, orden más reciente y saldos previos
function viewPersonHistory(person) {
  const modalEl = document.getElementById("modalPersonHistory");
  if (!modalEl) return;

  personHistoryState.person = person;

  // 1. Filtrar transacciones de esta persona y ordenar cronológicamente ascendente para calcular saldos progresivos
  const historyAsc = transactions
    .filter((t) => t.person === person)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let currentBalance = 0;
  let currentCycle = [];
  const rawCycles = [];
  const allEnrichedTxs = [];

  historyAsc.forEach((t, idx) => {
    const prevBal = currentBalance;
    let typeDesc = "";
    let typeBadge = "";
    let color = "";
    let impact = 0;

    if (t.type === "loan_out") {
      typeDesc = "Préstamo (Te debe)";
      typeBadge = `<span class="badge bg-warning-subtle text-warning border border-warning border-opacity-25"><i class="fa-solid fa-arrow-up-right-from-square me-1"></i>Préstamo</span>`;
      color = "text-warning";
      impact = t.amount;
    } else if (t.type === "loan_payment") {
      typeDesc = "Cobro (Te pagó)";
      typeBadge = `<span class="badge bg-success-subtle text-success border border-success border-opacity-25"><i class="fa-solid fa-arrow-down-left-and-up-right-to-center me-1"></i>Cobro</span>`;
      color = "text-success";
      impact = -t.amount;
    } else if (t.type === "debt_in") {
      typeDesc = "Deuda Asumida (Le debes)";
      typeBadge = `<span class="badge bg-danger-subtle text-danger border border-danger border-opacity-25"><i class="fa-solid fa-hand-holding-dollar me-1"></i>Deuda Asumida</span>`;
      color = "text-danger";
      impact = -t.amount;
    } else if (t.type === "debt_payment") {
      typeDesc = "Pago de Deuda (Le pagaste)";
      typeBadge = `<span class="badge bg-primary-subtle text-primary border border-primary border-opacity-25"><i class="fa-solid fa-money-bill-wave me-1"></i>Pago Deuda</span>`;
      color = "text-primary";
      impact = t.amount;
    }

    currentBalance = Math.round((currentBalance + impact) * 100) / 100;
    const isSettled = Math.abs(currentBalance) < 0.005;

    const txItem = {
      ...t,
      typeDesc,
      typeBadge,
      color,
      prevBalance: prevBal,
      newBalance: currentBalance,
      isSettled,
    };

    currentCycle.push(txItem);
    allEnrichedTxs.push(txItem);

    // Si la transacción dejó el saldo en 0 y hay más transacciones posteriores, cerramos este ciclo
    if (isSettled && idx < historyAsc.length - 1) {
      rawCycles.push([...currentCycle]);
      currentCycle = [];
    }
  });

  if (currentCycle.length > 0) {
    rawCycles.push(currentCycle);
  }

  // Invertir lista de ciclos para que el ciclo 0 sea el Ciclo Actual (el más reciente)
  personHistoryState.cycles = rawCycles.reverse();
  personHistoryState.allTxs = allEnrichedTxs;
  personHistoryState.selectedCycleIndex = 0; // Por defecto mostrar el ciclo actual

  renderPersonHistoryModalContent();
  new bootstrap.Modal(modalEl).show();
}

function selectDebtCycle(cycleIdx) {
  personHistoryState.selectedCycleIndex = cycleIdx;
  renderPersonHistoryModalContent();
}

function renderPersonHistoryModalContent() {
  const { person, cycles, allTxs, selectedCycleIndex } = personHistoryState;

  document.getElementById("modalPersonTitle").innerText = `Historial: ${person}`;

  const totalCycles = cycles.length;
  const currentTotalBal = allTxs.length > 0 ? allTxs[allTxs.length - 1].newBalance : 0;

  // Renderizar barra de navegación de ciclos
  const navEl = document.getElementById("personHistoryCyclesNav");
  if (navEl) {
    navEl.innerHTML = "";
    if (totalCycles > 1) {
      cycles.forEach((cyc, idx) => {
        const isCurrent = idx === 0;
        const cycEndBal = cyc[cyc.length - 1].newBalance;
        const cycSettled = Math.abs(cycEndBal) < 0.005;

        let label = "";
        if (isCurrent) {
          label = cycSettled ? `Ciclo Actual (Saldado)` : `Ciclo Actual (Activo)`;
        } else {
          label = `Ciclo Histórico ${totalCycles - idx} (${cycSettled ? "Saldado" : "Cerrado"})`;
        }

        const activeClass = selectedCycleIndex === idx ? "active" : "";
        navEl.innerHTML += `<button type="button" class="debt-cycle-btn ${activeClass}" onclick="selectDebtCycle(${idx})">${label} <small class="opacity-75">(${cyc.length})</small></button>`;
      });

      // Botón "Ver Todos"
      const allActive = selectedCycleIndex === -1 ? "active" : "";
      navEl.innerHTML += `<button type="button" class="debt-cycle-btn ${allActive}" onclick="selectDebtCycle(-1)"><i class="fa-solid fa-list me-1"></i>Ver Todos (${allTxs.length})</button>`;
    } else {
      navEl.innerHTML = `<span class="badge bg-secondary-subtle text-secondary px-3 py-2 rounded-pill"><i class="fa-solid fa-clock-rotate-left me-1"></i>Ciclo Único de Movimientos (${allTxs.length})</span>`;
    }
  }

  // Obtener transacciones a mostrar y ordenarlas DESCENDENTE (más recientes arriba)
  let displayTxs = [];
  if (selectedCycleIndex === -1) {
    displayTxs = [...allTxs].reverse();
  } else if (cycles[selectedCycleIndex]) {
    displayTxs = [...cycles[selectedCycleIndex]].reverse();
  }

  const tbody = document.getElementById("personHistoryBody");
  if (tbody) {
    tbody.innerHTML = "";

    displayTxs.forEach((t) => {
      const rowClass = t.isSettled ? "row-debt-settled" : "";

      // Monto con saldo previo
      const montoCol = `<div>
        <span class="fw-bold ${t.color}">${fmt.format(t.amount)}</span>
        <small class="tx-prev-balance">Deuda previa: ${fmt.format(Math.abs(t.prevBalance))}</small>
      </div>`;

      // Saldo resultante
      let saldoResultCol = "";
      if (t.isSettled) {
        saldoResultCol = `<span class="badge-settled-white"><i class="fa-solid fa-circle-check text-success"></i>Saldada ($0.00)</span>`;
      } else {
        saldoResultCol = `<div>
          <span class="fw-bold ${t.newBalance > 0 ? "text-success" : "text-danger"}">${fmt.format(Math.abs(t.newBalance))}</span>
          <small class="text-muted d-block" style="font-size:0.68rem;">${t.newBalance > 0 ? "Te debe" : "Le debes"}</small>
        </div>`;
      }

      tbody.innerHTML += `<tr class="${rowClass}">
        <td class="ps-3"><small class="fw-bold">${t.date}</small></td>
        <td>${t.typeBadge}</td>
        <td class="small text-muted">${t.desc || "-"}</td>
        <td class="text-end">${montoCol}</td>
        <td class="text-end pe-3">${saldoResultCol}</td>
      </tr>`;
    });
  }

  // Footer balance y resumen
  const balanceEl = document.getElementById("modalPersonBalance");
  const summaryEl = document.getElementById("modalPersonCycleSummary");

  if (balanceEl) {
    balanceEl.className = "fw-bold fs-4";
    if (currentTotalBal > 0.01) {
      balanceEl.innerText = "Te debe: " + fmt.format(currentTotalBal);
      balanceEl.classList.add("text-success");
      if (summaryEl) summaryEl.innerText = `Cuenta activa con saldo pendiente a tu favor`;
    } else if (currentTotalBal < -0.01) {
      balanceEl.innerText = "Le debes: " + fmt.format(Math.abs(currentTotalBal));
      balanceEl.classList.add("text-danger");
      if (summaryEl) summaryEl.innerText = `Cuenta activa con saldo pendiente que debes saldar`;
    } else {
      balanceEl.innerText = "✅ Totalmente Saldado: $0.00";
      balanceEl.classList.add("text-muted");
      if (summaryEl) summaryEl.innerText = `Todas las deudas han sido saldadas en $0.00`;
    }
  }
}

// Exportar JSON
function exportData() {
  const dataStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Respaldo_Finanzas_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Importar JSON
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const json = JSON.parse(e.target.result);
      if (Array.isArray(json)) {
        transactions = json;
        saveData();
        Swal.fire({
          icon: "success",
          title: "Restaurado",
          text: "Datos cargados.",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire("Error", "Archivo inválido", "error");
    }
  };
  reader.readAsText(file);
  input.value = "";
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
  const filter = document.getElementById("filterAccount").value;
  const totalItems = transactions.filter(
    (t) => filter === "all" || t.account === filter,
  ).length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
  }
}

// --- PREFERENCES LOGIC ---
const PREFS_KEY = "finanzas_prefs";
let hiddenAccounts = JSON.parse(localStorage.getItem(PREFS_KEY)) || [];

function savePreferences() {
  const checkboxes = document.querySelectorAll('.pref-checkbox');
  hiddenAccounts = [];
  checkboxes.forEach(cb => {
    if (!cb.checked) {
      hiddenAccounts.push(cb.value);
    }
  });
  localStorage.setItem(PREFS_KEY, JSON.stringify(hiddenAccounts));
  applyPreferences();
}

function loadPreferences() {
  const container = document.getElementById('prefsCheckboxContainer');
  if (container) {
    container.innerHTML = "";
    document.querySelectorAll('.account-card').forEach(card => {
      const acc = card.getAttribute('data-account');
      const isVisible = !hiddenAccounts.includes(acc);
      container.innerHTML += `
        <div class="col-6">
          <div class="form-check form-switch pl-0">
            <input class="form-check-input pref-checkbox" type="checkbox" value="${acc}" id="chk_${acc}" ${isVisible ? 'checked' : ''}>
            <label class="form-check-label small" for="chk_${acc}">${acc}</label>
          </div>
        </div>
      `;
    });
  }
  applyPreferences();
}

function applyPreferences() {
  let visibleCount = 0;
  document.querySelectorAll('.account-card').forEach(card => {
    const acc = card.getAttribute('data-account');
    if (hiddenAccounts.includes(acc)) {
      card.classList.add('d-none');
    } else {
      card.classList.remove('d-none');
      visibleCount++;
    }
  });

  const totalVisible = visibleCount + 1; // +1 for Patrimonio Neto
  const container = document.getElementById('tarjetas-container');
  if (container) {
    container.classList.remove('layout-cols-7', 'layout-cols-6', 'layout-cols-5', 'layout-cols-4', 'layout-cols-3');
    if (totalVisible >= 13) {
      container.classList.add('layout-cols-7');
    } else if (totalVisible >= 11) {
      container.classList.add('layout-cols-6');
    } else if (totalVisible >= 9) {
      container.classList.add('layout-cols-5');
    } else if (totalVisible >= 7) {
      container.classList.add('layout-cols-4');
    } else if (totalVisible >= 5) {
      container.classList.add('layout-cols-3');
    } else {
      container.classList.add('layout-cols-4');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
    const prefsModalEl = document.getElementById('prefsModal');
    if (prefsModalEl) {
        prefsModalEl.addEventListener('show.bs.modal', loadPreferences);
    }
    applyPreferences();

    // Summary inputs listeners
    const summaryStart = document.getElementById("summaryStartDate");
    const summaryEnd = document.getElementById("summaryEndDate");
    if (summaryStart && summaryEnd) {
      summaryStart.addEventListener("change", updateSummary);
      summaryEnd.addEventListener("change", updateSummary);
      setSummaryPeriod('this_month');
    }

    // Listeners para hint de comisión e investment preview en tiempo real
    const inputAmount = document.getElementById("inputAmount");
    const inputCommission = document.getElementById("inputCommission");
    const inputAccountTo = document.getElementById("inputAccountTo");
    const inputSharePrice = document.getElementById("inputSharePrice");
    const inputInvestAsset = document.getElementById("inputInvestAsset");
    const inputAccount = document.getElementById("inputAccount");

    if (inputAmount) {
      inputAmount.addEventListener("input", () => {
        updateCommissionHint();
        updateInvestPreview();
      });
    }
    if (inputCommission) {
      inputCommission.addEventListener("input", () => {
        updateCommissionHint();
        updateInvestPreview();
      });
    }
    if (inputAccountTo) inputAccountTo.addEventListener("change", updateCommissionHint);
    if (inputSharePrice) inputSharePrice.addEventListener("input", updateInvestPreview);
    if (inputInvestAsset) inputInvestAsset.addEventListener("change", onInvestAssetChange);
    if (inputAccount) inputAccount.addEventListener("change", updateInvestPreview);

    // Listener para cambiar ancho del layout según la pestaña activa
    document.querySelectorAll('#mainTab button[data-bs-toggle="pill"]').forEach((btn) => {
      btn.addEventListener('shown.bs.tab', (e) => {
        const targetId = e.target.getAttribute('data-bs-target');
        const colSidebar = document.getElementById("col-sidebar");
        const colMain = document.getElementById("col-main-content");

        if (targetId === "#tab-proyeccion") {
          if (colSidebar) colSidebar.classList.add("d-none");
          if (colMain) {
            colMain.classList.remove("col-lg-8", "col-xl-9");
            colMain.classList.add("col-12");
          }
          initProjectionTab();
          if (projectionChart) {
            setTimeout(() => {
              projectionChart.resize();
              projectionChart.update();
            }, 50);
          }
        } else {
          if (colSidebar) colSidebar.classList.remove("d-none");
          if (colMain) {
            colMain.classList.remove("col-12");
            colMain.classList.add("col-lg-8", "col-xl-9");
          }
          if (assetsChart) {
            setTimeout(() => {
              assetsChart.resize();
              assetsChart.update();
            }, 50);
          }
          if (targetId === "#tab-resumen" && typeof updateSummary === "function") {
            updateSummary();
          }
        }
      });
    });

    // Inicializar proyección en background
    initProjectionTab();
});

// --- EDIT LOGIC ---
function editTransaction(id) {
  const t = transactions.find((tx) => tx.id === id);
  if (!t) return;
  
  if (t.type === "transfer_in" || t.type === "transfer_out") {
    Swal.fire("Aviso", "No se pueden editar transferencias directamente. Elimina y vuelve a crearla.", "info");
    return;
  }

  editingId = id;
  
  document.getElementById("inputType").value = t.type;
  document.getElementById("inputAmount").value = t.amount;
  document.getElementById("inputAccount").value = t.account;
  document.getElementById("inputDesc").value = t.desc;
  document.getElementById("inputDate").value = t.date;
  if(t.person) {
    document.getElementById("inputPerson").value = t.person;
  } else {
    document.getElementById("inputPerson").value = "";
  }
  
  toggleFormFields();
  
  document.querySelector('#formTransaction button[type="submit"]').innerHTML = '<i class="fa-solid fa-pen me-2"></i>Actualizar';
  window.scrollTo(0, 0);
  document.getElementById("inputAmount").focus();
}

// --- RESUMEN FINANCIERO LOGIC ---
let summaryChart = null;

function setSummaryPeriod(period) {
  const startEl = document.getElementById("summaryStartDate");
  const endEl = document.getElementById("summaryEndDate");
  if (!startEl || !endEl) return;

  const today = new Date();
  let start, end;

  if (period === 'this_month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === 'last_month') {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (period === 'all') {
    if (transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date + "T00:00:00"));
      start = new Date(Math.min(...dates));
      end = new Date(Math.max(...dates));
    } else {
      start = new Date(today.getFullYear(), 0, 1);
      end = today;
    }
  }

  startEl.value = formatDateLocal(start);
  endEl.value = formatDateLocal(end);

  updateSummary();
}

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateSummary() {
  const startVal = document.getElementById("summaryStartDate")?.value;
  const endVal = document.getElementById("summaryEndDate")?.value;
  const accountVal = document.getElementById("summaryAccount")?.value || "all";

  if (!startVal || !endVal) return;

  const startDate = new Date(startVal + "T00:00:00");
  const endDate = new Date(endVal + "T23:59:59");

  let income = 0;
  let expenses = 0;
  let tradingProfit = 0;
  let tradingLoss = 0;
  let lent = 0;
  let borrowed = 0;
  
  const accountStats = {};
  const descriptionStats = {};

  transactions.forEach(t => {
    const tDate = new Date(t.date + "T00:00:00");
    if (tDate >= startDate && tDate <= endDate) {
      const isTargetAccount = (accountVal === "all" || t.account === accountVal || (t.type === "transfer" && t.accountTo === accountVal));
      if (!isTargetAccount) return;

      const val = t.amount;

      // Agrupación para gráfico por cuentas
      if (accountVal === "all") {
        if (!accountStats[t.account]) {
          accountStats[t.account] = { income: 0, expenses: 0 };
        }
        if (["ingreso", "trade_profit", "loan_payment", "transfer_in"].includes(t.type)) {
          accountStats[t.account].income += val;
        } else if (["gasto", "trade_loss", "loan_out", "debt_payment", "transfer_out"].includes(t.type)) {
          accountStats[t.account].expenses += val;
        }
      }

      // Cálculos totales
      if (t.type === "ingreso") {
        income += val;
      } else if (t.type === "gasto") {
        expenses += val;
        descriptionStats[t.desc || "Sin descripción"] = (descriptionStats[t.desc || "Sin descripción"] || 0) + val;
      } else if (t.type === "trade_profit") {
        tradingProfit += val;
        income += val;
      } else if (t.type === "trade_loss") {
        tradingLoss += val;
        expenses += val;
        descriptionStats[t.desc || "Trading Loss"] = (descriptionStats[t.desc || "Trading Loss"] || 0) + val;
      } else if (t.type === "loan_out") {
        lent += val;
        if (accountVal !== "all") {
          expenses += val;
          descriptionStats[`Préstamo a ${t.person}`] = (descriptionStats[`Préstamo a ${t.person}`] || 0) + val;
        }
      } else if (t.type === "debt_in") {
        borrowed += val;
      } else if (t.type === "loan_payment") {
        if (accountVal !== "all") {
          income += val;
        }
      } else if (t.type === "debt_payment") {
        if (accountVal !== "all") {
          expenses += val;
          descriptionStats[`Pago de Deuda a ${t.person}`] = (descriptionStats[`Pago de Deuda a ${t.person}`] || 0) + val;
        }
      } else if (t.type === "transfer_in" && accountVal !== "all") {
        income += val;
      } else if (t.type === "transfer_out" && accountVal !== "all") {
        expenses += val;
      }
    }
  });

  // Mostrar valores en DOM
  const net = income - expenses;
  document.getElementById("summaryIncome").innerText = fmt.format(income);
  document.getElementById("summaryExpenses").innerText = fmt.format(expenses);
  document.getElementById("summaryNet").innerText = fmt.format(net);

  const netCard = document.getElementById("summaryNetCard");
  if (netCard) {
    netCard.classList.remove("bg-success", "bg-danger", "text-white", "bg-light", "text-muted", "bg-success-subtle", "bg-danger-subtle", "text-success", "text-danger");
    if (net > 0.01) {
      netCard.classList.add("bg-success-subtle", "text-success");
    } else if (net < -0.01) {
      netCard.classList.add("bg-danger-subtle", "text-danger");
    } else {
      netCard.classList.add("bg-light", "text-muted");
    }
  }

  // Trading
  document.getElementById("summaryTradingProfit").innerText = fmt.format(tradingProfit);
  document.getElementById("summaryTradingLoss").innerText = fmt.format(tradingLoss);
  const tradingNet = tradingProfit - tradingLoss;
  const tradingNetEl = document.getElementById("summaryTradingNet");
  if (tradingNetEl) {
    tradingNetEl.innerText = fmt.format(tradingNet);
    tradingNetEl.className = tradingNet > 0.01 ? "fw-bold text-success" : (tradingNet < -0.01 ? "fw-bold text-danger" : "fw-bold text-muted");
  }

  // Deudas
  document.getElementById("summaryLent").innerText = fmt.format(lent);
  document.getElementById("summaryBorrowed").innerText = fmt.format(borrowed);
  const debtFlow = lent - borrowed;
  const debtFlowEl = document.getElementById("summaryDebtFlow");
  if (debtFlowEl) {
    debtFlowEl.innerText = fmt.format(debtFlow);
    debtFlowEl.className = debtFlow > 0.01 ? "fw-bold text-warning" : (debtFlow < -0.01 ? "fw-bold text-danger" : "fw-bold text-muted");
  }

  // Lista de mayores gastos
  const topExpensesContainer = document.getElementById("summaryTopExpenses");
  if (topExpensesContainer) {
    topExpensesContainer.innerHTML = "";
    const sortedExpenses = Object.entries(descriptionStats).sort((a, b) => b[1] - a[1]);
    if (sortedExpenses.length === 0) {
      topExpensesContainer.innerHTML = '<div class="text-center text-muted py-4 small">No hay gastos en este periodo.</div>';
    } else {
      sortedExpenses.slice(0, 5).forEach(([desc, amount]) => {
        const pct = expenses > 0 ? ((amount / expenses) * 100).toFixed(0) : 0;
        topExpensesContainer.innerHTML += `
          <div class="list-group-item bg-transparent d-flex justify-content-between align-items-center py-2 px-0 border-bottom-0">
            <div>
              <span class="small fw-bold d-block text-truncate" style="max-width: 180px;">${desc}</span>
              <span class="text-muted" style="font-size: 0.75rem;">${pct}% del total</span>
            </div>
            <span class="fw-bold text-danger small">${fmt.format(amount)}</span>
          </div>
        `;
      });
    }
  }

  // Renderizar Gráfico
  renderSummaryChart(accountStats, accountVal);
}

function renderSummaryChart(accountStats, accountVal) {
  const canvas = document.getElementById("summaryChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const isDark = document.body.classList.contains("dark-mode");
  const textColor = isDark ? "#cbd5e1" : "#475569";

  let labels = [];
  let incomeData = [];
  let expenseData = [];

  if (accountVal === "all") {
    labels = Object.keys(accountStats).filter(acc => accountStats[acc].income > 0.01 || accountStats[acc].expenses > 0.01);
    labels.forEach(acc => {
      incomeData.push(accountStats[acc].income);
      expenseData.push(accountStats[acc].expenses);
    });
  } else {
    const typeStats = {
      "Ingresos": 0,
      "Gastos": 0,
      "Profit Trading": 0,
      "Loss Trading": 0,
      "Cobros/Préstamos": 0,
      "Transf. Recibidas": 0,
      "Transf. Enviadas": 0
    };
    
    const startVal = document.getElementById("summaryStartDate")?.value;
    const endVal = document.getElementById("summaryEndDate")?.value;
    const startDate = new Date(startVal + "T00:00:00");
    const endDate = new Date(endVal + "T23:59:59");

    transactions.forEach(t => {
      const tDate = new Date(t.date + "T00:00:00");
      if (tDate >= startDate && tDate <= endDate) {
        const val = t.amount;
        if (t.account === accountVal) {
          if (t.type === "ingreso") typeStats["Ingresos"] += val;
          else if (t.type === "gasto") typeStats["Gastos"] += val;
          else if (t.type === "trade_profit") typeStats["Profit Trading"] += val;
          else if (t.type === "trade_loss") typeStats["Loss Trading"] += val;
          else if (t.type === "loan_out") typeStats["Cobros/Préstamos"] += val;
          else if (t.type === "debt_payment") typeStats["Cobros/Préstamos"] += val;
          else if (t.type === "transfer_out") typeStats["Transf. Enviadas"] += val;
        }
        if (t.account === accountVal && t.type === "transfer_in") {
          typeStats["Transf. Recibidas"] += val;
        }
        if (t.person && t.person !== "") {
          if (t.type === "loan_payment" && t.account === accountVal) typeStats["Cobros/Préstamos"] += val;
        }
      }
    });

    labels = Object.keys(typeStats).filter(k => typeStats[k] > 0.01);
    labels.forEach(label => {
      if (["Ingresos", "Profit Trading", "Transf. Recibidas", "Cobros/Préstamos"].includes(label)) {
        incomeData.push(typeStats[label]);
        expenseData.push(0);
      } else {
        incomeData.push(0);
        expenseData.push(typeStats[label]);
      }
    });
  }

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Ingresos",
        data: incomeData,
        backgroundColor: "#20cc9c",
        borderWidth: 0,
        borderRadius: 4,
      },
      {
        label: "Gastos",
        data: expenseData,
        backgroundColor: "#ff4d4d",
        borderWidth: 0,
        borderRadius: 4,
      }
    ]
  };

  if (summaryChart) {
    summaryChart.destroy();
  }

  summaryChart = new Chart(ctx, {
    type: "bar",
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { size: 10 } }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 10 } }
        },
        y: {
          grid: { color: isDark ? "#334155" : "#e2e8f0" },
          ticks: { color: textColor, font: { size: 10 } }
        }
      }
    }
  });
}

// --- PASSWORD RESET & CHANGE LOGIC ---
function forgotPassword(e) {
  if (e) e.preventDefault();
  
  // Cerrar el modal de autenticación para que no tape el SweetAlert
  const modalEl = document.getElementById("modalAuth");
  let modalInstance = null;
  if (modalEl) {
    modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  }

  const emailInput = document.getElementById("authEmail")?.value.trim() || "";
  
  Swal.fire({
    title: 'Restablecer Contraseña',
    text: 'Ingresa tu correo electrónico registrado y te enviaremos un enlace gratuito para restablecer tu contraseña:',
    input: 'email',
    inputValue: emailInput,
    showCancelButton: true,
    confirmButtonText: 'Enviar Enlace',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    inputPlaceholder: 'tu-correo@ejemplo.com',
    inputValidator: (value) => {
      if (!value) {
        return '¡Debes escribir un correo electrónico!';
      }
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      const email = result.value;
      Swal.showLoading();
      auth.sendPasswordResetEmail(email)
        .then(() => {
          Swal.fire({
            icon: 'success',
            title: '¡Correo Enviado!',
            text: `Se envió un correo de restablecimiento a: ${email}. Revisa tu bandeja de entrada y correo no deseado (spam).`,
            confirmButtonText: 'Entendido'
          });
        })
        .catch((error) => {
          console.error("Error enviando restablecimiento:", error);
          let msg = "No se pudo enviar el correo de restablecimiento. Inténtalo más tarde.";
          if (error.code === "auth/user-not-found") {
            msg = "No existe ningún usuario registrado con este correo electrónico.";
          } else if (error.code === "auth/invalid-email") {
            msg = "El formato de correo no es válido.";
          }
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: msg
          }).then(() => {
            // Reabrir modal si hubo un error para que el usuario pueda corregir los datos
            if (modalInstance) modalInstance.show();
          });
        });
    } else {
      // Si cancela, reabrir el modal
      if (modalInstance) modalInstance.show();
    }
  });
}

function changePasswordLoggedIn() {
  if (!currentUser) return;
  
  Swal.fire({
    title: 'Cambiar Contraseña',
    text: `¿Deseas recibir un correo electrónico en ${currentUser.email} para actualizar tu contraseña de forma segura?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, enviar correo',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.showLoading();
      auth.sendPasswordResetEmail(currentUser.email)
        .then(() => {
          Swal.fire({
            icon: 'success',
            title: '¡Correo Enviado!',
            text: `Se ha enviado un enlace seguro para restablecer tu contraseña a: ${currentUser.email}`,
            confirmButtonText: 'Entendido'
          });
        })
        .catch((error) => {
          console.error("Error al enviar restablecimiento:", error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al enviar el correo. Por favor, inténtalo de nuevo.'
          });
        });
    }
  });
}

// =========================================================================
// --- SIMULADOR DE PROYECCIÓN DE INVERSIONES & REGLA DEL 4% ---
// =========================================================================

let projectionChart = null;
const PROJ_SETTINGS_KEY = "finanzas_projection_settings_v2";

// Actualiza la visualización de saldo real y metadatos históricos de S&P 500 y NASDAQ
function updateProjectionActualsDisplay(bal, invMetrics) {
  if (!bal) bal = calculateBalances().bal;
  if (!invMetrics) invMetrics = calculateInvestmentMetrics(bal);

  const spData = invMetrics.SP500 || { totalDeposited: 0, totalShares: 0, avgCost: 0, currentMarketVal: bal["SP500"] || 0, unrealizedPLPct: 0 };
  const nasData = invMetrics.Nasdaq || { totalDeposited: 0, totalShares: 0, avgCost: 0, currentMarketVal: bal["Nasdaq"] || 0, unrealizedPLPct: 0 };

  // Actualizar displays principales de saldo actual
  const spDisplay = document.getElementById("sp500RealBalDisplay");
  const nasDisplay = document.getElementById("nasdaqRealBalDisplay");
  if (spDisplay) spDisplay.innerText = fmt.format(spData.currentMarketVal);
  if (nasDisplay) nasDisplay.innerText = fmt.format(nasData.currentMarketVal);

  // Actualizar métricas DCA S&P 500
  const spSharesEl = document.getElementById("sp500SharesDisplay");
  const spAvgEl = document.getElementById("sp500AvgCostDisplay");
  const spPLEl = document.getElementById("sp500PLDisplay");
  if (spSharesEl) spSharesEl.innerText = spData.totalShares.toFixed(2);
  if (spAvgEl) spAvgEl.innerText = fmt.format(spData.avgCost);
  if (spPLEl) {
    if (spData.totalDeposited > 0) {
      spPLEl.innerText = `${spData.unrealizedPLPct >= 0 ? "+" : ""}${spData.unrealizedPLPct.toFixed(1)}%`;
      spPLEl.className = spData.unrealizedPLPct >= 0 ? "fw-bold text-success" : "fw-bold text-danger";
    } else {
      spPLEl.innerText = "+0.0%";
      spPLEl.className = "fw-bold text-muted";
    }
  }

  // Actualizar métricas DCA NASDAQ
  const nasSharesEl = document.getElementById("nasdaqSharesDisplay");
  const nasAvgEl = document.getElementById("nasdaqAvgCostDisplay");
  const nasPLEl = document.getElementById("nasdaqPLDisplay");
  if (nasSharesEl) nasSharesEl.innerText = nasData.totalShares.toFixed(2);
  if (nasAvgEl) nasAvgEl.innerText = fmt.format(nasData.avgCost);
  if (nasPLEl) {
    if (nasData.totalDeposited > 0) {
      nasPLEl.innerText = `${nasData.unrealizedPLPct >= 0 ? "+" : ""}${nasData.unrealizedPLPct.toFixed(1)}%`;
      nasPLEl.className = nasData.unrealizedPLPct >= 0 ? "fw-bold text-info" : "fw-bold text-danger";
    } else {
      nasPLEl.innerText = "+0.0%";
      nasPLEl.className = "fw-bold text-muted";
    }
  }

  // Badges y textos informativos S&P 500
  const spCountEl = document.getElementById("sp500DepositsCountText");
  const spBadgeEl = document.getElementById("sp500HistoryInfoBadge");
  if (spCountEl) {
    spCountEl.innerText = `${spData.txCount || 0} ${(spData.txCount || 0) === 1 ? "compra registrada" : "compras registradas"}`;
  }
  if (spBadgeEl) {
    if (spData.firstTx) {
      spBadgeEl.innerText = `Primer aporte: ${spData.firstTx.date} (${fmt.format(spData.firstTx.amount)})`;
    } else {
      spBadgeEl.innerText = "Sin compras previas";
    }
  }

  // Badges y textos informativos NASDAQ
  const nasCountEl = document.getElementById("nasdaqDepositsCountText");
  const nasBadgeEl = document.getElementById("nasdaqHistoryInfoBadge");
  if (nasCountEl) {
    nasCountEl.innerText = `${nasData.txCount || 0} ${(nasData.txCount || 0) === 1 ? "compra registrada" : "compras registradas"}`;
  }
  if (nasBadgeEl) {
    if (nasData.firstTx) {
      nasBadgeEl.innerText = `Primer aporte: ${nasData.firstTx.date} (${fmt.format(nasData.firstTx.amount)})`;
    } else {
      nasBadgeEl.innerText = "Sin compras previas";
    }
  }
}

// Inicializa la pestaña de proyección
function initProjectionTab() {
  const { bal } = calculateBalances();
  updateProjectionActualsDisplay(bal);

  // Cargar configuración de aportes mensuales futuros y tasas guardadas
  const saved = localStorage.getItem(PROJ_SETTINGS_KEY);
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (document.getElementById("sliderProjYears")) document.getElementById("sliderProjYears").value = s.years || 10;
      if (document.getElementById("inputProjSP500Monthly")) document.getElementById("inputProjSP500Monthly").value = s.sp500Monthly !== undefined ? s.sp500Monthly : 300;
      if (document.getElementById("sliderProjSP500Monthly")) document.getElementById("sliderProjSP500Monthly").value = s.sp500Monthly !== undefined ? s.sp500Monthly : 300;
      if (document.getElementById("sliderProjSP500Rate")) document.getElementById("sliderProjSP500Rate").value = s.sp500Rate || 10.0;

      if (document.getElementById("inputProjNasdaqMonthly")) document.getElementById("inputProjNasdaqMonthly").value = s.nasdaqMonthly !== undefined ? s.nasdaqMonthly : 300;
      if (document.getElementById("sliderProjNasdaqMonthly")) document.getElementById("sliderProjNasdaqMonthly").value = s.nasdaqMonthly !== undefined ? s.nasdaqMonthly : 300;
      if (document.getElementById("sliderProjNasdaqRate")) document.getElementById("sliderProjNasdaqRate").value = s.nasdaqRate || 12.5;
    } catch (e) {
      console.error("Error cargando configuración de proyección:", e);
    }
  }

  onProjectionInputChange();
}

// Sincronizadores de inputs y sliders
function syncSP500MonthlyInput(val) {
  const slider = document.getElementById("sliderProjSP500Monthly");
  if (slider) slider.value = Math.min(3000, Math.max(0, parseFloat(val) || 0));
  onProjectionInputChange();
}

function syncSP500MonthlySlider(val) {
  const input = document.getElementById("inputProjSP500Monthly");
  if (input) input.value = val;
  onProjectionInputChange();
}

function syncNasdaqMonthlyInput(val) {
  const slider = document.getElementById("sliderProjNasdaqMonthly");
  if (slider) slider.value = Math.min(3000, Math.max(0, parseFloat(val) || 0));
  onProjectionInputChange();
}

function syncNasdaqMonthlySlider(val) {
  const input = document.getElementById("inputProjNasdaqMonthly");
  if (input) input.value = val;
  onProjectionInputChange();
}

function setProjectionYears(years) {
  const slider = document.getElementById("sliderProjYears");
  if (slider) slider.value = years;
  onProjectionInputChange();
}

// Función central de cálculo y renderizado de la simulación
function onProjectionInputChange() {
  const { bal } = calculateBalances();
  updateProjectionActualsDisplay(bal);

  // Capital base inicial tomado SIEMPRE en tiempo real de la base de datos
  const sp500Init = Math.max(0, bal["SP500"] || 0);
  const nasdaqInit = Math.max(0, bal["Nasdaq"] || 0);

  const years = parseInt(document.getElementById("sliderProjYears")?.value) || 10;
  const sp500Monthly = parseFloat(document.getElementById("inputProjSP500Monthly")?.value) || 0;
  const sp500Rate = parseFloat(document.getElementById("sliderProjSP500Rate")?.value) || 10.0;

  const nasdaqMonthly = parseFloat(document.getElementById("inputProjNasdaqMonthly")?.value) || 0;
  const nasdaqRate = parseFloat(document.getElementById("sliderProjNasdaqRate")?.value) || 12.5;

  // Actualizar labels visuales de los sliders
  if (document.getElementById("lblProjYears")) {
    document.getElementById("lblProjYears").innerText = `${years} ${years === 1 ? "Año" : "Años"}`;
  }
  if (document.getElementById("projYearsBadge")) {
    document.getElementById("projYearsBadge").innerText = `${years} ${years === 1 ? "Año" : "Años"}`;
  }

  // Sincronizar tick labels de escala graduada
  document.querySelectorAll(".slider-ticks span").forEach((span) => {
    const y = parseInt(span.getAttribute("onclick")?.match(/\d+/)?.[0]);
    if (y === years) {
      span.style.color = "#8e54e9";
      span.style.fontWeight = "800";
    } else {
      span.style.color = "";
      span.style.fontWeight = "";
    }
  });

  if (document.getElementById("lblProjSP500Monthly")) {
    document.getElementById("lblProjSP500Monthly").innerText = fmt.format(sp500Monthly);
  }
  if (document.getElementById("lblProjSP500Rate")) {
    document.getElementById("lblProjSP500Rate").innerText = `${sp500Rate.toFixed(1)}%`;
  }
  if (document.getElementById("lblProjNasdaqMonthly")) {
    document.getElementById("lblProjNasdaqMonthly").innerText = fmt.format(nasdaqMonthly);
  }
  if (document.getElementById("lblProjNasdaqRate")) {
    document.getElementById("lblProjNasdaqRate").innerText = `${nasdaqRate.toFixed(1)}%`;
  }
  if (document.getElementById("projChartTitle")) {
    document.getElementById("projChartTitle").innerText = `Proyección a ${years} ${years === 1 ? "Año" : "Años"} (Interés Compuesto)`;
  }

  // Guardar configuración en localStorage (solo variables futuras)
  const settingsToSave = {
    years,
    sp500Monthly,
    sp500Rate,
    nasdaqMonthly,
    nasdaqRate,
  };
  localStorage.setItem(PROJ_SETTINGS_KEY, JSON.stringify(settingsToSave));

  // --- CÁLCULO MES A MES (INTERÉS COMPUESTO) ---
  const totalMonths = years * 12;
  const monthlyRateSP = sp500Rate / 100 / 12;
  const monthlyRateNas = nasdaqRate / 100 / 12;

  let currentValSP = sp500Init;
  let currentValNas = nasdaqInit;
  let currentDeposited = sp500Init + nasdaqInit;

  // Generar etiquetas y puntos para el gráfico
  const labels = [];
  const totalSeries = [];
  const sp500Series = [];
  const nasdaqSeries = [];
  const depositedSeries = [];
  const yearBreakdowns = [];

  // Punto inicial (Mes 0 / Año 0)
  labels.push("Inicio");
  totalSeries.push(Math.round(currentValSP + currentValNas));
  sp500Series.push(Math.round(currentValSP));
  nasdaqSeries.push(Math.round(currentValNas));
  depositedSeries.push(Math.round(currentDeposited));

  for (let m = 1; m <= totalMonths; m++) {
    // Rendimiento del mes + Aporte mensual
    currentValSP = currentValSP * (1 + monthlyRateSP) + sp500Monthly;
    currentValNas = currentValNas * (1 + monthlyRateNas) + nasdaqMonthly;
    currentDeposited += (sp500Monthly + nasdaqMonthly);

    // Guardar puntos clave para el gráfico (cada año, o cada mes si es <= 2 años)
    const isYearEnd = m % 12 === 0;
    const isShortHorizon = years <= 2;

    if (isYearEnd || isShortHorizon) {
      const yearNum = m / 12;
      const labelText = isYearEnd ? `Año ${yearNum}` : `Mes ${m}`;
      labels.push(labelText);
      totalSeries.push(Math.round(currentValSP + currentValNas));
      sp500Series.push(Math.round(currentValSP));
      nasdaqSeries.push(Math.round(currentValNas));
      depositedSeries.push(Math.round(currentDeposited));
    }

    if (isYearEnd) {
      const currentTotal = currentValSP + currentValNas;
      const annual4Pct = currentTotal * 0.04;
      const monthly4Pct = annual4Pct / 12;
      yearBreakdowns.push({
        year: m / 12,
        deposited: currentDeposited,
        sp500: currentValSP,
        nasdaq: currentValNas,
        total: currentTotal,
        monthlyPension: monthly4Pct,
      });
    }
  }

  // --- MÉTRICAS FINALES (KPIS) ---
  const finalTotal = currentValSP + currentValNas;
  const finalDeposited = currentDeposited;
  const finalInterest = Math.max(0, finalTotal - finalDeposited);
  const interestPercent = finalDeposited > 0 ? ((finalInterest / finalDeposited) * 100).toFixed(1) : 0;
  const multiplier = finalDeposited > 0 ? (finalTotal / finalDeposited).toFixed(2) : "1.00";

  // Actualizar DOM KPIs
  if (document.getElementById("projDeposited")) {
    document.getElementById("projDeposited").innerText = fmt.format(finalDeposited);
  }
  if (document.getElementById("projInterest")) {
    document.getElementById("projInterest").innerText = fmt.format(finalInterest);
  }
  if (document.getElementById("projInterestPercent")) {
    document.getElementById("projInterestPercent").innerText = `+${interestPercent}% de ganancia`;
  }
  if (document.getElementById("projTotalFinal")) {
    document.getElementById("projTotalFinal").innerText = fmt.format(finalTotal);
  }
  if (document.getElementById("projMultiplier")) {
    document.getElementById("projMultiplier").innerText = `${multiplier}x`;
  }

  // --- REGLA DEL 4% (RETIRO SEGURO / JUBILACIÓN) ---
  const safeAnnualWithdrawal = finalTotal * 0.04;
  const safeMonthlyWithdrawal = safeAnnualWithdrawal / 12;
  const intactCapital = finalTotal * 0.96;

  if (document.getElementById("projMonthlyPension")) {
    document.getElementById("projMonthlyPension").innerText = `${fmt.format(safeMonthlyWithdrawal)} / mes`;
  }
  if (document.getElementById("projAnnualPension")) {
    document.getElementById("projAnnualPension").innerText = `${fmt.format(safeAnnualWithdrawal)} / año`;
  }
  if (document.getElementById("projIntactCapital")) {
    document.getElementById("projIntactCapital").innerText = fmt.format(intactCapital);
  }

  // --- RENDERIZAR TABLA DE EVOLUCIÓN ---
  const evolutionTbody = document.getElementById("projEvolutionTableBody");
  if (evolutionTbody) {
    evolutionTbody.innerHTML = "";
    yearBreakdowns.forEach((row) => {
      evolutionTbody.innerHTML += `
        <tr>
          <td class="ps-3 fw-bold">Año ${row.year}</td>
          <td class="text-end text-muted">${fmt.format(row.deposited)}</td>
          <td class="text-end text-success">${fmt.format(row.sp500)}</td>
          <td class="text-end text-primary">${fmt.format(row.nasdaq)}</td>
          <td class="text-end fw-bold">${fmt.format(row.total)}</td>
          <td class="text-end fw-bold text-success pe-3">${fmt.format(row.monthlyPension)} / mes</td>
        </tr>
      `;
    });
  }

  // --- RENDERIZAR GRÁFICO ---
  renderProjectionChart(labels, totalSeries, sp500Series, nasdaqSeries, depositedSeries);
}

// Renderiza el gráfico de Chart.js para la proyección
function renderProjectionChart(labels, totalSeries, sp500Series, nasdaqSeries, depositedSeries) {
  const canvas = document.getElementById("projectionChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const isDark = document.body.classList.contains("dark-mode");
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  // Crear degradado suave para el área del Total
  const gradientTotal = ctx.createLinearGradient(0, 0, 0, 300);
  gradientTotal.addColorStop(0, isDark ? "rgba(168, 85, 247, 0.45)" : "rgba(142, 84, 233, 0.25)");
  gradientTotal.addColorStop(1, "rgba(168, 85, 247, 0.0)");

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Total Portafolio",
        data: totalSeries,
        borderColor: "#a855f7",
        backgroundColor: gradientTotal,
        fill: true,
        tension: 0.38,
        borderWidth: 3.5,
        pointRadius: labels.length > 20 ? 1 : 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: "#a855f7",
      },
      {
        label: "S&P 500",
        data: sp500Series,
        borderColor: "#10b981",
        backgroundColor: "transparent",
        fill: false,
        tension: 0.38,
        borderWidth: 2.2,
        pointRadius: labels.length > 20 ? 0 : 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: "#10b981",
      },
      {
        label: "NASDAQ-100",
        data: nasdaqSeries,
        borderColor: "#38bdf8",
        backgroundColor: "transparent",
        fill: false,
        tension: 0.38,
        borderWidth: 2.2,
        pointRadius: labels.length > 20 ? 0 : 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: "#38bdf8",
      },
      {
        label: "Capital Depositado (Base)",
        data: depositedSeries,
        borderColor: "#94a3b8",
        backgroundColor: "transparent",
        fill: false,
        borderDash: [6, 6],
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: "#94a3b8",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: textColor,
          boxWidth: 12,
          usePointStyle: true,
          font: { size: 11, weight: "600" },
        },
      },
      tooltip: {
        backgroundColor: isDark ? "#1e293b" : "#ffffff",
        titleColor: isDark ? "#ffffff" : "#0f172a",
        bodyColor: isDark ? "#cbd5e1" : "#334155",
        borderColor: isDark ? "#475569" : "#e2e8f0",
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        callbacks: {
          label: function (context) {
            return ` ${context.dataset.label}: ${fmt.format(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback: function (val) {
            if (val >= 1000000) return "$" + (val / 1000000).toFixed(1) + "M";
            if (val >= 1000) return "$" + (val / 1000).toFixed(0) + "k";
            return "$" + val;
          },
        },
      },
    },
  };

  if (projectionChart) {
    projectionChart.data = data;
    projectionChart.options = options;
    projectionChart.update();
  } else {
    projectionChart = new Chart(ctx, {
      type: "line",
      data: data,
      options: options,
    });
  }
}



