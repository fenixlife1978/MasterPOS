
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
    <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden bg-background">
      {/* Columna 1: Búsqueda Inteligente */}
      <div className="border-r border-border flex flex-col overflow-hidden bg-card/20">
        <div className="p-4 border-b border-border bg-card/40">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Buscador Inteligente</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <ProductSearch 
            products={state.products} 
            onAdd={state.addToCart} 
          />
        </div>
      </div>

      {/* Columna 2: Carrito de Compras */}
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

      {/* Columna 3: Espacio Ambientado (Vacío con Animación) */}
      <div className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden bg-card/10">
        {/* Luces ambientales animadas */}
        <div className="absolute w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-float-ambient top-[-10%] right-[-10%]" />
        <div className="absolute w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] animate-float-ambient bottom-[10%] left-[-5%] animation-delay-2000" />
        <div className="absolute w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] animate-float-ambient top-[40%] left-[20%] animation-delay-4000" />
        
        {/* Marca de agua sutil */}
        <div className="z-10 opacity-10 select-none">
          <div className="w-24 h-24 border-2 border-primary rounded-full flex items-center justify-center mb-4">
            <span className="font-headline font-black text-3xl">L</span>
          </div>
          <p className="text-center font-headline italic text-lg tracking-widest">Premium Collection</p>
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
