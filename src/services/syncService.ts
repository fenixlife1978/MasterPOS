"use client";

import { db, rtdb } from '@/lib/firebase';
import { 
  doc, setDoc, deleteDoc, 
  collection, getDocs, writeBatch, runTransaction, updateDoc, query, where, orderBy, limit, getDoc,
  onSnapshot  // ✅ NUEVA IMPORTACIÓN (para tiempo real)
} from 'firebase/firestore';
import { ref, set, onValue } from 'firebase/database';
import { localCache } from '@/lib/localCache';

// ========== INTERFACES ==========
interface PendingOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
}

// ========== VARIABLES GLOBALES ==========
let pendingQueue: PendingOperation[] = [];
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isSyncing = false;
let isLoggingOut = false;

// ========== INICIALIZACIÓN ==========
async function loadPendingQueue() {
  pendingQueue = await localCache.getAllPending();
}
loadPendingQueue();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { 
    isOnline = true; 
    console.log("🌐 Conexión recuperada. Procesando cola...");
    processQueue(); 
  });
  window.addEventListener('offline', () => { 
    isOnline = false; 
    console.log("🔌 Modo Offline activado.");
  });
}

// ========== UTILIDADES ==========
const deepClean = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(v => deepClean(v)).filter(v => v !== null);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const val = deepClean(obj[key]);
      if (val !== null && val !== undefined) cleaned[key] = val;
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  if (typeof obj === 'number' && (isNaN(obj) || !isFinite(obj))) return 0;
  return obj;
};

const sanitizeForFirestore = (obj: any) => {
  if (obj === null || obj === undefined) return {};
  const result = deepClean(obj);
  return result === null ? {} : result;
};

const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

// ========== COLA DE OPERACIONES PENDIENTES ==========
async function processQueue() {
  if (!isOnline || isSyncing || pendingQueue.length === 0 || !db) return;
  isSyncing = true;
  const toRetry: PendingOperation[] = [];
  
  console.log(`⏳ Sincronizando ${pendingQueue.length} operaciones pendientes...`);

  for (const op of pendingQueue) {
    try {
      const data = sanitizeForFirestore(op.data);
      switch(op.type) {
        case 'saveProducts':
          const pBatch = writeBatch(db);
          (data as any[]).forEach((p: any) => pBatch.set(doc(db, 'products', p.id.toString()), { ...p, updatedAt: Date.now() }));
          await pBatch.commit();
          break;
        case 'updateProductStock':
          await updateDoc(doc(db, 'products', data.id.toString()), { stock: data.newStock, updatedAt: Date.now() });
          break;
        case 'updateStockRTDB':
          if (rtdb) {
            const stockRef = ref(rtdb, `stock/${data.productId}`);
            await set(stockRef, data.newStock);
          }
          break;
        case 'saveTransaction':
          await setDoc(doc(db, 'transactions', data.id.toString()), { ...data, createdAt: Date.now() });
          break;
        case 'saveAccountingEntry':
          await setDoc(doc(db, 'accounting_entries', data.id.toString()), { ...data, createdAt: Date.now() });
          break;
        case 'saveSupplier':
          await setDoc(doc(db, 'suppliers', data.id.toString()), { ...data, updatedAt: Date.now() });
          break;
        case 'savePurchaseInvoice':
          await setDoc(doc(db, 'purchase_invoices', data.id.toString()), data);
          break;
        case 'saveSupplierPayment':
          await setDoc(doc(db, 'supplier_payments', data.id.toString()), { ...data, createdAt: Date.now() });
          break;
        case 'saveRegister':
          if (data.terminalId) {
            await setDoc(doc(db, 'registers', data.terminalId), { ...data.reg, updatedAt: Date.now() }, { merge: true });
          } else {
            await setDoc(doc(db, 'register', 'current'), { ...data, updatedAt: Date.now() }, { merge: true });
          }
          break;
        case 'saveClient':
          await setDoc(doc(db, 'clients', data.id.toString()), { ...data, updatedAt: Date.now() });
          break;
        case 'saveAccount':
          await setDoc(doc(db, 'accounts', data.id.toString()), { ...data, updatedAt: Date.now() });
          break;
        case 'saveGlobalSettings':
          await setDoc(doc(db, 'global_settings', 'global'), { ...data, updatedAt: Date.now() });
          break;
        case 'saveKardexEntry':
          await setDoc(doc(db, 'kardex_entries', data.id), { ...data, createdAt: Date.now() });
          break;
        case 'saveTerminal':
          await setDoc(doc(db, 'terminals', data.name), { ...data, updatedAt: Date.now() });
          break;
        case 'saveCashClose':
          await setDoc(doc(db, 'cash_closes', data.id), { ...data, createdAt: Date.now() });
          break;
        case 'saveCashSession':
          await setDoc(doc(db, 'cash_sessions', data.id), { ...data, updatedAt: Date.now() });
          break;
        case 'updateCashSession':
          await setDoc(doc(db, 'cash_sessions', data.id), { ...data, updatedAt: Date.now() });
          break;
        case 'updateTerminal':
          await setDoc(doc(db, 'terminals', data.id), { ...data.updates, updatedAt: Date.now() }, { merge: true });
          break;
        case 'updateUserTerminalId':
          await updateDoc(doc(db, 'users', data.userId), { terminalId: data.terminalId, updatedAt: Date.now() });
          break;
        case 'deleteProduct':
          await deleteDoc(doc(db, 'products', data.id.toString()));
          if (rtdb) {
            const stockRef = ref(rtdb, `stock/${data.id}`);
            await set(stockRef, null);
          }
          break;
        case 'deleteClient':
          await deleteDoc(doc(db, 'clients', data.id.toString()));
          break;
        case 'deleteTransaction':
          await deleteDoc(doc(db, 'transactions', data.id.toString()));
          break;
      }
      await localCache.deletePending(op.id);
    } catch (error) {
      console.error(`❌ Error en operación ${op.type}:`, error);
      op.retries++;
      if (op.retries < 5) toRetry.push(op);
    }
  }
  pendingQueue = toRetry;
  await localCache.clearPending();
  for (const op of pendingQueue) {
    await localCache.savePendingOperation(op);
  }
  isSyncing = false;
  console.log("✅ Sincronización completada.");
}

