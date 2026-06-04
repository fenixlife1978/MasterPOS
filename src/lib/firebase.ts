import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD7PWLMAPr5ScolLbGH9jNwqhbo87eTkOs",
  authDomain: "studio-4680897398-2fbf7.firebaseapp.com",
  databaseURL: "https://studio-4680897398-2fbf7-default-rtdb.firebaseio.com",
  projectId: "studio-4680897398-2fbf7",
  storageBucket: "studio-4680897398-2fbf7.firebasestorage.app",
  messagingSenderId: "564842254644",
  appId: "1:564842254644:web:f79a7dcd1a1997b2ca5561"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const isClient = typeof window !== 'undefined';

const db = isClient ? getFirestore(app) : null as any;
const rtdb = isClient ? getDatabase(app) : null as any;
const auth = isClient ? getAuth(app) : null as any;

if (isClient && auth) {
  setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Error al configurar persistencia de autenticación:", error);
  });
}

export { db, rtdb, auth, firebaseConfig };
export default app;
