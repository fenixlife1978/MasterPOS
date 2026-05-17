"use client";

import { useState } from 'react';
import { Client } from '@/lib/types';
import { UserCircle, X, CheckCircle, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSState } from '@/hooks/use-pos-state';
import PaymentModal from './payment-modal';

interface ClientPanelProps {
  client: Client;
  state: ReturnType<typeof usePOSState>;
  onClose: () => void;
}

export default function ClientPanel({ client, state, onClose }: ClientPanelProps) {
  const [abono, setAbono] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'total' | 'abono'>('total');
  
  const clientAccounts = state.accounts
    .filter(a => a.clientId === client.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalDebt = clientAccounts
    .filter(a => a.status !== 'pagada')
    .reduce((s, a) => s + (a.amountBs - (a.paidAmount || 0)), 0);

  // Abrir calculadora para pago total
  const handleFullPay = () => {
    if (totalDebt <= 0) return;
    setPaymentAmount(totalDebt);
    setPaymentType('total');
    setShowPaymentModal(true);
  };

  // Abrir calculadora para abono
  const handleAbonoClick = () => {
    const amount = parseFloat(abono) || 0;
    if (amount <= 0) {
      alert('Ingrese un monto válido');
      return;
    }
    if (amount > totalDebt) {
      alert('El abono no puede ser mayor a la deuda total');
      return;
    }
    setPaymentAmount(amount);
    setPaymentType('abono');
    setShowPaymentModal(true);
  };

  // Procesar el pago después de que la calculadora confirma
  const handlePaymentConfirm = (paymentData: any) => {
    // paymentData contiene { payments, totalPaid, change, method }
    const amountPaid = paymentData.totalPaid;
    
    if (paymentType === 'total') {
      state.applyAbono(client.id, amountPaid);
    } else {
      state.applyAbono(client.id, amountPaid);
    }
    
    setShowPaymentModal(false);
    setAbono('');
    
    // Mostrar mensaje de éxito
    alert(`Pago registrado correctamente. Monto: BS ${amountPaid.toFixed(2)}`);
  };

  return (
    <>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-black">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-black/20">
            <UserCircle size={22} className="text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold truncate text-black">{client.name}</div>
            <div className="text-[11px] font-medium text-black/60">{client.cedula} | {client.phone}</div>
          </div>
          <button onClick={onClose} className="text-black/60 hover:text-black transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Deuda Actual</div>
            <div className="bg-white border border-black rounded-xl p-4 text-center">
              <div className="text-[11px] font-medium text-black/60 uppercase tracking-wider">Total Pendiente</div>
              <div className={cn(
                "text-2xl font-black mt-1",
                totalDebt > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]"
              )}>
                BS {totalDebt.toFixed(2)}
              </div>
              <div className="text-[12px] font-bold text-black mt-0.5">USD {(totalDebt / state.exchangeRate).toFixed(2)}</div>
            </div>
          </div>

          {totalDebt > 0 && (
            <div className="bg-white border border-black rounded-xl p-4 space-y-3.5">
              <div className="flex gap-2">
                <button 
                  onClick={handleFullPay}
                  className="flex-1 py-2.5 bg-[#2ECC71] text-black text-[11px] font-bold rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
                >
                  <CheckCircle size={12} className="inline mr-1 text-black" /> Pagar Total
                </button>
                <button 
                  onClick={() => document.getElementById('abono-input')?.focus()}
                  className="flex-1 py-2.5 bg-primary text-black text-[11px] font-bold rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
                >
                  <HandCoins size={12} className="inline mr-1 text-black" /> Abonar
                </button>
              </div>
              
              {/* Contenedor vertical para el input y el botón de confirmar */}
              <div className="space-y-2">
                <input 
                  id="abono-input"
                  type="number" 
                  value={abono}
                  onChange={(e) => setAbono(e.target.value)}
                  placeholder="Monto BS"
                  className="w-full bg-background border border-black rounded-lg px-3 py-2.5 text-sm font-bold text-black outline-none focus:border-primary transition-colors text-center placeholder:text-black/40"
                />
                <button 
                  onClick={handleAbonoClick}
                  className="w-full py-2.5 bg-primary text-black text-[12px] font-black rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
                >
                  Confirmar Abono
                </button>
              </div>
              
              <p className="text-[10px] text-black/50 italic leading-tight text-center">Los abonos se aplican cronológicamente desde la deuda más antigua.</p>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold text-black uppercase tracking-widest mb-2 flex items-center justify-between px-1">
              <span>Transacciones de Crédito ({clientAccounts.length})</span>
            </div>
            <div className="space-y-1.5">
              {clientAccounts.length === 0 ? (
                <div className="text-center py-6 text-black/50 italic text-[12px]">Sin historial de crédito</div>
              ) : (
                clientAccounts.map(a => {
                  const remaining = a.amountBs - (a.paidAmount || 0);
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 bg-white border border-black/40 rounded-lg transition-all hover:border-black cursor-pointer">
                      <div className="text-[11px] font-bold text-black w-12 shrink-0">
                        {new Date(a.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0 text-[12px] text-black/70 truncate">
                        {a.products}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "text-[13px] font-bold",
                          a.status === 'pagada' ? "text-[#2ECC71]" : a.status === 'parcial' ? "text-[#F39C12]" : "text-[#E74C3C]"
                        )}>
                          BS {remaining.toFixed(2)}
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase text-black",
                          a.status === 'pagada' ? "bg-[#2ECC71]/20" : a.status === 'parcial' ? "bg-[#F39C12]/20" : "bg-[#E74C3C]/20"
                        )}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de pago (calculadora) */}
      {showPaymentModal && (
        <PaymentModal 
          total={paymentAmount}
          exchangeRate={state.exchangeRate}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
        />
      )}
    </>
  );
}