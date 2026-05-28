"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane, Plus, Trash2, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd } from '@/lib/currency-formatter';

interface PaymentItem {
  id: string;
  method: string;
  amount: number; // siempre en bolívares (Bs)
}

interface FloatingPaymentModalProps {
  total: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: { payments: PaymentItem[]; totalPaid: number; change: number; method: string }) => void;
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

  // Estado para arrastrar el modal
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const currentMethodObj = methods.find(m => m.id === currentMethod);
  const isUsd = currentMethodObj?.currency === 'USD';

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);
  const isFullyPaid = totalPaid >= total;

  const addPayment = () => {
    let amount = parseFloat(inputValue);
    if (isNaN(amount) || amount <= 0) return;
    if (isUsd) amount = amount * exchangeRate;
    const newPayment = { id: crypto.randomUUID(), method: currentMethod, amount };
    setPayments([...payments, newPayment]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const setExactAmount = () => {
    if (remaining <= 0) return;
    let amountToAdd = remaining;
    if (isUsd) amountToAdd = remaining / exchangeRate;
    setInputValue(amountToAdd.toFixed(2));
  };

  const confirmPayment = useCallback(() => {
    if (totalPaid < total) return;
    setIsProcessing(true);
    const mainPayment = payments[0] || { method: 'efectivo_bs' };
    onConfirm({ payments, totalPaid, change, method: mainPayment.method });
    setIsProcessing(false);
  }, [payments, totalPaid, total, change, onConfirm]);

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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullyPaid, confirmPayment, addPayment, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    setPosition({ x: window.innerWidth / 2 - 250, y: window.innerHeight / 3 });
  }, []);

  // Arrastre manual
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modalRef.current) return;
    setIsDragging(true);
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const formatPaymentAmount = (payment: PaymentItem) => {
    const methodInfo = methods.find(m => m.id === payment.method);
    if (methodInfo?.currency === 'USD') {
      return formatUsd(payment.amount / exchangeRate);
    }
    return formatBs(payment.amount);
  };

  return (
    <div
      ref={modalRef}
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl w-[500px] max-w-[90vw] border border-gray-200 overflow-hidden"
      style={{ top: position.y, left: position.x, position: 'fixed' }}
    >
      {/* Cabecera arrastrable - reducida de p-3 a p-2 */}
      <div
        className="bg-[#1A2C4E] p-2 text-white cursor-move flex justify-between items-center select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Calculator size={18} />
          <h3 className="font-black text-sm">Pago / Cobro</h3>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Contenido principal: padding reducido de p-4 a p-3, espacios verticales reducidos */}
      <div className="p-3 space-y-3">
        {/* Totales: gap reducido de gap-4 a gap-3, padding reducido en los cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-xl text-center shadow-sm">
            <span className="text-[10px] font-black text-black/60 uppercase tracking-wider">Total a pagar</span>
            <p className="text-3xl font-black mt-1 text-black">{formatBs(total)}</p>
            <p className="text-xs font-bold text-black/60 mt-0.5">≈ {formatUsd(total / exchangeRate)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl text-center shadow-sm">
            <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">Pagado</span>
            <p className="text-3xl font-black mt-1 text-green-700">{formatBs(totalPaid)}</p>
          </div>
        </div>

        {/* Lista de pagos - altura máxima reducida ligeramente */}
        <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
          {payments.length === 0 ? (
            <div className="text-center py-3 text-xs text-black/40">No hay pagos registrados</div>
          ) : (
            payments.map(p => {
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
            })
          )}
        </div>

        {/* Método y monto */}
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

        {/* Botones rápidos */}
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

        {/* Faltante / Vuelto - más compacto pero igual de visible */}
        <div className="bg-red-50 rounded-xl p-2.5 text-center border border-red-200">
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
            <p className="text-sm font-black text-green-700">Pago exacto</p>
          )}
        </div>

        {/* Botón finalizar - más compacto */}
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