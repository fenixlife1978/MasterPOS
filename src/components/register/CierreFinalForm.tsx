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
        let methodDetected = null;
        let amountBs = 0;
        let amountUsd = 0;

        // 1) Intentar desde payments
        if (tx.payments && Array.isArray(tx.payments) && tx.payments.length > 0) {
          for (const payment of tx.payments) {
            const method = payment.method;
            if (method) {
              methodDetected = method;
              if (method === 'usd_efectivo' || method === 'zelle') {
                amountUsd += payment.usdAmount !== undefined ? payment.usdAmount : (payment.amount || 0);
              } else {
                amountBs += payment.amount || 0;
              }
            }
          }
        }
        
        // 2) Si no hay payments, usar payMethod
        if (!methodDetected && tx.payMethod) {
          methodDetected = tx.payMethod;
          if (methodDetected === 'usd_efectivo' || methodDetected === 'zelle') {
            amountUsd = tx.totalUsd || 0;
          } else {
            amountBs = tx.total || 0;
          }
        }
        
        // 3) Si aún no hay método, inferir por moneda
        if (!methodDetected) {
          if (tx.totalUsd && tx.totalUsd > 0) {
            methodDetected = 'usd_efectivo';
            amountUsd = tx.totalUsd;
          } else if (tx.total && tx.total > 0) {
            methodDetected = 'efectivo_bs';
            amountBs = tx.total;
          }
        }

        // 4) Último recurso: efectivo_bs
        if (!methodDetected) {
          methodDetected = 'efectivo_bs';
          amountBs = tx.total || 0;
        }

        // ✅ Asegurar que el método existe en devolucionesTotales (crear si no existe)
        if (!devolucionesTotales[methodDetected]) {
          devolucionesTotales[methodDetected] = { bs: 0, usd: 0 };
          // También extender ventasAM y ventasPM para que aparezcan en la tabla
          if (!ventasAM[methodDetected]) ventasAM[methodDetected] = { bs: 0, usd: 0 };
          if (!ventasPM[methodDetected]) ventasPM[methodDetected] = { bs: 0, usd: 0 };
          if (vueltosAM[methodDetected] === undefined) vueltosAM[methodDetected] = 0;
          if (vueltosPM[methodDetected] === undefined) vueltosPM[methodDetected] = 0;
        }

        // Sumar al método detectado
        if (methodDetected === 'usd_efectivo' || methodDetected === 'zelle') {
          devolucionesTotales[methodDetected].usd += amountUsd;
        } else {
          devolucionesTotales[methodDetected].bs += amountBs;
        }

        console.log(`[CIERRE] Devolución detectada: método=${methodDetected}, Bs=${amountBs}, USD=${amountUsd}`);
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
            if (isMorning) {
              ventasAM[method].usd += usdAmount;
            } else {
              ventasPM[method].usd += usdAmount;
            }
          } else {
            const bsAmount = payment.amount || 0;
            if (isMorning) {
              ventasAM[method].bs += bsAmount;
            } else {
              ventasPM[method].bs += bsAmount;
            }
          }
        }
      } else {
        const method = tx.payMethod || 'efectivo_bs';
        const isUsd = method === 'usd_efectivo' || method === 'zelle';
        if (isUsd) {
          const usdAmount = tx.totalUsd || 0;
          if (isMorning) {
            ventasAM[method].usd += usdAmount;
          } else {
            ventasPM[method].usd += usdAmount;
          }
        } else {
          const bsAmount = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
          if (isMorning) {
            ventasAM[method].bs += bsAmount;
          } else {
            ventasPM[method].bs += bsAmount;
          }
        }
      }

      const change = tx.change || 0;
      if (change > 0) {
        if (isMorning) {
          vueltosAM['efectivo_bs'] += change;
        } else {
          vueltosPM['efectivo_bs'] += change;
        }
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
        const txDateStr = formatter.format(txDate);
        if (txDateStr !== todayVzla) return;
        if (t.type !== 'contado') return;
        if (t.payments) {
          t.payments.forEach((p: any) => {
            if (p.method === 'usd_efectivo') {
              total += p.usdAmount !== undefined ? p.usdAmount : (p.amount || 0);
            }
          });
        } else if (t.payMethod === 'usd_efectivo') {
          total += t.totalUsd || 0;
        }
      });
    }
    return total;
  }, [reg, aperturaUsd]);

  // Generar dinámicamente la lista de métodos a partir de las devoluciones y ventas
  const allMethodsSet = new Set<string>();
  Object.keys(devoluciones).forEach(m => allMethodsSet.add(m));
  Object.keys(ventasManana).forEach(m => allMethodsSet.add(m));
  Object.keys(ventasTarde).forEach(m => allMethodsSet.add(m));
  // Métodos fijos base
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
    else { 
      metodo = key.toUpperCase(); 
      isUsd = false; 
      saldoInicialVal = 0; 
    }
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
    
    let totalVentasMoneda: number;
    if (isUsd) {
      totalVentasMoneda = (ventasMananaVal.usd || 0) + (ventasTardeVal.usd || 0);
    } else {
      totalVentasMoneda = (ventasMananaVal.bs || 0) + (ventasTardeVal.bs || 0);
    }
    const totalVueltos = vueltosMananaVal + vueltosTardeVal;
    const totalDevolucionesMoneda = isUsd ? (devolucionesVal.usd || 0) : (devolucionesVal.bs || 0);
    
    let sistemaMoneda: number;
    if (isUsd) {
      sistemaMoneda = saldoInicial + totalVentasMoneda - totalDevolucionesMoneda;
    } else {
      sistemaMoneda = saldoInicial + totalVentasMoneda - totalVueltos - totalDevolucionesMoneda;
    }
    
    const fisicoIngresado = conteoFisico[pm.key] ?? 0;
    const fisico = fisicoIngresado;
    const diff = fisico - sistemaMoneda;
    
    return {
      ...pm,
      saldoInicial,
      totalVentasMoneda,
      totalVueltos,
      totalDevolucionesMoneda,
      sistemaMoneda,
      fisicoIngresado,
      fisico,
      diff,
    };
  });

  const tasaManana = morningRate || tasaActual;
  const tasaTarde = eveningRate || tasaActual;
  const tasaCierre = tasaActual;
  const horaUltimaActualizacion = eveningFirstTxTime ? getVenezuelaTimeString(eveningFirstTxTime) : horaApertura;
  
  const totalSistBs = rows.reduce((sum, r) => {
    if (r.isUsd) {
      return sum + (r.sistemaMoneda * tasaCierre);
    } else {
      return sum + r.sistemaMoneda;
    }
  }, 0);
  
  const totalFisBs = rows.reduce((sum, r) => {
    if (r.isUsd) {
      return sum + (r.fisico * tasaCierre);
    } else {
      return sum + r.fisico;
    }
  }, 0);
  const diffNeta = Math.round((totalFisBs - totalSistBs) * 100) / 100;

  const generarReporte = () => {
    const report = {
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tasaCierre,
      tasa1: tasaManana,
      tasa2: tasaTarde,
      horaApertura,
      horaUltimaActualizacion,
      apertura: { bs: aperturaBs, usd: aperturaUsd },
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
        const pendingKardex = state.getPendingKardexEntries();
        if (pendingKardex && pendingKardex.length > 0) {
          await syncService.saveKardexBatch(pendingKardex);
        }
        const pendingAccounting = state.getPendingAccountingEntries();
        if (pendingAccounting && pendingAccounting.length > 0) {
          await syncService.saveAccountingBatch(pendingAccounting);
        }
        state.clearPendingEntries();

        const timestamp = Date.now();
        localStorage.setItem(`cierre_final_${timestamp}`, JSON.stringify(closeReportData));
        await syncService.saveCashClose({ id: `final_${timestamp}`, tipo: 'final', ...closeReportData });
        
        if (currentSession) await closeCashSession(totalCashUsd).catch(console.error);
        
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith('corte_parcial_')) localStorage.removeItem(key);
        }

        try {
          if (terminalId && terminalId !== 'default') {
            await syncService.updateTerminalBlockStatus(terminalId, true);
          }
        } catch (permError) {
          console.error("No se pudo actualizar el bloqueo de terminal:", permError);
        }

        state.closeCashRegister();
        logout();

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
    const creditoBs = data.totalCreditoBs || 0;
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
        .small { font-size: 9px; color: #666; }
      </style>
      </head>
      <body>
      <div class="center">
        <h1>MASTERPOS - CIERRE DE JORNADA</h1>
        <p>${data.fechaCierre}</p>
        <p>Apertura: ${data.horaApertura} | Tasa 1: ${formatBs(data.tasa1)} &nbsp;&nbsp; Última tasa: ${data.horaUltimaActualizacion} | Tasa 2: ${formatBs(data.tasa2)}</p>
      </div>
      <div class="line"></div>
      <p><strong>Apertura:</strong> ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)} (≈ ${formatBs(data.apertura.usd * data.tasaCierre)})</p>
      <p><strong>Tasa aplicada al cierre:</strong> ${formatBs(data.tasaCierre)}</p>
      <p><strong>USD en Caja:</strong> ${formatUsd(data.usdEfectivo)} (≈ ${formatBs(data.usdEfectivo * data.tasaCierre)})</p>
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
            <th>Ventas</th>
            <th>Vueltos</th>
            <th>Devoluciones</th>
            <th>Sistema</th>
            <th>Real</th>
            <th>Diferencia</th>
          </tr>
        </thead>
        <tbody>
          ${data.cuadre.map((r: any) => {
            const fondoInicial = r.moneda === 'USD' ? formatUsd(r.saldoInicial) + `<br><span class="small">${formatBs(r.saldoInicial * data.tasaCierre)}</span>` : formatBs(r.saldoInicial);
            const ventas = r.moneda === 'USD' ? formatUsd(r.ventas) + `<br><span class="small">${formatBs(r.ventas * data.tasaCierre)}</span>` : formatBs(r.ventas);
            const vueltos = formatBs(r.vueltos);
            const devoluciones = r.moneda === 'USD' ? formatUsd(r.devoluciones) + `<br><span class="small">${formatBs(r.devoluciones * data.tasaCierre)}</span>` : formatBs(r.devoluciones);
            const sistema = r.moneda === 'USD' ? formatUsd(r.sistema) + `<br><span class="small">${formatBs(r.sistema * data.tasaCierre)}</span>` : formatBs(r.sistema);
            const real = r.moneda === 'USD' ? formatUsd(r.real) + `<br><span class="small">${formatBs(r.real * data.tasaCierre)}</span>` : formatBs(r.real);
            let diffDisplay = r.diferencia === 0 ? '✓' : (r.moneda === 'USD' ? formatUsd(r.diferencia) : formatBs(r.diferencia));
            if (r.moneda === 'USD' && r.diferencia !== 0) {
              const diffBs = r.diferencia * data.tasaCierre;
              diffDisplay += `<br><span class="small">${formatBs(diffBs)}</span>`;
            }
            return `
              <tr>
                <td>${r.metodo}</td>
                <td class="right">${fondoInicial}</td>
                <td class="right">${ventas}</td>
                <td class="right">${vueltos}</td>
                <td class="right">${devoluciones}</td>
                <td class="right">${sistema}</td>
                <td class="right">${real}</td>
                <td class="right">${diffDisplay}</td>
              </tr>
            `;
          }).join('')}
          <tr style="background-color: #e6f0ff; font-weight: bold;">
            <td>VENTAS A CRÉDITO</td>
            <td class="right">—</td>
            <td class="right">${formatBs(creditoBs)}</td>
            <td class="right">—</td>
            <td class="right">—</td>
            <td class="right">—</td>
            <td class="right">—</td>
            <td class="right">—</td>
          </tr>
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
    return `MASTERPOS - Cierre de Jornada\nFecha: ${data.fechaCierre}\nApertura: ${data.horaApertura} Tasa1: ${formatBs(data.tasa1)}\nÚltima tasa: ${data.horaUltimaActualizacion} Tasa2: ${formatBs(data.tasa2)}\nApertura: ${formatBs(data.apertura.bs)} + ${formatUsd(data.apertura.usd)}\nUSD Efectivo: ${formatUsd(data.usdEfectivo)}\nVentas a Crédito: ${formatBs(data.totalCreditoBs)}\nRESULTADO: ${estado} por ${formatBs(Math.abs(diff))}`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
        <div className="bg-[#F9F4E1] w-full max-w-full overflow-x-auto rounded-xl shadow-2xl flex flex-col max-h-[98vh]">
          <div className="bg-[#1E3A8A] text-white p-3 border-b-4 border-[#0284C7] sticky left-0 flex justify-between items-center">
            <div className="text-left">
              <div className="text-[10px] font-bold">Hora apertura: {horaApertura}</div>
              <div className="text-[10px] font-bold">Tasa 1: {formatBs(tasaManana)}</div>
            </div>
            <h1 className="text-center font-black uppercase text-base">CIERRE FINAL CONSOLIDADO</h1>
            <div className="text-right">
              <div className="text-[10px] font-bold">Última actualización: {horaUltimaActualizacion}</div>
              <div className="text-[10px] font-bold">Tasa 2: {formatBs(tasaTarde)}</div>
            </div>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full text-[10px] min-w-[900px]">
              <thead className="bg-[#2c3e50] text-white sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left">MÉTODO</th>
                  <th className="p-2 text-center">FONDO INICIAL</th>
                  <th className="p-2 text-center">VENTAS</th>
                  <th className="p-2 text-center">VUELTOS</th>
                  <th className="p-2 text-center">DEVOLUCIONES</th>
                  <th className="p-2 text-center">SISTEMA</th>
                  <th className="p-2 text-center">EFECTIVO USD</th>
                  <th className="p-2 text-center">FÍSICO</th>
                  <th className="p-2 text-center">DIF.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(r => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <td className="p-2 font-bold">{r.metodo}</td>
                    <td className="p-2 text-center font-mono">
                      {renderCurrencyCell(r.saldoInicial, r.isUsd, tasaCierre, true)}
                    </td>
                    <td className="p-2 text-center font-mono">
                      {renderCurrencyCell(r.totalVentasMoneda, r.isUsd, tasaCierre, true)}
                    </td>
                    <td className="p-2 text-center font-mono text-red-600">{formatBs(r.totalVueltos)}</td>
                    <td className="p-2 text-center font-mono text-red-600">
                      {renderCurrencyCell(r.totalDevolucionesMoneda, r.isUsd, tasaCierre, true)}
                    </td>
                    <td className="p-2 text-center font-bold font-mono">
                      {renderCurrencyCell(r.sistemaMoneda, r.isUsd, tasaCierre, true)}
                    </td>
                    <td className="p-2 text-center font-mono text-blue-600">
                      {r.key === 'usd_efectivo' ? renderCurrencyCell(totalCashUsd, true, tasaCierre, true) : '—'}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex flex-col items-center gap-1">
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
                      </div>
                    </td>
                    <td className={cn("p-2 text-center font-bold", r.diff < 0 ? "text-red-600" : r.diff > 0 ? "text-emerald-600" : "text-slate-500")}>
                      {r.diff === 0 ? '✓' : (r.isUsd ? formatUsd(Math.abs(r.diff)) : formatBsNumber(Math.abs(r.diff)))}
                      {r.isUsd && r.diff !== 0 && (
                        <div className="text-[8px] text-slate-500 mt-0.5">≈ {formatBs(Math.abs(r.diff) * tasaCierre)}</div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50 font-bold">
                  <td className="p-2 font-bold text-blue-700">VENTAS A CRÉDITO</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center font-mono font-bold text-blue-700">{formatBs(totalCreditoBs)}</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                </tr>
                <tr className="bg-[#1E3A8A] text-white font-bold">
                  <td colSpan={5} className="p-2 text-right">TOTAL CONSOLIDADO (Bs):</td>
                  <td className="p-2 text-center font-bold">{formatBs(totalSistBs)}</td>
                  <td className="p-2 text-center font-bold">{renderCurrencyCell(totalCashUsd, true, tasaCierre, true)}</td>
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
              <div className="text-center">
                <p className="text-sm text-gray-500">Fecha y hora</p>
                <p className="font-mono">{closeReportData.fechaCierre}</p>
                <div className="flex justify-between mt-2 text-xs">
                  <span>Apertura: {closeReportData.horaApertura} | Tasa1: {formatBs(closeReportData.tasa1)}</span>
                  <span>Última actualización: {closeReportData.horaUltimaActualizacion} | Tasa2: {formatBs(closeReportData.tasa2)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div><p className="text-xs text-gray-500">Apertura</p><p className="font-bold">{formatBs(closeReportData.apertura.bs)}</p><p className="font-bold">{formatUsd(closeReportData.apertura.usd)} <span className="text-xs text-gray-500">({formatBs(closeReportData.apertura.usd * closeReportData.tasaCierre)})</span></p></div>
                <div><p className="text-xs text-gray-500">USD Efectivo</p><p className="font-bold">{formatUsd(closeReportData.usdEfectivo)} <span className="text-xs text-gray-500">({formatBs(closeReportData.usdEfectivo * closeReportData.tasaCierre)})</span></p></div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                <p className="text-[9px] font-black uppercase text-blue-700">Ventas a Crédito del día</p>
                <p className="text-xl font-black text-blue-700">{formatBs(closeReportData.totalCreditoBs)}</p>
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
                  {isSubmitting ? 'CERRANDO...' : 'FINALIZAR Y BLOQUEAR ESTACIÓN'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}