"use client";

import { useState, useEffect, useRef } from 'react';
import { useAccounting } from '@/hooks/use-accounting';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import { Plus, Search, X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ExpenseModal from './expense-modal';

export default function AccountingModule() {
  const { entries, addEntry, getTotalIngresos, getTotalEgresos, getBalance } = useAccounting();
  const { transactions } = usePOSState();
  const { invoices, payments } = useSuppliers();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const hasInitialized = useRef(false);

  // Sincronizar ventas con el libro contable (una sola vez)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Limpiar entradas duplicadas primero
    const uniqueEntries = new Map();
    entries.forEach(entry => {
      const key = `${entry.referenceType}_${entry.referenceId}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, entry);
      }
    });
    
    // Sincronizar ventas
    const saleIds = new Set(entries.filter(e => e.referenceType === 'sale').map(e => e.referenceId));
    transactions.filter(t => t.type === 'contado').forEach(t => {
      if (!saleIds.has(t.id)) {
        addEntry({
          date: t.date.split('T')[0],
          type: 'ingreso',
          category: 'ventas',
          concept: `Venta #${t.id}`,
          description: `Venta al contado - Cliente: ${t.clientName || 'Cliente Final'}`,
          amount: t.total,
          referenceId: t.id,
          referenceType: 'sale'
        });
      }
    });
  }, [transactions.length]);

  // Sincronizar pagos a proveedores (una sola vez)
  useEffect(() => {
    if (!hasInitialized.current) return;
    
    const paymentIds = new Set(entries.filter(e => e.referenceType === 'supplier_payment').map(e => e.referenceId));
    payments.forEach(p => {
      if (!paymentIds.has(p.id)) {
        const invoice = invoices.find(i => i.id === p.invoiceId);
        addEntry({
          date: p.date.split('T')[0],
          type: 'egreso',
          category: 'compra_mercancia',
          concept: `Pago a proveedor - Factura #${invoice?.invoiceNumber || ''}`,
          description: `Pago por compra de mercancía. Método: ${p.method}`,
          amount: p.amount,
          referenceId: p.id,
          referenceType: 'supplier_payment'
        });
      }
    });
  }, [payments.length]);

  // Obtener entradas únicas por id
  const uniqueEntries = Array.from(new Map(entries.map(e => [e.id, e])).values());
  
  const filteredEntries = uniqueEntries.filter(entry => {
    if (filterType !== 'todos' && entry.type !== filterType) return false;
    if (search && !entry.concept.toLowerCase().includes(search.toLowerCase()) && !entry.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (startDate && new Date(entry.date) < new Date(startDate)) return false;
    if (endDate && new Date(entry.date) > new Date(endDate)) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalIngresos = filteredEntries.filter(e => e.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
  const totalEgresos = filteredEntries.filter(e => e.type === 'egreso').reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIngresos - totalEgresos;

  const handleExpenseConfirm = (data: any) => {
    addEntry({
      date: data.date,
      type: 'egreso',
      category: data.category,
      subcategory: data.subcategory,
      concept: data.concept || data.category,
      description: data.description,
      amount: data.amount,
      referenceType: 'expense'
    });
    alert('Egreso registrado correctamente');
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-VE');

  const getCategoryLabel = (categoryId: string) => {
    const categories: Record<string, string> = {
      ventas: 'Ventas',
      compra_mercancia: 'Compra de Mercancía',
      servicios_publicos: 'Servicios Públicos',
      alquiler: 'Alquiler',
      telefonia: 'Telefonía',
      impuestos_municipales: 'Impuestos Municipales',
      declaracion_renta: 'Declaración de Renta',
      servicios_profesionales: 'Servicios Profesionales',
      reparacion_local: 'Reparación de Local',
      sueldos: 'Sueldos',
      otros: 'Otros Gastos'
    };
    return categories[categoryId] || categoryId;
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black">Libro Diario - Contabilidad</h2>
          <p className="text-sm text-black/50 mt-1">Registro de Ingresos y Egresos</p>
        </div>
        <Button onClick={() => setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-black shadow-md">
          <Plus size={18} className="mr-2" /> REGISTRAR EGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><p className="text-xs font-black text-black/60 uppercase">Total Ingresos</p></div>
          <p className="text-2xl font-black text-green-600">Bs {totalIngresos.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={18} className="text-red-600" /><p className="text-xs font-black text-black/60 uppercase">Total Egresos</p></div>
          <p className="text-2xl font-black text-red-600">Bs {totalEgresos.toFixed(2)}</p>
        </div>
        <div className={cn("bg-white rounded-xl border p-4 shadow-sm", balance >= 0 ? "border-green-500" : "border-red-500")}>
          <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className={balance >= 0 ? "text-green-600" : "text-red-600"} /><p className="text-xs font-black text-black/60 uppercase">Balance</p></div>
          <p className={cn("text-2xl font-black", balance >= 0 ? "text-green-600" : "text-red-600")}>Bs {balance.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#9E9E9E]" /></div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm">
            <option value="todos">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
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
                  <TableCell className={cn("text-right font-bold text-sm", entry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>{entry.type === 'ingreso' ? '+' : '-'} Bs {entry.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-center"><button className="text-primary text-[10px] font-bold hover:underline">Ver</button></TableCell>
                </TableRow>
              ))}
              {filteredEntries.length === 0 && (<TableRow><TableCell colSpan={7} className="text-center py-10 text-black/50 italic">No hay movimientos registrados</TableCell></TableRow>)}
            </TableBody>
            <tfoot className="bg-[#F0F0F0] sticky bottom-0">
              <TableRow className="border-t-2 border-[#9E9E9E]"><TableCell colSpan={5} className="p-3 text-right font-black text-black">TOTAL INGRESOS:</TableCell><TableCell className="p-3 text-right font-black text-green-600">+ Bs {totalIngresos.toFixed(2)}</TableCell><TableCell></TableCell></TableRow>
              <TableRow><TableCell colSpan={5} className="p-3 text-right font-black text-black">TOTAL EGRESOS:</TableCell><TableCell className="p-3 text-right font-black text-red-600">- Bs {totalEgresos.toFixed(2)}</TableCell><TableCell></TableCell></TableRow>
              <TableRow className="bg-[#E8E8E8]"><TableCell colSpan={5} className="p-3 text-right font-black text-black">BALANCE:</TableCell><TableCell className={cn("p-3 text-right font-black text-lg", balance >= 0 ? "text-green-600" : "text-red-600")}>Bs {balance.toFixed(2)}</TableCell><TableCell></TableCell></TableRow>
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
                <div className="grid grid-cols-2 gap-2"><p className="text-[10px] font-bold text-black/60">Monto</p><p className={cn("text-lg font-black", selectedEntry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>Bs {selectedEntry.amount.toFixed(2)}</p></div>
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
