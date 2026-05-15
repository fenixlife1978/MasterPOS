"use client";

import { CartItem } from '@/lib/types';
import { ShoppingCart, Trash2, Minus, Plus, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onRemove: (id: number) => void;
  onCobrar: () => void;
  exchangeRate: number;
  isRegisterOpen: boolean;
  isIvaEnabled: boolean;
  onIvaToggle: (enabled: boolean) => void;
}

export default function CartPanel({ 
  cart, 
  onUpdateQty, 
  onRemove, 
  onCobrar, 
  exchangeRate, 
  isRegisterOpen,
  isIvaEnabled,
  onIvaToggle
}: CartPanelProps) {
  const subtotal = cart.reduce((s, i) => s + (i.priceBs * i.qty), 0);
  const iva = isIvaEnabled ? subtotal * 0.16 : 0;
  const total = subtotal + iva;
  const totalUsd = total / exchangeRate;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-muted bg-muted/30 flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3 text-foreground">
          <ShoppingCart size={24} className="text-primary" /> Carrito
        </h2>
        <span className="bg-primary text-black px-4 py-1 rounded-full text-xs font-black shadow-sm">
          {cart.length} ITEMS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-6 opacity-30">
            <div className="w-24 h-24 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
              <ShoppingCart size={48} strokeWidth={1} />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">Carrito vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-4 p-4 bg-white border border-border rounded-2xl group animate-in fade-in slide-in-from-left-2 transition-all hover:shadow-md">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate uppercase text-foreground">{item.name}</div>
                <div className="text-xs text-secondary font-black mt-1">
                  BS {item.priceBs.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
                <button 
                  onClick={() => onUpdateQty(item.productId, -1)} 
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive hover:text-white transition-colors text-muted-foreground"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-black w-6 text-center">{item.qty}</span>
                <button 
                  onClick={() => onUpdateQty(item.productId, 1)} 
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary hover:text-black transition-colors text-muted-foreground"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="text-base font-black w-24 text-right text-foreground">
                BS {(item.priceBs * item.qty).toFixed(2)}
              </div>
              
              <button 
                onClick={() => onRemove(item.productId)} 
                className="text-muted-foreground hover:text-destructive transition-colors ml-2 p-2"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-8 border-t border-muted bg-white">
        <div className="flex items-center justify-between mb-6 px-1">
          <Label htmlFor="iva-toggle" className="text-xs font-black text-muted-foreground uppercase tracking-widest cursor-pointer">
            Calcular IVA (16%)
          </Label>
          <Switch 
            id="iva-toggle" 
            checked={isIvaEnabled} 
            onCheckedChange={onIvaToggle}
            className="data-[state=checked]:bg-secondary"
          />
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex justify-between text-sm text-muted-foreground font-bold uppercase">
            <span>Subtotal</span>
            <span>BS {subtotal.toFixed(2)}</span>
          </div>
          <div className={cn(
            "flex justify-between text-sm font-bold uppercase transition-opacity",
            isIvaEnabled ? "text-muted-foreground" : "text-muted-foreground/30"
          )}>
            <span>IVA (16%)</span>
            <span>BS {iva.toFixed(2)}</span>
          </div>
          <div className="pt-6 mt-4 border-t border-muted flex justify-between items-end">
            <div>
              <div className="text-sm font-black text-foreground uppercase tracking-tight mb-1">Total</div>
              <div className="text-4xl font-black leading-none tracking-tighter text-foreground">
                BS {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-primary uppercase">
                USD {totalUsd.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground font-black mt-2 uppercase tracking-tighter">Tasa: {exchangeRate.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <button 
          disabled={cart.length === 0 || !isRegisterOpen}
          onClick={onCobrar}
          className="w-full py-5 bg-primary rounded-2xl text-black font-black text-lg flex items-center justify-center gap-4 hover:brightness-105 active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Banknote size={24} /> Cobrar
        </button>
      </div>
    </div>
  );
}
