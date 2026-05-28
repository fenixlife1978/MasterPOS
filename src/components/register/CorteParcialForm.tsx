"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  CheckCircle2, XCircle, AlertTriangle, Printer, 
  RefreshCw, Ban, ArrowLeftRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';
import { formatBs, formatUsd, formatBsNumber } from '@/lib/currency-formatter';

interface CorteParcialFormProps {
  onClose: () => void;
  onCorteConfirmado: (nuevaTasa: number) => void;
  tasaActual: number;
  onTasaActualizada: (nuevaTasa: number) => void;
}

export default function CorteParcialForm({ onClose, onCorteConfirmado, tasaActual, onTasaActualizada }: CorteParcialFormProps) {
  const state = usePOSState();
  const { user } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const [register, setRegister] = useState<any>(null);
  const [nuevaTasa, setNuevaTasa] = useState<string>('');
  const [tasaValidada, setTasaValidada] = useState<boolean>(false);
  const [isConciliado, setIsConciliado] = useState<boolean>(false);
  const [fisicos, setFisicos] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (state.register) {
      setRegister(state.register);
    } else {
      const cached = localStorage.getItem(`pos_register_${terminalId}`);
      if (cached) {
        try {
          setRegister(JSON.parse(cached));
        } catch(e) {}
      }
    }
  }, [state.register, terminalId]);

  const openAmountBs = register?.openAmountBs ?? 0;
  const openAmountUsd = register?.openAmountUsd ?? 0;
  const openAmountUsdBs = openAmountUsd * tasaActual;

  const paymentMethods = [
    { id: 1, metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false },
    { id: 2, metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true },
    { id: 3, metodo: 'TARJETA', key: 'tarjeta', isUsd: false },
    { id: 4, metodo: 'BIOPAGO', key: 'biopago', isUsd: false },
    { id: 5, metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false },
    { id: 6, metodo: 'ZELLE', key: 'zelle', isUsd: true },
  ];

  // Ventas CONTADO del día (en Bs)
  const salesByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    
    if (register?.txs && Array.isArray(register.txs)) {
      register.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        if (!isToday) return;
        
        if (t.type === 'contado') {
          const method = t.payMethod || 'efectivo_bs';
          let monto = t.total ?? 0;
          monto = Math.round(monto * 100) / 100;
          totals[method] = Math.round((totals[method] + monto) * 100) / 100;
        } 
        else if (t.type === 'cobro_deuda') {
          const method = t.payMethod || 'efectivo_bs';
          let monto = t.paidBs ?? 0;
          monto = Math.round(monto * 100) / 100;
          totals[method] = Math.round((totals[method] + monto) * 100) / 100;
        }
      });
    }
    return totals;
  }, [register]);

  // DEVOLUCIONES del día (en Bs)
  const returnsByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    
    if (register?.txs && Array.isArray(register.txs)) {
      register.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        if (!isToday) return;
        
        if (t.type === 'devolucion') {
          const method = t.payMethod || 'efectivo_bs';
          let monto = t.total ?? 0;
          monto = Math.round(monto * 100) / 100;
          totals[method] = Math.round((totals[method] + monto) * 100) / 100;
        }
      });
    }
    return totals;
  }, [register]);

  // USD en efectivo recibidos (solo método 'usd_efectivo')
  const usdCashReceived = useMemo(() => {
    let totalUsd = 0;
    if (register?.txs && Array.isArray(register.txs)) {
      register.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        if (!isToday) return;
        if (t.type === 'contado' && t.payments) {
          t.payments.forEach((p: any) => {
            if (p.method === 'usd_efectivo' && p.usdAmount) {
              totalUsd += p.usdAmount;
            }
          });
        }
      });
    }
    return totalUsd;
  }, [register]);

  // USD recibidos por Zelle (método 'zelle')
  const usdZelleReceived = useMemo(() => {
    let totalUsd = 0;
    if (register?.txs && Array.isArray(register.txs)) {
      register.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        if (!isToday) return;
        if (t.type === 'contado' && t.payments) {
          t.payments.forEach((p: any) => {
            if (p.method === 'zelle' && p.usdAmount) {
              totalUsd += p.usdAmount;
            }
          });
        }
      });
    }
    return totalUsd;
  }, [register]);

  const totalCashUsd = openAmountUsd + usdCashReceived; // efectivo físico USD
  const totalZelleUsd = usdZelleReceived;

  // Ventas a CRÉDITO del día
  const creditTotal = useMemo(() => {
    let total = 0;
    if (register?.txs && Array.isArray(register.txs)) {
      register.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        if (isToday && t.type === 'credito') {
          total += t.total || 0;
        }
      });
    }
    return total;
  }, [register]);

  // Generar filas con valores en la moneda correspondiente
  const rows = paymentMethods.map(pm => {
    const isUsd = pm.isUsd;
    let saldoInicial = 0;
    let ventas = 0;
    let devoluciones = 0;
    let teorico = 0;
    let fisico = 0;
    let diff = 0;

    if (isUsd) {
      // Valores en USD
      if (pm.key === 'usd_efectivo') {
        saldoInicial = openAmountUsd;
        ventas = usdCashReceived;
        devoluciones = (returnsByMethod[pm.key] || 0) / tasaActual;
      } else if (pm.key === 'zelle') {
        saldoInicial = 0;
        ventas = usdZelleReceived;
        devoluciones = (returnsByMethod[pm.key] || 0) / tasaActual;
      }
      teorico = saldoInicial + ventas - devoluciones;
      fisico = fisicos[pm.key] ?? (pm.key === 'zelle' ? teorico : 0);
      diff = fisico - teorico;
    } else {
      // Valores en Bs
      saldoInicial = pm.key === 'efectivo_bs' ? openAmountBs : 0;
      ventas = salesByMethod[pm.key] || 0;
      devoluciones = returnsByMethod[pm.key] || 0;
      teorico = saldoInicial + ventas - devoluciones;
      fisico = fisicos[pm.key] ?? 0;
      diff = fisico - teorico;
    }

    const isZelle = pm.key === 'zelle';
    const estado = Math.abs(diff) < 0.01 ? 'CUADRA' : (diff < 0 ? 'FALTANTE' : 'SOBRANTE');

    return {
      ...pm,
      saldoInicial,
      ventas,
      devoluciones,
      teorico,
      fisico,
      diff,
      isZelle,
      estado,
    };
  });

  // Diferencia neta global convertida a Bs
  const diffNeta = rows.reduce((sum, r) => {
    if (r.isUsd) {
      return sum + (r.diff * tasaActual);
    } else {
      return sum + r.diff;
    }
  }, 0);

  const handleFisicoChange = (key: string, val: number) => {
    setFisicos(prev => ({ ...prev, [key]: val }));
  };

  const handleConfirmarCorte = async () => {
    if (!tasaValidada || !isConciliado) return;
    setIsSubmitting(true);
    const nTasa = parseFloat(nuevaTasa);
    const fBs = fisicos['efectivo_bs'] ?? 0;
    const fUsd = fisicos['usd_efectivo'] ?? 0;
    
    const report = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      tasaBCV: tasaActual,
      tasaNueva: nTasa,
      apertura: { montoBs: openAmountBs, montoUsd: openAmountUsd },
      ventas: { porMetodo: salesByMethod },
      devoluciones: { porMetodo: returnsByMethod },
      creditos: { total: creditTotal },
      usdEfectivo: totalCashUsd,
      usdZelle: totalZelleUsd,
      cuadre: rows.map(r => ({ 
        metodo: r.metodo, 
        sistema: r.teorico,
        real: r.fisico,
        diff: r.diff,
        moneda: r.isUsd ? 'USD' : 'Bs'
      })),
      nuevoFondo: { bs: fBs, usd: fUsd, totalBs: fBs + (fUsd * nTasa) }
    };

    localStorage.setItem(`corte_parcial_${Date.now()}`, JSON.stringify(report));
    
    await state.setExchangeRate(nTasa);
    
    await syncService.saveRegisterByTerminal(terminalId, {
      ...register,
      isOpen: true,
      openAmount: report.nuevoFondo.totalBs,
      openAmountBs: fBs,
      openAmountUsd: fUsd,
      exchangeRate: nTasa,
      txs: register?.txs || [],
      updatedAt: Date.now()
    });
    
    setIsSubmitting(false);
    onCorteConfirmado(nTasa);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[98vh]">
        <div className="bg-[#1E3A8A] text-white p-3 border-b-4 border-[#0284C7]">
          <h1 className="text-center font-black uppercase text-base">Corte Parcial</h1>
        </div>
        
        <div className="bg-white p-3 grid grid-cols-3 gap-3 border-b">
          <div className="bg-slate-50 p-2 rounded-lg border">
            <span className="text-[8px] font-bold text-slate-500 uppercase">Tasa Actual:</span>
            <p className="text-sm font-bold">{formatBs(tasaActual)}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border">
            <span className="text-[8px] font-bold text-slate-500 uppercase">Apertura BS:</span>
            <p className="text-sm font-bold">{formatBs(openAmountBs)}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border">
            <span className="text-[8px] font-bold text-slate-500 uppercase">Apertura USD:</span>
            <p className="text-sm font-bold">{formatUsd(openAmountUsd)}</p>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-[10px]">
            <thead className="bg-[#2c3e50] text-white sticky top-0">
              <tr>
                <th className="p-2 text-left">MÉTODO</th>
                <th className="p-2 text-center">SALDO INICIAL</th>
                <th className="p-2 text-center">VENTAS CONTADO</th>
                <th className="p-2 text-center">DEVOLUCIONES</th>
                <th className="p-2 text-center">SISTEMA</th>
                <th className="p-2 text-center">EFECTIVO USD</th>
                <th className="p-2 text-center">FÍSICO</th>
                <th className="p-2 text-center">DIF.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(r => {
                let usdDisplay = '—';
                if (r.key === 'usd_efectivo') usdDisplay = formatUsd(totalCashUsd);
                if (r.key === 'zelle') usdDisplay = '—';
                const isUsdRow = r.isUsd;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2 font-bold">{r.metodo}</td>
                    <td className="p-2 text-center font-mono">
                      {isUsdRow ? formatUsd(r.saldoInicial) : formatBs(r.saldoInicial)}
                    </td>
                    <td className="p-2 text-center font-mono">
                      {isUsdRow ? formatUsd(r.ventas) : formatBs(r.ventas)}
                    </td>
                    <td className="p-2 text-center font-mono text-red-600">
                      {isUsdRow ? `-${formatUsd(r.devoluciones)}` : `-${formatBs(r.devoluciones)}`}
                    </td>
                    <td className="p-2 text-center font-mono font-bold">
                      {isUsdRow ? formatUsd(r.teorico) : formatBs(r.teorico)}
                    </td>
                    <td className="p-2 text-center font-mono font-bold text-blue-600">{usdDisplay}</td>
                    <td className="p-2 text-center">
                      {r.isZelle ? (
                        <span className="text-green-600 font-bold text-lg">✓</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={r.fisico === 0 ? '' : r.fisico} 
                            onChange={e => handleFisicoChange(r.key, parseFloat(e.target.value) || 0)} 
                            className="w-28 h-7 text-xs text-center font-bold" 
                            placeholder="0.00"
                          />
                          <span className="text-[9px] font-bold text-slate-500">{isUsdRow ? 'USD' : 'Bs'}</span>
                        </div>
                      )}
                      {isUsdRow && !r.isZelle && r.fisico > 0 && (
                        <div className="text-[8px] text-slate-400 mt-0.5">
                          ≈ {formatBs(r.fisico * tasaActual)}
                        </div>
                      )}
                    </td>
                    <td className={cn("p-2 text-center font-bold", r.diff < 0 ? "text-red-600" : r.diff > 0 ? "text-emerald-600" : "text-slate-500")}>
                      {r.diff === 0 ? '✓' : (isUsdRow ? formatUsd(Math.abs(r.diff)) : formatBsNumber(Math.abs(r.diff)))}
                    </td>
                  </tr>
                );
              })}
              {/* Fila adicional para VENTAS A CRÉDITO */}
              {creditTotal > 0 && (
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td className="p-2 font-bold text-blue-800">CRÉDITO</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center font-bold text-blue-800">{formatBs(creditTotal)}</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center text-green-600 font-bold text-lg">✓</td>
                  <td className="p-2 text-center text-green-600">0.00</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 sticky bottom-0">
              <tr className="border-t-2 border-slate-300 font-black">
                <td className="p-2 text-right" colSpan={5}>TOTALES:</td>
                <td className="p-2 text-center font-mono">{formatUsd(totalCashUsd)}</td>
                <td className="p-2 text-center">—</td>
                <td className="p-2 text-center">{diffNeta === 0 ? '✓' : formatBsNumber(Math.abs(diffNeta))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bg-white p-4 border-t">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <div className="bg-slate-100 p-3 rounded-xl border border-dashed flex-1 min-w-[250px]">
              <span className="text-[9px] font-bold text-blue-800">DECLARAR NUEVA TASA BCV</span>
              <div className="flex gap-2 mt-1">
                <Input 
                  type="number" 
                  step="0.01" 
                  value={nuevaTasa} 
                  onChange={e => {
                    setNuevaTasa(e.target.value);
                    setTasaValidada(false);
                  }} 
                  disabled={tasaValidada} 
                  className="h-8 font-mono text-sm" 
                  placeholder="Nueva tasa..." 
                />
                <Button 
                  onClick={() => {
                    if (nuevaTasa && parseFloat(nuevaTasa) > 0) {
                      setTasaValidada(true);
                      onTasaActualizada(parseFloat(nuevaTasa));
                    }
                  }} 
                  className={cn(tasaValidada ? "bg-amber-500" : "bg-emerald-600", "h-8 text-white text-xs font-bold")}
                >
                  {tasaValidada ? 'Editar' : 'Validar'}
                </Button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Diferencia Neta Global:</p>
              <p className={cn("text-2xl font-black", diffNeta < 0 ? "text-red-600" : diffNeta > 0 ? "text-emerald-600" : "text-slate-500")}>
                {formatBs(diffNeta)}
              </p>
            </div>
          </div>
          
          <div className="flex justify-between items-center border-t pt-3 flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isConciliado} 
                onChange={e => setIsConciliado(e.target.checked)} 
                className="rounded text-blue-600 w-4 h-4" 
              />
              <span className="text-[10px] font-bold uppercase">Declaro bajo firma el conteo físico parcial</span>
            </label>
            <div className="flex gap-2">
              <Button onClick={onClose} variant="ghost" className="text-red-600 font-bold text-xs h-8">Cancelar</Button>
              <Button 
                disabled={!tasaValidada || !isConciliado || isSubmitting} 
                onClick={handleConfirmarCorte} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
              >
                {isSubmitting ? 'PROCESANDO...' : 'REAPERTURAR'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}