"use client";

import { useState } from 'react';
import { Client } from '@/lib/types';
import { UserCircle, X, CheckCircle, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSState } from '@/hooks/use-pos-state';

interface ClientPanelProps {
  client: Client;
  state: ReturnType<typeof usePOSState>;
  onClose: () => void;
}

export default function ClientPanel({ client, state, onClose }: ClientPanelProps) {
  const [abono, setAbono] = useState('');
  
  const clientAccounts = state.accounts
    .filter(a => a.clientId === client.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalDebt = clientAccounts
    .filter(a => a.status !== 'pagada')
    .reduce((s, a) => s + (a.amountBs - (a.paidAmount || 0)), 0);

  const handleProcessAbono = () => {
    const amount = parseFloat(abono) || 0;
    if (amount <= 0) return;
    if (amount > totalDebt) return;
    state.applyAbono(client.id, amount);
    setAbono('');
  };

  const handleFullPay = () => {
    if (totalDebt <= 0) return;
    state.applyAbono(client.id, totalDebt);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <UserCircle size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate text-foreground">{client.name}</div>
          <div className="text-[11px] text-muted font-medium">{client.cedula} | {client.phone}</div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Deuda Actual</div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-[11px] text-muted font-medium uppercase tracking-wider">Total Pendiente</div>
            <div className={cn(
              "text-2xl font-black mt-1",
              totalDebt > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]"
            )}>
              BS {totalDebt.toFixed(2)}
            </div>
            <div className="text-[12px] text-primary font-bold mt-0.5">USD {(totalDebt / state.exchangeRate).toFixed(2)}</div>
          </div>
        </div>

        {totalDebt > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3.5">
            <div className="flex gap-2">
              <button 
                onClick={handleFullPay}
                className="flex-1 py-2.5 bg-success/10 border border-success/30 text-[#2ECC71] text-[11px] font-bold rounded-lg hover:bg-success/20 transition-all uppercase"
              >
                <CheckCircle size={12} className="inline mr-1" /> Pagar Total
              </button>
              <button 
                onClick={() => document.getElementById('abono-input')?.focus()}
                className="flex-1 py-2.5 bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold rounded-lg hover:bg-primary/20 transition-all uppercase"
              >
                <HandCoins size={12} className="inline mr-1" /> Abonar
              </button>
            </div>
            
            {/* Contenedor vertical para el input y el botón de confirmar */}
            <div className="space-y-2">
              <input 
                id="abono-input"
                type="number" 
                value={abono}
                onChange={(e) => setAbono(e.target.value)}
                placeholder="Monto BS"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-bold text-foreground outline-none focus:border-primary transition-colors text-center"
              />
              <button 
                onClick={handleProcessAbono}
                className="w-full py-2.5 bg-primary text-black text-[12px] font-black rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
              >
                Confirmar
              </button>
            </div>
            
            <p className="text-[10px] text-muted italic leading-tight text-center">Los abonos se aplican cronológicamente desde la deuda más antigua.</p>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center justify-between px-1">
            <span>Transacciones de Crédito ({clientAccounts.length})</span>
          </div>
          <div className="space-y-1.5">
            {clientAccounts.length === 0 ? (
              <div className="text-center py-6 text-muted italic text-[12px]">Sin historial de crédito</div>
            ) : (
              clientAccounts.map(a => {
                const remaining = a.amountBs - (a.paidAmount || 0);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg transition-all hover:border-primary/20 cursor-pointer">
                    <div className="text-[11px] text-muted font-bold w-12 shrink-0">
                      {new Date(a.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                    <div className="flex-1 min-w-0 text-[12px] text-foreground/80 truncate">
                      {a.products}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        "text-[13px] font-bold",
                        a.status === 'pagada' ? "text-[#2ECC71]" : a.status === 'parcial' ? "text-[#F39C12]" : "text-[#E74C3C]"
                      )}>
                        BS {remaining.toFixed(2)}
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                        a.status === 'pagada' ? "bg-success/15 text-[#2ECC71]" : a.status === 'parcial' ? "bg-warning/15 text-[#F39C12]" : "bg-destructive/15 text-[#E74C3C]"
                      )}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}