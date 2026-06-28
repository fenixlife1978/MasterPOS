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
  terminalId?: string;
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
  onUpdatePrice,
  terminalId = 'default'
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
  
  // ✅ Formateo correlativo de recibo (8 dígitos) - independiente por terminal
  // El número ya viene desde el POSModule con el contador específico de la terminal
  const formattedReceiptNumber = nextReceiptNumber.toString().padStart(8, '0');
  
  const getRowClassName = (index: number) => index % 2 === 0 ? "bg-white" : "bg-gray-100";

  return (
    <>
      <div className="flex flex-col h-full bg-white border-l border-r border-black">
        {/* Header con número de recibo y terminal */}
        <div className="p-4 border-b-2 border-black bg-white flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart size={24} className="text-black" />
            <h2 className="text-xl font-black text-black uppercase">Carrito de Ventas</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black px-4 py-2 rounded-xl">
              <Receipt size={18} className="text-primary" />
              <span className="text-sm font-black text-white uppercase tracking-widest">Recibo #{formattedReceiptNumber}</span>
            </div>
            {terminalId !== 'default' && (
              <div className="flex items-center gap-1.5 bg-primary px-3 py-1.5 rounded-xl border border-black">
                <span className="text-xs font-black text-black uppercase">Term. {terminalId}</span>
              </div>
            )}
            <span className="bg-secondary text-white px-3 py-1.5 rounded-xl text-sm font-black">
              {cart.length} ITEMS
            </span>
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Cabecera */}
          <div className="grid grid-cols-12 gap-2 px-4 py-4 bg-black text-xs font-black uppercase tracking-widest text-white shrink-0">
            <div className="col-span-4 text-left">Descripción</div>
            <div className="col-span-1 text-center">Cant</div>
            <div className="col-span-1 text-center">U.M.</div>
            <div className="col-span-2 text-center">Precio (USD)</div>
            <div className="col-span-2 text-center">Precio (Bs)</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1 text-right">Borrar</div>
          </div>

          {/* Cuerpo scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <ShoppingCart size={80} strokeWidth={2} className="text-black/20" />
                <p className="text-xl font-black text-black/30 uppercase tracking-widest">Carrito vacío</p>
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
                      "grid grid-cols-12 gap-2 px-4 py-4 border-b-2 border-black/10 transition-all hover:bg-primary/5",
                      kitStockWarning && "bg-red-100 border-l-8 border-l-red-600",
                      getRowClassName(idx)
                    )}
                  >
                    {/* Descripción */}
                    <div className="col-span-4">
                      <div className="flex items-center justify-between gap-2">
                        <div 
                          className="relative flex items-center gap-2 font-black text-base text-black truncate flex-1"
                          onMouseEnter={() => isKit && setTooltipVisible(item.productId)}
                          onMouseLeave={() => setTooltipVisible(null)}
                        >
                          <span className="truncate">{item.name}</span>
                          {isKit && (
                            <span title="Producto compuesto (kit/combos)">
                              <PackageOpen size={18} className="text-blue-600 flex-shrink-0" />
                            </span>
                          )}
                          {kitStockWarning && (
                            <span title="Stock insuficiente de componentes">
                              <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => openPriceModal(item.productId)}
                          className="text-blue-700 hover:scale-125 transition-all flex-shrink-0 p-1 bg-blue-50 rounded"
                          title="Cambiar tipo de precio"
                        >
                          <Tag size={18} className="font-black" />
                        </button>
                      </div>
                      {hasIva && (
                        <span className="text-[11px] font-black text-black bg-amber-300 px-2 py-0.5 rounded mt-1 inline-block border border-black/20">
                          IVA INCLUIDO (16%)
                        </span>
                      )}
                      {kitStockWarning && (
                        <span className="text-[11px] font-black text-white bg-red-600 px-2 py-0.5 rounded mt-1 inline-block">
                          STOCK INSUFICIENTE
                        </span>
                      )}
                    </div>
                    
                    {/* Cantidad */}
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
                        className="w-16 text-center text-xl font-black text-black bg-white rounded-lg px-2 py-2 border-2 border-black focus:ring-4 focus:ring-primary focus:outline-none shadow-sm"
                      />
                    </div>

                    {/* U.M. */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-xs font-black text-black uppercase">{item.unitMeasure || 'UNID'}</span>
                    </div>
                    
                    {/* Precio USD */}
                    <div className="col-span-2 text-center flex flex-col justify-center">
                      <div className="font-black text-base text-black">
                        {formatUsd(priceUsd)}
                      </div>
                    </div>
                    
                    {/* Precio Bs */}
                    <div className="col-span-2 text-center flex flex-col justify-center">
                      <div className="font-black text-base text-black">
                        {formatBs(item.priceBs)}
                      </div>
                    </div>
                    
                    {/* Subtotal */}
                    <div className="col-span-1 text-right font-black text-base text-black flex items-center justify-end">
                      {formatBs(itemSubtotal)}
                    </div>
                    
                    {/* Botón eliminar */}
                    <div className="col-span-1 text-right flex items-center justify-end">
                      <button 
                        onClick={() => onRemove(item.productId)} 
                        className="text-red-600 hover:text-red-800 hover:scale-125 transition-all p-2 bg-red-50 rounded-lg border border-red-200"
                        title="Eliminar producto"
                      >
                        <Trash2 size={20} className="font-black" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Totales y botón de cobro */}
        <div className="border-t-4 border-black bg-white shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-base font-black text-black uppercase tracking-widest">Subtotal:</span>
              <span className="text-lg font-black text-black">{formatBs(subtotal)}</span>
            </div>
            
            {hasAnyIvaProduct && iva > 0 && (
              <div className="flex justify-between items-center border-t border-black/10 pt-1">
                <span className="text-base font-black text-black uppercase tracking-widest">IVA (16%):</span>
                <span className="text-lg font-black text-black">{formatBs(iva)}</span>
              </div>
            )}
            
            <div className="pt-2 mt-1 border-t-2 border-black flex justify-between items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl border-2 border-black/20 flex-1">
                <div className="text-[10px] text-black font-black uppercase tracking-widest mb-0.5">Equivalente en USD</div>
                <div className="font-black text-2xl text-black">
                  {formatUsd(totalUsd)}
                </div>
              </div>
              <div className="text-right flex-1">
                <div className="text-[10px] text-black font-black uppercase tracking-widest mb-0.5">TOTAL A PAGAR (BS)</div>
                <div className="font-black text-4xl text-black tracking-tighter">
                  {formatBs(total).replace('Bs. ', '')}
                  <span className="text-lg ml-1">BS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 pt-0">
            <button 
              disabled={cart.length === 0 || !isRegisterOpen || hasInsufficientKitStock}
              onClick={onCobrar}
              className="w-full py-4 bg-primary text-black font-black text-xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all shadow-lg disabled:bg-gray-400 border-4 border-black rounded-2xl"
            >
              <Banknote size={28} /> COBRAR AHORA
            </button>
            {hasInsufficientKitStock && (
              <div className="bg-red-600 text-white text-center py-2 rounded-xl mt-2 font-black text-xs animate-pulse border-2 border-black">
                ⚠️ ALERTA: HAY PRODUCTOS SIN STOCK SUFICIENTE
              </div>
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
