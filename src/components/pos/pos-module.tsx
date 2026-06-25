"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { UserCircle } from 'lucide-react';
import ProductSearch from './product-search';
import CartPanel from './cart-panel';
import FloatingPaymentModal from './FloatingPaymentModal';
import SaleTypeModal from './sale-type-modal';
import CreditModal from './credit-modal';
import ReceiptModal from '@/components/receipt-modal';
import AuthorizationModal from './AuthorizationModal';
import syncService from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

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
  const terminalId = user?.terminalId || 'default';
  const terminalName = user?.terminalName || terminalId;
  
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
  
  const [isProcessingContado, setIsProcessingContado] = useState(false);
  const [isProcessingCredito, setIsProcessingCredito] = useState(false);
  const [isProcessingAutorizacion, setIsProcessingAutorizacion] = useState(false);
  
  const lastClickTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 2000;

  const getStorageKey = () => `last_receipt_number_${terminalId}`;

  const canExecuteOperation = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < DEBOUNCE_MS) {
      console.log('⏱️ Operación bloqueada por debounce');
      return false;
    }
    lastClickTimeRef.current = now;
    return true;
  }, []);

  const checkAndGetNextTicketNumber = useCallback(async (): Promise<number> => {
    const usedNumbers = new Set<number>();
    for (const t of state.transactions) {
      if (t.receiptNumber && (t.terminalId === terminalId || (t.sessionId && t.sessionId.includes(terminalId)))) {
        usedNumbers.add(t.receiptNumber);
      }
    }
    
    let number = nextReceiptNumber;
    let attempts = 0;
    while (usedNumbers.has(number) && attempts < 100) {
      number++;
      attempts++;
    }
    
    if (attempts >= 100) {
      console.error('❌ No se pudo encontrar número de ticket disponible');
      return Date.now() % 1000000;
    }
    
    return number;
  }, [nextReceiptNumber, state.transactions, terminalId]);

  useEffect(() => {
    const storageKey = getStorageKey();
    const lastReceipt = localStorage.getItem(storageKey);
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
  }, [terminalId]);

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
    if (isProcessingContado || !canExecuteOperation()) return;
    setIsProcessingContado(true);
    
    try {
      const safeReceiptNum = await checkAndGetNextTicketNumber();
      const tx = await state.finalizeSale('contado', { 
        ...data, 
        receiptNumber: safeReceiptNum,
        terminalId: terminalId 
      });
      
      if (tx) {
        lastReceiptNumberRef.current = safeReceiptNum;
        setLastTransaction(tx);
        localStorage.setItem(getStorageKey(), safeReceiptNum.toString());
        setNextReceiptNumber(safeReceiptNum + 1);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar venta al contado:", error);
      alert('Error al procesar la venta.');
    } finally {
      setIsProcessingContado(false);
      setShowContado(false);
    }
  };

  const handleCreditConfirm = async (data: any) => {
    if (isProcessingCredito || !canExecuteOperation()) return;
    setIsProcessingCredito(true);
    
    try {
      const safeReceiptNum = await checkAndGetNextTicketNumber();
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
        receiptNumber: safeReceiptNum,
        terminalId: terminalId
      });
      
      if (tx) {
        lastReceiptNumberRef.current = safeReceiptNum;
        setLastTransaction(tx);
        localStorage.setItem(getStorageKey(), safeReceiptNum.toString());
        setNextReceiptNumber(safeReceiptNum + 1);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar venta a crédito:", error);
      alert('Error al procesar la venta a crédito.');
    } finally {
      setIsProcessingCredito(false);
      setShowCredito(false);
    }
  };

  const handleAuthorizationConfirm = async (type: 'colaboracion' | 'consumo_propio', motivo: string, pin: string) => {
    if (isProcessingAutorizacion || !canExecuteOperation()) return;
    setIsProcessingAutorizacion(true);
    setIsVerifying(true);
    
    try {
      const adminCodeData = await syncService.getAdminCode();
      if (!adminCodeData || adminCodeData.code !== pin) {
        alert('PIN de autorización incorrecto');
        setIsVerifying(false);
        setIsProcessingAutorizacion(false);
        return;
      }

      const safeReceiptNum = await checkAndGetNextTicketNumber();
      const tx = await state.finalizeSale(type, {
        receiptNumber: safeReceiptNum,
        notes: motivo,
        authorizedBy: user?.name || 'Supervisor',
        terminalId: terminalId
      });
      
      if (tx) {
        lastReceiptNumberRef.current = safeReceiptNum;
        setLastTransaction(tx);
        localStorage.setItem(getStorageKey(), safeReceiptNum.toString());
        setNextReceiptNumber(safeReceiptNum + 1);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error("Error al procesar colaboración/consumo:", error);
      alert('Error al procesar la solicitud');
    } finally {
      setIsVerifying(false);
      setIsProcessingAutorizacion(false);
      setShowAuthorizationModal(false);
    }
  };

  const handleOpenSaleType = () => {
    if (state.cart.length === 0) {
      alert('No hay productos en el carrito');
      return;
    }
    setShowSaleType(true);
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
          onCobrar={handleOpenSaleType}
          exchangeRate={state.exchangeRate}
          isRegisterOpen={!!state.register?.isOpen}
          isIvaEnabled={state.isIvaEnabled}
          onIvaToggle={state.setIsIvaEnabled}
          nextReceiptNumber={nextReceiptNumber}
          products={state.products}
          onUpdatePrice={state.updateCartItemPrice}
          terminalId={terminalName}
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