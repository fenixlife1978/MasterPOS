"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Building2, Store, Key, Mail, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, rtdb } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, get, child } from 'firebase/database';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'admin' | 'cashier'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Usamos sessionStorage para ser coherentes con el AuthContext
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      router.replace('/');
    }
  }, [router]);

  // Función para obtener usuario de Firebase Realtime Database
  const getUserFromFirebase = async (uid: string) => {
    try {
      const usersRef = ref(rtdb, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      const users = snapshot.val();
      for (const [key, user] of Object.entries(users)) {
        const userData = user as any;
        if (userData.uid === uid) {
          return {
            id: key,
            uid: userData.uid,
            name: userData.name || 'Usuario',
            email: userData.email || '',
            role: userData.role || 'cashier',
            terminalId: userData.terminalId || null,
            status: userData.status || 'active'
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo usuario de Firebase:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError('Firebase no está disponible');
      return;
    }
    setError('');
    setIsLoading(true);
    
    try {
      // 1. Autenticar con Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const uid = firebaseUser.uid;

      // 2. Obtener el rol y nombre desde Firebase Realtime Database
      const userData = await getUserFromFirebase(uid);
      
      if (!userData) {
        // Si no existe en la base de datos, crear un usuario por defecto
        // (esto es útil para la primera vez o para pruebas)
        const defaultRole = mode === 'admin' ? 'admin' : 'cashier';
        const defaultUser = {
          uid: uid,
          name: firebaseUser.displayName || email.split('@')[0] || 'Usuario',
          email: firebaseUser.email || email,
          role: defaultRole,
          terminalId: null,
          status: 'active'
        };
        
        // Guardar el usuario en Firebase Realtime Database
        const { saveUser } = await import('@/services/syncService');
        await saveUser(defaultUser);
        
        // Usar los datos por defecto
        const userRole = defaultRole;
        const userName = defaultUser.name;

        // Verificar permisos según el modo seleccionado
        if (mode === 'admin' && userRole !== 'admin') {
          setError('Esta cuenta no tiene permisos de administrador');
          setIsLoading(false);
          return;
        }
        
        if (mode === 'cashier' && userRole !== 'cashier') {
          setError('Esta cuenta no tiene permisos de cajero');
          setIsLoading(false);
          return;
        }
        
        // Guardar en sessionStorage
        const appUser = { 
          name: userName, 
          role: userRole, 
          email: firebaseUser.email || email,
          uid: firebaseUser.uid,
          terminalId: null
        };
        
        sessionStorage.setItem('user', JSON.stringify(appUser));
        router.replace('/');
        return;
      }

      const userRole = userData.role;
      const userName = userData.name || firebaseUser.displayName || email.split('@')[0] || 'Usuario';

      // 3. Verificar permisos según el modo seleccionado
      if (mode === 'admin' && userRole !== 'admin') {
        setError('Esta cuenta no tiene permisos de administrador');
        setIsLoading(false);
        return;
      }
      
      if (mode === 'cashier' && userRole !== 'cashier') {
        setError('Esta cuenta no tiene permisos de cajero');
        await auth.signOut();
        setIsLoading(false);
        return;
      }
      
      // 4. Guardar en sessionStorage
      const appUser = { 
        name: userName, 
        role: userRole, 
        email: firebaseUser.email || email,
        uid: firebaseUser.uid,
        terminalId: userData.terminalId || null
      };
      
      sessionStorage.setItem('user', JSON.stringify(appUser));
      
      router.replace('/');
    } catch (firebaseError: any) {
      console.error('Login error:', firebaseError);
      if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/invalid-credential') {
        setError('Credenciales inválidas o usuario no encontrado');
      } else if (firebaseError.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta');
      } else if (firebaseError.message) {
        setError(firebaseError.message);
      } else {
        setError('Error al iniciar sesión');
      }
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetMessage({ type: 'error', text: 'Ingrese su correo electrónico' });
      return;
    }
    if (!auth) return;
    
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage({ type: 'success', text: 'Correo de recuperación enviado. Revise su bandeja de entrada.' });
      setTimeout(() => {
        setShowReset(false);
        setResetMessage(null);
        setResetEmail('');
        setIsLoading(false);
      }, 3000);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setResetMessage({ type: 'error', text: 'No hay usuario registrado con este correo' });
      } else {
        setResetMessage({ type: 'error', text: error.message });
      }
      setIsLoading(false);
    }
  };

  if (showReset) {
    return (
      <div className="min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-[#1A2C4E] p-5 text-center">
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Key size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-headline font-black text-white">Recuperar Contraseña</h2>
          </div>
          <div className="p-6">
            <p className="text-xs text-black/60 mb-4">Ingrese su correo electrónico para restablecer su contraseña.</p>
            
            <div className="mb-4">
              <label className="block text-[10px] font-black text-black/60 uppercase tracking-widest mb-1">Correo electrónico</label>
              <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#9E9E9E] rounded-lg px-3">
                <Mail size={14} className="text-black/40" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="usuario@masterpos.com"
                  className="flex-1 bg-transparent py-2.5 text-sm text-black outline-none"
                />
              </div>
            </div>

            {resetMessage && (
              <div className={cn(
                "mb-4 p-2 rounded-lg text-xs",
                resetMessage.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}>
                {resetMessage.text}
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={isLoading}
              className="w-full py-2.5 bg-primary rounded-lg text-black font-black text-sm transition-all hover:brightness-110 disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : 'Enviar correo'}
            </button>

            <button
              onClick={() => {
                setShowReset(false);
                setResetMessage(null);
                setResetEmail('');
                setIsLoading(false);
              }}
              className="w-full mt-3 py-2 text-xs text-primary font-bold hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft size={12} /> Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-[#1A2C4E] p-5 text-center">
          <div className="w-14 h-14 rounded-xl overflow-hidden mx-auto mb-2">
            <Image 
              src="/logo-master.png" 
              alt="MasterPOS Logo" 
              width={56} 
              height={56}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h2 className="text-xl font-headline font-black text-white">Master<span className="text-primary">POS</span></h2>
        </div>

        <div className="p-6">
          <h3 className="text-base font-black text-black">Iniciar Sesión</h3>
          <p className="text-[10px] text-black/50 mb-4">Seleccione el modo de acceso</p>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={cn(
                "flex-1 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                mode === 'admin'
                  ? "border-primary bg-primary/10 text-black"
                  : "border-[#9E9E9E] bg-white text-black/50 hover:border-primary/50"
              )}
            >
              <Building2 size={16} />
              <span className="text-[11px] font-bold uppercase">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('cashier')}
              className={cn(
                "flex-1 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                mode === 'cashier'
                  ? "border-primary bg-primary/10 text-black"
                  : "border-[#9E9E9E] bg-white text-black/50 hover:border-primary/50"
              )}
            >
              <Store size={16} />
              <span className="text-[11px] font-bold uppercase">Cajero</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[9px] font-black text-black/60 uppercase tracking-widest mb-0.5">Correo Electrónico</label>
              <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#9E9E9E] rounded-lg px-3">
                <User size={14} className="text-black/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@masterpos.com"
                  className="flex-1 bg-transparent py-2.5 text-sm text-black outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-black/60 uppercase tracking-widest mb-0.5">Contraseña</label>
              <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#9E9E9E] rounded-lg px-3">
                <div className="w-3 h-3 rounded-full bg-black/20" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent py-2.5 text-sm text-black outline-none"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-1.5">
                <p className="text-red-600 text-[10px] font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary rounded-lg text-black font-black text-sm transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                'INGRESAR'
              )}
            </button>
          </form>

          <button
            onClick={() => setShowReset(true)}
            className="w-full mt-2 py-1 text-[9px] text-primary font-bold hover:underline transition-all"
          >
            ¿Olvidó su contraseña?
          </button>

          <div className="mt-3 pt-2 border-t border-[#E8E8E8]">
            <p className="text-[8px] text-black/30 text-center">
              {mode === 'admin' ? 'Acceso para administradores' : 'Acceso para cajeros'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}