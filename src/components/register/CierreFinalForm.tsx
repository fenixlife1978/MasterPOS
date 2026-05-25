"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';

interface CierreFinalFormProps {
  onClose: () => void;
  tasaActual: number;
}

export default function CierreFinalForm({ onClose, tasaActual }: CierreFinalFormProps) {
  const state = usePOSState();
  const [register, setRegister] = useState<any>(null);
  const [conteoFisico, setConteoFisico] = useState<Record<string, number>>({});
  const [isConciliado, setIsConciliado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem('pos_register');
    if (cached) setRegister(JSON.parse(cached));
  }, []);

  const corteParcial = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const reports = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('corte_parcial_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          if (new Date(data.fecha).toDateString() === new Date().toDateString()) reports.push(data);
        } catch(e) {}
      }
    }
    return reports.sort((a,b) => b.id - a.id)[0] || null;
  }, []);

  const tasaP1 = corteParcial?.tasaBCV || tasaActual;
  const tasaP2 = tasaActual;
  const fOpenBs = register?.openAmountBs ?? 0;
  const fOpenUsd = register?.openAmountUsd ?? 0;

  const paymentMethods = [
    { id: 1, metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false },
    { id: 2, metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true },
    { id: 3, metodo: 'TARJETA', key: 'tarjeta', isUsd: false },
    { id: 4, metodo: 'BIOPAGO', key: 'biopago', isUsd: false },
    { id: 5, metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false },
    { id: 6, metodo: 'ZELLE', key: 'zelle', isUsd: true },
  ];

  const salesTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (register?.txs) {
      register.txs.forEach((t: any) => {
        if (t.type === 'contado' || t.type === 'cobro_deuda') {
          const method = t.payMethod || 'efectivo_bs';
          totals[method] += (t.paidBs || t.total || 0);
        }
      });
    }
    return totals;
  }, [register]);

  const morningSales = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (corteParcial?.ventas?.porMetodo) {
      Object.entries(corteParcial.ventas.porMetodo).forEach(([k, v]) => totals[k] = v as number);
    }
    return totals;
  }, [corteParcial]);

  const rows = paymentMethods.map(pm => {
    const vP1Bs = morningSales[pm.key] || 0;
    const vTotalBs = salesTotals[pm.key] || 0;
    const vP2Bs = Math.max(0, vTotalBs - vP1Bs);
    
    let fIniVal = 0;
    if (pm.key === 'efectivo_bs') fIniVal = fOpenBs;
    if (pm.key === 'usd_efectivo') fIniVal = fOpenUsd;
    
    const sistBs = (pm.isUsd ? fIniVal * tasaP1 : fIniVal) + vP1Bs + vP2Bs;
    const cFisico = conteoFisico[pm.key] || 0;
    const cFisicoBs = pm.isUsd ? cFisico * tasaP2 : cFisico;
    const diffBs = cFisicoBs - sistBs;

    return {
      ...pm,
      fIni: pm.isUsd ? `$ ${fIniVal.toFixed(2)}` : `Bs ${fIniVal.toFixed(2)}`,
      vP1: pm.isUsd ? `$ ${(vP1Bs / tasaP1).toFixed(2)}` : `Bs ${vP1Bs.toFixed(2)}`,
      vP2: pm.isUsd ? `$ ${(vP2Bs / tasaP2).toFixed(2)}` : `Bs ${vP2Bs.toFixed(2)}`,
      sistBs,
      fisico: cFisico,
      diffBs
    };
  });

  const totalSistBs = rows.reduce((s, r) => s + r.sistBs, 0);
  const totalFisBs = rows.reduce((s, r) => s + (r.isUsd ? r.fisico * tasaP2 : r.fisico), 0);
  const diffNeta = totalFisBs - totalSistBs;

  const handleConfirmCierre = async () => {
    if (!isConciliado) return;
    setIsSubmitting(true);
    state.closeCashRegister();
    // Limpiar reportes locales
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('corte_parcial_')) localStorage.removeItem(key);
    }
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[98vh]">
        <div className="bg-[#1E3A8A] text-white p-3 border-b-4 border-[#0284C7]">
          <h1 className="text-center font-black uppercase text-base">CIERRE FINAL CONSOLIDADO</h1>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-[10px]">
            <thead className="bg-[#2c3e50] text-white sticky top-0">
              <tr>
                <th className="p-2 text-left">MÉTODO</th>
                <th className="p-2 text-center">FONDO INICIAL</th>
                <th className="p-2 text-center">MAÑANA</th>
                <th className="p-2 text-center">TARDE</th>
                <th className="p-2 text-center">SISTEMA (Bs)</th>
                <th className="p-2 text-center">FÍSICO</th>
                <th className="p-2 text-center">DIF.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-2 font-bold">{r.metodo}</td>
                  <td className="p-2 text-center">{r.fIni}</td>
                  <td className="p-2 text-center text-slate-500">{r.vP1}</td>
                  <td className="p-2 text-center text-slate-500">{r.vP2}</td>
                  <td className="p-2 text-center font-bold text-blue-700">Bs {r.sistBs.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <Input type="number" step="0.01" value={conteoFisico[r.key] || ''} onChange={e => setConteoFisico({...conteoFisico, [r.key]: parseFloat(e.target.value) || 0})} className="w-24 h-6 text-[10px] mx-auto text-center font-bold" />
                  </td>
                  <td className={cn("p-2 text-center font-bold", r.diffBs < 0 ? "text-red-600" : "text-emerald-600")}>{r.diffBs.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-[#1E3A8A] text-white font-bold">
                <td colSpan={4} className="p-2 text-right">TOTAL CONSOLIDADO:</td>
                <td className="p-2 text-center">Bs {totalSistBs.toFixed(2)}</td>
                <td className="p-2 text-center">Bs {totalFisBs.toFixed(2)}</td>
                <td className="p-2 text-center">Bs {diffNeta.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 border-t flex flex-col gap-3">
          <div className="flex justify-between items-center pt-3 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isConciliado} onChange={e => setIsConciliado(e.target.checked)} className="rounded text-blue-600" />
              <span className="text-[10px] font-bold uppercase">Confirmo el arqueo físico de la jornada completa</span>
            </label>
            <div className="flex gap-2">
              <Button onClick={onClose} variant="ghost" className="text-red-600">Cancelar</Button>
              <Button disabled={!isConciliado || isSubmitting} onClick={handleConfirmCierre} className="bg-emerald-600 text-white font-bold px-8">CERRAR JORNADA</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}