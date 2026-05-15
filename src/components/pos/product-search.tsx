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
    if (!query.trim()) return products;
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
    <div className="flex flex-col h-full bg-[#0C0B0A]">
      <div className="p-4 bg-[#111111] border-b border-border">
         <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mb-4">Búsqueda Inteligente</h2>
         <div className={cn(
          "flex items-center bg-card border border-border rounded-xl px-4 transition-all duration-300 shadow-2xl",
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
            placeholder="Escanear o escribir..."
            className="flex-1 bg-transparent border-none text-foreground px-3 py-4 text-sm focus:outline-none font-body placeholder:text-muted/30 uppercase font-bold"
          />
          <Barcode size={20} className="text-primary/40" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {results.length === 0 ? (
          <div className="text-center py-20 text-muted opacity-30 flex flex-col items-center gap-4">
            <Search size={48} strokeWidth={1} />
            <p className="text-xs font-black uppercase tracking-widest italic">Sin resultados</p>
          </div>
        ) : (
          Object.entries(groups).map(([cat, prods]) => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[9px] uppercase tracking-[0.4em] text-primary/50 font-black whitespace-nowrap">{cat}</span>
                <div className="h-px w-full bg-border/40" />
              </div>
              
              <div className="grid grid-cols-1 gap-1.5">
                {prods.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => onAdd(p.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-card/30 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-primary/60 group-hover:text-primary transition-colors">
                      <CategoryIcon category={p.category} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate text-foreground group-hover:text-primary transition-colors uppercase tracking-tight">{p.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] font-black text-primary">BS {p.priceBs.toFixed(2)}</span>
                        <span className="text-[9px] text-muted font-bold uppercase tracking-tighter">Stock: {p.stock}</span>
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
