"use client";

import { db, rtdb } from '@/lib/firebase';
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, query, where, getDocs, limit,
  orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { ref, set, get, update, remove, onValue, off } from 'firebase/database';

// ============================================
// COLA DE OPERACIONES OFFLINE
// ============================================
interface PendingOperation {
  id: string;
  type: 'saveProducts' | 'saveClients' | 'saveTransaction' | 'saveAccount' | 'saveRegister' | 'clearRegister' | 'saveAccountingEntry';
  data: any;
  timestamp: number;
  retries: number;
}

let pendingQueue: PendingOperation[] = [];
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isSyncing = false;

// Cargar cola pendiente desde localStorage
if (typeof window !== 'undefined') {
  const savedQueue = localStorage.getItem('firebase_pending_queue');
  if (savedQueue) {
    try {
      pendingQueue = JSON.parse(savedQueue);
    } catch(e) {}
  }
}

// Guardar cola en localStorage
const saveQueue = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('firebase_pending_queue', JSON.stringify(pendingQueue));
  }
};

// Detectar cambios de conectividad
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('🟢 Conexión recuperada, sincronizando...');
    processQueue();
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('🔴 Sin conexión, guardando operaciones en cola');
  });
}

// Limpiar datos undefined
const cleanObject = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item)).filter(item => item !== null);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      const value = cleanObject(obj[key]);
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  return obj;
};

// Procesar cola de operaciones pendientes
const processQueue = async () => {
  if (!isOnline || isSyncing || pendingQueue.length === 0) return;
  
  isSyncing = true;
  console.log(`🔄 Sincronizando ${pendingQueue.length} operaciones pendientes...`);
  
  const toRetry: PendingOperation[] = [];
  
  for (const op of pendingQueue) {
    try {
      const cleanedData = cleanObject(op.data);
      
      switch (op.type) {
        case 'saveProducts':
          const batch = writeBatch(db);
          if (Array.isArray(cleanedData)) {
            cleanedData.forEach((product: any) => {
              if (product && product.id) {
                const docRef = doc(db, 'products', product.id.toString());
                batch.set(docRef, { ...product, updatedAt: Date.now() });
              }
            });
            await batch.commit();
          }
          break;
        case 'saveClients':
          const clientBatch = writeBatch(db);
          if (Array.isArray(cleanedData)) {
            cleanedData.forEach((client: any) => {
              if (client && client.id) {
                const docRef = doc(db, 'clients', client.id.toString());
                clientBatch.set(docRef, { ...client, updatedAt: Date.now() });
              }
            });
            await clientBatch.commit();
          }
          break;
        case 'saveTransaction':
          if (cleanedData && cleanedData.id) {
            const txRef = doc(db, 'transactions', cleanedData.id.toString());
            await setDoc(txRef, { ...cleanedData, createdAt: Date.now() });
          }
          break;
        case 'saveAccount':
          if (cleanedData && cleanedData.id) {
            const accRef = doc(db, 'accounts', cleanedData.id.toString());
            await setDoc(accRef, { ...cleanedData, updatedAt: Date.now() });
          }
          break;
        case 'saveAccountingEntry':
          if (cleanedData && cleanedData.id) {
            const entryRef = doc(db, 'accounting_entries', cleanedData.id.toString());
            await setDoc(entryRef, { ...cleanedData, createdAt: Date.now() });
          }
          break;
        case 'saveRegister':
          const registerRef = ref(rtdb, 'register');
          const cleanedRegister = { ...cleanedData, updatedAt: Date.now() };
          delete cleanedRegister.txs;
          await set(registerRef, cleanedRegister);
          break;
        case 'clearRegister':
          const clearRef = ref(rtdb, 'register');
          await remove(clearRef);
          break;
      }
      console.log(`✅ Operación ${op.type} sincronizada`);
    } catch (error) {
      console.error(`❌ Error sincronizando ${op.type}:`, error);
      op.retries++;
      if (op.retries < 5) {
        toRetry.push(op);
      } else {
        console.error(`⚠️ Operación ${op.type} descartada después de 5 intentos`);
      }
    }
  }
  
  pendingQueue = toRetry;
  saveQueue();
  isSyncing = false;
  
  if (pendingQueue.length > 0) {
    setTimeout(processQueue, 10000);
  }
};

const addToQueue = (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>) => {
  const newOp: PendingOperation = {
    ...operation,
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    retries: 0
  };
  pendingQueue.push(newOp);
  saveQueue();
  
  if (isOnline) {
    processQueue();
  }
};

// ============================================
// FIRESTORE - Colecciones
// ============================================

