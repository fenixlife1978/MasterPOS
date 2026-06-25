// src/services/syncService.ts
// ============================================================
// SERVICIO DE SINCRONIZACIÓN - FIREBASE
// Usa Firebase Firestore como fuente principal para usuarios/transacciones
// y RTDB para inventario/caja/proveedores
// ============================================================

import { ref, get, set, update, remove, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot
} from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';

// ============================================================
// UTILIDADES
// ============================================================

const CACHE_PREFIX = 'pos_cache_';
const USERS_COLLECTION = 'users';
const TRANSACTIONS_COLLECTION = 'transactions';

function getCacheKey(entity: string): string {
  return `${CACHE_PREFIX}${entity}`;
}

function getCachedData<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error guardando en caché:', error);
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function processId(id: string): string | number {
  return isNaN(Number(id)) ? id : Number(id);
}

function cleanForFirebase(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirebase(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanForFirebase(value);
    }
    return cleaned;
  }
  return obj;
}

/**
 * Normaliza los datos de un producto para asegurar que los campos numéricos
 * se extraigan correctamente (maneja snake_case y camelCase).
 */
function parseProductData(id: string, p: any) {
  const parseNum = (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  return {
    id: processId(id) as number,
    barcode: p.barcode || '',
    name: p.name || 'Sin nombre',
    category: p.category || 'Otro',
    department: p.department || 'Otros',
    stock: parseNum(p.stock),
    minStock: parseNum(p.minStock || p.min_stock || 5),
    priceUsd: parseNum(p.priceUsd || p.price_usd),
    priceBs: parseNum(p.priceBs || p.price_bs),
    costUsd: parseNum(p.costUsd || p.cost_usd),
    costBs: parseNum(p.costBs || p.cost_bs),
    profitPercent: parseNum(p.profitPercent || p.profit_percent),
    priceRetail: parseNum(p.priceRetail || p.price_retail),
    priceWholesale: parseNum(p.priceWholesale || p.price_wholesale),
    priceCost: parseNum(p.priceCost || p.price_cost),
    ivaType: p.ivaType || p.iva_type || 'con_iva',
    ivaPercentage: parseNum(p.ivaPercentage || p.iva_percentage || 16),
    isKit: p.isKit === 1 || p.isKit === true,
    kitHasOwnStock: p.kitHasOwnStock === 1 || p.kitHasOwnStock === true,
    kitComponents: p.kitComponents ? (typeof p.kitComponents === 'string' ? JSON.parse(p.kitComponents) : p.kitComponents) : [],
    isPriceFixed: p.isPriceFixed === 1 || p.isPriceFixed === true,
    activo: p.activo !== 0
  };
}

// ============================================================
// USUARIOS (FIRESTORE)
// ============================================================

export async function getUserByUid(uid: string) {
  try {
    const userDoc = await getDoc(doc(firestoreDb, USERS_COLLECTION, uid));
    if (userDoc.exists()) {
      return { id: uid, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

export async function saveUser(user: any) {
  const userId = user.uid || user.id || generateId();
  const userData = {
    uid: userId,
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'cashier',
    terminalId: user.terminalId || null,
    terminalName: user.terminalName || null,
    status: user.status || 'active',
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(doc(firestoreDb, USERS_COLLECTION, userId), userData, { merge: true });
  await set(ref(rtdb, `users/${userId}`), userData);
  return { id: userId, ...userData };
}

export async function getAllUsers() {
  try {
    const snapshot = await getDocs(collection(firestoreDb, USERS_COLLECTION));
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setCachedData(getCacheKey('users'), users);
    return users;
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return getCachedData<any[]>(getCacheKey('users')) || [];
  }
}

export function subscribeToUsers(callback: (users: any[]) => void) {
  return onSnapshot(collection(firestoreDb, USERS_COLLECTION), (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
}

export async function deleteUser(uid: string) {
  await deleteDoc(doc(firestoreDb, USERS_COLLECTION, uid));
  await remove(ref(rtdb, `users/${uid}`));
}

export async function updateUserTerminalId(userId: string, terminalId: string | null, terminalName: string | null = null) {
  const updateData: any = { 
    terminalId, 
    updatedAt: new Date().toISOString() 
  };
  if (terminalName !== null) updateData.terminalName = terminalName;
  
  await updateDoc(doc(firestoreDb, USERS_COLLECTION, userId), updateData);
  await update(ref(rtdb, `users/${userId}`), updateData);
}

// ============================================================
// PRODUCTOS (RTDB)
// ============================================================

export async function getAllProducts() {
  try {
    const snapshot = await get(ref(rtdb, 'products'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const products = Object.entries(data)
        .map(([id, p]: [string, any]) => parseProductData(id, p))
        .filter(p => p.activo !== false);
      setCachedData(getCacheKey('products'), products);
      return products;
    }
    return getCachedData<any[]>(getCacheKey('products')) || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('products')) || [];
  }
}

export async function saveProduct(product: any) {
  const productId = product.id || generateId();
  const productData = {
    ...product,
    id: productId,
    isKit: product.isKit ? 1 : 0,
    kitHasOwnStock: product.kitHasOwnStock ? 1 : 0,
    kitComponents: product.kitComponents ? JSON.stringify(product.kitComponents) : null,
    isPriceFixed: product.isPriceFixed ? 1 : 0,
    activo: product.activo !== undefined ? (product.activo ? 1 : 0) : 1,
    updatedAt: new Date().toISOString()
  };
  await set(ref(rtdb, `products/${productId}`), productData);
  return productData;
}

export async function deleteProduct(id: number) {
  await update(ref(rtdb, `products/${id}`), { activo: 0, updatedAt: new Date().toISOString() });
}

// ============================================================
// TRANSACCIONES (RTDB + FIRESTORE)
// ============================================================

export async function getAllTransactions() {
  try {
    const snapshot = await get(ref(rtdb, 'transactions'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const transactions = Object.entries(data).map(([id, t]: [string, any]) => ({
        id: processId(id) as number,
        ...t,
        items: t.items ? (typeof t.items === 'string' ? JSON.parse(t.items) : t.items) : [],
        payments: t.payments ? (typeof t.payments === 'string' ? JSON.parse(t.payments) : t.payments) : []
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCachedData(getCacheKey('transactions'), transactions);
      return transactions;
    }
    return getCachedData<any[]>(getCacheKey('transactions')) || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('transactions')) || [];
  }
}

export async function saveTransaction(tx: any) {
  const txId = tx.id || generateId();
  const txData = cleanForFirebase({
    ...tx,
    items: tx.items ? JSON.stringify(tx.items) : null,
    payments: tx.payments ? JSON.stringify(tx.payments) : null,
    updatedAt: new Date().toISOString()
  });
  
  await set(ref(rtdb, `transactions/${txId}`), txData);
  try {
    await setDoc(doc(firestoreDb, TRANSACTIONS_COLLECTION, String(txId)), cleanForFirebase(tx));
  } catch (e) {
    console.warn('Firestore fallback failed', e);
  }
  return tx;
}

// ============================================================
// CLIENTES (RTDB)
// ============================================================

export async function getAllClients() {
  try {
    const snapshot = await get(ref(rtdb, 'clients'));
    if (snapshot.exists()) {
      const clients = Object.entries(snapshot.val()).map(([id, c]: [string, any]) => ({
        id: processId(id) as number,
        ...c
      }));
      setCachedData(getCacheKey('clients'), clients);
      return clients;
    }
    return [];
  } catch { return []; }
}

export async function saveClient(client: any) {
  const id = client.id || generateId();
  const clientData = {
    ...client,
    id: processId(String(id)),
    updatedAt: new Date().toISOString()
  };
  await set(ref(rtdb, `clients/${id}`), clientData);
  return clientData;
}

export async function deleteClient(id: number) {
  await remove(ref(rtdb, `clients/${id}`));
}

// ============================================================
// CUENTAS (RTDB)
// ============================================================

export async function getAllAccounts() {
  try {
    const snapshot = await get(ref(rtdb, 'accounts'));
    if (snapshot.exists()) {
      return Object.entries(snapshot.val()).map(([id, a]: [string, any]) => ({
        id: processId(id) as number,
        ...a,
        clientId: processId(String(a.clientId))
      }));
    }
    return [];
  } catch { return []; }
}

export async function saveAccount(account: any) {
  const id = account.id || generateId();
  const accountData = {
    ...account,
    id: processId(String(id)),
    clientId: processId(String(account.clientId)),
    updatedAt: new Date().toISOString()
  };
  await set(ref(rtdb, `accounts/${id}`), accountData);
  return accountData;
}

export async function deleteAccount(accountId: string) {
  try {
    await remove(ref(rtdb, `accounts/${accountId}`));
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}

// ============================================================
// PROVEEDORES Y COMPRAS (RTDB)
// ============================================================

export async function getAllSuppliers() {
  try {
    const snapshot = await get(ref(rtdb, 'suppliers'));
    if (snapshot.exists()) {
      const suppliers = Object.entries(snapshot.val()).map(([id, s]: [string, any]) => ({
        id: processId(id) as number,
        ...s
      }));
      setCachedData(getCacheKey('suppliers'), suppliers);
      return suppliers;
    }
    return [];
  } catch { return []; }
}

export async function saveSupplier(supplier: any) {
  const id = supplier.id || generateId();
  await set(ref(rtdb, `suppliers/${id}`), { ...supplier, id, updatedAt: new Date().toISOString() });
  return { ...supplier, id };
}

export async function deleteSupplier(id: number) {
  await remove(ref(rtdb, `suppliers/${id}`));
}

export async function getAllPurchaseInvoices() {
  try {
    const snapshot = await get(ref(rtdb, 'purchase_invoices'));
    if (snapshot.exists()) {
      return Object.entries(snapshot.val()).map(([id, inv]: [string, any]) => ({
        id: processId(id) as number,
        ...inv
      }));
    }
    return [];
  } catch { return []; }
}

export async function savePurchaseInvoice(invoice: any) {
  const id = invoice.id || generateId();
  await set(ref(rtdb, `purchase_invoices/${id}`), { 
    ...invoice, 
    id, 
    updatedAt: new Date().toISOString() 
  });
  return invoice;
}

export async function savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
  for (const item of items) {
    const itemId = item.id || generateId();
    await set(ref(rtdb, `purchase_items/${itemId}`), { 
      ...item, 
      invoiceId, 
      updatedAt: new Date().toISOString() 
    });
  }
}

export async function getAllPurchaseItems() {
  try {
    const snapshot = await get(ref(rtdb, 'purchase_items'));
    if (snapshot.exists()) {
      return Object.entries(snapshot.val()).map(([id, item]: [string, any]) => ({
        id,
        ...item
      }));
    }
    return [];
  } catch { return []; }
}

export async function saveSupplierPayment(payment: any) {
  const id = payment.id || generateId();
  await set(ref(rtdb, `supplier_payments/${id}`), { 
    ...payment, 
    id, 
    updatedAt: new Date().toISOString() 
  });
  return payment;
}

export async function deleteSupplierPayment(id: number) {
  await remove(ref(rtdb, `supplier_payments/${id}`));
}

export async function getAllSupplierPayments() {
  try {
    const snapshot = await get(ref(rtdb, 'supplier_payments'));
    if (snapshot.exists()) {
      return Object.entries(snapshot.val()).map(([id, p]: [string, any]) => ({
        id: processId(id) as number,
        ...p
      }));
    }
    return [];
  } catch { return []; }
}

// ============================================================
// CONTABILIDAD Y KARDEX (RTDB)
// ============================================================

export async function saveAccountingEntry(entry: any) {
  const id = entry.id || generateId();
  await set(ref(rtdb, `accounting_entries/${id}`), { ...entry, id, updatedAt: new Date().toISOString() });
}

export async function saveAccountingBatch(entries: any[]) {
  const batch: any = {};
  entries.forEach(e => { batch[e.id || generateId()] = { ...e, updatedAt: new Date().toISOString() }; });
  await update(ref(rtdb, 'accounting_entries'), batch);
}

export async function getAllAccountingEntries() {
  const snapshot = await get(ref(rtdb, 'accounting_entries'));
  if (snapshot.exists()) {
    return Object.entries(snapshot.val()).map(([id, e]: [string, any]) => ({ id, ...e }));
  }
  return [];
}

export async function saveKardexEntry(entry: any) {
  const id = entry.id || generateId();
  const cleanId = String(id).replace(/[.#$[\]]/g, '_');
  await set(ref(rtdb, `kardex_entries/${cleanId}`), { ...entry, id: cleanId, updatedAt: new Date().toISOString() });
}

export async function saveKardexBatch(entries: any[]) {
  const batch: any = {};
  entries.forEach(e => {
    const cleanId = String(e.id || generateId()).replace(/[.#$[\]]/g, '_');
    batch[cleanId] = { ...e, id: cleanId, updatedAt: new Date().toISOString() };
  });
  await update(ref(rtdb, 'kardex_entries'), batch);
}

export async function getAllKardexEntries() {
  const snapshot = await get(ref(rtdb, 'kardex_entries'));
  if (snapshot.exists()) {
    return Object.entries(snapshot.val()).map(([id, e]: [string, any]) => ({ id, ...e }));
  }
  return [];
}

// ============================================================
// CAJA Y SESIONES
// ============================================================

export async function getRegisterByTerminal(terminalId: string) {
  const snapshot = await get(ref(rtdb, `registers/${terminalId}`));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return { ...data, terminalId, isOpen: data.isOpen === 1 };
  }
  return null;
}

export async function saveRegisterByTerminal(terminalId: string, register: any) {
  await set(ref(rtdb, `registers/${terminalId}`), cleanForFirebase({
    ...register,
    isOpen: register.isOpen ? 1 : 0,
    updatedAt: new Date().toISOString()
  }));
}

export async function getAllCashCloses() {
  const snapshot = await get(ref(rtdb, 'cash_closes'));
  if (snapshot.exists()) {
    return Object.entries(snapshot.val()).map(([id, c]: [string, any]) => ({ id, ...c }));
  }
  return [];
}

export async function saveCashClose(close: any) {
  const id = close.id || generateId();
  await set(ref(rtdb, `cash_closes/${id}`), { ...close, id, updatedAt: new Date().toISOString() });
}

export async function deleteCashClose(id: string) {
  await remove(ref(rtdb, `cash_closes/${id}`));
}

// ============================================================
// TERMINALES
// ============================================================

export async function getAllTerminals() {
  const snapshot = await get(ref(rtdb, 'terminals'));
  if (snapshot.exists()) {
    return Object.entries(snapshot.val()).map(([id, t]: [string, any]) => ({ id, ...t }));
  }
  return [];
}

export async function saveTerminal(terminal: any) {
  const id = terminal.id || generateId();
  await set(ref(rtdb, `terminals/${id}`), { ...terminal, id, updatedAt: new Date().toISOString() });
}

export async function deleteTerminal(id: string) {
  await remove(ref(rtdb, `terminals/${id}`));
}

export async function updateTerminalBlockStatus(id: string, isBlocked: boolean) {
  await update(ref(rtdb, `terminals/${id}`), { isBlocked, updatedAt: new Date().toISOString() });
}

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

export async function getGlobalSettings() {
  const snapshot = await get(ref(rtdb, 'global_settings'));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function saveGlobalSettings(settings: any) {
  await update(ref(rtdb, 'global_settings'), { ...settings, updatedAt: new Date().toISOString() });
}

export async function getAdminCode() {
  const snapshot = await get(ref(rtdb, 'global_settings/admin_code'));
  return snapshot.exists() ? { code: snapshot.val() } : { code: '123456' };
}

// ============================================================
// COMANDOS DE SINCRONIZACIÓN
// ============================================================

export async function sendSyncCommandToAllTerminals(): Promise<void> {
  try {
    const terminals = await getAllTerminals();
    const activeTerminals = terminals.filter(t => t.status === 'active');
    
    const commands = activeTerminals.map(async (terminal) => {
      const terminalId = terminal.id.toString();
      const commandRef = ref(rtdb, `sync_commands/${terminalId}`);
      await set(commandRef, {
        command: 'sync_all',
        timestamp: Date.now(),
        status: 'pending'
      });
    });
    
    await Promise.all(commands);
    
    console.log(`✅ Comandos de sincronización enviados a ${activeTerminals.length} terminales`);
  } catch (error) {
    console.error('Error sending sync commands:', error);
    throw error;
  }
}

// ============================================================
// SUSCRIPCIONES
// ============================================================

export function subscribeToSuppliersRealtime(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'suppliers'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, s]: [string, any]) => ({ id: processId(id) as number, ...s })));
    } else callback([]);
  });
}

export function subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'purchase_invoices'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, inv]: [string, any]) => ({ id: processId(id) as number, ...inv })));
    } else callback([]);
  });
}

