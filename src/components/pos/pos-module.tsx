"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import ProductSearch from './product-search';
import CartPanel from './cart-panel';
import ClientPanel from './client-panel';
import PaymentModal from './payment-modal';
import SaleTypeModal from './sale-type-modal';
import CreditModal from './credit-modal';

interface POSModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function POSModule({ state }: POSModuleProps) {
  const [activeView, setActiveView] = useState<'cart' | 'client'>('cart');
  const [showSaleType, setShowSaleType] = useState(false);
  const [showContado, setShowContado] = useState(false);
  const [showCredito, setShowCredito] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden">
      {/* Column 1: Search & Navigation */}
      <div className="bg-background border-r border-border flex flex-col overflow-hidden">
        <ProductSearch 
          products={state.products} 
          onAdd={state.addToCart} 
          onToggleView={() => setActiveView(prev => prev === 'cart' ? 'client' : 'cart')}
          isClientView={activeView === 'client'}
        />
        
        {activeView === 'client' && (
          <ClientPanel 
            clients={state.clients} 
            accounts={state.accounts}
            onClose={() => setActiveView('cart')}
          />
        )}
      </div>

      {/* Column 2: Cart */}
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

      {/* Column 3: Ambient Decoration */}
      <div className="hidden lg:flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float-ambient top-[10%] left-[10%]" />
        <div className="absolute w-60 h-60 bg-primary/5 rounded-full blur-3xl animate-float-ambient bottom-[20%] right-[15%] animation-delay-2000" />
        <div className="absolute w-40 h-40 bg-primary/5 rounded-full blur-3xl animate-float-ambient top-[60%] left-[50%] animation-delay-4000" />
        <div className="z-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center text-primary/30 mb-4 animate-pulse">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
          </div>
          <p className="text-muted font-medium uppercase tracking-[0.2em] text-[10px]">Escaneo en Espera</p>
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
