"use client";

import { useAuth } from '@/context/AuthContext';
import { DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';

interface LogoutButtonProps {
  className?: string;
  variant?: 'sidebar' | 'topbar' | 'text';
  collapsed?: boolean;
}

export default function LogoutButton({ className, variant = 'sidebar', collapsed = false }: LogoutButtonProps) {
  const { logout } = useAuth();

  const handleLogout = async () => {
    // ✅ Activar el modo logout (silencia errores de permisos)
    syncService.setLoggingOut(true);
    
    // Cancelar todas las suscripciones activas
    syncService.unsubscribeAll();

    // Limpiar localStorage
    localStorage.removeItem('masterpos_users');
    localStorage.removeItem('masterpos_terminals');
    localStorage.removeItem('licopos_products');
    localStorage.removeItem('licopos_clients');
    localStorage.removeItem('licopos_transactions');
    localStorage.removeItem('licopos_accounts');
    localStorage.removeItem('licopos_register');
    localStorage.removeItem('licopos_rate');
    localStorage.removeItem('cache_products');
    localStorage.removeItem('cache_clients');
    localStorage.removeItem('cache_transactions');
    localStorage.removeItem('cache_accounts');
    localStorage.removeItem('cache_register');
    
    // Ejecutar el logout del contexto que maneja Firebase y el estado global
    await logout();
  };

  if (variant === 'topbar') {
    return (
      <button onClick={handleLogout} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all", className)}>
        <DoorOpen size={16} />
        <span className="text-xs font-bold">Salir</span>
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button onClick={handleLogout} className={cn("flex items-center gap-2 text-black/60 hover:text-red-600 transition-colors", className)}>
        <DoorOpen size={16} />
        <span className="text-xs font-medium">Cerrar Sesión</span>
      </button>
    );
  }

  // Sidebar - adaptado para colapsable
  return (
    <button
      onClick={handleLogout}
      className={cn(
        "w-full rounded-lg flex items-center transition-all text-black/60 hover:bg-red-500/20 hover:text-red-400",
        collapsed ? "justify-center h-[38px]" : "gap-2.5 px-3 h-[38px]"
      )}
    >
      <DoorOpen size={16} className="shrink-0" />
      {!collapsed && <span className="text-xs font-medium">Cerrar Sesión</span>}
    </button>
  );
}