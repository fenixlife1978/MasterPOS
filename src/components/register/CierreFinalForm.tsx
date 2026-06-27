"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import syncService from '@/services/syncService';
import { Printer, Share2, X, ShoppingBasket, Hash, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface CierreFinalFormProps {
  onClose: () => void;
  tasaActual: number;
}

function getVenezuelaToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
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

const renderCurrencyCell = (value: number, isUsd: boolean, rate: number, showBsEquivalent: boolean = true) => {
  if (isUsd) {
    const usdFormatted = formatUsd(value);
    if (showBsEquivalent && value !== 0) {
      const bsEquivalent = value * rate;
      return (
        <div className="flex flex-col items-center">
          <span>{usdFormatted}</span>
          <span className="text-[8px] text-slate-500 mt-0.5">{formatBs(bsEquivalent)}</span>
        </div>
      );
    }
    return <span>{usdFormatted}</span>;
  } else {
    return <span>{formatBs(value)}</span>;
  }
};

export default function CierreFinalForm({ onClose, tasaActual }: CierreFinalFormProps) {
  const state = usePOSState();
  const { user, logout } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const terminalName = user?.terminalName || 'Principal';
  const [conteoFisico, setConteoFisico] = useState<Record<string, number>>({});
  const [isConciliado, setIsConciliado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [closeReportData, setCloseReportData] = useState<any>(null);
  const { currentSession, closeCashSession } = state;

  const reg = state.register;

  const [morningRate, setMorningRate] = useState<number | null>(null);
  const [eveningRate, setEveningRate] = useState<number | null>(null);
  const [morningFirstTxTime, setMorningFirstTxTime] = useState<string>('');
  const [eveningFirstTxTime, setEveningFirstTxTime] = useState<string>('');

  const [ventasManana, setVentasManana] = useState<Record<string, { bs: number; usd: number }>>({});
  const [vueltosManana, setVueltosManana] = useState<Record<string, number>>({});
  const [ventasTarde, setVentasTarde] = useState<Record<string, { bs: number; usd: number }>>({});
  const [vueltosTarde, setVueltosTarde] = useState<Record<string, number>>({});
  const [devoluciones, setDevoluciones] = useState<Record<string, { bs: number; usd: number }>>({});

  const totalCreditoBs = useMemo(() => {
    if (!reg?.txs) return 0;
    const todayVzla = getVenezuelaToday();
    const txDay = reg.txs.filter((t: any) => {
      const txDate = new Date(t.date);
      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
      const txDateStr = formatter.format(txDate);
      return txDateStr === todayVzla && t.type === 'credito';
    });
    return txDay.reduce((sum, t) => sum + t.total, 0);
  }, [reg?.txs]);

  const productStats = useMemo(() => {
    if (!reg?.txs) return { items: [], total: 0, best: null };
    const todayVzla = getVenezuelaToday();
    const txDay = reg.txs.filter((t: any) => {
      const txDate = new Date(t.date);
      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(txDate) === todayVzla && (t.type === 'contado' || t.type === 'credito');
    });

    const counts: Record<string, number> = {};
    let totalQty = 0;

    txDay.forEach(tx => {
      let items = tx.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
      }
      items.forEach((item: any) => {
        counts[item.name] = (counts[item.name] || 0) + item.qty;
        totalQty += item.qty;
      });
    });

    const items = Object.entries(counts).map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    return {
      items,
      total: totalQty,
      best: items.length > 0 ? items[0] : null
    };
  }, [reg?.txs]);

  const receiptRange = useMemo(() => {
    if (!reg?.txs) return { first: '—', last: '—' };
    const todayVzla = getVenezuelaToday();
    const txDay = reg.txs.filter((t: any) => {
      const txDate = new Date(t.date);
      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(txDate) === todayVzla && (t.type === 'contado' || t.type === 'credito');
    });
    
    const nums = txDay.map(t => t.receiptNumber || t.receipt_number).filter(n => typeof n === 'number');
    if (nums.length === 0) return { first: '—', last: '—' };
    
    return {
      first: Math.min(...nums).toString().padStart(8, '0'),
      last: Math.max(...nums).toString().padStart(8, '0')
    };
  }, [reg?.txs]);

  useEffect(() => {
    if (!reg?.txs) return;
    const todayVzla = getVenezuelaToday();
    const txDay = reg.txs.filter((t: any) => {
      const txDate = new Date(t.date);
      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
      const txDateStr = formatter.format(txDate);
      return txDateStr === todayVzla;
    });
    
    if (txDay.length === 0) {
      const methods = ['efectivo_bs', 'usd_efectivo', 'tarjeta', 'biopago', 'pago_movil', 'zelle'];
      const empty = methods.reduce((acc, m) => ({ ...acc, [m]: { bs: 0, usd: 0 } }), {});
      setVentasManana(empty);
      setVueltosManana({ efectivo_bs: 0 });
      setVentasTarde(empty);
      setVueltosTarde({ efectivo_bs: 0 });
      setDevoluciones(empty);
      setMorningRate(null);
      setEveningRate(null);
      return;
    }

    let firstRate: number | null = null;
    let lastRate: number | null = null;
    let firstRateTime = '';
    let lastRateTime = '';
    const sortedByDate = [...txDay].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const tx of sortedByDate) {
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

    const ventasAM: Record<string, { bs: number; usd: number }> = {};
    const vueltosAM: Record<string, number> = {};
    const ventasPM: Record<string, { bs: number; usd: number }> = {};
    const vueltosPM: Record<string, number> = {};
    const devolucionesTotales: Record<string, { bs: number; usd: number }> = {};
    const methods = ['efectivo_bs', 'usd_efectivo', 'tarjeta', 'biopago', 'pago_movil', 'zelle'];
    methods.forEach(m => {
      ventasAM[m] = { bs: 0, usd: 0 };
      vueltosAM[m] = 0;
      ventasPM[m] = { bs: 0, usd: 0 };
      vueltosPM[m] = 0;
      devolucionesTotales[m] = { bs: 0, usd: 0 };
    });

    for (const tx of txDay) {
      const hour = getVenezuelaHour(tx.date);
      const isMorning = hour < 12;

      if (tx.type === 'devolucion') {
        let methodDetected = tx.payMethod || 'efectivo_bs';
        if (tx.payments && Array.isArray(tx.payments) && tx.payments.length > 0) {
          methodDetected = tx.payments[0].method;
        }

        if (!devolucionesTotales[methodDetected]) devolucionesTotales[methodDetected] = { bs: 0, usd: 0 };

        if (methodDetected === 'usd_efectivo' || methodDetected === 'zelle') {
          devolucionesTotales[methodDetected].usd += tx.totalUsd || 0;
        } else {
          devolucionesTotales[methodDetected].bs += tx.total || 0;
        }
        continue;
      }

      if (tx.type !== 'contado' && tx.type !== 'cobro_deuda') continue;

      if (tx.payments && Array.isArray(tx.payments) && tx.payments.length > 0) {
        for (const payment of tx.payments) {
          const method = payment.method;
          if (!method) continue;
          const isUsd = method === 'usd_efectivo' || method === 'zelle';
          if (isUsd) {
            const usdAmount = payment.usdAmount !== undefined ? payment.usdAmount : payment.amount;
            if (isMorning) ventasAM[method].usd += usdAmount;
            else ventasPM[method].usd += usdAmount;
          } else {
            const bsAmount = payment.amount || 0;
            if (isMorning) ventasAM[method].bs += bsAmount;
            else ventasPM[method].bs += bsAmount;
          }
        }
      } else {
        const method = tx.pay_method || tx.payMethod || 'efectivo_bs';
        const isUsd = method === 'usd_efectivo' || method === 'zelle';
        if (isUsd) {
          const usdAmount = tx.total_usd || tx.totalUsd || 0;
          if (isMorning) ventasAM[method].usd += usdAmount;
          else ventasPM[method].usd += usdAmount;
        } else {
          const bsAmount = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
          if (isMorning) ventasAM[method].bs += bsAmount;
          else ventasPM[method].bs += bsAmount;
        }
      }

      const change = tx.change || 0;
      if (change > 0) {
        if (isMorning) vueltosAM['efectivo_bs'] += change;
        else vueltosPM['efectivo_bs'] += change;
      }
    }

    setVentasManana(ventasAM);
    setVueltosManana(vueltosAM);
    setVentasTarde(ventasPM);
    setVueltosTarde(vueltosPM);
    setDevoluciones(devolucionesTotales);
  }, [reg, tasaActual]);

  const aperturaBs = reg?.openAmountBs ?? 0;
  const aperturaUsd = reg?.openAmountUsd ?? 0;
  const horaApertura = reg?.openTime ? new Date(reg.openTime).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }) : '—';

  const totalCashUsd = useMemo(() => {
    let total = aperturaUsd;
    if (reg?.txs && Array.isArray(reg.txs)) {
      const todayVzla = getVenezuelaToday();
      reg.txs.forEach((t: any) => {
        const txDate = new Date(t.date);
        const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
        if (formatter.format(txDate) !== todayVzla) return;
        if (t.type !== 'contado') return;
        if (t.payments) {
          t.payments.forEach((p: any) => {
            if (p.method === 'usd_efectivo') total += p.usdAmount !== undefined ? p.usdAmount : (p.amount || 0);
          });
        } else if (t.payMethod === 'usd_efectivo') {
          total += t.totalUsd || 0;
        }
      });
    }
    return total;
  }, [reg, aperturaUsd]);

  const allMethodsSet = new Set<string>();
  Object.keys(devoluciones).forEach(m => allMethodsSet.add(m));
  Object.keys(ventasManana).forEach(m => allMethodsSet.add(m));
  Object.keys(ventasTarde).forEach(m => allMethodsSet.add(m));
  const baseMethods = ['efectivo_bs', 'usd_efectivo', 'tarjeta', 'biopago', 'pago_movil', 'zelle'];
  baseMethods.forEach(m => allMethodsSet.add(m));
  
  const paymentMethods = Array.from(allMethodsSet).map(key => {
    let metodo = '';
    let isUsd = false;
    let saldoInicialVal = 0;
    if (key === 'efectivo_bs') { metodo = 'EFECTIVO BS'; isUsd = false; saldoInicialVal = aperturaBs; }
    else if (key === 'usd_efectivo') { metodo = 'EFECTIVO USD'; isUsd = true; saldoInicialVal = aperturaUsd; }
    else if (key === 'tarjeta') { metodo = 'TARJETA'; isUsd = false; saldoInicialVal = 0; }
    else if (key === 'biopago') { metodo = 'BIOPAGO'; isUsd = false; saldoInicialVal = 0; }
    else if (key === 'pago_movil') { metodo = 'PAGO MÓVIL'; isUsd = false; saldoInicialVal = 0; }
    else if (key === 'zelle') { metodo = 'ZELLE'; isUsd = true; saldoInicialVal = 0; }
    else { metodo = key.toUpperCase(); isUsd = false; saldoInicialVal = 0; }
    return { metodo, key, isUsd, saldoInicialVal };
  });

  const rows = paymentMethods.map(pm => {
    const isUsd = pm.isUsd;
    const saldoInicial = pm.saldoInicialVal;
    const ventasMananaVal = ventasManana[pm.key] || { bs: 0, usd: 0 };
    const vueltosMananaVal = vueltosManana[pm.key] || 0;
    const ventasTardeVal = ventasTarde[pm.key] || { bs: 0, usd: 0 };
    const vueltosTardeVal = vueltosTarde[pm.key] || 0;
    const devolucionesVal = devoluciones[pm.key] || { bs: 0, usd: 0 };
    
    let totalVentasMoneda = isUsd ? (ventasMananaVal.usd + ventasTardeVal.usd) : (ventasMananaVal.bs + ventasTardeVal.bs);
    const totalVueltos = vueltosMananaVal + vueltosTardeVal;
    const totalDevolucionesMoneda = isUsd ? devolucionesVal.usd : devolucionesVal.bs;
    
    let sistemaMoneda = isUsd ? (saldoInicial + totalVentasMoneda - totalDevolucionesMoneda) : (saldoInicial + totalVentasMoneda - totalVueltos - totalDevolucionesMoneda);
    
    const fisico = conteoFisico[pm.key] ?? 0;
    const diff = fisico - sistemaMoneda;
    
    return { ...pm, saldoInicial, totalVentasMoneda, totalVueltos, totalDevolucionesMoneda, sistemaMoneda, fisico, diff };
  });

  const totalSistBs = rows.reduce((sum, r) => sum + (r.isUsd ? r.sistemaMoneda * tasaActual : r.sistemaMoneda), 0);
  const totalFisBs = rows.reduce((sum, r) => sum + (r.isUsd ? r.fisico * tasaActual : r.fisico), 0);
  const diffNeta = Math.round((totalFisBs - totalSistBs) * 100) / 100;

  const generarReporte = () => {
    const horaUltimaActualizacion = new Date().toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });
    return {
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tasaCierre: tasaActual,
      tasa1: morningRate || tasaActual,
      tasa2: eveningRate || tasaActual,
      horaApertura,
      horaUltimaActualizacion,
      apertura: { bs: aperturaBs, usd: aperturaUsd },
      recibos: receiptRange,
      productos: productStats,
      cuadre: rows.map(r => ({
        metodo: r.metodo,
        saldoInicial: r.saldoInicial,
        ventas: r.totalVentasMoneda,
        vueltos: r.totalVueltos,
        devoluciones: r.totalDevolucionesMoneda,
        sistema: r.sistemaMoneda,
        real: r.fisico,
        diferencia: r.diff,
        moneda: r.isUsd ? 'USD' : 'Bs',
      })),
      totales: { sistema: totalSistBs, real: totalFisBs, diferencia: diffNeta, estado: Math.abs(diffNeta) < 0.01 ? "CONCILIADO" : (diffNeta > 0 ? "SOBRANTE" : "FALTANTE") },
      usdEfectivo: totalCashUsd,
      totalCreditoBs,
      terminal: terminalName
    };
  };

  const handleConfirmCierre = () => {
    if (!isConciliado) return;
    const report = generarReporte();
    setCloseReportData(report);
    setShowResumenModal(true);
  };

  const finalizarCierre = async () => {
    if (!closeReportData) return;
    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      localStorage.setItem(`cierre_final_${timestamp}`, JSON.stringify(closeReportData));
      await syncService.saveCashClose({ id: `final_${timestamp}`, tipo: 'final', ...closeReportData });
      if (currentSession) await closeCashSession(totalCashUsd).catch(console.error);
      if (terminalId && terminalId !== 'default') await syncService.updateTerminalBlockStatus(terminalId, true);
      state.closeCashRegister();
      logout();
    } catch (error) {
      console.error("Error al finalizar cierre:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!closeReportData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generarHTMLResumen(closeReportData));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const generarHTMLResumen = (data: any) => {
    const diff = data.totales.diferencia;
    const estadoColor = diff > 0 ? '#10b981' : (diff < 0 ? '#ef4444' : '#3b82f6');
    return `<!DOCTYPE html>
      <html>
      <head><title>Cierre Final - ${data.terminal}</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 20px; font-size: 11px; color: #000; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { border: 1px solid #000; padding: 4px; text-align: left; }
        th { background: #eee; font-weight: bold; }
        .right { text-align: right; }
        .best-product { background-color: #ffffd0; font-weight: bold; }
        h1, h2, h3 { margin: 5px 0; }
      </style>
      </head>
      <body>
      <div class="center">
        <h2>MASTERPOS - REPORTE DE CIERRE</h2>
        <p>TERMINAL: ${data.terminal} | ${data.fechaCierre}</p>
        <p>RANGO RECIBOS: #${data.recibos.first} AL #${data.recibos.last}</p>
      </div>
      <div class="line"></div>
      <p>Apertura: ${data.horaApertura} | Tasa 1: ${formatBsNumber(data.tasa1)}</p>
      <p>Cierre: ${data.horaUltimaActualizacion} | Tasa 2: ${formatBsNumber(data.tasa2)}</p>
      <p>Fondo Inicial: ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)}</p>
      <div class="line"></div>
      <div class="center">
        <h1 style="color: ${estadoColor}; font-size: 24px;">${data.totales.estado}</h1>
        <h1 style="font-size: 32px;">${diff > 0 ? '+' : ''}${formatBsNumber(Math.abs(diff))}</h1>
      </div>
      <div class="line"></div>
      <h3>DETALLE DE PRODUCTOS VENDIDOS</h3>
      <p>Total artículos: <strong>${data.productos.total}</strong></p>
      <table>
        <thead><tr><th>PRODUCTO</th><th class="right">CANT.</th></tr></thead>
        <tbody>
          ${data.productos.items.map((it: any) => `
            <tr class="${it.name === data.productos.best?.name ? 'best-product' : ''}">
              <td>${it.name.toUpperCase()} ${it.name === data.productos.best?.name ? '⭐' : ''}</td>
              <td class="right">${it.qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <h3>CUADRE DE CAJA</h3>
      <table>
        <thead><tr><th>METODO</th><th class="right">SISTEMA</th><th class="right">REAL</th><th class="right">DIFF</th></tr></thead>
        <tbody>
          ${data.cuadre.map((r: any) => `
            <tr>
              <td>${r.metodo}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsdNumber(r.sistema) : formatBsNumber(r.sistema)}</td>
              <td class="right">${r.moneda === 'USD' ? formatUsdNumber(r.real) : formatBsNumber(r.real)}</td>
              <td class="right">${r.diferencia === 0 ? '✓' : formatBsNumber(r.diferencia)}</td>
            </tr>
          `).join('')}
          <tr style="background:#f0f0f0;font-weight:bold;"><td>VENTAS CREDITO</td><td class="right">${formatBsNumber(data.totalCreditoBs)}</td><td class="right">—</td><td class="right">—</td></tr>
        </tbody>
      </table>
      <div class="line"></div>
      <p class="center">Generado por MasterPOS v1.0</p>
      </body>
      </html>`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-6xl rounded-xl shadow-2xl flex flex-col max-h-[98vh] overflow-hidden">
        <div className="bg-[#1E3A8A] text-white p-3 border-b-4 border-[#0284C7] sticky top-0 z-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 text-slate-900 px-3 py-1 rounded font-black text-sm">{terminalName}</div>
            <h1 className="font-black uppercase text-base tracking-widest">ARQUEO Y CIERRE FINAL JORNADA</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold">Rango: #{receiptRange.first} al #{receiptRange.last}</p>
            <p className="text-[10px] font-bold">Tasa Cierre: {formatBs(tasaActual)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-2 text-left">MÉTODO</th>
                    <th className="p-2 text-center">FONDO INICIAL</th>
                    <th className="p-2 text-center">VENTAS</th>
                    <th className="p-2 text-center">DEVOLUCIONES</th>
                    <th className="p-2 text-center">SISTEMA</th>
                    <th className="p-2 text-center">FÍSICO</th>
                    <th className="p-2 text-center">DIF.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map(r => (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <td className="p-2 font-bold">{r.metodo}</td>
                      <td className="p-2 text-center font-mono">{renderCurrencyCell(r.saldoInicial, r.isUsd, tasaActual)}</td>
                      <td className="p-2 text-center font-mono">{renderCurrencyCell(r.totalVentasMoneda, r.isUsd, tasaActual)}</td>
                      <td className="p-2 text-center font-mono text-red-600">{renderCurrencyCell(r.totalDevolucionesMoneda, r.isUsd, tasaActual)}</td>
                      <td className="p-2 text-center font-bold font-mono">{renderCurrencyCell(r.sistemaMoneda, r.isUsd, tasaActual)}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Input 
                            type="number" step="0.01" 
                            value={conteoFisico[r.key] === 0 ? '' : (conteoFisico[r.key] || '')} 
                            onChange={e => setConteoFisico({...conteoFisico, [r.key]: parseFloat(e.target.value) || 0})}
                            className="w-20 h-7 text-xs text-center font-bold bg-white" placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className={cn("p-2 text-center font-bold", r.diff < -0.01 ? "text-red-600" : r.diff > 0.01 ? "text-emerald-600" : "text-slate-400")}>
                        {Math.abs(r.diff) < 0.01 ? '✓' : (r.isUsd ? formatUsd(Math.abs(r.diff)) : formatBsNumber(Math.abs(r.diff)))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/50 font-bold">
                    <td className="p-2 text-blue-700">VENTAS A CRÉDITO</td>
                    <td colSpan={5} className="p-2 text-right">Monto total por cobrar:</td>
                    <td className="p-2 text-center text-blue-700">{formatBs(totalCreditoBs)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
              <div>
                <p className="text-[10px] font-black text-white/40 uppercase">Efectivo USD en Caja</p>
                <p className="text-2xl font-black text-amber-400">{formatUsd(totalCashUsd)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-white/40 uppercase">Resultado Global (Bs)</p>
                <p className={cn("text-3xl font-black", diffNeta < -0.01 ? "text-red-400" : diffNeta > 0.01 ? "text-emerald-400" : "text-blue-400")}>
                  {Math.abs(diffNeta) < 0.01 ? '0,00' : (diffNeta > 0 ? '+' : '') + formatBsNumber(Math.abs(diffNeta))}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full md:w-72 flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex-1 flex flex-col overflow-hidden">
              <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-2 border-b pb-1">
                <ShoppingBasket size={14} className="text-blue-600" /> Productos del día
              </h3>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {productStats.items.map((it, idx) => (
                  <div key={idx} className={cn(
                    "flex justify-between items-center py-1.5 px-2 rounded mb-1 border",
                    idx === 0 ? "bg-amber-50 border-amber-200" : "bg-white border-transparent"
                  )}>
                    <div className="min-w-0">
                      <p className={cn("text-[10px] truncate uppercase", idx === 0 ? "font-black text-amber-900" : "font-bold text-slate-700")}>
                        {it.name} {idx === 0 && '⭐'}
                      </p>
                      {idx === 0 && <p className="text-[8px] text-amber-600 font-bold">¡EL MÁS VENDIDO!</p>}
                    </div>
                    <span className={cn("text-xs font-black", idx === 0 ? "text-amber-700" : "text-blue-600")}>{it.qty}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t text-center bg-slate-50 rounded py-1">
                <p className="text-[10px] font-bold text-slate-500">TOTAL UNIDADES: <span className="text-slate-900">{productStats.total}</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 border-t flex justify-between items-center flex-wrap gap-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input type="checkbox" checked={isConciliado} onChange={e => setIsConciliado(e.target.checked)} className="peer sr-only" />
              <div className="w-5 h-5 border-2 border-slate-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                <X size={12} className={cn("text-white transition-opacity", isConciliado ? "opacity-100" : "opacity-0")} />
              </div>
            </div>
            <span className="text-[10px] font-black uppercase text-slate-600 group-hover:text-blue-700 transition-colors">Confirmo el arqueo físico y el rango de recibos de hoy</span>
          </label>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="ghost" className="text-red-600 font-bold text-xs h-9 px-6 border border-red-100 hover:bg-red-50">Cancelar</Button>
            <Button disabled={!isConciliado || isSubmitting} onClick={handleConfirmCierre} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 px-8 shadow-md">CONFIRMAR CIERRE FINAL</Button>
          </div>
        </div>
      </div>

      {showResumenModal && closeReportData && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="bg-[#1E3A8A] text-white p-6 text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/20">
                <TrendingUp size={32} className="text-amber-400" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">RESUMEN DE JORNADA</h2>
              <p className="text-blue-200 text-sm mt-1 uppercase font-bold tracking-widest">{closeReportData.terminal}</p>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Artículos Vendidos</p>
                  <p className="text-2xl font-black text-slate-900">{closeReportData.productos.total}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Recibos Emitidos</p>
                  <p className="text-lg font-black text-slate-900">#{closeReportData.recibos.last}</p>
                </div>
              </div>

              {closeReportData.productos.best && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-200 rounded-xl flex items-center justify-center shrink-0">
                    <ShoppingBasket size={24} className="text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-amber-600 uppercase">Producto más vendido</p>
                    <p className="text-base font-black text-amber-900 truncate uppercase">{closeReportData.productos.best.name}</p>
                    <p className="text-xs font-bold text-amber-700">{closeReportData.productos.best.qty} unidades</p>
                  </div>
                </div>
              )}

              <div className="text-center py-6 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BarChart3 size={100} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-white/50">Diferencia de Arqueo</p>
                <p className={cn("text-5xl font-black mt-2", closeReportData.totales.diferencia > 0.01 ? "text-emerald-400" : closeReportData.totales.diferencia < -0.01 ? "text-red-400" : "text-blue-400")}>
                  {Math.abs(closeReportData.totales.diferencia) < 0.01 ? '0,00' : (closeReportData.totales.diferencia > 0 ? '+' : '') + formatBsNumber(Math.abs(closeReportData.totales.diferencia))}
                </p>
                <p className={cn("text-sm font-black mt-2 uppercase tracking-tighter", closeReportData.totales.diferencia > 0.01 ? "text-emerald-400" : closeReportData.totales.diferencia < -0.01 ? "text-red-400" : "text-blue-400")}>
                  {closeReportData.totales.estado}
                </p>
              </div>

              <div className="flex gap-3">
                <Button onClick={handlePrint} className="flex-1 bg-slate-800 hover:bg-black text-white font-black h-11"><Printer size={18} className="mr-2" /> PDF / IMPRIMIR</Button>
                <Button onClick={generarReporte} variant="outline" className="flex-1 border-slate-300 font-bold h-11"><Share2 size={18} className="mr-2" /> COMPARTIR</Button>
              </div>
              
              <Button 
                onClick={finalizarCierre} 
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-lg font-black rounded-2xl shadow-lg shadow-emerald-100"
              >
                {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : 'FINALIZAR Y BLOQUEAR'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
