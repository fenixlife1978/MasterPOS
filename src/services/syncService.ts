"use client";

import { db } from '@/lib/firebase';
import { 
  doc, setDoc, deleteDoc, 
  collection, query, onSnapshot, limit,
  orderBy, writeBatch, getDoc, getDocs, where
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
}

const saveQueue = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('firebase_pending_queue', JSON.stringify(pendingQueue));
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { isOnline = true; processQueue(); });
  window.addEventListener('offline', () => { isOnline = false; });
}

// ✅ FUNCIÓN RECURSIVA PARA ELIMINAR undefined/null/empty strings de forma profunda
const deepClean = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(v => deepClean(v)).filter(v => v !== null);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const val = deepClean(obj[key]);
      if (val !== null && val !== undefined) {
        cleaned[key] = val;
      }
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return obj === undefined ? null : obj;
};

// Función específica para asegurar que el objeto no tenga NINGÚN undefined antes de ir a Firestore
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
      if (op.type === 'saveProducts') {
        const batch = writeBatch(db);
        (data as any[]).forEach((p: any) => batch.set(doc(db, 'products', p.id.toString()), { ...p, updatedAt: Date.now() }));
        await batch.commit();
      } else if (op.type === 'saveTransaction') {
        await setDoc(doc(db, 'transactions', data.id.toString()), { ...data, createdAt: Date.now() });
      } else if (op.type === 'saveAccountingEntry') {
        await setDoc(doc(db, 'accounting_entries', data.id.toString()), { ...data, createdAt: Date.now() });
      } else if (op.type === 'saveSupplier') {
        await setDoc(doc(db, 'suppliers', data.id.toString()), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'savePurchaseInvoice') {
        await setDoc(doc(db, 'purchase_invoices', data.id.toString()), sanitizeForFirestore(data));
      } else if (op.type === 'savePurchaseInvoiceItems') {
        const batch = writeBatch(db);
        data.items.forEach((item: any) => {
          const itemDoc = doc(db, 'purchase_items', item.id);
          batch.set(itemDoc, { ...sanitizeForFirestore(item), createdAt: Date.now() });
        });
        await batch.commit();
      } else if (op.type === 'saveSupplierPayment') {
        await setDoc(doc(db, 'supplier_payments', data.id.toString()), { ...data, createdAt: Date.now() });
      } else if (op.type === 'deleteSupplierPayment') {
        await deleteDoc(doc(db, 'supplier_payments', data.id.toString()));
      } else if (op.type === 'saveTerminal') {
        await setDoc(doc(db, 'terminals', data.id.toString()), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'saveCashClosing') {
        await setDoc(doc(db, 'cash_closings', data.id.toString()), { ...data, createdAt: Date.now() });
      } else if (op.type === 'saveRegister') {
        await setDoc(doc(db, 'register', 'current'), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'saveClient') {
        await setDoc(doc(db, 'clients', data.id.toString()), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'saveAccount') {
        await setDoc(doc(db, 'accounts', data.id.toString()), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'saveGlobalSettings') {
        await setDoc(doc(db, 'global_settings', 'global'), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'saveAdminCode') {
        await setDoc(doc(db, 'admin_codes', 'adjustment_code'), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'saveKardexEntry') {
        await setDoc(doc(db, 'kardex_entries', data.id), { ...data, createdAt: Date.now() });
      }
    } catch (error) {
      console.error('Error processing operation:', error);
      op.retries++;
      if (op.retries < 5) toRetry.push(op);
    }
  }
  pendingQueue = toRetry;
  saveQueue();
  isSyncing = false;
};

const addToQueue = (type: string, data: any) => {
  pendingQueue.push({ id: `${Date.now()}_${Math.random()}`, type, data, timestamp: Date.now(), retries: 0 });
  saveQueue();
  if (isOnline) processQueue();
};

export const syncService = {
  // ========== PRODUCTOS ==========
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

  // ========== CLIENTES ==========
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

  // ========== TRANSACCIONES ==========
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

  // ========== CUENTAS POR COBRAR ==========
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

  // ========== CONTABILIDAD ==========
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

  // ========== PROVEEDORES ==========
  async saveSupplier(s: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveSupplier', s);
    await setDoc(doc(db, 'suppliers', s.id.toString()), { ...sanitizeForFirestore(s), updatedAt: Date.now() });
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

  // ========== FACTURAS DE COMPRAS ==========
  async savePurchaseInvoice(invoice: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('savePurchaseInvoice', invoice);
    await setDoc(doc(db, 'purchase_invoices', invoice.id.toString()), sanitizeForFirestore(invoice));
  },
  async deletePurchaseInvoice(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'purchase_invoices', id.toString()));
  },
  subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'purchase_invoices'), orderBy('date', 'desc')), (snap) => {
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  // ========== ITEMS DE FACTURAS DE COMPRAS ==========
  async savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
    if (!db) return;
    if (!isOnline) return addToQueue('savePurchaseInvoiceItems', { invoiceId, items });
    const batch = writeBatch(db);
    items.forEach((item) => {
      const itemDoc = doc(db, 'purchase_items', item.id);
      batch.set(itemDoc, { ...sanitizeForFirestore(item), createdAt: Date.now() });
    });
    await batch.commit();
  },
  subscribeToPurchaseItems(callback: (items: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'purchase_items'), (snap) => {
      callback(snap.docs.map((doc) => doc.data()));
    });
  },

  // ========== PAGOS A PROVEEDORES ==========
  async saveSupplierPayment(p: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveSupplierPayment', p);
    await setDoc(doc(db, 'supplier_payments', p.id.toString()), { ...sanitizeForFirestore(p), createdAt: Date.now() });
  },
  async deleteSupplierPayment(id: number) {
    if (!db) return;
    if (!isOnline) return addToQueue('deleteSupplierPayment', { id });
    await deleteDoc(doc(db, 'supplier_payments', id.toString()));
  },
  subscribeToSupplierPayments(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'supplier_payments'), (snap) => {
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  // ========== TERMINALES ==========
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
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  // ========== CIERRES DE CAJA ==========
  async saveCashClosing(closing: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveCashClosing', closing);
    await setDoc(doc(db, 'cash_closings', closing.id.toString()), { ...sanitizeForFirestore(closing), createdAt: Date.now() });
  },
  subscribeToCashClosings(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'cash_closings'), orderBy('fecha', 'desc'), limit(100)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // ========== CAJA REGISTRADORA (FIRESTORE) ==========
  async saveRegister(reg: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveRegister', reg);
    
    try {
      const currentDoc = await getDoc(doc(db, 'register', 'current'));
      const currentTxs = currentDoc.exists() ? currentDoc.data().txs || [] : [];
      const newTxs = reg.txs || [];
      
      // Combinar y limpiar transacciones
      const combinedTxs = [...currentTxs, ...newTxs];
      const uniqueTxs = combinedTxs.reduce((acc: any[], current: any) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
          const cleaned = sanitizeForFirestore(current);
          if (cleaned) acc.push(cleaned);
        }
        return acc;
      }, []);

      const finalData = sanitizeForFirestore({
        isOpen: reg.isOpen === true,
        openTime: reg.openTime || new Date().toISOString(),
        openAmount: typeof reg.openAmount === 'number' ? reg.openAmount : 0,
        openAmountBs: typeof reg.openAmountBs === 'number' ? reg.openAmountBs : 0,
        openAmountUsd: typeof reg.openAmountUsd === 'number' ? reg.openAmountUsd : 0,
        exchangeRate: typeof reg.exchangeRate === 'number' ? reg.exchangeRate : 36.50,
        txs: uniqueTxs,
        updatedAt: Date.now()
      });
      
      await setDoc(doc(db, 'register', 'current'), finalData);
    } catch (error) {
      console.error('Error saving register:', error);
      throw error;
    }
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

  // ========== CONFIGURACIÓN GLOBAL ==========
  async saveGlobalSettings(settings: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveGlobalSettings', settings);
    const existing = await this.getGlobalSettings();
    const merged = sanitizeForFirestore({ ...existing, ...settings, updatedAt: Date.now() });
    await setDoc(doc(db, 'global_settings', 'global'), merged);
  },
  async getGlobalSettings() {
    if (!db) return null;
    const docSnap = await getDoc(doc(db, 'global_settings', 'global'));
    return docSnap.exists() ? docSnap.data() : null;
  },
  subscribeToGlobalSettings(callback: (settings: any) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'global_settings', 'global'), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },

  // ========== CÓDIGO DE ADMINISTRADOR ==========
  async saveAdminCode(codeData: { code: string }) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAdminCode', codeData);
    await setDoc(doc(db, 'admin_codes', 'adjustment_code'), { ...sanitizeForFirestore(codeData), updatedAt: Date.now() });
  },
  async getAdminCode() {
    if (!db) return null;
    const docSnap = await getDoc(doc(db, 'admin_codes', 'adjustment_code'));
    return docSnap.exists() ? docSnap.data() : null;
  },
  subscribeToAdminCode(callback: (code: any) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'admin_codes', 'adjustment_code'), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },

  // ========== KARDEX ==========
  async saveKardexEntry(entry: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveKardexEntry', entry);
    await setDoc(doc(db, 'kardex_entries', entry.id), { ...sanitizeForFirestore(entry), createdAt: Date.now() });
  },
  subscribeToKardex(callback: (entries: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'kardex_entries'), orderBy('date', 'desc')), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  // ========== UTILIDAD ==========
  getPendingQueueLength: () => pendingQueue.length
};
