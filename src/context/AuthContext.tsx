"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'cashier';
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

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: parsed.name || firebaseUser.displayName || 'Usuario',
            role: parsed.role || 'cashier',
          });
        } else {
          // CORRECCIÓN 1: Si Firebase ya dio luz verde pero el localStorage está tardando en responder,
          // creamos un estado temporal seguro para evitar que el usuario quede en 'null' y rompa el flujo.
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || 'Usuario',
            role: 'cashier', 
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
    // CORRECCIÓN 2: En entornos estáticos de Electron, evaluamos si la ruta contiene 'login' 
    // en lugar de una igualdad estricta, protegiéndonos de extensiones '.html' o barras diagonales extras.
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