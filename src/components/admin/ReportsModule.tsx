"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useAccounting } from '@/hooks/use-accounting';
import { Calendar, FileText, FileSpreadsheet, Search, TrendingUp, TrendingDown, BarChart3, DollarSign, Printer, Share2, Download, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import { getStartOfDay, getEndOfDay, formatLocalDate } from '@/lib/date-utils';
import { syncService } from '@/services/syncService';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

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
  
  const reportContentRef = useRef<HTMLDivElement>(null);

  // Cargar terminales disponibles
  useEffect(() => {
    const loadTerminals = async () => {
      setIsLoadingTerminals(true);
      setLoadError(null);
      try {
        const terminalsData = await syncService.getAllTerminals();
        if (terminalsData && terminalsData.length > 0) {
          setTerminals(terminalsData.map(t => ({ id: t.id, name: t.name || t.id })));
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
    
    // ✅ Filtrar por terminal correctamente (usando terminalId o sessionId)
    if (selectedTerminalId !== 'all') {
      filtered = filtered.filter(t => {
        // Si tiene terminalId directamente
        if (t.terminalId) return t.terminalId === selectedTerminalId;
        // Si tiene sessionId, extraer el último segmento (formato: SES-{timestamp}-{terminal})
        if (t.sessionId) {
          const parts = t.sessionId.split('-');
          const terminalFromSession = parts[parts.length - 1];
          return terminalFromSession === selectedTerminalId;
        }
        return false;
      });
    }
    
    setFilteredTransactions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHasSearched(true);
  };

  const monthlyConsolidated = useMemo(() => {
    const consolidated: Record<string, { label: string, year: number, monthIdx: number, income: number, expense: number }> = {};
    
    entries.forEach(entry => {
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
  }, [entries]);

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
    const companyName = 'MASTERPOS - LICORERÍA ELITE';
    
    let content = '';
    
    if (activeReport === 'transactions' && hasSearched) {
      content = `
        <table class="report-table">
          <thead>
            <tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Terminal</th><th class="text-right">Total (Bs)</th></tr>
          </thead>
          <tbody>
            ${filteredTransactions.map(t => {
              let terminalDisplay = t.terminalId || (t.sessionId ? t.sessionId.split('-').pop() : '—');
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
          <tfoot><tr><td colspan="4" class="text-right"><strong>Total General</strong></td><td class="text-right"><strong>${formatBs(totalGeneral)}</strong></td></tr></tfoot>
        </table>
      `;
    } else if (activeReport === 'summary' && hasSearched) {
      content = `
        <div class="summary-grid">
          <div class="summary-card"><div class="card-title">Total General</div><div class="card-value text-primary">${formatBs(totalGeneral)}</div></div>
          <div class="summary-card"><div class="card-title">Ventas Contado</div><div class="card-value text-green">${formatBs(contadoTotal)}</div></div>
          <div class="summary-card"><div class="card-title">Ventas Crédito</div><div class="card-value text-orange">${formatBs(creditoTotal)}</div></div>
          <div class="summary-card"><div class="card-title">Cobros de Deuda</div><div class="card-value text-purple">${formatBs(cobroTotal)}</div></div>
          <div class="summary-card"><div class="card-title">Colaboraciones/Consumo</div><div class="card-value text-red">${formatBs(colaboracionTotal)}</div></div>
          <div class="summary-card"><div class="card-title">Costo de Operación</div><div class="card-value">${formatBs(costoTotalOperacion)}</div></div>
        </div>
      `;
    } else if (activeReport === 'consolidated') {
      content = `
        <table class="report-table">
          <thead><tr><th>Mes</th><th class="text-right">Ingresos (Bs)</th><th class="text-right">Egresos (Bs)</th><th class="text-right">Balance (Bs)</th></tr></thead>
          <tbody>
            ${monthlyConsolidated.map(row => `
              <tr>
                <td>${row.label} ${row.year}</td>
                <td class="text-right text-green">${formatBs(row.income)}</td>
                <td class="text-right text-red">${formatBs(row.expense)}</td>
                <td class="text-right ${row.income - row.expense >= 0 ? 'text-green' : 'text-red'}">${formatBs(row.income - row.expense)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr><td class="text-right"><strong>TOTAL</strong></td>
            <td class="text-right"><strong>${formatBs(monthlyConsolidated.reduce((s,r)=>s+r.income,0))}</strong></td>
            <td class="text-right"><strong>${formatBs(monthlyConsolidated.reduce((s,r)=>s+r.expense,0))}</strong></td>
            <td class="text-right"><strong>${formatBs(monthlyConsolidated.reduce((s,r)=>s+r.income,0) - monthlyConsolidated.reduce((s,r)=>s+r.expense,0))}</strong></td>
          </tr>
          </tfoot>
        </table>
      `;
    } else {
      content = '<p class="text-center">No hay datos para mostrar. Realice una búsqueda primero.</p>';
    }
    
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title} - MasterPOS</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f5f5f5;
          padding: 40px 20px;
        }
        .report-container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .report-header {
          background: linear-gradient(135deg, #1A2C4E 0%, #2c3e50 100%);
          color: white;
          padding: 30px 40px;
          text-align: center;
        }
        .report-header h1 {
          font-size: 28px;
          margin-bottom: 10px;
          letter-spacing: 1px;
        }
        .report-header p {
          opacity: 0.8;
          font-size: 14px;
        }
        .report-body {
          padding: 30px 40px;
        }
        .report-footer {
          background: #f0f0f0;
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #555;
          border-top: 1px solid #ddd;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .report-table th, .report-table td {
          border: 1px solid #e0e0e0;
          padding: 12px 15px;
          text-align: left;
        }
        .report-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #1A2C4E;
        }
        .report-table tbody tr:hover {
          background: #f9f9f9;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .badge {
          background: #e9ecef;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: bold;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        .summary-card {
          background: #f9f9f9;
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .card-title {
          font-size: 12px;
          text-transform: uppercase;
          color: #6c757d;
          letter-spacing: 1px;
        }
        .card-value {
          font-size: 28px;
          font-weight: bold;
          margin-top: 10px;
        }
        .text-primary { color: #1A2C4E; }
        .text-green { color: #2ECC71; }
        .text-orange { color: #F39C12; }
        .text-purple { color: #9B59B6; }
        .text-red { color: #E74C3C; }
        @media print {
          body { background: white; padding: 0; }
          .report-container { box-shadow: none; border-radius: 0; }
          .report-header { background: #1A2C4E; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .summary-card { break-inside: avoid; }
          .report-table th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="report-header">
          <h1>${companyName}</h1>
          <p>${title} | ${dateRange}${terminalText}</p>
          <p>Fecha de generación: ${new Date().toLocaleString('es-VE')}</p>
        </div>
        <div class="report-body">
          ${content}
        </div>
        <div class="report-footer">
          Este documento es una representación oficial de los reportes del sistema MasterPOS.
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
        await navigator.share({
          title: `Reporte MasterPOS - ${activeReport}`,
          text: `Reporte generado el ${new Date().toLocaleString('es-VE')}`,
          files: [file]
        });
      } catch (err) {
        console.error('Error al compartir:', err);
        alert('No se pudo compartir el archivo');
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${activeReport}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportToExcel = () => {
    let csvRows = [];
    if (activeReport === 'transactions' && hasSearched) {
      csvRows.push(['Fecha', 'Tipo', 'Cliente', 'Terminal', 'Total Bs']);
      filteredTransactions.forEach(t => {
        let terminalDisplay = t.terminalId || (t.sessionId ? t.sessionId.split('-').pop() : '—');
        csvRows.push([formatLocalDate(t.date), t.type, t.clientName || '—', terminalDisplay, formatBsNumber(t.total)]);
      });
    } else if (activeReport === 'summary' && hasSearched) {
      csvRows.push(['Concepto', 'Monto Bs']);
      csvRows.push(['Total General', formatBsNumber(totalGeneral)]);
      csvRows.push(['Ventas Contado', formatBsNumber(contadoTotal)]);
      csvRows.push(['Ventas Crédito', formatBsNumber(creditoTotal)]);
      csvRows.push(['Cobros de Deuda', formatBsNumber(cobroTotal)]);
      csvRows.push(['Colaboraciones/Consumo (Costo)', formatBsNumber(colaboracionTotal)]);
      csvRows.push(['Costo Total Operación', formatBsNumber(costoTotalOperacion)]);
    } else if (activeReport === 'consolidated') {
      csvRows.push(['Mes', 'Ingresos (Bs)', 'Egresos (Bs)', 'Balance (Bs)']);
      monthlyConsolidated.forEach(row => {
        csvRows.push([`${row.label} ${row.year}`, formatBsNumber(row.income), formatBsNumber(row.expense), formatBsNumber(row.income - row.expense)]);
      });
      const totalIncome = monthlyConsolidated.reduce((s, r) => s + r.income, 0);
      const totalExpense = monthlyConsolidated.reduce((s, r) => s + r.expense, 0);
      csvRows.push(['TOTAL', formatBsNumber(totalIncome), formatBsNumber(totalExpense), formatBsNumber(totalIncome - totalExpense)]);
    } else {
      alert('No hay datos para exportar. Realice una búsqueda primero.');
      return;
    }
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `reporte_${activeReport}_${new Date().toISOString().slice(0,19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveReport('transactions')} className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'transactions' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}>Transacciones por Fecha</button>
          <button onClick={() => setActiveReport('summary')} className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'summary' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}>Resumen de Ventas</button>
          <button onClick={() => setActiveReport('consolidated')} className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'consolidated' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}>Consolidado Ingresos/Egresos</button>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrintPDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E]"><Printer size={12} className="mr-1" /> Imprimir / PDF</Button>
          <Button onClick={handleSharePDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E]"><Share2 size={12} className="mr-1" /> Compartir PDF</Button>
          <Button onClick={exportToExcel} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E]"><Download size={12} className="mr-1" /> Exportar Excel</Button>
        </div>
      </div>

      <div ref={reportContentRef}>
        {activeReport === 'transactions' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Desde</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Hasta</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div>
                <label className="text-[10px] font-black text-black/60 block mb-1 flex items-center gap-1"><Monitor size={12} /> Terminal</label>
                <select 
                  value={selectedTerminalId} 
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                  className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="all">📡 Todas las terminales</option>
                  {terminals.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
                {isLoadingTerminals && <p className="text-[8px] text-black/40 mt-1">Cargando terminales...</p>}
                {loadError && <p className="text-[8px] text-red-500 mt-1">{loadError}</p>}
              </div>
              <div className="flex gap-2 items-end"><Button onClick={handleSearch} className="bg-primary text-black font-black flex-1"><Search size={14} className="mr-2" /> BUSCAR</Button></div>
            </div>
            {hasSearched && (
              <div className="overflow-x-auto border border-[#9E9E9E] rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8E8E8]">
                    <tr className="border-b">
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-left">Terminal</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => {
                      // ✅ Extraer terminal correctamente: usar terminalId o último segmento del sessionId
                      let terminalDisplay = t.terminalId || (t.sessionId ? t.sessionId.split('-').pop() : '—');
                      return (
                        <tr key={t.id} className="border-b hover:bg-[#F5F5F5]">
                          <td className="p-2 text-xs">{formatLocalDate(t.date)}</td>
                          <td className="p-2"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100">{t.type.toUpperCase()}</span></td>
                          <td className="p-2 text-xs">{t.clientName || '—'}</td>
                          <td className="p-2 text-xs font-mono">{terminalDisplay}</td>
                          <td className="p-2 text-right font-bold">{formatBs(t.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeReport === 'summary' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Desde</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Hasta</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div className="flex gap-2 items-end"><Button onClick={handleSearch} className="bg-primary text-black font-black flex-1"><Search size={14} className="mr-2" /> BUSCAR</Button></div>
            </div>
            {hasSearched && (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-primary"><p className="text-[10px] font-black text-black/40">Total General</p><p className="text-2xl font-black text-primary">{formatBs(totalGeneral)}</p></div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500"><p className="text-[10px] font-black text-black/40">Ventas Contado</p><p className="text-2xl font-black text-green-600">{formatBs(contadoTotal)}</p></div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500"><p className="text-[10px] font-black text-black/40">Ventas Crédito</p><p className="text-2xl font-black text-orange-600">{formatBs(creditoTotal)}</p></div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500"><p className="text-[10px] font-black text-black/40">Cobros de Deuda</p><p className="text-2xl font-black text-purple-600">{formatBs(cobroTotal)}</p></div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500"><p className="text-[10px] font-black text-black/40">Colaboraciones/Consumo (Costo)</p><p className="text-2xl font-black text-red-600">{formatBs(colaboracionTotal)}</p></div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-gray-500"><p className="text-[10px] font-black text-black/40">Costo Total de Operación</p><p className="text-2xl font-black">{formatBs(costoTotalOperacion)}</p></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeReport === 'consolidated' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4"><BarChart3 size={20} className="text-primary" /><h3 className="text-lg font-black text-black">Consolidado Mensual de Caja</h3></div>
            <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#E8E8E8]"><tr className="border-b border-[#9E9E9E]"><th className="p-3 text-left">Mes</th><th className="p-3 text-right">Ingresos (+)</th><th className="p-3 text-right">Egresos (-)</th><th className="p-3 text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-[#9E9E9E]">
                  {monthlyConsolidated.map((row, idx) => {
                    const balance = row.income - row.expense;
                    return (
                      <tr key={idx} className="hover:bg-[#F5F5F5]">
                        <td className="p-3"><p className="font-black">{row.label}</p><p className="text-[10px] text-black/50">{row.year}</p></td>
                        <td className="p-3 text-right text-green-600 font-bold">{formatBs(row.income)}</td>
                        <td className="p-3 text-right text-red-600 font-bold">{formatBs(row.expense)}</td>
                        <td className={cn("p-3 text-right font-black", balance >= 0 ? "text-green-700" : "text-red-700")}>{formatBs(balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#F0F0F0]">
                  <tr className="font-black">
                    <td className="p-4">TOTAL HISTÓRICO</td>
                    <td className="p-4 text-right text-green-700">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.income, 0))}</td>
                    <td className="p-4 text-right text-red-700">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.expense, 0))}</td>
                    <td className="p-4 text-right">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.income, 0) - monthlyConsolidated.reduce((s, r) => s + r.expense, 0))}</td>
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