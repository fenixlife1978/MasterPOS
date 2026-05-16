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
    <header className="h-[56px] bg-card border-bottom border-border flex items-center px-5 gap-4 shrink-0 z-40">
      <div className="font-headline font-black text-xl text-primary tracking-tight">
        LicoPOS
      </div>
      
      <div className={cn(
        "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
        isOpen 
          ? "bg-success/15 text-[#2ECC71]" 
          : "bg-destructive/15 text-[#E74C3C]"
      )}>
        {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="bg-background/50 border border-border px-3.5 py-1.5 rounded-lg flex items-center gap-2 text-[13px]">
          <RefreshCw size={14} className="text-primary" />
          <span className="text-muted text-[11px] font-medium uppercase">Tasa:</span>
          <input 
            type="number" 
            value={rate} 
            onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
            className="w-16 bg-transparent border-none text-primary font-bold focus:outline-none text-center"
          />
          <span className="text-muted text-[10px] font-bold">BS/USD</span>
        </div>

        <div className="text-[13px] text-foreground/80 font-medium font-body flex items-center gap-2">
          <Clock size={14} className="text-muted" />
          <span className="tracking-tight">
            {time.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })} {time.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </header>
  );
}