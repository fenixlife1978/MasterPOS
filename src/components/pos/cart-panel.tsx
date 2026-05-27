"use client";

import { CartItem } from '@/lib/types';
import { ShoppingCart, Trash2, Banknote, Receipt, Tag, PackageOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import PriceTypeModal from './PriceTypeModal';

// ✅ NUEVA FUNCIÓN DE FORMATEO
const formatBs = (amount: number): string => {
  if (isNaN(amount)) return 'Bs. 0,00';
  return 'Bs. ' + amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatUsd = (amount: number): string => {
  if (isNaN(amount)) return 'USD $0,00';
  return 'USD $' + amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

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

  // ✅ Función para verificar si un kit tiene stock suficiente de sus componentes
  const isKitStockSufficient = (item: CartItem): boolean => {
    const fullProduct = getFullProduct(item.productId);
    if (!fullProduct?.isKit || !fullProduct?.kitComponents?.length) return true;
    
    for (const component of fullProduct.kitComponents) {
      const componentProduct = products.find(p => p.id === component.productId);
      if (!componentProduct) return false;
      const neededQuantity = component.quantity * item.qty;
      if (componentProduct.stock < neededQuantity) {
        return false;
      }
    }
    return true;
  };

  // ✅ Verificar si hay algún kit sin stock suficiente en el carrito
  const hasInsufficientKitStock = cart.some(item => {
    const fullProduct = getFullProduct(item.productId);
    if (fullProduct?.isKit && fullProduct?.kitComponents?.length) {
      return !isKitStockSufficient(item);
    }
    return false;
  });

  // ✅ Manejar cambio de cantidad directamente
  const handleQuantityChange = (productId: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) {
      onUpdateQty(productId, -999); // Esto eliminará el item si la cantidad es 0 o inválida
    } else {
      const currentItem = cart.find(item => item.productId === productId);
      if (currentItem) {
        const delta = newQty - currentItem.qty;
        onUpdateQty(productId, delta);
      }
    }
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
  
  // ✅ Formateo correlativo de recibo (8 dígitos)
  const formattedReceiptNumber = nextReceiptNumber.toString().padStart(8, '0');
  
  const getRowClassName = (index: number) => index % 2 === 0 ? "bg-white" : "bg-gray-50";

  return (
    <>
      <div className="flex flex-col h-full bg-white border-l border-r border-black">
        {/* Header con número de recibo */}
        <div className="p-4 border-b border-black bg-white flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-primary" />
            <h2 className="text-lg font-black text-black">Carrito de Ventas</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full">
              <Receipt size={14} className="text-black/70" />
              <span className="text-[11px] font-black text-black uppercase">Recibo #{formattedReceiptNumber}</span>
            </div>
            <span className="bg-secondary text-white px-2.5 py-1 rounded-full text-xs font-black">
              {cart.length} items
            </span>
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Cabecera - Ajustada la columna de cantidad más angosta */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-100 border-b border-black text-[11px] font-black uppercase tracking-wider text-black/80 shrink-0">
            <div className="col-span-5 text-left">Descripción</div>
            <div className="col-span-1 text-center">Cant</div>
            <div className="col-span-2 text-center">
              Precio <span className="block text-[9px] font-normal">(USD)</span>
            </div>
            <div className="col-span-2 text-center">
              Precio <span className="block text-[9px] font-normal">(Bs)</span>
            </div>
            <div className="col-span-1 text-right">
              Sub <span className="block text-[9px] font-normal">Total</span>
            </div>
            <div className="col-span-1 text-right">Acción</div>
          </div>

          {/* Cuerpo scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
                <ShoppingCart size={56} strokeWidth={1.5} className="text-black/60" />
                <p className="text-base font-semibold text-black/70">Carrito vacío</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const priceUsd = item.priceUsd;
                const hasIva = (item as any).ivaType === 'con_iva';
                const isKit = (item as any).isKit === true;
                const fullProduct = getFullProduct(item.productId);
                const kitComponents = fullProduct?.kitComponents || [];
                const itemSubtotal = item.priceBs * item.qty;
                const kitHasStock = isKitStockSufficient(item);
                const kitStockWarning = isKit && !kitHasStock;

                return (
                  <div 
                    key={item.productId} 
                    className={cn(
                      "grid grid-cols-12 gap-2 px-4 py-3 border-b border-black/10 transition-all hover:bg-gray-100",
                      kitStockWarning && "bg-red-50 border-l-4 border-l-red-500",
                      getRowClassName(idx)
                    )}
                  >
                    {/* Descripción - Ocupa más espacio (col-span-5) */}
                    <div className="col-span-5">
                      <div className="flex items-center justify-between gap-2">
                        <div 
                          className="relative flex items-center gap-2 font-mono text-sm font-bold text-black truncate flex-1"
                          onMouseEnter={() => isKit && setTooltipVisible(item.productId)}
                          onMouseLeave={() => setTooltipVisible(null)}
                        >
                          <span className="truncate">{item.name}</span>
                          {isKit && (
                            <span title="Producto compuesto (kit/combos)">
                              <PackageOpen size={14} className="text-blue-500 flex-shrink-0" />
                            </span>
                          )}
                          {kitStockWarning && (
                            <span title="Stock insuficiente de componentes">
                              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                            </span>
                          )}
                          {isKit && tooltipVisible === item.productId && (
                            <div className="absolute top-full left-0 z-20 mt-1 bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                              {kitComponents.map((comp: any) => {
                                const child = products.find(p => p.id === comp.productId);
                                const childStock = child?.stock || 0;
                                const needed = comp.quantity * item.qty;
                                const hasEnough = childStock >= needed;
                                return (
                                  <div key={comp.productId} className={!hasEnough ? "text-red-300" : ""}>
                                    {child?.name || 'Producto'} x{comp.quantity} 
                                    {!hasEnough && ` (Stock: ${childStock} → necesita ${needed})`}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => openPriceModal(item.productId)}
                          className="text-blue-600 hover:text-blue-800 transition-colors flex-shrink-0"
                          title="Cambiar tipo de precio"
                        >
                          <Tag size={14} />
                        </button>
                      </div>
                      {hasIva && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                          IVA INCLUIDO (16%)
                        </span>
                      )}
                      {kitStockWarning && (
                        <span className="text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                          Stock insuficiente de componentes
                        </span>
                      )}
                    </div>
                    
                    {/* Cantidad - Input numérico directo, más angosto */}
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            handleQuantityChange(item.productId, val);
                          } else if (e.target.value === '') {
                            // Permitir campo vacío temporalmente
                          } else {
                            handleQuantityChange(item.productId, 0);
                          }
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val) || val <= 0) {
                            handleQuantityChange(item.productId, 0);
                          }
                        }}
                        className="w-14 text-center text-base font-black text-black bg-gray-100 rounded-lg px-2 py-1.5 border border-gray-200 focus:border-primary focus:outline-none"
                      />
                    </div>
                    
                    {/* ✅ Precio USD - FORMATEADO */}
                    <div className="col-span-2 text-center">
                      <div className="font-mono text-sm font-bold text-black/80">
                        {formatUsd(priceUsd)}
                      </div>
                      <div className="text-[9px] text-black/60">USD</div>
                    </div>
                    
                    {/* ✅ Precio Bs - FORMATEADO */}
                    <div className="col-span-2 text-center">
                      <div className="font-mono text-sm font-bold text-black/80">
                        {formatBs(item.priceBs)}
                      </div>
                      <div className="text-[9px] text-black/60">Bs</div>
                    </div>
                    
                    {/* ✅ Subtotal - FORMATEADO */}
                    <div className="col-span-1 text-right font-mono text-sm font-black text-black">
                      {formatBs(itemSubtotal)}
                    </div>
                    
                    {/* Botón eliminar */}
                    <div className="col-span-1 text-right">
                      <button 
                        onClick={() => onRemove(item.productId)} 
                        className="text-black/50 hover:text-red-600 transition-colors p-2"
                        title="Eliminar producto"
                      >
                        <Trash2 size={16} />
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
          <div className="p-5 space-y-2">
            {/* ✅ Subtotal - FORMATEADO */}
            <div className="flex justify-between font-mono text-base">
              <span className="text-black/80 font-bold">Subtotal:</span>
              <span className="font-black text-black">{formatBs(subtotal)}</span>
            </div>
            {/* ✅ IVA - FORMATEADO */}
            {hasAnyIvaProduct && iva > 0 && (
              <div className="flex justify-between font-mono text-base">
                <span className="text-black/80 font-bold">IVA (16%):</span>
                <span className="font-black text-amber-700">{formatBs(iva)}</span>
              </div>
            )}
            <div className="pt-4 mt-2 border-t-2 border-black flex justify-between items-end">
              <div>
                <div className="text-xs text-black/80 font-black uppercase tracking-wider">Equivalente en USD</div>
                {/* ✅ Total USD - FORMATEADO */}
                <div className="font-mono text-2xl font-black text-black/80">
                  {formatUsd(totalUsd)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-black/80 font-black uppercase tracking-wider">TOTAL A PAGAR</div>
                {/* ✅ Total Bs - FORMATEADO */}
                <div className="font-mono text-4xl font-black text-black">
                  {formatBs(total)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 pt-0">
            <button 
              disabled={cart.length === 0 || !isRegisterOpen || hasInsufficientKitStock}
              onClick={onCobrar}
              className="w-full py-4 bg-primary rounded-xl text-black font-black text-lg flex items-center justify-center gap-3 hover:brightness-105 active:scale-[0.98] transition-all shadow-md disabled:opacity-30"
            >
              <Banknote size={22} /> COBRAR
            </button>
            {hasInsufficientKitStock && (
              <p className="text-xs text-red-600 text-center mt-3 font-medium">
                ⚠️ Hay productos tipo kit/combo sin suficiente stock de sus componentes
              </p>
            )}
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