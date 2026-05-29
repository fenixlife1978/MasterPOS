"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { syncService } from '@/services/syncService';

interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'cashier';
  terminalId?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => void;
  activeSession: any | null;
  reloadActiveSession: () => Promise<void>;
  setActiveSession: (session: any | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  activeSession: null,
  reloadActiveSession: async () => {},
  setActiveSession: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const reloadActiveSession = async () => {
    if (!user?.terminalId) {
      setActiveSession(null);
      return;
    }
    try {
      const session = await syncService.getActiveSessionByTerminal(user.terminalId);
      setActiveSession(session);
    } catch (error) {
      console.error('Error al cargar sesión activa:', error);
      setActiveSession(null);
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Obtener datos iniciales del usuario desde Firestore
        let terminalId: string | undefined;
        let userRole: 'admin' | 'cashier' = 'cashier';
        let userName = firebaseUser.displayName || 'Usuario';
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            terminalId = data.terminalId;
            userRole = data.role === 'admin' ? 'admin' : 'cashier';
            userName = data.name || firebaseUser.displayName || 'Usuario';
          }
        } catch (error) {
          console.error('Error al cargar datos del usuario:', error);
        }

        const stored = localStorage.getItem('user');
        let appUser: AppUser;
        if (stored) {
          const parsed = JSON.parse(stored);
          appUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: parsed.name || userName,
            role: parsed.role || userRole,
            terminalId: terminalId || parsed.terminalId,
          };
        } else {
          appUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: userName,
            role: userRole,
            terminalId: terminalId,
          };
        }
        setUser(appUser);
        
        // Cargar sesión activa inicial
        if (appUser.terminalId) {
          try {
            const session = await syncService.getActiveSessionByTerminal(appUser.terminalId);
            setActiveSession(session);
          } catch (error) {
            console.error('Error al cargar sesión activa inicial:', error);
          }
        }
      } else {
        setUser(null);
        setActiveSession(null);
        localStorage.removeItem('user');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // ✅ Suscripción en tiempo real a los cambios del usuario (Firestore)
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeSnapshot = onSnapshot(
      doc(db, 'users', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser((prevUser) => {
            if (!prevUser) return prevUser;
            // Solo actualizar si hubo cambios relevantes
            const newTerminalId = data.terminalId;
            const newRole = data.role === 'admin' ? 'admin' : 'cashier';
            const newName = data.name || prevUser.name;
            
            if (
              prevUser.terminalId !== newTerminalId ||
              prevUser.role !== newRole ||
              prevUser.name !== newName
            ) {
              return {
                ...prevUser,
                terminalId: newTerminalId,
                role: newRole,
                name: newName,
              };
            }
            return prevUser;
          });
        }
      },
      (error) => {
        console.error('Error en snapshot del usuario:', error);
      }
    );

    return () => unsubscribeSnapshot();
  }, [user?.uid]);

  // Recargar sesión activa cuando cambia el terminalId del usuario (después de actualización en tiempo real)
  useEffect(() => {
    if (user?.terminalId) {
      reloadActiveSession();
    } else {
      setActiveSession(null);
    }
  }, [user?.terminalId]);

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
    setActiveSession(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      logout, 
      activeSession, 
      reloadActiveSession,
      setActiveSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);