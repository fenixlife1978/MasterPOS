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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden bg-background">
      {/* COLUMNA IZQUIERDA: Búsqueda Inteligente + Panel de Cliente */}
      <div className="border-r border-border flex flex-col overflow-hidden bg-background">
        <ProductSearch 
          state={state}
          onAdd={state.addToCart} 
        />
      </div>

      {/* COLUMNA CENTRAL: Carrito de Compras */}
      <div className="border-r border-border flex flex-col overflow-hidden bg-background">
        <CartPanel 
          cart={state.cart} 
          onUpdateQty={state.updateCartQty} 
          onRemove={state.removeFromCart}
          onCobrar={() => setShowSaleType(true)}
          exchangeRate={state.exchangeRate}
          isRegisterOpen={!!state.register?.isOpen}
        />
      </div>

      {/* COLUMNA DERECHA: Espacio Ambiental Premium */}
      <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden bg-background">
        <div className="absolute w-[280px] h-[280px] bg-primary/10 rounded-full blur-[100px] animate-float-ambient top-[20%] left-[15%]" />
        <div className="absolute w-[180px] h-[180px] bg-primary/5 rounded-full blur-[80px] animate-float-ambient bottom-[25%] right-[20%] animation-delay-2000" />
        <div className="absolute w-[120px] h-[120px] bg-primary/10 rounded-full blur-[60px] animate-float-ambient top-[55%] left-[50%] animation-delay-4000" />
        
        <div className="z-10 opacity-10 select-none text-center">
          <div className="w-24 h-24 border border-primary/20 rounded-full flex items-center justify-center mb-6 mx-auto">
            <span className="font-headline font-black text-4xl text-primary/30">LP</span>
          </div>
          <p className="font-headline italic text-xl tracking-[0.4em] text-primary/20 uppercase">Gold Experience</p>
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
          total={state.cart.reduce((s,i) => s + (i.priceBs * i.qty), 0) * 1.16}
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