async function addToQueue(type: string, data: any) {
  const op: PendingOperation = { 
    id: `${Date.now()}_${Math.random()}`, 
    type, 
    data, 
    timestamp: Date.now(), 
    retries: 0 
  };
  await localCache.savePendingOperation(op);
  pendingQueue.push(op);
  if (isOnline) processQueue();
}

// ========== FUNCIONES DE STOCK (RTDB en tiempo real) ==========
const updateStockInRTDB = async (productId: number, newStock: number) => {
  if (!rtdb) return;
  const stockRef = ref(rtdb, `stock/${productId}`);
  if (!isOnline) {
    await addToQueue('updateStockRTDB', { productId, newStock });
    return;
  }
  await set(stockRef, newStock);
};

// ========== FUNCIONES DE CARGA INICIAL Y REFRESCO ==========
async function fetchAndCacheCollection(name: string, queryFn?: () => Promise<any[]>) {
  if (!db) return [];
  try {
    let data: any[];
    if (queryFn) {
      data = await queryFn();
    } else {
      const snap = await getDocs(collection(db, name));
      data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    await localCache.saveCollection(name, data);
    console.log(`📦 Cargada colección: ${name} (${data.length} docs)`);
    return data;
  } catch (error) {
    console.error(`Error cargando ${name}:`, error);
    return [];
  }
}

// ========== SERVICIO PRINCIPAL ==========
export const syncService = {
  setLoggingOut(status: boolean) {
    isLoggingOut = status;
  },

  unsubscribeAll() {
    console.log("No hay suscripciones activas (modo offline-first)");
  },

  // ========== CARGA MASIVA AL INICIAR ==========
  async loadAllDataToCache() {
    console.log("🔄 Descargando todas las colecciones a caché local...");
    await Promise.all([
      this.refreshProducts(),
      this.refreshClients(),
      this.refreshTransactions(),
      this.refreshAccounts(),
      this.refreshAccountingEntries(),
      this.refreshSuppliers(),
      this.refreshPurchaseInvoices(),
      this.refreshKardexEntries(),
      this.refreshTerminals(),
      this.refreshGlobalSettings(),
      this.refreshCashCloses(),
    ]);
    console.log("✅ Caché local actualizada.");
  },

  // Métodos de refresco individuales
  async refreshProducts() {
    const snap = await getDocs(query(collection(db, 'products'), limit(2000)));
    const data = snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }));
    await localCache.saveCollection('products', data);
    return data;
  },
  async refreshClients() {
    const snap = await getDocs(collection(db, 'clients'));
    const data = snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }));
    await localCache.saveCollection('clients', data);
    return data;
  },
  async refreshTransactions() {
    const snap = await getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(1000)));
    const data = snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }));
    await localCache.saveCollection('transactions', data);
    return data;
  },
  async refreshAccounts() {
    const snap = await getDocs(collection(db, 'accounts'));
    const data = snap.docs.map(d => d.data());
    await localCache.saveCollection('accounts', data);
    return data;
  },
  async refreshAccountingEntries() {
    const snap = await getDocs(query(collection(db, 'accounting_entries'), orderBy('date', 'desc'), limit(2000)));
    const data = snap.docs.map(d => d.data());
    await localCache.saveCollection('accounting_entries', data);
    return data;
  },
  async refreshSuppliers() {
    const snap = await getDocs(collection(db, 'suppliers'));
    const data = snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }));
    await localCache.saveCollection('suppliers', data);
    return data;
  },
  async refreshPurchaseInvoices() {
    const snap = await getDocs(query(collection(db, 'purchase_invoices'), orderBy('date', 'desc'), limit(500)));
    const data = snap.docs.map(d => d.data());
    await localCache.saveCollection('purchase_invoices', data);
    return data;
  },
  async refreshKardexEntries() {
    const snap = await getDocs(query(collection(db, 'kardex_entries'), orderBy('createdAt', 'desc'), limit(2000)));
    const data = snap.docs.map(d => d.data());
    await localCache.saveCollection('kardex_entries', data);
    return data;
  },
  async refreshTerminals() {
    const snap = await getDocs(collection(db, 'terminals'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await localCache.saveCollection('terminals', data);
    return data;
  },
  async refreshGlobalSettings() {
    const snap = await getDoc(doc(db, 'global_settings', 'global'));
    const data = snap.exists() ? snap.data() : null;
    await localCache.saveCollection('global_settings', data ? [data] : []);
    return data;
  },
  async refreshCashCloses() {
    const snap = await getDocs(query(collection(db, 'cash_closes'), orderBy('fecha', 'desc')));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await localCache.saveCollection('cash_closes', data);
    return data;
  },

  // ========== LECTURAS DESDE CACHÉ LOCAL ==========
  async getProducts() { return await localCache.getCollection('products'); },
  async getClients() { return await localCache.getCollection('clients'); },
  async getTransactions() { return await localCache.getCollection('transactions'); },
  async getAllTransactions() { return await this.getTransactions(); },
  async getAccounts() { return await localCache.getCollection('accounts'); },
  async getAccountingEntries() { return await localCache.getCollection('accounting_entries'); },
  async getAllAccountingEntries() { return await this.getAccountingEntries(); },
  async getSuppliers() { return await localCache.getCollection('suppliers'); },
  async getPurchaseInvoices() { return await localCache.getCollection('purchase_invoices'); },
  async getKardexEntries() { return await localCache.getCollection('kardex_entries'); },
  async getAllKardexEntries() { return await this.getKardexEntries(); },
  async getTerminals() { return await localCache.getCollection('terminals'); },
  async getAllTerminals() { return await this.getTerminals(); },
  async getTerminal(id: string) { 
    const terminals = await this.getTerminals(); 
    return terminals.find(t => t.id === id) || null; 
  },
  async getGlobalSettings() { 
    const arr = await localCache.getCollection('global_settings'); 
    return arr[0] || null; 
  },
  async getCashCloses() { return await localCache.getCollection('cash_closes'); },
  async getAllCashCloses() { return await this.getCashCloses(); },
  async getAdminCode() {
    const settings = await this.getGlobalSettings();
    if (settings && settings.adminCode) return { code: settings.adminCode };
    return null;
  },

  // ========== SUSCRIPCIONES (COMPATIBILIDAD - DEVUELVEN DATOS UNA VEZ) ==========
  subscribeToProducts(cb: (data: any[]) => void) { this.getProducts().then(cb); return () => {}; },
  subscribeToClients(cb: (data: any[]) => void) { this.getClients().then(cb); return () => {}; },
  subscribeToTransactions(cb: (data: any[]) => void) { this.getTransactions().then(cb); return () => {}; },
  subscribeToAccounts(cb: (data: any[]) => void) { this.getAccounts().then(cb); return () => {}; },
  subscribeToAccounting(cb: (data: any[]) => void) { this.getAccountingEntries().then(cb); return () => {}; },
  subscribeToSuppliers(cb: (data: any[]) => void) { this.getSuppliers().then(cb); return () => {}; },
  subscribeToPurchaseInvoices(cb: (data: any[]) => void) { this.getPurchaseInvoices().then(cb); return () => {}; },
  subscribeToKardex(cb: (data: any[]) => void) { this.getKardexEntries().then(cb); return () => {}; },
  subscribeToTerminals(cb: (data: any[]) => void) { this.getTerminals().then(cb); return () => {}; },
  subscribeToTerminal(id: string, cb: (terminal: any) => void) { this.getTerminal(id).then(cb); return () => {}; },
  subscribeToGlobalSettings(cb: (data: any) => void) { this.getGlobalSettings().then(cb); return () => {}; },
  subscribeToCashCloses(cb: (data: any[]) => void) { this.getCashCloses().then(cb); return () => {}; },
  subscribeToRegister(cb: (data: any) => void) { cb(null); return () => {}; },
  subscribeToRegisterByTerminal(terminalId: string, cb: (data: any) => void) { cb(null); return () => {}; },
  subscribeToActiveSession(terminalId: string, cb: (session: any | null) => void) { cb(null); return () => {}; },
  subscribeToTransactionsBySession(sessionId: string, cb: (transactions: any[]) => void) { cb([]); return () => {}; },

  // ✅ NUEVO: Suscripción en TIEMPO REAL para una terminal (usa onSnapshot de Firestore)
  subscribeToTerminalRealtime(terminalId: string, callback: (terminal: any) => void): () => void {
    if (!db || !terminalId) return () => {};
    const terminalRef = doc(db, 'terminals', terminalId);
    const unsub = onSnapshot(terminalRef, (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (error) => {
      console.warn('⚠️ Error en suscripción tiempo real de terminal:', error);
    });
    return unsub;
  },

  // ========== STOCK RTDB (TIEMPO REAL - SIN COSTO) ==========
  subscribeToStockRTDB(callback: (stockData: Record<string, number>) => void) {
    if (!rtdb) return () => {};
    const stockRef = ref(rtdb, 'stock');
    const unsub = onValue(stockRef, (snapshot) => {
      callback(snapshot.val() || {});
    }, (error) => {
      console.warn('⚠️ Error en suscripción a RTDB stock:', error);
    });
    return unsub;
  },

  async getStockFromRTDB(productId: number): Promise<number | null> {
    if (!rtdb || !isOnline) return null;
    const stockRef = ref(rtdb, `stock/${productId}`);
    const snapshot = await new Promise<any>((resolve) => {
      onValue(stockRef, resolve, { onlyOnce: true });
    });
    return snapshot.val();
  },

  async initializeStockRTDB(products: any[]) {
    if (!rtdb || !isOnline) return;
    const stockData: Record<string, number> = {};
    products.forEach(p => { stockData[p.id.toString()] = p.stock; });
    await set(ref(rtdb, 'stock'), stockData);
    console.log(`📦 Stock inicializado en RTDB: ${products.length} productos`);
  },

  async updateStockInRTDB(productId: number, newStock: number) {
    await updateStockInRTDB(productId, newStock);
  },

  // ========== ESCRITURAS (GUARDAN LOCAL + ENCOLAN) ==========
  async saveProduct(product: any) {
    const products = await this.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index !== -1) products[index] = product;
    else products.push(product);
    await localCache.saveCollection('products', products);
    await addToQueue('saveProducts', [product]);
    if (product.stock !== undefined) {
      await this.updateStockInRTDB(product.id, product.stock);
    }
  },

  async saveProducts(products: any[]) {
    const current = await this.getProducts();
    const map = new Map(current.map(p => [p.id, p]));
    for (const p of products) map.set(p.id, p);
    const updated = Array.from(map.values());
    await localCache.saveCollection('products', updated);
    await addToQueue('saveProducts', products);
    for (const p of products) {
      if (p.stock !== undefined) {
        await this.updateStockInRTDB(p.id, p.stock);
      }
    }
  },

  async deleteProduct(id: number) {
    let products = await this.getProducts();
    products = products.filter(p => p.id !== id);
    await localCache.saveCollection('products', products);
    await addToQueue('deleteProduct', { id });
    if (rtdb) {
      const stockRef = ref(rtdb, `stock/${id}`);
      await set(stockRef, null);
    }
  },

  async saveClient(client: any) {
    const clients = await this.getClients();
    const index = clients.findIndex(c => c.id === client.id);
    if (index !== -1) clients[index] = client;
    else clients.push(client);
    await localCache.saveCollection('clients', clients);
    await addToQueue('saveClient', client);
  },

  async deleteClient(id: number) {
    let clients = await this.getClients();
    clients = clients.filter(c => c.id !== id);
    await localCache.saveCollection('clients', clients);
    await addToQueue('deleteClient', { id });
  },

  async saveTransaction(tx: any) {
    const txs = await this.getTransactions();
    const index = txs.findIndex(t => t.id === tx.id);
    if (index !== -1) txs[index] = tx;
    else txs.unshift(tx);
    await localCache.saveCollection('transactions', txs);
    await addToQueue('saveTransaction', tx);
  },

  async deleteTransaction(id: number) {
    let txs = await this.getTransactions();
    txs = txs.filter(t => t.id !== id);
    await localCache.saveCollection('transactions', txs);
    await addToQueue('deleteTransaction', { id });
  },

  async deleteAllTransactions() {
    await localCache.saveCollection('transactions', []);
    const all = await this.getTransactions();
    for (const tx of all) {
      await addToQueue('deleteTransaction', { id: tx.id });
    }
  },

  async saveAccount(acc: any) {
    const accounts = await this.getAccounts();
    const index = accounts.findIndex(a => a.id === acc.id);
    if (index !== -1) accounts[index] = acc;
    else accounts.push(acc);
    await localCache.saveCollection('accounts', accounts);
    await addToQueue('saveAccount', acc);
  },

  async saveAccountingEntry(entry: any) {
    const entries = await this.getAccountingEntries();
    const index = entries.findIndex(e => e.id === entry.id);
    if (index !== -1) entries[index] = entry;
    else entries.unshift(entry);
    await localCache.saveCollection('accounting_entries', entries);
    await addToQueue('saveAccountingEntry', entry);
  },

  async deleteAllAccountingEntries() {
    await localCache.saveCollection('accounting_entries', []);
    const all = await this.getAccountingEntries();
    for (const entry of all) {
      await addToQueue('deleteAccountingEntry', { id: entry.id });
    }
  },

  async saveSupplier(supplier: any) {
    const suppliers = await this.getSuppliers();
    const index = suppliers.findIndex(s => s.id === supplier.id);
    if (index !== -1) suppliers[index] = supplier;
    else suppliers.push(supplier);
    await localCache.saveCollection('suppliers', suppliers);
    await addToQueue('saveSupplier', supplier);
  },

  async deleteSupplier(id: number) {
    let suppliers = await this.getSuppliers();
    suppliers = suppliers.filter(s => s.id !== id);
    await localCache.saveCollection('suppliers', suppliers);
    await addToQueue('deleteSupplier', { id });
  },

  async savePurchaseInvoice(invoice: any) {
    const invoices = await this.getPurchaseInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index !== -1) invoices[index] = invoice;
    else invoices.unshift(invoice);
    await localCache.saveCollection('purchase_invoices', invoices);
    await addToQueue('savePurchaseInvoice', invoice);
  },

  async deletePurchaseInvoice(id: number) {
    let invoices = await this.getPurchaseInvoices();
    invoices = invoices.filter(i => i.id !== id);
    await localCache.saveCollection('purchase_invoices', invoices);
    await addToQueue('deletePurchaseInvoice', { id });
  },

  async savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
    // Opcional: guardar localmente si usas purchase_items
    for (const item of items) {
      await addToQueue('savePurchaseItem', item);
    }
  },

  async saveSupplierPayment(payment: any) {
    const payments = await localCache.getCollection('supplier_payments') || [];
    const index = payments.findIndex(p => p.id === payment.id);
    if (index !== -1) payments[index] = payment;
    else payments.unshift(payment);
    await localCache.saveCollection('supplier_payments', payments);
    await addToQueue('saveSupplierPayment', payment);
  },

  async deleteSupplierPayment(id: number) {
    let payments = await localCache.getCollection('supplier_payments') || [];
    payments = payments.filter(p => p.id !== id);
    await localCache.saveCollection('supplier_payments', payments);
    await addToQueue('deleteSupplierPayment', { id });
  },

  async saveKardexEntry(entry: any) {
    const entries = await this.getKardexEntries();
    const index = entries.findIndex(e => e.id === entry.id);
    if (index !== -1) entries[index] = entry;
    else entries.unshift(entry);
    await localCache.saveCollection('kardex_entries', entries);
    await addToQueue('saveKardexEntry', entry);
  },

  async deleteAllKardexEntries() {
    await localCache.saveCollection('kardex_entries', []);
    const all = await this.getKardexEntries();
    for (const entry of all) {
      await addToQueue('deleteKardexEntry', { id: entry.id });
    }
  },

  async saveKardexBatch(entries: any[]) {
    for (const entry of entries) {
      await this.saveKardexEntry(entry);
    }
    console.log(`📦 Kardex batch guardado localmente: ${entries.length} entradas`);
  },

  async saveAccountingBatch(entries: any[]) {
    for (const entry of entries) {
      await this.saveAccountingEntry(entry);
    }
    console.log(`📊 Contabilidad batch guardada localmente: ${entries.length} entradas`);
  },

  async saveTerminal(terminal: any) {
    const terminals = await this.getTerminals();
    const index = terminals.findIndex(t => t.id === terminal.name);
    if (index !== -1) terminals[index] = terminal;
    else terminals.push(terminal);
    await localCache.saveCollection('terminals', terminals);
    await addToQueue('saveTerminal', terminal);
  },

  async deleteTerminal(id: string) {
    let terminals = await this.getTerminals();
    terminals = terminals.filter(t => t.id !== id);
    await localCache.saveCollection('terminals', terminals);
    await addToQueue('deleteTerminal', { id });
  },

  async updateTerminalBlockStatus(terminalId: string, isBlocked: boolean) {
    const terminals = await this.getTerminals();
    const terminal = terminals.find(t => t.id === terminalId);
    if (terminal) {
      terminal.isBlocked = isBlocked;
      await localCache.saveCollection('terminals', terminals);
      await addToQueue('updateTerminal', { id: terminalId, updates: { isBlocked } });
    }
  },

  async updateTerminal(terminalId: string, updates: Record<string, any>) {
    const terminals = await this.getTerminals();
    const terminal = terminals.find(t => t.id === terminalId);
    if (terminal) {
      Object.assign(terminal, updates);
      await localCache.saveCollection('terminals', terminals);
      await addToQueue('updateTerminal', { id: terminalId, updates });
    }
  },

  async updateUserTerminalId(userId: string, terminalId: string | null) {
    await addToQueue('updateUserTerminalId', { userId, terminalId });
  },

  async saveGlobalSettings(settings: any) {
    const current = await this.getGlobalSettings();
    const merged = { ...current, ...settings, updatedAt: Date.now() };
    await localCache.saveCollection('global_settings', [merged]);
    await addToQueue('saveGlobalSettings', merged);
  },

  async saveCashClose(closeData: any) {
    const closes = await this.getCashCloses();
    const index = closes.findIndex(c => c.id === closeData.id);
    if (index !== -1) closes[index] = closeData;
    else closes.unshift(closeData);
    await localCache.saveCollection('cash_closes', closes);
    await addToQueue('saveCashClose', closeData);
  },

  async deleteAllCashCloses() {
    await localCache.saveCollection('cash_closes', []);
    const all = await this.getCashCloses();
    for (const close of all) {
      await addToQueue('deleteCashClose', { id: close.id });
    }
  },

  async saveRegister(reg: any) {
    await addToQueue('saveRegister', reg);
  },

  async clearRegister() {
    await addToQueue('clearRegister', {});
  },

  async saveRegisterByTerminal(terminalId: string, reg: any) {
    await addToQueue('saveRegister', { terminalId, reg });
  },

  async clearRegisterByTerminal(terminalId: string) {
    await addToQueue('clearRegister', { terminalId });
  },

  async createCashSession(terminalId: string, userId: string, initialAmountUsd: number) {
    const sessionId = `SES-${Date.now()}-${terminalId}`;
    const sessionData = {
      id: sessionId,
      terminalId,
      userId,
      initialAmountUsd: roundTo2(initialAmountUsd),
      currentAmountUsd: roundTo2(initialAmountUsd),
      openTime: new Date().toISOString(),
      status: 'abierta',
      closeTime: null,
      finalAmountUsd: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const sessions = await localCache.getCollection('cash_sessions') || [];
    sessions.push(sessionData);
    await localCache.saveCollection('cash_sessions', sessions);
    await addToQueue('saveCashSession', sessionData);
    return sessionData;
  },

  async getActiveSessionByTerminal(terminalId: string) {
    const sessions = await localCache.getCollection('cash_sessions') || [];
    return sessions.find(s => s.terminalId === terminalId && s.status === 'abierta') || null;
  },

  async closeCashSession(sessionId: string, finalAmountUsd: number) {
    let sessions = await localCache.getCollection('cash_sessions') || [];
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Sesión no encontrada');
    session.status = 'cerrada';
    session.closeTime = new Date().toISOString();
    session.finalAmountUsd = roundTo2(finalAmountUsd);
    session.updatedAt = Date.now();
    await localCache.saveCollection('cash_sessions', sessions);
    await addToQueue('updateCashSession', session);
    return session;
  },

  async getTransactionsBySession(sessionId: string, limitCount: number = 500) {
    const all = await this.getTransactions();
    return all.filter(t => t.sessionId === sessionId).slice(0, limitCount);
  },

  async saveTransactionWithCurrentSession(tx: any, terminalId?: string) {
    let sessionId = tx.sessionId;
    if (!sessionId && terminalId) {
      const active = await this.getActiveSessionByTerminal(terminalId);
      if (active) sessionId = active.id;
    }
    const txWithSession = { ...tx, sessionId: sessionId || null };
    await this.saveTransaction(txWithSession);
  },

  // ========== VENTA ATÓMICA (ACTUALIZA STOCK EN RTDB + GUARDA LOCAL) ==========
  async runAtomicSale(terminalId: string, txData: any, updates: {
    products: Map<number, { newStock: number }>;
    kardexEntries: any[];
    accountingEntry?: any;
    registerUpdate: { txs: any[] };
  }) {
    // 1. Actualizar stock localmente y en RTDB (tiempo real)
    const products = await this.getProducts();
    for (const [prodId, { newStock }] of updates.products.entries()) {
      const prod = products.find(p => p.id === prodId);
      if (prod) prod.stock = newStock;
      await this.updateStockInRTDB(prodId, newStock);
    }
    await localCache.saveCollection('products', products);

    // 2. Guardar transacción local
    await this.saveTransaction(txData);

    // 3. Guardar kardex entries local
    for (const entry of updates.kardexEntries) {
      await this.saveKardexEntry(entry);
    }

    // 4. Guardar accounting entry si existe
    if (updates.accountingEntry) {
      await this.saveAccountingEntry(updates.accountingEntry);
    }

    // 5. Actualizar register (caja) local
    let registers = await localCache.getCollection('registers') || [];
    const regIdx = registers.findIndex(r => r.terminalId === terminalId);
    if (regIdx !== -1) {
      registers[regIdx].txs.push(...updates.registerUpdate.txs);
    } else {
      registers.push({ terminalId, txs: updates.registerUpdate.txs });
    }
    await localCache.saveCollection('registers', registers);

    // 6. Encolar operaciones para sincronización posterior
    await addToQueue('saveTransaction', txData);
    for (const entry of updates.kardexEntries) {
      await addToQueue('saveKardexEntry', entry);
    }
    if (updates.accountingEntry) {
      await addToQueue('saveAccountingEntry', updates.accountingEntry);
    }
    await addToQueue('saveRegister', { terminalId, reg: { txs: updates.registerUpdate.txs } });
    // Las actualizaciones de stock RTDB ya se hicieron en tiempo real, pero las encolamos también por si acaso
    for (const [productId, { newStock }] of updates.products.entries()) {
      await addToQueue('updateStockRTDB', { productId, newStock });
    }
  },

  async updateProductWithWeightedAverageCost(productId: number, newQty: number, newCostUsd: number, exchangeRate: number) {
    if (!db) throw new Error('Firebase no disponible');
    const newCostUsdRounded = roundTo4(newCostUsd);
    const exchangeRateRounded = roundTo2(exchangeRate);
    
    let updatedStock: number = 0;
    let updatedCostUsd: number = 0;
    let updatedPriceUsd: number = 0;
    let updatedPriceBs: number = 0;
    
    // Obtener producto actual del caché
    const products = await this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error(`Producto ${productId} no existe`);
    
    const currentStock = product.stock || 0;
    const currentCostUsd = product.costUsd || 0;
    const profitPercent = product.profitPercent || 30;
    
    let newAverageCost: number;
    if (currentStock <= 0) {
      newAverageCost = newCostUsdRounded;
    } else {
      const totalCostBefore = currentStock * currentCostUsd;
      const totalCostNew = newQty * newCostUsdRounded;
      const newTotalStock = currentStock + newQty;
      newAverageCost = roundTo4((totalCostBefore + totalCostNew) / newTotalStock);
    }
    
    const priceUsd = roundTo2(newAverageCost * (1 + profitPercent / 100));
    const priceBs = roundTo2(priceUsd * exchangeRateRounded);
    const newStock = currentStock + newQty;
    updatedStock = newStock;
    updatedCostUsd = newAverageCost;
    updatedPriceUsd = priceUsd;
    updatedPriceBs = priceBs;
    
    // Actualizar producto en caché
    product.stock = newStock;
    product.costUsd = newAverageCost;
    product.costBs = roundTo2(newAverageCost * exchangeRateRounded);
    product.priceUsd = priceUsd;
    product.priceBs = priceBs;
    product.updatedAt = Date.now();
    await localCache.saveCollection('products', products);
    
    // Crear entrada de kardex
    const kardexEntry = {
      id: `${Date.now()}_${productId}_${Math.random()}`,
      productId: productId,
      date: new Date().toISOString(),
      type: 'compra',
      quantity: newQty,
      previousStock: currentStock,
      newStock: newStock,
      reference: `Compra - CPP aplicado`,
      note: `Costo ant: $${currentCostUsd.toFixed(4)} → Nuevo: $${newAverageCost.toFixed(4)}`,
      costUsd: newCostUsdRounded,
      costBs: roundTo2(newCostUsdRounded * exchangeRateRounded),
    };
    await this.saveKardexEntry(kardexEntry);
    
    // Encolar actualización en Firestore
    await addToQueue('updateProductStock', { id: productId, newStock });
    await addToQueue('updateProductCost', { id: productId, costUsd: newAverageCost, priceUsd, priceBs });
    
    // Actualizar stock en RTDB
    await this.updateStockInRTDB(productId, newStock);
    
    return { newStock: updatedStock, newAverageCost: updatedCostUsd, newPriceUsd: updatedPriceUsd, newPriceBs: updatedPriceBs };
  },

  // ========== SINCRONIZACIÓN MANUAL (BOTÓN) ==========
  async syncAllPending() {
    if (!isOnline) {
      console.warn("⚠️ No hay conexión a internet. No se puede sincronizar.");
      return false;
    }
    console.log("🔄 Iniciando sincronización manual...");
    await processQueue();
    await this.loadAllDataToCache();
    console.log("✅ Sincronización completa");
    return true;
  },

  getPendingQueueLength() {
    return pendingQueue.length;
  },

  // ========== ELIMINACIONES MASIVAS (para reset) ==========
  async deleteAllSupplierPayments() {
    await localCache.saveCollection('supplier_payments', []);
    // Encolar eliminaciones
    const all = await localCache.getCollection('supplier_payments') || [];
    for (const p of all) {
      await addToQueue('deleteSupplierPayment', { id: p.id });
    }
  },

  async deleteAllSuppliers() {
    await localCache.saveCollection('suppliers', []);
    const all = await this.getSuppliers();
    for (const s of all) {
      await addToQueue('deleteSupplier', { id: s.id });
    }
  },

  async deleteAllTerminals() {
    await localCache.saveCollection('terminals', []);
    const all = await this.getTerminals();
    for (const t of all) {
      await addToQueue('deleteTerminal', { id: t.id });
    }
  },

  async deleteAllUsersExceptAdmin() {
    // Esto es delicado, mejor hacerlo solo en Firestore directamente
    console.warn("deleteAllUsersExceptAdmin debe ejecutarse manualmente en Firestore");
  }
};

// Exportar funciones útiles para componentes
export const { loadAllDataToCache, syncAllPending } = syncService;