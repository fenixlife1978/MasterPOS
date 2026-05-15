"use client";

import { useState, useMemo } from 'react';
import { Product, Client } from '@/lib/types';
import { Search, Barcode, UserCircle } from 'lucide-react';
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
    <div className="flex flex-col h-full bg-white relative">
      <div className="p-6 bg-white z-50 border-b border-muted">
        <div className={cn(
          "flex items-center bg-muted border border-border rounded-2xl px-5 transition-all duration-300",
          isFocused && "border-secondary ring-2 ring-secondary/20 bg-white"
        )}>
          <Search size={20} className="text-muted-foreground" />
          <input 
            id="pos-search-input"
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={isClientSearch ? "Buscar cliente..." : "Buscar producto o escanear..."}
            className="flex-1 bg-transparent border-none text-foreground px-4 py-5 text-base focus:outline-none font-body placeholder:text-muted-foreground/60 font-medium"
          />
          <Barcode size={22} className="text-secondary animate-pulse-scan" />
        </div>

        <button 
          onClick={() => {
            setIsClientSearch(!isClientSearch);
            setQuery('');
            setViewingClient(null);
          }}
          className={cn(
            "w-full mt-4 flex items-center justify-center gap-3 p-5 rounded-2xl font-black text-base transition-all shadow-md",
            isClientSearch || viewingClient 
              ? "bg-primary text-black" 
              : "bg-accent text-white hover:brightness-110 active:scale-[0.98]"
          )}
        >
          <UserCircle size={24} />
          {viewingClient ? 'CAMBIAR CLIENTE' : isClientSearch ? 'CANCELAR BÚSQUEDA' : 'VER CLIENTE'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 scrollbar-thin mt-4">
        {!isClientSearch && !viewingClient && query && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            {productResults.map(p => (
              <button 
                key={p.id}
                onClick={() => {
                  onAdd(p.id);
                  setQuery('');
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted border border-transparent hover:border-secondary hover:bg-white hover:shadow-lg transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-secondary border border-border shadow-sm group-hover:scale-110 transition-transform">
                  <Barcode size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate uppercase text-foreground">{p.name}</div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-base font-black text-secondary">BS {p.priceBs.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">STOCK: {p.stock}</span>
                  </div>
                </div>
              </button>
            ))}
            {productResults.length === 0 && (
              <div className="text-center py-16 opacity-40 italic text-sm">Sin resultados encontrados</div>
            )}
          </div>
        )}

        {isClientSearch && !viewingClient && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            {clientResults.map(c => (
              <button 
                key={c.id}
                onClick={() => {
                  setViewingClient(c);
                  setIsClientSearch(false);
                  setQuery('');
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted border border-transparent hover:border-secondary transition-all text-left group"
              >
                <UserCircle size={28} className="text-secondary group-hover:scale-110 transition-transform" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.cedula}</div>
                  {c.debt > 0 && <div className="text-xs text-destructive font-bold mt-1">DEUDA: BS {c.debt.toFixed(2)}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

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
