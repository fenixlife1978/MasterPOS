
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
  
  // ✅ Estados para reconciliación unificada (RTDB TRUTH)
  const [unifiedEntries, setUnifiedEntries] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const reportContentRef = useRef<HTMLDivElement>(null);

  // ✅ RECONCILIACIÓN UNIFICADA (Identica a Contabilidad)
  const loadUnifiedData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Usar asientos de la RTDB (proporcionados por el hook useAccounting)
      const baseEntries = [...entries];
      const registeredIds = new Set(baseEntries.map(e => String(e.referenceId)).filter(id => id !== 'undefined' && id !== 'null'));

      // Usar transacciones de la RTDB
      const rtdbTransactions = state.transactions;

      const missingFromTx = rtdbTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        const startLimit = new Date('2026-07-02T00:00:00-04:00');
        // Filtros: Fecha >= 02/07, no duplicar, NO créditos
        return txDate >= startLimit && !registeredIds.has(String(tx.id)) && tx.type !== 'credito' &&
               ['contado', 'cobro_deuda', 'devolucion', 'colaboracion', 'consumo_propio'].includes(tx.type);
      }).map(tx => {
        const isExpense = ['devolucion', 'colaboracion', 'consumo_propio'].includes(tx.type);
        const rate = tx.exchangeRate || state.exchangeRate;
        return {
          id: `tx_${tx.id}`,
          referenceId: tx.id,
          date: tx.date,
          type: isExpense ? 'egreso' : 'ingreso',
          category: tx.type === 'cobro_deuda' ? 'cobro_deuda' : 
                    tx.type === 'devolucion' ? 'devolucion' : 
                    (tx.type === 'colaboracion' || tx.type === 'consumo_propio') ? 'otros' : 'ventas',
          concept: (tx.type === 'cobro_deuda' ? 'COBRO DE DEUDA' : 
                   tx.type === 'devolucion' ? 'DEVOLUCIÓN' : 
                   tx.type === 'colaboracion' ? 'COLABORACIÓN' : 
                   tx.type === 'consumo_propio' ? 'CONSUMO PROPIO' : 'VENTA') + ` #${tx.receiptNumber || tx.id}`,
          amount: tx.total || 0,
          totalUsd: tx.totalUsd || (tx.total / rate),
          exchangeRate: rate
        };
      });

      setUnifiedEntries([...baseEntries, ...missingFromTx]);
    } catch (error) {
      console.error('Error reconciliando reportes:', error);
      setUnifiedEntries(entries.filter(e => e.type !== 'credito'));
    } finally {
      setIsSyncing(false);
    }
  }, [entries, state.transactions, state.exchangeRate]);

  useEffect(() => {
    loadUnifiedData();
  }, [loadUnifiedData]);

  // Cargar terminales
  useEffect(() => {
    const loadTerminals = async () => {
      setIsLoadingTerminals(true);
      try {
        const terminalsData = await syncService.getAllTerminals();
        if (terminalsData) {
          setTerminals(terminalsData.map((t: any) => ({ id: t.name || t.id, name: t.name || t.id })));
        }
      } catch (error) {
        console.error('Error al cargar terminales:', error);
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
    
    // ✅ CORRECCIÓN DE RANGOS DE FECHA CON TIMEZONE VENEZUELA
    const startLimit = getStartOfDay(startDate);
    const endLimit = getEndOfDay(endDate);
    
    let filtered = state.transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startLimit && txDate <= endLimit;
    });
    
    if (selectedTerminalId !== 'all') {
      filtered = filtered.filter(t => {
        const txTerminal = t.terminalId || (t.sessionId ? t.sessionId.split('_').shift() : '—');
        return txTerminal === selectedTerminalId;
      });
    }
    
    setFilteredTransactions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setHasSearched(true);
  };

  // ✅ CONSOLIDADO MENSUAL UNIFICADO CON USD COMO ANCLA
  const monthlyConsolidated = useMemo(() => {
    const consolidated: Record<string, { label: string, year: number, monthIdx: number, incomeUsd: number, expenseUsd: number }> = {};
    
    unifiedEntries.forEach(entry => {
      const d = new Date(entry.date);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx).padStart(2, '0')}`;
      
      if (!consolidated[key]) {
        const monthName = d.toLocaleDateString('es-VE', { month: 'long' });
        consolidated[key] = { label: monthName.toUpperCase(), year, monthIdx, incomeUsd: 0, expenseUsd: 0 };
      }
      
      const entryUsd = entry.totalUsd || (entry.amount / (entry.exchangeRate || state.exchangeRate));
      if (entry.type === 'ingreso') consolidated[key].incomeUsd += entryUsd;
      else consolidated[key].expenseUsd += entryUsd;
    });
    
    return Object.values(consolidated).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.monthIdx - b.monthIdx)).reverse();
  }, [unifiedEntries, state.exchangeRate]);

  // ✅ Cálculos para resumen de ventas usando USD como ANCLA ABSOLUTA (Requerimiento de estabilidad)
  const contadoTotalUsd = useMemo(() => filteredTransactions.filter(t => t.type === 'contado').reduce((sum, t) => sum + (t.totalUsd || (t.total / (t.exchangeRate || state.exchangeRate))), 0), [filteredTransactions, state.exchangeRate]);
  const creditoTotalUsd = useMemo(() => filteredTransactions.filter(t => t.type === 'credito').reduce((sum, t) => sum + (t.totalUsd || (t.total / (t.exchangeRate || state.exchangeRate))), 0), [filteredTransactions, state.exchangeRate]);
  const cobroTotalUsd = useMemo(() => filteredTransactions.filter(t => t.type === 'cobro_deuda').reduce((sum, t) => sum + (t.totalUsd || (t.total / (t.exchangeRate || state.exchangeRate))), 0), [filteredTransactions, state.exchangeRate]);
  const colaboracionTotalUsd = useMemo(() => filteredTransactions.filter(t => t.type === 'colaboracion' || t.type === 'consumo_propio').reduce((sum, t) => sum + (t.totalUsd || t.costoTotalOperacion || 0), 0), [filteredTransactions]);

  return (
    <div className="bg-white border-2 border-black rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-4 border-b-2 border-black pb-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveReport('transactions')} className={cn("px-4 py-2 rounded-lg font-black text-sm transition-all border-2 border-transparent", activeReport === 'transactions' ? "bg-primary text-black border-black shadow-md" : "text-black hover:bg-black/5")}>TRANSACCIONES</button>
          <button onClick={() => setActiveReport('summary')} className={cn("px-4 py-2 rounded-lg font-black text-sm transition-all border-2 border-transparent", activeReport === 'summary' ? "bg-primary text-black border-black shadow-md" : "text-black hover:bg-black/5")}>RESUMEN VENTAS</button>
          <button onClick={() => setActiveReport('consolidated')} className={cn("px-4 py-2 rounded-lg font-black text-sm transition-all border-2 border-transparent", activeReport === 'consolidated' ? "bg-primary text-black border-black shadow-md" : "text-black hover:bg-black/5")}>CONSOLIDADO MENSUAL</button>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadUnifiedData} variant="outline" className="h-8 text-[10px] font-black border-2 border-black text-black">
            <RefreshCw size={12} className={cn("mr-1", isSyncing && "animate-spin")} /> SINC. DATOS
          </Button>
          <Button variant="outline" className="h-8 text-[10px] font-black border-2 border-black text-black"><Printer size={12} className="mr-1" /> PDF</Button>
          <Button variant="outline" className="h-8 text-[10px] font-black border-2 border-black text-black"><Download size={12} className="mr-1" /> EXCEL</Button>
        </div>
      </div>

      <div ref={reportContentRef}>
        {(activeReport === 'transactions' || activeReport === 'summary') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Desde</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="font-black text-black border-2 border-black" /></div>
              <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Hasta</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="font-black text-black border-2 border-black" /></div>
              <div>
                <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1 flex items-center gap-1">Terminal</label>
                <select value={selectedTerminalId} onChange={(e) => setSelectedTerminalId(e.target.value)} className="w-full h-10 bg-white border-2 border-black rounded-lg px-3 text-sm font-black text-black focus:outline-none">
                  <option value="all">📡 TODAS LAS CAJAS</option>
                  {terminals.map(term => (<option key={term.id} value={term.id}>{term.name.toUpperCase()}</option>))}
                </select>
              </div>
              <div className="flex gap-2 items-end"><Button onClick={handleSearch} className="bg-primary text-black border-2 border-black font-black flex-1 h-10 shadow-md"><Search size={14} className="mr-2" /> BUSCAR</Button></div>
            </div>

            {activeReport === 'transactions' && hasSearched && (
              <div className="overflow-x-auto border-2 border-black rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8E8E8] border-b-2 border-black">
                    <tr className="border-b border-black">
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Fecha</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Tipo</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Cliente</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-black">Terminal</th>
                      <th className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-black">Total Bs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="border-b border-black/10 hover:bg-[#F5F5F5] transition-colors">
                        <td className="p-3 text-xs font-black text-black font-mono">{formatLocalDate(t.date)}</td>
                        <td className="p-3"><span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 border-2 border-black/20 uppercase">{t.type.toUpperCase()}</span></td>
                        <td className="p-3 text-xs font-black text-black uppercase">{t.clientName || '—'}</td>
                        <td className="p-3 text-xs font-black text-black uppercase font-mono">{t.terminalId || '—'}</td>
                        <td className="p-3 text-right font-black text-black">{formatBs(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F0F0F0] border-t-2 border-black">
                    <tr className="font-black text-black">
                      <td colSpan={4} className="p-3 text-right text-[10px] uppercase">Total General Filtrado:</td>
                      <td className="p-3 text-right text-base">{formatBs(filteredTransactions.reduce((s, t) => s + t.total, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {activeReport === 'summary' && hasSearched && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-md border-2 border-black border-l-8 border-l-primary">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Ventas Contado (Ingresos)</p>
                  <p className="text-2xl font-black text-green-700 mt-1">{formatUsd(contadoTotalUsd)}</p>
                  <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(contadoTotalUsd * state.exchangeRate)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border-2 border-black border-l-8 border-l-purple-600">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Cobros de Crédito (Ingresos)</p>
                  <p className="text-2xl font-black text-purple-700 mt-1">{formatUsd(cobroTotalUsd)}</p>
                  <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(cobroTotalUsd * state.exchangeRate)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border-2 border-black border-l-8 border-l-orange-500 opacity-80">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Ventas a Crédito (Informativo)</p>
                  <p className="text-2xl font-black text-orange-600 mt-1">{formatUsd(creditoTotalUsd)}</p>
                  <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(creditoTotalUsd * state.exchangeRate)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border-2 border-black border-l-8 border-l-red-600">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Colaboraciones (Costo)</p>
                  <p className="text-2xl font-black text-red-700 mt-1">{formatUsd(colaboracionTotalUsd)}</p>
                  <p className="text-[11px] font-black text-black mt-0.5 font-mono">{formatBs(colaboracionTotalUsd * state.exchangeRate)}</p>
                </div>
              </div>
            )}
          </>
        )}

        {activeReport === 'consolidated' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-primary font-black" />
              <h3 className="text-lg font-black text-black uppercase">Consolidado Mensual de Caja (Sincronizado)</h3>
              {isSyncing && <RefreshCw size={14} className="animate-spin text-blue-600" />}
            </div>
            <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-md">
              <table className="w-full text-sm">
                <thead className="bg-[#E8E8E8] border-b-2 border-black">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-black">
                    <th className="p-3 text-left">Mes / Período</th>
                    <th className="p-3 text-right">Ingresos (+)</th>
                    <th className="p-3 text-right">Egresos (-)</th>
                    <th className="p-3 text-right">Balance Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/5">
                  {monthlyConsolidated.map((row, idx) => {
                    const balanceUsd = row.incomeUsd - row.expenseUsd;
                    return (
                      <tr key={idx} className="hover:bg-[#F5F5F5] transition-colors">
                        <td className="p-3"><p className="font-black text-black uppercase">{row.label}</p><p className="text-[10px] text-black font-black">{row.year}</p></td>
                        <td className="p-3 text-right">
                          <p className="text-green-700 font-black">{formatUsd(row.incomeUsd)}</p>
                          <p className="text-[10px] font-black text-black font-mono">{formatBs(row.incomeUsd * state.exchangeRate)}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-red-700 font-black">{formatUsd(row.expenseUsd)}</p>
                          <p className="text-[10px] font-black text-black font-mono">{formatBs(row.expenseUsd * state.exchangeRate)}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className={cn("font-black", balanceUsd >= 0 ? "text-green-800" : "text-red-800")}>{formatUsd(balanceUsd)}</p>
                          <p className="text-[10px] font-black text-black font-mono">{formatBs(balanceUsd * state.exchangeRate)}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#F0F0F0] border-t-4 border-black">
                  <tr className="font-black text-black">
                    <td className="p-4 uppercase tracking-widest">TOTAL HISTÓRICO</td>
                    <td className="p-4 text-right">
                      <p className="text-green-800 font-black">{formatUsd(monthlyConsolidated.reduce((s, r) => s + r.incomeUsd, 0))}</p>
                      <p className="text-[10px] font-black text-black font-mono">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.incomeUsd, 0) * state.exchangeRate)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-red-800 font-black">{formatUsd(monthlyConsolidated.reduce((s, r) => s + r.expenseUsd, 0))}</p>
                      <p className="text-[10px] font-black text-black font-mono">{formatBs(monthlyConsolidated.reduce((s, r) => s + r.expenseUsd, 0) * state.exchangeRate)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-black text-lg">{formatUsd((monthlyConsolidated.reduce((s, r) => s + r.incomeUsd, 0) - monthlyConsolidated.reduce((s, r) => s + r.expenseUsd, 0)))}</p>
                      <p className="text-[11px] font-black text-black font-mono">{formatBs((monthlyConsolidated.reduce((s, r) => s + r.incomeUsd, 0) - monthlyConsolidated.reduce((s, r) => s + r.expenseUsd, 0)) * state.exchangeRate)}</p>
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
