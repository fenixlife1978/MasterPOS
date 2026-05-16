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
    <div className="flex flex-col h-full bg-[#f1f5f9]">
      <div className="p-4 border-b border-border bg-white flex items-center justify-between shrink-0">
        <h2 className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-foreground">
          <ShoppingCart size={20} className="text-primary" /> Carrito
        </h2>
        <span className="bg-primary text-accent px-3 py-0.5 rounded-full text-[10px] font-black shadow-sm">
          {cart.length} ITEMS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-30">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted flex items-center justify-center">
              <ShoppingCart size={32} strokeWidth={1} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest">Carrito vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 p-2.5 bg-[#f8fafc] border border-border rounded-xl group animate-in fade-in slide-in-from-left-1 transition-all hover:border-primary/50 hover:shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold truncate uppercase text-foreground leading-tight">{item.name}</div>
                <div className="text-[10px] text-accent font-black mt-0.5">
                  BS {item.priceBs.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-border">
                <button 
                  onClick={() => onUpdateQty(item.productId, -1)} 
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-destructive hover:text-white transition-colors text-muted-foreground"
                >
                  <Minus size={12} />
                </button>
                <span className="text-[12px] font-black w-4 text-center">{item.qty}</span>
                <button 
                  onClick={() => onUpdateQty(item.productId, 1)} 
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-primary hover:text-accent transition-colors text-muted-foreground"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="text-[13px] font-black w-20 text-right text-foreground">
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

      <div className="p-6 border-t border-border bg-white shrink-0">
        <div className="flex items-center justify-between mb-4 px-1">
          <Label htmlFor="iva-toggle" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest cursor-pointer">
            Calcular IVA (16%)
          </Label>
          <Switch 
            id="iva-toggle" 
            checked={isIvaEnabled} 
            onCheckedChange={onIvaToggle}
            className="data-[state=checked]:bg-secondary"
          />
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-[11px] text-muted-foreground font-bold uppercase">
            <span>Subtotal</span>
            <span>BS {subtotal.toFixed(2)}</span>
          </div>
          <div className={cn(
            "flex justify-between text-[11px] font-bold uppercase transition-opacity",
            isIvaEnabled ? "text-muted-foreground" : "text-muted-foreground/30"
          )}>
            <span>IVA (16%)</span>
            <span>BS {iva.toFixed(2)}</span>
          </div>
          <div className="pt-4 mt-2 border-t border-border flex justify-between items-end">
            <div>
              <div className="text-[10px] font-black text-foreground uppercase tracking-tight mb-0.5">Total</div>
              <div className="text-2xl font-black leading-none tracking-tighter text-foreground">
                BS {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-black text-primary uppercase">
                USD {totalUsd.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground font-black mt-1 uppercase tracking-tighter">Tasa: {exchangeRate.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <button 
          disabled={cart.length === 0 || !isRegisterOpen}
          onClick={onCobrar}
          className="w-full py-4 bg-primary rounded-xl text-accent font-black text-base flex items-center justify-center gap-3 hover:brightness-105 active:scale-[0.98] transition-all shadow-lg shadow-primary/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Banknote size={20} /> Cobrar
        </button>
      </div>
    </div>
  );
}
