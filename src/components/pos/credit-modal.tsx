"use client";

import { useState, useMemo } from 'react';
import { Client, CartItem } from '@/lib/types';
import { Handshake, X, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditModalProps {
  cart: CartItem[];
  clients: Client[];
  onClose: () => void;
  onConfirm: (data: any) => void;
}

export default function CreditModal({ cart, clients, onClose, onConfirm }: CreditModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);

  const total = cart.reduce((s, i) => s + (i.priceBs * i.qty), 0) * 1.16;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.cedula.toLowerCase().includes(q));
  }, [query, clients]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-headline font-black flex items-center gap-2">
            <Handshake size={24} className="text-primary" /> Venta a Crédito
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X size={20} /></button>
        </div>

        <div className="flex items-center bg-background border border-border rounded-lg px-3 mb-4">
          <Search size={14} className="text-muted" />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente por nombre o cédula..."
            className="flex-1 bg-transparent border-none text-sm px-3 py-2.5 focus:outline-none"
          />
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1 mb-4 scrollbar-thin">
          {results.length === 0 && query && <p className="text-center py-4 text-xs text-muted">No se encontraron resultados</p>}
          {results.map(c => (
            <button 
              key={c.id} 
              onClick={() => setSelected(c)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                selected?.id === c.id ? "bg-primary/10 border-primary border" : "bg-secondary/50 border border-transparent hover:border-border"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Search size={14} /></div>
              <div className="flex-1">
                <div className="text-sm font-bold">{c.name}</div>
                <div className="text-[10px] text-muted">{c.cedula}</div>
              </div>
              {c.debt > 0 && <div className="text-xs text-destructive font-bold">Deuda: BS {c.debt.toFixed(2)}</div>}
            </button>
          ))}
        </div>

        <div className="bg-background border border-border rounded-xl p-4 mb-6">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted">Cliente:</span>
            <span className="font-bold">{selected ? selected.name : 'No seleccionado'}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted">Deuda actual:</span>
            <span className="font-bold text-destructive">BS {selected?.debt.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between text-xs pt-2 mt-2 border-t border-border">
            <span className="text-muted">Nuevo crédito:</span>
            <span className="font-black text-primary">BS {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-border text-sm font-bold hover:text-foreground transition-all">CANCELAR</button>
          <button 
            disabled={!selected}
            onClick={() => onConfirm({ 
              method: 'credito', 
              clientId: selected?.id, 
              clientName: selected?.name, 
              clientCedula: selected?.cedula 
            })}
            className="flex-1 py-3 bg-primary rounded-lg text-background font-black text-sm hover:bg-primary/90 disabled:opacity-30 transition-all"
          >
            CONFIRMAR CRÉDITO
          </button>
        </div>
      </div>
    </div>
  );
}
