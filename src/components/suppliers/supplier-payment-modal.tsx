"use client";

import { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface SupplierPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { amount: number; method: string; reference?: string; bank?: string; usdAmount?: number; exchangeRate?: number }) => void;
  total: number;
  currentPaid: number;
  supplierName: string;
  invoiceNumber: string;
  exchangeRate?: number;
}

// Métodos de pago disponibles
const METHODS = [
  { id: 'efectivo_bs', label: 'EFECTIVO BS', icon: Banknote, currency: 'Bs' },
  { id: 'efectivo_usd', label: 'EFECTIVO USD', icon: DollarSign, currency: 'USD' },
  { id: 'transferencia', label: 'TRANSFERENCIA', icon: CreditCard, currency: 'Bs' },
  { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, currency: 'Bs' },
  { id: 'zelle', label: 'ZELLE', icon: Plane, currency: 'USD' },
  { id: 'cheque', label: 'CHEQUE', icon: DollarSign, currency: 'Bs' },
  { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, currency: 'Bs' },
];

export default function SupplierPaymentModal({ 
  open, 
  onClose, 
  onConfirm, 
  total, 
  currentPaid, 
  supplierName, 
  invoiceNumber, 
  exchangeRate = 36.50 
}: SupplierPaymentModalProps) {
  const [amount, setAmount] = useState('0');
  const [method, setMethod] = useState('efectivo_bs');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [usdAmount, setUsdAmount] = useState(0);
  const [customRate, setCustomRate] = useState(exchangeRate.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = total - currentPaid;
  const selectedMethod = METHODS.find(m => m.id === method);
  const isUSD = selectedMethod?.currency === 'USD';
  const needsReference = method === 'transferencia' || method === 'pago_movil' || method === 'zelle';

  // ✅ Resetear montos a 0 al abrir el modal o cambiar de método (pero no durante envío)
  useEffect(() => {
    if (!isSubmitting) {
      setAmount('0');
      setUsdAmount(0);
      setReference('');
      setBank('');
    }
  }, [open, method, isSubmitting]);

  // Actualizar el monto en USD cuando cambia el monto en Bs o la tasa
  useEffect(() => {
    const rate = parseFloat(customRate) || exchangeRate;
    if (!isUSD && amount) {
      const bsAmount = parseFloat(amount) || 0;
      const calculatedUsd = bsAmount / rate;
      setUsdAmount(calculatedUsd);
    }
  }, [amount, customRate, exchangeRate, isUSD]);

  // Actualizar el monto en Bs cuando cambia el monto en USD o la tasa (solo para métodos USD)
  useEffect(() => {
    const rate = parseFloat(customRate) || exchangeRate;
    if (isUSD && usdAmount > 0) {
      const calculatedBs = usdAmount * rate;
      setAmount(calculatedBs.toFixed(2));
    }
  }, [usdAmount, customRate, exchangeRate, isUSD]);

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmount(value);
    if (!isUSD) {
      const rate = parseFloat(customRate) || exchangeRate;
      setUsdAmount(numValue / rate);
    }
  };

  const handleUsdAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setUsdAmount(numValue);
    if (isUSD) {
      const rate = parseFloat(customRate) || exchangeRate;
      setAmount((numValue * rate).toFixed(2));
    }
  };

  const handleMethodChange = (newMethod: string) => {
    setMethod(newMethod);
    // Los montos se resetearán en el useEffect que depende de `method`
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    
    let finalUsdAmount = 0;
    const finalExchangeRate = parseFloat(customRate) || exchangeRate;

    if (isUSD) {
      finalUsdAmount = usdAmount;
      if (finalUsdAmount <= 0) {
        alert('Ingrese un monto válido en USD');
        return;
      }
    } else {
      const bsAmount = parseFloat(amount) || 0;
      if (bsAmount <= 0) {
        alert('Ingrese un monto válido en Bolívares');
        return;
      }
      finalUsdAmount = bsAmount / finalExchangeRate;
    }

    if (finalUsdAmount > remaining) {
      const confirmPartial = confirm(`El monto excede el saldo pendiente (${formatUsd(remaining)}). ¿Desea registrar solo el saldo pendiente como pago parcial?`);
      if (confirmPartial) {
        finalUsdAmount = remaining;
      } else {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      onConfirm({ 
        amount: finalUsdAmount,
        method, 
        reference, 
        bank,
        usdAmount: finalUsdAmount,
        exchangeRate: finalExchangeRate
      });
      onClose();
    } finally {
      // Pequeño retraso para evitar reseteo antes de cerrar
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl">
        <DialogHeader className="sr-only"><DialogTitle>Registrar Pago a Proveedor</DialogTitle></DialogHeader>
        <div className="flex flex-col">
          <div className="bg-[#1A2C4E] p-4 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2"><DollarSign size={20} className="text-primary" /><h3 className="text-lg font-headline font-black">Registrar Pago</h3></div>
              <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-white/60 text-xs mt-1">Proveedor: {supplierName} | Factura: {invoiceNumber}</p>
          </div>
          
          <div className="p-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-[#F5F5F5] rounded-lg p-4">
                <p className="text-[10px] text-black/60 text-center">Total Factura</p>
                <p className="text-2xl font-black text-black text-center">{formatUsd(total)}</p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-[9px] text-black/50">Pagado</p>
                    <p className="text-sm font-bold text-green-600">{formatUsd(currentPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-black/50">Pendiente</p>
                    <p className="text-sm font-bold text-red-600">{formatUsd(remaining)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-2">Método de pago</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const isActive = method === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleMethodChange(m.id)}
                        className={cn(
                          "py-2 rounded-lg border text-[9px] font-bold transition-all flex flex-col items-center gap-0.5",
                          isActive ? "border-primary bg-primary/10 text-black" : "border-[#9E9E9E] bg-white text-black/60 hover:border-primary/50"
                        )}
                      >
                        <Icon size={12} />
                        <span className="text-[8px]">{m.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 mt-4">
              {isUSD ? (
                <div className="bg-green-50 p-3 rounded-lg">
                  <label className="text-[9px] font-bold text-green-700 uppercase block mb-1">Monto en USD</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={usdAmount === 0 ? '' : usdAmount} 
                    onChange={(e) => handleUsdAmountChange(e.target.value)} 
                    className="bg-white border-green-300 font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-green-700 mt-1 text-center">
                    Equivalente: {formatBs(usdAmount * (parseFloat(customRate) || exchangeRate))}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <label className="text-[9px] font-bold text-blue-700 uppercase block mb-1">Monto en Bolívares (Bs)</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={amount === '0' ? '' : amount} 
                    onChange={(e) => handleAmountChange(e.target.value)} 
                    className="bg-white border-blue-300 font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-blue-700 mt-1 text-center">
                    Equivalente: {formatUsd(usdAmount)}
                  </p>
                </div>
              )}
              <div className="bg-amber-50 p-3 rounded-lg">
                <label className="text-[9px] font-bold text-amber-700 uppercase block mb-1">Tasa BCV (Bs/USD)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={customRate} 
                  onChange={(e) => setCustomRate(e.target.value)} 
                  className="bg-white border-amber-300 font-mono"
                />
                <p className="text-[9px] text-amber-700 mt-1 text-center">
                  Tasa aplicada al pago
                </p>
              </div>
            </div>

            {needsReference && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-[9px] font-bold text-black/60 uppercase block mb-1">Número de referencia</label>
                  <Input 
                    type="text" 
                    value={reference} 
                    onChange={(e) => setReference(e.target.value)} 
                    placeholder="Ej: 123456789" 
                    className="bg-white border-[#9E9E9E]" 
                  />
                </div>
                {method === 'pago_movil' && (
                  <div>
                    <label className="text-[9px] font-bold text-black/60 uppercase block mb-1">Banco de origen</label>
                    <select 
                      value={bank} 
                      onChange={(e) => setBank(e.target.value)} 
                      className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm"
                    >
                      <option value="">Seleccione</option>
                      <option value="BANCO DE VENEZUELA">BDV</option>
                      <option value="BANCO BANESCO">BANESCO</option>
                      <option value="BANCO PROVINCIAL">PROVINCIAL</option>
                      <option value="BANCO MERCANTIL">MERCANTIL</option>
                      <option value="BANCO NACIONAL DE CRÉDITO">BNC</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {remaining > 0 && (
              <p className="text-[9px] text-black/50 italic text-center mt-3">
                Saldo pendiente: <span className="font-bold text-red-600">{formatUsd(remaining)}</span>
              </p>
            )}
          </div>
          
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} className="px-6 text-black">CANCELAR</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={isSubmitting}
              className="px-6 bg-primary text-black font-black disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              REGISTRAR PAGO
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}