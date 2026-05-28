"use client";

import { useState, useMemo, useEffect } from 'react';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
      setAperturaOriginalBs(firstCorte.apertura.montoBs || 0);
      setAperturaOriginalUsd(firstCorte.apertura.montoUsd || 0);
    } else if (register) {
      setAperturaOriginalBs(register.openAmountBs || 0);
      setAperturaOriginalUsd(register.openAmountUsd || 0);
    }
  }, [register]);

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

  // Ventas TOTALES del día (contado + cobro deuda) en Bs
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

  // DEVOLUCIONES del día (en Bs)
  const returnsTotals = useMemo(() => {
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

  // USD recibidos por Zelle
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

  const totalCashUsd = aperturaUsd + usdCashReceived; // efectivo físico
  const totalZelleUsd = usdZelleReceived;

  // Ventas a CRÉDITO totales
  const creditTotals = useMemo(() => {
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

  // --- Cálculo de ventas en USD por período (mañana/tarde) ---
  const usdCashMorning = useMemo(() => {
    if (!corteParcial?.usdEfectivo) return 0;
    return (corteParcial.usdEfectivo || 0) - aperturaUsd;
  }, [corteParcial, aperturaUsd]);

  const usdCashAfternoon = useMemo(() => totalCashUsd - (corteParcial?.usdEfectivo || 0), [totalCashUsd, corteParcial]);

  const usdZelleMorning = useMemo(() => corteParcial?.usdZelle || 0, [corteParcial]);
  const usdZelleAfternoon = useMemo(() => totalZelleUsd - usdZelleMorning, [totalZelleUsd, usdZelleMorning]);

  // Devoluciones en USD por período (convertidas a USD con la tasa respectiva)
  const returnsUsdMorning = useMemo(() => {
    const returns: Record<string, number> = {};
    paymentMethods.forEach(m => {
      if (!m.isUsd) return;
      const bsAmount = corteParcial?.devoluciones?.porMetodo?.[m.key] || 0;
      returns[m.key] = bsAmount / tasaP1;
    });
    return returns;
  }, [corteParcial, tasaP1]);

  const returnsUsdAfternoon = useMemo(() => {
    const returns: Record<string, number> = {};
    paymentMethods.forEach(m => {
      if (!m.isUsd) return;
      const totalBs = returnsTotals[m.key] || 0;
      const morningBs = corteParcial?.devoluciones?.porMetodo?.[m.key] || 0;
      const afternoonBs = Math.max(0, totalBs - morningBs);
      returns[m.key] = afternoonBs / tasaP2;
    });
    return returns;
  }, [returnsTotals, corteParcial, tasaP2]);

  // Ventas de la MAÑANA (contado) en Bs para métodos no USD, y en USD para métodos USD
  const morningSalesBs = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
    if (corteParcial?.ventas?.porMetodo) {
      Object.entries(corteParcial.ventas.porMetodo).forEach(([k, v]) => {
        totals[k] = Math.round((v as number) * 100) / 100;
      });
    }
    return totals;
  }, [corteParcial]);

  const afternoonSalesBs = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => {
      const total = salesTotals[m.key] || 0;
      const morning = morningSalesBs[m.key] || 0;
      totals[m.key] = Math.max(0, total - morning);
    });
    return totals;
  }, [salesTotals, morningSalesBs]);

  // Créditos de la MAÑANA / TARDE
  const morningCredit = useMemo(() => corteParcial?.creditos?.total || 0, [corteParcial]);
  const afternoonCredit = useMemo(() => Math.max(0, creditTotals - morningCredit), [creditTotals, morningCredit]);

  // Construir filas (métodos de pago)
  const rows = paymentMethods.map(pm => {
    const isUsd = pm.isUsd;
    const isZelle = pm.key === 'zelle';

    let saldoInicialVal = 0;
    if (pm.key === 'efectivo_bs') saldoInicialVal = aperturaBs;
    if (pm.key === 'usd_efectivo') saldoInicialVal = aperturaUsd;
    if (pm.key === 'zelle') saldoInicialVal = 0;

    let vManana: number;
    let vTarde: number;
    let rManana: number;
    let rTarde: number;
    let sist: number;

    if (isUsd) {
      // valores en USD
      if (pm.key === 'usd_efectivo') {
        vManana = usdCashMorning;
        vTarde = usdCashAfternoon;
        rManana = returnsUsdMorning[pm.key] || 0;
        rTarde = returnsUsdAfternoon[pm.key] || 0;
      } else { // Zelle
        vManana = usdZelleMorning;
        vTarde = usdZelleAfternoon;
        rManana = returnsUsdMorning[pm.key] || 0;
        rTarde = returnsUsdAfternoon[pm.key] || 0;
      }
      sist = saldoInicialVal + vManana + vTarde - rManana - rTarde;
    } else {
      // valores en Bs
      vManana = morningSalesBs[pm.key] || 0;
      vTarde = afternoonSalesBs[pm.key] || 0;
      rManana = corteParcial?.devoluciones?.porMetodo?.[pm.key] || 0;
      rTarde = Math.max(0, (returnsTotals[pm.key] || 0) - rManana);
      const saldoInicialBs = pm.key === 'efectivo_bs' ? aperturaBs : 0;
      sist = saldoInicialBs + vManana + vTarde - rManana - rTarde;
    }

    const fisicoIngresado = isZelle ? sist : (conteoFisico[pm.key] ?? 0);
    let fisicoVal = fisicoIngresado;
    if (isUsd && !isZelle) fisicoVal = fisicoIngresado; // ya en USD
    if (isZelle) fisicoVal = sist;
    const diff = Math.round((fisicoVal - sist) * 100) / 100;

    return {
      id: pm.id,
      metodo: pm.metodo,
      key: pm.key,
      isUsd,
      isZelle,
      isCreditRow: false,
      saldoInicial: isUsd ? formatUsd(saldoInicialVal) : formatBs(saldoInicialVal),
      vManana,
      vTarde,
      rManana,
      rTarde,
      sist,
      fisicoIngresado,
      fisicoVal,
      diff,
    };
  });

  // Filas adicionales para CRÉDITO (mañana y tarde) - siempre en Bs
  const creditMorningRow = morningCredit > 0 ? {
    id: 9991,
    metodo: 'CRÉDITO (Mañana)',
    key: 'credito_manana',
    isUsd: false,
    isZelle: false,
    isCreditRow: true,
    saldoInicial: '—',
    vManana: morningCredit,
    vTarde: 0,
    rManana: 0,
    rTarde: 0,
    sist: morningCredit,
    fisicoIngresado: morningCredit,
    fisicoVal: morningCredit,
    diff: 0
  } : null;

  const creditAfternoonRow = afternoonCredit > 0 ? {
    id: 9992,
    metodo: 'CRÉDITO (Tarde)',
    key: 'credito_tarde',
    isUsd: false,
    isZelle: false,
    isCreditRow: true,
    saldoInicial: '—',
    vManana: 0,
    vTarde: afternoonCredit,
    rManana: 0,
    rTarde: 0,
    sist: afternoonCredit,
    fisicoIngresado: afternoonCredit,
    fisicoVal: afternoonCredit,
    diff: 0
  } : null;

  const allRows = [...rows];
  if (creditMorningRow) allRows.push(creditMorningRow);
  if (creditAfternoonRow) allRows.push(creditAfternoonRow);

  // Totales en Bs (convertir USD a Bs con tasaP2 para sumar)
  const totalSistBs = rows.reduce((sum, r) => {
    if (r.isUsd) return sum + (r.sist * tasaP2);
    return sum + r.sist;
  }, 0);
  const totalFisBs = rows.reduce((sum, r) => {
    if (r.isUsd) return sum + (r.fisicoVal * tasaP2);
    return sum + r.fisicoVal;
  }, 0);
  const diffNeta = Math.round((totalFisBs - totalSistBs) * 100) / 100;

  const generarReporte = () => {
    const ventasContadoBs = rows.reduce((acc, r) => {
      const ventas = r.vManana + r.vTarde;
      return acc + (r.isUsd ? ventas * tasaP2 : ventas);
    }, 0);
    const devolucionesBs = rows.reduce((acc, r) => {
      const dev = r.rManana + r.rTarde;
      return acc + (r.isUsd ? dev * tasaP2 : dev);
    }, 0);
    const ventasCredito = creditTotals;
    return {
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tipoCorte: 'cierre_total',
      tasaPeriodo1: tasaP1,
      tasaPeriodo2: tasaP2,
      apertura: { bs: aperturaBs, usd: aperturaUsd },
      ventas: { totalContado: ventasContadoBs, credito: ventasCredito, creditoManana: morningCredit, creditoTarde: afternoonCredit },
      devoluciones: { total: devolucionesBs },
      usdEfectivo: totalCashUsd,
      cuadre: allRows.map(r => ({
        metodo: r.metodo,
        sistema: r.isUsd ? r.sist * tasaP2 : r.sist,
        real: r.isUsd ? r.fisicoVal * tasaP2 : r.fisicoVal,
        diferencia: r.isUsd ? r.diff * tasaP2 : r.diff
      })),
      totales: { sistema: totalSistBs, real: totalFisBs, diferencia: diffNeta, estado: Math.abs(diffNeta) < 0.01 ? "CONCILIADO" : (diffNeta > 0 ? "SOBRANTE" : "FALTANTE") }
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
      const timestamp = Date.now();
      // Guardar en localStorage
      localStorage.setItem(`cierre_final_${timestamp}`, JSON.stringify(closeReportData));
      
      // Guardar en Firestore (colección cash_closes)
      await syncService.saveCashClose({
        id: `final_${timestamp}`,
        tipo: 'final',
        ...closeReportData
      });
      
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
      <p><strong>Ventas Contado:</strong> ${formatBs(data.ventas.totalContado)}</p>
      <p><strong>Devoluciones:</strong> ${formatBs(data.devoluciones.total)}</p>
      <p><strong>Ventas Crédito:</strong> ${formatBs(data.ventas.credito)}</p>
      <p><strong>USD en Caja:</strong> ${formatUsd(data.usdEfectivo)}</p>
      <div class="line"></div>
      <div class="center">
        <div style="font-size: 28px; font-weight: bold; color: ${estadoColor};">${estadoIcono} ${estado}</div>
        <div style="font-size: 48px; font-weight: black; margin: 10px 0;">${diff > 0 ? '+' : ''}${formatBsNumber(Math.abs(diff))}</div>
      </div>
      <div class="line"></div>
      <h3>Detalle por método</h3>
      <table>
        <thead><tr><th>Método</th><th>Sistema (Bs)</th><th>Real (Bs)</th><th>Diferencia</th></tr></thead>
        <tbody>${data.cuadre.map((r: any) => `<tr>
          <td>${r.metodo}</td>
          <td class="right">${formatBsNumber(r.sistema)}</td>
          <td class="right">${formatBsNumber(r.real)}</td>
          <td class="right">${formatBsNumber(r.diferencia)}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="line"></div>
      <p class="center">Documento generado por MasterPOS</p>
      </body>
      </html>`;
  };

  const generarTextoResumen = (data: any) => {
    const diff = data.totales.diferencia;
    const estado = data.totales.estado;
    return `MASTERPOS - Cierre de Jornada\nFecha: ${data.fechaCierre}\nApertura: ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)}\nVentas Contado: ${formatBs(data.ventas.totalContado)}\nDevoluciones: ${formatBs(data.devoluciones.total)}\nVentas Crédito: ${formatBs(data.ventas.credito)}\nUSD en Caja: ${formatUsd(data.usdEfectivo)}\nRESULTADO: ${estado} por ${formatBs(Math.abs(diff))}`;
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
                  <th className="p-2 text-center">MAÑANA</th>
                  <th className="p-2 text-center">TARDE</th>
                  <th className="p-2 text-center">DEV. MAÑANA</th>
                  <th className="p-2 text-center">DEV. TARDE</th>
                  <th className="p-2 text-center">SISTEMA</th>
                  <th className="p-2 text-center">EFECTIVO USD</th>
                  <th className="p-2 text-center">FÍSICO</th>
                  <th className="p-2 text-center">DIF.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allRows.map(r => {
                  let usdDisplay = '—';
                  if (r.key === 'usd_efectivo') usdDisplay = formatUsd(totalCashUsd);
                  if (r.key === 'zelle') usdDisplay = '—';
                  const isUsdRow = r.isUsd;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-2 font-bold">{r.metodo}</td>
                      <td className="p-2 text-center">{r.saldoInicial}</td>
                      <td className="p-2 text-center font-mono">
                        {isUsdRow ? formatUsd(r.vManana) : formatBs(r.vManana)}
                      </td>
                      <td className="p-2 text-center font-mono">
                        {isUsdRow ? formatUsd(r.vTarde) : formatBs(r.vTarde)}
                      </td>
                      <td className="p-2 text-center font-mono text-red-600">
                        {isUsdRow ? `-${formatUsd(r.rManana)}` : `-${formatBs(r.rManana)}`}
                      </td>
                      <td className="p-2 text-center font-mono text-red-600">
                        {isUsdRow ? `-${formatUsd(r.rTarde)}` : `-${formatBs(r.rTarde)}`}
                      </td>
                      <td className="p-2 text-center font-bold text-blue-700">
                        {isUsdRow ? formatUsd(r.sist) : formatBs(r.sist)}
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
                              value={r.fisicoIngresado === 0 ? '' : r.fisicoIngresado}
                              onChange={e => setConteoFisico({...conteoFisico, [r.key]: parseFloat(e.target.value) || 0})}
                              className="w-24 h-7 text-xs text-center font-bold"
                              placeholder="0.00"
                            />
                            <span className="text-[9px] font-bold text-slate-500">{isUsdRow ? 'USD' : 'Bs'}</span>
                          </div>
                        )}
                        {isUsdRow && !r.isZelle && r.fisicoIngresado > 0 && (
                          <div className="text-[8px] text-slate-400 mt-0.5">≈ {formatBs(r.fisicoIngresado * tasaP2)}</div>
                        )}
                      </td>
                      <td className={cn("p-2 text-center font-bold", r.diff < 0 ? "text-red-600" : r.diff > 0 ? "text-emerald-600" : "text-slate-500")}>
                        {r.diff === 0 ? '✓' : (isUsdRow ? formatUsd(Math.abs(r.diff)) : formatBsNumber(Math.abs(r.diff)))}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#1E3A8A] text-white font-bold">
                  <td colSpan={7} className="p-2 text-right">TOTAL CONSOLIDADO:</td>
                  <td className="p-2 text-center font-bold text-blue-600">{formatUsd(totalCashUsd)}</td>
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
                <div><p className="text-xs text-gray-500">Ventas del día</p><p className="font-bold">Contado: {formatBs(closeReportData.ventas.totalContado)}</p><p className="font-bold">Devoluciones: {formatBs(closeReportData.devoluciones.total)}</p><p className="font-bold">Crédito: {formatBs(closeReportData.ventas.credito)}</p><p className="font-bold">USD Efectivo Total: {formatUsd(closeReportData.usdEfectivo)}</p></div>
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