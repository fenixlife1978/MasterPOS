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
  periodo1: string;
  periodo1Bs: number;
  periodo2: string;
  periodo2Bs: number;
  conteoFisico: number;
  resumenGlobal: string;
  resumenGlobalBs: number;
  diferenciaGlobal: number;
  estado: 'CUADRA' | 'FALTANTE' | 'SOBRANTE';
}

export default function CierreFinalForm({ onClose, tasaActual }: CierreFinalFormProps) {
  const state = usePOSState();
  const reg = state.register;
  
  const [conteoFisico, setConteoFisico] = useState<Record<number, number>>({});
  const [isConciliado, setIsConciliado] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obtener corte parcial del día (si existe)
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

  // Usar la tasa del corte parcial si existe, si no usar la tasa actual
  const tasaPeriodo1 = corteParcial?.tasaBCV || tasaActual;
  const tasaPeriodo2 = tasaActual;
  const fondoPostCorte = corteParcial?.nuevoFondo?.bs || (reg?.openAmount || 0);

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
    if (reg?.txs && Array.isArray(reg.txs)) {
      reg.txs.forEach(t => {
        if (t.type === 'contado' || t.type === 'cobro_deuda') {
          const method = t.payMethod || 'efectivo_bs';
          totals[method] = (totals[method] || 0) + (t.total || 0);
        }
      });
    }
    return totals;
  }, [reg]);

  // Ventas del período 1 (antes del corte parcial)
  const ventasPeriodo1 = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (corteParcial?.ventas?.porMetodo) {
      Object.entries(corteParcial.ventas.porMetodo).forEach(([key, val]) => {
        totals[key] = val as number;
      });
    }
    return totals;
  }, [corteParcial]);

  // Ventas del período 2 (después del corte parcial)
  const ventasPeriodo2 = salesByMethod;

  // Obtener fondos iniciales del corte parcial
  const fondoInicialBS = corteParcial?.apertura?.montoBs || 0;
  const fondoInicialUSD = corteParcial?.apertura?.montoUsd || 0;

  const rows: ConsolidadoRow[] = paymentMethods.map((pm) => {
    const ventasP1 = ventasPeriodo1[pm.key] || 0;
    const ventasP2 = ventasPeriodo2[pm.key] || 0;
    
    // Para período 1: incluir fondo inicial solo para efectivo
    let totalPeriodo1 = ventasP1;
    if (pm.key === 'efectivo_bs') totalPeriodo1 += fondoInicialBS;
    if (pm.key === 'usd_efectivo') totalPeriodo1 += fondoInicialUSD;
    
    // Para período 2: incluir fondo post-corte solo para efectivo
    let totalPeriodo2 = ventasP2;
    if (pm.key === 'efectivo_bs') totalPeriodo2 += fondoPostCorte;
    
    // Convertir a moneda según USD o BS
    const periodo1Display = pm.isUsd 
      ? `$ ${(totalPeriodo1 / tasaPeriodo1).toFixed(2)}`
      : `Bs ${totalPeriodo1.toFixed(2)}`;
    
    const periodo2Display = pm.isUsd 
      ? `$ ${(totalPeriodo2 / tasaPeriodo2).toFixed(2)}`
      : `Bs ${totalPeriodo2.toFixed(2)}`;
    
    // Para el resumen global (total en Bs del período 2)
    let resumenGlobalDisplay = '';
    let resumenGlobalBs = 0;
    
    if (pm.key === 'efectivo_bs') {
      resumenGlobalDisplay = `Bs ${totalPeriodo2.toFixed(2)}`;
      resumenGlobalBs = totalPeriodo2;
    } else if (pm.key === 'usd_efectivo') {
      const totalUSD = totalPeriodo2 / tasaPeriodo2;
      resumenGlobalDisplay = `$ ${totalUSD.toFixed(2)} (≈ Bs ${totalPeriodo2.toFixed(2)})`;
      resumenGlobalBs = totalPeriodo2;
    } else {
      resumenGlobalDisplay = `Bs ${totalPeriodo2.toFixed(2)}`;
      resumenGlobalBs = totalPeriodo2;
    }
    
    const conteoActual = conteoFisico[pm.id] || 0;
    const diferenciaGlobal = conteoActual - resumenGlobalBs;
    
    let estado: ConsolidadoRow['estado'] = 'CUADRA';
    if (Math.abs(diferenciaGlobal) > 0.01) {
      estado = diferenciaGlobal < 0 ? 'FALTANTE' : 'SOBRANTE';
    }
    
    return {
      id: pm.id,
      metodo: pm.metodo,
      periodo1: periodo1Display,
      periodo1Bs: totalPeriodo1,
      periodo2: periodo2Display,
      periodo2Bs: totalPeriodo2,
      conteoFisico: conteoActual,
      resumenGlobal: resumenGlobalDisplay,
      resumenGlobalBs,
      diferenciaGlobal,
      estado
    };
  });

  const totalIngresosSistema = rows.reduce((acc, r) => acc + r.resumenGlobalBs, 0);
  const totalIngresosReales = rows.reduce((acc, r) => acc + r.conteoFisico, 0);
  const diferenciaNeta = totalIngresosReales - totalIngresosSistema;

  const handleFisicoChange = (id: number, valor: number) => {
    setConteoFisico(prev => ({ ...prev, [id]: valor }));
  };

  const handleConfirmarCierre = async () => {
    if (!isConciliado) return;
    setIsSubmitting(true);

    const closeReport = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tipoCorte: 'cierre_total',
      tasaPeriodo1,
      tasaPeriodo2,
      fondoPostCorte,
      fondoInicial: { bs: fondoInicialBS, usd: fondoInicialUSD },
      ventas: { 
        periodo1: ventasPeriodo1,
        periodo2: ventasPeriodo2,
        totalSistema: totalIngresosSistema,
        totalReal: totalIngresosReales
      },
      cuadre: rows.map(r => ({
        metodo: r.metodo,
        periodo1: r.periodo1Bs,
        periodo2: r.periodo2Bs,
        sistema: r.resumenGlobalBs,
        real: r.conteoFisico,
        diferencia: r.diferenciaGlobal
      })),
      totales: { 
        sistema: totalIngresosSistema, 
        real: totalIngresosReales, 
        diferencia: diferenciaNeta, 
        estado: Math.abs(diferenciaNeta) < 0.01 ? "CONCILIADO" : (diferenciaNeta > 0 ? "SOBRANTE" : "FALTANTE") 
      }
    };

    await syncService.saveCashClosing(closeReport);
    
    // Limpiar cortes parciales del día
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('corte_parcial_') && new Date(JSON.parse(localStorage.getItem(key) || '{}').fecha).toDateString() === new Date().toDateString()) {
        localStorage.removeItem(key);
      }
    }
    
    state.closeCashRegister();

    setIsSubmitting(false);
    onClose();
  };

  const handlePrintTicket = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <html><head><title>Cierre Final - MasterPOS</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 20px; font-size: 11px; }
        .center { text-align: center; } .line { border-top: 1px dashed #000; margin: 8px 0; }
        h1 { font-size: 16px; } h2 { font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
        th { background: #eee; padding: 4px; border: 1px solid #999; }
        td { padding: 3px 4px; border: 1px solid #999; }
        .right { text-align: right; } .bold { font-weight: bold; }
      </style></head><body>
        <div class="center"><h1>MASTERPOS - CIERRE FINAL DE JORNADA</h1><p>${new Date().toLocaleString()}</p></div>
        <div class="line"></div>
        <p>Tasa Período 1 (Mañana): Bs ${tasaPeriodo1.toFixed(2)}</p>
        <p>Tasa Período 2 (Tarde): Bs ${tasaPeriodo2.toFixed(2)}</p>
        <div class="line"></div>
        <h2>Resumen Final</h2>
        <table>
          <tr><th>Método</th><th>P1 (Mañana)</th><th>P2 (Tarde)</th><th class="right">Sistema Bs</th><th class="right">Real Bs</th><th class="right">Diferencia</th></tr>
          ${rows.map(r => `<tr><td class="bold">${r.metodo}</td><td>${r.periodo1}</td><td>${r.periodo2}</td><td class="right">${r.resumenGlobalBs.toFixed(2)}</td><td class="right">${r.conteoFisico.toFixed(2)}</td><td class="right">${r.diferenciaGlobal.toFixed(2)}</td></tr>`).join('')}
        </table>
        <div class="line"></div>
        <p class="bold">TOTAL SISTEMA: Bs ${totalIngresosSistema.toFixed(2)}</p>
        <p class="bold">TOTAL REAL: Bs ${totalIngresosReales.toFixed(2)}</p>
        <p class="bold">DIFERENCIA NETA: Bs ${diferenciaNeta.toFixed(2)}</p>
        <div class="line"></div>
        <p class="center">Documento generado por MasterPOS</p>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[98vh]">
        
        {/* HEADER */}
        <div className="bg-[#1E3A8A] text-white p-3 relative border-b-4 border-[#0284C7] flex-shrink-0">
          <button onClick={onClose} className="absolute right-3 top-3 text-white/60 hover:text-white text-xl">&times;</button>
          <div className="absolute left-3 top-3 bg-[#0284C7] text-[9px] font-bold px-2 py-0.5 rounded text-white">
            CIERRE DE JORNADA
          </div>
          <div className="text-center pt-5">
            <h1 className="text-base md:text-lg font-black tracking-wider uppercase">
              CIERRE FINAL DE CAJA (CONSOLIDADO DE JORNADA)
            </h1>
            <p className="text-[9px] text-blue-200 mt-1 font-mono flex items-center justify-center gap-1">
              <Clock size={9} /> Auditoría Multimoneda • Reporte Global de Ventas
            </p>
          </div>
        </div>

        {/* DATOS DE TASAS */}
        <div className="bg-white p-3 grid grid-cols-3 gap-3 border-b border-slate-200 flex-shrink-0">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[8px] font-bold uppercase">Fondo Post-Corte (6PM):</span>
            <span className="text-sm font-mono font-bold text-slate-900">Bs {fondoPostCorte.toFixed(2)}</span>
          </div>
          <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-200">
            <span className="text-blue-600 block text-[8px] font-bold uppercase">Tasa Período 1 (Mañana):</span>
            <span className="text-sm font-mono font-bold text-blue-900">Bs {tasaPeriodo1.toFixed(2)}</span>
          </div>
          <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-200">
            <span className="text-emerald-600 block text-[8px] font-bold uppercase">Tasa Período 2 (Tarde):</span>
            <span className="text-sm font-mono font-bold text-emerald-900">Bs {tasaPeriodo2.toFixed(2)}</span>
          </div>
        </div>

        {/* TABLA CONSOLIDADA */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px] text-[10px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#2c3e50] text-white text-[8px] uppercase font-bold tracking-wider">
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2">MÉTODO DE PAGO</th>
                <th className="p-2 text-center w-36">PERIODO 1 (Mañana)</th>
                <th className="p-2 text-center w-36">PERIODO 2 (Tarde)</th>
                <th className="p-2 text-center w-32">CONTEJO FÍSICO FINAL</th>
                <th className="p-2 text-center w-40">RESUMEN GLOBAL EN BS</th>
                <th className="p-2 text-center w-32">DIFERENCIA GLOBAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                let statusIcon = null;
                let statusClass = "";
                
                if (row.estado === 'CUADRA') {
                  statusIcon = <CheckCircle2 size={9} className="text-green-600" />;
                  statusClass = "bg-green-100 text-green-800";
                } else if (row.estado === 'FALTANTE') {
                  statusIcon = <XCircle size={9} className="text-red-600" />;
                  statusClass = "bg-red-100 text-red-800";
                } else {
                  statusIcon = <AlertTriangle size={9} className="text-amber-600" />;
                  statusClass = "bg-amber-100 text-amber-800";
                }

                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-center font-mono text-slate-400">{row.id}</td>
                    <td className="p-2 font-bold text-slate-700">{row.metodo}</td>
                    <td className="p-2 text-center font-mono text-slate-600 bg-slate-50/50">{row.periodo1}</td>
                    <td className="p-2 text-center font-mono text-slate-600 bg-slate-100/30">{row.periodo2}</td>
                    <td className="p-2 text-center">
                      <Input 
                        type="number" 
                        step="0.01"
                        value={conteoFisico[row.id] || ''} 
                        onChange={(e) => handleFisicoChange(row.id, parseFloat(e.target.value) || 0)}
                        className="w-28 text-center font-mono font-bold h-7 text-[9px] mx-auto"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2 text-center font-mono font-bold text-blue-700">{row.resumenGlobal}</td>
                    <td className="p-2 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[8px]", statusClass)}>
                        {statusIcon}
                        {row.diferenciaGlobal !== 0 
                          ? `${row.diferenciaGlobal > 0 ? '+' : ''}${row.diferenciaGlobal.toFixed(2)}` 
                          : '0.00'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* TOTAL ROW */}
              <tr className="bg-[#1E3A8A] text-white font-bold text-[9px] sticky bottom-0">
                <td colSpan={4} className="p-2 text-right">TOTALES:</td>
                <td className="p-2 text-center font-mono">Bs {totalIngresosReales.toFixed(2)}</td>
                <td className="p-2 text-center font-mono">Bs {totalIngresosSistema.toFixed(2)}</td>
                <td className={cn("p-2 text-center font-mono", diferenciaNeta < 0 ? "text-red-300" : diferenciaNeta > 0 ? "text-yellow-300" : "text-green-300")}>
                  {diferenciaNeta !== 0 ? `${diferenciaNeta > 0 ? '+' : ''}${diferenciaNeta.toFixed(2)}` : '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER - BOTONES */}
        <div className="bg-white p-3 border-t border-slate-200 flex-shrink-0">
          {/* RESUMEN TOTAL */}
          <div className="bg-slate-100 rounded-lg p-2 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[8px] text-slate-500 uppercase font-bold">TOTAL INGRESOS CAJA REAL:</p>
                <p className="text-base font-black text-emerald-700">Bs {totalIngresosReales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 uppercase font-bold">DIFERENCIA NETA CAJA:</p>
                <p className={cn("text-base font-black", diferenciaNeta < 0 ? "text-red-600" : diferenciaNeta > 0 ? "text-amber-600" : "text-green-600")}>
                  {diferenciaNeta < 0 ? '-' : diferenciaNeta > 0 ? '+' : ''}Bs {Math.abs(diferenciaNeta).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* BOTONES ACCIÓN */}
          <div className="flex gap-3 mb-3">
            <Button onClick={handlePrintTicket} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1 px-3 flex-1 h-auto">
              <Printer size={12} className="mr-1" /> EMITIR TICKET FINAL
            </Button>
            <Button onClick={handlePrintTicket} variant="outline" className="border-slate-300 font-bold text-[10px] py-1 px-3 flex-1 h-auto">
              <TrendingUp size={12} className="mr-1" /> IMPRIMIR RESUMEN
            </Button>
          </div>

          {/* CHECKBOX CONCILIACIÓN */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isConciliado}
                onChange={(e) => setIsConciliado(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-slate-700 uppercase tracking-wide text-[8px] font-bold">Declaro bajo firma el conteo físico consolidado</span>
            </label>
            <div className="flex gap-2">
              <Button 
                disabled={!isConciliado || isSubmitting}
                onClick={handleConfirmarCierre}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-[9px] py-1 px-3 h-auto"
              >
                <Save size={10} className="mr-1" /> {isSubmitting ? 'PROCESANDO...' : 'CONFIRMAR CIERRE'}
              </Button>
              <Button onClick={onClose} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-[9px]">
                <Ban size={9} className="mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}