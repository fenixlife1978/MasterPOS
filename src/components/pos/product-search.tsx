"use client";

import { useState, useMemo } from 'react';
import { Product } from '@/lib/types';
import { Search, Barcode, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  products: Product[];
  onAdd: (id: number) => boolean;
  onToggleView: () => void;
  isClientView: boolean;
}

export default function ProductSearch({ products, onAdd, onToggleView, isClientView }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.barcode.includes(q) || 
      p.category.toLowerCase().includes(q)
    );
  }, [query, products]);

  const groups = useMemo(() => {
    const g: Record<string, Product[]> = {};
    results.forEach(p => {
      if (!g[p.category]) g[p.category] = [];
      g[p.category].push(p);
    });
    return g;
  }, [results]);

  return (
    <div className="p-3.5 relative z-50">
      <div className={cn(
        "flex items-center bg-card border border-border rounded-lg px-3 transition-colors mb-3",
        isFocused && "border-primary"
      )}>
        <Search size={14} className="text-muted" />
        <input 
          id="pos-search-input"
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Buscar producto o escanear..."
          className="flex-1 bg-transparent border-none text-foreground px-2 py-2.5 text-sm focus:outline-none font-body"
        />
        <Barcode size={16} className="text-primary animate-pulse-scan" />
      </div>

      <button 
        onClick={onToggleView}
        className={cn(
          "w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-border bg-card text-xs font-bold transition-all",
          isClientView ? "bg-primary/10 border-primary text-primary" : "text-muted hover:text-foreground hover:border-primary"
        )}
      >
        <UserCircle size={16} />
        {isClientView ? 'BUSCAR CLIENTE' : 'VER CLIENTE'}
      </button>

      {isFocused && query.trim() && (
        <div className="absolute top-[62px] left-3.5 right-3.5 max-h-[420px] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-1.5 scrollbar-thin">
          {results.length === 0 ? (
            <div className="text-center py-6 text-muted text-xs">Sin resultados</div>
          ) : (
            Object.entries(groups).map(([cat, prods]) => (
              <div key={cat}>
                <div className="text-[10px] uppercase tracking-wider text-muted px-2 py-2 font-bold">{cat}</div>
                {prods.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { onAdd(p.id); setQuery(''); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary text-left group border border-transparent hover:border-border transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <StoreIcon category={p.category} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-primary font-bold">BS {p.priceBs.toFixed(2)} / USD {p.priceUsd.toFixed(2)}</div>
                    </div>
                    <div className="text-[10px] text-muted">{p.stock} uds</div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StoreIcon({ category }: { category: string }) {
  // Mock icons for categories
  return <Search size={16} />;
}