export function subscribeToPurchaseItems(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'purchase_items'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, i]: [string, any]) => ({ id, ...i })));
    } else callback([]);
  });
}

export function subscribeToSupplierPayments(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'supplier_payments'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, p]: [string, any]) => ({ id: processId(id) as number, ...p })));
    } else callback([]);
  });
}

export function subscribeToProducts(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'products'), (snapshot) => {
    if (snapshot.exists()) {
      const products = Object.entries(snapshot.val()).map(([id, p]: [string, any]) => parseProductData(id, p));
      callback(products);
    } else callback([]);
  });
}

export function subscribeToClients(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'clients'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, c]: [string, any]) => ({ id: processId(id) as number, ...c })));
    } else callback([]);
  });
}

export function subscribeToTransactions(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'transactions'), (snapshot) => {
    if (snapshot.exists()) {
      const transactions = Object.entries(snapshot.val()).map(([id, t]: [string, any]) => ({
        id: processId(id) as number,
        ...t,
        items: t.items ? (typeof t.items === 'string' ? JSON.parse(t.items) : t.items) : [],
        payments: t.payments ? (typeof t.payments === 'string' ? JSON.parse(t.payments) : t.payments) : []
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(transactions);
    } else callback([]);
  });
}

export function subscribeToAccounts(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'accounts'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, a]: [string, any]) => ({
        id: processId(id) as number,
        ...a,
        clientId: processId(String(a.clientId))
      })));
    } else callback([]);
  });
}

