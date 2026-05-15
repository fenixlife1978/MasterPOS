"use client";

import { useState, useEffect } from 'react';
import { CashRegister } from '@/lib/types';
import { RefreshCw, Clock } from 'lucide-react';

interface TopbarProps {
  register: CashRegister | null;
  rate: number;
  onRateChange: (rate: number) => void;
}

export default function Topbar({ register, rate, onRateChange }: TopbarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isOpen = register?.isOpen;

  return (
    <header className="h-14 bg-[#111111] border-bottom border-border flex items-center px-5 gap-4 shrink-0">
      <div className="font-headline font-bold text-xl text-primary">LicoPOS Gold</div>
      
      <div className={cn(
        "px-3 py-1 rounded-full text-[11px] font-bold transition-colors",
        isOpen 
          ? "bg-[#2ECC7126] text-[#2ECC71]" 
          : "bg-[#E74C3C26] text-[#E74C3C]"
      )}>
        {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="bg-card px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs border border-border">
          <RefreshCw size={14} className="text-primary" />
          <span className="text-muted-foreground uppercase tracking-tight font-medium">Tasa:</span>
          <input 
            type="number" 
            value={rate} 
            onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
            className="w-16 bg-transparent border-none text-primary font-bold focus:outline-none text-center"
          />
          <span className="text-muted-foreground font-semibold">BS/USD</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-secondary-foreground font-medium">
          <Clock size={14} className="text-muted" />
          {time.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })} {time.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </header>
  );
}

import { cn } from '@/lib/utils';
