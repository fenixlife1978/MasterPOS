"use client";

import { CartItem } from '@/lib/types';
import { ShoppingCart, Trash2, Banknote, Receipt, ChevronUp, ChevronDown, Tag, PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import PriceTypeModal from './PriceTypeModal';

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
  products: any[];
  onUpdatePrice: (productId: number, newPriceUsd: number, newPriceBs: number) => void;
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
  nextReceiptNumber = 1,
  products,
  onUpdatePrice
}: CartPanelProps) {
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState<number | null>(null);

  const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;
  const currentCartItem = selectedProductId ? cart.find(item => item.productId === selectedProductId) : null;

  const handlePriceChange = (productId: number, newPriceUsd: number) => {
    const newPriceBs = newPriceUsd * exchangeRate;
    onUpdatePrice(productId, newPriceUsd, newPriceBs);
    setShowPriceModal(false);
    setSelectedProductId(null);
  };

  const openPriceModal = (productId: number) => {
    setSelectedProductId(productId);
    setShowPriceModal(true);
  };

  const getFullProduct = (productId: number) => {
    return products.find(p => p.id === productId);
  };

  const subtotal = cart.reduce((s, i) => s + (i.priceBs * i.qty), 0);
  const iva = cart.reduce((total, item) => {
    const hasIva = (item as any).ivaType === 'con_iva';
    if (hasIva) return total + (item.priceBs * item.qty * 0.16);
    return total;
  }, 0);
  const total = subtotal + iva;
  const totalUsd = total / exchangeRate;
  const hasAnyIvaProduct = cart.some(item => (item as any).ivaType === 'con_iva');
  const formattedReceiptNumber = nextReceiptNumber.toString().padStart(8, '0');
  const getRowClassName = (index: number) => index % 2 === 0 ? "bg-white" : "bg-gray-50";

  return (
    <>
      <div className="flex flex-col h-full bg-white border-l border-r border-black">
        {/* Header con número de recibo */}
        <div className="p-4 border-b border-black bg-white flex items-center justify-between shrink-0 flex-wrap gap-2">
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

        {/* Tabla */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Cabecera con distribución mejorada */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-100 border-b border-black text-[10px] font-black uppercase tracking-wider text-black/70 shrink-0">
            <div className="col-span-4 text-left">Descripción</div>
            <div className="col-span-2 text-center">Cantidad</div>
            <div className="col-span-2 text-center">
              Precio <span className="block text-[8px] font-normal">(USD)</span>
            </div>
            <div className="col-span-2 text-center">
              Precio <span className="block text-[8px] font-normal">(Bs)</span>
            </div>
            <div className="col-span-1 text-right">
              Sub <span className="block text-[8px] font-normal">Total</span>
            </div>
            <div className="col-span-1 text-right">Acción</div>
          </div>

          {/* Cuerpo scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
                <ShoppingCart size={48} strokeWidth={1} className="text-black" />
                <p className="text-sm font-medium text-black">Carrito vacío</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const priceUsd = item.priceBs / exchangeRate;
                const hasIva = (item as any).ivaType === 'con_iva';
                const isKit = (item as any).isKit === true;
                const fullProduct = getFullProduct(item.productId);
                const kitComponents = fullProduct?.kitComponents || [];
                const itemSubtotal = item.priceBs * item.qty;

                return (
                  <div 
                    key={item.productId} 
                    className={cn(
                      "grid grid-cols-12 gap-2 px-4 py-3 border-b border-black/10 transition-all hover:bg-gray-100",
                      getRowClassName(idx)
                    )}
                  >
                    {/* Descripción */}
                    <div className="col-span-4">
                      <div className="flex items-center justify-between">
                        <div 
                          className="relative flex items-center gap-1 font-mono text-xs font-bold text-black truncate"
                          onMouseEnter={() => isKit && setTooltipVisible(item.productId)}
                          onMouseLeave={() => setTooltipVisible(null)}
                        >
                          <span className="truncate">{item.name}</span>
                          {isKit && (
                            <span title="Producto compuesto (kit/combos)">
                              <PackageOpen size={12} className="text-blue-500 flex-shrink-0" />
                            </span>
                          )}
                          {isKit && tooltipVisible === item.productId && (
                            <div className="absolute top-full left-0 z-20 mt-1 bg-gray-800 text-white text-[9px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                              {kitComponents.map((comp: any) => {
                                const child = products.find(p => p.id === comp.productId);
                                return <div key={comp.productId}>{child?.name || 'Producto'} x{comp.quantity}</div>;
                              })}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => openPriceModal(item.productId)}
                          className="text-blue-600 hover:text-blue-800 transition-colors ml-2"
                          title="Cambiar tipo de precio"
                        >
                          <Tag size={12} />
                        </button>
                      </div>
                      {hasIva && (
                        <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded mt-0.5 inline-block">
                          IVA INCLUIDO (16%)
                        </span>
                      )}
                    </div>
                    
                    {/* Cantidad con controles +/ - */}
                    <div className="col-span-2 flex items-center justify-center">
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
                    
                    {/* Precio USD centrado */}
                    <div className="col-span-2 text-center">
                      <div className="font-mono text-xs font-bold text-black/70">
                        ${priceUsd.toFixed(2)}
                      </div>
                      <div className="text-[8px] text-black/40">USD</div>
                    </div>
                    
                    {/* Precio Bs centrado */}
                    <div className="col-span-2 text-center">
                      <div className="font-mono text-xs font-bold text-black/60">
                        Bs {item.priceBs.toFixed(2)}
                      </div>
                      <div className="text-[8px] text-black/40">Bs</div>
                    </div>
                    
                    {/* Subtotal del producto */}
                    <div className="col-span-1 text-right font-mono text-xs font-bold text-black">
                      Bs {itemSubtotal.toFixed(2)}
                    </div>
                    
                    {/* Botón eliminar */}
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

      {/* Modal para seleccionar tipo de precio */}
      {showPriceModal && selectedProduct && currentCartItem && (
        <PriceTypeModal
          product={selectedProduct}
          currentItem={currentCartItem}
          exchangeRate={exchangeRate}
          onClose={() => {
            setShowPriceModal(false);
            setSelectedProductId(null);
          }}
          onSelect={(newPriceUsd: number) => handlePriceChange(selectedProduct.id, newPriceUsd)}
        />
      )}
    </>
  );
}