"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useAccounting } from '@/hooks/use-accounting';
import { Calendar, FileText, FileSpreadsheet, Search, X, TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import { getStartOfDay, getEndOfDay, formatLocalDate } from '@/lib/date-utils';
import { syncService } from '@/services/syncService';

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

  const handleDeleteTransaction = async (id: number) => {
    if (!isAdmin) {
      alert('No tiene permisos para eliminar transacciones');
      return;
    }
    
    if (confirm('¿Está seguro de eliminar esta transacción de la base de datos central?')) {
      await syncService.deleteTransaction(id);
      // La lista se actualizará automáticamente gracias al Snapshot en usePOSState
      setFilteredTransactions(prev => prev.filter(t => t.id !== id));
      alert('Transacción eliminada correctamente de Firebase');
    }
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
        <button onClick={() => setActiveReport('transactions')} className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'transactions' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}>Transacciones por Fecha</button>
        <button onClick={() => setActiveReport('summary')} className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'summary' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}>Resumen de Ventas</button>
        <button onClick={() => setActiveReport('consolidated')} className={cn("px-4 py-2 rounded-lg font-bold text-sm transition-all", activeReport === 'consolidated' ? "bg-primary text-black" : "text-black/60 hover:bg-black/5")}>Consolidado Ingresos/Egresos</button>
      </div>

      {activeReport === 'transactions' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Desde</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label className="text-[10px] font-black text-black/60 block mb-1">Fecha Hasta</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
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
                    <th className="p-2 text-right">Total</th>
                    {isAdmin && <th className="p-2 text-center">Borrar</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-[#F5F5F5]">
                      <td className="p-2 text-xs">{formatLocalDate(t.date)}</td>
                      <td className="p-2"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100">{t.type.toUpperCase()}</span></td>
                      <td className="p-2 text-xs">{t.clientName || '—'}</td>
                      <td className="p-2 text-right font-bold">Bs {t.total.toFixed(2)}</td>
                      {isAdmin && <td className="p-2 text-center"><button onClick={() => handleDeleteTransaction(t.id)} className="text-red-500 hover:text-red-700"><X size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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
                      <td className="p-3 text-right text-green-600 font-bold">Bs {row.income.toFixed(2)}</td>
                      <td className="p-3 text-right text-red-600 font-bold">Bs {row.expense.toFixed(2)}</td>
                      <td className={cn("p-3 text-right font-black", balance >= 0 ? "text-green-700" : "text-red-700")}>Bs {balance.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#F0F0F0]">
                <tr className="font-black">
                  <td className="p-4">TOTAL HISTÓRICO</td>
                  <td className="p-4 text-right text-green-700">Bs {monthlyConsolidated.reduce((s, r) => s + r.income, 0).toFixed(2)}</td>
                  <td className="p-4 text-right text-red-700">Bs {monthlyConsolidated.reduce((s, r) => s + r.expense, 0).toFixed(2)}</td>
                  <td className="p-4 text-right">Bs {(monthlyConsolidated.reduce((s, r) => s + r.income, 0) - monthlyConsolidated.reduce((s, r) => s + r.expense, 0)).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
