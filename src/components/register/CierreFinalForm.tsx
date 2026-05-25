"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  CheckCircle2, XCircle, AlertTriangle, Printer, 
  Save, Ban, TrendingUp, Clock 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';

interface CierreFinalFormProps {
  onClose: () => void;
  tasaActual: number;
}

interface ConsolidadoRow {
  id: number;
  metodo: string;
  fondoInicial: string;
  fondoInicialBs: number;
  ventasP1: string;
  ventasP1Bs: number;
  ventasP2: string;
  ventasP2Bs: number;
  sistemaBs: number;
  fisico: number;
  diferencia: number;
  estado: 'CUADRA' | 'FALTANTE' | 'SOBRANTE';
}

export default function CierreFinalForm({ onClose, tasaActual }: CierreFinalFormProps) {
  const state = usePOSState();
  const reg = state.register;
  
  const [conteoFisico, setConteoFisico] = useState<Record<number, number>>({});
  const [isConciliado, setIsConciliado] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obtener corte parcial del día
  const corteParcial = useMemo(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('corte_parcial_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          if (new Date(data.fecha).toDateString() === new Date().toDateString()) {
            return data;
          }
        } catch {}
      }
    }
    return null;
  }, []);

  const tasaP1 = corteParcial?.tasaBCV || tasaActual;
  const tasaP2 = tasaActual;
  
  // Fondos iniciales originales del día
  const fondoOpenBs = corteParcial?.apertura?.montoBs ?? reg?.openAmountBs ?? 0;
  const fondoOpenUsd = corteParcial?.apertura?.montoUsd ?? reg?.openAmountUsd ?? 0;

  const paymentMethods = [
    { id: 1, metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false },
    { id: 2, metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true },
    { id: 3, metodo: 'TARJETA', key: 'tarjeta', isUsd: false },
    { id: 4, metodo: 'BIOPAGO', key: 'biopago', isUsd: false },
    { id: 5, metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false },
    { id: 6, metodo: 'ZELLE', key: 'zelle', isUsd: true },
  ];

  // Ventas totales del día (desde reg.txs)
  const totalSalesByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (reg?.txs) {
      reg.txs.forEach(t => {
        const method = t.payMethod || 'efectivo_bs';
        const monto = (t as any).paidBs || t.total || 0;
        totals[method] = (totals[method] || 0) + monto;
      });
    }
    return totals;
  }, [reg]);

  // Ventas Mañana (desde corte parcial)
  const morningSales = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (corteParcial?.ventas?.porMetodo) {
      Object.entries(corteParcial.ventas.porMetodo).forEach(([key, val]) => {
        totals[key] = val as number;
      });
    }
    return totals;
  }, [corteParcial]);

  const rows: ConsolidadoRow[] = paymentMethods.map((pm) => {
    const vP1Bs = morningSales[pm.key] || 0;
    const vTotalBs = totalSalesByMethod[pm.key] || 0;
    const vP2Bs = Math.max(0, vTotalBs - vP1Bs);
    
    let fIniVal = 0;
    if (pm.key === 'efectivo_bs') fIniVal = fondoOpenBs;
    if (pm.key === 'usd_efectivo') fIniVal = fondoOpenUsd;
    
    const fIniBs = pm.isUsd ? fIniVal * tasaP1 : fIniVal;
    const sistBs = fIniBs + vP1Bs + vP2Bs;
    
    const cFisico = conteoFisico[pm.id] || 0;
    const cFisicoBs = pm.isUsd ? cFisico * tasaP2 : cFisico;
    const diffBs = cFisicoBs - sistBs;
    
    return {
      id: pm.id,
      metodo: pm.metodo,
      fondoInicial: pm.isUsd ? `$ ${fIniVal.toFixed(2)}` : `Bs ${fIniVal.toFixed(2)}`,
      fondoInicialBs: fIniBs,
      ventasP1: pm.isUsd ? `$ ${(vP1Bs / tasaP1).toFixed(2)}` : `Bs ${vP1Bs.toFixed(2)}`,
      ventasP1Bs: vP1Bs,
      ventasP2: pm.isUsd ? `$ ${(vP2Bs / tasaP2).toFixed(2)}` : `Bs ${vP2Bs.toFixed(2)}`,
      ventasP2Bs: vP2Bs,
      sistemaBs: sistBs,
      fisico: cFisico,
      diferencia: diffBs,
      estado: Math.abs(diffBs) < 0.01 ? 'CUADRA' : (diffBs < 0 ? 'FALTANTE' : 'SOBRANTE')
    };
  });

  const totalSistemaGeneral = rows.reduce((acc, r) => acc + r.sistemaBs, 0);
  const totalFisicoGeneral = rows.reduce((acc, r) => {
    const pm = paymentMethods.find(p => p.id === r.id);
    return acc + (pm?.isUsd ? r.fisico * tasaP2 : r.fisico);
  }, 0);
  const diferenciaNeta = totalFisicoGeneral - totalSistemaGeneral;

  const handleConfirmarCierre = async () => {
    if (!isConciliado) return;
    setIsSubmitting(true);
    state.closeCashRegister();
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[98vh]">
        
        <div className="bg-[#1E3A8A] text-white p-3 relative border-b-4 border-[#0284C7] flex-shrink-0">
          <button onClick={onClose} className="absolute right-3 top-3 text-white/60 hover:text-white text-xl">&times;</button>
          <div className="text-center pt-5">
            <h1 className="text-base md:text-lg font-black tracking-wider uppercase">
              CIERRE FINAL DE JORNADA (SISTEMA CONSOLIDADO)
            </h1>
            <p className="text-[9px] text-blue-200 mt-1 font-mono">Auditoría Multi-Período • Transición de Tasa Aplicada</p>
          </div>
        </div>

        <div className="bg-white p-3 grid grid-cols-3 gap-3 border-b border-slate-200 flex-shrink-0">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[8px] font-bold uppercase">Tasa Mañana:</span>
            <span className="text-sm font-mono font-bold text-slate-900">Bs {tasaP1.toFixed(2)}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[8px] font-bold uppercase">Tasa Tarde:</span>
            <span className="text-sm font-mono font-bold text-slate-900">Bs {tasaP2.toFixed(2)}</span>
          </div>
          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
            <span className="text-emerald-600 block text-[8px] font-bold uppercase">Estado:</span>
            <span className="text-sm font-black text-emerald-900">CIERRE TOTAL</span>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1100px] text-[10px]">
            <thead className="sticky top-0 z-10 bg-[#2c3e50] text-white text-[8px] uppercase font-bold tracking-wider">
              <tr>
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2">MÉTODO DE PAGO</th>
                <th className="p-2 text-center w-36">FONDO INICIAL</th>
                <th className="p-2 text-center w-36">PERIODO 1 (Mañana)</th>
                <th className="p-2 text-center w-36">PERIODO 2 (Tarde)</th>
                <th className="p-2 text-center w-36">RESUMEN GLOBAL (Bs)</th>
                <th className="p-2 text-center w-32">CONTEO FÍSICO</th>
                <th className="p-2 text-center w-32">DIFERENCIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-2 text-center font-mono text-slate-400">{row.id}</td>
                  <td className="p-2 font-bold text-slate-700">{row.metodo}</td>
                  <td className="p-2 text-center font-mono font-bold bg-slate-50 text-slate-800">{row.fondoInicial}</td>
                  <td className="p-2 text-center font-mono text-slate-600">{row.ventasP1}</td>
                  <td className="p-2 text-center font-mono text-slate-600">{row.ventasP2}</td>
                  <td className="p-2 text-center font-mono font-bold text-blue-700">Bs {row.sistemaBs.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <Input 
                      type="number" step="0.01"
                      value={conteoFisico[row.id] || ''} 
                      onChange={(e) => setConteoFisico({...conteoFisico, [row.id]: parseFloat(e.target.value) || 0})}
                      className="w-28 text-center font-mono font-bold h-7 text-[9px] mx-auto"
                    />
                  </td>
                  <td className={cn("p-2 text-center font-mono font-bold", row.diferencia < 0 ? "text-red-600" : "text-emerald-600")}>
                    {row.diferencia !== 0 ? `${row.diferencia > 0 ? '+' : ''}${row.diferencia.toFixed(2)}` : '0.00'}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#1E3A8A] text-white font-bold text-[9px] sticky bottom-0">
                <td colSpan={5} className="p-2 text-right">TOTAL CONSOLIDADO SISTEMA:</td>
                <td className="p-2 text-center font-mono">Bs {totalSistemaGeneral.toFixed(2)}</td>
                <td className="p-2 text-center font-mono">Bs {totalFisicoGeneral.toFixed(2)}</td>
                <td className="p-2 text-center font-mono">Bs {diferenciaNeta.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white p-3 border-t border-slate-200 flex-shrink-0">
          <div className="bg-slate-100 rounded-lg p-3 mb-3 grid grid-cols-2 gap-4">
             <div>
               <p className="text-[8px] font-bold text-slate-500 uppercase">Ingreso Total Real Caja:</p>
               <p className="text-xl font-black text-emerald-700">Bs {totalFisicoGeneral.toFixed(2)}</p>
             </div>
             <div>
               <p className="text-[8px] font-bold text-slate-500 uppercase">Diferencia Neta Final:</p>
               <p className={cn("text-xl font-black", diferenciaNeta < 0 ? "text-red-600" : "text-emerald-600")}>
                 {diferenciaNeta > 0 ? '+' : ''}Bs {diferenciaNeta.toFixed(2)}
               </p>
             </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isConciliado} onChange={(e) => setIsConciliado(e.target.checked)} className="rounded text-blue-600 w-3.5 h-3.5" />
              <span className="text-slate-700 uppercase text-[9px] font-bold">Confirmo el arqueo físico de la jornada completa</span>
            </label>
            <div className="flex gap-2">
              <Button disabled={!isConciliado || isSubmitting} onClick={handleConfirmarCierre} className="bg-emerald-600 text-white font-bold text-[10px] px-6">
                CONFIRMAR Y CERRAR
              </Button>
              <Button onClick={onClose} variant="ghost" className="text-red-600 text-[10px]">Cancelar</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
