
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

  // Formato: "14-may. | 11:01 p. m."
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('es-VE', { month: 'short' }).toLowerCase().replace('.', '');
    const timeStr = date.toLocaleTimeString('es-VE', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
    
    return `${day}-${month}. | ${timeStr}`;
  };

  return (
    <header className="h-16 bg-[#0C0B0A] border-b border-border flex items-center px-6 gap-6 shrink-0">
      <div className="font-headline font-black text-2xl text-primary flex items-center tracking-tight">
        LicoPOS Elite
      </div>
      
      <div className={cn(
        "px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors",
        isOpen 
          ? "bg-[#2ECC711A] text-[#2ECC71]" 
          : "bg-[#E74C3C1A] text-[#E74C3C]"
      )}>
        {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
      </div>

      <div className="ml-auto flex items-center gap-8">
        <div className="bg-[#161616] px-5 py-2 rounded-full flex items-center gap-3 text-xs border border-border/40">
          <RefreshCw size={16} className="text-primary" />
          <span className="text-muted font-bold tracking-widest text-[10px]">TASA:</span>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              value={rate} 
              onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
              className="w-12 bg-transparent border-none text-primary font-black focus:outline-none text-base text-center"
            />
            <span className="text-muted font-bold text-[9px] tracking-tighter">BS/USD</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[13px] font-medium text-foreground">
          <Clock size={18} className="text-primary" />
          <span className="tracking-tight">
            {formatDate(time)}
          </span>
        </div>
      </div>
    </header>
  );
}