export function subscribeToRegisterRealtime(terminalId: string, callback: (data: any) => void) {
  return onValue(ref(rtdb, `registers/${terminalId}`), (snapshot) => {
    if (snapshot.exists()) {
      const d = snapshot.val();
      callback({ ...d, terminalId, isOpen: d.isOpen === 1 });
    } else callback(null);
  });
}

export function subscribeToAccounting(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'accounting_entries'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, e]: [string, any]) => ({ id: processId(id) as number, ...e })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else callback([]);
  });
}

export function subscribeToKardex(callback: (data: any[]) => void) {
  return onValue(ref(rtdb, 'kardex_entries'), (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.entries(snapshot.val()).map(([id, e]: [string, any]) => ({ id: processId(id) as number, ...e })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else callback([]);
  });
}

export function subscribeToGlobalSettings(callback: (data: any) => void) {
  return onValue(ref(rtdb, 'global_settings'), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val());
  });
}

export function subscribeToStockRTDB(callback: (stockData: Record<string, number>) => void) {
  return onValue(ref(rtdb, 'products'), (snapshot) => {
    if (snapshot.exists()) {
      const stockMap: Record<string, number> = {};
      Object.entries(snapshot.val()).forEach(([id, p]: [string, any]) => {
        if (p.activo !== 0) stockMap[id] = p.stock || 0;
      });
      callback(stockMap);
    }
  });
}

