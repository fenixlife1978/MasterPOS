"use client";

import { useState, useEffect, useRef } from 'react';
import { Calculator, X, CreditCard, DollarSign, Fingerprint, Smartphone, Plane, ChevronDown, ChevronUp, Wallet, Plus, Undo, Eraser } from 'lucide-react';
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
  const [showCompoundModal, setShowCompoundModal] = useState(false);
  const [showMethodsDropdown, setShowMethodsDropdown] = useState(false);
  const [currentMethod, setCurrentMethod] = useState('efectivo_bs');
  const [currentAmount, setCurrentAmount] = useState(0);
  const [compoundPayments, setCompoundPayments] = useState<PaymentItem[]>([]);
  const [buffer, setBuffer] = useState('');
  const [showPagoMovilModal, setShowPagoMovilModal] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState(0);
  const [pendingSimpleChange, setPendingSimpleChange] = useState(0);
  const [lastAction, setLastAction] = useState<{ type: string; data: any } | null>(null);
  
  // Refs para inputs del modal de Pago Móvil
  const pagoMovilInputRef = useRef<HTMLInputElement>(null);
  const pagoMovilSelectRef = useRef<HTMLSelectElement>(null);
  
  const methods = [
    { id: 'efectivo_bs', icon: DollarSign, label: 'BS', color: '#D4A017', textColor: 'black' },
    { id: 'tarjeta', icon: CreditCard, label: 'TARJETA', color: '#1A2C4E', textColor: 'white' },
    { id: 'usd_efectivo', icon: DollarSign, label: 'USD', color: '#2ECC71', textColor: 'black' },
    { id: 'biopago', icon: Fingerprint, label: 'BIOPAGO', color: '#9B59B6', textColor: 'white' },
    { id: 'pago_movil', icon: Smartphone, label: 'PAGO MÓVIL', color: '#E67E22', textColor: 'white' },
    { id: 'zelle', icon: Plane, label: 'ZELLE', color: '#E74C3C', textColor: 'white' },
  ];

  const currentMethodInfo = methods.find(m => m.id === currentMethod);
  const isUsd = currentMethod === 'usd_efectivo' || currentMethod === 'zelle';
  
  // Modo simple
  const simpleAmount = currentAmount;
  const totalPaid = simpleAmount;
  const remaining = Math.max(0, total - totalPaid);
  const changeAmount = Math.max(0, totalPaid - total);
  const isFullyPaid = totalPaid >= total;

  // Modo compuesto
  const compoundTotalPaid = compoundPayments.reduce((sum, p) => sum + p.amount, 0);
  const compoundRemaining = Math.max(0, total - compoundTotalPaid);
  const compoundChange = Math.max(0, compoundTotalPaid - total);

  // Función para borrar el último dígito
  const handleDeleteDigit = () => {
    setBuffer(prev => prev.slice(0, -1));
  };

  // Función para borrar todo
  const handleClearAll = () => {
    setBuffer('');
  };

  // Función para deshacer la última acción en modo compuesto
  const handleUndoLastPayment = () => {
    if (compoundPayments.length === 0) return;
    const lastPayment = compoundPayments[compoundPayments.length - 1];
    setLastAction({ type: 'remove', data: lastPayment });
    setCompoundPayments(prev => prev.slice(0, -1));
  };

  // Función para deshacer en modo simple
  const handleUndoSimple = () => {
    setCurrentAmount(0);
    setBuffer('');
  };

  const handleInput = (val: string) => {
    if (val === 'del') {
      handleDeleteDigit();
    } else if (val === 'clear') {
      handleClearAll();
    } else if (val === '.') {
      if (!buffer.includes('.')) setBuffer(prev => prev + '.');
    } else if (val === 'undo') {
      if (showCompoundModal) {
        handleUndoLastPayment();
      } else {
        handleUndoSimple();
      }
    } else {
      setBuffer(prev => prev + val);
    }
  };

  const handleSetAmount = () => {
    const enteredAmount = parseFloat(buffer) || 0;
    let amountToSet = enteredAmount;
    
    if (isUsd) {
      amountToSet = enteredAmount * exchangeRate;
    }
    
    // ✅ Verificar si el monto excede el total (vuelto en modo simple)
    if (amountToSet > total) {
      setPendingSimpleChange(amountToSet - total);
      setCurrentAmount(amountToSet);
      setBuffer('');
      setShowChangeDialog(true);
    } else {
      setCurrentAmount(amountToSet);
      setBuffer('');
    }
  };

  const handleCompoundAddPayment = () => {
    const enteredAmount = parseFloat(buffer) || 0;
    let amountToAdd = enteredAmount;
    
    if (isUsd) {
      amountToAdd = enteredAmount * exchangeRate;
    }
    
    const newTotalPaid = compoundTotalPaid + amountToAdd;
    
    if (newTotalPaid > total) {
      setPendingChange(newTotalPaid - total);
      const existingIndex = compoundPayments.findIndex(p => p.method === currentMethod);
      let updatedPayments = [...compoundPayments];
      if (existingIndex >= 0) {
        updatedPayments[existingIndex] = { ...updatedPayments[existingIndex], amount: updatedPayments[existingIndex].amount + amountToAdd };
      } else {
        updatedPayments.push({ id: crypto.randomUUID(), method: currentMethod, amount: amountToAdd });
      }
      setCompoundPayments(updatedPayments);
      setShowChangeDialog(true);
    } else {
      const existingIndex = compoundPayments.findIndex(p => p.method === currentMethod);
      if (existingIndex >= 0) {
        const updatedPayments = [...compoundPayments];
        updatedPayments[existingIndex] = { ...updatedPayments[existingIndex], amount: updatedPayments[existingIndex].amount + amountToAdd };
        setCompoundPayments(updatedPayments);
      } else {
        setCompoundPayments([...compoundPayments, { id: crypto.randomUUID(), method: currentMethod, amount: amountToAdd }]);
      }
    }
    setBuffer('');
  };

  // Manejar teclado
  const handleKeyDown = (e: KeyboardEvent) => {
    if (showPagoMovilModal || showChangeDialog) return;
    
    if (showCompoundModal) {
      if (e.key >= '0' && e.key <= '9') {
        handleInput(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleInput('.');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCompoundAddPayment();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndoLastPayment();
      } else if (e.key === 'Escape') {
        setShowCompoundModal(false);
        setCompoundPayments([]);
        setBuffer('');
      }
      return;
    }
    
    // Modo simple
    if (e.key >= '0' && e.key <= '9') {
      handleInput(e.key);
    } else if (e.key === '.') {
      e.preventDefault();
      handleInput('.');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSetAmount();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleDeleteDigit();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      handleClearAll();
    } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleUndoSimple();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [buffer, currentMethod, showCompoundModal, showChangeDialog, showPagoMovilModal, compoundPayments]);

  const handleFinalConfirm = () => {
    if (showCompoundModal) {
      if (compoundTotalPaid < total) {
        alert(`Falta pagar: BS ${compoundRemaining.toFixed(2)}`);
        return;
      }
      const mainPayment = compoundPayments.find(p => p.amount > 0) || { method: 'efectivo_bs' };
      onConfirm({ 
        payments: compoundPayments, 
        totalPaid: compoundTotalPaid, 
        change: compoundChange,
        method: mainPayment.method 
      });
    } else {
      if (currentAmount < total) {
        alert(`Falta pagar: BS ${remaining.toFixed(2)}`);
        return;
      }
      onConfirm({ 
        payments: [{ id: crypto.randomUUID(), method: currentMethod, amount: currentAmount }], 
        totalPaid: currentAmount, 
        change: changeAmount,
        method: currentMethod 
      });
    }
  };

  const handleMontoExacto = () => {
    if (showCompoundModal) {
      const amountToAdd = compoundRemaining;
      if (amountToAdd > 0) {
        const existingIndex = compoundPayments.findIndex(p => p.method === currentMethod);
        if (existingIndex >= 0) {
          const updatedPayments = [...compoundPayments];
          updatedPayments[existingIndex] = { ...updatedPayments[existingIndex], amount: updatedPayments[existingIndex].amount + amountToAdd };
          setCompoundPayments(updatedPayments);
        } else {
          setCompoundPayments([...compoundPayments, { id: crypto.randomUUID(), method: currentMethod, amount: amountToAdd }]);
        }
      }
    } else {
      setCurrentAmount(total);
    }
    setBuffer('');
  };

  const handleConfirmChange = () => {
    setShowChangeDialog(false);
    setPendingChange(0);
    setPendingSimpleChange(0);
  };

  const getMethodLabel = (methodId: string) => {
    return methods.find(m => m.id === methodId)?.label || methodId;
  };

  const MethodIcon = ({ methodId }: { methodId: string }) => {
    const Icon = methods.find(m => m.id === methodId)?.icon || DollarSign;
    return <Icon size={14} />;
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

    const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      setReference(value);
    };

    const handleConfirm = () => {
      if (reference.length !== 6) {
        alert('Debe ingresar los 6 últimos dígitos');
        return;
      }
      if (!bank) {
        alert('Debe seleccionar el banco');
        return;
      }
      if (showCompoundModal) {
        const existingIndex = compoundPayments.findIndex(p => p.method === currentMethod);
        if (existingIndex >= 0) {
          const updatedPayments = [...compoundPayments];
          updatedPayments[existingIndex] = { 
            ...updatedPayments[existingIndex], 
            reference, 
            bank, 
            lastDigits: reference.slice(-6) 
          };
          setCompoundPayments(updatedPayments);
        }
      }
      setShowPagoMovilModal(false);
      setReference('');
      setBank('');
    };

    const handleKeyDownCapture = (e: React.KeyboardEvent) => {
      e.stopPropagation();
    };

    return (
      <div 
        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-start p-4 ml-6"
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="bg-[#D9D9D9] border border-black/20 rounded-2xl w-full max-w-md p-4 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-headline font-black flex items-center gap-2 text-black">
              <Smartphone size={20} className="text-[#E67E22]" /> Pago Móvil
            </h3>
            <button onClick={() => {
              setShowPagoMovilModal(false);
              setReference('');
              setBank('');
            }} className="text-black/50 hover:text-black">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                ÚLTIMOS 6 DÍGITOS DE LA REFERENCIA
              </label>
              <input 
                ref={pagoMovilInputRef}
                type="text"
                maxLength={6}
                value={reference}
                onChange={handleReferenceChange}
                placeholder="Ej: 123456"
                autoFocus
                onKeyDown={(e) => e.stopPropagation()}
                className="w-full bg-white border border-black/20 rounded-lg px-3 py-2 text-sm font-bold text-black text-center tracking-widest focus:outline-none focus:border-[#E67E22] focus:ring-2 focus:ring-[#E67E22]/50"
              />
              <p className="text-[9px] text-black/40 mt-1 text-center">
                {reference.length}/6 dígitos
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                BANCO DE ORIGEN
              </label>
              <select 
                ref={pagoMovilSelectRef}
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-full bg-white border border-black/20 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:border-[#E67E22] focus:ring-2 focus:ring-[#E67E22]/50"
              >
                <option value="">Seleccione un banco</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => {
                setShowPagoMovilModal(false);
                setReference('');
                setBank('');
              }}
              className="flex-1 py-2 rounded-lg border border-black/20 bg-[#E8E8E8] text-black font-bold text-sm hover:bg-[#D4A017]"
            >
              CANCELAR
            </button>
            <button 
              onClick={handleConfirm}
              className="flex-1 py-2 bg-[#E67E22] rounded-lg text-white font-black text-sm hover:brightness-110"
            >
              CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Diálogo de vuelto (funciona para ambos modos)
  const ChangeDialog = () => {
    const changeAmountToShow = showCompoundModal ? pendingChange : pendingSimpleChange;
    return (
      <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-start p-4 ml-6">
        <div className="bg-[#1A2C4E] border-2 border-[#2ECC71] rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#2ECC71]/20 flex items-center justify-center">
            <span className="text-3xl">💰</span>
          </div>
          
          <h2 className="text-xl font-black text-white mb-2">¡VUELTO!</h2>
          
          <div className="bg-white/10 rounded-lg p-4 my-3">
            <p className="text-[10px] text-white/60 uppercase tracking-widest mb-1">Monto a devolver</p>
            <div className="text-4xl font-black text-[#2ECC71] mb-1">
              BS {changeAmountToShow.toFixed(2)}
            </div>
            <div className="text-xs text-white/40">
              ≈ USD {(changeAmountToShow / exchangeRate).toFixed(2)}
            </div>
          </div>
          
          <p className="text-white/60 text-[11px] mb-4">
            El cliente pagó más del total. Entregue el vuelto y confirme.
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setShowChangeDialog(false);
                if (showCompoundModal) {
                  setCompoundPayments([]);
                  setPendingChange(0);
                } else {
                  setCurrentAmount(0);
                  setPendingSimpleChange(0);
                }
                setBuffer('');
              }}
              className="flex-1 py-2 rounded-lg border border-white/30 bg-transparent text-white font-bold text-sm hover:bg-white/10"
            >
              CORREGIR
            </button>
            <button 
              onClick={handleConfirmChange}
              className="flex-1 py-2 bg-[#2ECC71] rounded-lg text-black font-black text-sm hover:brightness-110 shadow-md"
            >
              CONFIRMAR
            </button>
          </div>
          
          <p className="text-[9px] text-white/30 mt-3">
            ESC para corregir | ENTER para confirmar
          </p>
        </div>
      </div>
    );
  };

  // Modal de pago compuesto
  const CompoundModal = () => (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-start p-4 ml-6">
      <div className="bg-[#D9D9D9] border border-black/20 rounded-2xl w-full max-w-lg p-4 shadow-2xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-headline font-black flex items-center gap-2 text-black">
            <Wallet size={16} className="text-[#D4A017]" /> Pago Compuesto
          </h3>
          <button onClick={() => setShowCompoundModal(false)} className="text-black/50 hover:text-black">
            <X size={16} />
          </button>
        </div>

        {/* Lista de pagos acumulados */}
        <div className="mb-2 max-h-40 overflow-y-auto">
          {compoundPayments.length === 0 ? (
            <div className="text-center py-4 text-black/40 text-xs italic">
              No hay pagos registrados
            </div>
          ) : (
            <div className="space-y-1">
              {compoundPayments.map((p, idx) => {
                const isUsdPay = p.method === 'usd_efectivo' || p.method === 'zelle';
                const displayAmount = isUsdPay ? p.amount / exchangeRate : p.amount;
                const currency = isUsdPay ? 'USD' : 'BS';
                return (
                  <div key={p.id} className="flex justify-between items-center p-2 bg-white/50 rounded-lg border border-black/10">
                    <div className="flex items-center gap-2">
                      <MethodIcon methodId={p.method} />
                      <span className="text-xs font-bold text-black">{getMethodLabel(p.method)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#2ECC71]">{currency} {displayAmount.toFixed(2)}</span>
                      {p.reference && (
                        <span className="text-[8px] text-black/50">Ref: {p.lastDigits}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="bg-white/80 rounded-lg p-2 mb-2">
          <div className="flex justify-between text-xs">
            <span className="text-black/60">Total:</span>
            <span className="font-bold text-black">BS {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-black/60">Pagado:</span>
            <span className="font-bold text-[#2ECC71]">BS {compoundTotalPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1">
            <span className="text-black font-bold">FALTANTE:</span>
            <span className={cn("font-black", compoundRemaining > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]")}>
              BS {compoundRemaining.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Selector de método y monto */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="relative">
            <button
              onClick={() => setShowMethodsDropdown(!showMethodsDropdown)}
              className="w-full flex items-center justify-between p-2 bg-white border border-black/20 rounded-lg text-sm font-bold text-black"
            >
              <span className="flex items-center gap-2">
                <MethodIcon methodId={currentMethod} />
                {currentMethodInfo?.label}
              </span>
              {showMethodsDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showMethodsDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/20 rounded-lg shadow-lg z-10">
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setCurrentMethod(m.id);
                      setShowMethodsDropdown(false);
                      if (m.id === 'pago_movil') {
                        setShowPagoMovilModal(true);
                      }
                    }}
                    className="w-full flex items-center gap-2 p-2 text-xs font-bold text-black hover:bg-primary/10 transition-colors"
                  >
                    <m.icon size={12} />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-[#1A2C4E] rounded-lg p-2 text-right">
            <div className="text-[8px] text-white/60 uppercase font-bold">Monto a asignar</div>
            <div className="text-lg font-black text-white">
              {isUsd ? `USD ${(parseFloat(buffer) || 0).toFixed(2)}` : `BS ${(parseFloat(buffer) || 0).toFixed(2)}`}
            </div>
          </div>
        </div>

        {/* Teclado numérico */}
        <div className="grid grid-cols-3 gap-1 mb-2">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleInput(n.toString())} 
              className="h-8 bg-[#E8E8E8] border border-black/10 rounded-md font-black text-sm text-black hover:bg-[#D4A017] transition-all">
              {n}
            </button>
          ))}
          <button onClick={() => handleDeleteDigit()} 
            className="h-8 bg-[#E8E8E8] border border-black/10 rounded-md text-[#E74C3C] flex items-center justify-center hover:bg-[#E74C3C] hover:text-white">
            <Eraser size={14} />
          </button>
          <button onClick={() => handleInput('0')} 
            className="h-8 bg-[#E8E8E8] border border-black/10 rounded-md font-black text-sm text-black hover:bg-[#D4A017]">
            0
          </button>
          <button onClick={() => handleInput('.')} 
            className="h-8 bg-[#E8E8E8] border border-black/10 rounded-md font-black text-sm text-black hover:bg-[#D4A017]">
            .
          </button>
        </div>

        {/* Fila adicional con botones de Deshacer y Limpiar */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button 
            onClick={handleUndoLastPayment}
            disabled={compoundPayments.length === 0}
            className={cn(
              "py-1.5 rounded-md border border-black/20 text-[10px] font-bold flex items-center justify-center gap-1",
              compoundPayments.length === 0 
                ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                : "bg-[#E8E8E8] text-black hover:bg-[#D4A017]"
            )}
          >
            <Undo size={12} /> Deshacer
          </button>
          <button 
            onClick={handleClearAll}
            className="py-1.5 rounded-md border border-black/20 bg-[#E8E8E8] text-black text-[10px] font-bold hover:bg-[#D4A017] flex items-center justify-center gap-1"
          >
            <Eraser size={12} /> Limpiar
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button 
            onClick={handleMontoExacto}
            className="flex-1 py-1.5 rounded-md border border-black/20 bg-[#D2B48C] text-black text-[10px] font-bold hover:bg-[#C4A57B]"
          >
            Restante
          </button>
          <button 
            onClick={handleCompoundAddPayment}
            className="flex-1 py-1.5 bg-[#D4A017] rounded-md text-black text-[10px] font-black hover:brightness-110"
          >
            Asignar a {currentMethodInfo?.label}
          </button>
        </div>

        {/* Botón final */}
        <button 
          onClick={handleFinalConfirm}
          disabled={compoundTotalPaid < total}
          className={cn(
            "w-full mt-3 py-2 rounded-lg text-white font-black text-sm transition-all shadow-md",
            compoundTotalPaid >= total 
              ? "bg-[#2ECC71] hover:brightness-110" 
              : "bg-gray-400 cursor-not-allowed"
          )}
        >
          {compoundTotalPaid >= total 
            ? (compoundChange > 0 
                ? `COMPLETAR - Vuelto: BS ${compoundChange.toFixed(2)}` 
                : `COMPLETAR PAGO`)
            : `FALTAN: BS ${compoundRemaining.toFixed(2)}`}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Modal principal */}
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-start">
        <div className="bg-[#D9D9D9] border border-black/20 rounded-2xl shadow-2xl w-full max-w-md p-4 ml-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-headline font-black flex items-center gap-2 text-black">
              <Calculator size={18} className="text-[#D4A017]" /> Cobro Contado
            </h3>
            <button onClick={onClose} className="text-black/50 hover:text-black">
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                setShowCompoundModal(true);
                setCompoundPayments([]);
                setCurrentAmount(0);
                setBuffer('');
              }}
              className="flex-1 py-1.5 bg-[#E8E8E8] border border-black/20 rounded-md text-[10px] font-bold text-black hover:bg-[#D4A017] transition-all flex items-center justify-center gap-1"
            >
              <Plus size={12} /> PAGO COMPUESTO
            </button>
          </div>

          <div className="bg-[#1A2C4E] rounded-lg p-3 mb-2 text-right shadow-inner">
            <div className="text-[8px] text-white/60 uppercase font-bold tracking-widest">
              {currentMethodInfo?.label}
            </div>
            <div className="text-xl font-black text-white mt-0.5 tracking-tighter">
              {isUsd ? `USD ${(parseFloat(buffer) || 0).toFixed(2)}` : `BS ${(parseFloat(buffer) || 0).toFixed(2)}`}
            </div>
            <div className="text-[9px] text-[#D4A017] font-bold">
              ≈ {isUsd ? `BS ${((parseFloat(buffer) || 0) * exchangeRate).toFixed(2)}` : `USD ${((parseFloat(buffer) || 0) / exchangeRate).toFixed(2)}`}
            </div>
          </div>

          <div className="bg-white/80 rounded-lg p-2 mb-2">
            <div className="flex justify-between text-xs">
              <span className="text-black/60">Total a pagar:</span>
              <span className="font-bold text-black">BS {total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-black/60">Pagado:</span>
              <span className="font-bold text-[#2ECC71]">BS {currentAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-black font-bold">FALTANTE:</span>
              <span className={cn("font-black", remaining > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]")}>
                BS {remaining.toFixed(2)}
              </span>
            </div>
            {changeAmount > 0 && (
              <div className="flex justify-between text-sm pt-1 mt-1 border-t border-[#2ECC71]">
                <span className="text-black font-bold">VUELTO:</span>
                <span className="font-black text-[#2ECC71]">BS {changeAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="relative mb-2">
            <button
              onClick={() => setShowMethodsDropdown(!showMethodsDropdown)}
              className="w-full flex items-center justify-between p-2 bg-white border border-black/20 rounded-lg text-sm font-bold text-black"
            >
              <span className="flex items-center gap-2">
                <MethodIcon methodId={currentMethod} />
                {currentMethodInfo?.label}
              </span>
              {showMethodsDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showMethodsDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/20 rounded-lg shadow-lg z-10">
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setCurrentMethod(m.id);
                      setShowMethodsDropdown(false);
                      if (m.id === 'pago_movil') {
                        setShowPagoMovilModal(true);
                      }
                    }}
                    className="w-full flex items-center gap-2 p-2 text-xs font-bold text-black hover:bg-primary/10 transition-colors"
                  >
                    <m.icon size={14} />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => handleInput(n.toString())} 
                className="h-9 bg-[#E8E8E8] border border-black/10 rounded-lg font-black text-sm text-black hover:bg-[#D4A017] transition-all">
                {n}
              </button>
            ))}
            <button onClick={() => handleDeleteDigit()} 
              className="h-9 bg-[#E8E8E8] border border-black/10 rounded-lg text-[#E74C3C] flex items-center justify-center hover:bg-[#E74C3C] hover:text-white">
              <Eraser size={18} />
            </button>
            <button onClick={() => handleInput('0')} 
              className="h-9 bg-[#E8E8E8] border border-black/10 rounded-lg font-black text-sm text-black hover:bg-[#D4A017]">
              0
            </button>
            <button onClick={() => handleInput('.')} 
              className="h-9 bg-[#E8E8E8] border border-black/10 rounded-lg font-black text-sm text-black hover:bg-[#D4A017]">
              .
            </button>
          </div>

          {/* Fila adicional con botones de Deshacer y Limpiar */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button 
              onClick={handleUndoSimple}
              disabled={currentAmount === 0}
              className={cn(
                "py-2 rounded-lg border border-black/20 text-[10px] font-bold flex items-center justify-center gap-1",
                currentAmount === 0 
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                  : "bg-[#E8E8E8] text-black hover:bg-[#D4A017]"
              )}
            >
              <Undo size={12} /> Deshacer
            </button>
            <button 
              onClick={handleClearAll}
              className="py-2 rounded-lg border border-black/20 bg-[#E8E8E8] text-black text-[10px] font-bold hover:bg-[#D4A017] flex items-center justify-center gap-1"
            >
              <Eraser size={12} /> Limpiar
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleMontoExacto}
              className="flex-1 py-2 rounded-lg border border-black/20 bg-[#D2B48C] text-black text-xs font-bold hover:bg-[#C4A57B]"
            >
              Monto Exacto
            </button>
            <button 
              onClick={handleSetAmount}
              className="flex-1 py-2 bg-[#D4A017] rounded-lg text-black text-xs font-black hover:brightness-110"
            >
              Aplicar Pago
            </button>
          </div>

          <button 
            onClick={handleFinalConfirm}
            disabled={!isFullyPaid}
            className={cn(
              "w-full mt-3 py-2 rounded-lg text-white font-black text-sm transition-all shadow-md",
              isFullyPaid 
                ? "bg-[#2ECC71] hover:brightness-110" 
                : "bg-gray-400 cursor-not-allowed"
            )}
          >
            {isFullyPaid 
              ? (changeAmount > 0 
                  ? `COMPLETAR - Vuelto: BS ${changeAmount.toFixed(2)}` 
                  : `COMPLETAR PAGO`)
              : `FALTAN: BS ${remaining.toFixed(2)}`}
          </button>
        </div>
      </div>

      {showPagoMovilModal && <PagoMovilModal />}
      {showChangeDialog && <ChangeDialog />}
      {showCompoundModal && <CompoundModal />}
    </>
  );
}