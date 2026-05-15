"use client";

import { useState } from 'react';
import { Calculator, X, CreditCard, DollarSign, Fingerprint, Smartphone, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentModalProps {
  total: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: { method: string, amount: number }) => void;
}

export default function PaymentModal({ total, exchangeRate, onClose, onConfirm }: PaymentModalProps) {
  const [method, setMethod] = useState('efectivo_bs');
  const [buffer, setBuffer] = useState('');

  const methods = [
    { id: 'efectivo_bs', icon: DollarSign, label: 'BS' },
    { id: 'tarjeta', icon: CreditCard, label: 'TARJ' },
    { id: 'usd_efectivo', icon: DollarSign, label: 'USD' },
    { id: 'biopago', icon: Fingerprint, label: 'BIO' },
    { id: 'pago_movil', icon: Smartphone, label: 'PM' },
    { id: 'zelle', icon: Plane, label: 'ZELLE' },
  ];

  const handleInput = (val: string) => {
    if (val === 'del') setBuffer(prev => prev.slice(0, -1));
    else if (val === '.') { if (!buffer.includes('.')) setBuffer(prev => prev + '.'); }
    else setBuffer(prev => prev + val);
  };

  const entered = parseFloat(buffer) || 0;
  const isUsd = method === 'usd_efectivo' || method === 'zelle';
  const displayBs = isUsd ? entered * exchangeRate : entered;
  const change = Math.max(0, displayBs - total);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-headline font-black flex items-center gap-2">
            <Calculator size={20} className="text-primary" /> Cobro Contado
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="bg-background rounded-xl p-4 border border-border mb-4 text-right">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total a pagar: BS {total.toFixed(2)}</div>
          <div className="text-3xl font-black text-foreground mt-1 tracking-tighter">BS {displayBs.toFixed(2)}</div>
          <div className="text-sm text-primary font-bold">{isUsd ? `USD ${entered.toFixed(2)}` : `USD ${(displayBs / exchangeRate).toFixed(2)}`}</div>
          {change > 0 && (
            <div className="text-xs text-[#2ECC71] font-bold mt-1">Vuelto: BS {change.toFixed(2)}</div>
          )}
        </div>

        <div className="grid grid-cols-6 gap-1 mb-4">
          {methods.map(m => {
            const Icon = m.icon;
            return (
              <button 
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 border-2 border-border rounded-lg transition-all",
                  method === m.id ? "border-primary bg-primary/10 text-primary" : "text-muted hover:bg-secondary"
                )}
              >
                <Icon size={14} />
                <span className="text-[7px] font-black">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleInput(n.toString())} className="h-12 bg-secondary rounded-lg font-black text-lg hover:bg-primary hover:text-background transition-colors">{n}</button>
          ))}
          <button onClick={() => handleInput('del')} className="h-12 bg-secondary rounded-lg text-destructive flex items-center justify-center"><Calculator size={20} /></button>
          <button onClick={() => handleInput('0')} className="h-12 bg-secondary rounded-lg font-black text-lg">0</button>
          <button onClick={() => handleInput('.')} className="h-12 bg-secondary rounded-lg font-black text-lg">.</button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setBuffer(isUsd ? (total / exchangeRate).toFixed(2) : total.toFixed(2))}
            className="flex-1 py-2 rounded-lg border border-border text-xs font-bold hover:border-primary transition-colors"
          >
            Monto Exacto
          </button>
          <button 
            onClick={() => onConfirm({ method, amount: displayBs })}
            className="flex-1 py-2 bg-primary rounded-lg text-background text-xs font-black hover:bg-primary/90 transition-all"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
