"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useAccounting } from '@/hooks/use-accounting';
import { Calendar, FileText, FileSpreadsheet, Search, X, TrendingUp, TrendingDown, BarChart3, ArrowRight, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import { getStartOfDay, getEndOfDay, formatLocalDate } from '@/lib/date-utils';

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

  const isAdmin = userRole === 'admin';

  const handleSearch = () => {
    if (!startDate || !endDate) {
      alert('Seleccione ambas fechas');
      return;
    }
    
    const startLimit = getStartOfDay(startDate);
    const endLimit = getEndOfDay(endDate);
    
    const filtered = state.transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startLimit && txDate <= endLimit;
    });
    
    setFilteredTransactions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHasSearched(true);
  };

  const handleDeleteTransaction = (id: number) => {
    if (!isAdmin) {
      alert('No tiene permisos para eliminar transacciones');
      return;
    }
    
    if (confirm('¿Está seguro de eliminar esta transacción? Esta acción no se puede deshacer.')) {
      const updatedTransactions = filteredTransactions.filter(t => t.id !== id);
      setFilteredTransactions(updatedTransactions);
      
      const allTransactions = state.transactions.filter(t => t.id !== id);
      state.setTransactions(allTransactions);
      
      localStorage.setItem('licopos_transactions', JSON.stringify(allTransactions));
      
      alert('Transacción eliminada correctamente');
    }
  };

  const exportToExcel = () => {
    const headers = ['Fecha', 'Tipo', 'Cliente', 'Método', 'Subtotal', 'IVA', 'Total', 'Pagado', 'Vuelto'];
    const rows = filteredTransactions.map(t => [
      formatLocalDate(t.date),
      t.type === 'contado' ? 'CONTADO' : t.type === 'credito' ? 'CRÉDITO' : 'COBRO DEUDA',
      t.clientName || 'CLIENTE FINAL',
      t.payMethod?.replace('_', ' ') || 'EFECTIVO BS',
      t.subtotal.toFixed(2),
      t.iva.toFixed(2),
      t.total.toFixed(2),
      t.paidBs.toFixed(2),
      t.change.toFixed(2),
    ]);
    
    let htmlContent = `
      <html><head><meta charset="UTF-8"><title>Reporte de Transacciones</title>
      <style>th{background:#D4A017;color:black;padding:8px}td{padding:6px;border:1px solid #ddd}table{border-collapse:collapse;width:100%}</style>
      </head><body><h2>Reporte de Transacciones</h2>
      <p>Periodo: ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-VE')} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-VE')}</p>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${startDate}_${endDate}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const totalVentas = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const content = `
      <html><head><title>Reporte de Transacciones - MasterPOS</title>
      <style>body{font-family:Arial;margin:40px}h1{color:#D4A017;text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#D4A017;color:black}.footer{margin-top:30px;text-align:center;font-size:12px;color:#666}</style>
      </head><body><h1>MasterPOS - Reporte de Transacciones</h1>
      <p><strong>Periodo:</strong> ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-VE')} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-VE')}</p>
      <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Método</th><th>Total</th></tr></thead>
      <tbody>${filteredTransactions.map(t => `<tr><td>${formatLocalDate(t.date)}</td><td>${t.type.toUpperCase()}</td><td>${t.clientName || 'CLIENTE FINAL'}</td><td>${t.payMethod || 'EFECTIVO'}</td><td>Bs ${t.total.toFixed(2)}</td></tr>`).join('')}</tbody>
      </table><script>window.print();<\/script></body></html>
    `;
    printWindow?.document.write(content);
    printWindow?.document.close();
  };

  // Cálculo de consolidado mensual
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

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex gap-2 mb-4 border-b pb-2 flex-wrap">
        <button 
          onClick={() => setActiveReport('transactions')} 
          className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'transactions' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}
        >
          Transacciones por Fecha
        </button>
        <button 
          onClick={() => setActiveReport('summary')} 
          className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'summary' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}
        >
          Resumen de Ventas
        </button>
        <button 
          onClick={() => setActiveReport('consolidated')} 
          className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'consolidated' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}
        >
          Consolidado Ingresos/Egresos
        </button>
      </div>

      {activeReport === 'transactions' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Desde</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border-[#9E9E9E]" /></div>
            <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Hasta</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border-[#9E9E9E]" /></div>
            <div className="flex gap-2 items-end"><Button onClick={handleSearch} className="bg-primary text-black font-black flex-1"><Search size={14} className="mr-2" /> BUSCAR</Button><Button onClick={() => { setStartDate(''); setEndDate(''); setFilteredTransactions([]); setHasSearched(false); }} variant="ghost" className="border border-[#9E9E9E]"><X size={14} /></Button></div>
          </div>
          {hasSearched && (
            <>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div><p className="text-sm font-bold text-black">{filteredTransactions.length} transacciones encontradas</p><p className="text-xs text-black/60">Total: <span className="font-bold text-green-600">Bs {totalGeneral.toFixed(2)}</span></p></div>
                {filteredTransactions.length > 0 && (<div className="flex gap-2"><Button onClick={exportToExcel} className="bg-green-600 text-white text-xs h-8"><FileSpreadsheet size={14} className="mr-1" /> EXCEL</Button><Button onClick={exportToPDF} className="bg-red-600 text-white text-xs h-8"><FileText size={14} className="mr-1" /> PDF</Button></div>)}
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-[#9E9E9E] rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8E8E8] sticky top-0">
                    <tr className="border-b border-[#9E9E9E]">
                      <th className="p-2 text-[10px] font-black text-black">Fecha</th>
                      <th className="p-2 text-[10px] font-black text-black">Tipo</th>
                      <th className="p-2 text-[10px] font-black text-black">Cliente</th>
                      <th className="p-2 text-[10px] font-black text-black text-right">Total</th>
                      {isAdmin && <th className="p-2 text-[10px] font-black text-black text-center">Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t, idx) => (
                      <tr key={idx} className="border-b hover:bg-[#F5F5F5]">
                        <td className="p-2 text-xs text-black/60">{formatLocalDate(t.date)}</td>
                        <td className="p-2"><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", t.type === 'contado' ? "bg-green-100 text-green-700" : t.type === 'credito' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}>{t.type.toUpperCase()}</span></td>
                        <td className="p-2 text-xs text-black/80">{t.clientName || '—'}</td>
                        <td className="p-2 text-right font-bold text-black">Bs {t.total.toFixed(2)}</td>
                        {isAdmin && <td className="p-2 text-center"><button onClick={() => handleDeleteTransaction(t.id)} className="text-red-500 hover:text-red-700"><X size={14} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {activeReport === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-xl p-6 text-center border border-green-200">
            <TrendingUp size={24} className="text-green-600 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-green-700 uppercase">Ventas Contado</p>
            <p className="text-3xl font-black text-green-600">Bs {contadoTotal.toFixed(2)}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-6 text-center border border-orange-200">
            <Calendar size={24} className="text-orange-600 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-orange-700 uppercase">Ventas Crédito</p>
            <p className="text-3xl font-black text-orange-600">Bs {creditoTotal.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-6 text-center border border-blue-200">
            <DollarSign size={24} className="text-blue-600 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-blue-700 uppercase">Cobros de Deuda</p>
            <p className="text-3xl font-black text-blue-600">Bs {cobroTotal.toFixed(2)}</p>
          </div>
        </div>
      )}

      {activeReport === 'consolidated' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-primary" />
            <h3 className="text-lg font-black text-black">Consolidado Mensual de Caja</h3>
          </div>
          
          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#E8E8E8]">
                <tr className="border-b border-[#9E9E9E]">
                  <th className="p-3 text-[10px] font-black text-black text-left uppercase">Periodo / Mes</th>
                  <th className="p-3 text-[10px] font-black text-black text-right uppercase">Ingresos (+)</th>
                  <th className="p-3 text-[10px] font-black text-black text-right uppercase">Egresos (-)</th>
                  <th className="p-3 text-[10px] font-black text-black text-right uppercase">Balance / Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#9E9E9E]">
                {monthlyConsolidated.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-black/50 italic">No hay movimientos contables suficientes para generar el consolidado</td></tr>
                ) : (
                  monthlyConsolidated.map((row, idx) => {
                    const balance = row.income - row.expense;
                    return (
                      <tr key={idx} className="hover:bg-[#F5F5F5] transition-colors">
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-black text-black">{row.label}</span>
                            <span className="text-[10px] text-black/50 font-bold">{row.year}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold text-green-600 text-sm">Bs {row.income.toFixed(2)}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold text-red-600 text-sm">Bs {row.expense.toFixed(2)}</span>
                        </td>
                        <td className="p-3 text-right">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-base shadow-sm border",
                            balance >= 0 ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                          )}>
                            {balance >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            Bs {balance.toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {monthlyConsolidated.length > 0 && (
                <tfoot className="bg-[#F0F0F0]">
                  <tr className="border-t-2 border-[#9E9E9E]">
                    <td className="p-4 font-black text-black">TOTAL HISTÓRICO ACUMULADO</td>
                    <td className="p-4 text-right font-black text-green-600 text-base">
                      Bs {monthlyConsolidated.reduce((s, r) => s + row.income, 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-black text-red-600 text-base">
                      Bs {monthlyConsolidated.reduce((s, r) => s + row.expense, 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-right">
                      {(() => {
                        const totalIncome = monthlyConsolidated.reduce((s, r) => s + r.income, 0);
                        const totalExpense = monthlyConsolidated.reduce((s, r) => s + r.expense, 0);
                        const totalBalance = totalIncome - totalExpense;
                        return (
                          <div className={cn(
                            "font-black text-lg",
                            totalBalance >= 0 ? "text-green-700" : "text-red-700"
                          )}>
                            Bs {totalBalance.toFixed(2)}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          <div className="bg-[#1A2C4E]/5 rounded-xl p-4 border border-[#1A2C4E]/10">
            <p className="text-[10px] text-black/50 leading-tight">
              * El <strong>Consolidado</strong> agrupa todos los asientos contables registrados en el Libro Diario (Ventas, Devoluciones, Gastos Operativos y Pagos a Proveedores). Los montos están expresados en Moneda Nacional (Bs) según la tasa vigente al momento del registro.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
