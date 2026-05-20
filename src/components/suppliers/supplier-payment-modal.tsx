"use client";

import { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

export default function SupplierPaymentModal({ open, onClose, onConfirm, total, currentPaid, supplierName, invoiceNumber, exchangeRate = 36.50 }: SupplierPaymentModalProps) {
  const [amount, setAmount] = useState((total - currentPaid).toFixed(2));
  const [method, setMethod] = useState('efectivo_bs');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [usdAmount, setUsdAmount] = useState(0);
  const [customRate, setCustomRate] = useState(exchangeRate.toString());
  const [convertedBs, setConvertedBs] = useState(0);

  const remaining = total - currentPaid;

  useEffect(() => {
    const rate = parseFloat(customRate) || exchangeRate;
    const converted = usdAmount * rate;
    setConvertedBs(converted);
    if (method === 'usd_efectivo' || method === 'zelle') {
      setAmount(converted.toFixed(2));
    }
  }, [usdAmount, customRate, exchangeRate, method]);

  const methods = [
    { id: 'efectivo_bs', label: 'EFECTIVO BS', icon: Banknote, color: 'bg-primary/10 text-primary', showRate: false },
    { id: 'usd_efectivo', label: 'EFECTIVO USD', icon: DollarSign, color: 'bg-green-100 text-green-700', showRate: true },
    { id: 'transferencia', label: 'TRANSFERENCIA', icon: CreditCard, color: 'bg-blue-100 text-blue-700', showRate: false },
    { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, color: 'bg-orange-100 text-orange-700', showRate: false },
    { id: 'zelle', label: 'ZELLE', icon: Plane, color: 'bg-red-100 text-red-700', showRate: true },
    { id: 'cheque', label: 'CHEQUE', icon: DollarSign, color: 'bg-purple-100 text-purple-700', showRate: false },
    { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, color: 'bg-yellow-100 text-yellow-700', showRate: false },
  ];

  const currentMethod = methods.find(m => m.id === method);
  const showRateFields = currentMethod?.showRate;

  const handleConfirm = () => {
    let amountNum = parseFloat(amount) || 0;
    let finalAmount = amountNum;
    let finalUsdAmount = 0;
    
    if (method === 'usd_efectivo' || method === 'zelle') {
      finalUsdAmount = parseFloat(usdAmount.toString()) || 0;
      const rate = parseFloat(customRate) || exchangeRate;
      finalAmount = finalUsdAmount * rate;
    }
    
    if (finalAmount <= 0) {
      alert('Ingrese un monto válido');
      return;
    }
    
    if (finalAmount > remaining) {
      const confirmPartial = confirm(`El monto excede el saldo pendiente (Bs ${remaining.toFixed(2)}). ¿Desea registrar solo el saldo pendiente como pago parcial?`);
      if (confirmPartial) {
        finalAmount = remaining;
        if (method === 'usd_efectivo' || method === 'zelle') {
          const rate = parseFloat(customRate) || exchangeRate;
          finalUsdAmount = finalAmount / rate;
        }
      } else {
        return;
      }
    }
    
    onConfirm({ 
      amount: finalAmount, 
      method, 
      reference, 
      bank,
      usdAmount: finalUsdAmount,
      exchangeRate: parseFloat(customRate) || exchangeRate
    });
    onClose();
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
            {/* Layout horizontal: 2 columnas */}
            <div className="grid grid-cols-2 gap-5">
              {/* Columna izquierda - Información de factura */}
              <div className="bg-[#F5F5F5] rounded-lg p-4">
                <p className="text-[10px] text-black/60 text-center">Total Factura</p>
                <p className="text-2xl font-black text-black text-center">Bs {total.toFixed(2)}</p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-[9px] text-black/50">Pagado</p>
                    <p className="text-sm font-bold text-green-600">Bs {currentPaid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-black/50">Pendiente</p>
                    <p className="text-sm font-bold text-red-600">Bs {remaining.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Columna derecha - Métodos de pago (grid compacto) */}
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-2">Método de pago</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {methods.map((m) => {
                    const Icon = m.icon;
                    const isActive = method === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setMethod(m.id); setUsdAmount(0); setConvertedBs(0); }}
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

            {/* Sección de monto - horizontal */}
            <div className="grid grid-cols-2 gap-5 mt-4">
              {showRateFields ? (
                <>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <label className="text-[9px] font-bold text-green-700 uppercase block mb-1">Monto en USD</label>
                    <Input type="number" step="0.01" value={usdAmount} onChange={(e) => setUsdAmount(parseFloat(e.target.value) || 0)} className="bg-white border-green-300" placeholder="0.00" />
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <label className="text-[9px] font-bold text-green-700 uppercase block mb-1">Tasa BCV (Bs/USD)</label>
                    <Input type="number" step="0.01" value={customRate} onChange={(e) => setCustomRate(e.target.value)} className="bg-white border-green-300" />
                    <p className="text-[10px] text-green-700 mt-1 text-center">= Bs <span className="font-bold">{convertedBs.toFixed(2)}</span></p>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Monto a pagar (Bs)</label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white border-[#9E9E9E] text-black font-bold text-lg" />
                </div>
              )}
            </div>

            {/* Referencia y banco (si aplica) */}
            {(method === 'transferencia' || method === 'pago_movil' || method === 'zelle') && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-[9px] font-bold text-black/60 uppercase block mb-1">Número de referencia</label>
                  <Input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: 123456789" className="bg-white border-[#9E9E9E]" />
                </div>
                {method === 'pago_movil' && (
                  <div>
                    <label className="text-[9px] font-bold text-black/60 uppercase block mb-1">Banco de origen</label>
                    <select value={bank} onChange={(e) => setBank(e.target.value)} className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm">
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
              <p className="text-[9px] text-black/50 italic text-center mt-3">Si el pago no cubre el total, quedará como PAGO PARCIAL</p>
            )}
          </div>
          
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} className="px-6 text-black">CANCELAR</Button>
            <Button onClick={handleConfirm} className="px-6 bg-primary text-black font-black">REGISTRAR PAGO</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
