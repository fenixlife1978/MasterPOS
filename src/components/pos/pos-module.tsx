"use client";

import { useState } from 'react';
import Image from 'next/image';
import { usePOSState } from '@/hooks/use-pos-state';
import ProductSearch from './product-search';
import CartPanel from './cart-panel';
import PaymentModal from './payment-modal';
import SaleTypeModal from './sale-type-modal';
import CreditModal from './credit-modal';
import ReceiptModal from '@/components/receipt-modal';

interface POSModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function POSModule({ state }: POSModuleProps) {
  const [showSaleType, setShowSaleType] = useState(false);
  const [showContado, setShowContado] = useState(false);
  const [showCredito, setShowCredito] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  const cartTotal = state.cart.reduce((s,i) => s + (i.priceBs * i.qty), 0);
  const totalWithIva = state.isIvaEnabled ? cartTotal * 1.16 : cartTotal;

  // Manejar confirmación de pago de contado
  const handlePaymentConfirm = (data: any) => {
    const tx = state.finalizeSale('contado', data);
    setLastTransaction(tx);
    setShowReceipt(true);
    setShowContado(false);
  };

  // Manejar confirmación de crédito (nueva deuda)
  const handleCreditConfirm = (data: any) => {
    state.finalizeSale('credito', data);
    setShowCredito(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
      {/* COLUMNA IZQUIERDA: Búsqueda y Navegación (Dorada) */}
      <div className="flex flex-col overflow-hidden bg-primary border-l border-r border-black">
        <ProductSearch 
          state={state}
          onAdd={state.addToCart} 
        />
      </div>

      {/* COLUMNA CENTRAL: Carrito de Compras (Fondo blanco) */}
      <div className="flex flex-col overflow-hidden bg-white">
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

      {/* COLUMNA DERECHA: Logo MasterPOS con fondo Beige Crema */}
      <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden bg-[#F5F5DC]">
        <div className="z-10 w-full px-12 flex items-center justify-center transition-all duration-500 hover:scale-105">
          <Image 
            src="/logo-master.png"
            alt="MasterPOS Logo"
            width={400}
            height={400}
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>
      </div>

      {/* Modales */}
      {showSaleType && (
        <SaleTypeModal 
          onClose={() => setShowSaleType(false)}
          onSelect={(type) => {
            setShowSaleType(false);
            if (type === 'contado') {
              setShowContado(true);
            } else {
              setShowCredito(true);
            }
          }}
        />
      )}

      {showContado && (
        <PaymentModal 
          total={totalWithIva}
          exchangeRate={state.exchangeRate}
          onClose={() => setShowContado(false)}
          onConfirm={handlePaymentConfirm}
        />
      )}

      {showCredito && (
        <CreditModal 
          cart={state.cart}
          clients={state.clients}
          onClose={() => setShowCredito(false)}
          onConfirm={handleCreditConfirm}
        />
      )}

      {showReceipt && lastTransaction && (
        <ReceiptModal 
          transaction={lastTransaction}
          exchangeRate={state.exchangeRate}
          onClose={() => {
            setShowReceipt(false);
            setLastTransaction(null);
          }}
        />
      )}
    </div>
  );
}