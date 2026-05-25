"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'cashier';
  terminalId?: string; // ✅ Terminal asignada al usuario
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Obtener terminalId desde Firestore (colección 'users')
        let terminalId: string | undefined;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            terminalId = userDoc.data().terminalId;
          }
        } catch (error) {
          console.error('Error al cargar terminalId del usuario:', error);
        }

        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: parsed.name || firebaseUser.displayName || 'Usuario',
            role: parsed.role || 'cashier',
            terminalId: terminalId || parsed.terminalId,
          });
        } else {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || 'Usuario',
            role: 'cashier',
            terminalId: terminalId,
          });
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const isLoginPage = pathname?.includes('/login');
    if (!loading && !user && !isLoginPage) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  const logout = () => {
    if (auth) {
      auth.signOut();
    }
    localStorage.removeItem('user');
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);