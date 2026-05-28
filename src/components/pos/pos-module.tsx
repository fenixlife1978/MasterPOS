"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { usePOSState } from '@/hooks/use-pos-state';
import { UserCircle } from 'lucide-react';
import ProductSearch from './product-search';
import CartPanel from './cart-panel';
import FloatingPaymentModal from './FloatingPaymentModal'; // ✅ NUEVO modal flotante
import SaleTypeModal from './sale-type-modal';
import CreditModal from './credit-modal';
import ReceiptModal from '@/components/receipt-modal';
import AuthorizationModal from './AuthorizationModal';
import { syncService } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

// ✅ NUEVA FUNCIÓN DE FORMATEO (para usar en este archivo también)
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

interface POSModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function POSModule({ state }: POSModuleProps) {
  const { user } = useAuth();
  const [showSaleType, setShowSaleType] = useState(false);
  const [showContado, setShowContado] = useState(false);
  const [showCredito, setShowCredito] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [nextReceiptNumber, setNextReceiptNumber] = useState(1);
  const lastReceiptNumberRef = useRef<number>(1);
  const [showAuthorizationModal, setShowAuthorizationModal] = useState(false);
  const [pendingOperationType, setPendingOperationType] = useState<'colaboracion' | 'consumo_propio'>('colaboracion');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      // No modificamos el user del contexto, solo para compatibilidad
    }
    
    const lastReceipt = localStorage.getItem('last_receipt_number');
    if (lastReceipt) {
      const lastNum = parseInt(lastReceipt);
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
      const receiptNum = nextReceiptNumber;
      const tx = await state.finalizeSale('contado', { ...data, receiptNumber: receiptNum });
      if (tx) {
        lastReceiptNumberRef.current = receiptNum;
        setLastTransaction(tx);
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
      const receiptNum = nextReceiptNumber;
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
        receiptNumber: receiptNum
      });
      if (tx) {
        lastReceiptNumberRef.current = receiptNum;
        setLastTransaction(tx);
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

  const handleAuthorizationConfirm = async (type: 'colaboracion' | 'consumo_propio', motivo: string, pin: string) => {
    setIsVerifying(true);
    try {
      const adminCodeData = await syncService.getAdminCode();
      if (!adminCodeData || adminCodeData.code !== pin) {
        alert('PIN de autorización incorrecto');
        setIsVerifying(false);
        return;
      }

      const receiptNum = nextReceiptNumber;
      const tx = await state.finalizeSale(type, {
        receiptNumber: receiptNum,
        notes: motivo,
        authorizedBy: user?.name || 'Supervisor',
      });
      if (tx) {
        lastReceiptNumberRef.current = receiptNum;
        setLastTransaction(tx);
        localStorage.setItem('last_receipt_number', receiptNum.toString());
        setNextReceiptNumber(receiptNum + 1);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar colaboración/consumo:", error);
      alert('Error al procesar la solicitud');
    } finally {
      setIsVerifying(false);
      setShowAuthorizationModal(false);
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
            else if (type === 'credito') setShowCredito(true);
            else {
              setPendingOperationType(type === 'colaboracion' ? 'colaboracion' : 'consumo_propio');
              setShowAuthorizationModal(true);
            }
          }}
        />
      )}

      {showContado && (
        <FloatingPaymentModal
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

      {showAuthorizationModal && (
        <AuthorizationModal
          onClose={() => setShowAuthorizationModal(false)}
          onConfirm={handleAuthorizationConfirm}
          isVerifying={isVerifying}
        />
      )}

      {showReceipt && lastTransaction && (
        <ReceiptModal 
          transaction={lastTransaction}
          exchangeRate={state.exchangeRate}
          receiptNumber={lastReceiptNumberRef.current}
          onClose={() => {
            setShowReceipt(false);
            setLastTransaction(null);
          }}
        />
      )}
    </div>
  );
}