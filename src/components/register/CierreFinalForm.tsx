"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';
import { Printer, Share2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface CierreFinalFormProps {
  onClose: () => void;
  tasaActual: number;
}

export default function CierreFinalForm({ onClose, tasaActual }: CierreFinalFormProps) {
  const state = usePOSState();
  const { user } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const [register, setRegister] = useState<any>(null);
  const [conteoFisico, setConteoFisico] = useState<Record<string, number>>({});
  const [isConciliado, setIsConciliado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [closeReportData, setCloseReportData] = useState<any>(null);
  const [aperturaOriginalBs, setAperturaOriginalBs] = useState(0);
  const [aperturaOriginalUsd, setAperturaOriginalUsd] = useState(0);

  // ✅ Obtener el registro de caja actual
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

  // ✅ Buscar la apertura ORIGINAL (primer corte parcial del día o el registro original)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Buscar el primer corte parcial del día (más antiguo)
    let firstCorte: any = null;
    let earliestTimestamp = Infinity;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('corte_parcial_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          if (new Date(data.fecha).toDateString() === new Date().toDateString()) {
            if (data.id < earliestTimestamp) {
              earliestTimestamp = data.id;
              firstCorte = data;
            }
          }
        } catch(e) {}
      }
    }
    
    if (firstCorte?.apertura) {
      // Usar la apertura del primer corte parcial
      setAperturaOriginalBs(firstCorte.apertura.montoBs || 0);
      setAperturaOriginalUsd(firstCorte.apertura.montoUsd || 0);
    } else if (register) {
      // Fallback al registro actual
      setAperturaOriginalBs(register.openAmountBs || 0);
      setAperturaOriginalUsd(register.openAmountUsd || 0);
    }
  }, [register]);

  // ✅ Obtener el corte parcial más RECIENTE (para las ventas de la mañana)
  const corteParcial = useMemo(() => {
    if (typeof window === 'undefined') return null;
    let latestCorte: any = null;
    let latestTimestamp = -1;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('corte_parcial_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          if (new Date(data.fecha).toDateString() === new Date().toDateString()) {
            if (data.id > latestTimestamp) {
              latestTimestamp = data.id;
              latestCorte = data;
            }
          }
        } catch(e) {}
      }
    }
    return latestCorte;
  }, []);

  const tasaP1 = corteParcial?.tasaBCV || tasaActual;
  const tasaP2 = tasaActual;
  
  // ✅ USAR APERTURA ORIGINAL (NO la del registro actual que ya fue modificada)
  const aperturaBs = aperturaOriginalBs;
  const aperturaUsd = aperturaOriginalUsd;

  const paymentMethods = [
    { id: 1, metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false },
    { id: 2, metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true },
    { id: 3, metodo: 'TARJETA', key: 'tarjeta', isUsd: false },
    { id: 4, metodo: 'BIOPAGO', key: 'biopago', isUsd: false },
    { id: 5, metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false },
    { id: 6, metodo: 'ZELLE', key: 'zelle', isUsd: true },
  ];

  // ✅ Ventas TOTALES del día (CONTADO y COBRO DE DEUDA)
  const salesTotals = useMemo(() => {
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

  // ✅ Ventas de la MAÑANA (del corte parcial)
  const morningSales = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (corteParcial?.ventas?.porMetodo) {
      Object.entries(corteParcial.ventas.porMetodo).forEach(([k, v]) => {
        totals[k] = Math.round((v as number) * 100) / 100;
      });
    }
    return totals;
  }, [corteParcial]);

  // ✅ Ventas de la TARDE (totales - mañana)
  const afternoonSales = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => {
      const total = salesTotals[m.key] || 0;
      const morning = morningSales[m.key] || 0;
      totals[m.key] = Math.max(0, total - morning);
    });
    return totals;
  }, [salesTotals, morningSales]);

  // ✅ Construir filas
  const rows = paymentMethods.map(pm => {
    const vMananaBs = morningSales[pm.key] || 0;
    const vTardeBs = afternoonSales[pm.key] || 0;
    
    let saldoInicialVal = 0;
    if (pm.key === 'efectivo_bs') saldoInicialVal = aperturaBs;
    if (pm.key === 'usd_efectivo') saldoInicialVal = aperturaUsd;
    
    const saldoInicialBs = pm.isUsd ? saldoInicialVal * tasaP1 : saldoInicialVal;
    
    const sistBs = saldoInicialBs + vMananaBs + vTardeBs;
    
    const fisicoIngresado = conteoFisico[pm.key] || 0;
    const fisicoBs = pm.isUsd ? fisicoIngresado * tasaP2 : fisicoIngresado;
    const diffBs = Math.round((fisicoBs - sistBs) * 100) / 100;

    return {
      ...pm,
      saldoInicial: pm.isUsd ? formatUsd(saldoInicialVal) : formatBs(saldoInicialVal),
      vMananaBs: vMananaBs,
      vTardeBs: vTardeBs,
      sistBs: sistBs,
      fisicoIngresado: fisicoIngresado,
      fisicoBs: fisicoBs,
      diffBs: diffBs
    };
  });

  const totalSistBs = rows.reduce((s, r) => s + r.sistBs, 0);
  const totalFisBs = rows.reduce((s, r) => s + r.fisicoBs, 0);
  const diffNeta = Math.round((totalFisBs - totalSistBs) * 100) / 100;

  const generarReporte = () => {
    const ventasContado = rows.reduce((acc, r) => acc + r.vMananaBs + r.vTardeBs, 0);
    const ventasCredito = register?.txs?.filter((t: any) => t.type === 'credito').reduce((sum: number, t: any) => sum + (t.total || 0), 0) || 0;
    
    return {
      id: Date.now(),
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tipoCorte: 'cierre_total',
      tasaPeriodo1: tasaP1,
      tasaPeriodo2: tasaP2,
      apertura: { bs: aperturaBs, usd: aperturaUsd },
      ventas: {
        manana: morningSales,
        tarde: afternoonSales,
        totalContado: ventasContado,
        credito: ventasCredito,
      },
      cuadre: rows.map(r => ({
        metodo: r.metodo,
        sistema: r.sistBs,
        real: r.fisicoBs,
        diferencia: r.diffBs
      })),
      totales: {
        sistema: totalSistBs,
        real: totalFisBs,
        diferencia: diffNeta,
        estado: Math.abs(diffNeta) < 0.01 ? "CONCILIADO" : (diffNeta > 0 ? "SOBRANTE" : "FALTANTE")
      }
    };
  };

  const handleConfirmCierre = () => {
    if (!isConciliado) return;
    const report = generarReporte();
    setCloseReportData(report);
    setShowResumenModal(true);
  };

  const finalizarCierre = async () => {
    if (closeReportData) {
      localStorage.setItem(`cierre_final_${Date.now()}`, JSON.stringify(closeReportData));
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('corte_parcial_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key)!);
            if (new Date(data.fecha).toDateString() === new Date().toDateString()) {
              localStorage.removeItem(key);
            }
          } catch(e) {}
        }
      }
      state.closeCashRegister();
    }
    setShowResumenModal(false);
    onClose();
  };

  const handlePrint = () => {
    if (!closeReportData) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const html = generarHTMLResumen(closeReportData);
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleShare = async () => {
    if (!closeReportData) return;
    const text = generarTextoResumen(closeReportData);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cierre de Caja MasterPOS',
          text: text,
        });
      } catch (err) {
        console.error('Error al compartir:', err);
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Resumen copiado al portapapeles');
    }
  };

  const generarHTMLResumen = (data: any) => {
    const diff = data.totales.diferencia;
    const estado = data.totales.estado;
    const estadoColor = diff > 0 ? '#10b981' : (diff < 0 ? '#ef4444' : '#3b82f6');
    const estadoIcono = estado === 'SOBRANTE' ? '💰' : (estado === 'FALTANTE' ? '⚠️' : '✅');
    return `
      <html>
      <head><title>Cierre de Caja MasterPOS</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 20px; font-size: 12px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #999; padding: 6px; text-align: left; }
        th { background: #f0f0f0; }
        .right { text-align: right; }
      </style>
      </head>
      <body>
      <div class="center">
        <h1>MASTERPOS - CIERRE DE JORNADA</h1>
        <p>${data.fechaCierre}</p>
      </div>
      <div class="line"></div>
      <p><strong>Apertura:</strong> ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)}</p>
      <p><strong>Ventas Contado:</strong> ${formatBs(data.ventas.totalContado)}</p>
      <p><strong>Ventas Crédito:</strong> ${formatBs(data.ventas.credito)}</p>
      <div class="line"></div>
      <div class="center">
        <div style="font-size: 28px; font-weight: bold; color: ${estadoColor};">${estadoIcono} ${estado}</div>
        <div style="font-size: 48px; font-weight: black; margin: 10px 0;">
          ${diff > 0 ? '+' : ''}${formatBsNumber(Math.abs(diff))}
        </div>
      </div>
      <div class="line"></div>
      <h3>Detalle por método</h3>
      <table>
        <thead><tr><th>Método</th><th>Sistema (Bs)</th><th>Real (Bs)</th><th>Diferencia</th></tr></thead>
        <tbody>
          ${data.cuadre.map((r: any) => `<tr><td>${r.metodo}</td><td class="right">${formatBsNumber(r.sistema)}</td><td class="right">${formatBsNumber(r.real)}</td><td class="right">${formatBsNumber(r.diferencia)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <p class="center">Documento generado por MasterPOS</p>
      </body>
      </html>
    `;
  };

  const generarTextoResumen = (data: any) => {
    const diff = data.totales.diferencia;
    const estado = data.totales.estado;
    return `MASTERPOS - Cierre de Jornada\nFecha: ${data.fechaCierre}\nApertura: ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)}\nVentas Contado: ${formatBs(data.ventas.totalContado)}\nVentas Crédito: ${formatBs(data.ventas.credito)}\nRESULTADO: ${estado} por ${formatBs(Math.abs(diff))}`;
  };

  return (
    <>
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
                  <th className="p-2 text-center">APERTURA</th>
                  <th className="p-2 text-center">MAÑANA (Bs)</th>
                  <th className="p-2 text-center">TARDE (Bs)</th>
                  <th className="p-2 text-center">SISTEMA (Bs)</th>
                  <th className="p-2 text-center">FÍSICO</th>
                  <th className="p-2 text-center">DIF. (Bs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2 font-bold">{r.metodo}</td>
                    <td className="p-2 text-center">{r.saldoInicial}</td>
                    <td className="p-2 text-center font-mono">{formatBs(r.vMananaBs)}</td>
                    <td className="p-2 text-center font-mono">{formatBs(r.vTardeBs)}</td>
                    <td className="p-2 text-center font-bold text-blue-700">{formatBs(r.sistBs)}</td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={r.fisicoIngresado === 0 ? '' : r.fisicoIngresado} 
                          onChange={e => setConteoFisico({...conteoFisico, [r.key]: parseFloat(e.target.value) || 0})} 
                          className="w-24 h-7 text-xs text-center font-bold" 
                          placeholder="0.00"
                        />
                        <span className="text-[9px] font-bold text-slate-500">{r.isUsd ? 'USD' : 'Bs'}</span>
                      </div>
                      {r.isUsd && r.fisicoIngresado > 0 && (
                        <div className="text-[8px] text-slate-400 mt-0.5">
                          ≈ {formatBs(r.fisicoIngresado * tasaP2)}
                        </div>
                      )}
                    </td>
                    <td className={cn("p-2 text-center font-bold", r.diffBs < 0 ? "text-red-600" : r.diffBs > 0 ? "text-emerald-600" : "text-slate-500")}>
                      {r.diffBs === 0 ? '✓' : formatBsNumber(Math.abs(r.diffBs))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#1E3A8A] text-white font-bold">
                  <td colSpan={4} className="p-2 text-right">TOTAL CONSOLIDADO:</td>
                  <td className="p-2 text-center">{formatBs(totalSistBs)}</td>
                  <td className="p-2 text-center">{formatBs(totalFisBs)}</td>
                  <td className="p-2 text-center">{diffNeta === 0 ? '✓' : formatBsNumber(Math.abs(diffNeta))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white p-4 border-t flex flex-col gap-3">
            <div className="flex justify-between items-center pt-3 border-t flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isConciliado} onChange={e => setIsConciliado(e.target.checked)} className="rounded text-blue-600 w-4 h-4" />
                <span className="text-[10px] font-bold uppercase">Confirmo el arqueo físico de la jornada completa</span>
              </label>
              <div className="flex gap-2">
                <Button onClick={onClose} variant="ghost" className="text-red-600 font-bold text-xs h-8">Cancelar</Button>
                <Button disabled={!isConciliado || isSubmitting} onClick={handleConfirmCierre} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-6">CERRAR JORNADA</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showResumenModal && closeReportData && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#1E3A8A] text-white p-4 sticky top-0 flex justify-between items-center">
              <h2 className="text-lg font-black">RESUMEN DE CIERRE DE JORNADA</h2>
              <button onClick={finalizarCierre} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center"><p className="text-sm text-gray-500">Fecha y hora</p><p className="font-mono">{closeReportData.fechaCierre}</p></div>
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div><p className="text-xs text-gray-500">Apertura</p><p className="font-bold">{formatBs(closeReportData.apertura.bs)}</p><p className="font-bold">{formatUsd(closeReportData.apertura.usd)}</p></div>
                <div><p className="text-xs text-gray-500">Ventas del día</p><p className="font-bold">Contado: {formatBs(closeReportData.ventas.totalContado)}</p><p className="font-bold">Crédito: {formatBs(closeReportData.ventas.credito)}</p></div>
              </div>
              <div className="text-center py-4 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wider text-gray-500">RESULTADO DE LA JORNADA</p>
                <p className={cn("text-5xl font-black mt-2", closeReportData.totales.diferencia > 0 ? "text-emerald-600" : closeReportData.totales.diferencia < 0 ? "text-red-600" : "text-blue-600")}>
                  {closeReportData.totales.diferencia > 0 ? '+' : ''}{formatBsNumber(Math.abs(closeReportData.totales.diferencia))} Bs
                </p>
                <p className={cn("text-sm font-bold mt-1", closeReportData.totales.diferencia > 0 ? "text-emerald-600" : closeReportData.totales.diferencia < 0 ? "text-red-600" : "text-blue-600")}>
                  {closeReportData.totales.estado}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"><Printer size={16} className="mr-2" /> Imprimir / PDF</Button>
                <Button onClick={handleShare} variant="outline" className="flex-1 border-slate-300"><Share2 size={16} className="mr-2" /> Compartir</Button>
              </div>
              <div className="text-center pt-4"><Button onClick={finalizarCierre} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">CERRAR CAJA</Button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}