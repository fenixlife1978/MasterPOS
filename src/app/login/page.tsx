"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, User, LogIn, Building2, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'admin' | 'cashier'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (mode === 'admin') {
      if (email === 'admin@masterpos.com' && password === 'admin123') {
        localStorage.setItem('user', JSON.stringify({ name: 'Administrador', role: 'admin', email: email }));
        router.push('/');
      } else {
        setError('Credenciales de administrador incorrectas');
      }
    } else {
      if (email === 'cajero@masterpos.com' && password === 'cajero123') {
        localStorage.setItem('user', JSON.stringify({ name: 'Cajero', role: 'cashier', email: email }));
        router.push('/');
      } else {
        setError('Credenciales de cajero incorrectas');
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] animate-float-ambient top-[10%] left-[5%]" />
        <div className="absolute w-[250px] h-[250px] bg-primary/3 rounded-full blur-[80px] animate-float-ambient bottom-[10%] right-[10%]" />
      </div>

      {/* Card de login - más compacta */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header más compacto */}
        <div className="bg-[#1A2C4E] p-4 text-center">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Shield size={24} className="text-primary" />
          </div>
          <h2 className="text-xl font-headline font-black text-white">
            Master<span className="text-primary">POS</span>
          </h2>
          <p className="text-white/50 text-[10px] mt-0.5">pro evolution v1.0</p>
        </div>

        {/* Body más compacto */}
        <div className="p-5">
          <h3 className="text-base font-black text-black">Iniciar Sesión</h3>
          <p className="text-[10px] text-black/50 mb-4">Seleccione el modo de acceso</p>

          {/* Selector de modo */}
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
              <label className="block text-[9px] font-black text-black/60 uppercase tracking-widest mb-0.5">
                Correo Electrónico
              </label>
              <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#9E9E9E] rounded-lg px-3 transition-all focus-within:border-primary">
                <User size={14} className="text-black/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'admin' ? "admin@masterpos.com" : "cajero@masterpos.com"}
                  className="flex-1 bg-transparent py-2 text-sm text-black outline-none placeholder:text-black/30"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-black/60 uppercase tracking-widest mb-0.5">
                Contraseña
              </label>
              <div className="flex items-center gap-2 bg-[#F5F5F5] border border-[#9E9E9E] rounded-lg px-3 transition-all focus-within:border-primary">
                <div className="w-3 h-3 rounded-full bg-black/20" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent py-2 text-sm text-black outline-none placeholder:text-black/30"
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
              className={cn(
                "w-full py-2 bg-primary rounded-lg text-black font-black text-xs transition-all flex items-center justify-center gap-2",
                isLoading ? "opacity-50 cursor-not-allowed" : "hover:brightness-110"
              )}
            >
              {isLoading ? (
                <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={14} /> INGRESAR
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
