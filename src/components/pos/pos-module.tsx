"use client";

import { useState } from 'react';
import Image from 'next/image';
import { usePOSState } from '@/hooks/use-pos-state';
import ProductSearch from './product-search';
import CartPanel from './cart-panel';
import PaymentModal from './payment-modal';
import SaleTypeModal from './sale-type-modal';
import CreditModal from './credit-modal';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface POSModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function POSModule({ state }: POSModuleProps) {
  const [showSaleType, setShowSaleType] = useState(false);
  const [showContado, setShowContado] = useState(false);
  const [showCredito, setShowCredito] = useState(false);

  const cartTotal = state.cart.reduce((s,i) => s + (i.priceBs * i.qty), 0);
  const totalWithIva = state.isIvaEnabled ? cartTotal * 1.16 : cartTotal;

  const logoImage = PlaceHolderImages.find(img => img.id === 'masterpos-logo');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
      {/* COLUMNA IZQUIERDA: Búsqueda y Navegación (Dorada) - Bordes negro izquierdo y derecho */}
      <div className="flex flex-col overflow-hidden bg-primary border-l border-r border-black">
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

      {/* COLUMNA DERECHA: Ambiente Premium con Logo MasterPos */}
      <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden bg-background">
        <div className="absolute w-[280px] h-[280px] bg-primary/5 rounded-full blur-[120px] animate-float-ambient top-[20%] left-[15%]" />
        <div className="absolute w-[180px] h-[180px] bg-primary/2 rounded-full blur-[100px] animate-float-ambient bottom-[25%] right-[20%]" />
        
        <div className="z-10 w-full px-12 flex items-center justify-center transition-all duration-500 hover:scale-105">
          {logoImage && (
            <Image 
              src={logoImage.imageUrl}
              alt={logoImage.description}
              width={500}
              height={500}
              className="object-contain drop-shadow-2xl"
              priority
              unoptimized
            />
          )}
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