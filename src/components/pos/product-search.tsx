"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Client } from '@/lib/types';
import { Search, Barcode, UserCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientPanel from './client-panel';
import { usePOSState } from '@/hooks/use-pos-state';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

// Umbral mínimo de stock por defecto (si el producto no tiene configurado uno)
const DEFAULT_MIN_STOCK = 5;

interface ProductSearchProps {
  state: ReturnType<typeof usePOSState>;
  onAdd: (id: number) => boolean;
}

export default function ProductSearch({ state, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isClientSearch, setIsClientSearch] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const productListRef = useRef<HTMLDivElement>(null);

  // Obtener el stock mínimo de un producto
  const getProductMinStock = (product: any) => {
    return (product as any).minStock || DEFAULT_MIN_STOCK;
  };

  // Obtener color del stock
  const getStockColor = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "text-red-600 bg-red-50";
    } else if (product.stock <= minStock) {
      return "text-yellow-600 bg-yellow-50";
    } else {
      return "text-green-600 bg-green-50";
    }
  };

  // Obtener texto del stock
  const getStockText = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "AGOTADO";
    } else if (product.stock <= minStock) {
      return `STOCK MÍNIMO (${product.stock}/${minStock})`;
    } else {
      return `STOCK: ${product.stock}`;
    }
  };

  // ✅ Mostrar TODOS los productos cuando el input tiene foco (sin query)
  const productResults = useMemo(() => {
    if (!query.trim() && !isFocused) return [];
    const q = query.toLowerCase();
    let filtered = state.products;
    
    if (q) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.barcode.includes(q) || 
        p.category.toLowerCase().includes(q) ||
        (p.department && p.department.toLowerCase().includes(q))
      );
    }
    
    return filtered.slice(0, 30); // Limitar a 30 productos para mejor rendimiento
  }, [query, state.products, isFocused]);

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

  // Obtener todos los productos planos para navegación con teclado
  const allFlatProducts = useMemo(() => {
    return productResults;
  }, [productResults]);

  // Manejar navegación con teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused || isClientSearch || viewingClient) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allFlatProducts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && allFlatProducts[selectedIndex]) {
        e.preventDefault();
        onAdd(allFlatProducts[selectedIndex].id);
        setQuery('');
        setIsFocused(false);
        setSelectedIndex(-1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, isClientSearch, viewingClient, allFlatProducts, selectedIndex, onAdd]);

  // Scroll al elemento seleccionado
  useEffect(() => {
    if (selectedIndex >= 0 && productListRef.current) {
      const selectedElement = document.getElementById(`product-${selectedIndex}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="flex flex-col h-full bg-primary relative">
      <div className="p-3.5 z-50">
        <div className={cn(
          "flex items-center bg-background border border-black/40 rounded-xl px-3 transition-all duration-200",
          isFocused && "border-black shadow-sm"
        )}>
          <Search size={16} className="text-black/40" />
          <input 
            id="pos-search-input"
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setSelectedIndex(-1);
            }}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={isClientSearch ? "Buscar cliente por nombre o cédula..." : "Buscar producto o escanear..."}
            className="flex-1 bg-transparent border-none text-black px-2 py-2.5 text-sm focus:outline-none font-body placeholder:text-black/30"
          />
          {isClientSearch ? (
             <X size={18} className="text-black/40 cursor-pointer hover:text-black" onClick={() => { setIsClientSearch(false); setQuery(''); }} />
          ) : (
             <Barcode size={18} className="text-black/60" />
          )}
        </div>

        <button 
          onClick={() => {
            setIsClientSearch(!isClientSearch);
            setQuery('');
            setViewingClient(null);
            setSelectedIndex(-1);
          }}
          className={cn(
            "w-full mt-2.5 flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold text-[13px] transition-all border border-black/40",
            isClientSearch || viewingClient 
              ? "bg-black/10 text-black border-black/60" 
              : "bg-background/20 text-black/80 hover:bg-black/5 hover:text-black"
          )}
        >
          <UserCircle size={18} />
          {viewingClient ? 'CAMBIAR CLIENTE' : isClientSearch ? 'CANCELAR BÚSQUEDA' : 'VER CLIENTE'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-3.5 space-y-2 scrollbar-thin" ref={productListRef}>
        {!isClientSearch && !viewingClient && (query || isFocused) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            {Object.entries(groupedProductResults).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-black/40 text-sm">No se encontraron productos</p>
              </div>
            ) : (
              Object.entries(groupedProductResults).map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <div className="text-[10px] font-bold text-black/40 uppercase tracking-[0.1em] px-2 mb-1">
                    {category}
                  </div>
                  {items.map((p, idx) => {
                    const globalIndex = productResults.findIndex(prod => prod.id === p.id);
                    const stockColor = getStockColor(p);
                    const stockText = getStockText(p);
                    const isSelected = selectedIndex === globalIndex;
                    
                    return (
                      <button 
                        key={p.id}
                        id={`product-${globalIndex}`}
                        onClick={() => {
                          onAdd(p.id);
                          setQuery('');
                          setIsFocused(false);
                          setSelectedIndex(-1);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                          isSelected 
                            ? "bg-primary/20 border-primary shadow-md" 
                            : "bg-background border-black/30 hover:border-black/60 hover:bg-white/10"
                        )}
                      >
                        <div className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center text-black/60 border border-black/20">
                          <Barcode size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate text-black">{p.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[12px] font-bold text-[#D4A017]">{formatUsd(p.priceUsd)}</span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                              stockColor
                            )}>
                              {stockText}
                            </span>
                            {p.department && (
                              <span className="text-[9px] text-black/40 font-mono">📁 {p.department}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
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
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-background border border-black/30 hover:bg-white/10 hover:border-black/60 transition-all text-left group"
              >
                <UserCircle size={24} className="text-black/60" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-black">{c.name}</div>
                  <div className="text-[11px] text-black/50">{c.cedula} | {c.phone}</div>
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