"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';
import { Printer, Share2, X } from 'lucide-react';

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
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [closeReportData, setCloseReportData] = useState<any>(null);

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
      fIniBs: pm.isUsd ? fIniVal * tasaP1 : fIniVal,
      vP1: pm.isUsd ? `$ ${(vP1Bs / tasaP1).toFixed(2)}` : `Bs ${vP1Bs.toFixed(2)}`,
      vP1Bs: vP1Bs,
      vP2: pm.isUsd ? `$ ${(vP2Bs / tasaP2).toFixed(2)}` : `Bs ${vP2Bs.toFixed(2)}`,
      vP2Bs: vP2Bs,
      sistBs,
      fisico: cFisico,
      fisicoBs: cFisicoBs,
      diffBs
    };
  });

  const totalSistBs = rows.reduce((s, r) => s + r.sistBs, 0);
  const totalFisBs = rows.reduce((s, r) => s + r.fisicoBs, 0);
  const diffNeta = totalFisBs - totalSistBs;

  // Generar reporte para el modal
  const generarReporte = () => {
    const ventasContado = rows.reduce((acc, r) => acc + r.vP1Bs + r.vP2Bs, 0);
    const ventasCredito = register?.txs?.filter((t: any) => t.type === 'credito').reduce((sum: number, t: any) => sum + (t.total || 0), 0) || 0;
    const fondoInicialBs = fOpenBs;
    const fondoInicialUsd = fOpenUsd;
    const fondoPostCorte = corteParcial?.nuevoFondo?.bs || 0;
    
    return {
      id: Date.now(),
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tipoCorte: 'cierre_total',
      tasaPeriodo1: tasaP1,
      tasaPeriodo2: tasaP2,
      fondoPostCorte,
      fondoInicial: { bs: fondoInicialBs, usd: fondoInicialUsd },
      ventas: {
        contado: ventasContado,
        credito: ventasCredito,
        totalSistema: totalSistBs,
        totalReal: totalFisBs
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

  // Acción al hacer clic en "CERRAR JORNADA" (antes de cerrar)
  const handleConfirmCierre = () => {
    if (!isConciliado) return;
    const report = generarReporte();
    setCloseReportData(report);
    setShowResumenModal(true);
  };

  // Cierre definitivo después de que el usuario ve el resumen
  const finalizarCierre = async () => {
    if (closeReportData) {
      // Guardar reporte en localStorage (similar a cortes parciales)
      localStorage.setItem(`cierre_final_${Date.now()}`, JSON.stringify(closeReportData));
      
      // Limpiar cortes parciales del día
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

  // Imprimir / PDF
  const handlePrint = () => {
    if (!closeReportData) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const html = generarHTMLResumen(closeReportData);
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  // Compartir o copiar
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
        .big { font-size: 32px; font-weight: bold; margin: 20px 0; }
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
      <p><strong>Fondo Inicial:</strong> Bs ${data.fondoInicial.bs.toFixed(2)} + $${data.fondoInicial.usd.toFixed(2)}</p>
      <p><strong>Ventas Contado:</strong> Bs ${data.ventas.contado.toFixed(2)}</p>
      <p><strong>Ventas Crédito:</strong> Bs ${data.ventas.credito.toFixed(2)}</p>
      <div class="line"></div>
      <div class="center">
        <div style="font-size: 28px; font-weight: bold; color: ${estadoColor};">${estadoIcono} ${estado}</div>
        <div style="font-size: 48px; font-weight: black; margin: 10px 0;">
          ${diff > 0 ? '+' : ''}Bs ${Math.abs(diff).toFixed(2)}
        </div>
      </div>
      <div class="line"></div>
      <h3>Detalle por método</h3>
      <table>
        <thead><tr><th>Método</th><th>Sistema (Bs)</th><th>Real (Bs)</th><th>Diferencia</th><tr></thead>
        <tbody>
          ${data.cuadre.map((r: any) => `<tr><td>${r.metodo}</td><td class="right">${r.sistema.toFixed(2)}</td><td class="right">${r.real.toFixed(2)}</td><td class="right">${r.diferencia.toFixed(2)}</td>`).join('')}
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
    return `MASTERPOS - Cierre de Jornada\nFecha: ${data.fechaCierre}\nFondo inicial: Bs ${data.fondoInicial.bs.toFixed(2)} + $${data.fondoInicial.usd.toFixed(2)}\nVentas Contado: Bs ${data.ventas.contado.toFixed(2)}\nVentas Crédito: Bs ${data.ventas.credito.toFixed(2)}\nRESULTADO: ${estado} por Bs ${Math.abs(diff).toFixed(2)}`;
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

      {/* Modal de resumen final */}
      {showResumenModal && closeReportData && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#1E3A8A] text-white p-4 sticky top-0 flex justify-between items-center">
              <h2 className="text-lg font-black">RESUMEN DE CIERRE DE JORNADA</h2>
              <button onClick={finalizarCierre} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Fecha y hora</p>
                <p className="font-mono">{closeReportData.fechaCierre}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <p className="text-xs text-gray-500">Fondo Inicial</p>
                  <p className="font-bold">Bs {closeReportData.fondoInicial.bs.toFixed(2)}</p>
                  <p className="font-bold">$ {closeReportData.fondoInicial.usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ventas del día</p>
                  <p className="font-bold">Contado: Bs {closeReportData.ventas.contado.toFixed(2)}</p>
                  <p className="font-bold">Crédito: Bs {closeReportData.ventas.credito.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-center py-4 bg-gray-50 rounded-lg">
                <p className="text-xs uppercase tracking-wider text-gray-500">RESULTADO DE LA JORNADA</p>
                <p className={cn(
                  "text-5xl font-black mt-2",
                  closeReportData.totales.diferencia > 0 ? "text-emerald-600" : closeReportData.totales.diferencia < 0 ? "text-red-600" : "text-blue-600"
                )}>
                  {closeReportData.totales.diferencia > 0 ? '+' : ''}{closeReportData.totales.diferencia.toFixed(2)} Bs
                </p>
                <p className={cn(
                  "text-sm font-bold mt-1",
                  closeReportData.totales.diferencia > 0 ? "text-emerald-600" : closeReportData.totales.diferencia < 0 ? "text-red-600" : "text-blue-600"
                )}>
                  {closeReportData.totales.estado}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <Printer size={16} className="mr-2" /> Imprimir / PDF
                </Button>
                <Button onClick={handleShare} variant="outline" className="flex-1 border-slate-300">
                  <Share2 size={16} className="mr-2" /> Compartir
                </Button>
              </div>
              <div className="text-center pt-4">
                <Button onClick={finalizarCierre} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                  CERRAR CAJA
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}