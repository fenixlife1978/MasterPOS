"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import { 
  Plus, Search, Pencil, Trash2, X, Truck, 
  Receipt, DollarSign, Calendar, FileText, 
  ChevronDown, ChevronRight, Eye, Package, 
  Filter, Download, Printer, History
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Supplier, SupplierInvoice, SupplierPayment, Product } from '@/lib/types';
import { syncService } from '@/services/syncService';

interface PurchaseHistoryItem {
  id: string;
  productId: number;
  productName: string;
  qty: number;
  costUsd: number;
  totalUsd: number;
}

interface ExpandedInvoice {
  invoiceId: number;
  items: PurchaseHistoryItem[];
}

// Extender SupplierInvoice para propiedades adicionales
interface ExtendedSupplierInvoice extends SupplierInvoice {
  itemsCount?: number;
  exchangeRate?: number;
}

export default function SuppliersModule() {
  const state = usePOSState();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Supplier | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<ExpandedInvoice | null>(null);
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    rif: '',
    phone: '',
    email: '',
    address: '',
    contactPerson: ''
  });
  const { toast } = useToast();

  // Cargar facturas desde Firestore
  const [invoices, setInvoices] = useState<ExtendedSupplierInvoice[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<Record<number, PurchaseHistoryItem[]>>({});

  // Suscribirse a facturas de compras desde Firestore
  useEffect(() => {
    const unsubscribeInvoices = syncService.subscribeToPurchaseInvoices((data) => {
      setInvoices(data);
    });
    
    const unsubscribeItems = syncService.subscribeToPurchaseItems((data) => {
      // Agrupar items por invoiceId
      const grouped = data.reduce((acc, item) => {
        const invoiceId = item.invoiceId;
        if (!acc[invoiceId]) acc[invoiceId] = [];
        acc[invoiceId].push({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          qty: item.qty,
          costUsd: item.costUsd,
          totalUsd: item.totalUsd
        });
        return acc;
      }, {} as Record<number, PurchaseHistoryItem[]>);
      setPurchaseItems(grouped);
    });
    
    return () => {
      unsubscribeInvoices();
      unsubscribeItems();
    };
  }, []);

  // Filtrar proveedores
  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.rif.toLowerCase().includes(q)
    );
  }, [search, suppliers]);

  // Filtrar facturas por proveedor y fechas
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    if (filterSupplier !== 'all') {
      filtered = filtered.filter(i => i.supplierId === parseInt(filterSupplier));
    }
    if (filterDateStart) {
      filtered = filtered.filter(i => i.date >= filterDateStart);
    }
    if (filterDateEnd) {
      filtered = filtered.filter(i => i.date <= filterDateEnd);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, filterSupplier, filterDateStart, filterDateEnd]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplierData: Supplier = {
      id: editingSupplier?.id || Date.now(),
      name: formData.name,
      rif: formData.rif,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      contactPerson: formData.contactPerson,
      totalDebt: editingSupplier?.totalDebt || 0,
      createdAt: editingSupplier?.createdAt || new Date().toISOString()
    };

    if (editingSupplier) {
      await updateSupplier(supplierData);
      toast({ title: "Actualizado", description: "Proveedor modificado correctamente." });
    } else {
      await addSupplier(supplierData);
      toast({ title: "Creado", description: "Nuevo proveedor registrado." });
    }
    setIsAdding(false);
    setEditingSupplier(null);
    resetForm();
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      rif: supplier.rif,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      contactPerson: supplier.contactPerson
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      rif: '',
      phone: '',
      email: '',
      address: '',
      contactPerson: ''
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getTotalPurchases = (supplierId: number) => {
    return invoices
      .filter(i => i.supplierId === supplierId)
      .reduce((sum, i) => sum + i.total, 0);
  };

  const getTotalPaid = (supplierId: number) => {
    return invoices
      .filter(i => i.supplierId === supplierId)
      .reduce((sum, i) => sum + i.paidAmount, 0);
  };

  // Modal de Historial de Compras
  const PurchaseHistoryModal = ({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) => {
    const supplierInvoices = filteredInvoices.filter(i => i.supplierId === supplier.id);
    const totalPurchases = supplierInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalPaid = supplierInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
    const totalDebt = totalPurchases - totalPaid;

    const toggleInvoiceExpand = (invoiceId: number) => {
      if (expandedInvoice?.invoiceId === invoiceId) {
        setExpandedInvoice(null);
      } else {
        setExpandedInvoice({
          invoiceId,
          items: purchaseItems[invoiceId] || []
        });
      }
    };

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-xl shadow-xl max-h-[90vh]">
          <DialogHeader className="sr-only"><DialogTitle>Historial de Compras - {supplier.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col h-full">
            <div className="bg-[#1A2C4E] p-4 text-white sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2"><History size={16} /> Historial de Compras</h3>
                  <p className="text-sm font-bold">{supplier.name}</p>
                  <p className="text-[10px] opacity-70">RIF: {supplier.rif}</p>
                </div>
                <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-2 text-center border">
                  <p className="text-[8px] font-black uppercase text-slate-500">Total Compras</p>
                  <p className="text-lg font-black text-black">${totalPurchases.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center border">
                  <p className="text-[8px] font-black uppercase text-slate-500">Total Pagado</p>
                  <p className="text-lg font-black text-green-600">${totalPaid.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center border">
                  <p className="text-[8px] font-black uppercase text-slate-500">Saldo Pendiente</p>
                  <p className={cn("text-lg font-black", totalDebt > 0 ? "text-red-600" : "text-green-600")}>${totalDebt.toFixed(2)}</p>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-[#F5F5F5] p-3 rounded-lg mb-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[8px] font-black uppercase text-black/40">Desde</label>
                    <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="w-full h-7 border rounded px-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase text-black/40">Hasta</label>
                    <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="w-full h-7 border rounded px-2 text-xs" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); }} variant="ghost" size="sm" className="h-7 text-xs">LIMPIAR FILTROS</Button>
                  </div>
                </div>
              </div>

              {/* Lista de Facturas */}
              {supplierInvoices.length === 0 ? (
                <div className="text-center py-8 text-black/40">
                  <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No hay compras registradas para este proveedor</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supplierInvoices.map(inv => {
                    const isExpanded = expandedInvoice?.invoiceId === inv.id;
                    const items = purchaseItems[inv.id] || [];
                    const itemsCount = inv.itemsCount || items.length;
                    const exchangeRate = (inv as any).exchangeRate || 'N/A';
                    
                    return (
                      <div key={inv.id} className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                        {/* Cabecera de factura - clickeable */}
                        <div 
                          className={cn(
                            "flex justify-between items-center p-3 cursor-pointer transition-colors",
                            isExpanded ? "bg-[#1A2C4E] text-white" : "bg-white hover:bg-[#F5F5F5]"
                          )}
                          onClick={() => toggleInvoiceExpand(inv.id)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <div>
                              <p className={cn("text-xs font-black", isExpanded ? "text-white" : "text-black")}>
                                Factura N° {inv.invoiceNumber}
                              </p>
                              <p className={cn("text-[9px]", isExpanded ? "text-white/60" : "text-black/50")}>
                                {formatDate(inv.date)} • {itemsCount} productos
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm font-black", isExpanded ? "text-primary" : "text-secondary")}>
                              ${inv.total.toFixed(2)}
                            </p>
                            <p className={cn("text-[8px] font-bold", isExpanded ? "text-white/40" : "text-black/40")}>
                              Tasa: Bs {exchangeRate !== 'N/A' ? exchangeRate.toFixed(2) : 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Detalle de productos - expandible */}
                        {isExpanded && (
                          <div className="bg-[#FAFAFA] p-3 border-t border-[#9E9E9E]">
                            <h4 className="text-[9px] font-black uppercase text-black/60 mb-2 flex items-center gap-1">
                              <Package size={10} /> PRODUCTOS DE ESTA FACTURA
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[9px]">
                                <thead className="bg-[#E8E8E8]">
                                  <tr>
                                    <th className="p-1.5">Producto</th>
                                    <th className="p-1.5 text-center w-16">Cant.</th>
                                    <th className="p-1.5 text-right w-20">Costo $</th>
                                    <th className="p-1.5 text-right w-24">Subtotal $</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {items.length === 0 ? (
                                    <tr><td colSpan={4} className="p-3 text-center text-black/40 italic">No hay detalles disponibles</td></tr>
                                  ) : (
                                    items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-white">
                                        <td className="p-1.5 font-medium">{item.productName}</td>
                                        <td className="p-1.5 text-center">{item.qty}</td>
                                        <td className="p-1.5 text-right font-mono">${item.costUsd.toFixed(2)}</td>
                                        <td className="p-1.5 text-right font-bold">${item.totalUsd.toFixed(2)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                                <tfoot className="bg-[#F0F0F0]">
                                  <tr>
                                    <td colSpan={3} className="p-1.5 text-right font-black">SUBTOTAL:</td>
                                    <td className="p-1.5 text-right font-black">${inv.subtotal.toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan={3} className="p-1.5 text-right font-black">IVA (16%):</td>
                                    <td className="p-1.5 text-right font-black">${inv.iva.toFixed(2)}</td>
                                  </tr>
                                  <tr className="border-t border-gray-300">
                                    <td colSpan={3} className="p-1.5 text-right font-black text-sm">TOTAL:</td>
                                    <td className="p-1.5 text-right font-black text-sm text-secondary">${inv.total.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-3 border-t flex justify-end">
              <Button onClick={onClose} variant="ghost" size="sm" className="h-7 text-xs">CERRAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex justify-between items-center pt-4 px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-headline font-black text-black">Gestión de Proveedores</h2>
          <p className="text-xs text-black/50">Catálogo de proveedores y control de compras</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingSupplier(null); setIsAdding(true); }} className="bg-primary text-black font-black h-8 text-xs px-3">
          <Plus size={13} className="mr-1" /> NUEVO PROVEEDOR
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex justify-between items-center px-6 mt-3 gap-3 flex-wrap flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <Input placeholder="Buscar proveedor..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white">
          <option value="all">📋 Ver historial de todos</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Tabla de Proveedores */}
      <div className="flex-1 overflow-hidden px-6 pb-6 mt-4">
        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm h-full flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 scrollbar-thin">
            <Table>
              <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase">Proveedor</TableHead>
                  <TableHead className="text-[9px] font-black uppercase">RIF</TableHead>
                  <TableHead className="text-[9px] font-black uppercase">Contacto</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Total Compras</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Pagado</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Saldo</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-black/40 italic">No hay proveedores registrados</TableCell></TableRow>
                ) : (
                  filteredSuppliers.map(s => {
                    const totalPurchases = getTotalPurchases(s.id);
                    const totalPaid = getTotalPaid(s.id);
                    const debt = totalPurchases - totalPaid;
                    
                    return (
                      <TableRow key={s.id} className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5]">
                        <TableCell><p className="font-bold text-xs text-black">{s.name}</p></TableCell>
                        <TableCell className="font-mono text-[10px] text-black/60">{s.rif}</TableCell>
                        <TableCell><p className="text-[10px]">{s.contactPerson}</p><p className="text-[9px] text-black/40">{s.phone}</p></TableCell>
                        <TableCell className="text-right font-mono text-xs">${totalPurchases.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-green-600">${totalPaid.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs"><span className={cn("font-bold", debt > 0 ? "text-red-600" : "text-green-600")}>${debt.toFixed(2)}</span></TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => setViewingHistory(s)} className="h-6 w-6 rounded hover:bg-blue-100 text-blue-600" title="Ver Historial"><History size={11} /></button>
                            <button onClick={() => handleEdit(s)} className="h-6 w-6 rounded hover:bg-gray-100 text-blue-600"><Pencil size={11} /></button>
                            <button onClick={() => { if(confirm('¿Eliminar proveedor?')) deleteSupplier(s.id) }} className="h-6 w-6 rounded hover:bg-red-100 text-red-600"><Trash2 size={11} /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* MODAL AGREGAR/EDITAR PROVEEDOR */}
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingSupplier(null); } }}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="sr-only"><DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <div className="bg-[#1A2C4E] p-3 text-white flex justify-between items-center">
              <div className="flex gap-2"><Truck size={16} /><h3 className="text-sm font-black">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3></div>
              <button type="button" onClick={() => setIsAdding(false)}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              <div><label className="text-[8px] font-black uppercase">Nombre/Razón Social</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-7 text-xs" required /></div>
              <div><label className="text-[8px] font-black uppercase">RIF / J-XXXXX</label><Input value={formData.rif} onChange={e => setFormData({...formData, rif: e.target.value})} className="h-7 text-xs" required /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="text-[8px] font-black uppercase">Teléfono</label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-7 text-xs" /></div><div><label className="text-[8px] font-black uppercase">Email</label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-7 text-xs" /></div></div>
              <div><label className="text-[8px] font-black uppercase">Dirección</label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="h-7 text-xs" /></div>
              <div><label className="text-[8px] font-black uppercase">Persona de Contacto</label><Input value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className="h-7 text-xs" /></div>
            </div>
            <div className="bg-[#F5F5F5] p-2 border-t flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>CANCELAR</Button><Button type="submit" className="bg-primary text-black font-black px-6 h-7 text-xs">GUARDAR</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTORIAL DE COMPRAS */}
      {viewingHistory && <PurchaseHistoryModal supplier={viewingHistory} onClose={() => setViewingHistory(null)} />}
    </div>
  );
}