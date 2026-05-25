"use client";

import { CartItem } from '@/lib/types';
import { ShoppingCart, Trash2, Banknote, Receipt, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onRemove: (id: number) => void;
  onCobrar: () => void;
  exchangeRate: number;
  isRegisterOpen: boolean;
  isIvaEnabled: boolean;
  onIvaToggle: (enabled: boolean) => void;
  nextReceiptNumber?: number;
}

export default function CartPanel({ 
  cart, 
  onUpdateQty, 
  onRemove, 
  onCobrar, 
  exchangeRate, 
  isRegisterOpen,
  isIvaEnabled,
  onIvaToggle,
  nextReceiptNumber = 1
}: CartPanelProps) {
  // Calcular subtotal sumando los precios base de cada item
  const subtotal = cart.reduce((s, i) => s + (i.priceBs * i.qty), 0);
  
  // Calcular IVA solo para productos marcados como "con_iva"
  const iva = cart.reduce((total, item) => {
    const hasIva = (item as any).ivaType === 'con_iva';
    if (hasIva) {
      const itemTotal = item.priceBs * item.qty;
      const ivaDelItem = itemTotal * 0.16;
      return total + ivaDelItem;
    }
    return total;
  }, 0);
  
  const total = subtotal + iva;
  const totalUsd = total / exchangeRate;

  const hasAnyIvaProduct = cart.some(item => (item as any).ivaType === 'con_iva');

  // Formatear número de recibo con 8 dígitos
  const formattedReceiptNumber = nextReceiptNumber.toString().padStart(8, '0');

  // Alternar colores de fila
  const getRowClassName = (index: number) => {
    return index % 2 === 0 ? "bg-white" : "bg-gray-50";
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-r border-black">
      {/* Header con número de recibo */}
      <div className="p-4 border-b border-black bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" />
          <h2 className="text-base font-bold text-black">Carrito de Ventas</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
            <Receipt size={12} className="text-black/60" />
            <span className="text-[10px] font-black text-black">RECIBO #{formattedReceiptNumber}</span>
          </div>
          <span className="bg-secondary text-white px-2.5 py-0.5 rounded-full text-[11px] font-black">
            {cart.length} items
          </span>
        </div>
      </div>

      {/* Tabla de productos - diseño tipo factura */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Cabecera de la tabla */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-100 border-b border-black text-[10px] font-black uppercase tracking-wider text-black/70 shrink-0">
          <div className="col-span-5">Descripción</div>
          <div className="col-span-2 text-center">Cantidad</div>
          <div className="col-span-2 text-right">Precio USD</div>
          <div className="col-span-2 text-right">Precio Bs</div>
          <div className="col-span-1 text-right">Acción</div>
        </div>

        {/* Cuerpo de la tabla - scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
              <ShoppingCart size={48} strokeWidth={1} className="text-black" />
              <p className="text-sm font-medium text-black">Carrito vacío</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const itemTotalBs = item.priceBs * item.qty;
              const priceUsd = item.priceBs / exchangeRate;
              const hasIva = (item as any).ivaType === 'con_iva';
              
              return (
                <div 
                  key={item.productId} 
                  className={cn(
                    "grid grid-cols-12 gap-2 px-4 py-3 border-b border-black/10 transition-all hover:bg-gray-100",
                    getRowClassName(idx)
                  )}
                >
                  {/* Descripción */}
                  <div className="col-span-5">
                    <div className="font-mono text-xs font-bold text-black truncate">
                      {item.name}
                    </div>
                    {hasIva && (
                      <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded mt-0.5 inline-block">
                        IVA INCLUIDO (16%)
                      </span>
                    )}
                  </div>
                  
                  {/* Cantidad con controles + y - */}
                  <div className="col-span-2 flex items-center justify-center gap-1">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                      <button 
                        onClick={() => onUpdateQty(item.productId, -1)} 
                        className="w-5 h-5 rounded-md bg-white text-black hover:bg-primary hover:text-black transition-all flex items-center justify-center shadow-sm"
                      >
                        <ChevronDown size={10} />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-black">
                        {item.qty}
                      </span>
                      <button 
                        onClick={() => onUpdateQty(item.productId, 1)} 
                        className="w-5 h-5 rounded-md bg-white text-black hover:bg-primary hover:text-black transition-all flex items-center justify-center shadow-sm"
                      >
                        <ChevronUp size={10} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Precio USD */}
                  <div className="col-span-2 text-right font-mono text-xs font-bold text-black/70">
                    ${priceUsd.toFixed(2)}
                  </div>
                  
                  {/* Precio Bs (unitario) */}
                  <div className="col-span-2 text-right font-mono text-xs text-black/60">
                    Bs {item.priceBs.toFixed(2)}
                  </div>
                  
                  {/* Acción - eliminar */}
                  <div className="col-span-1 text-right">
                    <button 
                      onClick={() => onRemove(item.productId)} 
                      className="text-black/40 hover:text-red-600 transition-colors p-1"
                      title="Eliminar producto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Totales y botón de cobro */}
      <div className="border-t border-black bg-white shrink-0">
        <div className="p-4 space-y-1.5">
          <div className="flex justify-between font-mono text-[12px]">
            <span className="text-black/60">Subtotal:</span>
            <span className="font-bold text-black">Bs {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-mono text-[12px]">
            <span className="text-black/60">Subtotal USD:</span>
            <span className="font-bold text-black/70">USD {(subtotal / exchangeRate).toFixed(2)}</span>
          </div>
          {hasAnyIvaProduct && iva > 0 && (
            <div className="flex justify-between font-mono text-[12px]">
              <span className="text-black/60">IVA (16%):</span>
              <span className="font-bold text-amber-700">Bs {iva.toFixed(2)}</span>
            </div>
          )}
          <div className="pt-3 mt-2 border-t border-black flex justify-between items-end">
            <div>
              <div className="text-[9px] text-black/60 font-black uppercase tracking-wider">TOTAL A PAGAR</div>
              <div className="font-mono text-2xl font-black text-black">
                Bs {total.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-black/50">
                USD {totalUsd.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <button 
            disabled={cart.length === 0 || !isRegisterOpen}
            onClick={onCobrar}
            className="w-full py-3.5 bg-primary rounded-xl text-black font-black text-sm flex items-center justify-center gap-2.5 hover:brightness-105 active:scale-[0.98] transition-all shadow-md disabled:opacity-30"
          >
            <Banknote size={18} /> COBRAR
          </button>
        </div>
      </div>
    </div>
  );
}