export const syncService = {
  // ============================================
  // PRODUCTOS
  // ============================================
  async saveProducts(products: any[]) {
    const cleaned = cleanObject(products);
    if (!isOnline) {
      addToQueue({ type: 'saveProducts', data: cleaned });
      return;
    }
    
    try {
      const batch = writeBatch(db);
      cleaned.forEach((product: any) => {
        if (product && product.id) {
          const docRef = doc(db, 'products', product.id.toString());
          batch.set(docRef, { ...product, updatedAt: Date.now() });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error saving products:', error);
      addToQueue({ type: 'saveProducts', data: cleaned });
    }
  },

  async loadProducts(): Promise<any[]> {
    try {
      const q = query(collection(db, 'products'), limit(200));
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('cache_products', JSON.stringify(products));
      }
      return products;
    } catch (error) {
      console.error('Error loading products:', error);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_products');
        if (cached) return JSON.parse(cached);
      }
      return [];
    }
  },

  // ============================================
  // CLIENTES
  // ============================================
  async saveClients(clients: any[]) {
    const cleaned = cleanObject(clients);
    if (!isOnline) {
      addToQueue({ type: 'saveClients', data: cleaned });
      return;
    }
    
    try {
      const batch = writeBatch(db);
      cleaned.forEach((client: any) => {
        if (client && client.id) {
          const docRef = doc(db, 'clients', client.id.toString());
          batch.set(docRef, { ...client, updatedAt: Date.now() });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error saving clients:', error);
      addToQueue({ type: 'saveClients', data: cleaned });
    }
  },

  async loadClients(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'clients'));
      const clients = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('cache_clients', JSON.stringify(clients));
      }
      return clients;
    } catch (error) {
      console.error('Error loading clients:', error);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_clients');
        if (cached) return JSON.parse(cached);
      }
      return [];
    }
  },

  // ============================================
  // TRANSACCIONES
  // ============================================
  async saveTransaction(transaction: any) {
    const cleaned = cleanObject(transaction);
    if (!isOnline) {
      addToQueue({ type: 'saveTransaction', data: cleaned });
      return;
    }
    
    try {
      if (cleaned && cleaned.id) {
        const docRef = doc(db, 'transactions', cleaned.id.toString());
        await setDoc(docRef, { ...cleaned, createdAt: Date.now() });
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      addToQueue({ type: 'saveTransaction', data: cleaned });
    }
  },

  async loadTransactions(): Promise<any[]> {
    try {
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(200));
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => doc.data());
      if (typeof window !== 'undefined') {
        localStorage.setItem('cache_transactions', JSON.stringify(transactions));
      }
      return transactions;
    } catch (error) {
      console.error('Error loading transactions:', error);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_transactions');
        if (cached) return JSON.parse(cached);
      }
      return [];
    }
  },

  // ============================================
  // ASIENTOS CONTABLES
  // ============================================
  async saveAccountingEntry(entry: any) {
    const cleaned = cleanObject(entry);
    if (!isOnline) {
      addToQueue({ type: 'saveAccountingEntry', data: cleaned });
      return;
    }
    
    try {
      if (cleaned && cleaned.id) {
        const docRef = doc(db, 'accounting_entries', cleaned.id.toString());
        await setDoc(docRef, { ...cleaned, createdAt: Date.now() });
      }
    } catch (error) {
      console.error('Error saving accounting entry:', error);
      addToQueue({ type: 'saveAccountingEntry', data: cleaned });
    }
  },

  async loadAccountingEntries(): Promise<any[]> {
    try {
      const q = query(collection(db, 'accounting_entries'), orderBy('date', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(doc => doc.data());
      if (typeof window !== 'undefined') {
        localStorage.setItem('cache_accounting_entries', JSON.stringify(entries));
      }
      return entries;
    } catch (error) {
      console.error('Error loading accounting entries:', error);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_accounting_entries');
        if (cached) return JSON.parse(cached);
      }
      return [];
    }
  },

  // ============================================
  // CUENTAS (ACCOUNTS)
  // ============================================
  async saveAccount(account: any) {
    const cleaned = cleanObject(account);
    if (!isOnline) {
      addToQueue({ type: 'saveAccount', data: cleaned });
      return;
    }
    
    try {
      if (cleaned && cleaned.id) {
        const docRef = doc(db, 'accounts', cleaned.id.toString());
        await setDoc(docRef, { ...cleaned, updatedAt: Date.now() });
      }
    } catch (error) {
      console.error('Error saving account:', error);
      addToQueue({ type: 'saveAccount', data: cleaned });
    }
  },

  async loadAccounts(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'accounts'));
      const accounts = snapshot.docs.map(doc => doc.data());
      if (typeof window !== 'undefined') {
        localStorage.setItem('cache_accounts', JSON.stringify(accounts));
      }
      return accounts;
    } catch (error) {
      console.error('Error loading accounts:', error);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_accounts');
        if (cached) return JSON.parse(cached);
      }
      return [];
    }
  },

  // ============================================
  // CAJA (Realtime Database)
  // ============================================
  async saveRegister(register: any) {
    const cleaned = cleanObject(register);
    if (!isOnline) {
      addToQueue({ type: 'saveRegister', data: cleaned });
      return;
    }
    
    try {
      const registerRef = ref(rtdb, 'register');
      const toSave = { ...cleaned, updatedAt: Date.now() };
      delete toSave.txs;
      await set(registerRef, toSave);
    } catch (error) {
      console.error('Error saving register:', error);
      addToQueue({ type: 'saveRegister', data: cleaned });
    }
  },

  async loadRegister(): Promise<any> {
    try {
      const registerRef = ref(rtdb, 'register');
      const snapshot = await get(registerRef);
      const data = snapshot.val();
      if (data && typeof window !== 'undefined') {
        localStorage.setItem('cache_register', JSON.stringify(data));
      }
      return data;
    } catch (error) {
      console.error('Error loading register:', error);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_register');
        if (cached) return JSON.parse(cached);
      }
      return null;
    }
  },

  async clearRegister() {
    if (!isOnline) {
      addToQueue({ type: 'clearRegister', data: null });
      return;
    }
    
    try {
      const registerRef = ref(rtdb, 'register');
      await remove(registerRef);
    } catch (error) {
      console.error('Error clearing register:', error);
      addToQueue({ type: 'clearRegister', data: null });
    }
  },

  subscribeToRegister(callback: (data: any) => void) {
    const registerRef = ref(rtdb, 'register');
    const unsubscribe = onValue(registerRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  },
  
  getPendingQueueLength: () => pendingQueue.length,
  forceSync: processQueue
};

