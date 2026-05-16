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
    <div className="flex flex-col h-full bg-background border-l border-r border-black">
      <div className="p-4 border-b border-black bg-background flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2 text-black">
          <ShoppingCart size={18} className="text-primary" /> Carrito
        </h2>
        <span className="bg-secondary text-white px-2.5 py-0.5 rounded-full text-[11px] font-black">
          {cart.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
            <ShoppingCart size={48} strokeWidth={1} className="text-black" />
            <p className="text-sm font-medium text-black">Carrito vacío</p>
          </div>
        ) : (
          cart.map((item) => {
            const itemTotalBs = item.priceBs * item.qty;
            const itemTotalUsd = itemTotalBs / exchangeRate;
            const priceUsd = item.priceBs / exchangeRate;
            
            return (
              <div key={item.productId} className="flex flex-col p-3 bg-white border border-black/40 rounded-xl group hover:border-black transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-black leading-tight">
                      {item.name}
                    </div>
                  </div>
                  <button 
                    onClick={() => onRemove(item.productId)} 
                    className="text-black/40 hover:text-red-600 transition-colors p-1 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1">
                    <button 
                      onClick={() => onUpdateQty(item.productId, -1)} 
                      className="w-7 h-7 rounded-md bg-white text-black hover:bg-primary hover:text-black transition-all flex items-center justify-center shadow-sm"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center text-black">
                      {item.qty}
                    </span>
                    <button 
                      onClick={() => onUpdateQty(item.productId, 1)} 
                      className="w-7 h-7 rounded-md bg-white text-black hover:bg-primary hover:text-black transition-all flex items-center justify-center shadow-sm"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-black">
                      Bs {itemTotalBs.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-medium text-black/60">
                      USD {itemTotalUsd.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-black/10">
                  <div className="text-[10px] text-black/50">
                    {priceUsd.toFixed(2)} USD c/u
                  </div>
                  <div className="text-[10px] text-black/50">
                    Bs {item.priceBs.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-6 border-t border-black bg-background shrink-0">
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="iva-toggle" className="text-[11px] font-black text-black uppercase tracking-wider cursor-pointer">
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
          <div className="flex justify-between text-[13px] font-medium text-black">
            <span>Subtotal</span>
            <span>Bs {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[13px] font-medium text-black">
            <span>Subtotal USD</span>
            <span>USD {(subtotal / exchangeRate).toFixed(2)}</span>
          </div>
          <div className={cn(
            "flex justify-between text-[13px] font-medium transition-opacity",
            isIvaEnabled ? "text-black" : "opacity-30"
          )}>
            <span>IVA (16%)</span>
            <span>Bs {iva.toFixed(2)}</span>
          </div>
          <div className="pt-4 mt-4 border-t border-black flex justify-between items-end">
            <div>
              <div className="text-[10px] text-black/60 font-black mb-1 uppercase tracking-widest">TOTAL</div>
              <div className="text-3xl font-black leading-none text-black tracking-tight">
                Bs {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-black/60">
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