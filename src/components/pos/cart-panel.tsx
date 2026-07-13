"use client";

import { CartItem } from '@/lib/types';
import { ShoppingCart, Trash2, Banknote, Receipt, Tag, PackageOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import PriceTypeModal from './PriceTypeModal';

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

  const isKitStockSufficient = (item: CartItem): boolean => {
    const fullProduct = getFullProduct(item.productId);
    if (!fullProduct?.isKit || !fullProduct?.kitComponents?.length) return true;
    
    // ✅ REGLA: Si tiene stock propio, verificar primero el kit mismo
    if (fullProduct.kitHasOwnStock && fullProduct.stock < item.qty) {
      return false;
    }

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

  const hasInsufficientKitStock = cart.some(item => {
    const fullProduct = getFullProduct(item.productId);
    if (fullProduct?.isKit && fullProduct?.kitComponents?.length) {
      return !isKitStockSufficient(item);
    }
    return false;
  });

  const handleQuantityChange = (productId: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) {
      onUpdateQty(productId, -999);
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
  
  const formattedReceiptNumber = nextReceiptNumber.toString().padStart(8, '0');
  
  const getRowClassName = (index: number) => index % 2 === 0 ? "bg-white" : "bg-gray-100";

  return (
    <>
      <div className="flex flex-col h-full bg-white border-l border-r border-black">
        <div className="p-3 border-b-2 border-black bg-white flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-black" />
            <h2 className="text-lg font-black text-black uppercase">Carrito</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black px-3 py-1.5 rounded-lg">
              <Receipt size={14} className="text-primary" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Recibo #{formattedReceiptNumber}</span>
            </div>
            {terminalId !== 'default' && (
              <div className="flex items-center gap-1 bg-primary px-2 py-1 rounded-lg border border-black">
                <span className="text-[10px] font-black text-black uppercase">Term. {terminalId}</span>
              </div>
            )}
            <span className="bg-secondary text-white px-2 py-1 rounded-lg text-[10px] font-black">
              {cart.length} ITEMS
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-black text-[9px] font-black uppercase tracking-widest text-white shrink-0">
            <div className="col-span-4 text-left">Descripción</div>
            <div className="col-span-1 text-center">Cant</div>
            <div className="col-span-1 text-center">U.M.</div>
            <div className="col-span-2 text-center">Precio ($)</div>
            <div className="col-span-2 text-center">Precio (Bs)</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1 text-right">Borrar</div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <ShoppingCart size={60} strokeWidth={2} className="text-black/10" />
                <p className="text-lg font-black text-black/20 uppercase tracking-widest">Carrito vacío</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const priceUsd = item.priceUsd;
                const hasIva = (item as any).ivaType === 'con_iva';
                const isKit = (item as any).isKit === true;
                const itemSubtotal = item.priceBs * item.qty;
                const kitHasStock = isKitStockSufficient(item);
                const kitStockWarning = isKit && !kitHasStock;

                return (
                  <div 
                    key={item.productId} 
                    className={cn(
                      "grid grid-cols-12 gap-1 px-3 py-2 border-b border-black/10 transition-all hover:bg-primary/5",
                      kitStockWarning && "bg-red-50 border-l-4 border-l-red-600",
                      getRowClassName(idx)
                    )}
                  >
                    <div className="col-span-4 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-black truncate">{item.name}</span>
                        <button 
                          onClick={() => openPriceModal(item.productId)}
                          className="text-blue-700 hover:scale-110 transition-all flex-shrink-0 p-0.5"
                          title="Cambiar tipo de precio"
                        >
                          <Tag size={14} className="font-black" />
                        </button>
                      </div>
                      {hasIva && (
                        <span className="text-[8px] font-black text-black bg-amber-300 px-1 rounded inline-block w-fit mt-0.5">
                          + IVA
                        </span>
                      )}
                    </div>
                    
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
                        className="w-10 text-center text-sm font-black text-black bg-white rounded-md px-1 py-1 border-2 border-black focus:outline-none"
                      />
                    </div>

                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-[9px] font-black text-black uppercase">{item.unitMeasure || 'UNID'}</span>
                    </div>
                    
                    <div className="col-span-2 text-center flex flex-col justify-center">
                      <span className="font-black text-xs text-black">{formatUsd(priceUsd)}</span>
                    </div>
                    
                    <div className="col-span-2 text-center flex flex-col justify-center">
                      <span className="font-black text-xs text-black">{formatBs(item.priceBs)}</span>
                    </div>
                    
                    <div className="col-span-1 text-right font-black text-xs text-black flex items-center justify-end">
                      {formatBs(itemSubtotal).replace('Bs. ', '')}
                    </div>
                    
                    <div className="col-span-1 text-right flex items-center justify-end">
                      <button 
                        onClick={() => onRemove(item.productId)} 
                        className="text-red-600 hover:text-red-800 transition-all p-1 bg-red-50 rounded border border-red-200"
                      >
                        <Trash2 size={14} className="font-black" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t-4 border-black bg-white shrink-0 shadow-lg">
          <div className="p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-black uppercase tracking-widest">Subtotal:</span>
              <span className="text-sm font-black text-black">{formatBs(subtotal)}</span>
            </div>
            
            {hasAnyIvaProduct && iva > 0 && (
              <div className="flex justify-between items-center border-t border-black/10 pt-1">
                <span className="text-xs font-black text-black uppercase tracking-widest">IVA (16%):</span>
                <span className="text-sm font-black text-black">{formatBs(iva)}</span>
              </div>
            )}
            
            <div className="pt-2 border-t-2 border-black flex justify-between items-center gap-3">
              <div className="bg-primary/10 px-3 py-1.5 rounded-lg border-2 border-black/10 flex-1">
                <div className="text-[8px] text-black font-black uppercase tracking-widest">Equivalente USD</div>
                <div className="font-black text-xl text-black">
                  {formatUsd(totalUsd)}
                </div>
              </div>
              <div className="text-right flex-1">
                <div className="text-[9px] text-black font-black uppercase tracking-widest">TOTAL A PAGAR</div>
                <div className="font-black text-2xl text-black tracking-tighter leading-none">
                  {formatBs(total).replace('Bs. ', '')}
                  <span className="text-xs ml-1">BS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 pt-0">
            <button 
              disabled={cart.length === 0 || !isRegisterOpen || hasInsufficientKitStock}
              onClick={onCobrar}
              className="w-full py-2.5 bg-primary text-black font-black text-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all shadow-md disabled:bg-gray-400 border-2 border-black rounded-xl"
            >
              <Banknote size={22} /> COBRAR AHORA
            </button>
          </div>
        </div>
      </div>

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
