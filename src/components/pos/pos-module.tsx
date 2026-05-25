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
  
  // ✅ Obtener el próximo número de recibo (comienza en 1)
  const [nextReceiptNumber, setNextReceiptNumber] = useState(1);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Cargar el último número de recibo usado
    const lastReceipt = localStorage.getItem('last_receipt_number');
    if (lastReceipt) {
      setNextReceiptNumber(parseInt(lastReceipt) + 1);
    } else {
      // ✅ Si no hay, comenzar desde 1
      setNextReceiptNumber(1);
    }
  }, []);

  // Actualizar cuando se complete una transacción
  useEffect(() => {
    if (lastTransaction) {
      const newReceiptNumber = lastTransaction.id;
      setNextReceiptNumber(newReceiptNumber + 1);
      localStorage.setItem('last_receipt_number', newReceiptNumber.toString());
    }
  }, [lastTransaction]);

  const cartTotal = state.cart.reduce((s, i) => s + (i.priceBs * i.qty), 0);
  const totalWithIva = state.isIvaEnabled ? cartTotal * 1.16 : cartTotal;
  const totalForCredit = state.isIvaEnabled ? cartTotal * 1.16 : cartTotal;

  const handlePaymentConfirm = async (data: any) => {
    try {
      const tx = await state.finalizeSale('contado', data);
      if (tx) {
        setLastTransaction(tx);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar venta al contado:", error);
    } finally {
      setShowContado(false);
    }
  };

  const handleCreditConfirm = async (data: any) => {
    try {
      const tx = await state.finalizeSale('credito', {
        clientId: data.clientId,
        clientName: data.clientName,
        clientCedula: data.clientCedula,
        isNewClient: data.isNewClient,
        clientPhone: data.clientPhone,
        clientAddress: data.clientAddress,
        exchangeRate: data.exchangeRate,
        totalBs: data.totalBs,
        totalUsd: data.totalUsd
      });
      if (tx) {
        setLastTransaction(tx);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar venta a crédito:", error);
    } finally {
      setShowCredito(false);
    }
  };

  return (
    // Layout: columna izquierda más angosta (1/3), columna derecha más ancha (2/3)
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
      {/* COLUMNA IZQUIERDA: Búsqueda - 1/3 del ancho */}
      <div className="md:col-span-1 flex flex-col overflow-hidden bg-primary border-l border-r border-black">
        <ProductSearch state={state} onAdd={state.addToCart} />
      </div>

      {/* COLUMNA DERECHA: Carrito - 2/3 del ancho */}
      <div className="md:col-span-2 flex flex-col overflow-hidden bg-white">
        <CartPanel 
          cart={state.cart} 
          onUpdateQty={state.updateCartQty} 
          onRemove={state.removeFromCart}
          onCobrar={() => setShowSaleType(true)}
          exchangeRate={state.exchangeRate}
          isRegisterOpen={!!state.register?.isOpen}
          isIvaEnabled={state.isIvaEnabled}
          onIvaToggle={state.setIsIvaEnabled}
          nextReceiptNumber={nextReceiptNumber}
        />
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
          exchangeRate={state.exchangeRate}
          total={totalForCredit}
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