
"use client";

import { db } from '@/lib/firebase';
import { 
  doc, setDoc, deleteDoc, 
  collection, query, onSnapshot, limit,
  orderBy, writeBatch, getDoc, getDocs, runTransaction, where, updateDoc
} from 'firebase/firestore';

interface PendingOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
}

let pendingQueue: PendingOperation[] = [];
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isSyncing = false;

if (typeof window !== 'undefined') {
  const savedQueue = localStorage.getItem('firebase_pending_queue');
  if (savedQueue) {
    try { pendingQueue = JSON.parse(savedQueue); } catch(e) {}
  }
  window.addEventListener('online', () => { isOnline = true; processQueue(); });
  window.addEventListener('offline', () => { isOnline = false; });
}

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
  // ✅ Evitar NaN e Infinity
  if (typeof obj === 'number' && (isNaN(obj) || !isFinite(obj))) return 0;
  return obj;
};

const sanitizeForFirestore = (obj: any) => {
  if (obj === null || obj === undefined) return {};
  const result = deepClean(obj);
  return result === null ? {} : result;
};

const processQueue = async () => {
  if (!isOnline || isSyncing || pendingQueue.length === 0 || !db) return;
  isSyncing = true;
  const toRetry: PendingOperation[] = [];
  
  for (const op of pendingQueue) {
    try {
      const data = sanitizeForFirestore(op.data);
      switch(op.type) {
        case 'saveProducts':
          const pBatch = writeBatch(db);
          (data as any[]).forEach((p: any) => pBatch.set(doc(db, 'products', p.id.toString()), { ...p, updatedAt: Date.now() }));
          await pBatch.commit();
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
            await setDoc(doc(db, 'registers', data.terminalId), { ...data.reg, updatedAt: Date.now() });
          } else {
            await setDoc(doc(db, 'register', 'current'), { ...data, updatedAt: Date.now() });
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
          await setDoc(doc(db, 'terminals', data.id.toString()), { ...data, updatedAt: Date.now() });
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
          await updateDoc(doc(db, 'terminals', data.id.toString()), { ...data.updates, updatedAt: Date.now() });
          break;
        // ✅ NUEVO: Actualizar terminalId de un usuario (offline)
        case 'updateUserTerminalId':
          await updateDoc(doc(db, 'users', data.userId), { terminalId: data.terminalId, updatedAt: Date.now() });
          break;
      }
    } catch (error) {
      op.retries++;
      if (op.retries < 5) toRetry.push(op);
    }
  }
  pendingQueue = toRetry;
  if (typeof window !== 'undefined') localStorage.setItem('firebase_pending_queue', JSON.stringify(pendingQueue));
  isSyncing = false;
};

const addToQueue = (type: string, data: any) => {
  pendingQueue.push({ id: `${Date.now()}_${Math.random()}`, type, data, timestamp: Date.now(), retries: 0 });
  if (typeof window !== 'undefined') localStorage.setItem('firebase_pending_queue', JSON.stringify(pendingQueue));
  if (isOnline) processQueue();
};

// ✅ Redondeo a 2 decimales (comercial)
const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
// ✅ Redondeo a 4 decimales (para costos)
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

