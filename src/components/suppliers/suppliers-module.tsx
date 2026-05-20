"use client";

import React, { useState } from 'react';
import { useSuppliers } from '@/hooks/use-suppliers';
import { Plus, Search, Edit, Trash2, Eye, X, DollarSign, FileText, Calendar, Phone, Mail, MapPin, User, CreditCard, History } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import SupplierPaymentModal from './supplier-payment-modal';

export default function SuppliersModule() {
  const { suppliers, invoices, addSupplier, updateSupplier, deleteSupplier, addInvoice, addPayment, getSupplierInvoices, getInvoicePayments } = useSuppliers();
  
  const [search, setSearch] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [currentInvoice, setCurrentInvoice] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', rif: '', phone: '', email: '', address: '', contactPerson: '' });
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: 0,
    invoiceNumber: '',
    date: '',
    dueDate: '',
    totalBs: 0,
    totalUsd: 0,
    paymentType: 'credito' as 'contado' | 'credito',
    paidAmount: 0,
    creditDays: 30,
    notes: ''
  });

  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.rif.includes(search));

  const handleSaveSupplier = () => {
    if (!supplierForm.name || !supplierForm.rif) { alert('Nombre y RIF son requeridos'); return; }
    if (editingSupplier) {
      updateSupplier({ ...editingSupplier, ...supplierForm });
      alert('Proveedor actualizado');
    } else {
      addSupplier(supplierForm);
      alert('Proveedor creado');
    }
    setShowSupplierModal(false);
    setEditingSupplier(null);
    setSupplierForm({ name: '', rif: '', phone: '', email: '', address: '', contactPerson: '' });
  };

  const handleSaveInvoice = () => {
    if (!invoiceForm.supplierId || !invoiceForm.invoiceNumber || !invoiceForm.date) {
      alert('Complete los campos requeridos');
      return;
    }
    
    const totalBs = invoiceForm.totalBs;
    const paidAmount = invoiceForm.paymentType === 'contado' ? totalBs : (invoiceForm.paidAmount || 0);
    
    addInvoice({
      supplierId: invoiceForm.supplierId,
      invoiceNumber: invoiceForm.invoiceNumber,
      date: invoiceForm.date,
      dueDate: invoiceForm.paymentType === 'credito' && invoiceForm.creditDays ? 
        new Date(new Date(invoiceForm.date).getTime() + invoiceForm.creditDays * 86400000).toISOString().split('T')[0] : 
        invoiceForm.date,
      subtotal: totalBs,
      iva: 0,
      total: totalBs,
      paidAmount: paidAmount,
      status: paidAmount >= totalBs ? 'pagada' : (paidAmount > 0 ? 'parcial' : 'pendiente'),
      notes: `${invoiceForm.notes} | USD: ${invoiceForm.totalUsd} | Tipo: ${invoiceForm.paymentType}`
    });
    alert('Factura registrada');
    setShowInvoiceModal(false);
    resetInvoiceForm();
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      supplierId: 0,
      invoiceNumber: '',
      date: '',
      dueDate: '',
      totalBs: 0,
      totalUsd: 0,
      paymentType: 'credito',
      paidAmount: 0,
      creditDays: 30,
      notes: ''
    });
  };

  const handlePayment = (invoice: any) => {
    setCurrentInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = (paymentData: any) => {
    addPayment({
      supplierId: currentInvoice.supplierId,
      invoiceId: currentInvoice.id,
      date: new Date().toISOString(),
      amount: paymentData.amount,
      method: paymentData.method,
      reference: paymentData.reference,
      bank: paymentData.bank,
      notes: ''
    });
    alert(`Pago de Bs ${paymentData.amount.toFixed(2)} registrado correctamente`);
    setShowPaymentModal(false);
    setCurrentInvoice(null);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-VE');

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-headline font-black text-black">Proveedores / Cuentas por Pagar</h2>
        <div className="flex gap-3">
          <div className="relative w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" /><Input placeholder="Buscar proveedor..." className="pl-9 h-10 bg-white border-[#9E9E9E]" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', rif: '', phone: '', email: '', address: '', contactPerson: '' }); setShowSupplierModal(true); }} className="bg-primary hover:brightness-110 text-black font-black"><Plus size={18} className="mr-2" /> NUEVO PROVEEDOR</Button>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase w-8"></TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Nombre</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">RIF</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Contacto</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Deuda</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.map((s) => {
              const isExpanded = expandedSupplier === s.id;
              const supplierInvoices = getSupplierInvoices(s.id);
              const totalDebt = supplierInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);
              return (
                <React.Fragment key={s.id}>
                  <TableRow className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] cursor-pointer" onClick={() => setExpandedSupplier(isExpanded ? null : s.id)}>
                    <TableCell>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</TableCell>
                    <TableCell className="font-bold text-black">{s.name}</TableCell>
                    <TableCell className="text-black/60 text-xs">{s.rif}</TableCell>
                    <TableCell><div className="flex flex-col"><span className="text-xs text-black/60">{s.phone}</span><span className="text-[10px] text-black/50">{s.email}</span></div></TableCell>
                    <TableCell><span className={cn("px-3 py-1 rounded-full text-[10px] font-bold", totalDebt > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>Bs {totalDebt.toFixed(2)}</span></TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><button onClick={(e) => { e.stopPropagation(); setEditingSupplier(s); setSupplierForm({ name: s.name, rif: s.rif, phone: s.phone || '', email: s.email || '', address: s.address || '', contactPerson: s.contactPerson || '' }); setShowSupplierModal(true); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit size={14} className="text-blue-500" /></button><button onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar proveedor?')) deleteSupplier(s.id); }} className="p-1.5 rounded-lg hover:bg-gray-100"><Trash2 size={14} className="text-red-500" /></button></div></TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-[#FAFAFA]">
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4 border-t border-[#9E9E9E]">
                          <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-black text-black uppercase">FACTURAS</h4><Button size="sm" onClick={() => { setInvoiceForm({ ...invoiceForm, supplierId: s.id }); setShowInvoiceModal(true); }} className="bg-primary text-black text-[10px] h-7"><Plus size={12} /> Nueva Factura</Button></div>
                          {supplierInvoices.length === 0 ? <div className="text-center py-4 text-black/50 italic text-sm">Sin facturas registradas</div> : (
                            <div className="space-y-2">
                              {supplierInvoices.map((inv) => {
                                const remaining = inv.total - inv.paidAmount;
                                const invoicePayments = getInvoicePayments(inv.id);
                                return (
                                  <div key={inv.id} className="bg-white border border-[#9E9E9E] rounded-lg p-3">
                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                      <div><span className="font-bold text-black">#{inv.invoiceNumber}</span><span className="text-[10px] text-black/50 ml-2">{formatDate(inv.date)}</span></div>
                                      <div><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", inv.status === 'pagada' ? "bg-green-100 text-green-700" : inv.status === 'parcial' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{inv.status === 'pagada' ? 'PAGADA' : inv.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}</span></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                      <div><p className="text-[10px] text-black/50">Total: <span className="font-bold text-black">Bs {inv.total.toFixed(2)}</span></p><p className="text-[9px] text-black/50">Pagado: Bs {inv.paidAmount.toFixed(2)} | Pendiente: <span className="text-red-600 font-bold">Bs {remaining.toFixed(2)}</span></p></div>
                                      {remaining > 0 && <Button size="sm" onClick={() => handlePayment(inv)} className="bg-[#2ECC71] text-white text-[10px] h-7"><DollarSign size={12} /> Pagar</Button>}
                                    </div>
                                    {invoicePayments.length > 0 && (<div className="mt-2 pt-2 border-t border-dashed border-[#9E9E9E]"><p className="text-[8px] font-bold text-black/50 uppercase">Historial de pagos</p>{invoicePayments.map(p => (<div key={p.id} className="flex justify-between text-[9px]"><span>{new Date(p.date).toLocaleDateString()}</span><span className="font-bold text-green-600">Bs {p.amount.toFixed(2)}</span><span className="text-black/50">{p.method}</span></div>))}</div>)}
                                    <button onClick={() => { setSelectedInvoice(inv); setShowInvoiceDetail(true); }} className="mt-2 text-[9px] text-primary font-bold hover:underline">Ver detalle completo</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal Proveedor */}
      <Dialog open={showSupplierModal} onOpenChange={setShowSupplierModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle></DialogHeader>
          <div className="bg-[#1A2C4E] p-4 text-white"><div className="flex justify-between"><div className="flex items-center gap-2"><User size={20} className="text-primary" /><h3 className="text-lg font-black">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3></div><button onClick={() => setShowSupplierModal(false)}><X size={18} /></button></div></div>
          <div className="p-5 space-y-3"><Input placeholder="Nombre *" value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} /><Input placeholder="RIF *" value={supplierForm.rif} onChange={(e) => setSupplierForm({...supplierForm, rif: e.target.value})} /><Input placeholder="Teléfono" value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} /><Input placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})} /><Input placeholder="Dirección" value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})} /><Input placeholder="Persona de contacto" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({...supplierForm, contactPerson: e.target.value})} /></div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3"><Button variant="ghost" onClick={() => setShowSupplierModal(false)}>CANCELAR</Button><Button onClick={handleSaveSupplier} className="bg-primary text-black font-black">GUARDAR</Button></div>
        </DialogContent>
      </Dialog>

      {/* Modal Factura - SIMPLIFICADO */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Nueva Factura</DialogTitle></DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><FileText size={20} className="text-primary" /><h3 className="text-lg font-black">Nueva Factura</h3></div>
                <button onClick={() => setShowInvoiceModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* Fila 1: Número y Fecha */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Número de factura *</label><Input value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})} /></div>
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Fecha *</label><Input type="date" value={invoiceForm.date} onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})} /></div>
              </div>
              
              {/* Fila 2: Tipo de pago */}
              <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Tipo de pago</label>
                <div className="flex gap-2">
                  <button onClick={() => setInvoiceForm({...invoiceForm, paymentType: 'contado', paidAmount: invoiceForm.totalBs, creditDays: 0})} className={cn("flex-1 py-2 rounded-lg border-2 text-sm font-bold", invoiceForm.paymentType === 'contado' ? "border-primary bg-primary/10 text-black" : "border-[#9E9E9E]")}>CONTADO</button>
                  <button onClick={() => setInvoiceForm({...invoiceForm, paymentType: 'credito', paidAmount: 0})} className={cn("flex-1 py-2 rounded-lg border-2 text-sm font-bold", invoiceForm.paymentType === 'credito' ? "border-primary bg-primary/10 text-black" : "border-[#9E9E9E]")}>CRÉDITO</button>
                </div>
              </div>
              
              {/* Fila 3: Montos */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Monto total (Bs)</label><Input type="number" value={invoiceForm.totalBs} onChange={(e) => setInvoiceForm({...invoiceForm, totalBs: parseFloat(e.target.value)})} /></div>
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Monto total (USD)</label><Input type="number" value={invoiceForm.totalUsd} onChange={(e) => setInvoiceForm({...invoiceForm, totalUsd: parseFloat(e.target.value)})} /></div>
              </div>
              
              {/* Fila 4: Días de crédito y monto pagado */}
              <div className="grid grid-cols-2 gap-4">
                {invoiceForm.paymentType === 'credito' && (
                  <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Días de crédito</label><Input type="number" value={invoiceForm.creditDays} onChange={(e) => setInvoiceForm({...invoiceForm, creditDays: parseInt(e.target.value)})} /></div>
                )}
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Monto pagado (Bs)</label><Input type="number" value={invoiceForm.paidAmount} onChange={(e) => setInvoiceForm({...invoiceForm, paidAmount: parseFloat(e.target.value)})} disabled={invoiceForm.paymentType === 'contado'} className={invoiceForm.paymentType === 'contado' ? "bg-gray-100" : ""} /></div>
              </div>
              
              {/* Fila 5: Notas */}
              <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Notas</label><Input value={invoiceForm.notes} onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})} /></div>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowInvoiceModal(false)}>CANCELAR</Button>
              <Button onClick={handleSaveInvoice} className="bg-primary text-black font-black">REGISTRAR FACTURA</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Pago */}
      {currentInvoice && (<SupplierPaymentModal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} onConfirm={handleConfirmPayment} total={currentInvoice.total} currentPaid={currentInvoice.paidAmount} supplierName={suppliers.find(s => s.id === currentInvoice.supplierId)?.name || ''} invoiceNumber={currentInvoice.invoiceNumber} />)}

      {/* Modal Detalle Factura */}
      <Dialog open={showInvoiceDetail} onOpenChange={setShowInvoiceDetail}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>Detalle de Factura</DialogTitle></DialogHeader>
          {selectedInvoice && (<div><div className="bg-[#1A2C4E] p-4 text-white sticky top-0"><div className="flex justify-between"><div><h3 className="text-lg font-black">Factura #{selectedInvoice.invoiceNumber}</h3><p className="text-white/60 text-xs">Proveedor: {suppliers.find(s => s.id === selectedInvoice.supplierId)?.name}</p></div><button onClick={() => setShowInvoiceDetail(false)}><X size={18} /></button></div></div>
          <div className="p-5 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-black/60">Fecha</label><p>{formatDate(selectedInvoice.date)}</p></div><div><label className="text-[10px] font-black text-black/60">Total Bs</label><p className="text-lg font-black">Bs {selectedInvoice.total.toFixed(2)}</p></div><div><label className="text-[10px] font-black text-black/60">Pagado</label><p className="text-green-600 font-bold">Bs {selectedInvoice.paidAmount.toFixed(2)}</p></div><div><label className="text-[10px] font-black text-black/60">Saldo pendiente</label><p className="text-red-600 font-bold">Bs {(selectedInvoice.total - selectedInvoice.paidAmount).toFixed(2)}</p></div></div>
          {selectedInvoice.notes && <div><label className="text-[10px] font-black text-black/60">Notas</label><p className="text-sm">{selectedInvoice.notes}</p></div>}
          <div><label className="text-[10px] font-black text-black/60 flex items-center gap-2"><History size={12} /> Historial de pagos</label>{getInvoicePayments(selectedInvoice.id).length === 0 ? <p className="text-sm text-black/50 italic">Sin pagos registrados</p> : getInvoicePayments(selectedInvoice.id).map(p => (<div key={p.id} className="flex justify-between py-1 border-b"><span>{new Date(p.date).toLocaleString()}</span><span className="font-bold text-green-600">Bs {p.amount.toFixed(2)}</span><span className="text-black/50">{p.method}</span></div>))}</div></div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end"><Button onClick={() => setShowInvoiceDetail(false)}>CERRAR</Button></div></div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ChevronRight = ({ size }: { size: number }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>;
const ChevronDown = ({ size }: { size: number }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>;
