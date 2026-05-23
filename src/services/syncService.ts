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

const cleanObject = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(item => cleanObject(item)).filter(item => item !== null);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      const value = cleanObject(obj[key]);
      if (value !== undefined && value !== null) cleaned[key] = value;
    }
    return cleaned;
  }
  return obj;
};

const processQueue = async () => {
  if (!isOnline || isSyncing || pendingQueue.length === 0 || !db) return;
  isSyncing = true;
  const toRetry: PendingOperation[] = [];
  
  for (const op of pendingQueue) {
    try {
      const data = cleanObject(op.data);
      if (op.type === 'saveProducts') {
        const batch = writeBatch(db);
        data.forEach((p: any) => batch.set(doc(db, 'products', p.id.toString()), { ...p, updatedAt: Date.now() }));
        await batch.commit();
      } else if (op.type === 'saveTransaction') {
        await setDoc(doc(db, 'transactions', data.id.toString()), { ...data, createdAt: Date.now() });
      } else if (op.type === 'saveAccountingEntry') {
        await setDoc(doc(db, 'accounting_entries', data.id.toString()), { ...data, createdAt: Date.now() });
      } else if (op.type === 'saveSupplier') {
        await setDoc(doc(db, 'suppliers', data.id.toString()), { ...data, updatedAt: Date.now() });
      } else if (op.type === 'savePurchaseInvoice') {
        await setDoc(doc(db, 'purchase_invoices', data.id.toString()), { ...data });
      } else if (op.type === 'savePurchaseInvoiceItems') {
        const batch = writeBatch(db);
        data.items.forEach((item: any) => {
          const itemDoc = doc(db, 'purchase_items', item.id);
          batch.set(itemDoc, { ...item, createdAt: Date.now() });
        });
        await batch.commit();
      } else if (op.type === 'saveSupplierPayment') {
        await setDoc(doc(db, 'supplier_payments', data.id.toString()), { ...data, createdAt: Date.now() });
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
      }
    } catch (error) {
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
  // Productos
  async saveProduct(product: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveProducts', [product]);
    await setDoc(doc(db, 'products', product.id.toString()), { ...cleanObject(product), updatedAt: Date.now() });
  },
  async saveProducts(products: any[]) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveProducts', products);
    const batch = writeBatch(db);
    products.forEach(p => batch.set(doc(db, 'products', p.id.toString()), { ...cleanObject(p), updatedAt: Date.now() }));
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

  // Clientes
  async saveClient(client: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveClient', client);
    await setDoc(doc(db, 'clients', client.id.toString()), { ...cleanObject(client), updatedAt: Date.now() });
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

  // Transacciones
  async saveTransaction(tx: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveTransaction', tx);
    await setDoc(doc(db, 'transactions', tx.id.toString()), { ...cleanObject(tx), createdAt: Date.now() });
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

  // Cuentas por Cobrar
  async saveAccount(acc: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAccount', acc);
    await setDoc(doc(db, 'accounts', acc.id.toString()), { ...cleanObject(acc), updatedAt: Date.now() });
  },
  subscribeToAccounts(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'accounts'), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // Contabilidad
  async saveAccountingEntry(entry: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAccountingEntry', entry);
    await setDoc(doc(db, 'accounting_entries', entry.id.toString()), { ...cleanObject(entry), createdAt: Date.now() });
  },
  subscribeToAccounting(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'accounting_entries'), orderBy('date', 'desc'), limit(1000)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // Proveedores
  async saveSupplier(s: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveSupplier', s);
    await setDoc(doc(db, 'suppliers', s.id.toString()), { ...cleanObject(s), updatedAt: Date.now() });
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

  // Facturas de Compras (Collection: purchase_invoices)
  async savePurchaseInvoice(invoice: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('savePurchaseInvoice', invoice);
    await setDoc(doc(db, 'purchase_invoices', invoice.id.toString()), cleanObject(invoice));
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

  // Items de Facturas de Compras (Collection: purchase_items)
  async savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
    if (!db) return;
    if (!isOnline) return addToQueue('savePurchaseInvoiceItems', { invoiceId, items });
    const batch = writeBatch(db);
    items.forEach((item) => {
      const itemDoc = doc(db, 'purchase_items', item.id);
      batch.set(itemDoc, { ...cleanObject(item), createdAt: Date.now() });
    });
    await batch.commit();
  },
  subscribeToPurchaseItems(callback: (items: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'purchase_items'), (snap) => {
      callback(snap.docs.map((doc) => doc.data()));
    });
  },

  // Pagos a Proveedores
  async saveSupplierPayment(p: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveSupplierPayment', p);
    await setDoc(doc(db, 'supplier_payments', p.id.toString()), { ...cleanObject(p), createdAt: Date.now() });
  },
  subscribeToSupplierPayments(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'supplier_payments'), (snap) => {
      callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() })));
    });
  },

  // Terminales
  async saveTerminal(terminal: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveTerminal', terminal);
    await setDoc(doc(db, 'terminals', terminal.id.toString()), { ...cleanObject(terminal), updatedAt: Date.now() });
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

  // Cierres de Caja
  async saveCashClosing(closing: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveCashClosing', closing);
    await setDoc(doc(db, 'cash_closings', closing.id.toString()), { ...cleanObject(closing), createdAt: Date.now() });
  },
  subscribeToCashClosings(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'cash_closings'), orderBy('fecha', 'desc'), limit(100)), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  // Caja (Firestore)
  async saveRegister(reg: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveRegister', reg);
    
    const currentDoc = await getDoc(doc(db, 'register', 'current'));
    const currentTxs = currentDoc.exists() ? currentDoc.data().txs || [] : [];
    const newTxs = reg.txs || [];
    const allTxs = [...currentTxs, ...newTxs];
    
    const uniqueTxs = allTxs.filter((tx: any, index: number, self: any[]) => 
      index === self.findIndex((t: any) => t.id === tx.id)
    );
    
    const cleaned = cleanObject(reg);
    delete cleaned.txs;
    
    await setDoc(doc(db, 'register', 'current'), { 
      ...cleaned, 
      txs: uniqueTxs,
      updatedAt: Date.now() 
    });
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

  getPendingQueueLength: () => pendingQueue.length
};