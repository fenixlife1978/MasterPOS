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
          await updateDoc(doc(db, 'terminals', data.id), { ...data.updates, updatedAt: Date.now() });
          break;
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

const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

export const syncService = {
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
    return onSnapshot(query(collection(db, 'products'), limit(500)), 
      (snap) => callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }))),
      (err) => console.warn("Suscripción restringida: products", err.message)
    );
  },

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
    return onSnapshot(collection(db, 'clients'), 
      (snap) => callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }))),
      (err) => console.warn("Suscripción restringida: clients", err.message)
    );
  },

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
    return onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(500)), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: transactions", err.message)
    );
  },

  async getAllTransactions(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'transactions'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  async deleteAllTransactions() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'transactions'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  async saveAccount(acc: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAccount', acc);
    await setDoc(doc(db, 'accounts', acc.id.toString()), { ...sanitizeForFirestore(acc), updatedAt: Date.now() });
  },
  subscribeToAccounts(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'accounts'), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: accounts", err.message)
    );
  },

  async saveAccountingEntry(entry: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveAccountingEntry', entry);
    await setDoc(doc(db, 'accounting_entries', entry.id.toString()), { ...sanitizeForFirestore(entry), createdAt: Date.now() });
  },
  subscribeToAccounting(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'accounting_entries'), orderBy('date', 'desc'), limit(1000)), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: accounting", err.message)
    );
  },

  async getAllAccountingEntries(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'accounting_entries'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  async deleteAllAccountingEntries() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'accounting_entries'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

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
    await setDoc(doc(db, 'register', 'current'), cleaned, { merge: true });
  },
  async clearRegister() {
    if (!db) return;
    await deleteDoc(doc(db, 'register', 'current'));
  },
  subscribeToRegister(callback: (data: any) => void) {
    if (!db) return () => {};
    return onSnapshot(doc(db, 'register', 'current'), 
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("Suscripción restringida: register", err.message)
    );
  },

  async saveRegisterByTerminal(terminalId: string, reg: any) {
    if (!db || !terminalId) return;
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
    await setDoc(doc(db, 'registers', terminalId), cleaned, { merge: true });
  },
  async clearRegisterByTerminal(terminalId: string) {
    if (!db || !terminalId) return;
    await deleteDoc(doc(db, 'registers', terminalId));
  },
  subscribeToRegisterByTerminal(terminalId: string, callback: (data: any) => void) {
    if (!db || !terminalId) return () => {};
    return onSnapshot(doc(db, 'registers', terminalId), 
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn(`Suscripción restringida: registers/${terminalId}`, err.message)
    );
  },

  async runAtomicSale(terminalId: string, txData: any, updates: {
    products: Map<number, { newStock: number }>;
    kardexEntries: any[];
    accountingEntry?: any;
    registerUpdate: { txs: any[] };
  }) {
    if (!db) throw new Error('Firebase no disponible');
    if (!terminalId) throw new Error('ID de Terminal no proporcionado');
    
    const cleanTxData = sanitizeForFirestore(txData);
    const cleanKardexEntries = updates.kardexEntries.map(entry => sanitizeForFirestore(entry));
    const cleanAccountingEntry = updates.accountingEntry ? sanitizeForFirestore(updates.accountingEntry) : null;
    const cleanRegisterUpdate = {
      txs: updates.registerUpdate.txs.map(tx => sanitizeForFirestore(tx))
    };
    
    return runTransaction(db, async (transaction) => {
      for (const [prodId, update] of updates.products.entries()) {
        const prodRef = doc(db, 'products', prodId.toString());
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) throw new Error(`Producto ${prodId} no existe`);
        const currentData = prodSnap.data();
        const currentStock = currentData.stock;
        const requiredStock = currentStock - update.newStock;
        if (requiredStock < 0 && !currentData.isKit) {
          throw new Error(`Stock insuficiente para producto ${prodId}`);
        }
      }
      
      for (const [prodId, update] of updates.products.entries()) {
        const prodRef = doc(db, 'products', prodId.toString());
        transaction.update(prodRef, { stock: update.newStock, updatedAt: Date.now() });
      }
      
      const txRef = doc(db, 'transactions', cleanTxData.id.toString());
      transaction.set(txRef, { ...cleanTxData, createdAt: Date.now() });
      
      for (const entry of cleanKardexEntries) {
        const kardexRef = doc(db, 'kardex_entries', entry.id);
        transaction.set(kardexRef, { ...entry, createdAt: Date.now() });
      }
      
      if (cleanAccountingEntry && cleanAccountingEntry.id) {
        const accRef = doc(db, 'accounting_entries', cleanAccountingEntry.id.toString());
        transaction.set(accRef, { ...cleanAccountingEntry, createdAt: Date.now() });
      }
      
      const registerRef = doc(db, 'registers', terminalId);
      transaction.set(registerRef, {
        txs: cleanRegisterUpdate.txs,
        updatedAt: Date.now()
      }, { merge: true });
    });
  },

  async updateProductWithWeightedAverageCost(productId: number, newQty: number, newCostUsd: number, exchangeRate: number) {
    if (!db) throw new Error('Firebase no disponible');
    
    const newCostUsdRounded = roundTo4(newCostUsd);
    const exchangeRateRounded = roundTo2(exchangeRate);
    
    return runTransaction(db, async (transaction) => {
      const prodRef = doc(db, 'products', productId.toString());
      const prodSnap = await transaction.get(prodRef);
      
      if (!prodSnap.exists()) throw new Error(`Producto ${productId} no existe`);
      
      const productData = prodSnap.data();
      const currentStock = productData.stock || 0;
      const currentCostUsd = productData.costUsd || 0;
      const profitPercent = productData.profitPercent || 30;
      
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
      
      const kardexEntry = {
        id: `${Date.now()}_${productId}_${Math.random()}`,
        productId: productId,
        date: new Date().toISOString(),
        type: 'entrada_compra',
        quantity: newQty,
        previousStock: currentStock,
        newStock: newStock,
        reference: `Compra - CPP aplicado`,
        note: `Costo ant: $${currentCostUsd.toFixed(4)} → Nuevo: $${newAverageCost.toFixed(4)}`,
        costUsd: newCostUsdRounded,
        costBs: roundTo2(newCostUsdRounded * exchangeRateRounded),
      };
      
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
      
      return { newStock, newAverageCost, newPriceUsd: priceUsd, newPriceBs: priceBs };
    });
  },

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
    return onSnapshot(collection(db, 'suppliers'), 
      (snap) => callback(snap.docs.map(d => ({ id: parseInt(d.id), ...d.data() }))),
      (err) => console.warn("Suscripción restringida: suppliers", err.message)
    );
  },

  async savePurchaseInvoice(invoice: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('savePurchaseInvoice', invoice);
    await setDoc(doc(db, 'purchase_invoices', invoice.id.toString()), sanitizeForFirestore(invoice));
  },
  
  async getPurchaseInvoices(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'purchase_invoices'));
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },
  
  async deletePurchaseInvoice(id: number) {
    if (!db) return;
    await deleteDoc(doc(db, 'purchase_invoices', id.toString()));
  },
  
  subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'purchase_invoices'), orderBy('date', 'desc'), limit(500)), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: purchase_invoices", err.message)
    );
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
    return onSnapshot(collection(db, 'purchase_items'), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: purchase_items", err.message)
    );
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
    return onSnapshot(query(collection(db, 'supplier_payments'), orderBy('date', 'desc'), limit(500)), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: supplier_payments", err.message)
    );
  },

  async saveKardexEntry(entry: any) {
    if (!db) return;
    if (!isOnline) return addToQueue('saveKardexEntry', entry);
    await setDoc(doc(db, 'kardex_entries', entry.id), { ...sanitizeForFirestore(entry), createdAt: Date.now() });
  },
  subscribeToKardex(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(query(collection(db, 'kardex_entries'), orderBy('createdAt', 'desc'), limit(1000)), 
      (snap) => callback(snap.docs.map(d => d.data())),
      (err) => console.warn("Suscripción restringida: kardex", err.message)
    );
  },

  async getAllKardexEntries(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'kardex_entries'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

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
    await setDoc(doc(db, 'terminals', terminal.name), { ...sanitizeForFirestore(terminal), updatedAt: Date.now() });
  },
  async deleteTerminal(id: string) {
    if (!db) return;
    await deleteDoc(doc(db, 'terminals', id));
  },
  subscribeToTerminals(callback: (data: any[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, 'terminals'), 
      (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("Suscripción restringida: terminals", err.message)
    );
  },
  subscribeToTerminal(id: string, callback: (terminal: any) => void) {
    if (!db || !id) return () => {};
    return onSnapshot(doc(db, 'terminals', id), 
      (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (err) => console.warn(`Suscripción restringida: terminals/${id}`, err.message)
    );
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
    return onSnapshot(doc(db, 'global_settings', 'global'), 
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.warn("Suscripción restringida: global_settings", err.message)
    );
  },
  
  async getAdminCode() {
    if (!db) return null;
    const snap = await getDoc(doc(db, 'global_settings', 'global'));
    if (snap.exists()) {
      const data = snap.data();
      if (data.adminCode) return { code: data.adminCode };
    }
    return null;
  },

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
    return onSnapshot(query(collection(db, 'cash_closes'), orderBy('fecha', 'desc')), 
      (snap) => callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (err) => console.warn("Suscripción restringida: cash_closes", err.message)
    );
  },

  async deleteAllCashCloses() {
    if (!db) return;
    const snap = await getDocs(collection(db, 'cash_closes'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  async getTerminal(id: string): Promise<any | null> {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, 'terminals', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async getAllTerminals(): Promise<any[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'terminals'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateTerminalBlockStatus(terminalId: string, isBlocked: boolean): Promise<void> {
    if (!db || !terminalId) return;
    const ref = doc(db, 'terminals', terminalId);
    if (!isOnline) {
      addToQueue('updateTerminal', { id: terminalId, updates: { isBlocked } });
      return;
    }
    await updateDoc(ref, { isBlocked, updatedAt: Date.now() });
  },

  async updateTerminal(terminalId: string, updates: Record<string, any>): Promise<void> {
    if (!db || !terminalId) return;
    const ref = doc(db, 'terminals', terminalId);
    if (!isOnline) {
      addToQueue('updateTerminal', { id: terminalId, updates });
      return;
    }
    await updateDoc(ref, { ...updates, updatedAt: Date.now() });
  },

  async updateUserTerminalId(userId: string, terminalId: string | null): Promise<void> {
    if (!db || !userId) return;
    const userRef = doc(db, 'users', userId);
    const data = { terminalId: terminalId || null, updatedAt: Date.now() };
    if (!isOnline) {
      addToQueue('updateUserTerminalId', { userId, terminalId: terminalId || null });
      return;
    }
    await updateDoc(userRef, data);
  },

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

  async getActiveSessionByTerminal(terminalId: string): Promise<any | null> {
    if (!db || !terminalId) return null;
    const q = query(collection(db, 'cash_sessions'), 
      where('terminalId', '==', terminalId), 
      where('status', '==', 'abierta'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  },

  subscribeToActiveSession(terminalId: string, callback: (session: any | null) => void): () => void {
    if (!db || !terminalId) return () => {};
    const q = query(collection(db, 'cash_sessions'), 
      where('terminalId', '==', terminalId), 
      where('status', '==', 'abierta'),
      limit(1)
    );
    return onSnapshot(q, 
      (snap) => callback(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      (err) => console.warn(`Suscripción restringida: active_session/${terminalId}`, err.message)
    );
  },

  async closeCashSession(sessionId: string, finalAmountUsd: number): Promise<any> {
    if (!db || !sessionId) throw new Error('Firebase o SessionId no disponible');
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

  async getTransactionsBySession(sessionId: string, limitCount: number = 500): Promise<any[]> {
    if (!db || !sessionId) return [];
    const q = query(collection(db, 'transactions'), 
      where('sessionId', '==', sessionId),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  },

  subscribeToTransactionsBySession(sessionId: string, callback: (transactions: any[]) => void): () => void {
    if (!db || !sessionId) return () => {};
    const q = query(collection(db, 'transactions'), 
      where('sessionId', '==', sessionId),
      orderBy('date', 'desc'),
      limit(500)
    );
    return onSnapshot(q, 
      (snap) => callback(snap.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }))),
      (err) => console.warn(`Suscripción restringida: session_txs/${sessionId}`, err.message)
    );
  },

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