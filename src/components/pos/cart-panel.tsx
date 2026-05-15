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
    <>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" /> Carrito
        </h2>
        <span className="bg-primary text-background px-2 py-0.5 rounded-full text-[10px] font-black">{cart.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-3 opacity-30">
            <ShoppingCart size={48} />
            <p className="text-sm font-medium">Carrito Vacío</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border animate-in slide-in-from-left-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate leading-tight">{item.name}</div>
                  <div className="text-[10px] text-primary font-bold mt-1">BS {item.priceBs.toFixed(2)} c/u</div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => onUpdateQty(item.productId, -1)} className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center hover:bg-primary hover:text-background transition-colors"><Minus size={12} /></button>
                  <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                  <button onClick={() => onUpdateQty(item.productId, 1)} className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center hover:bg-primary hover:text-background transition-colors"><Plus size={12} /></button>
                </div>

                <div className="text-sm font-black w-20 text-right">BS {(item.priceBs * item.qty).toFixed(2)}</div>
                
                <button onClick={() => onRemove(item.productId)} className="text-muted hover:text-destructive transition-colors"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-[#111111]">
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>BS {subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>IVA (16%)</span><span>BS {iva.toFixed(2)}</span></div>
          <div className="pt-2 mt-2 border-t border-border flex justify-between items-end">
            <span className="text-base font-bold">Total</span>
            <div className="text-right">
              <div className="text-xl font-black leading-none">BS {total.toFixed(2)}</div>
              <div className="text-[11px] text-primary font-bold mt-1 uppercase tracking-wider">USD {totalUsd.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <button 
          disabled={cart.length === 0 || !isRegisterOpen}
          onClick={onCobrar}
          className="w-full py-3.5 bg-gradient-to-r from-primary to-[#A67C00] rounded-lg text-background font-black text-base flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all shadow-xl shadow-primary/10 disabled:opacity-30 disabled:translate-y-0"
        >
          <Banknote size={18} /> COBRAR
        </button>
      </div>
    </>
  );
}
