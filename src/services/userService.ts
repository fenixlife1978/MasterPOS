import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'cashier';
  status: 'active' | 'inactive';
  createdAt: string;
}

const USERS_COLLECTION = 'users';

export const userService = {
  // Crear usuario
  async createUser(user: AppUser): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    await setDoc(userRef, user);
  },

  // Obtener usuario por ID
  async getUserById(id: string): Promise<AppUser | null> {
    const userRef = doc(db, USERS_COLLECTION, id);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? (docSnap.data() as AppUser) : null;
  },

  // Obtener usuario por email
  async getUserByEmail(email: string): Promise<AppUser | null> {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    return querySnapshot.docs[0].data() as AppUser;
  },

  // Obtener todos los usuarios
  async getAllUsers(): Promise<AppUser[]> {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    return querySnapshot.docs.map(doc => doc.data() as AppUser);
  },

  // Actualizar usuario
  async updateUser(id: string, data: Partial<AppUser>): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, id);
    await updateDoc(userRef, data);
  },

  // Eliminar usuario
  async deleteUser(id: string): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, id);
    await deleteDoc(userRef);
  },
};