export function listenForSyncCommands(terminalId: string, onSync: () => Promise<void>) {
  const interval = setInterval(() => { onSync().catch(console.error); }, 30000);
  return () => clearInterval(interval);
}

// ============================================================
// OPERACIONES MASIVAS
// ============================================================

export async function runAtomicSale(terminalId: string, transaction: any, updates: any) {
  try {
    await saveTransaction(transaction);
    if (updates.products) {
      for (const [id, data] of updates.products.entries()) {
        await update(ref(rtdb, `products/${id}`), { stock: (data as any).newStock, updatedAt: new Date().toISOString() });
      }
    }
    if (updates.kardexEntries) {
      for (const entry of updates.kardexEntries) await saveKardexEntry(entry);
    }
    if (updates.accountingEntry) await saveAccountingEntry(updates.accountingEntry);
    if (updates.registerUpdate) {
      const reg = await getRegisterByTerminal(terminalId);
      if (reg) await saveRegisterByTerminal(terminalId, { ...reg, txs: updates.registerUpdate.txs });
    }
  } catch (error) {
    console.error('Error en venta atómica:', error);
    throw error;
  }
}

export async function loadAllDataToCache() {
  try {
    await Promise.all([
      getAllProducts(),
      getAllClients(),
      getAllTransactions(),
      getAllSuppliers(),
      getGlobalSettings(),
      getAllAccounts()
    ]);
  } catch (error) {
    console.error('Error cargando caché:', error);
  }
}

