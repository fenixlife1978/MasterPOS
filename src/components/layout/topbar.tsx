"use client";

import { useState, useEffect } from 'react';
import { CashRegister } from '@/lib/types';
import { RefreshCw, Clock, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';
import InvoiceNotifications from '@/components/ui/InvoiceNotifications';
import { useAuth } from '@/context/AuthContext';

interface TopbarProps {
  register: CashRegister | null;
  rate: number;
  onRateChange: (rate: number) => void;
}

export default function Topbar({ register, rate, onRateChange }: TopbarProps) {
  const { user, loading } = useAuth(); // ✅ Agregar loading
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSync, setPendingSync] = useState(0);
  const isAdmin = user?.role === 'admin';

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
    <header className="h-[56px] bg-secondary border-b border-black/10 flex items-center px-6 gap-6 shrink-0 z-40">
      <div className="font-headline font-bold text-[22px] tracking-tight">
        <span className="text-primary">Master</span>
        <span className="text-white">POS</span>
      </div>
      
      {/* Ocultar el badge de caja para administradores (y mientras carga) */}
      {!loading && !isAdmin && (
        <div className={cn(
          "px-4 py-1 rounded-full text-[12px] font-bold tracking-tight transition-all duration-200 shadow-md flex items-center gap-2",
          isOpen 
            ? "bg-[#2ECC71] text-white border border-[#27AE60]" 
            : "bg-[#E74C3C] text-white border border-[#C0392B]"
        )}>
          <span className={cn(
            "w-2 h-2 rounded-full",
            isOpen ? "bg-white animate-pulse" : "bg-white/50"
          )} />
          {isOpen ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
        </div>
      )}

      <div className="ml-auto flex items-center gap-6">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi size={14} className="text-green-400" />
          ) : (
            <WifiOff size={14} className="text-red-400" />
          )}
          {pendingSync > 0 && (
            <span className="text-[9px] bg-yellow-500 text-black px-1.5 py-0.5 rounded-full animate-pulse">
              {pendingSync}
            </span>
          )}
        </div>

        <InvoiceNotifications variant="cashier" />

        <div className="bg-black/30 px-5 py-1.5 rounded-full flex items-center gap-3 border border-white/5 shadow-inner">
          <RefreshCw size={16} className="text-primary" />
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-white/70 font-bold tracking-widest text-[11px]">TASA BCV:</span>
            <span className="text-primary font-black text-[15px]">{rate.toFixed(2)}</span>
            <span className="text-white/40 text-[10px] font-bold ml-1">BS/USD</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[14px] font-medium text-white">
          <Clock size={18} className="text-primary" />
          <div className="flex items-center gap-2">
            <span className="font-bold">{formatDate(time)}</span>
            <span className="text-white/20">|</span>
            <span className="font-bold">{formatTime(time)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}