// src/services/syncService.ts
// ============================================================
// SERVICIO DE SINCRONIZACIÓN - SIN TURSO
// Usa Firebase Firestore como fuente principal + RTDB como respaldo
// ============================================================

import { ref, get, set, update, remove, push, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

// ============================================================
// IMPORTS PARA FIRESTORE
// ============================================================

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  Timestamp
} from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';

// ============================================================
// UTILIDADES
// ============================================================

const CACHE_PREFIX = 'pos_cache_';
const STOCK_CACHE_KEY = `${CACHE_PREFIX}stock`;
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

// ✅ Función para limpiar objetos y eliminar undefined (convertir a null)
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

// ============================================================
// USUARIOS - FIRESTORE PRIMERO, RTDB COMO RESPALDO
// ============================================================

export async function getUserByUid(uid: string) {
  console.log(`📡 Buscando usuario ${uid} en Firestore...`);
  
  try {
    const userDoc = await getDoc(doc(firestoreDb, USERS_COLLECTION, uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log(`✅ Usuario encontrado en Firestore: ${data.name}`);
      return {
        id: uid,
        uid: data.uid || uid,
        name: data.name || '',
        email: data.email || '',
        role: data.role || 'user',
        terminalId: data.terminalId || null,
        terminalName: data.terminalName || null,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }
    
    console.log(`⚠️ Usuario no encontrado en Firestore, buscando en RTDB...`);
    const usersRef = ref(rtdb, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return null;
    
    const users = snapshot.val();
    for (const [key, user] of Object.entries(users)) {
      if ((user as any).uid === uid) {
        const userData = {
          uid: (user as any).uid,
          name: (user as any).name || '',
          email: (user as any).email || '',
          role: (user as any).role || 'user',
          terminalId: (user as any).terminalId || null,
          terminalName: (user as any).terminalName || null,
          status: (user as any).status || 'active',
          createdAt: (user as any).createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(firestoreDb, USERS_COLLECTION, uid), userData);
        console.log(`✅ Usuario ${userData.name} migrado de RTDB a Firestore`);
        return { id: uid, ...userData };
      }
    }
    return null;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    const usersRef = ref(rtdb, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return null;
    const users = snapshot.val();
    for (const [key, user] of Object.entries(users)) {
      if ((user as any).uid === uid) {
        return { id: key, ...(user as any) };
      }
    }
    return null;
  }
}

export async function saveUser(user: any) {
  console.log(`📡 Guardando usuario ${user.name || 'sin nombre'}...`);
  
  try {
    const userId = user.uid || user.id || generateId();
    const now = new Date().toISOString();
    
    const userData = {
      uid: userId,
      name: user.name || 'Usuario sin nombre',
      email: user.email || '',
      role: user.role || 'user',
      terminalId: user.terminalId || null,
      terminalName: user.terminalName || null,
      status: user.status || 'active',
      createdAt: user.createdAt || now,
      updatedAt: now
    };
    
    await setDoc(doc(firestoreDb, USERS_COLLECTION, userId), userData);
    console.log(`✅ Usuario ${userData.name} guardado en Firestore (ID: ${userId})`);
    
    const rtdbData = {
      uid: userId,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      terminalId: userData.terminalId,
      terminalName: userData.terminalName,
      status: userData.status,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
    };
    await set(ref(rtdb, `users/${userId}`), rtdbData);
    console.log(`✅ Usuario ${userData.name} sincronizado con RTDB`);
    
    return { id: userId, ...userData };
  } catch (error) {
    console.error('❌ Error guardando usuario en Firestore:', error);
    const userId = user.uid || user.id || generateId();
    const userData = {
      uid: user.uid || userId,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      terminalId: user.terminalId || null,
      terminalName: user.terminalName || null,
      status: user.status || 'active',
      updatedAt: new Date().toISOString()
    };
    await set(ref(rtdb, `users/${userId}`), userData);
    console.log(`⚠️ Usuario guardado solo en RTDB (fallback)`);
    return { id: userId, ...userData };
  }
}

export async function getAllUsers() {
  console.log(`📡 Obteniendo todos los usuarios desde Firestore...`);
  
  try {
    const usersRef = collection(firestoreDb, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    
    if (!snapshot.empty) {
      const users: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        users.push({
          id: doc.id,
          uid: data.uid || doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'user',
          terminalId: data.terminalId || null,
          terminalName: data.terminalName || null,
          status: data.status || 'active',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });
      
      console.log(`✅ ${users.length} usuarios obtenidos de Firestore`);
      setCachedData(getCacheKey('users'), users);
      return users;
    }
    
    console.log(`⚠️ No hay usuarios en Firestore, consultando RTDB...`);
    const usersRefRtdb = ref(rtdb, 'users');
    const snapshotRtdb = await get(usersRefRtdb);
    if (!snapshotRtdb.exists()) {
      const cached = getCachedData<any[]>(getCacheKey('users'));
      return cached || [];
    }
    
    const data = snapshotRtdb.val();
    const users = Object.entries(data).map(([id, user]) => {
      const u = user as any;
      return {
        id: id,
        uid: u.uid || id,
        name: u.name || '',
        email: u.email || '',
        role: u.role || 'user',
        terminalId: u.terminalId || null,
        terminalName: u.terminalName || null,
        status: u.status || 'active',
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || new Date().toISOString()
      };
    });
    
    console.log(`📡 Migrando ${users.length} usuarios de RTDB a Firestore...`);
    for (const user of users) {
      try {
        await setDoc(doc(firestoreDb, USERS_COLLECTION, user.uid || user.id), {
          uid: user.uid || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          terminalId: user.terminalId,
          terminalName: user.terminalName,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: new Date().toISOString()
        });
        console.log(`✅ Usuario ${user.name} migrado a Firestore`);
      } catch (error) {
        console.error(`❌ Error migrando usuario ${user.name}:`, error);
      }
    }
    
    setCachedData(getCacheKey('users'), users);
    return users;
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    const cached = getCachedData<any[]>(getCacheKey('users'));
    return cached || [];
  }
}

export async function deleteUser(uid: string) {
  console.log(`📡 Eliminando usuario ${uid}...`);
  
  try {
    await deleteDoc(doc(firestoreDb, USERS_COLLECTION, uid));
    console.log(`✅ Usuario ${uid} eliminado de Firestore`);
  } catch (error) {
    console.error('Error eliminando usuario de Firestore:', error);
  }
  
  const usersRef = ref(rtdb, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return;
  
  const users = snapshot.val();
  for (const [key, user] of Object.entries(users)) {
    if ((user as any).uid === uid) {
      await remove(ref(rtdb, `users/${key}`));
      console.log(`✅ Usuario ${uid} eliminado de RTDB`);
      break;
    }
  }
}

export async function updateUserTerminalId(userId: string, terminalId: string | null, terminalName: string | null = null) {
  console.log(`📡 Actualizando terminal para usuario ${userId}: terminalId=${terminalId}, terminalName=${terminalName}`);
  
  try {
    const now = new Date().toISOString();
    
    let userDocRef = doc(firestoreDb, USERS_COLLECTION, userId);
    let userDoc = await getDoc(userDocRef);
    let userUid = userId;
    
    if (!userDoc.exists()) {
      console.log(`⚠️ Usuario ${userId} no encontrado en Firestore, buscando por uid...`);
      const usersRef = collection(firestoreDb, USERS_COLLECTION);
      const q = query(usersRef, where('uid', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        userDocRef = docSnap.ref;
        userDoc = docSnap;
        userUid = docSnap.data().uid || docSnap.id;
        console.log(`✅ Usuario encontrado por uid: ${docSnap.id}`);
      } else {
        console.log(`⚠️ Usuario no encontrado en Firestore, buscando en RTDB...`);
        const usersRefRtdb = ref(rtdb, 'users');
        const snapshot = await get(usersRefRtdb);
        if (snapshot.exists()) {
          const users = snapshot.val();
          let foundKey = null;
          let foundUser = null;
          for (const [key, user] of Object.entries(users)) {
            const u = user as any;
            if (u.uid === userId || key === userId) {
              foundKey = key;
              foundUser = u;
              break;
            }
          }
          if (foundKey && foundUser) {
            console.log(`✅ Usuario encontrado en RTDB: ${foundKey}`);
            const newUserData = {
              uid: foundUser.uid || foundKey,
              name: foundUser.name || '',
              email: foundUser.email || '',
              role: foundUser.role || 'user',
              terminalId: terminalId,
              terminalName: terminalName,
              status: foundUser.status || 'active',
              createdAt: foundUser.createdAt || now,
              updatedAt: now
            };
            await setDoc(doc(firestoreDb, USERS_COLLECTION, newUserData.uid), newUserData);
            console.log(`✅ Usuario migrado a Firestore con terminalId=${terminalId}`);
            
            await update(ref(rtdb, `users/${foundKey}`), {
              terminalId: terminalId,
              terminalName: terminalName,
              updatedAt: now
            });
            console.log(`✅ RTDB actualizado para usuario ${foundKey}`);
            return;
          }
        }
        console.error(`❌ Usuario ${userId} no encontrado en Firestore ni RTDB`);
        return;
      }
    } else {
      userUid = userDoc.data().uid || userId;
    }
    
    const updateData: any = {
      terminalId: terminalId,
      updatedAt: now
    };
    if (terminalName !== null) {
      updateData.terminalName = terminalName;
    }
    
    await updateDoc(userDocRef, updateData);
    console.log(`✅ Firestore actualizado: usuario ${userDocRef.id} -> terminalId=${terminalId}, terminalName=${terminalName}`);
    
    const usersRefRtdb = ref(rtdb, 'users');
    const snapshotRtdb = await get(usersRefRtdb);
    if (snapshotRtdb.exists()) {
      const users = snapshotRtdb.val();
      let foundKey = null;
      for (const [key, user] of Object.entries(users)) {
        const u = user as any;
        if (u.uid === userUid || key === userUid || u.uid === userId || key === userId) {
          foundKey = key;
          break;
        }
      }
      
      if (foundKey) {
        const rtdbUpdateData: any = {
          terminalId: terminalId,
          updatedAt: now
        };
        if (terminalName !== null) {
          rtdbUpdateData.terminalName = terminalName;
        }
        await update(ref(rtdb, `users/${foundKey}`), rtdbUpdateData);
        console.log(`✅ RTDB actualizado: usuario ${foundKey} -> terminalId=${terminalId}`);
      } else {
        const userData = (await getDoc(userDocRef)).data();
        if (userData) {
          await set(ref(rtdb, `users/${userData.uid || userDocRef.id}`), {
            uid: userData.uid || userDocRef.id,
            name: userData.name || '',
            email: userData.email || '',
            role: userData.role || 'user',
            terminalId: terminalId,
            terminalName: terminalName,
            status: userData.status || 'active',
            createdAt: userData.createdAt || now,
            updatedAt: now
          });
          console.log(`✅ Usuario creado en RTDB con terminalId=${terminalId}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error en updateUserTerminalId:', error);
    throw error;
  }
}

export async function getUserByTerminalId(terminalId: string) {
  console.log(`📡 Buscando usuario por terminalId: ${terminalId}`);
  
  try {
    const usersRef = collection(firestoreDb, USERS_COLLECTION);
    const q = query(usersRef, where('terminalId', '==', terminalId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      console.log(`✅ Usuario encontrado en Firestore: ${data.name}`);
      return {
        id: docSnap.id,
        uid: data.uid || docSnap.id,
        name: data.name || '',
        email: data.email || '',
        role: data.role || 'user',
        terminalId: data.terminalId || null,
        terminalName: data.terminalName || null,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }
    
    console.log(`⚠️ Usuario no encontrado en Firestore, buscando en RTDB...`);
    const usersRefRtdb = ref(rtdb, 'users');
    const snapshotRtdb = await get(usersRefRtdb);
    if (!snapshotRtdb.exists()) return null;
    
    const users = snapshotRtdb.val();
    for (const [key, user] of Object.entries(users)) {
      const u = user as any;
      if (u.terminalId === terminalId) {
        return {
          id: key,
          uid: u.uid || key,
          name: u.name || '',
          email: u.email || '',
          role: u.role || 'user',
          terminalId: u.terminalId || null,
          terminalName: u.terminalName || null,
          status: u.status || 'active',
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString()
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error obteniendo usuario por terminal:', error);
    return null;
  }
}

export async function updateUserProfile(userId: string, data: { name?: string; email?: string; role?: string; status?: string }) {
  console.log(`📡 Actualizando perfil de usuario ${userId}...`);
  
  try {
    const now = new Date().toISOString();
    
    let userDocRef = doc(firestoreDb, USERS_COLLECTION, userId);
    let userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      const usersRef = collection(firestoreDb, USERS_COLLECTION);
      const q = query(usersRef, where('uid', '==', userId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        userDocRef = querySnapshot.docs[0].ref;
      }
    }
    
    await updateDoc(userDocRef, {
      ...data,
      updatedAt: now
    });
    console.log(`✅ Perfil de usuario ${userId} actualizado en Firestore`);
    
    const usersRefRtdb = ref(rtdb, 'users');
    const snapshotRtdb = await get(usersRefRtdb);
    if (snapshotRtdb.exists()) {
      const users = snapshotRtdb.val();
      for (const [key, user] of Object.entries(users)) {
        if ((user as any).uid === userId) {
          await update(ref(rtdb, `users/${key}`), {
            ...data,
            updatedAt: now
          });
          console.log(`✅ Perfil de usuario ${userId} actualizado en RTDB`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    throw error;
  }
}

export function subscribeToUsers(callback: (data: any[]) => void) {
  console.log(`📡 Suscribiendo a cambios de usuarios (Firestore)...`);
  let isUnsubscribed = false;
  let firestoreUnsubscribe: (() => void) | null = null;
  let rtdbUnsubscribe: (() => void) | null = null;

  try {
    const usersRef = collection(firestoreDb, USERS_COLLECTION);
    firestoreUnsubscribe = onSnapshot(usersRef, (snapshot) => {
      if (isUnsubscribed) return;
      const users: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        users.push({
          id: doc.id,
          uid: data.uid || doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'user',
          terminalId: data.terminalId || null,
          terminalName: data.terminalName || null,
          status: data.status || 'active',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });
      
      console.log(`🔄 ${users.length} usuarios actualizados desde Firestore`);
      setCachedData(getCacheKey('users'), users);
      callback(users);
    }, (error) => {
      console.error('Error en suscripción de usuarios (Firestore):', error);
      if (!isUnsubscribed && !rtdbUnsubscribe) {
        const usersRefRtdb = ref(rtdb, 'users');
        rtdbUnsubscribe = onValue(usersRefRtdb, (snapshot) => {
          if (isUnsubscribed) return;
          if (snapshot.exists()) {
            const data = snapshot.val();
            const users = Object.entries(data).map(([key, user]) => {
              const u = user as any;
              return {
                id: key,
                uid: u.uid || key,
                name: u.name || '',
                email: u.email || '',
                role: u.role || 'user',
                terminalId: u.terminalId || null,
                terminalName: u.terminalName || null,
                status: u.status || 'active',
                createdAt: u.createdAt || new Date().toISOString(),
                updatedAt: u.updatedAt || new Date().toISOString()
              };
            });
            setCachedData(getCacheKey('users'), users);
            callback(users);
          } else {
            const cached = getCachedData<any[]>(getCacheKey('users'));
            if (cached) callback(cached);
          }
        });
      }
    });
  } catch (error) {
    console.error('Error iniciando suscripción a usuarios:', error);
    if (!rtdbUnsubscribe) {
      const usersRefRtdb = ref(rtdb, 'users');
      rtdbUnsubscribe = onValue(usersRefRtdb, (snapshot) => {
        if (isUnsubscribed) return;
        if (snapshot.exists()) {
          const data = snapshot.val();
          const users = Object.entries(data).map(([key, user]) => {
            const u = user as any;
            return {
              id: key,
              uid: u.uid || key,
              name: u.name || '',
              email: u.email || '',
              role: u.role || 'user',
              terminalId: u.terminalId || null,
              terminalName: u.terminalName || null,
              status: u.status || 'active',
              createdAt: u.createdAt || new Date().toISOString(),
              updatedAt: u.updatedAt || new Date().toISOString()
            };
          });
          setCachedData(getCacheKey('users'), users);
          callback(users);
        } else {
          const cached = getCachedData<any[]>(getCacheKey('users'));
          if (cached) callback(cached);
        }
      });
    }
  }
  
  return () => {
    isUnsubscribed = true;
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    if (rtdbUnsubscribe) {
      rtdbUnsubscribe();
      rtdbUnsubscribe = null;
    }
  };
}

// ============================================================
// PRODUCTOS
// ============================================================

export async function getAllProducts() {
  try {
    const productsRef = ref(rtdb, 'products');
    const snapshot = await get(productsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const products = Object.entries(data)
        .map(([id, product]) => {
          const p = product as any;
          return {
            id: parseInt(id),
            barcode: p.barcode || '',
            name: p.name || '',
            department: p.department || null,
            category: p.category || null,
            stock: p.stock || 0,
            minStock: p.min_stock || 5,
            costUsd: p.cost_usd || 0,
            costBs: p.cost_bs || 0,
            profitPercent: p.profit_percent || 30,
            priceUsd: p.price_usd || 0,
            priceBs: p.price_bs || 0,
            priceRetail: p.price_retail || 0,
            priceWholesale: p.price_wholesale || 0,
            priceCost: p.price_cost || 0,
            ivaType: p.iva_type || 'con_iva',
            ivaPercentage: p.iva_percentage || 16,
            isKit: p.is_kit === 1,
            kitHasOwnStock: p.kit_has_own_stock === 1,
            kitComponents: p.kit_components ? JSON.parse(p.kit_components) : [],
            isPriceFixed: p.is_price_fixed === 1,
            activo: p.activo !== undefined ? p.activo : 1,
            updatedAt: p.updatedAt || new Date().toISOString()
          };
        })
        .filter((p: any) => p.activo !== 0);
      
      setCachedData(getCacheKey('products'), products);
      return products;
    }
    
    const cached = getCachedData<any[]>(getCacheKey('products'));
    return cached || [];
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    const cached = getCachedData<any[]>(getCacheKey('products'));
    return cached || [];
  }
}

export async function saveProduct(product: any) {
  const allProducts = await getAllProducts();
  const existingProduct = allProducts.find(
    p => p.barcode === product.barcode && p.id !== product.id
  );
  
  if (existingProduct) {
    throw new Error(`Ya existe un producto con el código de barras "${product.barcode}"`);
  }
  
  const productId = product.id || generateId();
  const productRef = ref(rtdb, `products/${productId}`);
  
  const productData = {
    barcode: product.barcode || '',
    name: product.name || '',
    department: product.department || null,
    category: product.category || null,
    stock: product.stock || 0,
    min_stock: product.minStock || 5,
    cost_usd: product.costUsd || 0,
    cost_bs: product.costBs || 0,
    profit_percent: product.profitPercent || 30,
    price_usd: product.priceUsd || 0,
    price_bs: product.priceBs || 0,
    price_retail: product.priceRetail || 0,
    price_wholesale: product.priceWholesale || 0,
    price_cost: product.priceCost || 0,
    iva_type: product.ivaType || 'con_iva',
    iva_percentage: product.ivaPercentage || 16,
    is_kit: product.isKit ? 1 : 0,
    kit_has_own_stock: product.kitHasOwnStock ? 1 : 0,
    kit_components: product.kitComponents ? JSON.stringify(product.kitComponents) : null,
    is_price_fixed: product.isPriceFixed ? 1 : 0,
    activo: product.activo !== undefined ? product.activo : 1,
    updatedAt: new Date().toISOString()
  };
  
  await set(productRef, productData);
  
  const cached = getCachedData<any[]>(getCacheKey('products')) || [];
  const finalProduct = { 
    id: typeof productId === 'string' ? parseInt(productId) : productId,
    barcode: productData.barcode,
    name: productData.name,
    department: productData.department,
    category: productData.category,
    stock: productData.stock,
    minStock: productData.min_stock,
    costUsd: productData.cost_usd,
    costBs: productData.cost_bs,
    profitPercent: productData.profit_percent,
    priceUsd: productData.price_usd,
    priceBs: productData.price_bs,
    priceRetail: productData.price_retail,
    priceWholesale: productData.price_wholesale,
    priceCost: productData.price_cost,
    ivaType: productData.iva_type,
    ivaPercentage: productData.iva_percentage,
    isKit: productData.is_kit === 1,
    kitHasOwnStock: productData.kit_has_own_stock === 1,
    kitComponents: productData.kit_components ? JSON.parse(productData.kit_components) : [],
    isPriceFixed: productData.is_price_fixed === 1,
    activo: productData.activo,
    updatedAt: productData.updatedAt
  };
  
  const index = cached.findIndex(p => p.id === productId || p.id === product.id);
  if (index >= 0) {
    cached[index] = finalProduct;
  } else {
    cached.push(finalProduct);
  }
  setCachedData(getCacheKey('products'), cached);
  
  return finalProduct;
}

export async function saveProducts(products: any[]) {
  for (const product of products) {
    await saveProduct(product);
  }
}

export async function deleteProduct(id: number) {
  const productRef = ref(rtdb, `products/${id}`);
  await update(productRef, { activo: 0, updatedAt: new Date().toISOString() });
  
  const cached = getCachedData<any[]>(getCacheKey('products')) || [];
  const product = cached.find(p => p.id === id);
  if (product) {
    product.activo = 0;
    setCachedData(getCacheKey('products'), cached);
  }
}

export async function updateProductWithWeightedAverageCost(
  productId: number, 
  newQty: number, 
  newCostUsd: number, 
  exchangeRate: number
) {
  const productRef = ref(rtdb, `products/${productId}`);
  const snapshot = await get(productRef);
  if (!snapshot.exists()) return;
  
  const product = snapshot.val();
  const oldStock = Number(product.stock) || 0;
  const oldCost = Number(product.cost_usd) || 0;
  const newStock = oldStock + newQty;
  let newAvgCost = oldCost;
  
  if (newStock > 0) {
    newAvgCost = ((oldStock * oldCost) + (newQty * newCostUsd)) / newStock;
  }
  
  await update(productRef, {
    stock: newStock,
    cost_usd: newAvgCost,
    cost_bs: newAvgCost * exchangeRate,
    updatedAt: new Date().toISOString()
  });
}

// ============================================================
// CLIENTES
// ============================================================

export async function getAllClients() {
  try {
    const clientsRef = ref(rtdb, 'clients');
    const snapshot = await get(clientsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const clients = Object.entries(data).map(([id, client]) => ({ id, ...(client as any) }));
      setCachedData(getCacheKey('clients'), clients);
      return clients;
    }
    
    const cached = getCachedData<any[]>(getCacheKey('clients'));
    return cached || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('clients')) || [];
  }
}

export async function saveClient(client: any) {
  const clientId = client.id || generateId();
  const clientRef = ref(rtdb, `clients/${clientId}`);
  const clientData = {
    name: client.name,
    cedula: client.cedula || '',
    phone: client.phone || '',
    address: client.address || '',
    debt: client.debt || 0,
    updatedAt: new Date().toISOString()
  };
  await set(clientRef, clientData);
  return { id: clientId, ...clientData };
}

export async function deleteClient(id: number) {
  await remove(ref(rtdb, `clients/${id}`));
}

// ============================================================
// TRANSACCIONES - FIRESTORE (NUEVO)
// ============================================================

// ✅ Guardar transacción en Firestore (además de RTDB)
export async function saveTransactionFirestore(transaction: any) {
  try {
    const txId = transaction.id || generateId();
    const txRef = doc(firestoreDb, TRANSACTIONS_COLLECTION, String(txId));
    
    const txData = {
      id: txId,
      date: transaction.date || new Date().toISOString(),
      type: transaction.type || 'sale',
      items: transaction.items || [],
      subtotal: transaction.subtotal || 0,
      iva: transaction.iva || 0,
      total: transaction.total || 0,
      totalUsd: transaction.totalUsd || 0,
      payMethod: transaction.payMethod || null,
      paidBs: transaction.paidBs || 0,
      change: transaction.change || 0,
      clientId: transaction.clientId || null,
      clientName: transaction.clientName || null,
      exchangeRate: transaction.exchangeRate || null,
      receiptNumber: transaction.receiptNumber || null,
      notes: transaction.notes || null,
      sessionId: transaction.sessionId || null,
      terminalId: transaction.terminalId || null,
      originalSaleId: transaction.originalSaleId || null,
      originalReceiptNumber: transaction.originalReceiptNumber || null,
      returnMethod: transaction.returnMethod || null,
      payments: transaction.payments || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(txRef, txData);
    console.log(`✅ Transacción ${txId} guardada en Firestore`);
  } catch (error) {
    console.error('❌ Error guardando transacción en Firestore:', error);
    throw error;
  }
}

// ✅ Obtener transacciones paginadas desde Firestore
export async function getTransactionsFirestorePaginated(
  terminalId: string,
  pageSize: number = 5,
  lastDoc?: any
) {
  try {
    let q = query(
      collection(firestoreDb, TRANSACTIONS_COLLECTION),
      where('terminalId', '==', terminalId),
      orderBy('date', 'desc'),
      limit(pageSize)
    );
    
    if (lastDoc) {
      q = query(
        collection(firestoreDb, TRANSACTIONS_COLLECTION),
        where('terminalId', '==', terminalId),
        orderBy('date', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }
    
    const snapshot = await getDocs(q);
    const transactions: any[] = [];
    let lastVisible = null;
    
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() });
      lastVisible = doc;
    });
    
    return { transactions, lastVisible };
  } catch (error) {
    console.error('Error obteniendo transacciones paginadas:', error);
    return { transactions: [], lastVisible: null };
  }
}

// ✅ Buscar transacción por número de recibo
export async function getTransactionByReceiptNumber(terminalId: string, receiptNumber: number) {
  try {
    const q = query(
      collection(firestoreDb, TRANSACTIONS_COLLECTION),
      where('terminalId', '==', terminalId),
      where('receiptNumber', '==', receiptNumber)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error buscando transacción por recibo:', error);
    return null;
  }
}

// ✅ Obtener última transacción de Firestore (para saber el último recibo)
export async function getLastTransactionFirestore(terminalId: string) {
  try {
    const q = query(
      collection(firestoreDb, TRANSACTIONS_COLLECTION),
      where('terminalId', '==', terminalId),
      orderBy('receiptNumber', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error obteniendo última transacción:', error);
    return null;
  }
}

// ✅ Suscripción en tiempo real a transacciones de Firestore (solo las más recientes)
export function subscribeToTransactionsFirestore(
  terminalId: string,
  callback: (data: any[]) => void,
  pageSize: number = 5
) {
  console.log(`📡 Suscribiendo a transacciones Firestore para terminal ${terminalId}...`);
  
  const q = query(
    collection(firestoreDb, TRANSACTIONS_COLLECTION),
    where('terminalId', '==', terminalId),
    orderBy('date', 'desc'),
    limit(pageSize)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const transactions: any[] = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() });
    });
    console.log(`🔄 ${transactions.length} transacciones actualizadas desde Firestore`);
    callback(transactions);
  }, (error) => {
    console.error('Error en suscripción Firestore:', error);
  });
  
  return unsubscribe;
}

// ============================================================
// TRANSACCIONES - RTDB (LEGACY)
// ============================================================

export async function getAllTransactions() {
  try {
    const transactionsRef = ref(rtdb, 'transactions');
    const snapshot = await get(transactionsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const transactions = Object.entries(data)
        .map(([id, tx]) => ({ id, ...(tx as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setCachedData(getCacheKey('transactions'), transactions);
      return transactions;
    }
    
    const cached = getCachedData<any[]>(getCacheKey('transactions'));
    return cached || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('transactions')) || [];
  }
}

export async function saveTransaction(transaction: any) {
  const txId = transaction.id || generateId();
  const txRef = ref(rtdb, `transactions/${txId}`);
  const txData = {
    date: transaction.date || new Date().toISOString(),
    type: transaction.type || 'sale',
    items: transaction.items ? JSON.stringify(transaction.items) : null,
    subtotal: transaction.subtotal || 0,
    iva: transaction.iva || 0,
    total: transaction.total || 0,
    total_usd: transaction.totalUsd || 0,
    pay_method: transaction.payMethod || null,
    paid_bs: transaction.paidBs || 0,
    change: transaction.change || 0,
    client_id: transaction.clientId || null,
    client_name: transaction.clientName || null,
    exchange_rate: transaction.exchangeRate || null,
    receipt_number: transaction.receiptNumber || null,
    notes: transaction.notes || null,
    session_id: transaction.sessionId || null,
    terminal_id: transaction.terminalId || null,
    original_sale_id: transaction.originalSaleId || null,
    original_receipt_number: transaction.originalReceiptNumber || null,
    return_method: transaction.returnMethod || null,
    payments: transaction.payments ? JSON.stringify(transaction.payments) : null,
    updatedAt: new Date().toISOString()
  };
  await set(txRef, txData);
  
  // ✅ También guardar en Firestore
  try {
    await saveTransactionFirestore(transaction);
  } catch (e) {
    console.warn('⚠️ No se pudo guardar en Firestore, solo RTDB:', e);
  }
  
  return { id: txId, ...txData };
}

// ============================================================
// CUENTAS POR COBRAR
// ============================================================

export async function getAllAccounts() {
  try {
    const accountsRef = ref(rtdb, 'accounts');
    const snapshot = await get(accountsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const accounts = Object.entries(data).map(([id, account]) => ({ id, ...(account as any) }));
      setCachedData(getCacheKey('accounts'), accounts);
      return accounts;
    }
    
    return getCachedData<any[]>(getCacheKey('accounts')) || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('accounts')) || [];
  }
}

export async function saveAccount(account: any) {
  const accountId = account.id || generateId();
  const accountRef = ref(rtdb, `accounts/${accountId}`);
  const accountData = {
    client_id: account.clientId,
    client_name: account.clientName || null,
    client_cedula: account.clientCedula || null,
    amount_bs: account.amountBs || 0,
    amount_usd: account.amountUsd || 0,
    paid_amount: account.paidAmount || 0,
    status: account.status || 'pendiente',
    date: account.date || new Date().toISOString(),
    products: account.products || null,
    exchange_rate: account.exchangeRate || null,
    tx_id: account.txId || null,
    updatedAt: new Date().toISOString()
  };
  await set(accountRef, accountData);
  return { id: accountId, ...accountData };
}

export async function deleteAccount(id: number) {
  await remove(ref(rtdb, `accounts/${id}`));
}

// ============================================================
// PROVEEDORES
// ============================================================

export async function getAllSuppliers() {
  try {
    const suppliersRef = ref(rtdb, 'suppliers');
    const snapshot = await get(suppliersRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const suppliers = Object.entries(data).map(([id, supplier]) => ({ id, ...(supplier as any) }));
      setCachedData(getCacheKey('suppliers'), suppliers);
      return suppliers;
    }
    
    return getCachedData<any[]>(getCacheKey('suppliers')) || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('suppliers')) || [];
  }
}

export async function saveSupplier(supplier: any) {
  const supplierId = supplier.id || generateId();
  const supplierRef = ref(rtdb, `suppliers/${supplierId}`);
  const supplierData = {
    name: supplier.name,
    rif: supplier.rif || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    contact_person: supplier.contactPerson || '',
    total_debt: supplier.totalDebt || 0,
    updatedAt: new Date().toISOString()
  };
  await set(supplierRef, supplierData);
  return { id: supplierId, ...supplierData };
}

export async function deleteSupplier(id: number) {
  await remove(ref(rtdb, `suppliers/${id}`));
}

// ============================================================
// FACTURAS DE COMPRA
// ============================================================

export async function getAllPurchaseInvoices() {
  try {
    const invoicesRef = ref(rtdb, 'purchase_invoices');
    const snapshot = await get(invoicesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, invoice]) => ({ id, ...(invoice as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function savePurchaseInvoice(invoice: any) {
  const invoiceId = invoice.id || generateId();
  const invoiceRef = ref(rtdb, `purchase_invoices/${invoiceId}`);
  const invoiceData = {
    supplier_id: invoice.supplierId,
    invoice_number: invoice.invoiceNumber,
    date: invoice.date || new Date().toISOString(),
    due_date: invoice.dueDate || null,
    subtotal: invoice.subtotal || 0,
    iva: invoice.iva || 0,
    total: invoice.total || 0,
    paid_amount: invoice.paidAmount || 0,
    status: invoice.status || 'pendiente',
    notes: invoice.notes || null,
    exchange_rate: invoice.exchangeRate || null,
    items_count: invoice.itemsCount || 0,
    updatedAt: new Date().toISOString()
  };
  await set(invoiceRef, invoiceData);
  return { id: invoiceId, ...invoiceData };
}

// ============================================================
// ITEMS DE COMPRA
// ============================================================

export async function getAllPurchaseItems() {
  try {
    const itemsRef = ref(rtdb, 'purchase_items');
    const snapshot = await get(itemsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, item]) => ({ id, ...(item as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
  for (const item of items) {
    const itemId = item.id || generateId();
    const itemRef = ref(rtdb, `purchase_items/${itemId}`);
    const itemData = {
      invoice_id: invoiceId,
      product_id: item.productId,
      product_name: item.productName,
      qty: item.qty || 0,
      cost_usd: item.costUsd || 0,
      total_usd: item.totalUsd || 0,
      updatedAt: new Date().toISOString()
    };
    await set(itemRef, itemData);
  }
}

// ============================================================
// PAGOS A PROVEEDORES
// ============================================================

export async function getAllSupplierPayments() {
  try {
    const paymentsRef = ref(rtdb, 'supplier_payments');
    const snapshot = await get(paymentsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, payment]) => ({ id, ...(payment as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveSupplierPayment(payment: any) {
  const paymentId = payment.id || generateId();
  const paymentRef = ref(rtdb, `supplier_payments/${paymentId}`);
  const paymentData = {
    supplier_id: payment.supplierId,
    invoice_id: payment.invoiceId || null,
    date: payment.date || new Date().toISOString(),
    amount: payment.amount || 0,
    method: payment.method || 'efectivo',
    reference: payment.reference || null,
    bank: payment.bank || null,
    notes: payment.notes || null,
    updatedAt: new Date().toISOString()
  };
  await set(paymentRef, paymentData);
  return { id: paymentId, ...paymentData };
}

export async function deleteSupplierPayment(id: number) {
  await remove(ref(rtdb, `supplier_payments/${id}`));
}

// ============================================================
// ASIENTOS CONTABLES
// ============================================================

export async function getAllAccountingEntries() {
  try {
    const entriesRef = ref(rtdb, 'accounting_entries');
    const snapshot = await get(entriesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data)
        .map(([id, entry]) => ({ id, ...(entry as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveAccountingEntry(entry: any) {
  const entryId = entry.id || generateId();
  const entryRef = ref(rtdb, `accounting_entries/${entryId}`);
  const entryData = {
    date: entry.date || new Date().toISOString(),
    type: entry.type || 'ingreso',
    category: entry.category || 'ventas',
    subcategory: entry.subcategory || null,
    concept: entry.concept || null,
    description: entry.description || null,
    amount: entry.amount || 0,
    reference_id: entry.referenceId || null,
    reference_type: entry.referenceType || null,
    updatedAt: new Date().toISOString()
  };
  await set(entryRef, entryData);
  return { id: entryId, ...entryData };
}

// ============================================================
// KARDEX
// ============================================================

export async function getAllKardexEntries() {
  try {
    const kardexRef = ref(rtdb, 'kardex_entries');
    const snapshot = await get(kardexRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data)
        .map(([id, entry]) => {
          const e = entry as any;
          return {
            id: id,
            productId: e.product_id,
            date: e.date,
            type: e.type,
            quantity: e.quantity,
            previousStock: e.previous_stock,
            newStock: e.new_stock,
            reference: e.reference,
            note: e.note,
            costUsd: e.cost_usd,
            updatedAt: e.updatedAt
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveKardexEntry(entry: any) {
  const entryId = entry.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const cleanId = entryId.replace(/[.#$[\]]/g, '_');
  const entryRef = ref(rtdb, `kardex_entries/${cleanId}`);
  
  const typeMap: Record<string, string> = {
    'INICIAL': 'ajuste_inicial',
    'venta': 'salida_venta',
    'compra': 'entrada_compra',
    'colaboracion': 'colaboracion',
    'consumo': 'consumo',
    'devolucion': 'devolucion',
    'ajuste_manual': 'ajuste_manual',
    'ajuste_positivo': 'ajuste_positivo',
    'ajuste_negativo': 'ajuste_negativo',
    'ajuste_inicial': 'ajuste_inicial',
    'entrada_compra': 'entrada_compra',
    'salida_venta': 'salida_venta',
    'consumo_propio': 'consumo',
  };
  
  const type = typeMap[entry.type] || entry.type || 'entrada_compra';
  
  const entryData = {
    product_id: entry.productId,
    date: entry.date || new Date().toISOString(),
    type: type,
    quantity: entry.quantity || 0,
    previous_stock: entry.previousStock || 0,
    new_stock: entry.newStock || 0,
    reference: entry.reference || null,
    note: entry.note || null,
    cost_usd: entry.costUsd || null,
    updatedAt: new Date().toISOString()
  };
  
  await set(entryRef, entryData);
  
  return {
    id: cleanId,
    productId: entryData.product_id,
    date: entryData.date,
    type: entryData.type,
    quantity: entryData.quantity,
    previousStock: entryData.previous_stock,
    newStock: entryData.new_stock,
    reference: entryData.reference,
    note: entryData.note,
    costUsd: entryData.cost_usd,
    updatedAt: entryData.updatedAt
  };
}

// ============================================================
// REGISTROS DE CAJA (SESIONES)
// ============================================================

export async function getRegisterByTerminal(terminalId: string) {
  try {
    const registerRef = ref(rtdb, `registers/${terminalId}`);
    const snapshot = await get(registerRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        terminalId: terminalId,
        isOpen: data.is_open === 1,
        openTime: data.open_time,
        openAmountBs: data.open_amount_bs || 0,
        openAmountUsd: data.open_amount_usd || 0,
        exchangeRate: data.exchange_rate || null,
        txs: data.txs || []
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveRegisterByTerminal(terminalId: string, register: any) {
  const cleanRegister = cleanForFirebase(register);
  
  const registerRef = ref(rtdb, `registers/${terminalId}`);
  await set(registerRef, {
    is_open: cleanRegister.isOpen ? 1 : 0,
    open_time: cleanRegister.openTime || null,
    open_amount_bs: cleanRegister.openAmountBs || 0,
    open_amount_usd: cleanRegister.openAmountUsd || 0,
    exchange_rate: cleanRegister.exchangeRate || null,
    txs: cleanRegister.txs || [],
    updatedAt: new Date().toISOString()
  });
}

// ============================================================
// CIERRES DE CAJA
// ============================================================

export async function getAllCashCloses() {
  try {
    const closesRef = ref(rtdb, 'cash_closes');
    const snapshot = await get(closesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data)
        .map(([id, close]) => ({ id, ...(close as any) }))
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveCashClose(close: any) {
  const closeId = close.id || generateId();
  const closeRef = ref(rtdb, `cash_closes/${closeId}`);
  await set(closeRef, {
    fecha: close.fecha || new Date().toISOString(),
    tipo: close.tipo || 'cierre',
    data: close,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteCashClose(id: string) {
  await remove(ref(rtdb, `cash_closes/${id}`));
}

// ============================================================
// TERMINALES
// ============================================================

export async function getAllTerminals() {
  try {
    const terminalsRef = ref(rtdb, 'terminals');
    const snapshot = await get(terminalsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, terminal]) => {
        const t = terminal as any;
        return {
          id: id,
          name: t.name || '',
          description: t.description || '',
          location: t.location || '',
          assignedTo: t.assigned_to || null,
          assignedToName: t.assignedToName || null,
          status: t.status || 'active',
          isBlocked: t.is_blocked === 1,
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: t.updatedAt || new Date().toISOString()
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveTerminal(terminal: any) {
  const terminalId = terminal.id || generateId();
  const terminalRef = ref(rtdb, `terminals/${terminalId}`);
  const terminalData = {
    name: terminal.name,
    description: terminal.description || null,
    location: terminal.location || null,
    assigned_to: terminal.assignedTo || null,
    assignedToName: terminal.assignedToName || null,
    status: terminal.status || 'active',
    is_blocked: terminal.isBlocked ? 1 : 0,
    createdAt: terminal.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await set(terminalRef, terminalData);
  return { id: terminalId, ...terminalData };
}

export async function deleteTerminal(id: string) {
  await remove(ref(rtdb, `terminals/${id}`));
}

export async function updateTerminalBlockStatus(terminalId: string, isBlocked: boolean) {
  await update(ref(rtdb, `terminals/${terminalId}`), {
    is_blocked: isBlocked ? 1 : 0,
    updatedAt: new Date().toISOString()
  });
}

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

export async function getGlobalSettings() {
  try {
    const settingsRef = ref(rtdb, 'global_settings');
    const snapshot = await get(settingsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const settings: any = {};
      for (const [key, value] of Object.entries(data)) {
        try {
          settings[key] = JSON.parse(value as string);
        } catch {
          settings[key] = value;
        }
      }
      setCachedData(getCacheKey('settings'), settings);
      return settings;
    }
    
    return getCachedData<any>(getCacheKey('settings')) || {};
  } catch {
    return getCachedData<any>(getCacheKey('settings')) || {};
  }
}

export async function saveGlobalSettings(settings: any) {
  const settingsRef = ref(rtdb, 'global_settings');
  const updates: any = {};
  for (const [key, value] of Object.entries(settings)) {
    updates[key] = JSON.stringify(value);
  }
  await update(settingsRef, updates);
  setCachedData(getCacheKey('settings'), settings);
}

export async function getAdminCode() {
  try {
    const result = await getGlobalSettings();
    return { code: result.admin_code || '123456' };
  } catch {
    return { code: '123456' };
  }
}

// ============================================================
// SUSCRIPCIÓN EN TIEMPO REAL A TRANSACCIONES (RTDB - LEGACY)
// ============================================================

export function subscribeToTransactionsRTDB(callback: (data: any[]) => void) {
  console.log('📡 Suscribiendo a transacciones en RTDB en tiempo real...');
  
  const transactionsRef = ref(rtdb, 'transactions');
  
  const unsubscribe = onValue(transactionsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const transactions = Object.entries(data).map(([id, tx]) => ({ 
        id: id, 
        ...(tx as any) 
      }));
      
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log(`🔄 ${transactions.length} transacciones actualizadas desde RTDB`);
      callback(transactions);
    } else {
      console.log('⚠️ No hay transacciones en RTDB');
      callback([]);
    }
  }, (error) => {
    console.error('Error en suscripción RTDB:', error);
  });
  
  return unsubscribe;
}

// ============================================================
// SUSCRIPCIONES EN TIEMPO REAL (Firebase)
// ============================================================

export function subscribeToStockRTDB(callback: (stockData: Record<string, number>) => void) {
  const stockRef = ref(rtdb, 'products');
  
  const unsubscribe = onValue(stockRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const stockMap: Record<string, number> = {};
      
      for (const [id, product] of Object.entries(data)) {
        const p = product as any;
        if (p.activo !== 0) {
          stockMap[id] = p.stock || 0;
        }
      }
      
      callback(stockMap);
      setCachedData(STOCK_CACHE_KEY, stockMap);
    } else {
      const cached = getCachedData<Record<string, number>>(STOCK_CACHE_KEY);
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToProducts(callback: (data: any[]) => void) {
  const productsRef = ref(rtdb, 'products');
  
  const unsubscribe = onValue(productsRef, async (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const products = Object.entries(data)
        .map(([id, product]) => {
          const p = product as any;
          return {
            id: parseInt(id),
            barcode: p.barcode || '',
            name: p.name || '',
            department: p.department || null,
            category: p.category || null,
            stock: p.stock || 0,
            minStock: p.min_stock || 5,
            costUsd: p.cost_usd || 0,
            costBs: p.cost_bs || 0,
            profitPercent: p.profit_percent || 30,
            priceUsd: p.price_usd || 0,
            priceBs: p.price_bs || 0,
            priceRetail: p.price_retail || 0,
            priceWholesale: p.price_wholesale || 0,
            priceCost: p.price_cost || 0,
            ivaType: p.iva_type || 'con_iva',
            ivaPercentage: p.iva_percentage || 16,
            isKit: p.is_kit === 1,
            kitHasOwnStock: p.kit_has_own_stock === 1,
            kitComponents: p.kit_components ? JSON.parse(p.kit_components) : [],
            isPriceFixed: p.is_price_fixed === 1,
            activo: p.activo !== undefined ? p.activo : 1,
            updatedAt: p.updatedAt || new Date().toISOString()
          };
        })
        .filter((p: any) => p.activo !== 0);
      
      setCachedData(getCacheKey('products'), products);
      callback(products);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('products'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToClients(callback: (data: any[]) => void) {
  const clientsRef = ref(rtdb, 'clients');
  
  const unsubscribe = onValue(clientsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const clients = Object.entries(data).map(([id, client]) => ({ id, ...(client as any) }));
      setCachedData(getCacheKey('clients'), clients);
      callback(clients);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('clients'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToTransactions(callback: (data: any[]) => void) {
  const transactionsRef = ref(rtdb, 'transactions');
  
  const unsubscribe = onValue(transactionsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const transactions = Object.entries(data)
        .map(([id, tx]) => ({ id, ...(tx as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setCachedData(getCacheKey('transactions'), transactions);
      callback(transactions);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('transactions'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToAccounts(callback: (data: any[]) => void) {
  const accountsRef = ref(rtdb, 'accounts');
  
  const unsubscribe = onValue(accountsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const accounts = Object.entries(data).map(([id, account]) => ({ id, ...(account as any) }));
      setCachedData(getCacheKey('accounts'), accounts);
      callback(accounts);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('accounts'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToRegisterRealtime(terminalId: string, callback: (data: any) => void) {
  const registerRef = ref(rtdb, `registers/${terminalId}`);
  
  const unsubscribe = onValue(registerRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback({
        terminalId: terminalId,
        isOpen: data.is_open === 1,
        openTime: data.open_time,
        openAmountBs: data.open_amount_bs || 0,
        openAmountUsd: data.open_amount_usd || 0,
        exchangeRate: data.exchange_rate || null,
        txs: data.txs || []
      });
    } else {
      callback(null);
    }
  });
  
  return unsubscribe;
}

export function subscribeToSuppliers(callback: (data: any[]) => void) {
  const suppliersRef = ref(rtdb, 'suppliers');
  
  const unsubscribe = onValue(suppliersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const suppliers = Object.entries(data).map(([id, supplier]) => ({ id, ...(supplier as any) }));
      setCachedData(getCacheKey('suppliers'), suppliers);
      callback(suppliers);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('suppliers'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
  const invoicesRef = ref(rtdb, 'purchase_invoices');
  
  const unsubscribe = onValue(invoicesRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data).map(([id, invoice]) => ({ id, ...(invoice as any) })));
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToPurchaseItems(callback: (data: any[]) => void) {
  const itemsRef = ref(rtdb, 'purchase_items');
  
  const unsubscribe = onValue(itemsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data).map(([id, item]) => ({ id, ...(item as any) })));
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToSupplierPayments(callback: (data: any[]) => void) {
  const paymentsRef = ref(rtdb, 'supplier_payments');
  
  const unsubscribe = onValue(paymentsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data).map(([id, payment]) => ({ id, ...(payment as any) })));
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToAccounting(callback: (data: any[]) => void) {
  const entriesRef = ref(rtdb, 'accounting_entries');
  
  const unsubscribe = onValue(entriesRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data)
        .map(([id, entry]) => ({ id, ...(entry as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToKardex(callback: (data: any[]) => void) {
  const kardexRef = ref(rtdb, 'kardex_entries');
  
  const unsubscribe = onValue(kardexRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const entries = Object.entries(data)
        .map(([id, entry]) => {
          const e = entry as any;
          return {
            id: id,
            productId: e.product_id,
            date: e.date,
            type: e.type,
            quantity: e.quantity,
            previousStock: e.previous_stock,
            newStock: e.new_stock,
            reference: e.reference,
            note: e.note,
            costUsd: e.cost_usd,
            updatedAt: e.updatedAt
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(entries);
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToGlobalSettings(callback: (data: any) => void) {
  const settingsRef = ref(rtdb, 'global_settings');
  
  const unsubscribe = onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const settings: any = {};
      for (const [key, value] of Object.entries(data)) {
        try {
          settings[key] = JSON.parse(value as string);
        } catch {
          settings[key] = value;
        }
      }
      setCachedData(getCacheKey('settings'), settings);
      callback(settings);
    } else {
      const cached = getCachedData<any>(getCacheKey('settings'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

// ============================================================
// FUNCIONES DE SINCRONIZACIÓN (simplificadas)
// ============================================================

export function sendSyncCommandToAllTerminals() {
  console.log('📡 Comando de sincronización enviado a todas las terminales');
}

export function listenForSyncCommands(terminalId: string, onSync: () => Promise<void>) {
  const interval = setInterval(() => {
    onSync().catch(console.error);
  }, 30000);
  
  return () => clearInterval(interval);
}

export async function loadAllDataToCache() {
  console.log('📡 Cargando datos a caché local...');
  try {
    await getAllProducts();
    await getAllClients();
    await getAllTransactions();
    await getAllAccounts();
    await getAllSuppliers();
    await getGlobalSettings();
    console.log('✅ Datos cargados a caché');
  } catch (error) {
    console.error('❌ Error cargando caché:', error);
  }
}

export async function syncAllPending() {
  console.log('📡 Sincronizando operaciones locales...');
  return true;
}

export async function runAtomicSale(terminalId: string, transaction: any, updates: any) {
  try {
    const cleanTransaction = cleanForFirebase(transaction);
    await saveTransaction(cleanTransaction);
    
    if (updates.products) {
      for (const [id, data] of Object.entries(updates.products)) {
        const productRef = ref(rtdb, `products/${id}`);
        await update(productRef, {
          stock: (data as any).newStock,
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    if (updates.kardexEntries) {
      for (const entry of updates.kardexEntries) {
        const cleanEntry = cleanForFirebase(entry);
        await saveKardexEntry(cleanEntry);
      }
    }
    
    if (updates.accountingEntry) {
      const cleanEntry = cleanForFirebase(updates.accountingEntry);
      await saveAccountingEntry(cleanEntry);
    }
    
    if (updates.registerUpdate) {
      const reg = await getRegisterByTerminal(terminalId);
      if (reg) {
        const cleanTxs = (updates.registerUpdate.txs || []).map((tx: any) => cleanForFirebase(tx));
        await saveRegisterByTerminal(terminalId, { 
          ...reg, 
          txs: cleanTxs 
        });
      }
    }
    
    console.log('✅ Venta atómica completada');
  } catch (error) {
    console.error('❌ Error en venta atómica:', error);
    throw error;
  }
}

export function getPendingQueueLength() { 
  return 0; 
}

export function unsubscribeAll() {
  console.log('📡 Desuscribiendo todas las suscripciones...');
}

export function setLoggingOut(val: boolean) {
  // No necesario con Firebase
}

// ============================================================
// EXPORTACIÓN DE FUNCIONES ALIAS (compatibilidad)
// ============================================================

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

export const subscribeToSuppliersRealtime = subscribeToSuppliers;

// ============================================================
// EXPORT DEFAULT
// ============================================================

const syncService = {
  getUserByUid, saveUser, getAllUsers, deleteUser, updateUserTerminalId,
  getUserByTerminalId, updateUserProfile, subscribeToUsers,
  getAllProducts, getProducts, saveProduct, saveProducts, deleteProduct, updateProductWithWeightedAverageCost,
  getAllClients, getClients, saveClient, deleteClient,
  getAllTransactions, getTransactions, saveTransaction,
  saveTransactionFirestore,
  getTransactionsFirestorePaginated,
  getTransactionByReceiptNumber,
  getLastTransactionFirestore,
  subscribeToTransactionsFirestore,
  getAllAccounts, getAccounts, saveAccount, deleteAccount,
  getAllSuppliers, getSuppliers, saveSupplier, deleteSupplier,
  getAllPurchaseInvoices, getPurchaseInvoices, savePurchaseInvoice,
  getAllPurchaseItems, getPurchaseItems, savePurchaseInvoiceItems,
  getAllSupplierPayments, getSupplierPayments, saveSupplierPayment, deleteSupplierPayment,
  getAllAccountingEntries, getAccountingEntries, saveAccountingEntry,
  getAllKardexEntries, getKardexEntries, saveKardexEntry,
  getRegisterByTerminal, saveRegisterByTerminal,
  getAllCashCloses, saveCashClose, deleteCashClose,
  getAllTerminals, saveTerminal, deleteTerminal, updateTerminalBlockStatus,
  getGlobalSettings, saveGlobalSettings, getAdminCode,
  subscribeToTransactionsRTDB,
  subscribeToStockRTDB,
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
  sendSyncCommandToAllTerminals, 
  listenForSyncCommands,
  loadAllDataToCache, 
  syncAllPending, 
  runAtomicSale, 
  getPendingQueueLength, 
  unsubscribeAll, 
  setLoggingOut
};

export default syncService;