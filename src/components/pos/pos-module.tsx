"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import ProductSearch from './product-search';
import CartPanel from './cart-panel';
import PaymentModal from './payment-modal';
import SaleTypeModal from './sale-type-modal';
import CreditModal from './credit-modal';

interface POSModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function POSModule({ state }: POSModuleProps) {
  const [showSaleType, setShowSaleType] = useState(false);
  const [showContado, setShowContado] = useState(false);
  const [showCredito, setShowCredito] = useState(false);

  const cartTotal = state.cart.reduce((s,i) => s + (i.priceBs * i.qty), 0);
  const totalWithIva = state.isIvaEnabled ? cartTotal * 1.16 : cartTotal;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
      {/* COLUMNA IZQUIERDA: Búsqueda y Navegación (Dorada) */}
      <div className="flex flex-col overflow-hidden bg-primary">
        <ProductSearch 
          state={state}
          onAdd={state.addToCart} 
        />
      </div>

      {/* COLUMNA CENTRAL: Carrito de Compras (Crema) */}
      <div className="flex flex-col overflow-hidden bg-background">
        <CartPanel 
          cart={state.cart} 
          onUpdateQty={state.updateCartQty} 
          onRemove={state.removeFromCart}
          onCobrar={() => setShowSaleType(true)}
          exchangeRate={state.exchangeRate}
          isRegisterOpen={!!state.register?.isOpen}
          isIvaEnabled={state.isIvaEnabled}
          onIvaToggle={state.setIsIvaEnabled}
        />
      </div>

      {/* COLUMNA DERECHA: Ambiente Premium (Crema) */}
      <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden bg-background">
        <div className="absolute w-[280px] h-[280px] bg-primary/5 rounded-full blur-[120px] animate-float-ambient top-[20%] left-[15%]" />
        <div className="absolute w-[180px] h-[180px] bg-primary/2 rounded-full blur-[100px] animate-float-ambient bottom-[25%] right-[20%] animation-delay-2000" />
        
        <div className="z-10 text-center flex flex-col items-center">
          <div className="w-32 h-32 border-2 border-primary/20 rounded-full flex items-center justify-center mb-10">
            <span className="font-headline font-black text-5xl text-secondary">LP</span>
          </div>
          <div className="space-y-4">
            <p className="font-headline italic text-3xl tracking-[0.3em] text-secondary uppercase">GOLD</p>
            <p className="font-headline italic text-3xl tracking-[0.3em] text-secondary uppercase">EXPERIENCE</p>
          </div>
        </div>
      </div>

      {showSaleType && (
        <SaleTypeModal 
          onClose={() => setShowSaleType(false)}
          onSelect={(type) => {
            setShowSaleType(false);
            if (type === 'contado') setShowContado(true);
            else setShowCredito(true);
          }}
        />
      )}

      {showContado && (
        <PaymentModal 
          total={totalWithIva}
          exchangeRate={state.exchangeRate}
          onClose={() => setShowContado(false)}
          onConfirm={(data) => {
            state.finalizeSale('contado', data);
            setShowContado(false);
          }}
        />
      )}

      {showCredito && (
        <CreditModal 
          cart={state.cart}
          clients={state.clients}
          onClose={() => setShowCredito(false)}
          onConfirm={(data) => {
            state.finalizeSale('credito', data);
            setShowCredito(false);
          }}
        />
      )}
    </div>
  );
}