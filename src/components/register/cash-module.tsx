"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Vault, Lock, Unlock, Banknote, Smartphone, Fingerprint, 
  Plane, DollarSign, Archive, CreditCard, Receipt, 
  ArrowLeftRight, BarChart3, Clock, RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import CorteParcialForm from '@/components/register/CorteParcialForm';
import CierreFinalForm from '@/components/register/CierreFinalForm';
import { formatBs, formatUsd } from '@/lib/currency-formatter';

interface CashModuleProps {
  state: ReturnType<typeof usePOSState>;
}

function getVenezuelaDateString(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const formatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch (e) {
    return "";
  }
}

function isTodayVenezuela(date: Date | string | number): boolean {
  const today = getVenezuelaDateString(new Date());
  const dateStr = getVenezuelaDateString(date);
  return today !== "" && today === dateStr;
}

export default function CashModule({ state }: CashModuleProps) {
  const { user } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const terminalName = user?.terminalId ? `Terminal ${user.terminalId}` : 'Terminal Principal';

  const [openAmountBs, setOpenAmountBs] = useState('0.00');
  const [openAmountUsd, setOpenAmountUsd] = useState('0.00');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [closeHistory, setCloseHistory] = useState<any[]>([]);
  const [showDailyTx, setShowDailyTx] = useState(true);
  const [showCorteParcial, setShowCorteParcial] = useState(false);
  const [showCierreFinal, setShowCierreFinal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const paymentMethods = [
    { id: 'efectivo_bs', label: 'EFECTIVO BS', icon: Banknote, isUsd: false },
    { id: 'usd_efectivo', label: 'EFECTIVO USD', icon: DollarSign, isUsd: true },
    { id: 'tarjeta', label: 'TARJETA', icon: CreditCard, isUsd: false },
    { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, isUsd: false },
    { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, isUsd: false },
    { id: 'zelle', label: 'ZELLE', icon: Plane, isUsd: true },
  ];

  const methodLabels: Record<string, string> = {};
  paymentMethods.forEach(m => methodLabels[m.id] = m.label);

  const allTransactions = useMemo(() => reg?.txs || [], [reg?.txs, refreshKey]);

  const dailyTransactions = useMemo(() => {
    return allTransactions
      .filter(t => {
        const isSameDay = isTodayVenezuela(t.date);
        const isValidType = t.type === 'contado' || t.type === 'cobro_deuda' || t.type === 'credito';
        return isValidType && isSameDay;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, refreshKey]);

  const cashTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const isSameDay = isTodayVenezuela(t.date);
      return (t.type === 'contado' || t.type === 'cobro_deuda') && isSameDay;
    });
  }, [allTransactions, refreshKey]);

  const creditTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const isSameDay = isTodayVenezuela(t.date);
      return t.type === 'credito' && isSameDay;
    });
  }, [allTransactions, refreshKey]);

  const salesByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.id] = 0);
    cashTransactions.forEach(t => {
      const method = t.payMethod || 'efectivo_bs';
      const montoEfectivo = t.type === 'cobro_deuda' ? (t.paidBs || t.total || 0) : (t.total || 0);
      totals[method] = (totals[method] || 0) + montoEfectivo;
    });
    return totals;
  }, [cashTransactions]);

  const usdCashTotal = useMemo(() => {
    let totalUsd = 0;
    cashTransactions.forEach(t => {
      if (t.type === 'contado' && t.payments) {
        t.payments.forEach(p => {
          if (p.method === 'usd_efectivo' && p.usdAmount) {
            totalUsd += p.usdAmount;
          }
        });
      }
    });
    return totalUsd;
  }, [cashTransactions]);

  const totalCredito = useMemo(() => {
    return creditTransactions.reduce((s, t) => s + (t.total || 0), 0);
  }, [creditTransactions]);

  const totalContado = useMemo(() => {
    return Object.values(salesByMethod).reduce((s, v) => s + v, 0);
  }, [salesByMethod]);

  const totalEnCaja = (reg?.openAmount || 0) + totalContado;
  const totalEnCajaUSD = totalEnCaja / (state.exchangeRate || 1);

  const handleOpenCash = () => {
    const bsAmount = parseFloat(openAmountBs) || 0;
    const usdAmount = parseFloat(openAmountUsd) || 0;
    state.openCashRegister(bsAmount, usdAmount, state.exchangeRate);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (showCorteParcial) {
    return <CorteParcialForm 
      onClose={() => setShowCorteParcial(false)} 
      onCorteConfirmado={() => setShowCorteParcial(false)}
      tasaActual={state.exchangeRate}
      onTasaActualizada={(nuevaTasa) => state.setExchangeRate(nuevaTasa)}
    />;
  }
  if (showCierreFinal) {
    return <CierreFinalForm 
      onClose={() => setShowCierreFinal(false)}
      tasaActual={state.exchangeRate}
    />;
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-[#F9F4E1]">
      <div className="min-h-full p-4 pb-8">
        <header className="bg-[#1E3A8A] text-white p-4 rounded-t-xl shadow-md text-center relative border-b-4 border-[#0284C7]">
          <div className="absolute left-4 top-4 bg-amber-500 text-[10px] font-bold px-2 py-1 rounded text-slate-900">
            {terminalName}
          </div>
          <div className="absolute right-4 top-4">
            <Button onClick={handleRefresh} variant="ghost" size="sm" className="text-white hover:bg-white/20 h-7 w-7 p-0">
              <RefreshCw size={14} />
            </Button>
          </div>
          <h1 className="text-lg md:text-xl font-black tracking-wider uppercase">MasterPOS - Control de Caja</h1>
          <p className="text-[10px] text-blue-200 mt-1 font-mono flex items-center justify-center gap-1">
            <Clock size={10} /> {new Date().toLocaleDateString('es-VE')} • {new Date().toLocaleTimeString('es-VE')}
          </p>
        </header>

        <section className="bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-x border-slate-200 shadow-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Tasa BCV Actual:</span>
            <span className="text-base font-mono font-bold text-slate-900">{formatBs(state.exchangeRate)} / $</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Estado Actual:</span>
            <span className={cn("text-sm font-mono font-bold px-3 py-1 rounded-full inline-block", isClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
              {isClosed ? 'CAJA CERRADA' : 'CAJA ABIERTA'}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Total en Caja (Sistema):</span>
            <span className="text-base font-mono font-bold text-blue-700">{!isClosed ? formatBs(totalEnCaja) : '—'}</span>
            {!isClosed && (
              <>
                <p className="text-[10px] text-slate-500">≈ {formatUsd(totalEnCajaUSD)}</p>
                <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex flex-col gap-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Fondo de Apertura:</p>
                  <p className="text-[9px] font-bold text-slate-600">
                    {formatBs(reg?.openAmountBs || 0)} + {formatUsd(reg?.openAmountUsd || 0)}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {isClosed ? (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md">
            <h2 className="text-sm font-black uppercase mb-4 text-[#1E3A8A] flex items-center gap-2"><Unlock size={14} /> APERTURA DE CAJA</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] font-bold uppercase block mb-1 text-slate-500">Apertura BS (Efectivo)</label>
                <Input type="number" step="0.01" value={openAmountBs} onChange={(e) => setOpenAmountBs(e.target.value)} className="font-bold h-8 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase block mb-1 text-slate-500">Apertura USD (Efectivo)</label>
                <Input type="number" step="0.01" value={openAmountUsd} onChange={(e) => setOpenAmountUsd(e.target.value)} className="font-bold h-8 text-sm" placeholder="0.00" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleOpenCash} className="w-full bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-8 text-xs">
                  <Unlock size={12} className="mr-1" /> ABRIR CAJA
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md">
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => setShowCorteParcial(true)} className="bg-amber-500 hover:bg-amber-600 text-white font-black py-4 px-6 text-sm"><ArrowLeftRight size={16} className="mr-2" /> CORTE PARCIAL</Button>
              <Button onClick={() => setShowCierreFinal(true)} className="bg-[#1E3A8A] hover:bg-[#2c3e50] text-white font-black py-4 px-6 text-sm"><BarChart3 size={16} className="mr-2" /> CIERRE FINAL</Button>
              <Button onClick={() => setShowHistoryModal(true)} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm"><Archive size={16} className="mr-2" /> HISTORIAL</Button>
              <Button onClick={handleRefresh} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm"><RefreshCw size={16} className="mr-2" /> REFRESCAR</Button>
            </div>
          </div>
        )}

        {!isClosed && (
          <div className="mt-6">
            <h3 className="text-xs font-black uppercase mb-3 flex items-center gap-2 text-[#1E3A8A]">
              <Vault size={12} /> Ventas del Período Actual
              <span className="text-[9px] text-green-600 font-normal ml-2">({dailyTransactions.length} transacciones hoy)</span>
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider">
                    <th className="p-2">MÉTODO DE PAGO</th>
                    <th className="p-2 text-right">TOTAL Bs</th>
                    <th className="p-2 text-right">EFECTIVO USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10px]">
                  {paymentMethods.map(({ id, label, icon: Icon, isUsd }) => {
                    const monto = salesByMethod[id] || 0;
                    return (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="p-2"><div className="flex items-center gap-2"><Icon size={12} className="text-[#1E3A8A]" /><span className="font-bold">{label}</span></div></td>
                        <td className="p-2 text-right font-mono font-bold">{formatBs(monto)}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {isUsd ? <span className="text-blue-600">{formatUsd(usdCashTotal)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#F0F0F0] font-black">
                    <td className="p-2">TOTAL VENTAS CONTADO / INGRESOS</td>
                    <td className="p-2 text-right font-mono">{formatBs(totalContado)}</td>
                    <td className="p-2 text-right font-mono">{formatUsd(usdCashTotal)}</td>
                  </tr>
                  <tr className="bg-[#E8E8E8]">
                    <td className="p-2">VENTAS CRÉDITO (Cuentas por Cobrar)</td>
                    <td className="p-2 text-right font-mono">{formatBs(totalCredito)}</td>
                    <td className="p-2 text-right font-mono">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
          <div className="bg-[#1E3A8A] p-2 flex justify-between items-center cursor-pointer" onClick={() => setShowDailyTx(!showDailyTx)}>
            <div className="flex items-center gap-2 text-white"><Receipt size={12} /><h3 className="text-xs font-black">Transacciones del Día ({dailyTransactions.length})</h3></div>
            <button className="text-white/60 hover:text-white text-xs">{showDailyTx ? '▲' : '▼'}</button>
          </div>
          {showDailyTx && (
            <div className="max-h-64 overflow-y-auto">
              {dailyTransactions.length === 0 ? (
                <div className="text-center py-8"><p className="text-black/40 italic text-xs">Sin movimientos registrados hoy</p><p className="text-[9px] text-black/30 mt-1">Realiza una venta para verla reflejada aquí</p></div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F5F5F5] sticky top-0">
                    <tr className="text-[8px] font-black uppercase">
                      <th className="p-1.5">#</th><th className="p-1.5">HORA</th><th className="p-1.5">TIPO</th><th className="p-1.5">MÉTODO</th><th className="p-1.5">CLIENTE</th><th className="p-1.5 text-right">MONTO</th><th className="p-1.5 text-right">USD EFECTIVO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[9px]">
                    {dailyTransactions.map((tx, idx) => {
                      let timeStr = "—";
                      try {
                        const txDate = new Date(tx.date);
                        if (!isNaN(txDate.getTime())) {
                          timeStr = txDate.toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", second: "2-digit" });
                        }
                      } catch(e){}
                      const displayAmount = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
                      let usdAmountForTx = 0;
                      if (tx.type === 'contado' && tx.payments) {
                        tx.payments.forEach(p => { if (p.method === 'usd_efectivo' && p.usdAmount) usdAmountForTx += p.usdAmount; });
                      }
                      let tipoLabel = '', tipoColor = '';
                      if (tx.type === 'contado') { tipoLabel = 'VENTA CONTADO'; tipoColor = 'bg-green-100 text-green-700'; }
                      else if (tx.type === 'credito') { tipoLabel = 'VENTA CRÉDITO'; tipoColor = 'bg-blue-100 text-blue-700'; }
                      else if (tx.type === 'cobro_deuda') { tipoLabel = 'COBRO DEUDA'; tipoColor = 'bg-purple-100 text-purple-700'; }
                      return (
                        <tr key={tx.id || idx} className="hover:bg-slate-50">
                          <td className="p-1.5 text-black/40">{idx + 1}</td>
                          <td className="p-1.5 text-black/60 font-mono">{timeStr}</td>
                          <td className="p-1.5"><span className={cn("px-1 py-0.5 rounded text-[8px] font-bold", tipoColor)}>{tipoLabel}</span></td>
                          <td className="p-1.5 text-black/50 uppercase text-[8px]">{methodLabels[tx.payMethod] || tx.payMethod || 'N/A'}</td>
                          <td className="p-1.5 text-black/60 max-w-[100px] truncate">{tx.clientName || 'CLIENTE FINAL'}</td>
                          <td className="p-1.5 text-right font-bold font-mono">{formatBs(displayAmount)}</td>
                          <td className="p-1.5 text-right font-bold font-mono text-blue-600">{usdAmountForTx > 0 ? formatUsd(usdAmountForTx) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-[#1E3A8A] p-4 text-white"><div className="flex justify-between items-center"><h2 className="text-base font-black flex items-center gap-2"><Archive size={18} /> Historial de Cortes y Cierres</h2><button onClick={() => setShowHistoryModal(false)} className="text-white/60 hover:text-white text-xl">&times;</button></div></div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {closeHistory.length === 0 ? <p className="text-center text-black/40 italic py-6 text-sm">No hay cortes ni cierres registrados</p> : (
                  <div className="space-y-2">{closeHistory.map((h: any) => (<div key={h.id} className="border border-slate-200 p-3 rounded-lg hover:bg-slate-50"><div className="flex justify-between items-center flex-wrap gap-2"><div><div className="flex items-center gap-2"><p className="font-bold text-xs">{new Date(h.fecha).toLocaleString('es-VE')}</p><span className={cn("text-[8px] px-2 py-0.5 rounded-full font-bold", h.tipoCorte === 'corte_tasa' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{h.tipoCorte === 'corte_tasa' ? 'CORTE PARCIAL' : 'CIERRE TOTAL'}</span></div><p className="text-[9px] text-black/50">Tasa: {formatBs(h.tasaBCV || 0)} | Ventas: {formatBs(h.ventas?.totalContado || 0)}</p></div></div></div>))}</div>
                )}
              </div>
              <div className="bg-slate-50 p-3 border-t flex justify-end"><Button onClick={() => setShowHistoryModal(false)} className="font-bold text-xs h-7">CERRAR</Button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}