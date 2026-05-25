"use client";

import { useState, useEffect, useRef } from 'react';
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
  const [nextReceiptNumber, setNextReceiptNumber] = useState(1);
  const lastReceiptNumberRef = useRef<number>(1); // ✅ REF para pasar al modal de forma precisa

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Cargar el último número de recibo usado
    const lastReceipt = localStorage.getItem('last_receipt_number');
    if (lastReceipt) {
      const lastNum = parseInt(lastReceipt);
      // Si el numero guardado es un ID gigante de firestore, resetear a 1
      if (lastNum > 10000000) {
        setNextReceiptNumber(1);
        lastReceiptNumberRef.current = 1;
      } else {
        setNextReceiptNumber(lastNum + 1);
        lastReceiptNumberRef.current = lastNum + 1;
      }
    } else {
      setNextReceiptNumber(1);
      lastReceiptNumberRef.current = 1;
    }
  }, []);

  // Calcular total con IVA
  const subtotal = state.cart.reduce((s, i) => s + (i.priceBs * i.qty), 0);
  const iva = state.cart.reduce((total, item) => {
    const hasIva = (item as any).ivaType === 'con_iva';
    if (hasIva) {
      const itemTotal = item.priceBs * item.qty;
      return total + (itemTotal * 0.16);
    }
    return total;
  }, 0);
  const totalWithIva = state.isIvaEnabled ? subtotal + iva : subtotal;
  const totalForCredit = totalWithIva;

  const handlePaymentConfirm = async (data: any) => {
    try {
      const receiptNum = nextReceiptNumber; // Número actual para esta venta
      // Se incluye el receiptNumber en la data para finalizeSale
      const tx = await state.finalizeSale('contado', { ...data, receiptNumber: receiptNum });
      if (tx) {
        lastReceiptNumberRef.current = receiptNum; // Fijar el número usado en la ref para el modal
        setLastTransaction(tx);
        
        // Persistir el número usado e incrementar para la próxima venta
        localStorage.setItem('last_receipt_number', receiptNum.toString());
        setNextReceiptNumber(receiptNum + 1);
        
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
      const receiptNum = nextReceiptNumber; // Número actual para esta venta
      const tx = await state.finalizeSale('credito', {
        clientId: data.clientId,
        clientName: data.clientName,
        clientCedula: data.clientCedula,
        isNewClient: data.isNewClient,
        clientPhone: data.clientPhone,
        clientAddress: data.clientAddress,
        exchangeRate: data.exchangeRate,
        totalBs: data.totalBs,
        totalUsd: data.totalUsd,
        receiptNumber: receiptNum // ✅ Se pasa el numero correlativo
      });
      if (tx) {
        lastReceiptNumberRef.current = receiptNum; // Fijar el número usado
        setLastTransaction(tx);
        
        // Persistir e incrementar
        localStorage.setItem('last_receipt_number', receiptNum.toString());
        setNextReceiptNumber(receiptNum + 1);
        
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar venta a crédito:", error);
    } finally {
      setShowCredito(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
      <div className="md:col-span-1 flex flex-col overflow-hidden bg-primary border-l border-r border-black">
        <ProductSearch state={state} onAdd={state.addToCart} />
      </div>

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
          products={state.products}
          onUpdatePrice={state.updateCartItemPrice}
        />
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
          receiptNumber={lastReceiptNumberRef.current} // ✅ Usar el valor exacto de la venta finalizada
          onClose={() => {
            setShowReceipt(false);
            setLastTransaction(null);
          }}
        />
      )}
    </div>
  );
}