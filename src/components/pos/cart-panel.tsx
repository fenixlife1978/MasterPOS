"use client";

import { CartItem } from '@/lib/types';
import { ShoppingCart, Trash2, Minus, Plus, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onRemove: (id: number) => void;
  onCobrar: () => void;
  exchangeRate: number;
  isRegisterOpen: boolean;
}

export default function CartPanel({ cart, onUpdateQty, onRemove, onCobrar, exchangeRate, isRegisterOpen }: CartPanelProps) {
  const subtotal = cart.reduce((s, i) => s + (i.priceBs * i.qty), 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;
  const totalUsd = total / exchangeRate;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-[#111111] flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
          <ShoppingCart size={18} /> Carrito de Venta
        </h2>
        <span className="bg-primary text-background px-2.5 py-0.5 rounded-full text-[11px] font-black">
          {cart.length} ITEMS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4 opacity-20">
            <ShoppingCart size={64} strokeWidth={1} />
            <p className="text-xs font-black uppercase tracking-[0.3em]">Carrito Vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl group transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate text-foreground">{item.name}</div>
                <div className="text-[10px] text-primary font-black mt-1">
                  BS {item.priceBs.toFixed(2)} / UNIT
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 bg-secondary/50 p-1 rounded-lg border border-border">
                <button 
                  onClick={() => onUpdateQty(item.productId, -1)} 
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-destructive hover:text-foreground transition-colors text-muted"
                >
                  <Minus size={12} />
                </button>
                <span className="text-xs font-black w-6 text-center text-foreground">{item.qty}</span>
                <button 
                  onClick={() => onUpdateQty(item.productId, 1)} 
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-primary hover:text-background transition-colors text-muted"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="text-sm font-black w-24 text-right">
                BS {(item.priceBs * item.qty).toFixed(2)}
              </div>
              
              <button 
                onClick={() => onRemove(item.productId)} 
                className="text-muted/30 hover:text-destructive transition-colors ml-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-6 border-t border-border bg-[#0a0a0a]">
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-[11px] text-muted font-bold uppercase tracking-wider">
            <span>Subtotal</span>
            <span>BS {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted font-bold uppercase tracking-wider">
            <span>IVA (16%)</span>
            <span>BS {iva.toFixed(2)}</span>
          </div>
          <div className="pt-4 mt-2 border-t border-border/50 flex justify-between items-end">
            <div>
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total Final</div>
              <div className="text-3xl font-black leading-none tracking-tighter text-foreground">
                BS {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-primary uppercase tracking-wider">
                USD {totalUsd.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted font-bold mt-1">Tasa: {exchangeRate.toFixed(2)} BS/USD</div>
            </div>
          </div>
        </div>

        <button 
          disabled={cart.length === 0 || !isRegisterOpen}
          onClick={onCobrar}
          className="w-full py-4 bg-gradient-to-r from-primary to-[#A67C00] rounded-xl text-background font-black text-sm flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-primary/20 disabled:opacity-20 disabled:pointer-events-none"
        >
          <Banknote size={20} /> FINALIZAR VENTA
        </button>
      </div>
    </div>
  );
}
