import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, query, where, getDocs, limit,
  orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { ref, set, get, update, remove, onValue, off } from 'firebase/database';
import { db, rtdb } from '@/lib/firebase';
import { Product, Client, Transaction, Account, CashRegister, CartItem } from '@/lib/types';

// ============================================
// ESTRATEGIAS PARA OPTIMIZAR CUOTAS DE FIREBASE
// ============================================
// 1. Cache local (localStorage) - Leer primero de caché
// 2. Escritura diferida (Debounced writes) - Agrupar escrituras
// 3. Batch writes - Múltiples operaciones en una sola
// 4. Limit en queries - Nunca traer más de 50 registros
// 5. Real-time solo para datos críticos (caja abierta, últimas ventas)

// Cache local
const localCache = {
  products: null as Product[] | null,
  clients: null as Client[] | null,
  transactions: null as Transaction[] | null,
  accounts: null as Account[] | null,
  lastUpdate: {} as Record<string, number>,
  pendingWrites: [] as any[],
  writeTimer: null as NodeJS.Timeout | null,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de TTL
const DEBOUNCE_DELAY = 3000; // 3 segundos para agrupar escrituras

// ============================================
// FIRESTORE - PRODUCTOS (Colección: products)
// ============================================
export const firebaseService = {
  // Guardar todos los productos (batch write)
  async saveProducts(products: Product[]): Promise<void> {
    const batch = writeBatch(db);
    const productsRef = collection(db, 'products');
    
    products.forEach(product => {
      const docRef = doc(productsRef, product.id.toString());
      batch.set(docRef, {
        ...product,
        updatedAt: Timestamp.now(),
      });
    });
    
    await batch.commit();
    localCache.products = products;
    localCache.lastUpdate.products = Date.now();
  },

  // Cargar productos (con caché y límite)
  async loadProducts(): Promise<Product[]> {
    // Verificar caché
    if (localCache.products && (Date.now() - (localCache.lastUpdate.products || 0) < CACHE_TTL)) {
      return localCache.products;
    }
    
    // Limitar a 100 productos por consulta
    const q = query(collection(db, 'products'), limit(100));
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Product));
    
    localCache.products = products;
    localCache.lastUpdate.products = Date.now();
    return products;
  },

  // Actualizar un producto
  async updateProduct(product: Product): Promise<void> {
    const docRef = doc(db, 'products', product.id.toString());
    await setDoc(docRef, { ...product, updatedAt: Timestamp.now() }, { merge: true });
    
    // Actualizar caché
    if (localCache.products) {
      const index = localCache.products.findIndex(p => p.id === product.id);
      if (index !== -1) localCache.products[index] = product;
    }
  },

  // Agregar un producto
  async addProduct(product: Product): Promise<void> {
    const docRef = doc(db, 'products', product.id.toString());
    await setDoc(docRef, { ...product, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    
    if (localCache.products) localCache.products.push(product);
  },

  // Eliminar un producto
  async deleteProduct(id: number): Promise<void> {
    const docRef = doc(db, 'products', id.toString());
    await deleteDoc(docRef);
    
    if (localCache.products) {
      localCache.products = localCache.products.filter(p => p.id !== id);
    }
  },

  // ============================================
  // FIRESTORE - CLIENTES (Colección: clients)
  // ============================================
  async saveClients(clients: Client[]): Promise<void> {
    const batch = writeBatch(db);
    clients.forEach(client => {
      const docRef = doc(db, 'clients', client.id.toString());
      batch.set(docRef, { ...client, updatedAt: Timestamp.now() });
    });
    await batch.commit();
    localCache.clients = clients;
  },

  async loadClients(): Promise<Client[]> {
    if (localCache.clients && (Date.now() - (localCache.lastUpdate.clients || 0) < CACHE_TTL)) {
      return localCache.clients;
    }
    
    const snapshot = await getDocs(query(collection(db, 'clients'), limit(200)));
    const clients = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Client));
    
    localCache.clients = clients;
    localCache.lastUpdate.clients = Date.now();
    return clients;
  },

  // ============================================
  // REAL TIME DATABASE - CAJA (para datos en tiempo real)
  // ============================================
  
  // Suscribirse a cambios en tiempo real de la caja
  subscribeToRegister(callback: (data: any) => void): () => void {
    const registerRef = ref(rtdb, 'register');
    const unsubscribe = onValue(registerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) callback(data);
    });
    return () => off(registerRef, 'value', unsubscribe);
  },

  // Guardar estado de la caja en Realtime DB
  async saveRegister(registerData: any): Promise<void> {
    const registerRef = ref(rtdb, 'register');
    await set(registerRef, {
      ...registerData,
      updatedAt: Date.now()
    });
  },

  // Limpiar caja al cerrar
  async clearRegister(): Promise<void> {
    const registerRef = ref(rtdb, 'register');
    await remove(registerRef);
  },

  // ============================================
  // FIRESTORE - TRANSACCIONES (optimizado)
  // ============================================
  
  // Agregar transacción con escritura diferida
  addTransaction(transaction: Transaction): void {
    localCache.pendingWrites.push(transaction);
    
    if (localCache.writeTimer) clearTimeout(localCache.writeTimer);
    localCache.writeTimer = setTimeout(() => {
      this.flushTransactions();
    }, DEBOUNCE_DELAY);
  },

  // Ejecutar todas las escrituras pendientes
  async flushTransactions(): Promise<void> {
    if (localCache.pendingWrites.length === 0) return;
    
    const batch = writeBatch(db);
    const toWrite = [...localCache.pendingWrites];
    localCache.pendingWrites = [];
    
    toWrite.forEach(tx => {
      const docRef = doc(db, 'transactions', tx.id.toString());
      batch.set(docRef, { ...tx, createdAt: Timestamp.now() });
    });
    
    await batch.commit();
    
    if (localCache.transactions) {
      localCache.transactions.push(...toWrite);
    }
  },

  // Cargar transacciones (solo últimas 50)
  async loadTransactions(): Promise<Transaction[]> {
    if (localCache.transactions) return localCache.transactions;
    
    const q = query(
      collection(db, 'transactions'),
      orderBy('date', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => doc.data() as Transaction);
    
    localCache.transactions = transactions;
    return transactions;
  },

  // ============================================
  // FIRESTORE - CUENTAS (Accounts)
  // ============================================
  
  async saveAccounts(accounts: Account[]): Promise<void> {
    const batch = writeBatch(db);
    accounts.forEach(account => {
      const docRef = doc(db, 'accounts', account.id.toString());
      batch.set(docRef, { ...account, updatedAt: Timestamp.now() });
    });
    await batch.commit();
    localCache.accounts = accounts;
  },

  async loadAccounts(): Promise<Account[]> {
    if (localCache.accounts) return localCache.accounts;
    
    const snapshot = await getDocs(query(collection(db, 'accounts'), limit(100)));
    const accounts = snapshot.docs.map(doc => doc.data() as Account);
    
    localCache.accounts = accounts;
    return accounts;
  },

  // ============================================
  // SINCRONIZACIÓN COMPLETA
  // ============================================
  
  async syncAll(): Promise<{
    products: Product[];
    clients: Client[];
    transactions: Transaction[];
    accounts: Account[];
  }> {
    const [products, clients, transactions, accounts] = await Promise.all([
      this.loadProducts(),
      this.loadClients(),
      this.loadTransactions(),
      this.loadAccounts(),
    ]);
    
    return { products, clients, transactions, accounts };
  },
};

export default firebaseService;
