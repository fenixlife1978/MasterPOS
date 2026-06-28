"use client";

import { useState } from 'react';
import { useAccounting } from '@/hooks/use-accounting';
import { Plus, Search, X, TrendingUp, TrendingDown, DollarSign, Filter, Eye } from 'lucide-react';
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

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black uppercase">Libro Diario - Contabilidad</h2>
          <p className="text-base font-black text-black mt-1 uppercase tracking-widest">Registro de Ingresos y Egresos en Tiempo Real</p>
        </div>
        <Button onClick={() => setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-black border-4 border-black shadow-xl h-14 px-8 text-base">
          <Plus size={24} className="mr-2" /> REGISTRAR EGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl border-4 border-black p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={24} className="text-green-700" />
            <p className="text-xs font-black text-black uppercase tracking-widest">Total Ingresos</p>
          </div>
          <p className="text-3xl font-black text-green-700">{formatUsd(totalIngresosUsd)}</p>
          <p className="text-sm text-black font-black font-mono mt-1">{formatBs(totalIngresosBs)}</p>
        </div>
        
        <div className="bg-white rounded-2xl border-4 border-black p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={24} className="text-red-700" />
            <p className="text-xs font-black text-black uppercase tracking-widest">Total Egresos</p>
          </div>
          <p className="text-3xl font-black text-red-700">{formatUsd(totalEgresosUsd)}</p>
          <p className="text-sm text-black font-black font-mono mt-1">{formatBs(totalEgresosBs)}</p>
        </div>
        
        <div className={cn("bg-white rounded-2xl border-4 p-5 shadow-2xl", balanceUsd >= 0 ? "border-green-600" : "border-red-600")}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={24} className={balanceUsd >= 0 ? "text-green-700" : "text-red-700"} />
            <p className="text-xs font-black text-black uppercase tracking-widest">Balance de Caja</p>
          </div>
          <p className={cn("text-4xl font-black", balanceUsd >= 0 ? "text-green-700" : "text-red-700")}>
            {formatUsd(balanceUsd)}
          </p>
          <p className={cn("text-base font-black font-mono mt-2", balanceUsd >= 0 ? "text-green-800" : "text-red-800")}>
            {formatBs(balanceBs)}
          </p>
        </div>
      </div>

      <div className="bg-white border-4 border-black rounded-2xl p-6 mb-8 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="text-[11px] font-black uppercase text-black tracking-widest mb-1 block">Tipo de Movimiento</label>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setFilterCategory('todas'); }} className="w-full h-11 bg-white border-2 border-black rounded-xl px-4 text-sm font-black focus:ring-4 focus:ring-primary/20">
              <option value="todos">Todos los Tipos</option>
              <option value="ingreso">Solo Ingresos</option>
              <option value="egreso">Solo Egresos</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-black tracking-widest mb-1 block">Categoría</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-11 bg-white border-2 border-black rounded-xl px-4 text-sm font-black focus:ring-4 focus:ring-primary/20">
              <option value="todas">Todas las Categorías</option>
              {categoriesList.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-black tracking-widest mb-1 block">Desde Fecha</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 border-2 border-black font-black rounded-xl" />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase text-black tracking-widest mb-1 block">Hasta Fecha</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 border-2 border-black font-black rounded-xl" />
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-black rounded-2xl overflow-hidden shadow-2xl flex-1">
        <Table>
          <TableHeader className="bg-[#1A2C4E] border-b-2 border-black">
            <TableRow>
              <TableHead className="text-xs font-black text-white uppercase tracking-widest p-4">Fecha</TableHead>
              <TableHead className="text-xs font-black text-white uppercase tracking-widest p-4">Tipo</TableHead>
              <TableHead className="text-xs font-black text-white uppercase tracking-widest p-4">Concepto / Descripción</TableHead>
              <TableHead className="text-xs font-black text-white uppercase tracking-widest p-4 text-right">Monto USD</TableHead>
              <TableHead className="text-xs font-black text-white uppercase tracking-widest p-4 text-right">Monto Bs</TableHead>
              <TableHead className="text-xs font-black text-white uppercase tracking-widest p-4 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-24 text-black/20 font-black uppercase text-2xl italic tracking-tighter">No hay registros contables</TableCell></TableRow>
            ) : (
              filteredEntries.map((entry, idx) => (
                <TableRow 
                  key={`${entry.id}_${idx}`} 
                  className="border-b-2 border-black/5 hover:bg-primary/5 cursor-pointer transition-colors" 
                  onClick={() => { setSelectedEntry(entry); setShowEntryDetail(true); }}
                >
                  <TableCell className="text-sm font-black text-black p-4">{formatDateFriendly(entry.date)}</TableCell>
                  <TableCell className="p-4">
                    <span className={cn("px-4 py-1 rounded-full text-[10px] font-black border-2", entry.type === 'ingreso' ? "bg-green-50 text-green-700 border-green-600" : "bg-red-50 text-red-700 border-red-600")}>
                      {entry.type.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="p-4">
                    <p className="text-sm font-black text-black uppercase">{entry.concept}</p>
                    <p className="text-[11px] font-black text-black/60 truncate max-w-md">{entry.description || entry.concept}</p>
                  </TableCell>
                  <TableCell className={cn("text-right font-black text-base p-4", entry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>
                    {entry.type === 'ingreso' ? '+' : '-'} {formatUsd(entry.totalUsd || (entry.amount / (entry.exchangeRate || globalExchangeRate)))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-black text-black font-mono p-4">
                    {formatBs(entry.amount)}
                  </TableCell>
                  <TableCell className="text-center p-4">
                    <button className="text-blue-700 hover:scale-110 p-2 rounded-lg transition-transform"><Eye size={22} className="font-black" /></button>
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
        <DialogContent className="bg-white border-4 border-black text-black max-w-lg p-0 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Movimiento</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-5 text-white border-b-2 border-black flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <BarChart3 size={24} className="text-primary" />
                  <h3 className="text-xl font-black uppercase tracking-widest">Detalle Contable</h3>
                </div>
                <button onClick={() => setShowEntryDetail(false)} className="hover:text-primary transition-all"><X size={28} className="font-black" /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-black/10">
                  <p className="text-[12px] font-black text-black/40 uppercase tracking-widest">Fecha y Hora</p>
                  <p className="text-sm font-black text-black text-right">{formatDateFriendly(selectedEntry.date)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-black/10">
                  <p className="text-[12px] font-black text-black/40 uppercase tracking-widest">Monto Divisas</p>
                  <p className={cn("text-2xl font-black text-right", selectedEntry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>
                    {formatUsd(selectedEntry.totalUsd || (selectedEntry.amount / (selectedEntry.exchangeRate || globalExchangeRate)))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-black/10">
                  <p className="text-[12px] font-black text-black/40 uppercase tracking-widest">Equivalente Bs</p>
                  <p className="text-lg font-black font-mono text-black text-right">{formatBs(selectedEntry.amount)}</p>
                </div>
                <div>
                  <p className="text-[12px] font-black text-black/40 uppercase tracking-widest mb-2">Descripción del Movimiento</p>
                  <div className="bg-slate-100 p-5 rounded-2xl border-2 border-black/10 text-base font-black text-black leading-tight uppercase">
                    {selectedEntry.description || selectedEntry.concept}
                  </div>
                </div>
                <div className="pt-4 text-center">
                  <div className="inline-block bg-primary/20 px-4 py-1.5 rounded-full border-2 border-primary/40">
                    <p className="text-[11px] font-black text-black uppercase tracking-widest">Tasa BCV Aplicada: {formatBsNumber(selectedEntry.exchangeRate || globalExchangeRate)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#F5F5F5] p-5 border-t-2 border-black flex justify-center">
                <Button onClick={() => setShowEntryDetail(false)} className="bg-black text-white font-black border-2 border-black px-12 h-12 text-sm uppercase tracking-widest hover:bg-primary hover:text-black transition-all">CERRAR DETALLE</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
