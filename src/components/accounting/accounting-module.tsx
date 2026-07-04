
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useAccounting } from '@/hooks/use-accounting';
import { Plus, Search, X, TrendingUp, TrendingDown, DollarSign, Filter, Eye, BarChart3, RefreshCw } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ExpenseModal from './expense-modal';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSyncMissingAccounting } from '@/hooks/useSyncMissingAccounting';

// ✅ Función para obtener timestamp único
const getTimestamp = (): number => Date.now();

// ✅ Función para obtener fecha Venezuela en formato YYYY-MM-DD
const getVenezuelaDate = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

// ✅ Función para formatear fecha de manera amigable
const formatDateFriendly = (dateStr: string): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
};

export default function AccountingModule() {
  const { entries, addEntry } = useAccounting();
  const state = usePOSState();
  const { synced, syncing } = useSyncMissingAccounting(); // ✅ Ejecutar sincronización de faltantes al montar
  const globalExchangeRate = state.exchangeRate || 1;
  
  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const categoriesList = [
    { id: 'ventas', label: 'Ventas' },
    { id: 'compra_mercancia', label: 'Compra de Mercancía' },
    { id: 'pagos_proveedores', label: 'Pagos a Proveedores' },
    { id: 'servicios_publicos', label: 'Servicios Públicos' },
    { id: 'alquiler', label: 'Alquiler' },
    { id: 'telefonia', label: 'Telefonía' },
    { id: 'impuestos_municipales', label: 'Impuestos Municipales' },
    { id: 'declaracion_renta', label: 'Declaración de Renta' },
    { id: 'servicios_profesionales', label: 'Servicios Profesionales' },
    { id: 'reparacion_local', label: 'Reparación de Local' },
    { id: 'sueldos', label: 'Sueldos y Salarios' },
    { id: 'otros', label: 'Otros Gastos' },
    { id: 'devolucion', label: 'Devolución' },
    { id: 'cobro_deuda', label: 'Cobro de Deuda' }
  ];

  // ✅ RECONCILIACIÓN ROBUSTA (RTDB TRUTH)
  const unifiedEntries = useMemo(() => {
    const base = [...entries];
    // Evitar duplicados por referenceId
    const registeredIds = new Set(base.map(e => String(e.referenceId)).filter(id => id !== 'undefined' && id !== 'null'));
    
    const missingFromTx = state.transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const startLimit = new Date('2026-07-02T00:00:00-04:00');
      
      // Reglas: Desde el 02/07, no duplicar, y NO créditos
      return txDate >= startLimit && !registeredIds.has(String(tx.id)) && tx.type !== 'credito' && 
             ['contado', 'cobro_deuda', 'devolucion', 'colaboracion', 'consumo_propio'].includes(tx.type);
    }).map(tx => {
      const isExpense = ['devolucion', 'colaboracion', 'consumo_propio'].includes(tx.type);
      const rate = tx.exchangeRate || globalExchangeRate;
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
        description: tx.clientName ? `Cliente: ${tx.clientName}` : (tx.notes || 'Venta POS'),
        amount: tx.total || 0,
        totalUsd: tx.totalUsd || (tx.total / rate),
        exchangeRate: rate,
        source: 'RTDB'
      };
    });

    return [...base, ...missingFromTx];
  }, [entries, state.transactions, globalExchangeRate]);

  const filteredEntries = unifiedEntries.filter(entry => {
    if (filterType !== 'todos' && entry.type !== filterType) return false;
    if (filterCategory !== 'todas' && entry.category !== filterCategory) return false;
    if (startDate && new Date(entry.date) < new Date(startDate)) return false;
    if (endDate && new Date(entry.date) > new Date(endDate)) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ✅ Cálculos de totales usando USD como ancla absoluta (Requerimiento de estabilidad ante cambio de tasa)
  const totalIngresosUsd = filteredEntries
    .filter(e => e.type === 'ingreso')
    .reduce((sum, e) => sum + (e.totalUsd || (e.amount / (e.exchangeRate || globalExchangeRate))), 0);
  
  const totalEgresosUsd = filteredEntries
    .filter(e => e.type === 'egreso')
    .reduce((sum, e) => sum + (e.totalUsd || (e.amount / (e.exchangeRate || globalExchangeRate))), 0);
    
  const balanceUsd = totalIngresosUsd - totalEgresosUsd;

  // Los bolívares ahora son representativos de la tasa actual según el total de dólares anclados
  const totalIngresosBs = totalIngresosUsd * globalExchangeRate;
  const totalEgresosBs = totalEgresosUsd * globalExchangeRate;
  const balanceBs = totalIngresosBs - totalEgresosBs;

  const handleExpenseConfirm = async (data: any) => {
    if (!addEntry) return;
    const now = getVenezuelaDate();
    const entryId = getTimestamp();
    const rateToSave = data.exchangeRate || globalExchangeRate;
    
    await addEntry({
      id: entryId,
      date: data.date || now,
      type: 'egreso',
      category: data.category,
      subcategory: data.subcategory,
      concept: data.concept || data.category,
      description: data.description || '',
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
      totalUsd: data.amount / rateToSave,
      exchangeRate: rateToSave,
      referenceType: 'expense',
      createdAt: new Date().toISOString()
    });
    setShowExpenseModal(false);
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black uppercase">Libro Diario - Contabilidad</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-black font-black uppercase tracking-widest">Ingresos y Egresos Normalizados (Truth: RTDB)</p>
            {syncing && <div className="flex items-center gap-2 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"><RefreshCw size={12} className="animate-spin text-blue-600" /><span className="text-[10px] font-black text-blue-700">SINCRONIZANDO...</span></div>}
          </div>
        </div>
        <Button onClick={() => setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-black border-2 border-black shadow-lg h-10 px-6 text-sm">
          <Plus size={18} className="mr-2" /> REGISTRAR EGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border-2 border-black p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-green-600 font-black" />
            <p className="text-[10px] font-black text-black uppercase tracking-widest">Total Ingresos</p>
          </div>
          <p className="text-2xl font-black text-green-700">{formatUsd(totalIngresosUsd)}</p>
          <p className="text-xs text-black font-black font-mono mt-0.5">{formatBs(totalIngresosBs)}</p>
        </div>
        
        <div className="bg-white rounded-xl border-2 border-black p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-red-600 font-black" />
            <p className="text-[10px] font-black text-black uppercase tracking-widest">Total Egresos</p>
          </div>
          <p className="text-2xl font-black text-red-700">{formatUsd(totalEgresosUsd)}</p>
          <p className="text-xs text-black font-black font-mono mt-0.5">{formatBs(totalEgresosBs)}</p>
        </div>
        
        <div className={cn("bg-white rounded-xl border-2 p-4 shadow-md", balanceUsd >= 0 ? "border-green-600" : "border-red-600")}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className={balanceUsd >= 0 ? "text-green-600" : "text-red-600"} />
            <p className="text-[10px] font-black text-black uppercase tracking-widest">Balance de Caja</p>
          </div>
          <p className={cn("text-3xl font-black", balanceUsd >= 0 ? "text-green-700" : "text-red-700")}>
            {formatUsd(balanceUsd)}
          </p>
          <p className={cn("text-xs font-black font-mono mt-1", balanceUsd >= 0 ? "text-green-600" : "text-red-600")}>
            {formatBs(balanceBs)}
          </p>
        </div>
      </div>

      <div className="bg-white border-2 border-black rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Tipo de Movimiento</label>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setFilterCategory('todas'); }} className="w-full h-9 bg-white border-2 border-black rounded-lg px-3 text-xs font-black focus:outline-none">
              <option value="todos">Todos los Tipos</option>
              <option value="ingreso">Solo Ingresos</option>
              <option value="egreso">Solo Egresos</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Categoría</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-9 bg-white border-2 border-black rounded-lg px-3 text-xs font-black focus:outline-none">
              <option value="todas">Todas las Categorías</option>
              {categoriesList.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Desde Fecha</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 border-2 border-black text-xs font-black" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Hasta Fecha</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 border-2 border-black text-xs font-black" />
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-md flex-1">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b-2 border-black">
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3">Fecha</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3">Tipo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3">Concepto / Descripción</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3 text-right">Monto USD</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3 text-right">Monto Bs</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-black font-black italic text-sm">No hay registros contables en este período</TableCell></TableRow>
            ) : (
              filteredEntries.map((entry, idx) => (
                <TableRow 
                  key={`${entry.id}_${idx}`} 
                  className="border-b border-black/10 hover:bg-primary/5 cursor-pointer transition-colors" 
                  onClick={() => { setSelectedEntry(entry); setShowEntryDetail(true); }}
                >
                  <TableCell className="text-xs font-black text-black p-3">{formatDateFriendly(entry.date)}</TableCell>
                  <TableCell className="p-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border-2", entry.type === 'ingreso' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                      {entry.type.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="p-3">
                    <p className="text-xs font-black text-black uppercase flex items-center gap-2">
                      {entry.concept}
                      {entry.source === 'RTDB' && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded">AUTO</span>}
                    </p>
                    <p className="text-[10px] font-black text-black truncate max-w-xs">{entry.description || entry.concept}</p>
                  </TableCell>
                  <TableCell className={cn("text-right font-black text-sm p-3", entry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>
                    {entry.type === 'ingreso' ? '+' : '-'} {formatUsd(entry.totalUsd || (entry.amount / (entry.exchangeRate || globalExchangeRate)))}
                  </TableCell>
                  <TableCell className="text-right text-xs font-black text-black font-mono p-3">
                    {formatBs(entry.amount)}
                  </TableCell>
                  <TableCell className="text-center p-3">
                    <button className="text-blue-600 hover:scale-110 p-1 rounded-lg transition-transform"><Eye size={16} /></button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ExpenseModal 
        open={showExpenseModal} 
        onClose={() => setShowExpenseModal(false)} 
        onConfirm={handleExpenseConfirm} 
        exchangeRate={globalExchangeRate}
      />

      <Dialog open={showEntryDetail} onOpenChange={setShowEntryDetail}>
        <DialogContent className="bg-white border-2 border-black text-black max-w-lg p-0 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Movimiento</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BarChart3 size={20} className="text-primary" />
                  <h3 className="text-lg font-black uppercase tracking-widest">Detalle Contable</h3>
                </div>
                <button onClick={() => setShowEntryDetail(false)} className="hover:text-primary transition-all"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-black/10">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Fecha y Hora</p>
                  <p className="text-sm font-black text-black text-right">{formatDateFriendly(selectedEntry.date)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-black/10">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Monto Divisas</p>
                  <p className={cn("text-xl font-black text-right", selectedEntry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>
                    {formatUsd(selectedEntry.totalUsd || (selectedEntry.amount / (selectedEntry.exchangeRate || globalExchangeRate)))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-black/10">
                  <p className="text-[10px] font-black text-black uppercase tracking-widest">Equivalente Bs</p>
                  <p className="text-base font-black font-mono text-black text-right">{formatBs(selectedEntry.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1.5">Descripción del Movimiento</p>
                  <div className="bg-slate-50 p-4 rounded-xl border border-black/10 text-sm font-black text-black leading-tight uppercase">
                    {selectedEntry.description || selectedEntry.concept}
                  </div>
                </div>
                <div className="pt-2 text-center">
                  <div className="inline-block bg-primary/10 px-3 py-1 rounded-full">
                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Tasa BCV Aplicada: {formatBsNumber(selectedEntry.exchangeRate || globalExchangeRate)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t border-black/10 flex justify-center">
                <Button onClick={() => setShowEntryDetail(false)} className="bg-black text-white font-black px-8 h-10 text-xs uppercase tracking-widest hover:bg-primary hover:text-black transition-all">CERRAR DETALLE</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
