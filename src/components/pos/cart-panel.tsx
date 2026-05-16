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
    <div className="flex flex-col h-full bg-background border-x border-black/5">
      <div className="p-4 border-b border-black/5 bg-background flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
          <ShoppingCart size={18} className="text-primary" /> Carrito
        </h2>
        <span className="bg-secondary text-white px-2.5 py-0.5 rounded-full text-[11px] font-black">
          {cart.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-30">
            <ShoppingCart size={48} strokeWidth={1} />
            <p className="text-sm font-medium">Carrito vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 p-3 bg-white/50 border border-black/5 rounded-xl group animate-in fade-in slide-in-from-left-2 hover:border-primary/40 transition-all">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold truncate text-foreground leading-tight">{item.name}</div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  BS {item.priceBs.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onUpdateQty(item.productId, -1)} 
                  className="w-7 h-7 rounded-lg bg-muted text-foreground hover:bg-primary hover:text-black transition-all flex items-center justify-center"
                >
                  <Minus size={12} />
                </button>
                <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                <button 
                  onClick={() => onUpdateQty(item.productId, 1)} 
                  className="w-7 h-7 rounded-lg bg-muted text-foreground hover:bg-primary hover:text-black transition-all flex items-center justify-center"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="text-[14px] font-black w-[80px] text-right text-foreground">
                BS {(item.priceBs * item.qty).toFixed(2)}
              </div>
              
              <button 
                onClick={() => onRemove(item.productId)} 
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-6 border-t border-black/5 bg-background shrink-0">
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="iva-toggle" className="text-[11px] font-black text-foreground uppercase tracking-wider cursor-pointer">
            CALCULAR IVA (16%)
          </Label>
          <Switch 
            id="iva-toggle" 
            checked={isIvaEnabled} 
            onCheckedChange={onIvaToggle}
            className="data-[state=checked]:bg-secondary"
          />
        </div>

        <div className="space-y-1.5 mb-6">
          <div className="flex justify-between text-[13px] font-medium text-muted-foreground">
            <span>Subtotal</span>
            <span>BS {subtotal.toFixed(2)}</span>
          </div>
          <div className={cn(
            "flex justify-between text-[13px] font-medium transition-opacity",
            isIvaEnabled ? "text-muted-foreground" : "opacity-20"
          )}>
            <span>IVA (16%)</span>
            <span>BS {iva.toFixed(2)}</span>
          </div>
          <div className="pt-4 mt-4 border-t border-black/10 flex justify-between items-end">
            <div>
              <div className="text-[10px] text-muted-foreground font-black mb-1 uppercase tracking-widest">TOTAL</div>
              <div className="text-3xl font-black leading-none text-foreground tracking-tight">
                BS {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-foreground opacity-60">
                USD {totalUsd.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <button 
          disabled={cart.length === 0 || !isRegisterOpen}
          onClick={onCobrar}
          className="w-full py-4 bg-primary rounded-xl text-black font-black text-base flex items-center justify-center gap-2.5 hover:brightness-105 active:scale-[0.98] transition-all shadow-md disabled:opacity-30"
        >
          <Banknote size={18} /> Cobrar
        </button>
      </div>
    </div>
  );
}