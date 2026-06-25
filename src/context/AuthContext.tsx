"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import syncService from '@/services/syncService';

interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'cashier';
  terminalId?: string;
  terminalName?: string;
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

  // Restaurar sesión desde sessionStorage al iniciar (síncrono)
  useEffect(() => {
    const stored = sessionStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setLoading(false);
      } catch (e) {
        console.error('Error parsing sessionStorage user', e);
      }
    } else {
      setLoading(true); // Esperamos a Firebase
    }
  }, []);

  // Manejo de autenticación con Firebase
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Si ya tenemos usuario en sessionStorage y coincide con el UID, no hacemos nada
      const storedUser = sessionStorage.getItem('user');
      if (storedUser && firebaseUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed.uid === firebaseUser.uid) {
            setLoading(false);
            return;
          }
        } catch (e) {}
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: data.name || firebaseUser.displayName || 'Usuario',
            role: data.role === 'admin' ? 'admin' : 'cashier',
            terminalId: data.terminalId,
            terminalName: data.terminalName,
          };
          sessionStorage.setItem('user', JSON.stringify(appUser));
          setUser(appUser);
          setLoading(false);
        } else {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          const isFirstUser = allUsersSnap.empty;

          if (isFirstUser) {
            const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Administrador';
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name,
              role: 'admin',
              terminalId: undefined,
              terminalName: undefined,
            };
            await setDoc(userRef, {
              ...newUser,
              createdAt: new Date().toISOString(),
              updatedAt: Date.now(),
            });
            sessionStorage.setItem('user', JSON.stringify(newUser));
            setUser(newUser);
            setLoading(false);
          } else {
            console.error('Usuario sin documento en Firestore:', firebaseUser.email);
            await auth.signOut();
            sessionStorage.removeItem('user');
            setUser(null);
            setLoading(false);
          }
        }
      } else {
        sessionStorage.removeItem('user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Suscripción en tiempo real a cambios del usuario
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeSnapshot = onSnapshot(
      doc(db, 'users', user.uid),
      (docSnap: any) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser((prevUser) => {
            if (!prevUser) return prevUser;
            const newTerminalId = data.terminalId;
            const newTerminalName = data.terminalName;
            const newRole: 'admin' | 'cashier' = data.role === 'admin' ? 'admin' : 'cashier';
            const newName = data.name || prevUser.name;
            
            if (
              prevUser.terminalId !== newTerminalId ||
              prevUser.terminalName !== newTerminalName ||
              prevUser.role !== newRole ||
              prevUser.name !== newName
            ) {
              const updated = { ...prevUser, terminalId: newTerminalId, terminalName: newTerminalName, role: newRole, name: newName };
              sessionStorage.setItem('user', JSON.stringify(updated));
              return updated;
            }
            return prevUser;
          });
        }
      },
      (error: any) => {
        console.error('Error en snapshot del usuario:', error);
      }
    );

    return () => unsubscribeSnapshot();
  }, [user?.uid]);

  // ✅ Cargar sesión activa - CORREGIDO usando getRegisterByTerminal
  useEffect(() => {
    if (!user?.terminalId) {
      setActiveSession(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        // ✅ Usar getRegisterByTerminal en lugar de getActiveSessionByTerminal
        const registerData = await syncService.getRegisterByTerminal(user.terminalId!);
        if (mounted) {
          // Convertir el registro en una sesión
          if (registerData && registerData.isOpen) {
            const session = {
              id: `${user.terminalId}_${registerData.openTime}`,
              terminalId: user.terminalId,
              userId: user.uid,
              startTime: registerData.openTime,
              initialAmountUsd: registerData.openAmountUsd || 0,
              finalAmountUsd: 0,
              status: 'open',
              totalSales: registerData.txs?.length || 0,
              exchangeRate: registerData.exchangeRate || 0,
            };
            if (setActiveSession) setActiveSession(session);
          } else {
            setActiveSession(null);
          }
        }
      } catch (error) {
        console.error('Error al cargar sesión activa:', error);
        if (mounted) setActiveSession(null);
      }
    })();
    return () => { mounted = false; };
  }, [user?.terminalId, user?.uid]);

  // Redirección centralizada
  useEffect(() => {
    if (loading) return;

    // Normalizamos el pathname quitando la barra final si existe (excepto para la raíz)
    const currentPath = pathname === '/' ? '/' : pathname?.replace(/\/$/, '') || '';
    const isLoginPage = currentPath === '/login';
    const isErrorPage = currentPath.includes('error');

    if (!user) {
      if (!isLoginPage && !isErrorPage) {
        // Redirigir al login si no hay usuario y no estamos ya en el login
        router.push('/login');
      }
    } else {
      if (isLoginPage) {
        // Redirigir a la raíz si hay usuario y estamos en el login
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  const logout = async () => {
    if (auth) {
      await auth.signOut();
    }
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
    setUser(null);
    setActiveSession(null);
    router.push('/login');
  };

  // ✅ Recargar sesión activa - CORREGIDO
  const reloadActiveSession = async () => {
    if (!user?.terminalId) {
      setActiveSession(null);
      return;
    }
    try {
      const registerData = await syncService.getRegisterByTerminal(user.terminalId);
      if (registerData && registerData.isOpen) {
        const session = {
          id: `${user.terminalId}_${registerData.openTime}`,
          terminalId: user.terminalId,
          userId: user.uid,
          startTime: registerData.openTime,
          initialAmountUsd: registerData.openAmountUsd || 0,
          finalAmountUsd: 0,
          status: 'open',
          totalSales: registerData.txs?.length || 0,
          exchangeRate: registerData.exchangeRate || 0,
        };
        setActiveSession(session);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Error al recargar sesión activa:', error);
      setActiveSession(null);
    }
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