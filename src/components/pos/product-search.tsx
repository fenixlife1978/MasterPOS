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

  const groupedProductResults = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    productResults.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [productResults]);

  const clientResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return state.clients;
    return state.clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.cedula.toLowerCase().includes(q)
    );
  }, [query, state.clients]);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="p-3.5 bg-background z-50">
        <div className={cn(
          "flex items-center bg-card border border-border rounded-xl px-3 transition-all duration-200",
          isFocused && "border-primary gold-glow"
        )}>
          <Search size={16} className="text-muted" />
          <input 
            id="pos-search-input"
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={isClientSearch ? "Buscar cliente por nombre o cédula..." : "Buscar producto o escanear..."}
            className="flex-1 bg-transparent border-none text-foreground px-2 py-2.5 text-sm focus:outline-none font-body placeholder:text-muted"
          />
          {isClientSearch ? (
             <X size={18} className="text-muted cursor-pointer hover:text-foreground" onClick={() => { setIsClientSearch(false); setQuery(''); }} />
          ) : (
             <Barcode size={18} className="text-primary animate-pulse-scan" />
          )}
        </div>

        <button 
          onClick={() => {
            setIsClientSearch(!isClientSearch);
            setQuery('');
            setViewingClient(null);
          }}
          className={cn(
            "w-full mt-2.5 flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold text-[13px] transition-all border",
            isClientSearch || viewingClient 
              ? "bg-primary/10 border-primary text-primary" 
              : "bg-card border-border text-foreground/80 hover:border-primary hover:text-primary"
          )}
        >
          <UserCircle size={18} />
          {viewingClient ? 'CAMBIAR CLIENTE' : isClientSearch ? 'CANCELAR BÚSQUEDA' : 'VER CLIENTE'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-3.5 space-y-2 scrollbar-thin">
        {!isClientSearch && !viewingClient && query && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            {Object.entries(groupedProductResults).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] px-2 mb-1">
                  {category}
                </div>
                {items.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => {
                      onAdd(p.id);
                      setQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-card border border-transparent hover:border-border hover:bg-white/5 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <Barcode size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate text-foreground">{p.name}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[12px] font-bold text-primary">BS {p.priceBs.toFixed(2)}</span>
                        <span className="text-[10px] text-muted uppercase font-bold">
                          STOCK: {p.stock}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {productResults.length === 0 && (
              <div className="text-center py-10 opacity-30 italic text-sm">Sin resultados</div>
            )}
          </div>
        )}

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
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-transparent hover:bg-white/5 hover:border-border transition-all text-left group"
              >
                <UserCircle size={24} className="text-primary" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-foreground">{c.name}</div>
                  <div className="text-[11px] text-muted">{c.cedula} | {c.phone}</div>
                  {c.debt > 0 && (
                    <div className="mt-1">
                      <span className="text-[10px] font-bold text-[#E74C3C] uppercase">
                        Deuda: BS {c.debt.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
            {clientResults.length === 0 && query && (
               <div className="text-center py-10 opacity-30 italic text-sm">No se encontraron clientes</div>
            )}
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