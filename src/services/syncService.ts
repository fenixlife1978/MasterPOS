"use client";

import { db } from '@/lib/firebase';
import { 
  doc, setDoc, deleteDoc, 
  collection, query, onSnapshot, limit,
  orderBy, writeBatch, getDoc, runTransaction
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
      if (val !== null) cleaned[key] = val;
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return obj;
};

const sanitizeForFirestore = (obj: any) => {
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
          // Para compatibilidad con caja global
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
    await setDoc(doc(db, 'transactions', tx.id.toString()), { ...sanitizeForFirestore(tx), createdAt: Date.now() });
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

  // === NUEVA TRANSACCIÓN ATÓMICA PARA VENTA ===
  async runAtomicSale(terminalId: string, txData: any, updates: {
    products: Map<number, { newStock: number }>;
    kardexEntries: any[];
    accountingEntry?: any;
    registerUpdate: { txs: any[] };
  }) {
    if (!db) throw new Error('Firebase no disponible');
    
    return runTransaction(db, async (transaction) => {
      // 1. Verificar stock de los productos
      for (const [prodId, update] of updates.products.entries()) {
        const prodRef = doc(db, 'products', prodId.toString());
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) throw new Error(`Producto ${prodId} no existe`);
        const currentStock = prodSnap.data().stock;
        if (currentStock < (currentStock - update.newStock)) {
          throw new Error(`Stock insuficiente para producto ${prodId}`);
        }
      }
      
      // 2. Actualizar productos (stock)
      for (const [prodId, update] of updates.products.entries()) {
        const prodRef = doc(db, 'products', prodId.toString());
        transaction.update(prodRef, { stock: update.newStock, updatedAt: Date.now() });
      }
      
      // 3. Guardar transacción
      const txRef = doc(db, 'transactions', txData.id.toString());
      transaction.set(txRef, { ...txData, createdAt: Date.now() });
      
      // 4. Guardar entradas de kardex
      for (const entry of updates.kardexEntries) {
        const kardexRef = doc(db, 'kardex_entries', entry.id);
        transaction.set(kardexRef, { ...entry, createdAt: Date.now() });
      }
      
      // 5. Guardar asiento contable (si existe)
      if (updates.accountingEntry) {
        const accRef = doc(db, 'accounting_entries', updates.accountingEntry.id.toString());
        transaction.set(accRef, { ...updates.accountingEntry, createdAt: Date.now() });
      }
      
      // 6. Actualizar caja de la terminal (solo agregar transacción)
      const registerRef = doc(db, 'registers', terminalId);
      transaction.update(registerRef, {
        txs: updates.registerUpdate.txs,
        updatedAt: Date.now()
      });
    });
  },

  // PROVEEDORES, FACTURAS, ETC. (sin cambios)
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
  async getAdminCode() {
    if (!db) return null;
    const snap = await getDoc(doc(db, 'admin_codes', 'adjustment_code'));
    return snap.exists() ? snap.data() : null;
  },

  getPendingQueueLength() {
    return pendingQueue.length;
  }
};