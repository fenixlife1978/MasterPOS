"use client";

import { useRouter } from 'next/navigation';
import { DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  className?: string;
  variant?: 'sidebar' | 'topbar' | 'text';
}

export default function LogoutButton({ className, variant = 'sidebar' }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = () => {
    // Limpiar toda la sesión
    localStorage.removeItem('user');
    localStorage.removeItem('masterpos_users');
    localStorage.removeItem('masterpos_terminals');
    localStorage.removeItem('licopos_products');
    localStorage.removeItem('licopos_clients');
    localStorage.removeItem('licopos_transactions');
    localStorage.removeItem('licopos_accounts');
    localStorage.removeItem('licopos_register');
    localStorage.removeItem('licopos_rate');
    localStorage.removeItem('firebase_pending_queue');
    localStorage.removeItem('cache_products');
    localStorage.removeItem('cache_clients');
    localStorage.removeItem('cache_transactions');
    localStorage.removeItem('cache_accounts');
    localStorage.removeItem('cache_register');
    
    // Redirigir al login
    router.push('/login');
  };

  if (variant === 'topbar') {
    return (
      <button
        onClick={handleLogout}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all",
          className
        )}
      >
        <DoorOpen size={16} />
        <span className="text-xs font-bold">Salir</span>
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button
        onClick={handleLogout}
        className={cn(
          "flex items-center gap-2 text-black/60 hover:text-red-600 transition-colors",
          className
        )}
      >
        <DoorOpen size={16} />
        <span className="text-xs font-medium">Cerrar Sesión</span>
      </button>
    );
  }

  // Variante sidebar (default)
  return (
    <button
      onClick={handleLogout}
      className={cn(
        "w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center transition-all text-black/60 hover:bg-red-500/20 hover:text-red-400",
        className
      )}
    >
      <DoorOpen size={18} strokeWidth={2} />
      <span className="text-[9px] font-bold uppercase tracking-tight mt-0.5">Salir</span>
    </button>
  );
}
