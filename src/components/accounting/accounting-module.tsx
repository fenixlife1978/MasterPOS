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

export default function AccountingModule() {
  const { entries, addEntry, getTotalIngresos, getTotalEgresos } = useAccounting();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Mapeo de categorías para el filtro
  const categoriesList = [
    { id: 'ventas', label: 'Ventas' },
    { id: 'compra_mercancia', label: 'Compra de Mercancía' },
    { id: 'servicios_publicos', label: 'Servicios Públicos' },
    { id: 'alquiler', label: 'Alquiler' },
    { id: 'telefonia', label: 'Telefonía' },
    { id: 'impuestos_municipales', label: 'Impuestos Municipales' },
    { id: 'declaracion_renta', label: 'Declaración de Renta' },
    { id: 'servicios_profesionales', label: 'Servicios Profesionales' },
    { id: 'reparacion_local', label: 'Reparación de Local' },
    { id: 'sueldos', label: 'Sueldos' },
    { id: 'otros', label: 'Otros Gastos' },
    { id: 'devolucion', label: 'Devolución' },
    { id: 'cobro_deuda', label: 'Cobro de Deuda' },
    { id: 'cuenta_por_cobrar', label: 'Venta a Crédito' }
  ];

  // Filtrar entradas basadas en búsqueda, tipo, categoría y fechas
  const filteredEntries = (entries || []).filter(entry => {
    if (filterType !== 'todos' && entry.type !== filterType) return false;
    if (filterCategory !== 'todas' && entry.category !== filterCategory) return false;
    if (search && !entry.concept?.toLowerCase().includes(search.toLowerCase()) && !entry.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (startDate && new Date(entry.date) < new Date(startDate)) return false;
    if (endDate && new Date(entry.date) > new Date(endDate)) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalIngresos = getTotalIngresos ? getTotalIngresos() : 0;
  const totalEgresos = getTotalEgresos ? getTotalEgresos() : 0;
  const balance = totalIngresos - totalEgresos;

  // ✅ Función corregida - genera el id antes de guardar
  const handleExpenseConfirm = async (data: any) => {
    if (!addEntry) {
      console.error('addEntry no está disponible');
      alert('Error: No se puede registrar el egreso');
      return;
    }
    
    const now = getVenezuelaDate();
    const entryId = getTimestamp();
    
    await addEntry({
      id: entryId,  // ✅ ID generado automáticamente
      date: data.date || now,
      type: 'egreso',
      category: data.category,
      subcategory: data.subcategory,
      concept: data.concept || data.category,
      description: data.description || '',
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
      referenceType: 'expense',
      createdAt: new Date().toISOString()
    });
    
    alert('Egreso registrado correctamente');
    setShowExpenseModal(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
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
          <p className="text-sm text-black/50 mt-1">Registro de Ingresos y Egresos en Tiempo Real</p>
        </div>
        <Button onClick={() => setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-black shadow-md">
          <Plus size={18} className="mr-2" /> REGISTRAR EGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><p className="text-xs font-black text-black/60 uppercase">Total Ingresos</p></div>
          <p className="text-2xl font-black text-green-600">{formatBs(totalIngresos)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={18} className="text-red-600" /><p className="text-xs font-black text-black/60 uppercase">Total Egresos</p></div>
          <p className="text-2xl font-black text-red-600">{formatBs(totalEgresos)}</p>
        </div>
        <div className={cn("bg-white rounded-xl border p-4 shadow-sm", balance >= 0 ? "border-green-500" : "border-red-500")}>
          <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className={balance >= 0 ? "text-green-600" : "text-red-600"} /><p className="text-xs font-black text-black/60 uppercase">Balance</p></div>
          <p className={cn("text-2xl font-black", balance >= 0 ? "text-green-600" : "text-red-600")}>{formatBs(balance)}</p>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" />
            <Input placeholder="Buscar por concepto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#9E9E9E]" />
          </div>
          
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setFilterCategory('todas'); }} className="h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="todos">Todos los Tipos</option>
            <option value="ingreso">Solo Ingresos</option>
            <option value="egreso">Solo Egresos</option>
          </select>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="todas">Todas las Categorías</option>
            {categoriesList.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>

          <Input type="date" placeholder="Desde" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border-[#9E9E9E]" />
          <Input type="date" placeholder="Hasta" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border-[#9E9E9E]" />
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-[#E8E8E8] sticky top-0">
              <TableRow className="border-b border-[#9E9E9E]">
                <TableHead className="text-[10px] font-black text-black uppercase">Fecha</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase">Tipo</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase">Categoría</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase">Concepto</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase">Descripción</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase text-right">Monto</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry, idx) => (
                <TableRow key={`${entry.id}_${idx}`} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] cursor-pointer" onClick={() => { setSelectedEntry(entry); setShowEntryDetail(true); }}>
                  <TableCell className="text-xs text-black/60">{formatDate(entry.date)}</TableCell>
                  <TableCell><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", entry.type === 'ingreso' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{entry.type === 'ingreso' ? 'INGRESO' : 'EGRESO'}</span></TableCell>
                  <TableCell className="text-xs text-black/80">{getCategoryLabel(entry.category)}</TableCell>
                  <TableCell className="text-xs font-medium text-black">{entry.concept}</TableCell>
                  <TableCell className="text-xs text-black/60 max-w-[200px] truncate">{entry.description}</TableCell>
                  <TableCell className={cn("text-right font-bold text-sm", entry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>{entry.type === 'ingreso' ? '+' : '-'} {formatBs(entry.amount)}</TableCell>
                  <TableCell className="text-center"><button className="text-primary text-[10px] font-bold hover:underline">Ver</button></TableCell>
                </TableRow>
              ))}
              {filteredEntries.length === 0 && (<TableRow><TableCell colSpan={7} className="text-center py-10 text-black/50 italic">No hay movimientos que coincidan con los filtros</TableCell></TableRow>)}
            </TableBody>
            <tfoot className="bg-[#F0F0F0] sticky bottom-0">
              <TableRow className="border-t-2 border-[#9E9E9E]"><TableCell colSpan={5} className="p-3 text-right font-black text-black">TOTAL FILTRADO INGRESOS:</TableCell><TableCell className="p-3 text-right font-black text-green-600">+ {formatBs(totalIngresos)}</TableCell><TableCell></TableCell></TableRow>
              <TableRow><TableCell colSpan={5} className="p-3 text-right font-black text-black">TOTAL FILTRADO EGRESOS:</TableCell><TableCell className="p-3 text-right font-black text-red-600">- {formatBs(totalEgresos)}</TableCell><TableCell></TableCell></TableRow>
              <TableRow className="bg-[#E8E8E8]"><TableCell colSpan={5} className="p-3 text-right font-black text-black">BALANCE PERIODO:</TableCell><TableCell className={cn("p-3 text-right font-black text-lg", balance >= 0 ? "text-green-600" : "text-red-600")}>{formatBs(balance)}</TableCell><TableCell></TableCell></TableRow>
            </tfoot>
          </Table>
        </div>
      </div>

      <ExpenseModal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} onConfirm={handleExpenseConfirm} />

      <Dialog open={showEntryDetail} onOpenChange={setShowEntryDetail}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Movimiento</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white"><div className="flex justify-between"><h3 className="text-lg font-black">Detalle del Movimiento</h3><button onClick={() => setShowEntryDetail(false)}><X size={18} /></button></div></div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Fecha</p><p className="text-sm font-bold text-black">{formatDate(selectedEntry.date)}</p></div>
                <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Tipo</p><p className={cn("text-sm font-bold", selectedEntry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>{selectedEntry.type === 'ingreso' ? 'INGRESO' : 'EGRESO'}</p></div>
                <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Categoría</p><p className="text-sm text-black">{getCategoryLabel(selectedEntry.category)}</p></div>
                {selectedEntry.subcategory && <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Subcategoría</p><p className="text-sm text-black">{selectedEntry.subcategory}</p></div>}
                <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Concepto</p><p className="text-sm font-medium text-black">{selectedEntry.concept}</p></div>
                <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Monto</p><p className={cn("text-lg font-black", selectedEntry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>{formatBs(selectedEntry.amount)}</p></div>
                {selectedEntry.description && <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Descripción</p><p className="text-sm text-black/70">{selectedEntry.description}</p></div>}
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t flex justify-end"><Button onClick={() => setShowEntryDetail(false)}>CERRAR</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}