export const syncService = {
  // PRODUCTOS (sin cambios)
  async saveProduct(product: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveProducts', [product]);
    await setDoc(doc(db, 'products', product.id.toString()), { ...sanitizeForFirestore(product), updatedAt: Date.now() });
  },
  async saveProducts(products: any[]) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveProducts', products);
    const batch = writeBatch(db);
    products.forEach(p => batch.set(doc(db, 'products', p.id.toString()), { ...sanitizeForFirestore(p), updatedAt: Date.now() }));
    await batch.commit();
  },
  async deleteProduct(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'products', id.toString()));
  },
  subscribeToProducts(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'products'), limit(500)), (snap) => {
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  // CLIENTES (sin cambios)
  async saveClient(client: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveClient', client);
    await setDoc(doc(db, 'clients', client.id.toString()), { ...sanitizeForFirestore(client), updatedAt: Date.now() });
  },
  async deleteClient(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'clients', id.toString()));
  },
  subscribeToClients(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'clients'), (snap) => {
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  // TRANSACCIONES (sin cambios)
  async saveTransaction(tx: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveTransaction', tx);
    const cleaned = sanitizeForFirestore(tx);
    await setDoc(doc(db, 'transactions', cleaned.id.toString()), { ...cleaned, createdAt: Date.now() });
  },
  async deleteTransaction(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'transactions', id.toString()));
  },
  subscribeToTransactions(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(500)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // ✅ NUEVO: Obtener todas las transacciones
  async getAllTransactions(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'transactions'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  // ✅ NUEVO: Eliminar todas las transacciones (batch)
  async deleteAllTransactions() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'transactions'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  // CUENTAS POR COBRAR (sin cambios)
  async saveAccount(acc: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAccount', acc);
    await setDoc(doc(db, 'accounts', acc.id.toString()), { ...sanitizeForFirestore(acc), updatedAt: Date.now() });
  },
  subscribeToAccounts(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'accounts'), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // CONTABILIDAD (sin cambios)
  async saveAccountingEntry(entry: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAccountingEntry', entry);
    await setDoc(doc(db, 'accounting_entries', entry.id.toString()), { ...sanitizeForFirestore(entry), createdAt: Date.now() });
  },
  subscribeToAccounting(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'accounting_entries'), orderBy('date', 'desc'), limit(1000)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // ✅ NUEVO: Obtener todas las entradas contables
  async getAllAccountingEntries(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'accounting_entries'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  // ✅ NUEVO: Eliminar todas las entradas contables (batch)
  async deleteAllAccountingEntries() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'accounting_entries'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  // CAJA (métodos antiguos para compatibilidad global)
  async saveRegister(reg: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveRegister', reg);
    const cleaned = sanitizeForFirestore({
      isOpen: reg.isOpen === true,
      openTime: reg.openTime || new Date().toISOString(),
      openAmount: typeof reg.openAmount === 'number' ? reg.openAmount : 0,
      openAmountBs: typeof reg.openAmountBs === 'number' ? reg.openAmountBs : 0,
      openAmountUsd: typeof reg.openAmountUsd === 'number' ? reg.openAmountUsd : 0,
      exchangeRate: typeof reg.exchangeRate === 'number' ? reg.exchangeRate : 36.50,
      txs: reg.txs || [],
      updatedAt: Date.now()
    });
    await setDoc(doc(db, 'register', 'current'), cleaned);
  },
  async clearRegister() {
    if (!db) return;
    await deleteDoc(doc(db, 'register', 'current'));
  },
  subscribeToRegister(callback: (data: any) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'register', 'current'), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },

  // === NUEVOS MÉTODOS PARA CAJA POR TERMINAL ===
  async saveRegisterByTerminal(terminalId: string, reg: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveRegister', { terminalId, reg });
    const cleaned = sanitizeForFirestore({
      isOpen: reg.isOpen === true,
      openTime: reg.openTime || new Date().toISOString(),
      openAmount: typeof reg.openAmount === 'number' ? reg.openAmount : 0,
      openAmountBs: typeof reg.openAmountBs === 'number' ? reg.openAmountBs : 0,
      openAmountUsd: typeof reg.openAmountUsd === 'number' ? reg.openAmountUsd : 0,
      exchangeRate: typeof reg.exchangeRate === 'number' ? reg.exchangeRate : 36.50,
      txs: reg.txs || [],
      updatedAt: Date.now()
    });
    await setDoc(doc(db, 'registers', terminalId), cleaned);
  },
  async clearRegisterByTerminal(terminalId: string) {
    if (!db) return;
    await deleteDoc(doc(db, 'registers', terminalId));
  },
  subscribeToRegisterByTerminal(terminalId: string, callback: (data: any) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'registers', terminalId), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },

  // === NUEVA TRANSACCIÓN ATÓMICA PARA VENTA (CORREGIDA) ===
  async runAtomicSale(terminalId: string, txData: any, updates: {
    products: Map<number, { newStock: number }>;
    kardexEntries: any[];
    accountingEntry?: any;
    registerUpdate: { txs: any[] };
  }) {
    if (!db) throw new Error('Firebase no disponible');
    
    // ✅ Sanitizar todos los datos antes de la transacción
    const cleanTxData = sanitizeForFirestore(txData);
    const cleanKardexEntries = updates.kardexEntries.map(entry => sanitizeForFirestore(entry));
    const cleanAccountingEntry = updates.accountingEntry ? sanitizeForFirestore(updates.accountingEntry) : null;
    const cleanRegisterUpdate = {
      txs: updates.registerUpdate.txs.map(tx => sanitizeForFirestore(tx))
    };
    
    return runTransaction(db, async (transaction) => {
      // 1. Verificar stock de los productos
      for (const [prodId, update] of updates.products.entries()) {
        const prodRef = doc(db, 'products', prodId.toString());
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) throw new Error(`Producto ${prodId} no existe`);
        const currentStock = prodSnap.data().stock;
        const requiredStock = currentStock - update.newStock;
        if (requiredStock < 0) {
          throw new Error(`Stock insuficiente para producto ${prodId}`);
        }
      }
      
      // 2. Actualizar productos (stock)
      for (const [prodId, update] of updates.products.entries()) {
        const prodRef = doc(db, 'products', prodId.toString());
        transaction.update(prodRef, { stock: update.newStock, updatedAt: Date.now() });
      }
      
      // 3. Guardar transacción (con datos sanitizados)
      const txRef = doc(db, 'transactions', cleanTxData.id.toString());
      transaction.set(txRef, { ...cleanTxData, createdAt: Date.now() });
      
      // 4. Guardar entradas de kardex (con datos sanitizados)
      for (const entry of cleanKardexEntries) {
        const kardexRef = doc(db, 'kardex_entries', entry.id);
        transaction.set(kardexRef, { ...entry, createdAt: Date.now() });
      }
      
      // 5. Guardar asiento contable (si existe y está sanitizado)
      if (cleanAccountingEntry && cleanAccountingEntry.id) {
        const accRef = doc(db, 'accounting_entries', cleanAccountingEntry.id.toString());
        transaction.set(accRef, { ...cleanAccountingEntry, createdAt: Date.now() });
      }
      
      // 6. Actualizar caja de la terminal
      const registerRef = doc(db, 'registers', terminalId);
      transaction.update(registerRef, {
        txs: cleanRegisterUpdate.txs,
        updatedAt: Date.now()
      });
    });
  },

  // ✅ NUEVO MÉTODO: Actualizar producto con Costo Promedio Ponderado (CPP)
  async updateProductWithWeightedAverageCost(productId: number, newQty: number, newCostUsd: number, exchangeRate: number) {
    if (!db) throw new Error('Firebase no disponible');
    
    // Asegurar precisión de 4 decimales para costos
    const newCostUsdRounded = roundTo4(newCostUsd);
    const exchangeRateRounded = roundTo2(exchangeRate);
    
    return runTransaction(db, async (transaction) => {
      // 1. Leer el producto actual
      const prodRef = doc(db, 'products', productId.toString());
      const prodSnap = await transaction.get(prodRef);
      
      if (!prodSnap.exists()) {
        throw new Error(`Producto ${productId} no existe`);
      }
      
      const productData = prodSnap.data();
      const currentStock = productData.stock || 0;
      const currentCostUsd = productData.costUsd || 0;
      const profitPercent = productData.profitPercent || 30;
      
      // 2. Calcular nuevo costo promedio ponderado (CPP)
      let newAverageCost: number;
      
      if (currentStock <= 0) {
        // ✅ Caso especial: stock cero o negativo, el nuevo costo es directamente el costo de compra
        newAverageCost = newCostUsdRounded;
      } else {
        // ✅ Fórmula del promedio ponderado
        const totalCostBefore = currentStock * currentCostUsd;
        const totalCostNew = newQty * newCostUsdRounded;
        const newTotalStock = currentStock + newQty;
        const rawAverage = (totalCostBefore + totalCostNew) / newTotalStock;
        newAverageCost = roundTo4(rawAverage);
      }
      
      // 3. Recalcular precios de venta basados en el nuevo costo
      const priceUsdRaw = newAverageCost * (1 + profitPercent / 100);
      const priceUsd = roundTo2(priceUsdRaw);
      const priceBs = roundTo2(priceUsd * exchangeRateRounded);
      
      // 4. Calcular nuevo stock
      const newStock = currentStock + newQty;
      
      // 5. Crear entrada de Kardex
      const kardexEntry = {
        id: `${Date.now()}_${productId}_${Math.random()}`,
        productId: productId,
        date: new Date().toISOString(),
        type: 'entrada_compra',
        quantity: newQty,
        previousStock: currentStock,
        newStock: newStock,
        reference: `Compra - CPP aplicado`,
        note: `Costo anterior: $${currentCostUsd.toFixed(4)} → Nuevo costo: $${newAverageCost.toFixed(4)} (ponderado)`,
        costUsd: newCostUsdRounded,
        costBs: roundTo2(newCostUsdRounded * exchangeRateRounded),
      };
      
      // 6. Guardar todo en la transacción
      transaction.update(prodRef, {
        stock: newStock,
        costUsd: newAverageCost,
        costBs: roundTo2(newAverageCost * exchangeRateRounded),
        priceUsd: priceUsd,
        priceBs: priceBs,
        updatedAt: Date.now()
      });
      
      const kardexRef = doc(db, 'kardex_entries', kardexEntry.id);
      transaction.set(kardexRef, { ...kardexEntry, createdAt: Date.now() });
      
      return {
        newStock,
        newAverageCost,
        newPriceUsd: priceUsd,
        newPriceBs: priceBs
      };
    });
  },

  // PROVEEDORES, FACTURAS, ETC. (con nuevos métodos)
  async saveSupplier(supplier: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveSupplier', supplier);
    await setDoc(doc(db, 'suppliers', supplier.id.toString()), { ...sanitizeForFirestore(supplier), updatedAt: Date.now() });
  },
  async deleteSupplier(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'suppliers', id.toString()));
  },
  subscribeToSuppliers(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'suppliers'), (snap) => {
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  async savePurchaseInvoice(invoice: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('savePurchaseInvoice', invoice);
    await setDoc(doc(db, 'purchase_invoices', invoice.id.toString()), sanitizeForFirestore(invoice));
  },
  
  // ✅ NUEVO MÉTODO: Obtener todas las facturas de compra
  async getPurchaseInvoices(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'purchase_invoices'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },
  
  // ✅ NUEVO MÉTODO: Eliminar una factura de compra
  async deletePurchaseInvoice(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'purchase_invoices', id.toString()));
  },
  
  subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'purchase_invoices'), orderBy('date', 'desc'), limit(500)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  async savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
    if (!db) return;
    const batch = writeBatch(db);
    items.forEach(item => {
      batch.set(doc(db, 'purchase_items', item.id), sanitizeForFirestore(item));
    });
    await batch.commit();
  },
  subscribeToPurchaseItems(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'purchase_items'), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  async saveSupplierPayment(payment: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveSupplierPayment', payment);
    await setDoc(doc(db, 'supplier_payments', payment.id.toString()), { ...sanitizeForFirestore(payment), createdAt: Date.now() });
  },
  async deleteSupplierPayment(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'supplier_payments', id.toString()));
  },
  subscribeToSupplierPayments(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'supplier_payments'), orderBy('date', 'desc'), limit(500)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  async saveKardexEntry(entry: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveKardexEntry', entry);
    await setDoc(doc(db, 'kardex_entries', entry.id), { ...sanitizeForFirestore(entry), createdAt: Date.now() });
  },
  subscribeToKardex(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'kardex_entries'), orderBy('createdAt', 'desc'), limit(1000)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // ✅ NUEVO: Obtener todas las entradas de kardex
  async getAllKardexEntries(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'kardex_entries'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // ✅ NUEVO: Eliminar todas las entradas de kardex (batch)
  async deleteAllKardexEntries() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'kardex_entries'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  async saveTerminal(terminal: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveTerminal', terminal);
    await setDoc(doc(db, 'terminals', terminal.id.toString()), { ...sanitizeForFirestore(terminal), updatedAt: Date.now() });
  },
  async deleteTerminal(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'terminals', id.toString()));
  },
  subscribeToTerminals(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'terminals'), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // ✅ NUEVO: Suscripción en tiempo real a una terminal específica
  subscribeToTerminal(id: string | number, callback: (terminal: any) => void) {
    if (!db || !id || typeof id === 'boolean') return () => {};
    return onSnapshot(doc(db, 'terminals', id.toString()), (snap) => {
      callback(snap.exists() ? { id: parseInt(snap.id), ...snap.data() } : null);
    });
  },

  async saveGlobalSettings(settings: any) {
    if (!db) return;
    const docRef = doc(db, 'global_settings', 'global');
    const existing = await getDoc(docRef);
    const merged = sanitizeForFirestore({ ...(existing.exists() ? existing.data() : {}), ...settings, updatedAt: Date.now() });
    await setDoc(docRef, merged);
  },
  async getGlobalSettings() {
    if (!db) return null;
    const snap = await getDoc(doc(db, 'global_settings', 'global'));
    return snap.exists() ? snap.data() : null;
  },
  subscribeToGlobalSettings(callback: (data: any) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'global_settings', 'global'), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },
  
  // ✅ CORREGIDO: El PIN se lee desde global_settings (no desde admin_codes)
  async getAdminCode() {
    if (!db) return null;
    const snap = await getDoc(doc(db, 'global_settings', 'global'));
    if (snap.exists()) {
      const data = snap.data();
      if (data.adminCode) {
        return { code: data.adminCode };
      }
    }
    return null;
  },

  // ✅ NUEVO: Métodos para la colección cash_closes (historial de cierres)
  async saveCashClose(closeData: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveCashClose', closeData);
    const cleaned = sanitizeForFirestore(closeData);
    await setDoc(doc(db, 'cash_closes', cleaned.id), { ...cleaned, createdAt: Date.now() });
  },

  async getAllCashCloses(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'cash_closes'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  subscribeToCashCloses(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'cash_closes'), orderBy('fecha', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  },

  async deleteAllCashCloses() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'cash_closes'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  // ========== 🆕 MÉTODOS PARA TERMINALES (BLOQUEO Y CONSULTA) ==========
  
  /**
   * Obtiene un terminal por su ID
   * @param id ID numérico del terminal
   * @returns Datos del terminal o null
   */
  async getTerminal(id: number | string): Promise<any | null> {
    if (!db || !id || typeof id === 'boolean') return null;
    const snap = await getDoc(doc(db, 'terminals', id.toString()));
    return snap.exists() ? { id: parseInt(snap.id), ...snap.data() } : null;
  },

  /**
   * Obtiene todos los terminales
   * @returns Array con todos los terminales
   */
  async getAllTerminals(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'terminals'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  /**
   * Actualiza el estado de bloqueo de un terminal
   * @param terminalId ID del terminal
   * @param isBlocked true para bloquear, false para desbloquear
   */
  async updateTerminalBlockStatus(terminalId: number, isBlocked: boolean): Promise<void> {
    if (!db) return;
    const ref = doc(db, 'terminals', terminalId.toString());
    if (!isOnline) {
      addToQueue('updateTerminal', { id: terminalId, updates: { isBlocked } });
      return;
    }
    await updateDoc(ref, { isBlocked, updatedAt: Date.now() });
  },

  /**
   * Actualiza cualquier campo de un terminal (genérico)
   * @param terminalId ID del terminal
   * @param updates Objeto con los campos a actualizar
   */
  async updateTerminal(terminalId: number, updates: Record<string, any>): Promise<void> {
    if (!db) return;
    const ref = doc(db, 'terminals', terminalId.toString());
    if (!isOnline) {
      addToQueue('updateTerminal', { id: terminalId, updates });
      return;
    }
    await updateDoc(ref, { ...updates, updatedAt: Date.now() });
  },

  // ========== 🆕 MÉTODO PARA ACTUALIZAR terminalId DEL USUARIO ==========
  /**
   * Actualiza el campo terminalId de un usuario en Firestore.
   * Útil para asignar o desasignar una terminal a un cajero.
   * @param userId ID del usuario (documento en Firestore)
   * @param terminalId ID de la terminal (string) o null para desasignar
   */
  async updateUserTerminalId(userId: string, terminalId: string | null): Promise<void> {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    const data = { terminalId: terminalId || null, updatedAt: Date.now() };
    if (!isOnline) {
      addToQueue('updateUserTerminalId', { userId, terminalId: terminalId || null });
      return;
    }
    await updateDoc(userRef, data);
  },

  // ========== 🆕 MÉTODOS PARA SESIONES DE CAJA (Aislamiento de Terminales) ==========
  
  /**
   * Crea una nueva sesión de caja para un terminal
   * @param terminalId ID del terminal físico
   * @param userId ID del usuario que abre la caja
   * @param initialAmountUsd Monto inicial en USD
   * @returns Objeto con id de sesión y datos
   */
  async createCashSession(terminalId: string, userId: string, initialAmountUsd: number): Promise<any> {
    if (!db) throw new Error('Firebase no disponible');
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
    const cleaned = sanitizeForFirestore(sessionData);
    if (!isOnline) {
      addToQueue('saveCashSession', cleaned);
      return sessionData;
    }
    await setDoc(doc(db, 'cash_sessions', sessionId), cleaned);
    return sessionData;
  },

  /**
   * Obtiene la sesión activa (abierta) para un terminal específico
   * @param terminalId ID del terminal
   * @returns Sesión activa o null si no hay ninguna abierta
   */
  async getActiveSessionByTerminal(terminalId: string): Promise<any | null> {
    if (!db) return null;
    const q = query(collection(db, 'cash_sessions'), 
      where('terminalId', '==', terminalId), 
      where('status', '==', 'abierta'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  },

  /**
   * Escucha en tiempo real la sesión activa de un terminal
   * @param terminalId ID del terminal
   * @param callback Función que recibe la sesión (null si no hay)
   * @returns Función de unsubscribe
   */
  subscribeToActiveSession(terminalId: string, callback: (session: any | null) => void): () => void {
    if (!db) return () => {};
    const q = query(collection(db, 'cash_sessions'), 
      where('terminalId', '==', terminalId), 
      where('status', '==', 'abierta'),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        const doc = snap.docs[0];
        callback({ id: doc.id, ...doc.data() });
      }
    });
  },

  /**
   * Cierra una sesión de caja
   * @param sessionId ID de la sesión
   * @param finalAmountUsd Monto final real en USD (arqueo)
   * @returns Datos de la sesión actualizada
   */
  async closeCashSession(sessionId: string, finalAmountUsd: number): Promise<any> {
    if (!db) throw new Error('Firebase no disponible');
    const sessionRef = doc(db, 'cash_sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new Error('Sesión no encontrada');
    
    const updated = {
      ...sessionSnap.data(),
      status: 'cerrada',
      closeTime: new Date().toISOString(),
      finalAmountUsd: roundTo2(finalAmountUsd),
      updatedAt: Date.now()
    };
    const cleaned = sanitizeForFirestore(updated);
    if (!isOnline) {
      addToQueue('updateCashSession', cleaned);
      return updated;
    }
    await setDoc(sessionRef, cleaned);
    return updated;
  },

  /**
   * Obtiene todas las transacciones asociadas a una sesión específica (con filtros opcionales)
   * @param sessionId ID de la sesión
   * @param limitCount Límite de resultados (default 500)
   * @returns Array de transacciones
   */
  async getTransactionsBySession(sessionId: string, limitCount: number = 500): Promise<any[]> {
    if (!db) return [];
    const q = query(collection(db, 'transactions'), 
      where('sessionId', '==', sessionId),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  /**
   * Escucha en tiempo real las transacciones de una sesión específica
   * @param sessionId ID de la sesión
   * @param callback Función que recibe el array de transacciones
   * @returns Función de unsubscribe
   */
  subscribeToTransactionsBySession(sessionId: string, callback: (transactions: any[]) => void): () => void {
    if (!db) return () => {};
    const q = query(collection(db, 'transactions'), 
      where('sessionId', '==', sessionId),
      orderBy('date', 'desc'),
      limit(500)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() })));
    });
  },

  /**
   * Guarda una transacción asociándola automáticamente a la sesión activa del terminal
   * Si no hay sesión activa, la transacción se guarda sin sesión (comportamiento antiguo)
   * @param tx Datos de la transacción (debe contener al menos id)
   * @param terminalId ID del terminal (opcional, se intenta obtener sesión activa)
   * @returns void
   */
  async saveTransactionWithCurrentSession(tx: any, terminalId?: string): Promise<void> {
    if (!db) return;
    let sessionId = tx.sessionId;
    if (!sessionId && terminalId) {
      const active = await this.getActiveSessionByTerminal(terminalId);
      if (active) sessionId = active.id;
    }
    const txWithSession = { ...tx, sessionId: sessionId || null };
    await this.saveTransaction(txWithSession);
  },

  getPendingQueueLength() {
    return pendingQueue.length;
  }
};
