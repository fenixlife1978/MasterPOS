import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, query, where, getDocs, limit,
  orderBy, Timestamp, writeBatch, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, Client, Transaction, Account, CashRegister, CartItem } from '@/lib/types';

const localCache = {
  products: null as Product[] | null,
  clients: null as Client[] | null,
  transactions: null as Transaction[] | null,
  accounts: null as Account[] | null,
  lastUpdate: {} as Record<string, number>,
  pendingWrites: [] as any[],
  writeTimer: null as NodeJS.Timeout | null,
};

const CACHE_TTL = 5 * 60 * 1000;
const DEBOUNCE_DELAY = 3000;

export const firebaseService = {
  // ========== PRODUCTOS ==========
  async saveProducts(products: Product[]): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);
    const productsRef = collection(db, 'products');
    products.forEach(product => {
      const docRef = doc(productsRef, product.id.toString());
      batch.set(docRef, { ...product, updatedAt: Timestamp.now() });
    });
    await batch.commit();
    localCache.products = products;
    localCache.lastUpdate.products = Date.now();
  },

  async loadProducts(): Promise<Product[]> {
    if (!db) return [];
    if (localCache.products && (Date.now() - (localCache.lastUpdate.products || 0) < CACHE_TTL)) {
      return localCache.products;
    }
    const q = query(collection(db, 'products'), limit(100));
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Product));
    localCache.products = products;
    localCache.lastUpdate.products = Date.now();
    return products;
  },

  async updateProduct(product: Product): Promise<void> {
    if (!db) return;
    const docRef = doc(db, 'products', product.id.toString());
    await setDoc(docRef, { ...product, updatedAt: Timestamp.now() }, { merge: true });
    if (localCache.products) {
      const index = localCache.products.findIndex(p => p.id === product.id);
      if (index !== -1) localCache.products[index] = product;
    }
  },

  async addProduct(product: Product): Promise<void> {
    if (!db) return;
    const docRef = doc(db, 'products', product.id.toString());
    await setDoc(docRef, { ...product, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    if (localCache.products) localCache.products.push(product);
  },

  async deleteProduct(id: number): Promise<void> {
    if (!db) return;
    const docRef = doc(db, 'products', id.toString());
    await deleteDoc(docRef);
    if (localCache.products) {
      localCache.products = localCache.products.filter(p => p.id !== id);
    }
  },

  // ========== CLIENTES ==========
  async saveClients(clients: Client[]): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);
    clients.forEach(client => {
      const docRef = doc(db, 'clients', client.id.toString());
      batch.set(docRef, { ...client, updatedAt: Timestamp.now() });
    });
    await batch.commit();
    localCache.clients = clients;
  },

  async loadClients(): Promise<Client[]> {
    if (!db) return [];
    if (localCache.clients && (Date.now() - (localCache.lastUpdate.clients || 0) < CACHE_TTL)) {
      return localCache.clients;
    }
    const snapshot = await getDocs(query(collection(db, 'clients'), limit(200)));
    const clients = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Client));
    localCache.clients = clients;
    localCache.lastUpdate.clients = Date.now();
    return clients;
  },

  // ========== CAJA (Firestore) ==========
  subscribeToRegister(callback: (data: any) => void): () => void {
    if (!db) return () => {};
    const docRef = doc(db, 'register', 'current');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) callback(snapshot.data());
    });
    return unsubscribe;
  },

  async saveRegister(registerData: any): Promise<void> {
    if (!db) return;
    const docRef = doc(db, 'register', 'current');
    await setDoc(docRef, { ...registerData, updatedAt: Date.now() });
  },

  async clearRegister(): Promise<void> {
    if (!db) return;
    const docRef = doc(db, 'register', 'current');
    await deleteDoc(docRef);
  },

  // ========== TRANSACCIONES ==========
  addTransaction(transaction: Transaction): void {
    localCache.pendingWrites.push(transaction);
    if (localCache.writeTimer) clearTimeout(localCache.writeTimer);
    localCache.writeTimer = setTimeout(() => {
      this.flushTransactions();
    }, DEBOUNCE_DELAY);
  },

  async flushTransactions(): Promise<void> {
    if (!db || localCache.pendingWrites.length === 0) return;
    const batch = writeBatch(db);
    const toWrite = [...localCache.pendingWrites];
    localCache.pendingWrites = [];
    toWrite.forEach(tx => {
      const docRef = doc(db, 'transactions', tx.id.toString());
      batch.set(docRef, { ...tx, createdAt: Timestamp.now() });
    });
    await batch.commit();
    if (localCache.transactions) localCache.transactions.push(...toWrite);
  },

  async loadTransactions(): Promise<Transaction[]> {
    if (!db) return [];
    if (localCache.transactions) return localCache.transactions;
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => doc.data() as Transaction);
    localCache.transactions = transactions;
    return transactions;
  },

  // ========== CUENTAS ==========
  async saveAccounts(accounts: Account[]): Promise<void> {
    if (!db) return;
    const batch = writeBatch(db);
    accounts.forEach(account => {
      const docRef = doc(db, 'accounts', account.id.toString());
      batch.set(docRef, { ...account, updatedAt: Timestamp.now() });
    });
    await batch.commit();
    localCache.accounts = accounts;
  },

  async loadAccounts(): Promise<Account[]> {
    if (!db) return [];
    if (localCache.accounts) return localCache.accounts;
    const snapshot = await getDocs(query(collection(db, 'accounts'), limit(100)));
    const accounts = snapshot.docs.map(doc => doc.data() as Account);
    localCache.accounts = accounts;
    return accounts;
  },

  // ========== SINCRONIZACIÓN ==========
  async syncAll(): Promise<{ products: Product[]; clients: Client[]; transactions: Transaction[]; accounts: Account[] }> {
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
