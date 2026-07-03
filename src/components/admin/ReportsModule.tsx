"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useAccounting } from '@/hooks/use-accounting';
import { Calendar, FileText, FileSpreadsheet, Search, TrendingUp, TrendingDown, BarChart3, DollarSign, Printer, Share2, Download, Monitor, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import { getStartOfDay, getEndOfDay, formatLocalDate } from '@/lib/date-utils';
import syncService from '@/services/syncService';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

// ✅ Importar Firebase para reconciliación
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ReportsModuleProps {
  state: ReturnType<typeof usePOSState>;
  userRole?: string;
}

export default function ReportsModule({ state, userRole = 'cashier' }: ReportsModuleProps) {
  const { entries } = useAccounting();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeReport, setActiveReport] = useState<'transactions' | 'summary' | 'consolidated'>('transactions');
  
  const [terminals, setTerminals] = useState<{ id: string; name: string }[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('all');
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // ✅ Estados para reconciliación unificada
  const [unifiedEntries, setUnifiedEntries] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const reportContentRef = useRef<HTMLDivElement>(null);

  // ✅ FUNCIÓN DE RECONCILIACIÓN (Identica a AccountingModule para consistencia total)
  const loadUnifiedData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Obtener asientos de Firestore
      const q = query(collection(db, 'accounting_entries'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const firestoreEntries = snapshot.docs.map(doc => {
        const data = doc.data();
        const dateVal = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        return {
          id: doc.id,
          ...data,
          date: dateVal,
          amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
          totalUsd: data.totalUsd || (data.amount / (data.exchangeRate || state.exchangeRate))
        };
      });

      // 2. Obtener transacciones de RTDB
      const rtdbTransactions = await syncService.getAllTransactions();

      // 3. Normalizar transacciones faltantes
      const missingTransactions = rtdbTransactions
        .filter(tx => {
          const isValidType = ['contado', 'credito', 'cobro_deuda', 'devolucion', 'colaboracion', 'consumo_propio'].includes(tx.type);
          if (!isValidType) return false;
          // Evitar duplicados
          const alreadyInFirestore = firestoreEntries.some(e => String(e.referenceId) === String(tx.id));
          return !alreadyInFirestore;
        })
        .map(tx => {
          const isExpense = tx.type === 'devolucion' || tx.type === 'colaboracion' || tx.type === 'consumo_propio';
          const rate = tx.exchangeRate || state.exchangeRate;
          return {
            id: `tx_${tx.id}`,
            referenceId: tx.id,
            date: new Date(tx.date),
            type: isExpense ? 'egreso' : 'ingreso',
            category: tx.type,
            concept: tx.type === 'devolucion' ? 'DEVOLUCIÓN DE VENTA' : 
                     tx.type === 'cobro_deuda' ? 'COBRO DE DEUDA' : 
                     tx.type === 'credito' ? 'VENTA A CRÉDITO' : 'VENTA',
            amount: tx.total || 0,
            totalUsd: tx.totalUsd || (tx.total / rate),
            exchangeRate: rate
          };
        });

      setUnifiedEntries([...firestoreEntries, ...missingTransactions]);
    } catch (error) {
      console.error('Error reconciliando reportes:', error);
      // Fallback a entries del hook si falla
      setUnifiedEntries(entries);
    } finally {
      setIsSyncing(false);
    }
  }, [entries, state.exchangeRate]);

  useEffect(() => {
    loadUnifiedData();
  }, [loadUnifiedData]);

  // ✅ Cargar terminales desde FIREBASE
  useEffect(() => {
    const loadTerminals = async () => {
      setIsLoadingTerminals(true);
      setLoadError(null);
      try {
        const terminalsData = await syncService.getAllTerminals();
        if (terminalsData && terminalsData.length > 0) {
          setTerminals(terminalsData.map((t: any) => ({ id: t.name || t.id, name: t.name || t.id })));
        } else {
          setLoadError('No se encontraron terminales registradas.');
          setTerminals([]);
        }
      } catch (error) {
        console.error('Error al cargar terminales:', error);
        setLoadError('Error al cargar las terminales. Verifique su conexión.');
        setTerminals([]);
      } finally {
        setIsLoadingTerminals(false);
      }
    };
    loadTerminals();
  }, []);

  const handleSearch = () => {
    if (!startDate || !endDate) {
      alert('Seleccione ambas fechas');
      return;
    }
    
    const startLimit = getStartOfDay(startDate);
    const endLimit = getEndOfDay(endDate);
    
    let filtered = state.transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startLimit && txDate <= endLimit;
    });
    
    if (selectedTerminalId !== 'all') {
      filtered = filtered.filter(t => {
        if (t.terminalId) return t.terminalId === selectedTerminalId;
        if (t.sessionId) {
          const parts = t.sessionId.split('_');
          const terminalFromSession = parts[0];
          return terminalFromSession === selectedTerminalId;
        }
        return false;
      });
    }
    
    setFilteredTransactions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHasSearched(true);
  };

  // ✅ CONSOLIDADO MENSUAL UTILIZANDO FUENTE UNIFICADA
  const monthlyConsolidated = useMemo(() => {
    const consolidated: Record<string, { label: string, year: number, monthIdx: number, income: number, expense: number }> = {};
    
    unifiedEntries.forEach(entry => {
      const d = new Date(entry.date);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx).padStart(2, '0')}`;
      
      if (!consolidated[key]) {
        const monthName = d.toLocaleDateString('es-VE', { month: 'long' });
        consolidated[key] = { 
          label: monthName.toUpperCase(), 
          year, 
          monthIdx,
          income: 0, 
          expense: 0 
        };
      }
      
      if (entry.type === 'ingreso') {
        consolidated[key].income += entry.amount;
      } else {
        consolidated[key].expense += entry.amount;
      }
    });
    
    return Object.values(consolidated).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.monthIdx - a.monthIdx;
    });
  }, [unifiedEntries, state.exchangeRate]);

  const totalGeneral = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  const contadoTotal = filteredTransactions.filter(t => t.type === 'contado').reduce((sum, t) => sum + t.total, 0);
  const creditoTotal = filteredTransactions.filter(t => t.type === 'credito').reduce((sum, t) => sum + t.total, 0);
  const cobroTotal = filteredTransactions.filter(t => t.type === 'cobro_deuda').reduce((sum, t) => sum + t.total, 0);
  const colaboracionTotal = filteredTransactions.filter(t => t.type === 'colaboracion' || t.type === 'consumo_propio').reduce((sum, t) => sum + (t.costoTotalOperacion || 0), 0);
  const costoTotalOperacion = filteredTransactions.reduce((sum, t) => sum + (t.costoTotalOperacion || 0), 0);

  const generateReportHTML = () => {
    const title = activeReport === 'transactions' ? 'Reporte de Transacciones' : activeReport === 'summary' ? 'Resumen de Ventas' : 'Consolidado de Ingresos/Egresos';
    const dateRange = hasSearched ? `Desde ${formatLocalDate(startDate)} hasta ${formatLocalDate(endDate)}` : 'Período histórico';
    const terminalText = selectedTerminalId !== 'all' ? ` | Terminal: ${selectedTerminalId}` : ' | Todas las terminales';
    const companyName = 'MASTERPOS - LICORERÍA CASTILLO';
    
    let content = '';
    
    if (activeReport === 'transactions' && hasSearched) {
      content = `
        <table class="report-table">
          <thead>
            <tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Terminal</th><th class="text-right">Total (Bs)</th></tr>
          </thead>
          <tbody>
            ${filteredTransactions.map(t => {
              let terminalDisplay = t.terminalId || (t.sessionId ? t.sessionId.split('_').shift() : '—');
              return `
              <tr>
                <td>${formatLocalDate(t.date)}</td>
                <td><span class="badge">${t.type.toUpperCase()}</span></td>
                <td>${t.clientName || '—'}</td>
                <td>${terminalDisplay}</td>
                <td class="text-right">${formatBs(t.total)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr><td colspan="4" class="text-right"><strong>Total General</strong></td><td class="text-right"><strong>${formatBs(totalGeneral)}</strong></td></tfoot>
        </table>
      `;
    } else if (activeReport === 'summary' && hasSearched) {
      content = `
        <div class="summary-grid">
          <div class="summary-card">
            <div class="card-title">Total General</div>
            <div class="card-value text-primary">${formatUsd(totalGeneral / state.exchangeRate)}</div>
            <div class="card-subtitle"><strong>${formatBs(totalGeneral)}</strong></div>
          </div>
          <div class="summary-card">
            <div class="card-title">Ventas Contado</div>
            <div class="card-value text-green">${formatUsd(contadoTotal / state.exchangeRate)}</div>
            <div class="card-subtitle"><strong>${formatBs(contadoTotal)}</strong></div>
          </div>
          <div class="summary-card">
            <div class="card-title">Ventas Crédito</div>
            <div class="card-value text-orange">${formatUsd(creditoTotal / state.exchangeRate)}</div>
            <div class="card-subtitle"><strong>${formatBs(creditoTotal)}</strong></div>
          </div>
          <div class="summary-card">
            <div class="card-title">Cobros de Deuda</div>
            <div class="card-value text-purple">${formatUsd(cobroTotal / state.exchangeRate)}</div>
            <div class="card-subtitle"><strong>${formatBs(cobroTotal)}</strong></div>
          </div>
          <div class="summary-card">
            <div class="card-title">Colaboraciones/Consumo (Costo)</div>
            <div class="card-value text-red">${formatUsd(colaboracionTotal / state.exchangeRate)}</div>
            <div class="card-subtitle"><strong>${formatBs(colaboracionTotal)}</strong></div>
          </div>
          <div class="summary-card">
            <div class="card-title">Costo de Operación</div>
            <div class="card-value">${formatUsd(costoTotalOperacion / state.exchangeRate)}</div>
            <div class="card-subtitle"><strong>${formatBs(costoTotalOperacion)}</strong></div>
          </div>
        </div>
      `;
    } else if (activeReport === 'consolidated') {
      content = `
        <table class="report-table">
          <thead><tr><th>Mes</th><th class="text-right">Ingresos ($)</th><th class="text-right">Egresos ($)</th><th class="text-right">Balance ($)</th></td></thead>
          <tbody>
            ${monthlyConsolidated.map(row => {
              const balance = row.income - row.expense;
              return `
              <tr>
                <td>${row.label} ${row.year}</td>
                <td class="text-right text-green">
                  <div>${formatUsd(row.income / state.exchangeRate)}</div>
                  <div class="small"><strong>${formatBs(row.income)}</strong></div>
                </td>
                <td class="text-right text-red">
                  <div>${formatUsd(row.expense / state.exchangeRate)}</div>
                  <div class="small"><strong>${formatBs(row.expense)}</strong></div>
                </td>
                <td class="text-right ${balance >= 0 ? 'text-green' : 'text-red'}">
                  <div>${formatUsd(balance / state.exchangeRate)}</div>
                  <div class="small"><strong>${formatBs(balance)}</strong></div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr><td class="text-right"><strong>TOTAL</strong></td>
            <td class="text-right">
              <div><strong>${formatUsd(monthlyConsolidated.reduce((s,r)=>s+r.income,0) / state.exchangeRate)}</strong></div>
              <div class="small"><strong>${formatBs(monthlyConsolidated.reduce((s,r)=>s+r.income,0))}</strong></div>
            </td>
            <td class="text-right">
              <div><strong>${formatUsd(monthlyConsolidated.reduce((s,r)=>s+r.expense,0) / state.exchangeRate)}</strong></div>
              <div class="small"><strong>${formatBs(monthlyConsolidated.reduce((s,r)=>s+r.expense,0))}</strong></div>
            </td>
            <td class="text-right">
              <div><strong>${formatUsd((monthlyConsolidated.reduce((s,r)=>s+r.income,0) - monthlyConsolidated.reduce((s,r)=>s+r.expense,0)) / state.exchangeRate)}</strong></div>
              <div class="small"><strong>${formatBs(monthlyConsolidated.reduce((s,r)=>s+r.income,0) - monthlyConsolidated.reduce((s,r)=>s+r.expense,0))}</strong></div>
            </td>
          </tr>
          </tfoot>
        </table>
      `;
    }
    
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title} - MasterPOS</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; padding: 40px 20px; }
        .report-container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .report-header { background: #1A2C4E; color: white; padding: 30px 40px; text-align: center; }
        .report-header h1 { font-size: 28px; margin-bottom: 10px; }
        .report-body { padding: 30px 40px; }
        .report-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .report-table th, .report-table td { border: 1px solid #e0e0e0; padding: 12px 15px; text-align: left; }
        .report-table th { background: #f8f9fa; font-weight: 600; color: #1A2C4E; }
        .text-right { text-align: right; }
        .badge { background: #e9ecef; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: bold; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f9f9f9; border-radius: 16px; padding: 20px; text-align: center; }
        .card-value { font-size: 28px; font-weight: bold; margin-top: 10px; }
        .text-green { color: #2ECC71; }
        .text-red { color: #E74C3C; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="report-header">
          <h1>${companyName}</h1>
          <p>${title} | ${dateRange}${terminalText}</p>
        </div>
        <div class="report-body">
          ${content}
        </div>
      </div>
    </body>
    </html>`;
  };

  const handlePrintPDF = () => {
    const htmlContent = generateReportHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleSharePDF = async () => {
    const htmlContent = generateReportHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const file = new File([blob], `reporte_${activeReport}.html`, { type: 'text/html' });
    if (navigator.share) {
      try {
        await navigator.share({ title: `Reporte MasterPOS`, files: [file] });
      } catch (err) { alert('No se pudo compartir el archivo'); }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${activeReport}.html`;
      a.click();
    }
  };

  const exportToExcel = () => {
    let csvRows = [];
    if (activeReport === 'transactions' && hasSearched) {
      csvRows.push(['Fecha', 'Tipo', 'Cliente', 'Terminal', 'Total Bs']);
      filteredTransactions.forEach(t => {
        let terminalDisplay = t.terminalId || (t.sessionId ? t.sessionId.split('_').shift() : '—');
        csvRows.push([formatLocalDate(t.date), t.type, t.clientName || '—', terminalDisplay, formatBsNumber(t.total)]);
      });
    } else if (activeReport === 'summary' && hasSearched) {
      csvRows.push(['Concepto', 'Monto USD', 'Equivalente Bs']);
      csvRows.push(['Total General', formatUsdNumber(totalGeneral / state.exchangeRate), formatBsNumber(totalGeneral)]);
      csvRows.push(['Ventas Contado', formatUsdNumber(contadoTotal / state.exchangeRate), formatBsNumber(contadoTotal)]);
      csvRows.push(['Ventas Crédito', formatUsdNumber(creditoTotal / state.exchangeRate), formatBsNumber(creditoTotal)]);
      csvRows.push(['Cobros de Deuda', formatUsdNumber(cobroTotal / state.exchangeRate), formatBsNumber(cobroTotal)]);
      csvRows.push(['Colaboraciones/Consumo (Costo)', formatUsdNumber(colaboracionTotal / state.exchangeRate), formatBsNumber(colaboracionTotal)]);
    } else if (activeReport === 'consolidated') {
      csvRows.push(['Mes', 'Ingresos ($)', 'Ingresos (Bs)', 'Egresos ($)', 'Egresos (Bs)', 'Balance ($)', 'Balance (Bs)']);
      monthlyConsolidated.forEach(row => {
        const balance = row.income - row.expense;
        csvRows.push([`${row.label} ${row.year}`, formatUsdNumber(row.income / state.exchangeRate), formatBsNumber(row.income), formatUsdNumber(row.expense / state.exchangeRate), formatBsNumber(row.expense), formatUsdNumber(balance / state.exchangeRate), formatBsNumber(balance)]);
      });
    }
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `reporte_${activeReport}.csv`);
    link.click();
  };

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveReport('transactions')} className={cn("px-4 py-2 rounded-lg font-black text-sm transition-all", activeReport === 'transactions' ? "bg-primary text-black" : "text-black font-black hover:bg-black/5")}>Transacciones por Fecha</button>
          <button onClick={() => setActiveReport('summary')} className={cn("px-4 py-2 rounded-lg font-black text-sm transition-all", activeReport === 'summary' ? "bg-primary text-black" : "text-black font-black hover:bg-black/5")}>Resumen de Ventas</button>
          <button onClick={() => setActiveReport('consolidated')} className={cn("px-4 py-2 rounded-lg font-black text-sm transition-all", activeReport === 'consolidated' ? "bg-primary text-black" : "text-black font-black hover:bg-black/5")}>Consolidado Ingresos/Egresos</button>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadUnifiedData} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black">
            <RefreshCw size={12} className={cn("mr-1", isSyncing && "animate-spin")} /> Sincronizar
          </Button>
          <Button onClick={handlePrintPDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Printer size={12} className="mr-1" /> Imprimir / PDF</Button>
          <Button onClick={handleSharePDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Share2 size={12} className="mr-1" /> Compartir PDF</Button>
          <Button onClick={exportToExcel} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Download size={12} className="mr-1" /> Exportar Excel</Button>
        </div>
      </div>

      <div ref={reportContentRef}>
        {(activeReport === 'transactions' || activeReport === 'summary') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Fecha Desde</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="font-black text-black" /></div>
              <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Fecha Hasta</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="font-black text-black" /></div>
              <div>
                <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1 flex items-center gap-1"><Monitor size={12} /> Terminal</label>
                <select value={selectedTerminalId} onChange={(e) => setSelectedTerminalId(e.target.value)} className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm font-black text-black focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="all">📡 TODAS LAS TERMINALES</option>
                  {terminals.map(term => (<option key={term.id} value={term.id}>{term.name.toUpperCase()}</option>))}
                </select>
              </div>
              <div className="flex gap-2 items-end"><Button onClick={handleSearch} className="bg-primary text-black font-black flex-1 h-10 shadow-md"><Search size={14} className="mr-2" /> BUSCAR</Button></div>
            </div>

            {activeReport === 'transactions' && hasSearched && (
              <div className="overflow-x-auto border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8E8E8]">
                    <tr className="border-b border-[#9E9E9E]">
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Fecha</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Tipo</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Cliente</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Terminal</th>
                      <th className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-black">Total Bs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => {
                      let terminalDisplay = t.terminalId || (t.sessionId ? t.sessionId.split('_').shift() : '—');
                      return (
                        <tr key={t.id} className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5] transition-colors">
                          <td className="p-3 text-xs font-black text-black font-mono">{formatLocalDate(t.date)}</td>
                          <td className="p-3"><span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 uppercase">{t.type.toUpperCase()}</span></td>
                          <td className="p-3 text-xs font-black text-black uppercase">{t.clientName || '—'}</td>
                          <td className="p-3 text-xs font-black text-black uppercase font-mono">{terminalDisplay}</td>
                          <td className="p-3 text-right font-black text-black">{formatBs(t.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeReport === 'summary' && hasSearched && (
              <div className="bg-gray-50 rounded-2xl p-5 border border-slate-200 space-y-3 shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-primary">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Total General</p>
                    <p className="text-2xl font-black text-primary mt-1">{formatUsd(totalGeneral / state.exchangeRate)}</p>
                    <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(totalGeneral)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Ventas Contado</p>
                    <p className="text-2xl font-black text-green-600 mt-1">{formatUsd(contadoTotal / state.exchangeRate)}</p>
                    <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(contadoTotal)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Ventas Crédito</p>
                    <p className="text-2xl font-black text-orange-600 mt-1">{formatUsd(creditoTotal / state.exchangeRate)}</p>
                    <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(creditoTotal)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Cobros de Deuda</p>
                    <p className="text-2xl font-black text-purple-600 mt-1">{formatUsd(cobroTotal / state.exchangeRate)}</p>
                    <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(cobroTotal)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Colaboraciones/Consumo (Costo)</p>
                    <p className="text-2xl font-black text-red-600 mt-1">{formatUsd(colaboracionTotal / state.exchangeRate)}</p>
                    <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(colaboracionTotal * state.exchangeRate)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-gray-500">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Costo Total de Operación</p>
                    <p className="text-2xl font-black text-black mt-1">{formatUsd(costoTotalOperacion / state.exchangeRate)}</p>
                    <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(costoTotalOperacion * state.exchangeRate)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeReport === 'consolidated' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-primary" />
              <h3 className="text-lg font-black text-black uppercase">Consolidado Mensual de Caja (Sincronizado)</h3>
              {isSyncing && <RefreshCw size={14} className="animate-spin text-primary" />}
            </div>
            <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
              <table className="w-full text-sm">
                <thead className="bg-[#E8E8E8]"><tr className="border-b border-[#9E9E9E]"><th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Mes</th><th className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-black">Ingresos (+)</th><th className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-black">Egresos (-)</th><th className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-black">Balance</th></tr></thead>
                <tbody className="divide-y divide-[#9E9E9E]/40">
                  {monthlyConsolidated.map((row, idx) => {
                    const balance = row.income - row.expense;
                    return (
                      <tr key={idx} className="hover:bg-[#F5F5F5] transition-colors">
                        <td className="p-3"><p className="font-black text-black uppercase">{row.label}</p><p className="text-[10px] text-black font-black">{row.year}</p></td>
                        <td className="p-3 text-right">
                          <p className="text-green-600 font-black">{formatUsd(row.income / state.exchangeRate)}</p>
                          <p className="text-[10px] font-black text-black font-mono">{formatBs(row.income)}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-red-600 font-black">{formatUsd(row.expense / state.exchangeRate)}</p>
                          <p className="text-[10px] font-black text-black font-mono">{formatBs(row.expense)}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className={cn("font-black", balance >= 0 ? "text-green-700" : "text-red-700")}>{formatUsd(balance / state.exchangeRate)}</p>
                          <p className="text-[10px] font-black text-black font-mono">{formatBs(balance)}</p>
                        </td>
                      </tr>
                    );
                  })}
                  {monthlyConsolidated.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-black font-black italic">No hay datos consolidados para mostrar</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-[#F0F0F0] border-t-2 border-[#9E9E9E]">
                  <tr className="font-black text-black">
                    <td className="p-4 uppercase tracking-widest">TOTAL HISTÓRICO</td>
                    <td className="p-4 text-right">
                      <p className="text-green-700 font-black">{formatUsd(monthlyConsolidated.reduce((s, r) => s + r.income, 0) / state.exchangeRate)}</p>
                      <p className="text-[10px] font-black text-black font-mono">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.income, 0))}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-red-700 font-black">{formatUsd(monthlyConsolidated.reduce((s, r) => s + r.expense, 0) / state.exchangeRate)}</p>
                      <p className="text-[10px] font-black text-black font-mono">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.expense, 0))}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-black">{formatUsd((monthlyConsolidated.reduce((s, r) => s + r.income, 0) - monthlyConsolidated.reduce((s, r) => s + r.expense, 0)) / state.exchangeRate)}</p>
                      <p className="text-[10px] font-black text-black font-mono">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.income, 0) - monthlyConsolidated.reduce((s, r) => s + r.expense, 0))}</p>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
