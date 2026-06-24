"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, CartItem } from '@/lib/types';
import { UserCircle, X, CheckCircle, HandCoins, Eye, History, DollarSign, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSState } from '@/hooks/use-pos-state';
import FloatingPaymentModal from './FloatingPaymentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface ClientPanelProps {
  client: Client;
  state: ReturnType<typeof usePOSState>;
  onClose: () => void;
}

interface ProductItem {
  name: string;
  qty: number;
  priceBs: number;
  priceUsd: number;
}

export default function ClientPanel({ client, state, onClose }: ClientPanelProps) {
  const [abono, setAbono] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'total' | 'abono'>('total');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(state.exchangeRate);
  
  // ✅ Suscripción a cambios de tasa BCV en tiempo real
  useEffect(() => {
    setCurrentExchangeRate(state.exchangeRate);
  }, [state.exchangeRate]);

  // ✅ Memoizar cálculos costosos
  const clientAccounts = useMemo(() => {
    return state.accounts
      .filter(a => a.clientId === client.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.accounts, client.id]);

  // ✅ CORREGIDO: Calcular deuda EN BS usando la TASA ACTUAL del sistema
  const totalDebt = useMemo(() => {
    return clientAccounts
      .filter(a => a.status !== 'pagada')
      .reduce((sum, a) => {
        // Obtener el valor en USD de la cuenta (original al momento del crédito)
        const totalUsd = a.amountUsd || (a.amountBs / (a.exchangeRate || currentExchangeRate));
        const paidUsd = (a.paidAmount || 0) / (a.exchangeRate || currentExchangeRate);
        const remainingUsd = totalUsd - paidUsd;
        // Convertir a Bs con la TASA ACTUAL del sistema
        const remainingBs = remainingUsd * currentExchangeRate;
        return sum + Math.max(0, remainingBs);
      }, 0);
  }, [clientAccounts, currentExchangeRate]);

  // ✅ Memoizar abonos
  const abonosForClient = useMemo(() => {
    return state.transactions
      .filter(t => t.type === 'cobro_deuda' && t.clientId === client.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.transactions, client.id]);

  // ✅ Obtener la tasa BCV HISTÓRICA guardada en la transacción (para el detalle)
  const getHistoricalExchangeRate = useCallback(() => {
    if (selectedTransaction?.accountInfo?.exchangeRate) {
      return selectedTransaction.accountInfo.exchangeRate;
    }
    if (selectedTransaction?.exchangeRate) {
      return selectedTransaction.exchangeRate;
    }
    return null;
  }, [selectedTransaction]);

  // ✅ CORREGIDO: Calcular el saldo restante de una cuenta en BS usando la tasa actual
  const getRemainingBsForAccount = useCallback((account: any): number => {
    const totalUsd = account.amountUsd || (account.amountBs / (account.exchangeRate || currentExchangeRate));
    const paidUsd = (account.paidAmount || 0) / (account.exchangeRate || currentExchangeRate);
    const remainingUsd = totalUsd - paidUsd;
    return Math.max(0, remainingUsd * currentExchangeRate);
  }, [currentExchangeRate]);

  // ✅ CORREGIDO: Calcular el total original en USD de una cuenta (histórico)
  const getTotalUsdForAccount = useCallback((account: any): number => {
    return account.amountUsd || (account.amountBs / (account.exchangeRate || currentExchangeRate));
  }, [currentExchangeRate]);

  const handleFullPay = useCallback(() => {
    if (totalDebt <= 0) return;
    setPaymentAmount(totalDebt);
    setPaymentType('total');
    setShowPaymentModal(true);
  }, [totalDebt]);

  const handleAbonoClick = useCallback(() => {
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
  }, [abono, totalDebt]);

  const handlePaymentConfirm = useCallback((paymentData: any) => {
    const amountPaid = paymentData.totalPaid;
    state.applyAbono(client.id, amountPaid);
    setShowPaymentModal(false);
    setAbono('');
    alert(`Pago registrado correctamente. Monto: ${formatBs(amountPaid)}`);
  }, [state, client.id]);

  const handleTransactionClick = useCallback((account: any) => {
    const transaction = state.transactions.find(t => t.id === account.txId);
    setSelectedTransaction({ 
      ...transaction, 
      accountInfo: account 
    });
    setShowDetailModal(true);
  }, [state.transactions]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pagada': return 'bg-green-100 text-green-700 border-green-200';
      case 'parcial': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-red-100 text-red-700 border-red-200';
    }
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatDateShort = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);

  const getTransactionItems = useCallback((): ProductItem[] => {
    if (selectedTransaction?.items && selectedTransaction.items.length > 0) {
      return selectedTransaction.items.map((item: CartItem) => ({
        name: item.name,
        qty: item.qty,
        priceBs: item.priceBs || 0,
        priceUsd: item.priceUsd || 0
      }));
    }
    if (selectedTransaction?.accountInfo?.products) {
      const productsStr = selectedTransaction.accountInfo.products;
      if (typeof productsStr === 'string') {
        const items = productsStr.split(',').map((item: string) => item.trim());
        return items.map((item: string): ProductItem => {
          const match = item.match(/(.+)\sx(\d+)$/);
          if (match) {
            return {
              name: match[1],
              qty: parseInt(match[2], 10),
              priceBs: 0,
              priceUsd: 0
            };
          }
          return { name: item, qty: 1, priceBs: 0, priceUsd: 0 };
        });
      }
    }
    return [];
  }, [selectedTransaction]);

  const historicalRate = getHistoricalExchangeRate();

  return (
    <>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2">
        {/* Header del cliente */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-black">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-black/20">
            <UserCircle size={22} className="text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold truncate text-black">{client.name}</div>
            <div className="text-[11px] font-medium text-black">{client.cedula} | {client.phone}</div>
          </div>
          <button 
            onClick={onClose} 
            className="text-black/60 hover:text-black transition-colors p-1"
            aria-label="Cerrar panel"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Deuda Actual con TASA ACTUAL */}
          <div>
            <div className="text-[10px] font-bold text-black uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <span>Deuda Actual</span>
              <span className="text-[8px] text-black/40 flex items-center gap-1">
                <RefreshCw size={8} /> Actualizado con tasa actual
              </span>
            </div>
            <div className="bg-white border border-black rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold text-black uppercase tracking-wider">Total Pendiente</div>
              <div className={cn(
                "text-2xl font-black mt-1",
                totalDebt > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]"
              )}>
                {formatBs(totalDebt)}
              </div>
              <div className="text-[12px] font-bold text-black mt-0.5">{formatUsd(totalDebt / currentExchangeRate)}</div>
              <div className="text-[9px] font-bold text-black mt-1">
                Tasa actual: 1 USD = {formatBsNumber(currentExchangeRate)}
              </div>
            </div>
          </div>

          {/* Botones de pago */}
          {totalDebt > 0 && (
            <div className="bg-white border border-black rounded-xl p-4 space-y-3.5">
              <div className="flex gap-2">
                <button 
                  onClick={handleFullPay}
                  className="flex-1 py-2.5 bg-[#2ECC71] text-white text-[11px] font-bold rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
                >
                  <CheckCircle size={12} className="inline mr-1 text-white" /> Pagar Total
                </button>
                <button 
                  onClick={() => document.getElementById('abono-input')?.focus()}
                  className="flex-1 py-2.5 bg-primary text-black text-[11px] font-bold rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
                >
                  <HandCoins size={12} className="inline mr-1 text-black" /> Abonar
                </button>
              </div>
              
              <div className="space-y-2">
                <input 
                  id="abono-input"
                  type="number" 
                  value={abono}
                  onChange={(e) => setAbono(e.target.value)}
                  placeholder="Monto BS"
                  className="w-full bg-background border border-black rounded-lg px-3 py-2.5 text-sm font-bold text-black outline-none focus:border-primary transition-colors text-center placeholder:text-black/40"
                  aria-label="Monto del abono"
                  min="0"
                  step="0.01"
                />
                <button 
                  onClick={handleAbonoClick}
                  className="w-full py-2.5 bg-primary text-black text-[12px] font-black rounded-lg hover:brightness-110 transition-all uppercase shadow-md"
                >
                  Confirmar Abono
                </button>
              </div>
              
              <p className="text-[10px] font-bold text-black leading-tight text-center">
                Los abonos se aplican cronológicamente desde la deuda más antigua.
              </p>
            </div>
          )}

          {/* Transacciones de Crédito */}
          <div>
            <div className="text-[10px] font-bold text-black uppercase tracking-widest mb-2 flex items-center justify-between px-1">
              <span>Transacciones de Crédito ({clientAccounts.length})</span>
            </div>
            <div className="space-y-1.5">
              {clientAccounts.length === 0 ? (
                <div className="text-center py-6 text-black/50 italic text-[12px]">
                  Sin historial de crédito
                </div>
              ) : (
                clientAccounts.map(a => {
                  const remainingBs = getRemainingBsForAccount(a);
                  const totalUsd = getTotalUsdForAccount(a);
                  const isPaid = a.status === 'pagada';
                  const isPartial = a.status === 'parcial';
                  
                  return (
                    <div 
                      key={a.id} 
                      onClick={() => handleTransactionClick(a)}
                      className="flex items-center gap-3 p-2.5 bg-white border border-black/40 rounded-lg transition-all hover:border-black hover:shadow-md cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTransactionClick(a);
                        }
                      }}
                    >
                      <div className="text-[11px] font-bold text-black w-12 shrink-0">
                        {new Date(a.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-black truncate">
                          {a.products}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                            getStatusColor(a.status)
                          )}>
                            {a.status === 'pagada' ? 'PAGADA' : a.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                          </span>
                          {(a.paidAmount || 0) > 0 && !isPaid && (
                            <span className="text-[9px] font-bold text-black">
                              Abonado: {formatBs(a.paidAmount || 0)}
                            </span>
                          )}
                        </div>
                        <div className="text-[8px] font-bold text-black mt-0.5">
                          Original: {formatUsd(totalUsd)} al {a.exchangeRate ? formatBsNumber(a.exchangeRate) : 'tasa histórica'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "text-[13px] font-bold",
                          isPaid ? "text-[#2ECC71]" : isPartial ? "text-[#F39C12]" : "text-[#E74C3C]"
                        )}>
                          {formatBs(remainingBs)}
                        </div>
                        <div className="text-[9px] font-bold text-black">
                          {formatUsd(remainingBs / currentExchangeRate)}
                        </div>
                      </div>
                      <Eye size={14} className="text-black font-bold flex-shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Modal de pago usando la nueva calculadora (FloatingPaymentModal) */}
      {showPaymentModal && (
        <FloatingPaymentModal 
          total={paymentAmount}
          exchangeRate={state.exchangeRate}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
        />
      )}

      {/* Modal de detalle de transacción con Tasa BCV HISTÓRICA */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del Crédito</DialogTitle>
          </DialogHeader>
          {selectedTransaction && selectedTransaction.accountInfo && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
                <button 
                  onClick={() => setShowDetailModal(false)} 
                  className="absolute top-4 right-4 hover:opacity-70"
                  aria-label="Cerrar detalle"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                    <HandCoins size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Detalle del Crédito</h3>
                    <p className="text-white/60 text-sm">
                      #{selectedTransaction.accountInfo.txId} • {selectedTransaction.accountInfo.clientName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cuerpo */}
              <div className="p-6 space-y-6">
                {/* Información general */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Fecha</label>
                    <p className="text-sm font-bold text-black">{formatDate(selectedTransaction.accountInfo.date)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Tipo</label>
                    <p className="text-sm font-bold text-black uppercase">CRÉDITO</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Monto Original (USD)</label>
                    <p className="text-lg font-black text-black">
                      {formatUsd(selectedTransaction.accountInfo.amountUsd || 
                        (selectedTransaction.accountInfo.amountBs / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate)))}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Estado</label>
                    <p className={cn(
                      "inline-block px-3 py-1 rounded-full text-[10px] font-bold",
                      selectedTransaction.accountInfo.status === 'pagada' ? "bg-green-100 text-green-700" :
                      selectedTransaction.accountInfo.status === 'parcial' ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {selectedTransaction.accountInfo.status === 'pagada' ? 'PAGADA' :
                       selectedTransaction.accountInfo.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                    </p>
                  </div>
                </div>

                {/* ✅ Tasa BCV HISTÓRICA - Valor FIJO e INMUTABLE */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-amber-700" />
                      <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                        Tasa BCV al Momento del Crédito
                      </label>
                    </div>
                    <div className="text-right">
                      {historicalRate ? (
                        <>
                          <p className="text-lg font-black text-amber-800">
                            1 USD = {formatBsNumber(historicalRate)}
                          </p>
                          <p className="text-[8px] text-amber-600">
                            Valor fijo aplicado el {new Date(selectedTransaction.accountInfo.date).toLocaleDateString('es-VE')}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-red-600">No registrada</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabla de Productos */}
                <div>
                  <label className="text-[10px] font-black text-black/60 uppercase tracking-widest flex items-center gap-2 mb-3">
                    📦 PRODUCTOS
                  </label>
                  <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#E8E8E8]">
                        <tr className="border-b border-[#9E9E9E]">
                          <th className="text-left p-3 text-[10px] font-black text-black uppercase">CANT</th>
                          <th className="text-left p-3 text-[10px] font-black text-black uppercase">PRODUCTO</th>
                          <th className="text-right p-3 text-[10px] font-black text-black uppercase">PRECIO</th>
                          <th className="text-right p-3 text-[10px] font-black text-black uppercase">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const items = getTransactionItems();
                          if (items.length > 0) {
                            return items.map((item: ProductItem, idx: number) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                <td className="p-3 text-xs font-bold text-black">{item.qty}</td>
                                <td className="p-3 text-xs font-bold text-black">{item.name}</td>
                                <td className="p-3 text-right text-xs font-bold text-black">
                                  {item.priceBs > 0 ? formatBs(item.priceBs) : 
                                   item.priceUsd > 0 ? formatUsd(item.priceUsd) : '—'}
                                </td>
                                <td className="p-3 text-right text-xs font-bold text-black">
                                  {item.priceBs > 0 ? formatBs(item.priceBs * item.qty) : 
                                   item.priceUsd > 0 ? formatUsd(item.priceUsd * item.qty) : '—'}
                                </td>
                              </tr>
                            ));
                          }
                          return (
                            <tr>
                              <td colSpan={4} className="text-center p-4 text-black/50 italic">
                                No se pudieron cargar los productos
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totales con tasa histórica */}
                <div className="bg-[#F5F5F5] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Monto Original en USD:</span>
                    <span className="font-bold text-black">
                      {formatUsd(selectedTransaction.accountInfo.amountUsd || 
                        (selectedTransaction.accountInfo.amountBs / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate)))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Monto Pagado (USD):</span>
                    <span className="font-bold text-green-600">
                      {formatUsd((selectedTransaction.accountInfo.paidAmount || 0) / 
                        (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#9E9E9E]">
                    <span className="text-black/60">Saldo Pendiente (USD):</span>
                    <span className="font-bold text-red-600">
                      {formatUsd((selectedTransaction.accountInfo.amountUsd || 
                        (selectedTransaction.accountInfo.amountBs / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate))) - 
                        ((selectedTransaction.accountInfo.paidAmount || 0) / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate)))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-black/60">Equivalente hoy (Tasa actual):</span>
                    <div className="text-right">
                      <span className="font-bold text-amber-700">
                        {formatBs(selectedTransaction.accountInfo.amountUsd ? 
                          selectedTransaction.accountInfo.amountUsd * currentExchangeRate : 
                          (selectedTransaction.accountInfo.amountBs / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate)) * currentExchangeRate)}
                      </span>
                      <span className="text-xs text-black/50 ml-2">(tasa actual)</span>
                    </div>
                  </div>
                  <div className="text-[8px] text-amber-600 text-center pt-2 border-t border-dashed border-[#9E9E9E]">
                    ⚠️ Los valores en USD son fijos desde el momento del crédito
                  </div>
                </div>

                {/* Historial de Abonos */}
                {(selectedTransaction.accountInfo.paidAmount || 0) > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <History size={12} /> HISTORIAL DE ABONOS
                    </label>
                    <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#E8E8E8]">
                          <tr className="border-b border-[#9E9E9E]">
                            <th className="text-left p-3 text-[10px] font-black text-black uppercase">FECHA</th>
                            <th className="text-right p-3 text-[10px] font-black text-black uppercase">MONTO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const abonos = abonosForClient;
                            if (abonos.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={2} className="text-center p-4 text-black/50 italic">
                                    No hay registros de abonos individuales
                                  </td>
                                </tr>
                              );
                            }
                            return abonos.map((abono, idx) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                <td className="p-3 text-xs font-bold text-black">{formatDateShort(abono.date)}</td>
                                <td className="p-3 text-right text-xs font-bold text-green-600">
                                  {formatBs(abono.total)}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                        <tfoot className="bg-[#F0F0F0]">
                          <tr>
                            <td className="p-3 text-xs font-bold text-black">TOTAL ABONADO (Bs)</td>
                            <td className="p-3 text-right text-sm font-black text-green-700">
                              {formatBs(selectedTransaction.accountInfo.paidAmount || 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end">
                <Button 
                  onClick={() => setShowDetailModal(false)} 
                  className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]"
                >
                  CERRAR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}