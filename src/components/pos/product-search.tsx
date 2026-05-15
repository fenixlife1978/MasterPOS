"use client";

import { useState, useMemo } from 'react';
import { Product, Client } from '@/lib/types';
import { Search, Barcode, UserCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientPanel from './client-panel';
import { usePOSState } from '@/hooks/use-pos-state';

interface ProductSearchProps {
  state: ReturnType<typeof usePOSState>;
  onAdd: (id: number) => boolean;
}

export default function ProductSearch({ state, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isClientSearch, setIsClientSearch] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  const productResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return state.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.barcode.includes(q) || 
      p.category.toLowerCase().includes(q)
    );
  }, [query, state.products]);

  const clientResults = useMemo(() => {
    if (!query.trim()) return state.clients;
    const q = query.toLowerCase();
    return state.clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.cedula.toLowerCase().includes(q)
    );
  }, [query, state.clients]);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="p-4 bg-background z-50">
        <div className={cn(
          "flex items-center bg-secondary border border-border rounded-xl px-4 transition-all duration-300",
          isFocused && "border-primary ring-1 ring-primary/20"
        )}>
          <Search size={18} className="text-muted" />
          <input 
            id="pos-search-input"
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={isClientSearch ? "Buscar cliente..." : "Buscar producto o escanear..."}
            className="flex-1 bg-transparent border-none text-foreground px-3 py-4 text-sm focus:outline-none font-body placeholder:text-muted/50 uppercase font-bold"
          />
          <Barcode size={20} className="text-primary/60 animate-pulse-scan" />
        </div>

        <button 
          onClick={() => {
            setIsClientSearch(!isClientSearch);
            setQuery('');
            setViewingClient(null);
          }}
          className={cn(
            "w-full mt-3 flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-black transition-all",
            isClientSearch || viewingClient ? "bg-primary/10 border-primary text-primary" : "bg-secondary text-foreground hover:border-primary/50"
          )}
        >
          <UserCircle size={18} />
          {viewingClient ? 'CAMBIAR CLIENTE' : isClientSearch ? 'CANCELAR BÚSQUEDA' : 'VER CLIENTE'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 scrollbar-thin">
        {/* Resultados de Productos */}
        {!isClientSearch && !viewingClient && query && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
            {productResults.map(p => (
              <button 
                key={p.id}
                onClick={() => {
                  onAdd(p.id);
                  setQuery('');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-primary/60 group-hover:text-primary border border-border">
                  <Barcode size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate uppercase">{p.name}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[12px] font-black text-primary">BS {p.priceBs.toFixed(2)}</span>
                    <span className="text-[10px] text-muted font-bold">STOCK: {p.stock}</span>
                  </div>
                </div>
              </button>
            ))}
            {productResults.length === 0 && (
              <div className="text-center py-10 opacity-30 italic text-xs">Sin resultados</div>
            )}
          </div>
        )}

        {/* Resultados de Clientes */}
        {isClientSearch && !viewingClient && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
            {clientResults.map(c => (
              <button 
                key={c.id}
                onClick={() => {
                  setViewingClient(c);
                  setIsClientSearch(false);
                  setQuery('');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-transparent hover:border-primary/20 transition-all text-left"
              >
                <UserCircle size={24} className="text-primary" />
                <div className="flex-1">
                  <div className="text-[13px] font-bold">{c.name}</div>
                  <div className="text-[11px] text-muted">{c.cedula}</div>
                  {c.debt > 0 && <div className="text-[11px] text-destructive font-bold">DEUDA: BS {c.debt.toFixed(2)}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Panel de Información del Cliente */}
        {viewingClient && (
          <ClientPanel 
            client={viewingClient} 
            state={state} 
            onClose={() => setViewingClient(null)} 
          />
        )}
      </div>
    </div>
  );
}