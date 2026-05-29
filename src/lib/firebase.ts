import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const isClient = typeof window !== 'undefined';

const db = isClient ? getFirestore(app) : null as any;
const auth = isClient ? getAuth(app) : null as any;

// Configurar persistencia por pestaña (sessionStorage) solo en el cliente
if (isClient && auth) {
  setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Error al configurar persistencia de autenticación:", error);
  });
}

export { db, auth, firebaseConfig };
export default app;