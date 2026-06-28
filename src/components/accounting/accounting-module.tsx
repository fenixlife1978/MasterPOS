"use client";

import { useState } from 'react';
import { useAccounting } from '@/hooks/use-accounting';
import { Plus, Search, X, TrendingUp, TrendingDown, DollarSign, Filter } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ExpenseModal from './expense-modal';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { usePOSState } from '@/hooks/use-pos-state';

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
  const { entries, addEntry, getTotalIngresos, getTotalEgresos } = useAccounting();
  const state = usePOSState();
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
    { id: 'cobro_deuda', label: 'Cobro de Deuda' },
    { id: 'cuenta_por_cobrar', label: 'Venta a Crédito' }
  ];

  const filteredEntries = (entries || []).filter(entry => {
    if (filterType !== 'todos' && entry.type !== filterType) return false;
    if (filterCategory !== 'todas' && entry.category !== filterCategory) return false;
    if (startDate && new Date(entry.date) < new Date(startDate)) return false;
    if (endDate && new Date(entry.date) > new Date(endDate)) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalIngresosBs = filteredEntries.filter(e => e.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
  const totalEgresosBs = filteredEntries.filter(e => e.type === 'egreso').reduce((sum, e) => sum + e.amount, 0);
  const balanceBs = totalIngresosBs - totalEgresosBs;
  
  const totalIngresosUsd = filteredEntries
    .filter(e => e.type === 'ingreso')
    .reduce((sum, e) => sum + (e.totalUsd || (e.amount / (e.exchangeRate || globalExchangeRate))), 0);
  
  const totalEgresosUsd = filteredEntries
    .filter(e => e.type === 'egreso')
    .reduce((sum, e) => sum + (e.totalUsd || (e.amount / (e.exchangeRate || globalExchangeRate))), 0);
    
  const balanceUsd = totalIngresosUsd - totalEgresosUsd;

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

  const getCategoryLabel = (categoryId: string) => {
    const found = categoriesList.find(c => c.id === categoryId);
    return found ? found.label : categoryId;
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black">Libro Diario - Contabilidad</h2>
          <p className="text-sm font-black text-black mt-1 uppercase">Registro de Ingresos y Egresos en Tiempo Real</p>
        </div>
        <Button onClick={() => setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-black border-2 border-black shadow-lg h-12 px-6">
          <Plus size={20} className="mr-2" /> REGISTRAR EGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border-2 border-black p-4 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-green-700" />
            <p className="text-[11px] font-black text-black uppercase tracking-widest">Total Ingresos</p>
          </div>
          <p className="text-2xl font-black text-green-700">{formatUsd(totalIngresosUsd)}</p>
          <p className="text-[11px] text-black font-black font-mono">{formatBs(totalIngresosBs)}</p>
        </div>
        
        <div className="bg-white rounded-xl border-2 border-black p-4 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={20} className="text-red-700" />
            <p className="text-[11px] font-black text-black uppercase tracking-widest">Total Egresos</p>
          </div>
          <p className="text-2xl font-black text-red-700">{formatUsd(totalEgresosUsd)}</p>
          <p className="text-[11px] text-black font-black font-mono">{formatBs(totalEgresosBs)}</p>
        </div>
        
        <div className={cn("bg-white rounded-xl border-4 p-4 shadow-lg", balanceUsd >= 0 ? "border-green-600" : "border-red-600")}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} className={balanceUsd >= 0 ? "text-green-700" : "text-red-700"} />
            <p className="text-[11px] font-black text-black uppercase tracking-widest">Balance de Caja</p>
          </div>
          <p className={cn("text-3xl font-black", balanceUsd >= 0 ? "text-green-700" : "text-red-700")}>
            {formatUsd(balanceUsd)}
          </p>
          <p className={cn("text-sm font-black font-mono mt-1", balanceUsd >= 0 ? "text-green-800" : "text-red-800")}>
            {formatBs(balanceBs)}
          </p>
        </div>
      </div>

      <div className="bg-white border-2 border-black rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setFilterCategory('todas'); }} className="h-10 bg-white border-2 border-black rounded-lg px-3 text-sm font-black focus:ring-2 focus:ring-primary">
            <option value="todos">Todos los Tipos</option>
            <option value="ingreso">Solo Ingresos</option>
            <option value="egreso">Solo Egresos</option>
          </select>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-10 bg-white border-2 border-black rounded-lg px-3 text-sm font-black focus:ring-2 focus:ring-primary">
            <option value="todas">Todas las Categorías</option>
            {categoriesList.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>

          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 border-2 border-black font-black" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 border-2 border-black font-black" />
        </div>
      </div>

      <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-xl">
        <Table>
          <TableHeader className="bg-[#E8E8E8] border-b-2 border-black sticky top-0">
            <TableRow>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Fecha</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Tipo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Concepto</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Monto USD</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Monto Bs</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-center">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry, idx) => (
              <TableRow 
                key={`${entry.id}_${idx}`} 
                className="border-b border-black/10 hover:bg-primary/5 cursor-pointer" 
                onClick={() => { setSelectedEntry(entry); setShowEntryDetail(true); }}
              >
                <TableCell className="text-xs font-black text-black">{formatDateFriendly(entry.date)}</TableCell>
                <TableCell>
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", entry.type === 'ingreso' ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300")}>
                    {entry.type.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-black text-black">{entry.concept}</TableCell>
                <TableCell className={cn("text-right font-black text-sm", entry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>
                  {entry.type === 'ingreso' ? '+' : '-'} {formatUsd(entry.totalUsd || (entry.amount / (entry.exchangeRate || globalExchangeRate)))}
                </TableCell>
                <TableCell className="text-right text-[10px] font-black text-black font-mono">
                  {formatBs(entry.amount)}
                </TableCell>
                <TableCell className="text-center">
                  <button className="text-blue-700 hover:bg-blue-100 p-1 rounded transition-colors"><Eye size={16} className="font-black" /></button>
                </TableCell>
              </TableRow>
            ))}
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
        <DialogContent className="bg-white border-4 border-black text-black max-w-md p-0 rounded-2xl shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Movimiento</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white border-b-2 border-black flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-widest">Detalle Contable</h3>
                <button onClick={() => setShowEntryDetail(false)}><X size={24} className="font-black" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 border-b border-black/10 pb-2">
                  <p className="text-[11px] font-black text-black/60 uppercase">Fecha</p>
                  <p className="text-sm font-black text-black">{formatDateFriendly(selectedEntry.date)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-black/10 pb-2">
                  <p className="text-[11px] font-black text-black/60 uppercase">Monto USD</p>
                  <p className={cn("text-xl font-black", selectedEntry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>
                    {formatUsd(selectedEntry.totalUsd || (selectedEntry.amount / (selectedEntry.exchangeRate || globalExchangeRate)))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-black/10 pb-2">
                  <p className="text-[11px] font-black text-black/60 uppercase">Equivalente Bs</p>
                  <p className="text-sm font-black font-mono text-black">{formatBs(selectedEntry.amount)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black text-black/60 uppercase mb-1">Descripción</p>
                  <div className="bg-slate-50 p-3 rounded-lg border-2 border-black/5 text-sm font-black text-black leading-relaxed">
                    {selectedEntry.description || selectedEntry.concept}
                  </div>
                </div>
                <div className="pt-2 text-center">
                  <p className="text-[10px] font-black text-black/40 uppercase">Tasa BCV Aplicada: {formatBsNumber(selectedEntry.exchangeRate || globalExchangeRate)}</p>
                </div>
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t-2 border-black flex justify-end">
                <Button onClick={() => setShowEntryDetail(false)} className="bg-primary text-black font-black border-2 border-black px-8">CERRAR</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
