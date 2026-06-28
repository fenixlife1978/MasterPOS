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
  
  const isAdmin = user?.role === 'admin';
  const showRegisterBadge = !loading && !isAdmin && register !== undefined;
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
    <header className="h-[60px] bg-secondary border-b-4 border-black flex items-center px-6 gap-4 shrink-0 z-40 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="font-headline font-black text-2xl tracking-tighter">
          <span className="text-primary">Master</span>
          <span className="text-white">POS</span>
        </div>
        
        {showTerminalBadge && (
          <div className="flex items-center gap-1.5 bg-primary text-black rounded-lg px-3 py-1 border-2 border-black shadow-lg">
            <Monitor size={14} className="text-black font-black" />
            <span className="font-black text-[11px] tracking-widest uppercase">
              TERMINAL: {currentTerminalName}
            </span>
          </div>
        )}
      </div>
      
      {showRegisterBadge && (
        <div className={cn(
          "px-4 py-1 rounded-xl text-[11px] font-black tracking-widest transition-all duration-200 shadow-2xl flex items-center gap-2 border-2 border-black",
          isOpen 
            ? "bg-[#2ECC71] text-white" 
            : "bg-[#E74C3C] text-white"
        )}>
          <span className={cn(
            "w-2.5 h-2.5 rounded-full border-2 border-white",
            isOpen ? "bg-white animate-pulse" : "bg-white/30"
          )} />
          {isOpen ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
        </div>
      )}

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi size={18} className="text-green-400 drop-shadow-md" />
          ) : (
            <WifiOff size={18} className="text-red-500 drop-shadow-md" />
          )}
          {pendingSync > 0 && (
            <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-md animate-bounce font-black border border-white">
              {pendingSync}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20 hover:bg-primary hover:text-black transition-all shadow-md group"
            title="Sincronizar operaciones pendientes"
          >
            <UploadCloud size={16} className={cn(
              "text-white group-hover:text-black transition-colors",
              isSyncing && "animate-spin"
            )} />
          </button>
        </div>

        <InvoiceNotifications variant="cashier" />

        <div className="bg-black p-1 rounded-xl border border-primary/30 shadow-2xl flex items-center pr-4">
          <div className="bg-primary text-black p-1.5 rounded-lg mr-3 border border-black shadow-lg">
            <RefreshCw size={16} className="font-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-primary font-black tracking-widest text-[8px] uppercase leading-none mb-0.5">Tasa BCV Oficial</span>
            <div className="flex items-baseline gap-1">
              <span className="text-white font-black text-lg tracking-tighter">{formatBsNumber(rate)}</span>
              <span className="text-primary/60 text-[8px] font-black uppercase">BS/USD</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 shadow-inner">
          <Clock size={18} className="text-primary" />
          <div className="flex flex-col text-right">
            <span className="text-primary font-black text-[10px] uppercase tracking-widest leading-none">{formatDate(time)}</span>
            <span className="text-white font-black text-base tracking-tight leading-none">{formatTime(time)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}