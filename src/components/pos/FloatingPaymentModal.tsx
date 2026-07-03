"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane, Plus, Trash2, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatUsdNumber } from '@/lib/currency-formatter';

interface PaymentItem {
  id: string;
  method: string;
  amount: number; // siempre en bolívares (Bs)
  usdAmount?: number; // para métodos USD, el monto original en USD
}

interface FloatingPaymentModalProps {
  total: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: { payments: PaymentItem[]; totalPaid: number; change: number; method: string; ajusteRedondeoBs?: number }) => void;
}

const methods = [
  { id: 'efectivo_bs', label: 'EFECTIVO Bs', icon: Banknote, currency: 'Bs' },
  { id: 'usd_efectivo', label: 'EFECTIVO USD', icon: DollarSign, currency: 'USD' },
  { id: 'tarjeta', label: 'TARJETA', icon: CreditCard, currency: 'Bs' },
  { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, currency: 'Bs' },
  { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, currency: 'Bs' },
  { id: 'zelle', label: 'ZELLE', icon: Plane, currency: 'USD' },
];

export default function FloatingPaymentModal({ total, exchangeRate, onClose, onConfirm }: FloatingPaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [currentMethod, setCurrentMethod] = useState('efectivo_bs');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMethodObj = methods.find(m => m.id === currentMethod);
  const isUsd = currentMethodObj?.currency === 'USD';

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  
  // ✅ RECONCILIACIÓN BIMONETARIA EXACTA (ESTILO BANCARIO)
  // Redondeamos a 2 decimales para evitar el ruido de punto flotante (0.01)
  const totalUsd = Math.round((total / exchangeRate) * 100) / 100;
  const totalPaidUsd = Math.round(payments.reduce((sum, p) => sum + (p.usdAmount || (p.amount / exchangeRate)), 0) * 100) / 100;

  // Una factura se considera pagada si la suma en USD cubre el total en USD
  // o si la suma en Bs cubre el total en Bs
  const isPaidByUsd = totalPaidUsd >= (totalUsd - 0.001);
  const isFullyPaid = isPaidByUsd || (totalPaid >= total - 0.01);

  const remaining = isFullyPaid ? 0 : Math.max(0, total - totalPaid);
  
  // ✅ LÓGICA DE VUELTO RECONCILIADO
  let change = Math.max(0, totalPaid - total);
  
  // Si el pago en USD es IDÉNTICO al total en USD (margen 0.001), 
  // forzamos el vuelto a 0 si la diferencia en Bs es despreciable (error de redondeo)
  if (isPaidByUsd && Math.abs(totalPaidUsd - totalUsd) < 0.001 && change <= 0.05) {
    change = 0;
  }
  
  // Si está pagado por USD pero faltan céntimos en Bs, calculamos el ajuste
  const ajusteRedondeoBs = (isPaidByUsd && totalPaid < total) ? Math.round((total - totalPaid) * 100) / 100 : 0;

  // BLINDAJE VISUAL: Si ya se pagó exacto en USD, forzamos a la interfaz a mostrar que se pagó el 100% en Bs
  const displayedTotalPaidBs = (isPaidByUsd && (ajusteRedondeoBs > 0 || (totalPaid > total && change === 0))) ? total : totalPaid;

  const addPayment = () => {
    let rawAmount = parseFloat(inputValue);
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    if (isUsd) {
      const usdAmount = rawAmount;
      const bsAmount = Math.round(usdAmount * exchangeRate * 100) / 100;
      const newPayment: PaymentItem = {
        id: crypto.randomUUID(),
        method: currentMethod,
        amount: bsAmount,
        usdAmount: usdAmount,
      };
      setPayments([...payments, newPayment]);
    } else {
      const bsAmount = rawAmount;
      const newPayment: PaymentItem = {
        id: crypto.randomUUID(),
        method: currentMethod,
        amount: bsAmount,
      };
      setPayments([...payments, newPayment]);
    }
    setInputValue('');
    inputRef.current?.focus();
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const setExactAmount = () => {
    const currentRemainingBs = Math.max(0, total - totalPaid);
    if (currentRemainingBs <= 0) return;
    
    let amountToAdd = currentRemainingBs;
    if (isUsd) {
      // Si no hay pagos cargados, usamos directamente el total en USD calculado
      if (payments.length === 0) {
        amountToAdd = totalUsd;
      } else {
        amountToAdd = Math.round((currentRemainingBs / exchangeRate) * 100) / 100;
      }
    }
    setInputValue(amountToAdd.toFixed(2));
  };

  const confirmPayment = useCallback(() => {
    if (!isFullyPaid) return;
    setIsProcessing(true);
    const mainPayment = payments[0] || { method: 'efectivo_bs' };
    
    // Aplicar la misma lógica de redondeo exacto al confirmar
    let finalChange = Math.max(0, totalPaid - total);
    if (isPaidByUsd && Math.abs(totalPaidUsd - totalUsd) < 0.001 && finalChange <= 0.05) {
      finalChange = 0;
    }

    onConfirm({ 
      payments, 
      totalPaid, 
      change: finalChange, 
      method: mainPayment.method,
      ajusteRedondeoBs 
    });
    setIsProcessing(false);
  }, [payments, totalPaid, isFullyPaid, total, isPaidByUsd, totalPaidUsd, totalUsd, ajusteRedondeoBs, onConfirm]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (isFullyPaid) confirmPayment();
      }
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        addPayment();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullyPaid, confirmPayment, addPayment, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatPaymentAmount = (payment: PaymentItem) => {
    const methodInfo = methods.find(m => m.id === payment.method);
    if (methodInfo?.currency === 'USD') {
      const usdValue = payment.usdAmount ?? payment.amount / exchangeRate;
      return formatUsd(usdValue);
    }
    return formatBs(payment.amount);
  };

  return (
    <div
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl w-[500px] max-w-[90vw] border border-gray-200 overflow-hidden"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed'
      }}
    >
      <div className="bg-[#1A2C4E] p-2 text-white flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <Calculator size={18} />
          <h3 className="font-black text-sm">Pago / Cobro</h3>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-xl text-center shadow-sm">
            <span className="text-[10px] font-black text-black/60 uppercase tracking-wider">Total a pagar</span>
            <p className="text-3xl font-black mt-1 text-black">{formatBs(total)}</p>
            <p className="text-xs font-bold text-black/60 mt-0.5">≈ {formatUsd(total / exchangeRate)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl text-center shadow-sm">
            <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">Pagado</span>
            {/* Aquí usamos el monto blindado para que coincida perfectamente en pantalla */}
            <p className="text-3xl font-black mt-1 text-green-700">{formatBs(displayedTotalPaidBs)}</p>
            {totalPaidUsd > 0 && <p className="text-xs font-bold text-green-600 mt-0.5">USD {formatUsdNumber(totalPaidUsd)}</p>}
          </div>
        </div>

        <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
          {payments.length === 0 ? (
            <div className="text-center py-3 text-xs text-black/40">No hay pagos registrados</div>
          ) : (
            <div className="divide-y">
              {payments.map(p => {
                const methodInfo = methods.find(m => m.id === p.method);
                return (
                  <div key={p.id} className="flex justify-between items-center p-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      {methodInfo?.icon && <methodInfo.icon size={14} />}
                      <span className="font-bold">{methodInfo?.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatPaymentAmount(p)}</span>
                      <button onClick={() => removePayment(p.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[8px] font-black uppercase text-black/60 block mb-0.5">Método de pago</label>
            <select
              value={currentMethod}
              onChange={(e) => setCurrentMethod(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
            >
              {methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[8px] font-black uppercase text-black/60 block mb-0.5">Monto</label>
            <div className="flex gap-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
                className="flex-1 border rounded-lg px-2 py-1.5 text-xs font-mono text-right"
                placeholder="0.00"
              />
              <button onClick={addPayment} className="bg-primary px-2.5 rounded-lg text-black font-bold text-[10px]">
                <Plus size={12} />
              </button>
            </div>
            <p className="text-[7px] text-black/40 mt-0.5 text-right">
              {isUsd ? 'Monto en USD' : 'Monto en Bs'}
            </p>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <button
            onClick={setExactAmount}
            className="flex-1 py-1.5 bg-gray-100 text-black text-[10px] font-bold rounded-lg border hover:bg-gray-200 transition"
          >
            Monto Exacto
          </button>
          <button
            onClick={addPayment}
            className="flex-1 py-1.5 bg-[#D4A017] text-black text-[10px] font-bold rounded-lg hover:brightness-110 transition"
          >
            Agregar pago
          </button>
        </div>

        {/* Banner de respuesta dinámica con cn() para alternar colores según el estado de la cuenta */}
        <div className={cn(
          "rounded-xl p-2.5 text-center border transition-colors",
          remaining > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        )}>
          {remaining > 0 ? (
            <>
              <p className="text-[9px] font-black text-red-700 uppercase tracking-wider">Faltante</p>
              <p className="text-3xl font-black text-red-700 mt-0.5">{formatBs(remaining)}</p>
              <p className="text-sm font-bold text-red-600 mt-0.5">≈ {formatUsd(remaining / exchangeRate)}</p>
            </>
          ) : change > 0 ? (
            <>
              <p className="text-[9px] font-black text-green-700 uppercase tracking-wider">Vuelto en Bs</p>
              <p className="text-3xl font-black text-green-700 mt-0.5">{formatBs(change)}</p>
              <p className="text-sm font-bold text-green-600 mt-0.5">≈ {formatUsd(change / exchangeRate)}</p>
            </>
          ) : (
            <p className="text-sm font-black text-green-700 py-1">Pago cubierto</p>
          )}
        </div>

        <button
          onClick={confirmPayment}
          disabled={!isFullyPaid || isProcessing}
          className={cn(
            "w-full py-2 rounded-xl text-white font-black text-sm transition-all",
            isFullyPaid ? "bg-[#2ECC71] hover:brightness-110 shadow-md" : "bg-gray-400 cursor-not-allowed"
          )}
        >
          {isProcessing ? "Procesando..." : (change > 0 ? `COMPLETAR - Vuelto ${formatBs(change)}` : "COMPLETAR PAGO")}
        </button>
        <p className="text-center text-[8px] text-black/40">
          ␣ Espacio para finalizar | ESC para cerrar | Enter agrega monto
        </p>
      </div>
    </div>
  );
}