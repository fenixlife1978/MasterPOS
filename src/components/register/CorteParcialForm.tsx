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

interface CorteParcialFormProps {
  onClose: () => void;
  onCorteConfirmado: (nuevaTasa: number) => void;
  tasaActual: number;
  onTasaActualizada: (nuevaTasa: number) => void;
}

export default function CorteParcialForm({ onClose, onCorteConfirmado, tasaActual, onTasaActualizada }: CorteParcialFormProps) {
  const state = usePOSState();
  const [register, setRegister] = useState<any>(null);
  const [nuevaTasa, setNuevaTasa] = useState<string>('');
  const [tasaValidada, setTasaValidada] = useState<boolean>(false);
  const [isConciliado, setIsConciliado] = useState<boolean>(false);
  const [fisicos, setFisicos] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem('pos_register');
    if (cached) setRegister(JSON.parse(cached));
  }, []);

  const openAmountBs = register?.openAmountBs ?? 0;
  const openAmountUsd = register?.openAmountUsd ?? 0;

  const paymentMethods = [
    { id: 1, metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false },
    { id: 2, metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true },
    { id: 3, metodo: 'TARJETA', key: 'tarjeta', isUsd: false },
    { id: 4, metodo: 'BIOPAGO', key: 'biopago', isUsd: false },
    { id: 5, metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false },
    { id: 6, metodo: 'ZELLE', key: 'zelle', isUsd: true },
  ];

  const salesByMethod = useMemo(() => {
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

  const rows = paymentMethods.map(pm => {
    const ventasBs = salesByMethod[pm.key] || 0;
    const ventasEnMoneda = pm.isUsd ? ventasBs / tasaActual : ventasBs;
    let saldoInicial = 0;
    if (pm.key === 'efectivo_bs') saldoInicial = openAmountBs;
    if (pm.key === 'usd_efectivo') saldoInicial = openAmountUsd;
    
    const teorico = saldoInicial + ventasEnMoneda;
    const fisico = fisicos[pm.key] || 0;
    const diff = fisico - teorico;
    
    return {
      ...pm,
      saldoInicial,
      ventas: ventasEnMoneda,
      teorico,
      fisico,
      diff,
      estado: Math.abs(diff) < 0.01 ? 'CUADRA' : (diff < 0 ? 'FALTANTE' : 'SOBRANTE')
    };
  });

  const totalTeoricoBs = rows.reduce((s, r) => s + (r.isUsd ? r.teorico * tasaActual : r.teorico), 0);
  const totalFisicoBs = rows.reduce((s, r) => s + (r.isUsd ? r.fisico * tasaActual : r.fisico), 0);
  const diffNeta = totalFisicoBs - totalTeoricoBs;

  const handleConfirmarCorte = async () => {
    if (!tasaValidada || !isConciliado) return;
    setIsSubmitting(true);
    const nTasa = parseFloat(nuevaTasa);
    const fBs = fisicos['efectivo_bs'] || 0;
    const fUsd = fisicos['usd_efectivo'] || 0;
    
    const report = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      tasaBCV: tasaActual,
      tasaNueva: nTasa,
      apertura: { montoBs: openAmountBs, montoUsd: openAmountUsd },
      ventas: { porMetodo: salesByMethod },
      cuadre: rows.map(r => ({ metodo: r.metodo, sistema: r.teorico, real: r.fisico, diff: r.diff })),
      nuevoFondo: { bs: fBs, usd: fUsd, totalBs: fBs + (fUsd * nTasa) }
    };

    localStorage.setItem(`corte_parcial_${Date.now()}`, JSON.stringify(report));
    await state.setExchangeRate(nTasa);
    await syncService.saveRegister({
      ...register,
      openAmount: report.nuevoFondo.totalBs,
      openAmountBs: fBs,
      openAmountUsd: fUsd,
      exchangeRate: nTasa
    });
    
    setIsSubmitting(false);
    onCorteConfirmado(nTasa);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[98vh]">
        <div className="bg-[#1E3A8A] text-white p-3 border-b-4 border-[#0284C7]">
          <h1 className="text-center font-black uppercase text-base">Corte Parcial (@ 6:00 PM)</h1>
        </div>
        
        <div className="bg-white p-3 grid grid-cols-3 gap-3 border-b">
          <div className="bg-slate-50 p-2 rounded-lg border">
            <span className="text-[8px] font-bold text-slate-500 uppercase">Tasa Mañana:</span>
            <p className="text-sm font-bold">Bs {tasaActual.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border">
            <span className="text-[8px] font-bold text-slate-500 uppercase">Apertura BS:</span>
            <p className="text-sm font-bold">Bs {openAmountBs.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border">
            <span className="text-[8px] font-bold text-slate-500 uppercase">Apertura USD:</span>
            <p className="text-sm font-bold">$ {openAmountUsd.toFixed(2)}</p>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-[10px]">
            <thead className="bg-[#2c3e50] text-white sticky top-0">
              <tr>
                <th className="p-2 text-left">MÉTODO</th>
                <th className="p-2 text-center">SALDO INICIAL</th>
                <th className="p-2 text-center">VENTAS</th>
                <th className="p-2 text-center">SISTEMA</th>
                <th className="p-2 text-center">FÍSICO</th>
                <th className="p-2 text-center">DIF.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-2 font-bold">{r.metodo}</td>
                  <td className="p-2 text-center font-mono">{r.isUsd ? `$ ${r.saldoInicial.toFixed(2)}` : `Bs ${r.saldoInicial.toFixed(2)}`}</td>
                  <td className="p-2 text-center font-mono">{r.isUsd ? `$ ${r.ventas.toFixed(2)}` : `Bs ${r.ventas.toFixed(2)}`}</td>
                  <td className="p-2 text-center font-mono font-bold">{r.isUsd ? `$ ${r.teorico.toFixed(2)}` : `Bs ${r.teorico.toFixed(2)}`}</td>
                  <td className="p-2 text-center">
                    <Input type="number" step="0.01" value={fisicos[r.key] || ''} onChange={e => setFisicos({...fisicos, [r.key]: parseFloat(e.target.value) || 0})} className="w-24 h-6 text-[10px] mx-auto text-center font-bold" />
                  </td>
                  <td className={cn("p-2 text-center font-bold", r.diff < 0 ? "text-red-600" : "text-emerald-600")}>{r.diff.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 border-t">
          <div className="flex justify-between items-center mb-4">
            <div className="bg-slate-100 p-3 rounded-xl border border-dashed flex-1 max-w-sm">
              <span className="text-[9px] font-bold text-blue-800">DECLARAR NUEVA TASA BCV (Tarde)</span>
              <div className="flex gap-2 mt-1">
                <Input type="number" step="0.01" value={nuevaTasa} onChange={e => setNuevaTasa(e.target.value)} disabled={tasaValidada} className="h-8 font-mono" placeholder="Nueva tasa..." />
                <Button onClick={() => setTasaValidada(!tasaValidada)} className={cn(tasaValidada ? "bg-amber-500" : "bg-emerald-600", "h-8 text-white")}>{tasaValidada ? 'Editar' : 'Validar'}</Button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Diferencia Neta Global:</p>
              <p className={cn("text-xl font-black", diffNeta < 0 ? "text-red-600" : "text-emerald-600")}>Bs {diffNeta.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center border-t pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isConciliado} onChange={e => setIsConciliado(e.target.checked)} className="rounded text-blue-600" />
              <span className="text-[10px] font-bold uppercase">Declaro bajo firma el conteo físico parcial</span>
            </label>
            <div className="flex gap-2">
              <Button onClick={onClose} variant="ghost" className="text-red-600">Cancelar</Button>
              <Button disabled={!tasaValidada || !isConciliado || isSubmitting} onClick={handleConfirmarCorte} className="bg-emerald-600 text-white font-bold">REAPERTURAR (TARDE)</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}