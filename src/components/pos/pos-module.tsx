"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePOSState } from '@/hooks/use-pos-state';
import { UserCircle } from 'lucide-react';
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
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const cartTotal = state.cart.reduce((s,i) => s + (i.priceBs * i.qty), 0);
  const totalWithIva = state.isIvaEnabled ? cartTotal * 1.16 : cartTotal;

  const handlePaymentConfirm = (data: any) => {
    const tx = state.finalizeSale('contado', data);
    setLastTransaction(tx);
    setShowReceipt(true);
    setShowContado(false);
  };

  const handleCreditConfirm = (data: any) => {
    state.finalizeSale('credito', data);
    setShowCredito(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
      {/* COLUMNA IZQUIERDA: Búsqueda */}
      <div className="flex flex-col overflow-hidden bg-primary border-l border-r border-black">
        <ProductSearch state={state} onAdd={state.addToCart} />
      </div>

      {/* COLUMNA CENTRAL: Carrito */}
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

      {/* COLUMNA DERECHA: Logo + Nombre usuario arriba */}
      <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden bg-[#F5F5DC]">
        {/* Nombre del usuario arriba */}
        {user && (
          <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
            <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-md border border-black/10 flex items-center gap-2">
              <UserCircle size={16} className="text-primary" />
              <span className="text-black text-sm font-medium">{user.name}</span>
              <span className="text-black/40 text-[10px] uppercase">{user.role === 'admin' ? 'Admin' : 'Cajero'}</span>
            </div>
          </div>
        )}

        {/* Efectos decorativos */}
        <div className="absolute w-[280px] h-[280px] bg-primary/5 rounded-full blur-[120px] animate-float-ambient top-[20%] left-[15%]" />
        <div className="absolute w-[180px] h-[180px] bg-primary/2 rounded-full blur-[100px] animate-float-ambient bottom-[25%] right-[20%]" />
        
        {/* Logo centrado desde carpeta public */}
        <div className="z-10 w-full px-12 flex items-center justify-center transition-all duration-500 hover:scale-105">
          <Image 
            src="/logo-master.png"
            alt="MasterPOS Logo"
            width={500}
            height={500}
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
