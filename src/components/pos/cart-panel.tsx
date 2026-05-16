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
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
          <ShoppingCart size={18} className="text-primary" /> Carrito
        </h2>
        <span className="bg-primary text-black px-2.5 py-0.5 rounded-full text-[11px] font-black">
          {cart.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-30">
            <ShoppingCart size={48} strokeWidth={1} />
            <p className="text-sm font-medium">Carrito vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg group animate-in fade-in slide-in-from-left-2 transition-all hover:border-primary/40">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate text-foreground leading-tight">{item.name}</div>
                <div className="text-[11px] text-primary font-bold mt-0.5">
                  BS {item.priceBs.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => onUpdateQty(item.productId, -1)} 
                  className="w-6.5 h-6.5 rounded bg-muted/20 text-foreground hover:bg-primary hover:text-black transition-all flex items-center justify-center"
                >
                  <Minus size={12} />
                </button>
                <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                <button 
                  onClick={() => onUpdateQty(item.productId, 1)} 
                  className="w-6.5 h-6.5 rounded bg-muted/20 text-foreground hover:bg-primary hover:text-black transition-all flex items-center justify-center"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="text-[14px] font-bold w-[70px] text-right text-foreground">
                {item.priceBs * item.qty < 1000 ? (item.priceBs * item.qty).toFixed(2) : Math.round(item.priceBs * item.qty)}
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

      <div className="p-4 border-t border-border bg-card/50 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <Label htmlFor="iva-toggle" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer">
            Calcular IVA (16%)
          </Label>
          <Switch 
            id="iva-toggle" 
            checked={isIvaEnabled} 
            onCheckedChange={onIvaToggle}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-[13px] text-muted-foreground">
            <span>Subtotal</span>
            <span>BS {subtotal.toFixed(2)}</span>
          </div>
          <div className={cn(
            "flex justify-between text-[13px] transition-opacity",
            isIvaEnabled ? "text-muted-foreground" : "opacity-20"
          )}>
            <span>IVA (16%)</span>
            <span>BS {iva.toFixed(2)}</span>
          </div>
          <div className="pt-2 mt-2 border-t border-border flex justify-between items-end">
            <div>
              <div className="text-[12px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Total</div>
              <div className="text-2xl font-black leading-none text-foreground tracking-tight">
                BS {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-primary">
                USD {totalUsd.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <button 
          disabled={cart.length === 0 || !isRegisterOpen}
          onClick={onCobrar}
          className="w-full py-3.5 orange-gradient rounded-xl text-black font-black text-base flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg vibrant-glow disabled:opacity-30 disabled:pointer-events-none"
        >
          <Banknote size={18} /> Cobrar
        </button>
      </div>
    </div>
  );
}