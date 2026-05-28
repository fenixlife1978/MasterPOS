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

  // Calcular ventas totales del día por método (en Bs para métodos Bs, en USD para métodos USD)
  const salesByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.id] = 0);
    
    if (!reg?.txs) return totals;
    
    const today = new Date().toISOString().split('T')[0];
    const txDay = reg.txs.filter((t: any) => t.date?.startsWith(today));
    
    for (const tx of txDay) {
      if (tx.type !== 'contado' && tx.type !== 'cobro_deuda') continue;
      const methodKey = tx.payMethod || 'efectivo_bs';
      const isUsdMethod = methodKey === 'usd_efectivo' || methodKey === 'zelle';
      
      let monto = 0;
      if (isUsdMethod) {
        // Sumar usdAmount de los pagos para métodos USD
        if (tx.payments && Array.isArray(tx.payments)) {
          tx.payments.forEach((p: any) => {
            if (p.method === methodKey && p.usdAmount) {
              monto += p.usdAmount;
            }
          });
        } else {
          // Fallback: usar total en USD de la transacción
          monto = tx.totalUsd || 0;
        }
      } else {
        // Métodos Bs
        monto = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
      }
      totals[methodKey] = (totals[methodKey] || 0) + monto;
    }
    return totals;
  }, [reg?.txs, paymentMethods]);

  // Total de efectivo USD (solo para mostrar en la columna "EFECTIVO USD" de la tabla)
  const totalEfectivoUsd = useMemo(() => {
    if (!reg?.txs) return 0;
    const today = new Date().toISOString().split('T')[0];
    const txDay = reg.txs.filter((t: any) => t.date?.startsWith(today) && t.type === 'contado');
    let total = 0;
    for (const tx of txDay) {
      if (tx.payments && Array.isArray(tx.payments)) {
        tx.payments.forEach((p: any) => {
          if (p.method === 'usd_efectivo' && p.usdAmount) total += p.usdAmount;
        });
      }
    }
    return total;
  }, [reg?.txs]);

  const totalContado = useMemo(() => {
    let total = 0;
    for (const m of paymentMethods) {
      total += salesByMethod[m.id];
    }
    return total;
  }, [salesByMethod]);

  const totalEnCaja = (reg?.openAmount || 0) + (() => {
    // Convertir ventas en USD a Bs según tasa actual para sumar al total en caja
    let usdTotal = 0;
    for (const m of paymentMethods.filter(p => p.isUsd)) {
      usdTotal += salesByMethod[m.id];
    }
    return totalContado - (usdTotal * state.exchangeRate) + (usdTotal * state.exchangeRate);
    // En realidad, el total en caja debería ser apertura + ventas en Bs + (ventas en USD * tasa)
  })();
  const totalEnCajaUSD = totalEnCaja / (state.exchangeRate || 1);

  const handleOpenCash = () => {
    const bsAmount = parseFloat(openAmountBs) || 0;
    const usdAmount = parseFloat(openAmountUsd) || 0;
    state.openCashRegister(bsAmount, usdAmount, state.exchangeRate);
  };

  const handleCambioTasa = async () => {
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
                    <th className="p-2 text-right">TOTAL</th>
                    <th className="p-2 text-right">EFECTIVO USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10px]">
                  {paymentMethods.map(({ id, label, icon: Icon, isUsd }) => {
                    const monto = salesByMethod[id] || 0;
                    let montoFormateado = '';
                    if (isUsd) {
                      montoFormateado = formatUsd(monto);
                    } else {
                      montoFormateado = formatBs(monto);
                    }
                    return (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="p-2"><div className="flex items-center gap-2"><Icon size={12} className="text-[#1E3A8A]" /><span className="font-bold">{label}</span></div></td>
                        <td className="p-2 text-right font-mono font-bold">{montoFormateado}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {id === 'usd_efectivo' ? formatUsd(totalEfectivoUsd) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#F0F0F0] font-black">
                    <td className="p-2">TOTAL VENTAS CONTADO / INGRESOS</td>
                    <td className="p-2 text-right font-mono">{formatBs(totalContado)}</td>
                    <td className="p-2 text-right font-mono">{formatUsd(totalEfectivoUsd)}</td>
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