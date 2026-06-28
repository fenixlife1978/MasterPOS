"use client";

import { useState, useMemo } from 'react';
import { useSuppliers } from '@/hooks/use-suppliers';
import { 
  Plus, Search, Truck, Phone, MapPin, Mail, 
  User, Receipt, DollarSign, Wallet, History,
  Eye, Edit, Trash2
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { usePOSState } from '@/hooks/use-pos-state';
import SupplierPaymentModal from './supplier-payment-modal';
import InvoiceDetailModal from './InvoiceDetailModal';
import { useToast } from '@/hooks/use-toast';

type SuppliersTab = 'list' | 'invoices' | 'payments';

export default function SuppliersModule() {
  const { toast } = useToast();
  const { exchangeRate } = usePOSState();
  const { 
    suppliers, invoices, payments, purchaseItems,
    addSupplier, updateSupplier, deleteSupplier,
    addPayment
  } = useSuppliers();

  const [activeTab, setActiveTab] = useState<SuppliersTab>('list');
  const [search, setSearch] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '', rif: '', phone: '', address: '', email: '', contactPerson: ''
  });

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.rif || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [suppliers, search]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) || 
                          inv.supplierName?.toLowerCase().includes(search.toLowerCase());
      const matchSupplier = filterSupplier === 'all' || String(inv.supplierId) === filterSupplier;
      const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
      return matchSearch && matchSupplier && matchStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, search, filterSupplier, filterStatus]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => 
      p.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      p.reference?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, search]);

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) return alert('El nombre es requerido');
    try {
      if (editingSupplier) {
        await updateSupplier({ ...editingSupplier, ...supplierForm });
        toast({ title: 'Actualizado', description: 'Proveedor actualizado correctamente' });
      } else {
        await addSupplier(supplierForm);
        toast({ title: 'Creado', description: 'Nuevo proveedor registrado' });
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', rif: '', phone: '', address: '', email: '', contactPerson: '' });
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo guardar el proveedor', variant: 'destructive' });
    }
  };

  const handleEditSupplier = (s: any) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name, rif: s.rif || '', phone: s.phone || '', 
      address: s.address || '', email: s.email || '', contactPerson: s.contactPerson || ''
    });
    setShowSupplierModal(true);
  };

  const handleConfirmPayment = async (data: any) => {
    if (!selectedInvoice) return;
    try {
      await addPayment({
        supplierId: selectedInvoice.supplierId,
        supplierName: suppliers.find(s => s.id === selectedInvoice.supplierId)?.name || 'N/A',
        invoiceId: selectedInvoice.id,
        date: new Date().toISOString(),
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        bank: data.bank,
        exchangeRate: data.exchangeRate
      });
      toast({ title: 'Pago registrado', description: 'El pago se ha procesado exitosamente' });
    } catch (e) {
      toast({ title: 'Error', description: 'Error al registrar el pago', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background text-foreground">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black uppercase">Gestión de Proveedores</h2>
          <p className="text-sm text-black/60 mt-1 uppercase tracking-widest">Cuentas por pagar y registro de compras</p>
        </div>
        <Button onClick={() => setShowSupplierModal(true)} className="bg-primary hover:bg-primary/90 text-black font-black shadow-lg">
          <Plus size={18} className="mr-2" /> NUEVO PROVEEDOR
        </Button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-[#9E9E9E]">
        <button onClick={() => setActiveTab('list')} className={cn("px-4 py-2 font-bold text-sm transition-all", activeTab === 'list' ? "bg-white text-black border border-b-0 border-[#9E9E9E] rounded-t-lg" : "text-black/60 hover:text-black")}>PROVEEDORES</button>
        <button onClick={() => setActiveTab('invoices')} className={cn("px-4 py-2 font-bold text-sm transition-all", activeTab === 'invoices' ? "bg-white text-black border border-b-0 border-[#9E9E9E] rounded-t-lg" : "text-black/60 hover:text-black")}>CUENTAS POR PAGAR</button>
        <button onClick={() => setActiveTab('payments')} className={cn("px-4 py-2 font-bold text-sm transition-all", activeTab === 'payments' ? "bg-white text-black border border-b-0 border-[#9E9E9E] rounded-t-lg" : "text-black/60 hover:text-black")}>HISTORIAL DE PAGOS</button>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase text-black/60 mb-1 block">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, RIF, N° Factura..." className="pl-9 h-9 text-xs border-[#9E9E9E]" />
            </div>
          </div>
          {activeTab === 'invoices' && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase text-black/60 mb-1 block">Filtrar Proveedor</label>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="h-9 border border-[#9E9E9E] rounded-lg px-2 text-xs font-bold bg-white">
                  <option value="all">TODOS</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-black/60 mb-1 block">Estado</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 border border-[#9E9E9E] rounded-lg px-2 text-xs font-bold bg-white">
                  <option value="all">TODOS</option>
                  <option value="pendiente">PENDIENTE</option>
                  <option value="parcial">PARCIAL</option>
                  <option value="pagada">PAGADA</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        {activeTab === 'list' && (
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                <TableHead className="text-[10px] font-black uppercase">RIF / Cédula</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Contacto</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Deuda Pendiente (USD)</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-black/40 italic">No hay proveedores registrados</TableCell></TableRow>
              ) : (
                filteredSuppliers.map(s => (
                  <TableRow key={s.id} className="hover:bg-primary/5">
                    <TableCell>
                      <p className="font-bold text-sm text-black">{s.name.toUpperCase()}</p>
                      <p className="text-[10px] text-black/60 flex items-center gap-1"><User size={10} /> {s.contactPerson || '—'}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-black/60">{s.rif || s.cedula || '—'}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-black/60 flex items-center gap-1"><Phone size={10} /> {s.phone || '—'}</p>
                        <p className="text-[10px] text-black/60 flex items-center gap-1"><Mail size={10} /> {s.email || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-red-600">{formatUsd(s.totalDebt || 0)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEditSupplier(s)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600"><Edit size={14} /></button>
                        <button onClick={() => { if(confirm('¿Eliminar proveedor?')) deleteSupplier(s.id) }} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {activeTab === 'invoices' && (
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase">N° Factura</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Total USD</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Pendiente USD</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-black/40 italic">No hay facturas registradas</TableCell></TableRow>
              ) : (
                filteredInvoices.map(inv => {
                  const pending = inv.total - (inv.paidAmount || 0);
                  return (
                    <TableRow key={inv.id} className="hover:bg-primary/5">
                      <TableCell className="font-bold text-xs">#{inv.invoiceNumber || inv.id}</TableCell>
                      <TableCell className="font-bold text-xs uppercase">{inv.supplierName || '—'}</TableCell>
                      <TableCell className="text-xs text-black/60">{new Date(inv.date).toLocaleDateString('es-VE')}</TableCell>
                      <TableCell className="text-right font-bold">{formatUsd(inv.total)}</TableCell>
                      <TableCell className="text-right font-black text-red-600">{formatUsd(pending)}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border", 
                          inv.status === 'pagada' ? "bg-green-100 text-green-700 border-green-200" : 
                          inv.status === 'parcial' ? "bg-yellow-100 text-yellow-700 border-yellow-200" : 
                          "bg-red-100 text-red-700 border-red-200")}>
                          {inv.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => { setSelectedInvoice(inv); setShowInvoiceDetail(true); }} title="Ver detalle" className="p-1.5 rounded-lg hover:bg-gray-100"><Eye size={14} /></button>
                          {inv.status !== 'pagada' && (
                            <button onClick={() => { setSelectedInvoice(inv); setShowPaymentModal(true); }} title="Registrar pago" className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"><DollarSign size={14} /></button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}

        {activeTab === 'payments' && (
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Método / Referencia</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Monto USD</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Monto Bs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-black/40 italic">No hay pagos registrados</TableCell></TableRow>
              ) : (
                filteredPayments.map(p => (
                  <TableRow key={p.id} className="hover:bg-primary/5">
                    <TableCell className="text-xs text-black/60">{new Date(p.date).toLocaleString('es-VE')}</TableCell>
                    <TableCell className="font-bold text-xs uppercase">{p.supplierName}</TableCell>
                    <TableCell>
                      <p className="text-xs font-bold uppercase">{p.method.replace('_', ' ')}</p>
                      <p className="text-[10px] text-black/40">{p.reference || '—'} {p.bank ? `(${p.bank})` : ''}</p>
                    </TableCell>
                    <TableCell className="text-right font-black text-green-600">{formatUsd(p.amount)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-black/60">{formatBs(p.amount * (p.exchangeRate || exchangeRate))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={showSupplierModal} onOpenChange={setShowSupplierModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="p-4 bg-[#1A2C4E] text-white">
            <DialogTitle className="text-lg font-black">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Nombre del Proveedor *</label><Input value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} placeholder="Ej: Polar C.A." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">RIF / Cédula</label><Input value={supplierForm.rif} onChange={e => setSupplierForm({...supplierForm, rif: e.target.value})} placeholder="J-12345678-9" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Teléfono</label><Input value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} placeholder="0412-1234567" /></div>
            </div>
            <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Persona de Contacto</label><Input value={supplierForm.contactPerson} onChange={e => setSupplierForm({...supplierForm, contactPerson: e.target.value})} placeholder="Ej: Juan Pérez" /></div>
            <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Correo Electrónico</label><Input type="email" value={supplierForm.email} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} placeholder="ventas@proveedor.com" /></div>
            <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Dirección Física</label><Input value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} placeholder="Dirección del depósito o local" /></div>
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSupplierModal(false)}>CANCELAR</Button>
            <Button onClick={handleSaveSupplier} className="bg-primary text-black font-black">GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceDetailModal 
        invoice={selectedInvoice ? {
          ...selectedInvoice,
          items: purchaseItems.filter((it: any) => String(it.invoiceId) === String(selectedInvoice.id))
        } : null} 
        isOpen={showInvoiceDetail} 
        onClose={() => setShowInvoiceDetail(false)} 
        exchangeRate={exchangeRate}
        supplierPayments={payments}
        supplierName={suppliers.find(s => s.id === selectedInvoice?.supplierId)?.name}
      />

      <SupplierPaymentModal 
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handleConfirmPayment}
        total={selectedInvoice?.total || 0}
        currentPaid={selectedInvoice?.paidAmount || 0}
        supplierName={selectedInvoice?.supplierName || ''}
        invoiceNumber={selectedInvoice?.invoiceNumber || String(selectedInvoice?.id || '')}
        exchangeRate={exchangeRate}
      />
    </div>
  );
}
