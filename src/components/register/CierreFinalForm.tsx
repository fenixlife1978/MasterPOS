"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';
import { Printer, Share2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatBs, formatUsd, formatBsNumber } from '@/lib/currency-formatter';

interface CierreFinalFormProps {
  onClose: () => void;
  tasaActual: number;
}

function getVenezuelaHour(dateStr: string): number {
  try {
    const d = new Date(dateStr);
    const formatter = new Intl.DateTimeFormat('es-VE', {
      timeZone: 'America/Caracas',
      hour: '2-digit',
      hour12: false
    });
    return parseInt(formatter.format(d));
  } catch {
    return 12;
  }
}

function getVenezuelaTimeString(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
  const { currentSession, closeCashSession } = state;

  // Estados para los dos bloques: MAÑANA y TARDE
  const [morningRate, setMorningRate] = useState<number | null>(null);
  const [eveningRate, setEveningRate] = useState<number | null>(null);
  const [morningFirstTxTime, setMorningFirstTxTime] = useState<string>('');
  const [eveningFirstTxTime, setEveningFirstTxTime] = useState<string>('');
  const [ventasManana, setVentasManana] = useState<Record<string, number>>({});
  const [vueltosManana, setVueltosManana] = useState<Record<string, number>>({});
  const [ventasTarde, setVentasTarde] = useState<Record<string, number>>({});
  const [vueltosTarde, setVueltosTarde] = useState<Record<string, number>>({});

  useEffect(() => {
    if (state.register) {
      setRegister(state.register);
    } else {
      const cached = localStorage.getItem(`pos_register_${terminalId}`);
      if (cached) {
        try { setRegister(JSON.parse(cached)); } catch(e) {}
      }
    }
  }, [state.register, terminalId]);

  // Procesar transacciones del día, separar por mañana/tarde y detectar tasas
  useEffect(() => {
    if (!register?.txs) return;
    const today = new Date().toISOString().split('T')[0];
    const txDay = register.txs.filter((t: any) => t.date?.startsWith(today));
    
    // Encontrar la primera tasa del día (mañana) y la última tasa (tarde)
    let firstRate: number | null = null;
    let lastRate: number | null = null;
    let firstRateTime = '';
    let lastRateTime = '';
    
    // Acumular ventas y vueltos por período
    const ventasAM: Record<string, number> = {};
    const vueltosAM: Record<string, number> = {};
    const ventasPM: Record<string, number> = {};
    const vueltosPM: Record<string, number> = {};
    
    const methods = ['efectivo_bs', 'usd_efectivo', 'tarjeta', 'biopago', 'pago_movil', 'zelle'];
    methods.forEach(m => {
      ventasAM[m] = 0;
      vueltosAM[m] = 0;
      ventasPM[m] = 0;
      vueltosPM[m] = 0;
    });

    const sortedByDate = [...txDay].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const tx of sortedByDate) {
      if (tx.type !== 'contado' && tx.type !== 'cobro_deuda') continue;
      const rate = tx.exchangeRate || tasaActual;
      if (firstRate === null) {
        firstRate = rate;
        firstRateTime = tx.date;
      }
      lastRate = rate;
      lastRateTime = tx.date;
    }
    
    if (firstRate !== null) setMorningRate(firstRate);
    if (lastRate !== null) setEveningRate(lastRate);
    setMorningFirstTxTime(firstRateTime);
    setEveningFirstTxTime(lastRateTime);
    
    for (const tx of txDay) {
      if (tx.type !== 'contado' && tx.type !== 'cobro_deuda') continue;
      const hour = getVenezuelaHour(tx.date);
      const isMorning = hour < 12;
      
      const methodKey = tx.payMethod || 'efectivo_bs';
      const isUsdMethod = methodKey === 'usd_efectivo' || methodKey === 'zelle';
      
      let ventaMonto = 0;
      if (isUsdMethod) {
        if (tx.payments && Array.isArray(tx.payments)) {
          tx.payments.forEach((p: any) => {
            if (p.method === methodKey && p.usdAmount) ventaMonto += p.usdAmount;
          });
        } else {
          ventaMonto = tx.totalUsd || 0;
        }
      } else {
        ventaMonto = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
      }
      
      const change = tx.change || 0;
      if (isMorning) {
        ventasAM[methodKey] += ventaMonto;
        if (change > 0) {
          if (isUsdMethod) {
            vueltosAM['efectivo_bs'] += change;
          } else {
            vueltosAM[methodKey] += change;
          }
        }
      } else {
        ventasPM[methodKey] += ventaMonto;
        if (change > 0) {
          if (isUsdMethod) {
            vueltosPM['efectivo_bs'] += change;
          } else {
            vueltosPM[methodKey] += change;
          }
        }
      }
    }
    
    setVentasManana(ventasAM);
    setVueltosManana(vueltosAM);
    setVentasTarde(ventasPM);
    setVueltosTarde(vueltosPM);
  }, [register, tasaActual]);

  const aperturaBs = register?.openAmountBs ?? 0;
  const aperturaUsd = register?.openAmountUsd ?? 0;
  const totalCashUsd = aperturaUsd + (() => {
    let total = 0;
    if (register?.txs && Array.isArray(register.txs)) {
      register.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        if (!isToday) return;
        if (t.type === 'contado' && t.payments) {
          t.payments.forEach((p: any) => {
            if (p.method === 'usd_efectivo' && p.usdAmount && p.usdAmount > 0) total += p.usdAmount;
          });
        }
      });
    }
    return total;
  })();

  const paymentMethods = [
    { metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false, saldoInicialVal: aperturaBs },
    { metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true, saldoInicialVal: aperturaUsd },
    { metodo: 'TARJETA', key: 'tarjeta', isUsd: false, saldoInicialVal: 0 },
    { metodo: 'BIOPAGO', key: 'biopago', isUsd: false, saldoInicialVal: 0 },
    { metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false, saldoInicialVal: 0 },
    { metodo: 'ZELLE', key: 'zelle', isUsd: true, saldoInicialVal: 0 },
  ];

  const rows = paymentMethods.map(pm => {
    const isUsd = pm.isUsd;
    const saldoInicial = pm.saldoInicialVal;
    const ventasMananaVal = ventasManana[pm.key] || 0;
    const vueltosMananaVal = vueltosManana[pm.key] || 0;
    const ventasTardeVal = ventasTarde[pm.key] || 0;
    const vueltosTardeVal = vueltosTarde[pm.key] || 0;
    
    const sistema = saldoInicial + ventasMananaVal + ventasTardeVal - vueltosMananaVal - vueltosTardeVal;
    const fisicoIngresado = conteoFisico[pm.key] ?? 0;
    let fisico = fisicoIngresado;
    let diff = fisico - sistema;
    
    return {
      ...pm,
      saldoInicial,
      ventasMananaVal,
      vueltosMananaVal,
      ventasTardeVal,
      vueltosTardeVal,
      sistema,
      fisicoIngresado,
      fisico,
      diff,
    };
  });

  const tasaManana = morningRate || tasaActual;
  const tasaTarde = eveningRate || tasaActual;
  const tasaCierre = tasaActual;
  
  const totalSistBs = rows.reduce((sum, r) => {
    if (r.isUsd) return sum + (r.sistema * tasaCierre);
    return sum + r.sistema;
  }, 0);
  const totalFisBs = rows.reduce((sum, r) => {
    if (r.isUsd) return sum + (r.fisico * tasaCierre);
    return sum + r.fisico;
  }, 0);
  const diffNeta = Math.round((totalFisBs - totalSistBs) * 100) / 100;

  const generarReporte = () => {
    const report = {
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tasaCierre,
      tasaManana,
      tasaTarde,
      horaManana: morningFirstTxTime,
      horaTarde: eveningFirstTxTime,
      apertura: { bs: aperturaBs, usd: aperturaUsd },
      ventasManana: ventasManana,
      vueltosManana: vueltosManana,
      ventasTarde: ventasTarde,
      vueltosTarde: vueltosTarde,
      cuadre: rows.map(r => ({
        metodo: r.metodo,
        saldoInicial: r.saldoInicial,
        ventasMananaVal: r.ventasMananaVal,
        vueltosMananaVal: r.vueltosMananaVal,
        ventasTardeVal: r.ventasTardeVal,
        vueltosTardeVal: r.vueltosTardeVal,
        sistema: r.sistema,
        real: r.fisico,
        diferencia: r.diff,
        moneda: r.isUsd ? 'USD' : 'Bs',
      })),
      totales: { sistema: totalSistBs, real: totalFisBs, diferencia: diffNeta, estado: Math.abs(diffNeta) < 0.01 ? "CONCILIADO" : (diffNeta > 0 ? "SOBRANTE" : "FALTANTE") },
      usdEfectivo: totalCashUsd,
    };
    return report;
  };

  const handleConfirmCierre = () => {
    if (!isConciliado) return;
    const report = generarReporte();
    setCloseReportData(report);
    setShowResumenModal(true);
  };

  const finalizarCierre = async () => {
    if (closeReportData) {
      setIsSubmitting(true);
      try {
        const timestamp = Date.now();
        localStorage.setItem(`cierre_final_${timestamp}`, JSON.stringify(closeReportData));
        await syncService.saveCashClose({ id: `final_${timestamp}`, tipo: 'final', ...closeReportData });
        
        if (currentSession) await closeCashSession(totalCashUsd).catch(console.error);
        
        // Limpiar cortes parciales
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith('corte_parcial_')) localStorage.removeItem(key);
        }

        // ✅ ACTIVAR PANTALLA DE BLOQUEO DE FORMA INMEDIATA
        // Se actualiza el estado en Firestore para que el cajero no pueda seguir operando
        if (terminalId && terminalId !== 'default') {
          await syncService.updateTerminalBlockStatus(terminalId, true);
        }

        state.closeCashRegister();
      } catch (error) {
        console.error("Error al finalizar cierre:", error);
      } finally {
        setIsSubmitting(false);
      }
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
      try { await navigator.share({ title: 'Cierre de Caja MasterPOS', text }); } catch (err) { console.error(err); }
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
    return `<!DOCTYPE html>
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
      <p><strong>Mañana:</strong> Tasa ${formatBs(data.tasaManana)} (desde ${new Date(data.horaManana).toLocaleTimeString('es-VE')})</p>
      <p><strong>Tarde:</strong> Tasa ${formatBs(data.tasaTarde)} (desde ${new Date(data.horaTarde).toLocaleTimeString('es-VE')})</p>
      <p><strong>USD en Caja:</strong> ${formatUsd(data.usdEfectivo)}</p>
      <div class="line"></div>
      <div class="center">
        <div style="font-size: 28px; font-weight: bold; color: ${estadoColor};">${estadoIcono} ${estado}</div>
        <div style="font-size: 48px; font-weight: black; margin: 10px 0;">${diff > 0 ? '+' : ''}${formatBsNumber(Math.abs(diff))}</div>
      </div>
      <div class="line"></div>
      <h3>Detalle por método</h3>
      <table>
        <thead>
          <tr>
            <th>Método</th>
            <th>Fondo Inicial</th>
            <th>Mañana (${formatBs(data.tasaManana)})</th>
            <th>Tarde (${formatBs(data.tasaTarde)})</th>
            <th>Sistema</th>
            <th>Real</th>
            <th>Diferencia</th>
          </tr>
        </thead>
        <tbody>
          ${data.cuadre.map((r: any) => `
            <tr>
              <td>${r.metodo}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsd(r.saldoInicial) : formatBs(r.saldoInicial)}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsd(r.ventasMananaVal - r.vueltosMananaVal) : formatBs(r.ventasMananaVal - r.vueltosMananaVal)}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsd(r.ventasTardeVal - r.vueltosTardeVal) : formatBs(r.ventasTardeVal - r.vueltosTardeVal)}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsd(r.sistema) : formatBs(r.sistema)}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsd(r.real) : formatBs(r.real)}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsd(r.diferencia) : formatBs(r.diferencia)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <p class="center">Documento generado por MasterPOS</p>
      </body>
      </html>`;
  };

  const generarTextoResumen = (data: any) => {
    const diff = data.totales.diferencia;
    const estado = data.totales.estado;
    return `MASTERPOS - Cierre de Jornada\nFecha: ${data.fechaCierre}\nApertura: ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)}\nMañana: Tasa ${formatBs(data.tasaManana)}\nTarde: Tasa ${formatBs(data.tasaTarde)}\nUSD Efectivo: ${formatUsd(data.usdEfectivo)}\nRESULTADO: ${estado} por ${formatBs(Math.abs(diff))}`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
        <div className="bg-[#F9F4E1] w-full max-w-full overflow-x-auto rounded-xl shadow-2xl flex flex-col max-h-[98vh]">
          <div className="bg-[#1E3A8A] text-white p-3 border-b-4 border-[#0284C7] sticky left-0">
            <h1 className="text-center font-black uppercase text-base">CIERRE FINAL CONSOLIDADO</h1>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full text-[10px] min-w-[800px]">
              <thead className="bg-[#2c3e50] text-white sticky top-0 z-10">
                <tr>
                  <th rowSpan={2} className="p-2 text-left">MÉTODO</th>
                  <th rowSpan={2} className="p-2 text-center">FONDO INICIAL</th>
                  <th colSpan={2} className="p-2 text-center" title={`Tasa de Mañana: ${formatBs(tasaManana)} (desde ${morningFirstTxTime ? getVenezuelaTimeString(morningFirstTxTime) : 'inicio'})`}>
                    MAÑANA ({formatBs(tasaManana)})
                  </th>
                  <th colSpan={2} className="p-2 text-center" title={`Tasa de Tarde: ${formatBs(tasaTarde)} (desde ${eveningFirstTxTime ? getVenezuelaTimeString(eveningFirstTxTime) : 'inicio'})`}>
                    TARDE ({formatBs(tasaTarde)})
                  </th>
                  <th rowSpan={2} className="p-2 text-center">EN SISTEMA</th>
                  <th rowSpan={2} className="p-2 text-center">EFECTIVO USD</th>
                  <th rowSpan={2} className="p-2 text-center">FÍSICO</th>
                  <th rowSpan={2} className="p-2 text-center">DIF.</th>
                </tr>
                <tr>
                  <th className="p-1 text-center text-[9px] bg-[#3a5a7a]">Ventas</th>
                  <th className="p-1 text-center text-[9px] bg-[#3a5a7a]">Vueltos</th>
                  <th className="p-1 text-center text-[9px] bg-[#3a5a7a]">Ventas</th>
                  <th className="p-1 text-center text-[9px] bg-[#3a5a7a]">Vueltos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(r => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <td className="p-2 font-bold">{r.metodo}</td>
                    <td className="p-2 text-center font-mono">
                      {r.isUsd ? formatUsd(r.saldoInicial) : formatBs(r.saldoInicial)}
                    </td>
                    <td className="p-2 text-center font-mono">
                      {r.isUsd ? formatUsd(r.ventasMananaVal) : formatBs(r.ventasMananaVal)}
                    </td>
                    <td className="p-2 text-center font-mono text-red-600">
                      {r.isUsd ? formatUsd(r.vueltosMananaVal) : formatBs(r.vueltosMananaVal)}
                    </td>
                    <td className="p-2 text-center font-mono">
                      {r.isUsd ? formatUsd(r.ventasTardeVal) : formatBs(r.ventasTardeVal)}
                    </td>
                    <td className="p-2 text-center font-mono text-red-600">
                      {r.isUsd ? formatUsd(r.vueltosTardeVal) : formatBs(r.vueltosTardeVal)}
                    </td>
                    <td className="p-2 text-center font-bold font-mono">
                      {r.isUsd ? formatUsd(r.sistema) : formatBs(r.sistema)}
                    </td>
                    <td className="p-2 text-center font-mono text-blue-600">
                      {r.key === 'usd_efectivo' ? formatUsd(totalCashUsd) : '—'}
                    </td>
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
                        <div className="text-[8px] text-slate-400 mt-0.5">≈ {formatBs(r.fisicoIngresado * tasaCierre)}</div>
                      )}
                    </td>
                    <td className={cn("p-2 text-center font-bold", r.diff < 0 ? "text-red-600" : r.diff > 0 ? "text-emerald-600" : "text-slate-500")}>
                      {r.diff === 0 ? '✓' : (r.isUsd ? formatUsd(Math.abs(r.diff)) : formatBsNumber(Math.abs(r.diff)))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#1E3A8A] text-white font-bold">
                  <td colSpan={6} className="p-2 text-right">TOTAL CONSOLIDADO (Bs):</td>
                  <td className="p-2 text-center font-bold">{formatBs(totalSistBs)}</td>
                  <td className="p-2 text-center font-bold">{formatUsd(totalCashUsd)}</td>
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#1E3A8A] text-white p-4 sticky top-0 flex justify-between items-center">
              <h2 className="text-lg font-black">RESUMEN DE CIERRE DE JORNADA</h2>
              <button onClick={finalizarCierre} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center"><p className="text-sm text-gray-500">Fecha y hora</p><p className="font-mono">{closeReportData.fechaCierre}</p></div>
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div><p className="text-xs text-gray-500">Apertura</p><p className="font-bold">{formatBs(closeReportData.apertura.bs)}</p><p className="font-bold">{formatUsd(closeReportData.apertura.usd)}</p></div>
                <div><p className="text-xs text-gray-500">Tasa Mañana</p><p className="font-bold">{formatBs(closeReportData.tasaManana)}</p></div>
                <div><p className="text-xs text-gray-500">Tasa Tarde</p><p className="font-bold">{formatBs(closeReportData.tasaTarde)}</p></div>
                <div><p className="text-xs text-gray-500">USD Efectivo</p><p className="font-bold">{formatUsd(closeReportData.usdEfectivo)}</p></div>
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
              <div className="text-center pt-4">
                <Button 
                  onClick={finalizarCierre} 
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 text-base font-black shadow-lg"
                >
                  {isSubmitting ? 'CERRANDO...' : 'FINALIZAR Y BLOQUEAR TERMINAL'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}