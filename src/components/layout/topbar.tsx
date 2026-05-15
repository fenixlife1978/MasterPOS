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

  return (
    <header className="h-[72px] bg-secondary flex items-center px-8 gap-8 shrink-0 text-white shadow-md z-40">
      <div className="font-headline font-black text-3xl flex items-center tracking-tight text-white drop-shadow-sm">
        LicoPOS
      </div>
      
      <div className={cn(
        "px-4 py-1 rounded-full text-[11px] font-black uppercase tracking-widest shadow-inner",
        isOpen 
          ? "bg-success text-white" 
          : "bg-destructive text-white"
      )}>
        {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
      </div>

      <div className="ml-auto flex items-center gap-6">
        <div className="bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-xl flex items-center gap-4 text-xs border border-white/20">
          <RefreshCw size={18} className="text-white" />
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              value={rate} 
              onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
              className="w-16 bg-transparent border-none text-white font-black focus:outline-none text-xl text-center"
            />
            <div className="flex flex-col text-[8px] font-black opacity-80 leading-tight">
              <span>BS/USD</span>
              <span className="text-[10px]">TASA</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[14px] font-bold text-white bg-white/10 px-4 py-2.5 rounded-xl border border-white/20">
          <Clock size={18} />
          <span className="tracking-tight uppercase">
            {time.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>
    </header>
  );
}
