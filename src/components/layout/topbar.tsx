"use client";

import { useState, useEffect } from 'react';
import { CashRegister } from '@/lib/types';
import { RefreshCw, Clock, Wifi, WifiOff, UploadCloud, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import syncService from '@/services/syncService';
import InvoiceNotifications from '@/components/ui/InvoiceNotifications';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface TopbarProps {
  register: CashRegister | null;
  rate: number;
  onRateChange: (rate: number) => void;
}

export default function Topbar({ register, rate, onRateChange }: TopbarProps) {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSync, setPendingSync] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Verificar si es admin
  const isAdmin = user?.role === 'admin';
  
  // Determinar si debe mostrar el badge de caja (solo si NO es admin Y la caja existe)
  const showRegisterBadge = !loading && !isAdmin && register !== undefined;
  
  // ✅ Identificación de terminal (Nombre Real de Firestore)
  const currentTerminalName = user?.terminalName || user?.terminalId;
  const showTerminalBadge = !loading && !isAdmin && currentTerminalName;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const interval = setInterval(() => {
      setPendingSync(syncService.getPendingQueueLength());
    }, 5000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      toast({ title: "Sin conexión", description: "No hay conexión a internet. No se puede sincronizar.", variant: "destructive" });
      return;
    }
    if (isSyncing) return;
    setIsSyncing(true);
    toast({ title: "Sincronizando", description: "Subiendo operaciones pendientes..." });
    try {
      const success = await syncService.syncAllPending();
      if (success) {
        toast({ title: "Sincronización completada", description: "Todas las operaciones han sido enviadas a la nube." });
        setPendingSync(syncService.getPendingQueueLength());
      } else {
        toast({ title: "Error", description: "No se pudo completar la sincronización.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error en sincronización manual:', error);
      toast({ title: "Error", description: "Ocurrió un error al sincronizar.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const isOpen = register?.isOpen;

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('es-VE', { month: 'short' }).replace('.', '');
    return `${day}-${month}.`;
  };

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <header className="h-[70px] bg-secondary border-b-4 border-black flex items-center px-8 gap-8 shrink-0 z-40 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="font-headline font-black text-3xl tracking-tighter">
          <span className="text-primary">Master</span>
          <span className="text-white">POS</span>
        </div>
        
        {/* ✅ Terminal - Diseño mucho más legible */}
        {showTerminalBadge && (
          <div className="flex items-center gap-2 bg-primary text-black rounded-xl px-4 py-1.5 border-2 border-black shadow-lg">
            <Monitor size={18} className="text-black font-black" />
            <span className="font-black text-sm tracking-widest uppercase">
              TERMINAL: {currentTerminalName}
            </span>
          </div>
        )}
      </div>
      
      {/* Badge de estado de caja (solo para cajeros) */}
      {showRegisterBadge && (
        <div className={cn(
          "px-6 py-2 rounded-2xl text-sm font-black tracking-widest transition-all duration-200 shadow-2xl flex items-center gap-3 border-2 border-black",
          isOpen 
            ? "bg-[#2ECC71] text-white" 
            : "bg-[#E74C3C] text-white"
        )}>
          <span className={cn(
            "w-3 h-3 rounded-full border-2 border-white",
            isOpen ? "bg-white animate-pulse" : "bg-white/30"
          )} />
          {isOpen ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
        </div>
      )}

      <div className="ml-auto flex items-center gap-8">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi size={24} className="text-green-400 drop-shadow-md" />
          ) : (
            <WifiOff size={24} className="text-red-500 drop-shadow-md" />
          )}
          {pendingSync > 0 && (
            <span className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg animate-bounce font-black border border-white">
              {pendingSync}
            </span>
          )}
          {/* Botón de sincronización manual */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border border-white/20 hover:bg-primary hover:text-black transition-all shadow-md group"
            title="Sincronizar operaciones pendientes"
          >
            <UploadCloud size={20} className={cn(
              "text-white group-hover:text-black transition-colors",
              isSyncing && "animate-spin"
            )} />
          </button>
        </div>

        <InvoiceNotifications variant="cashier" />

        <div className="bg-black p-1 rounded-2xl border-2 border-primary/30 shadow-2xl flex items-center pr-6">
          <div className="bg-primary text-black p-2 rounded-xl mr-4 border border-black shadow-lg">
            <RefreshCw size={24} className="font-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-primary font-black tracking-widest text-xs uppercase leading-none mb-1">Tasa BCV Oficial</span>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-black text-2xl tracking-tighter">{formatBsNumber(rate)}</span>
              <span className="text-primary/60 text-xs font-black">BS/USD</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/5 px-6 py-2 rounded-2xl border border-white/10 shadow-inner">
          <Clock size={24} className="text-primary" />
          <div className="flex flex-col text-right">
            <span className="text-primary font-black text-sm uppercase tracking-widest leading-none mb-1">{formatDate(time)}</span>
            <span className="text-white font-black text-xl tracking-tight leading-none">{formatTime(time)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