export async function syncAllPending() { return true; }
export function getPendingQueueLength() { return 0; }
export function unsubscribeAll() {}
export function setLoggingOut(val: boolean) {}

// ============================================================
// EXPORT DEFAULT Y ALIAS
// ============================================================

const syncService = {
  getUserByUid, saveUser, getAllUsers, deleteUser, updateUserTerminalId,
  subscribeToUsers,
  getAllProducts, saveProduct, deleteProduct,
  getAllClients, saveClient, deleteClient,
  getAllTransactions, saveTransaction,
  getAllAccounts, saveAccount, deleteAccount,
  getRegisterByTerminal, saveRegisterByTerminal,
  getAllCashCloses, saveCashClose, deleteCashClose,
  getAllTerminals, saveTerminal, deleteTerminal, updateTerminalBlockStatus,
  getGlobalSettings, saveGlobalSettings, getAdminCode,
  getAllSuppliers, saveSupplier, deleteSupplier,
  getAllPurchaseInvoices, savePurchaseInvoice, savePurchaseInvoiceItems, getAllPurchaseItems,
  getAllSupplierPayments, saveSupplierPayment, deleteSupplierPayment,
  getAllAccountingEntries, saveAccountingEntry, saveAccountingBatch,
  getAllKardexEntries, saveKardexEntry, saveKardexBatch, getKardexEntries: getAllKardexEntries,
  subscribeToProducts, 
  subscribeToClients, 
  subscribeToTransactions,
  subscribeToAccounts,
  subscribeToRegisterRealtime, 
  subscribeToPurchaseInvoices, 
  subscribeToPurchaseItems,
  subscribeToSupplierPayments, 
  subscribeToSuppliersRealtime, 
  subscribeToGlobalSettings,
  subscribeToKardex, 
  subscribeToAccounting, 
  subscribeToStockRTDB,
  listenForSyncCommands, loadAllDataToCache, syncAllPending, runAtomicSale,
  getPendingQueueLength, unsubscribeAll, setLoggingOut,
  sendSyncCommandToAllTerminals,
  // Alias
  getProducts: getAllProducts,
  getClients: getAllClients,
  getTransactions: getAllTransactions,
  getAccounts: getAllAccounts,
  getSuppliers: getAllSuppliers,
  getPurchaseInvoices: getAllPurchaseInvoices,
  getPurchaseItems: getAllPurchaseItems,
  getSupplierPayments: getAllSupplierPayments,
  getAccountingEntries: getAllAccountingEntries,
};

export default syncService;
export const getProducts = getAllProducts;
export const getClients = getAllClients;
export const getTransactions = getAllTransactions;
export const getAccounts = getAllAccounts;
export const getSuppliers = getAllSuppliers;
export const getPurchaseInvoices = getAllPurchaseInvoices;
export const getPurchaseItems = getAllPurchaseItems;
export const getSupplierPayments = getAllSupplierPayments;
export const getAccountingEntries = getAllAccountingEntries;
export const getKardexEntries = getAllKardexEntries;

// ✅ ELIMINADA la exportación duplicada de subscribeToAccounts
// Ya está exportada como función normal arriba (línea ~662)