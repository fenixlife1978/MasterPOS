"use client";

import { useState } from 'react';
import { Client } from '@/lib/types';
import { UserCircle, X } from 'lucide-react';
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
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <UserCircle size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-black truncate">{client.name}</div>
          <div className="text-[11px] text-muted font-bold uppercase">{client.cedula} | {client.phone}</div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Estado Financiero</div>
          <div className="bg-secondary border border-border rounded-2xl p-6 text-center shadow-xl">
            <div className="text-[10px] text-muted font-bold uppercase tracking-widest">Saldo Pendiente</div>
            <div className={cn(
              "text-3xl font-black mt-1",
              totalDebt > 0 ? "text-[#FF0000]" : "text-[#00FF00]"
            )}>
              BS {totalDebt.toFixed(2)}
            </div>
            <div className="text-sm text-primary font-bold mt-1">USD {(totalDebt / state.exchangeRate).toFixed(2)}</div>
          </div>
        </div>

        {totalDebt > 0 && (
          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Abonar / Pagar</div>
            <div className="bg-secondary border border-border rounded-2xl p-5 space-y-4">
              <div className="flex gap-2">
                <button 
                  onClick={handleFullPay}
                  className="flex-1 py-3 bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] text-[11px] font-black rounded-xl hover:bg-[#00FF00]/20 transition-all uppercase"
                >
                  PAGAR TOTAL
                </button>
                <button 
                  onClick={() => document.getElementById('abono-field')?.focus()}
                  className="flex-1 py-3 bg-primary/10 border border-primary/30 text-accent text-[11px] font-black rounded-xl hover:bg-primary/20 transition-all uppercase"
                >
                  ABONAR
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <input 
                  id="abono-field"
                  type="number" 
                  value={abono}
                  onChange={(e) => setAbono(e.target.value)}
                  placeholder="Monto BS"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-black text-foreground outline-none focus:border-primary"
                />
                <button 
                  onClick={handleProcessAbono}
                  className="w-full py-4 bg-primary text-accent text-[12px] font-black rounded-xl hover:brightness-110 transition-all uppercase tracking-widest shadow-lg"
                >
                  Confirmar
                </button>
              </div>
              <p className="text-[9px] text-muted text-center italic">El abono se aplicará cronológicamente a las deudas más antiguas.</p>
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 flex items-center justify-between">
            <span>Historial de Crédito</span>
            <span className="bg-secondary px-2 py-0.5 rounded text-[9px]">{clientAccounts.length} TXS</span>
          </div>
          <div className="space-y-2">
            {clientAccounts.length === 0 ? (
              <div className="text-center py-6 text-muted italic text-[11px]">Sin registros de crédito</div>
            ) : (
              clientAccounts.map(a => {
                const remaining = a.amountBs - (a.paidAmount || 0);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-secondary/50 border border-border rounded-xl transition-all hover:border-primary/30">
                    <div className="text-[10px] text-muted font-black w-12 shrink-0">
                      {new Date(a.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="flex-1 min-w-0 text-[11px] font-bold text-muted-foreground truncate">
                      {a.products}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        "text-[12px] font-black",
                        a.status === 'pagada' ? "text-[#00FF00]" : a.status === 'parcial' ? "text-[#F39C12]" : "text-[#FF0000]"
                      )}>
                        BS {remaining.toFixed(2)}
                      </div>
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded uppercase border",
                        a.status === 'pagada' ? "bg-[#00FF00] text-black border-green-700" : a.status === 'parcial' ? "bg-[#F39C12] text-black border-yellow-700" : "bg-[#FF0000] text-black border-red-700"
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