// ============================================
// MÚLTIPLES TERMINALES / CAJAS
// ============================================

// Guardar estado de caja por terminal
export const saveRegisterByTerminal = async (terminalId: string, register: any) => {
  const cleaned = cleanObject(register);
  if (!isOnline) {
    addToQueue({ type: 'saveRegister', data: { terminalId, register: cleaned } });
    return;
  }
  
  try {
    const registerRef = ref(rtdb, `registers/${terminalId}`);
    const toSave = { ...cleaned, updatedAt: Date.now() };
    delete toSave.txs;
    await set(registerRef, toSave);
  } catch (error) {
    console.error('Error saving register by terminal:', error);
    addToQueue({ type: 'saveRegister', data: { terminalId, register: cleaned } });
  }
};

// Cargar estado de caja por terminal
export const loadRegisterByTerminal = async (terminalId: string): Promise<any> => {
  try {
    const registerRef = ref(rtdb, `registers/${terminalId}`);
    const snapshot = await get(registerRef);
    const data = snapshot.val();
    if (data && typeof window !== 'undefined') {
      localStorage.setItem(`cache_register_${terminalId}`, JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.error('Error loading register by terminal:', error);
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`cache_register_${terminalId}`);
      if (cached) return JSON.parse(cached);
    }
    return null;
  }
};

// Suscribirse a cambios de caja por terminal (tiempo real)
export const subscribeToRegisterByTerminal = (terminalId: string, callback: (data: any) => void) => {
  const registerRef = ref(rtdb, `registers/${terminalId}`);
  const unsubscribe = onValue(registerRef, (snapshot) => {
    callback(snapshot.val());
  });
  listeners.push(unsubscribe);
  return unsubscribe;
};

// Obtener todas las cajas activas (para administrador)
export const getAllActiveRegisters = async (): Promise<any[]> => {
  try {
    const registersRef = ref(rtdb, 'registers');
    const snapshot = await get(registersRef);
    const data = snapshot.val();
    if (!data) return [];
    return Object.entries(data).map(([terminalId, register]) => ({
      terminalId,
      ...(register as any)
    }));
  } catch (error) {
    console.error('Error loading all registers:', error);
    return [];
  }
};

// Suscribirse a todas las cajas (tiempo real para admin)
export const subscribeToAllRegisters = (callback: (registers: any[]) => void) => {
  const registersRef = ref(rtdb, 'registers');
  const unsubscribe = onValue(registersRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const registers = Object.entries(data).map(([terminalId, register]) => ({
      terminalId,
      ...(register as any)
    }));
    callback(registers);
  });
  listeners.push(unsubscribe);
  return unsubscribe;
};

// Declaraciones de tipo para las nuevas funciones
declare module './syncService' {
  export function saveRegisterByTerminal(terminalId: string, register: any): Promise<void>;
  export function loadRegisterByTerminal(terminalId: string): Promise<any>;
  export function subscribeToRegisterByTerminal(terminalId: string, callback: (data: any) => void): () => void;
  export function getAllActiveRegisters(): Promise<any[]>;
  export function subscribeToAllRegisters(callback: (registers: any[]) => void): () => void;
}
