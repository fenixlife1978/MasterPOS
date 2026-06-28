"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Plus, Search, Pencil, Trash2, X, Truck, 
  Receipt, DollarSign, Calendar, FileText, 
  ChevronDown, ChevronRight, Eye, Package, 
  Filter, Download, Printer, History, HandCoins,
  Wallet, Loader2
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Supplier, SupplierInvoice, PurchaseInvoiceItem, SupplierPayment } from '@/lib/types';
import syncService from '@/services/syncService';
import SupplierPaymentModal from './supplier-payment-modal';
import InvoiceDetailModal from './InvoiceDetailModal';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

export default function SuppliersModule() {
  const state = usePOSState();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(null);

  const [formData, setFormData] = useState({ name: '', rif: '', phone: '', email: '', address: '', contactPerson: '' });
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);

  useEffect(() => {
    const unsubscribe = syncService.subscribeToSuppliersRealtime((data: any[]) => setSuppliers(data));
    const unsubscribePayments = syncService.subscribeToSupplierPayments((data: any[]) => setSupplierPayments(data));
    const unsubscribeInvoices = syncService.subscribeToPurchaseInvoices((data: any[]) => setInvoices(data));
    return () => { unsubscribe(); unsubscribePayments(); unsubscribeInvoices(); };
  }, []);

  const getSupplierDebt = useCallback((supplierId: number) => {
    return invoices.filter(i => i.supplierId === supplierId).reduce((sum, i) => sum + (i.total - (i.paidAmount || 0)), 0);
  }, [invoices]);

  const getTotalPurchases = useCallback((supplierId: number) => {
    return invoices.filter(i => i.supplierId === supplierId).reduce((sum, i) => sum + i.total, 0);
  }, [invoices]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden p-6">
      <div className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Gestión de Proveedores</h2>
          <p className="text-base font-black text-black mt-1 uppercase tracking-widest">Directorio de proveedores y auditoría de compras</p>
        </div>
        <Button onClick={() => { setIsAdding(true); }} className="bg-primary text-black font-black h-14 px-8 border-4 border-black shadow-xl text-sm uppercase tracking-widest">
          <Plus size={24} className="mr-2" /> NUEVO PROVEEDOR
        </Button>
      </div>

      <div className="mb-6 flex-shrink-0">
        <div className="relative max-w-xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black" />
          <Input 
            placeholder="BUSCAR POR NOMBRE O RIF..." 
            className="pl-12 h-12 border-4 border-black text-sm font-black text-black placeholder:text-black/30 bg-white rounded-2xl" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="flex-1 bg-white border-4 border-black rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          <Table>
            <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10 border-b-4 border-black">
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-xs font-black uppercase text-black tracking-widest p-5">Proveedor / RIF</TableHead>
                <TableHead className="text-xs font-black uppercase text-black tracking-widest p-5">Contacto</TableHead>
                <TableHead className="text-xs font-black uppercase text-black tracking-widest text-right p-5">Compras Acum.</TableHead>
                <TableHead className="text-xs font-black uppercase text-black tracking-widest text-right p-5">Saldo Deudor</TableHead>
                <TableHead className="text-xs font-black uppercase text-black tracking-widest text-center p-5">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24 text-black font-black italic text-xl uppercase opacity-20 tracking-tighter">No hay proveedores registrados</TableCell></TableRow>
              ) : (
                filteredSuppliers.map(s => {
                  const totalPurchases = getTotalPurchases(s.id);
                  const debt = getSupplierDebt(s.id);
                  const isExpanded = expandedSupplierId === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <TableRow className="border-b-2 border-black/10 hover:bg-primary/5 cursor-pointer transition-all" onClick={() => setExpandedSupplierId(isExpanded ? null : s.id)}>
                        <TableCell className="p-5">{isExpanded ? <ChevronDown size={24} className="font-black" /> : <ChevronRight size={24} className="font-black" />}</TableCell>
                        <TableCell className="p-5">
                          <p className="font-black text-lg text-black uppercase">{s.name}</p>
                          <p className="font-mono text-xs font-black text-black/60 mt-1 uppercase">{s.rif || '—'}</p>
                        </TableCell>
                        <TableCell className="p-5">
                          <p className="text-sm font-black text-black uppercase">{s.contactPerson || '—'}</p>
                          <p className="text-xs font-black text-blue-700 mt-1">{s.phone}</p>
                        </TableCell>
                        <TableCell className="text-right p-5"><p className="font-mono text-lg text-black font-black">{formatUsd(totalPurchases)}</p></TableCell>
                        <TableCell className="text-right p-5">
                          <span className={cn("font-mono text-xl font-black", debt > 0 ? "text-red-700" : "text-green-700")}>{formatUsd(debt)}</span>
                        </TableCell>
                        <TableCell className="text-center p-5">
                          <div className="flex justify-center gap-3">
                            <button onClick={(e) => { e.stopPropagation(); setEditingSupplier(s); setFormData({ name: s.name, rif: s.rif || '', phone: s.phone, email: s.email || '', address: s.address, contactPerson: s.contactPerson || '' }); setIsAdding(true); }} className="h-10 w-10 rounded-xl border-4 border-black hover:bg-blue-50 text-blue-700 flex items-center justify-center transition-all shadow-lg"><Pencil size={20} /></button>
                            <button onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar proveedor?')) syncService.deleteSupplier(s.id); }} className="h-10 w-10 rounded-xl border-4 border-black hover:bg-red-50 text-red-600 flex items-center justify-center transition-all shadow-lg"><Trash2 size={20} /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="bg-white border-4 border-black text-black max-w-lg p-0 overflow-hidden rounded-3xl shadow-2xl animate-in zoom-in-95">
          <div className="bg-[#1A2C4E] p-6 text-white border-b-4 border-black flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Truck size={28} className="text-primary" />
              <h3 className="text-xl font-black uppercase tracking-widest">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
            </div>
            <button onClick={() => setIsAdding(false)} className="hover:text-primary transition-all"><X size={32} className="font-black" /></button>
          </div>
          <form onSubmit={handleSave} className="p-8 space-y-5">
            <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-1">Nombre / Razón Social *</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 border-2 border-black font-black text-base uppercase rounded-xl" required /></div>
            <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-1">RIF *</label><Input value={formData.rif} onChange={e => setFormData({...formData, rif: e.target.value})} placeholder="J-12345678-0" className="h-12 border-2 border-black font-black text-base uppercase rounded-xl" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-1">Teléfono</label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-12 border-2 border-black font-black text-base rounded-xl" /></div>
              <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-1">Email</label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-12 border-2 border-black font-black text-base rounded-xl" /></div>
            </div>
            <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-1">Dirección</label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="h-12 border-2 border-black font-black text-base rounded-xl uppercase" /></div>
            <div className="bg-[#F5F5F5] -mx-8 -mb-8 p-6 mt-8 border-t-4 border-black flex justify-end gap-4">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="px-8 h-12 font-black text-black uppercase border-2 border-black">Cancelar</Button>
              <Button type="submit" className="px-12 h-12 bg-primary text-black font-black border-4 border-black shadow-xl uppercase tracking-widest">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
