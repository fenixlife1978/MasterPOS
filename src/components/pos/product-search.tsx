"use client";

import { useState, useMemo } from 'react';
import { Product } from '@/lib/types';
import { Search, Barcode, Wine, Beer, Martini, GlassWater } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  products: Product[];
  onAdd: (id: number) => boolean;
}

export default function ProductSearch({ products, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return products; // Mostramos todos por defecto si no hay búsqueda
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
    <div className="flex flex-col h-full">
      <div className="p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/50">
        <div className={cn(
          "flex items-center bg-card border border-border rounded-xl px-4 transition-all duration-300 shadow-inner",
          isFocused && "border-primary ring-1 ring-primary/20 bg-card/80"
        )}>
          <Search size={18} className="text-muted" />
          <input 
            id="pos-search-input"
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Nombre, marca o código..."
            className="flex-1 bg-transparent border-none text-foreground px-3 py-3.5 text-sm focus:outline-none font-body placeholder:text-muted/50"
          />
          <Barcode size={20} className="text-primary/60 animate-pulse-scan" />
        </div>
      </div>

      <div className="flex-1 p-2 space-y-4">
        {results.length === 0 ? (
          <div className="text-center py-20 text-muted opacity-50 flex flex-col items-center gap-3">
            <Search size={40} />
            <p className="text-sm font-medium italic">No se encontraron licores</p>
          </div>
        ) : (
          Object.entries(groups).map(([cat, prods]) => (
            <div key={cat} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted font-black">{cat}</span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              
              <div className="grid grid-cols-1 gap-1">
                {prods.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { onAdd(p.id); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 text-left group border border-transparent hover:border-primary/20 transition-all duration-200 bg-card/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <CategoryIcon category={p.category} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate text-foreground/90 group-hover:text-primary transition-colors">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-black text-primary">BS {p.priceBs.toFixed(2)}</span>
                        <span className="text-[10px] text-muted font-medium">|</span>
                        <span className="text-[10px] text-muted uppercase font-bold tracking-tighter">Stock: {p.stock}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const c = category.toLowerCase();
  if (c.includes('whisky')) return <Martini size={18} />;
  if (c.includes('ron')) return <GlassWater size={18} />;
  if (c.includes('cerveza')) return <Beer size={18} />;
  if (c.includes('vino')) return <Wine size={18} />;
  return <Wine size={18} />;
}
