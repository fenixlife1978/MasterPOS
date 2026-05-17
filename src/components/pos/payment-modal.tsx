"use client";

import { useState, useEffect } from 'react';
import { Calculator, X, CreditCard, DollarSign, Fingerprint, Smartphone, Plane, Plus, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentItem {
  id: string;
  method: string;
  amount: number;
  reference?: string;
  bank?: string;
  lastDigits?: string;
}

interface PaymentModalProps {
  total: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: { payments: PaymentItem[]; totalPaid: number; change: number; method: string }) => void;
}

export default function PaymentModal({ total, exchangeRate, onClose, onConfirm }: PaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([
    { id: crypto.randomUUID(), method: 'efectivo_bs', amount: 0 }
  ]);
  const [activePaymentId, setActivePaymentId] = useState<string>(payments[0].id);
  const [buffer, setBuffer] = useState('');
  const [showPagoMovilModal, setShowPagoMovilModal] = useState(false);
  
  const methods = [
    { id: 'efectivo_bs', icon: DollarSign, label: 'BS', color: '#D4A017', textColor: 'black' },
    { id: 'tarjeta', icon: CreditCard, label: 'TARJ', color: '#1A2C4E', textColor: 'white' },
    { id: 'usd_efectivo', icon: DollarSign, label: 'USD', color: '#2ECC71', textColor: 'black' },
    { id: 'biopago', icon: Fingerprint, label: 'BIO', color: '#9B59B6', textColor: 'white' },
    { id: 'pago_movil', icon: Smartphone, label: 'PM', color: '#E67E22', textColor: 'white' },
    { id: 'zelle', icon: Plane, label: 'ZELLE', color: '#E74C3C', textColor: 'white' },
  ];

  const getMethodLabel = (methodId: string) => {
    return methods.find(m => m.id === methodId)?.label || methodId;
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);

  const activePayment = payments.find(p => p.id === activePaymentId);
  const isActiveUsd = activePayment?.method === 'usd_efectivo' || activePayment?.method === 'zelle';

  const handleInput = (val: string) => {
    if (val === 'del') {
      setBuffer(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!buffer.includes('.')) setBuffer(prev => prev + '.');
    } else {
      setBuffer(prev => prev + val);
    }
  };

  const handleSetAmount = () => {
    const enteredAmount = parseFloat(buffer) || 0;
    let amountToAdd = enteredAmount;
    
    if (isActiveUsd) {
      amountToAdd = enteredAmount * exchangeRate;
    }
    
    const maxAmount = remaining;
    const finalAmount = Math.min(amountToAdd, maxAmount);
    
    setPayments(prev => prev.map(p => 
      p.id === activePaymentId ? { ...p, amount: finalAmount } : p
    ));
    setBuffer('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key;
    
    if (key >= '0' && key <= '9') {
      handleInput(key);
    } else if (key === '.') {
      e.preventDefault();
      handleInput('.');
    } else if (key === 'Enter') {
      e.preventDefault();
      if (remaining > 0) {
        handleSetAmount();
      }
    } else if (key === 'Backspace') {
      e.preventDefault();
      handleInput('del');
    } else if (key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [buffer, activePayment, remaining]);

  const addPaymentMethod = () => {
    const newPayment = {
      id: crypto.randomUUID(),
      method: 'efectivo_bs',
      amount: 0
    };
    setPayments(prev => [...prev, newPayment]);
    setActivePaymentId(newPayment.id);
  };

  const removePaymentMethod = (id: string) => {
    if (payments.length === 1) return;
    setPayments(prev => prev.filter(p => p.id !== id));
    if (activePaymentId === id) {
      setActivePaymentId(payments[0].id);
    }
  };

  const updatePaymentMethod = (id: string, methodId: string) => {
    setPayments(prev => prev.map(p => 
      p.id === id ? { ...p, method: methodId, amount: 0, reference: undefined, bank: undefined } : p
    ));
  };

  const handlePagoMovilConfirm = (reference: string, bank: string) => {
    setPayments(prev => prev.map(p => 
      p.id === activePaymentId ? { ...p, reference, bank, lastDigits: reference.slice(-6) } : p
    ));
    setShowPagoMovilModal(false);
  };

  const handleFinalConfirm = () => {
    if (totalPaid < total) {
      alert(`Falta pagar: BS ${remaining.toFixed(2)}`);
      return;
    }
    
    // Obtener el método principal de pago (el primero con monto > 0)
    const mainPayment = payments.find(p => p.amount > 0) || payments[0];
    const method = mainPayment.method;
    
    onConfirm({ 
      payments, 
      totalPaid, 
      change,
      method 
    });
  };

  const renderPaymentItem = (payment: PaymentItem, index: number) => {
    const isActive = activePaymentId === payment.id;
    const methodInfo = methods.find(m => m.id === payment.method);
    const isUsd = payment.method === 'usd_efectivo' || payment.method === 'zelle';
    const displayAmount = isUsd ? payment.amount / exchangeRate : payment.amount;
    const currency = isUsd ? 'USD' : 'BS';
    
    return (
      <div 
        key={payment.id}
        onClick={() => setActivePaymentId(payment.id)}
        className={cn(
          "p-3 rounded-xl border-2 transition-all cursor-pointer",
          isActive ? "border-[#D4A017] bg-[#D4A017]/10" : "border-black/10 bg-white/50"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <select
              value={payment.method}
              onChange={(e) => updatePaymentMethod(payment.id, e.target.value)}
              className="text-xs font-bold bg-transparent border border-black/20 rounded-lg px-2 py-1"
              style={{ color: methodInfo?.textColor === 'white' ? '#1A2C4E' : 'black' }}
            >
              {methods.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {payments.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); removePaymentMethod(payment.id); }}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <span className="text-xs font-bold text-black/60">
            #{index + 1}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xl font-black">
            {currency} {displayAmount.toFixed(2)}
          </span>
          {payment.reference && (
            <span className="text-[9px] text-black/50">
              Ref: {payment.lastDigits}
            </span>
          )}
        </div>
        
        {payment.bank && (
          <div className="text-[8px] text-black/40 mt-1">
            {payment.bank}
          </div>
        )}
      </div>
    );
  };

  // Modal Pago Móvil
  const PagoMovilModal = () => {
    const [reference, setReference] = useState('');
    const [bank, setBank] = useState('');
    const banks = [
      'BANCO DE VENEZUELA', 'BANCO BANESCO', 'BANCO PROVINCIAL', 'BANCO MERCANTIL',
      'BANCO NACIONAL DE CRÉDITO', 'BANCO DEL TESORO', 'BANCO EXTERIOR', 'BANCO PLAZA',
      'BANCO ACTIVO', 'BANCO CARONÍ', 'BANCO SOFITASA', 'BANCAMIGO', 'BANFANB', '100% BANCO'
    ];

    return (
      <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#D9D9D9] border border-black/20 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-headline font-black flex items-center gap-2 text-black">
              <Smartphone size={24} className="text-[#E67E22]" /> Pago Móvil
            </h3>
            <button onClick={() => setShowPagoMovilModal(false)} className="text-black/50 hover:text-black">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-black uppercase tracking-widest mb-1.5">
                Últimos 6 dígitos de la referencia
              </label>
              <input 
                type="text"
                maxLength={6}
                value={reference}
                onChange={(e) => setReference(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 123456"
                className="w-full bg-white border border-black/20 rounded-lg px-4 py-3 text-base font-bold text-black text-center tracking-widest focus:outline-none focus:border-[#E67E22]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-black uppercase tracking-widest mb-1.5">
                Banco de Origen
              </label>
              <select 
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full bg-white border border-black/20 rounded-lg px-4 py-3 text-sm font-medium text-black focus:outline-none focus:border-[#E67E22]"
              >
                <option value="">Seleccione un banco</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="bg-[#1A2C4E] rounded-xl p-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Monto a pagar:</span>
                <span className="text-white font-bold">
                  {isActiveUsd ? `USD ${(activePayment?.amount || 0).toFixed(2)}` : `BS ${(activePayment?.amount || 0).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button 
              onClick={() => setShowPagoMovilModal(false)}
              className="flex-1 py-3 rounded-lg border border-black/20 bg-[#E8E8E8] text-black font-bold text-sm hover:bg-[#D4A017]"
            >
              CANCELAR
            </button>
            <button 
              onClick={() => {
                if (reference.length !== 6) {
                  alert('Debe ingresar los 6 últimos dígitos');
                  return;
                }
                if (!bank) {
                  alert('Debe seleccionar el banco');
                  return;
                }
                handlePagoMovilConfirm(reference, bank);
              }}
              className="flex-1 py-3 bg-[#E67E22] rounded-lg text-white font-black text-sm hover:brightness-110"
            >
              <Check size={16} className="inline mr-1" /> CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm">
        <div className="h-full flex items-stretch justify-start">
          <div className="bg-[#D9D9D9] border-r border-black/20 shadow-2xl animate-in slide-in-from-left-5 w-full max-w-2xl h-full overflow-y-auto">
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-headline font-black flex items-center gap-2 text-black">
                  <Calculator size={20} className="text-[#D4A017]" /> Cobro Contado
                </h3>
                <button onClick={onClose} className="text-black/50 hover:text-black">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Panel izquierdo - Lista de pagos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-black/60 uppercase tracking-widest">
                      Métodos de Pago ({payments.length})
                    </span>
                    <button
                      onClick={addPaymentMethod}
                      className="text-xs text-[#D4A017] font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                    {payments.map((p, idx) => renderPaymentItem(p, idx))}
                  </div>
                </div>

                {/* Panel derecho - Calculadora y totales */}
                <div>
                  {/* Pantalla de calculadora */}
                  <div className="bg-[#1A2C4E] rounded-xl p-4 border border-[#D4A017]/30 mb-4 text-right shadow-inner">
                    <div className="text-[10px] text-white/60 uppercase font-bold tracking-widest">
                      {activePayment ? getMethodLabel(activePayment.method) : 'SELECCIONE MÉTODO'}
                    </div>
                    <div className="text-3xl font-black text-white mt-1 tracking-tighter">
                      {isActiveUsd ? `USD ${(parseFloat(buffer) || 0).toFixed(2)}` : `BS ${(parseFloat(buffer) || 0).toFixed(2)}`}
                    </div>
                    <div className="text-xs text-[#D4A017] font-bold mt-1">
                      Equivalente: {isActiveUsd ? `BS ${((parseFloat(buffer) || 0) * exchangeRate).toFixed(2)}` : `USD ${((parseFloat(buffer) || 0) / exchangeRate).toFixed(2)}`}
                    </div>
                  </div>

                  {/* Resumen de totales */}
                  <div className="bg-white/80 rounded-xl p-3 mb-4 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-black/60">Total a pagar:</span>
                      <span className="font-bold text-black">BS {total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-black/60">Total pagado:</span>
                      <span className="font-bold text-[#2ECC71]">BS {totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-black/60">Restante:</span>
                      <span className={cn("font-bold", remaining > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]")}>
                        BS {remaining.toFixed(2)}
                      </span>
                    </div>
                    {change > 0 && (
                      <div className="flex justify-between text-xs pt-1 border-t border-black/10">
                        <span className="text-black/60">Vuelto:</span>
                        <span className="font-bold text-[#2ECC71]">BS {change.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Teclado numérico */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                      <button key={n} onClick={() => handleInput(n.toString())} 
                        className="h-10 bg-[#E8E8E8] border border-black/10 rounded-lg font-black text-base text-black hover:bg-[#D4A017] transition-all">
                        {n}
                      </button>
                    ))}
                    <button onClick={() => handleInput('del')} 
                      className="h-10 bg-[#E8E8E8] border border-black/10 rounded-lg text-[#E74C3C] flex items-center justify-center hover:bg-[#E74C3C] hover:text-white">
                      <Calculator size={18} />
                    </button>
                    <button onClick={() => handleInput('0')} 
                      className="h-10 bg-[#E8E8E8] border border-black/10 rounded-lg font-black text-base text-black hover:bg-[#D4A017]">
                      0
                    </button>
                    <button onClick={() => handleInput('.')} 
                      className="h-10 bg-[#E8E8E8] border border-black/10 rounded-lg font-black text-base text-black hover:bg-[#D4A017]">
                      .
                    </button>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const maxAmount = remaining;
                        setBuffer(maxAmount.toString());
                      }}
                      className="flex-1 py-2 rounded-lg border border-black/20 bg-[#D2B48C] text-black text-xs font-bold hover:bg-[#C4A57B]"
                    >
                      Restante
                    </button>
                    <button 
                      onClick={handleSetAmount}
                      disabled={remaining === 0 || !activePayment}
                      className="flex-1 py-2 bg-[#D4A017] rounded-lg text-black text-xs font-black hover:brightness-110 disabled:opacity-30"
                    >
                      Asignar
                    </button>
                  </div>
                </div>
              </div>

              {/* Botón final de confirmación */}
              <div className="mt-4 pt-4 border-t border-black/10">
                <button 
                  onClick={handleFinalConfirm}
                  disabled={totalPaid < total}
                  className="w-full py-3 bg-[#2ECC71] rounded-xl text-white font-black text-base hover:brightness-110 disabled:opacity-30 transition-all shadow-md"
                >
                  {totalPaid >= total ? `COMPLETAR PAGO - Vuelto: BS ${change.toFixed(2)}` : `FALTA PAGAR: BS ${remaining.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPagoMovilModal && <PagoMovilModal />}
    </>
  );
}