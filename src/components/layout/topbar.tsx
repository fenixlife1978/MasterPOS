"use client";

import { useState, useEffect } from 'react';
import { CashRegister } from '@/lib/types';
import { RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopbarProps {
  register: CashRegister | null;
  rate: number;
  onRateChange: (rate: number) => void;
}

export default function Topbar({ register, rate, onRateChange }: TopbarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
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
    <header className="h-[56px] bg-secondary border-b border-white/10 flex items-center px-6 gap-6 shrink-0 z-40">
      <div className="font-headline font-bold text-[22px] text-white tracking-tight">
        LicoPOS Elite
      </div>
      
      <div className={cn(
        "px-4 py-1 rounded-full text-[12px] font-bold tracking-tight transition-colors border",
        isOpen 
          ? "bg-success/20 text-white border-white/30" 
          : "bg-destructive/20 text-white border-white/30"
      )}>
        {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
      </div>

      <div className="ml-auto flex items-center gap-6">
        <div className="bg-black/20 px-5 py-1.5 rounded-full flex items-center gap-3 border border-white/10">
          <RefreshCw size={16} className="text-primary" />
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-white/70 font-bold tracking-widest text-[11px]">TASA:</span>
            <input 
              type="number" 
              value={rate} 
              onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
              className="w-12 bg-transparent border-none text-primary font-black focus:outline-none text-center text-[15px]"
            />
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