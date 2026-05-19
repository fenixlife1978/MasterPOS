import { db, rtdb } from '@/lib/firebase';
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, query, where, getDocs, limit,
  orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { ref, set, get, update, remove, onValue, off } from 'firebase/database';

// Cola de operaciones pendientes (offline)
interface PendingOperation {
  id: string;
  type: 'saveProducts' | 'saveClients' | 'saveTransaction' | 'saveAccount' | 'saveRegister' | 'clearRegister';
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

// Procesar cola de operaciones pendientes
const processQueue = async () => {
  if (!isOnline || isSyncing || pendingQueue.length === 0) return;
  
  isSyncing = true;
  console.log(`🔄 Sincronizando ${pendingQueue.length} operaciones pendientes...`);
  
  const toRetry: PendingOperation[] = [];
  
  for (const op of pendingQueue) {
    try {
      switch (op.type) {
        case 'saveProducts':
          const batch = writeBatch(db);
          op.data.forEach((product: any) => {
            const docRef = doc(db, 'products', product.id.toString());
            batch.set(docRef, { ...product, updatedAt: Date.now() });
          });
          await batch.commit();
          break;
        case 'saveClients':
          const clientBatch = writeBatch(db);
          op.data.forEach((client: any) => {
            const docRef = doc(db, 'clients', client.id.toString());
            clientBatch.set(docRef, { ...client, updatedAt: Date.now() });
          });
          await clientBatch.commit();
          break;
        case 'saveTransaction':
          const txRef = doc(db, 'transactions', op.data.id.toString());
          await setDoc(txRef, { ...op.data, createdAt: Date.now() });
          break;
        case 'saveAccount':
          const accRef = doc(db, 'accounts', op.data.id.toString());
          await setDoc(accRef, { ...op.data, updatedAt: Date.now() });
          break;
        case 'saveRegister':
          const registerRef = ref(rtdb, 'register');
          await set(registerRef, { ...op.data, updatedAt: Date.now() });
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

// Agregar operación a la cola
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

export const syncService = {
  // Guardar productos
  async saveProducts(products: any[]) {
    if (!isOnline) {
      addToQueue({ type: 'saveProducts', data: products });
      return;
    }
    
    try {
      const batch = writeBatch(db);
      products.forEach(product => {
        const docRef = doc(db, 'products', product.id.toString());
        batch.set(docRef, { ...product, updatedAt: Date.now() });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error saving products:', error);
      addToQueue({ type: 'saveProducts', data: products });
    }
  },

  // Cargar productos (con caché offline)
  async loadProducts(): Promise<any[]> {
    try {
      const q = query(collection(db, 'products'), limit(200));
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
      // Guardar en caché local
      if (typeof window !== 'undefined') {
        localStorage.setItem('cache_products', JSON.stringify(products));
      }
      return products;
    } catch (error) {
      console.error('Error loading products from Firebase:', error);
      // Fallback a caché local
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cache_products');
        if (cached) return JSON.parse(cached);
      }
      return [];
    }
  },

  // Guardar clientes
  async saveClients(clients: any[]) {
    if (!isOnline) {
      addToQueue({ type: 'saveClients', data: clients });
      return;
    }
    
    try {
      const batch = writeBatch(db);
      clients.forEach(client => {
        const docRef = doc(db, 'clients', client.id.toString());
        batch.set(docRef, { ...client, updatedAt: Date.now() });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error saving clients:', error);
      addToQueue({ type: 'saveClients', data: clients });
    }
  },

  // Cargar clientes
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

  // Guardar transacción
  async saveTransaction(transaction: any) {
    if (!isOnline) {
      addToQueue({ type: 'saveTransaction', data: transaction });
      return;
    }
    
    try {
      const docRef = doc(db, 'transactions', transaction.id.toString());
      await setDoc(docRef, { ...transaction, createdAt: Date.now() });
    } catch (error) {
      console.error('Error saving transaction:', error);
      addToQueue({ type: 'saveTransaction', data: transaction });
    }
  },

  // Cargar transacciones
  async loadTransactions(): Promise<any[]> {
    try {
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(100));
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

  // Guardar cuenta
  async saveAccount(account: any) {
    if (!isOnline) {
      addToQueue({ type: 'saveAccount', data: account });
      return;
    }
    
    try {
      const docRef = doc(db, 'accounts', account.id.toString());
      await setDoc(docRef, { ...account, updatedAt: Date.now() });
    } catch (error) {
      console.error('Error saving account:', error);
      addToQueue({ type: 'saveAccount', data: account });
    }
  },

  // Cargar cuentas
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

  // Guardar estado de caja
  async saveRegister(register: any) {
    if (!isOnline) {
      addToQueue({ type: 'saveRegister', data: register });
      return;
    }
    
    try {
      const registerRef = ref(rtdb, 'register');
      await set(registerRef, { ...register, updatedAt: Date.now() });
    } catch (error) {
      console.error('Error saving register:', error);
      addToQueue({ type: 'saveRegister', data: register });
    }
  },

  // Cargar estado de caja
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

  // Limpiar caja
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

  // Suscribirse a cambios en tiempo real
  subscribeToRegister(callback: (data: any) => void) {
    const registerRef = ref(rtdb, 'register');
    const unsubscribe = onValue(registerRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  },
  
  // Verificar estado de la cola
  getPendingQueueLength: () => pendingQueue.length,
  
  // Forzar sincronización manual
  forceSync: processQueue
};
