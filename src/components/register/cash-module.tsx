"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Vault, Lock, Unlock, Banknote, Smartphone, Fingerprint, 
  Plane, DollarSign, Archive, CreditCard, Receipt, 
  BarChart3, Clock, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import CierreFinalForm from '@/components/register/CierreFinalForm';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { syncService } from '@/services/syncService';

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

// ✅ Función para obtener la fecha actual en formato YYYY-MM-DD (Venezuela)
function getTodayYMD(): string {
  return getVenezuelaDateString(new Date());
}

export default function CashModule({ state }: CashModuleProps) {
  const { user } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const terminalName = user?.terminalId ? `Terminal ${user.terminalId}` : 'Terminal Principal';

  const [openAmountBs, setOpenAmountBs] = useState('0.00');
  const [openAmountUsd, setOpenAmountUsd] = useState('0.00');
  const [showCierreFinal, setShowCierreFinal] = useState(false);
  const [showCambioTasaModal, setShowCambioTasaModal] = useState(false);
  const [nuevaTasaInput, setNuevaTasaInput] = useState(state.exchangeRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  
  // Estados para bloqueo de terminal
  const [isTerminalBlocked, setIsTerminalBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);

  // ✅ Suscripción en TIEMPO REAL al bloqueo de terminal
  useEffect(() => {
    if (!user || user.role === 'admin' || !user.terminalId) {
      setCheckingBlock(false);
      return;
    }

    const unsubscribe = syncService.subscribeToTerminal(user.terminalId, (terminal) => {
      setIsTerminalBlocked(terminal?.isBlocked === true);
      setCheckingBlock(false);
    });

    return () => unsubscribe();
  }, [user]);

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  const paymentMethods = [
    { id: 'efectivo_bs', label: 'EFECTIVO BS', icon: Banknote, isUsd: false },
    { id: 'usd_efectivo', label: 'EFECTIVO USD', icon: DollarSign, isUsd: true },
    { id: 'tarjeta', label: 'TARJETA', icon: CreditCard, isUsd: false },
    { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, isUsd: false },
    { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, isUsd: false },
    { id: 'zelle', label: 'ZELLE', icon: Plane, isUsd: true },
  ];

  // Calcular ventas del día por método: totalBs y totalUsd
  const salesBreakdown = useMemo(() => {
    const totalsBs: Record<string, number> = {};
    const totalsUsd: Record<string, number> = {};
    paymentMethods.forEach(m => {
      totalsBs[m.id] = 0;
      totalsUsd[m.id] = 0;
    });
    
    if (!reg?.txs || reg.txs.length === 0) return { totalsBs, totalsUsd };
    
    const todayYMD = getTodayYMD();
    
    // ✅ Filtrar transacciones del día actual (comparando la fecha en formato YYYY-MM-DD)
    const txDay = reg.txs.filter((t: any) => {
      const txDateYMD = getVenezuelaDateString(t.date);
      return txDateYMD === todayYMD;
    });
    
    for (const tx of txDay) {
      // Solo transacciones que representan ingreso de efectivo (contado, cobro de deuda)
      if (tx.type !== 'contado' && tx.type !== 'cobro_deuda') continue;
      
      // Si tiene pagos detallados (pago compuesto)
      if (tx.payments && Array.isArray(tx.payments) && tx.payments.length > 0) {
        for (const payment of tx.payments) {
          const method = payment.method;
          if (!method) continue;
          const isUsd = method === 'usd_efectivo' || method === 'zelle';
          if (isUsd) {
            // ✅ usar usdAmount (propiedad correcta en PaymentDetail)
            const usdAmount = payment.usdAmount !== undefined ? payment.usdAmount : payment.amount;
            totalsUsd[method] = (totalsUsd[method] || 0) + usdAmount;
            // No sumamos nada en Bs para métodos USD
          } else {
            const bsAmount = payment.amount || 0;
            totalsBs[method] = (totalsBs[method] || 0) + bsAmount;
          }
        }
      } else {
        // Pago único
        const method = tx.payMethod || 'efectivo_bs';
        const isUsd = method === 'usd_efectivo' || method === 'zelle';
        if (isUsd) {
          const usdAmount = tx.totalUsd || 0;
          totalsUsd[method] = (totalsUsd[method] || 0) + usdAmount;
        } else {
          const bsAmount = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
          totalsBs[method] = (totalsBs[method] || 0) + bsAmount;
        }
      }
    }
    
    return { totalsBs, totalsUsd };
  }, [reg?.txs]);

  const totalContadoBs = useMemo(() => {
    let total = 0;
    for (const m of paymentMethods.filter(p => !p.isUsd)) {
      total += salesBreakdown.totalsBs[m.id];
    }
    return total;
  }, [salesBreakdown]);

  const totalContadoUsd = useMemo(() => {
    let total = 0;
    for (const m of paymentMethods.filter(p => p.isUsd)) {
      total += salesBreakdown.totalsUsd[m.id];
    }
    return total;
  }, [salesBreakdown]);

  // Total en caja: fondo en Bs + ventas en Bs (los USD no se suman al total en Bs)
  const totalEnCaja = (reg?.openAmountBs || 0) + totalContadoBs;
  const totalEnCajaUSD = (reg?.openAmountUsd || 0) + totalContadoUsd;

  const handleOpenCash = () => {
    if (isTerminalBlocked) {
      alert('Terminal bloqueada. No se puede abrir la caja.');
      return;
    }
    const bsAmount = parseFloat(openAmountBs) || 0;
    const usdAmount = parseFloat(openAmountUsd) || 0;
    state.openCashRegister(bsAmount, usdAmount, state.exchangeRate);
  };

  const handleCambioTasa = async () => {
    if (isTerminalBlocked) {
      alert('Terminal bloqueada. No se puede cambiar la tasa.');
      return;
    }
    const newRate = parseFloat(nuevaTasaInput);
    if (isNaN(newRate) || newRate <= 0) {
      alert("Ingrese una tasa válida");
      return;
    }
    setIsUpdatingRate(true);
    try {
      await state.setExchangeRate(newRate);
      setShowCambioTasaModal(false);
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar la tasa");
    } finally {
      setIsUpdatingRate(false);
    }
  };

  // Pantalla de carga
  if (checkingBlock) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-black/50">Verificando terminal...</p>
        </div>
      </div>
    );
  }

  // Pantalla de bloqueo si la terminal está bloqueada
  if (isTerminalBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 text-center max-w-md">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-black text-red-700 mb-2">TERMINAL BLOQUEADA</h2>
          <p className="text-sm text-red-600 mb-4">
            Esta estación de trabajo ha sido bloqueada por el administrador.
          </p>
          <p className="text-xs text-red-500">
            Para desbloquear, comuníquese con su supervisor.
          </p>
        </div>
      </div>
    );
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
              <div className="flex items-end gap-2">
                <Button onClick={handleOpenCash} className="w-full bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-8 text-xs">
                  <Unlock size={12} className="mr-1" /> ABRIR CAJA
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md">
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => setShowCierreFinal(true)} className="bg-[#1E3A8A] hover:bg-[#2c3e50] text-white font-black py-4 px-6 text-sm">
                <BarChart3 size={16} className="mr-2" /> CIERRE FINAL
              </Button>
              <Button onClick={() => setShowCambioTasaModal(true)} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm">
                <Percent size={16} className="mr-2" /> CAMBIAR TASA
              </Button>
            </div>
          </div>
        )}

        {!isClosed && (
          <div className="mt-6">
            <h3 className="text-xs font-black uppercase mb-3 flex items-center gap-2 text-[#1E3A8A]">
              <Vault size={12} /> Ventas del Período Actual
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider">
                    <th className="p-2">MÉTODO DE PAGO</th>
                    <th className="p-2 text-right">TOTAL (Bs)</th>
                    <th className="p-2 text-right">VENTAS EN USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10px]">
                  {paymentMethods.map(({ id, label, icon: Icon, isUsd }) => {
                    const montoBs = salesBreakdown.totalsBs[id] || 0;
                    const montoUsd = salesBreakdown.totalsUsd[id] || 0;
                    return (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="p-2"><div className="flex items-center gap-2"><Icon size={12} className="text-[#1E3A8A]" /><span className="font-bold">{label}</span></div></td>
                        <td className="p-2 text-right font-mono font-bold">
                          {!isUsd ? formatBs(montoBs) : '0,00'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {isUsd ? formatUsd(montoUsd) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#F0F0F0] font-black">
                    <td className="p-2">TOTAL VENTAS CONTADO / INGRESOS</td>
                    <td className="p-2 text-right font-mono">{formatBs(totalContadoBs)}</td>
                    <td className="p-2 text-right font-mono">{formatUsd(totalContadoUsd)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal para cambiar tasa BCV */}
        {showCambioTasaModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-lg font-black mb-4">Cambiar Tasa BCV</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold block mb-1">Nueva Tasa (Bs/USD)</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={nuevaTasaInput} 
                    onChange={(e) => setNuevaTasaInput(e.target.value)} 
                    className="font-mono text-right"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tasa actual: {formatBs(state.exchangeRate)}</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setShowCambioTasaModal(false)} className="text-sm">Cancelar</Button>
                  <Button onClick={handleCambioTasa} disabled={isUpdatingRate} className="bg-primary text-black font-black">
                    {isUpdatingRate ? "Actualizando..." : "Cambiar Tasa"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}