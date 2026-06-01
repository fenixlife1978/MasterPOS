"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
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
import { syncService } from '@/services/syncService';
import SupplierPaymentModal from './supplier-payment-modal';
import InvoiceDetailModal from './InvoiceDetailModal'; // ✅ nuevo import
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

// ✅ Función para obtener fecha y hora local de Venezuela
function getVenezuelaDateTime(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return formatter.format(now);
}

function getVenezuelaDateForFirestore(): string {
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
}

function formatDateFromString(dateStr: string): string {
  if (dateStr.includes('T') || dateStr.includes(' ') || /^\d+$/.test(dateStr)) {
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

function generateUniquePaymentId(): number {
  return Date.now() + Math.floor(Math.random() * 10000);
}

export default function SuppliersModule() {
  const state = usePOSState();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<SupplierInvoice | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [viewingPayments, setViewingPayments] = useState<Supplier | null>(null);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);

  // ✅ Nuevos estados para expansión y modal de factura
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(null);
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<{
    invoice: SupplierInvoice | null;
    isOpen: boolean;
  }>({ invoice: null, isOpen: false });

  const [formData, setFormData] = useState({
    name: '',
    rif: '',
    phone: '',
    email: '',
    address: '',
    contactPerson: ''
  });
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<Record<number, PurchaseInvoiceItem[]>>({});

  useEffect(() => {
    const unsubscribePayments = syncService.subscribeToSupplierPayments((data) => {
      setSupplierPayments(data);
    });
    return () => unsubscribePayments();
  }, []);

  useEffect(() => {
    const unsubscribeInvoices = syncService.subscribeToPurchaseInvoices((data) => {
      setInvoices(data);
    });
    const unsubscribeItems = syncService.subscribeToPurchaseItems((data) => {
      const grouped = data.reduce((acc, item) => {
        const invoiceId = item.invoiceId;
        if (!acc[invoiceId]) acc[invoiceId] = [];
        acc[invoiceId].push(item);
        return acc;
      }, {} as Record<number, PurchaseInvoiceItem[]>);
      setPurchaseItems(grouped);
    });
    return () => {
      unsubscribeInvoices();
      unsubscribeItems();
    };
  }, []);

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.rif.toLowerCase().includes(q)
    );
  }, [search, suppliers]);

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

  const isRifDuplicado = (rif: string, excludeId?: number): boolean => {
    return suppliers.some(s => 
      s.rif.toLowerCase() === rif.toLowerCase() && 
      (excludeId === undefined || s.id !== excludeId)
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRifDuplicado(formData.rif, editingSupplier?.id)) {
      toast({ 
        title: "Error", 
        description: `Ya existe un proveedor con el RIF ${formData.rif}. No se puede duplicar.`, 
        variant: "destructive" 
      });
      return;
    }
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
    const payments = supplierPayments.filter(p => p.supplierId === supplierId);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const getPendingInvoices = (supplierId: number) => {
    return invoices.filter(i => i.supplierId === supplierId && i.status !== 'pagada');
  };

  const handleOpenPaymentModal = (supplier: Supplier, invoice?: SupplierInvoice) => {
    setSelectedSupplierForPayment(supplier);
    setSelectedInvoiceForPayment(invoice || null);
    setShowPaymentModal(true);
  };

  const distributePayment = async (
    supplierId: number,
    totalPaidUsd: number,
    exchangeRate: number,
    paymentMethod: string,
    reference?: string,
    bank?: string
  ): Promise<void> => {
    const pendingInvoices = invoices
      .filter(inv => inv.supplierId === supplierId && inv.status !== 'pagada')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let remaining = totalPaidUsd;
    const updatedInvoices = [...invoices];
    for (const invoice of pendingInvoices) {
      if (remaining <= 0) break;
      const owed = invoice.total - invoice.paidAmount;
      const payAmount = Math.min(remaining, owed);
      const updatedInvoice: SupplierInvoice = {
        ...invoice,
        paidAmount: invoice.paidAmount + payAmount,
        status: (invoice.paidAmount + payAmount) >= invoice.total ? 'pagada' : 'parcial'
      };
      await syncService.savePurchaseInvoice(updatedInvoice);
      const index = updatedInvoices.findIndex(i => i.id === invoice.id);
      if (index !== -1) updatedInvoices[index] = updatedInvoice;
      const newPayment: SupplierPayment = {
        id: generateUniquePaymentId(),
        supplierId: supplierId,
        invoiceId: invoice.id,
        date: getVenezuelaDateForFirestore(),
        amount: payAmount,
        method: paymentMethod,
        reference: reference || '',
        bank: bank || '',
        notes: `Pago parcial distribuido. Tasa: ${formatBsNumber(exchangeRate)} Bs/USD`
      };
      await syncService.saveSupplierPayment(newPayment);
      const amountBs = payAmount * exchangeRate;
      await syncService.saveAccountingEntry({
        id: generateUniquePaymentId(),
        date: getVenezuelaDateForFirestore(),
        type: 'egreso',
        category: 'pagos_proveedores',
        subcategory: 'abono',
        concept: `Pago a proveedor (Factura ${invoice.invoiceNumber})`,
        description: `Abono de ${formatUsd(payAmount)} USD (tasa ${formatBsNumber(exchangeRate)}) = ${formatBs(amountBs)}`,
        amount: amountBs,
        referenceId: newPayment.id,
        referenceType: 'supplier_payment',
        createdAt: getVenezuelaDateTime()
      });
      remaining -= payAmount;
    }
    setInvoices(updatedInvoices);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      const totalDebt = updatedInvoices
        .filter(i => i.supplierId === supplierId)
        .reduce((sum, i) => sum + (i.total - i.paidAmount), 0);
      await updateSupplier({ ...supplier, totalDebt });
    }
  };

  const handlePaymentConfirm = async (paymentData: { amount: number; method: string; reference?: string; bank?: string; usdAmount?: number; exchangeRate?: number }) => {
    if (!selectedSupplierForPayment) return;
    setIsProcessing(true);
    try {
      const exchangeRateUsed = paymentData.exchangeRate || state.exchangeRate;
      if (selectedInvoiceForPayment) {
        const invoice = selectedInvoiceForPayment;
        const owed = invoice.total - invoice.paidAmount;
        const payAmount = Math.min(paymentData.amount, owed);
        const updatedInvoice: SupplierInvoice = {
          ...invoice,
          paidAmount: invoice.paidAmount + payAmount,
          status: (invoice.paidAmount + payAmount) >= invoice.total ? 'pagada' : 'parcial'
        };
        await syncService.savePurchaseInvoice(updatedInvoice);
        const updatedInvoices = [...invoices];
        const index = updatedInvoices.findIndex(i => i.id === invoice.id);
        if (index !== -1) updatedInvoices[index] = updatedInvoice;
        setInvoices(updatedInvoices);
        const newPayment: SupplierPayment = {
          id: generateUniquePaymentId(),
          supplierId: selectedSupplierForPayment.id,
          invoiceId: invoice.id,
          date: getVenezuelaDateForFirestore(),
          amount: payAmount,
          method: paymentData.method,
          reference: paymentData.reference || '',
          bank: paymentData.bank || '',
          notes: `Pago registrado. Tasa: ${formatBsNumber(exchangeRateUsed)} Bs/USD`
        };
        await syncService.saveSupplierPayment(newPayment);
        const amountBs = payAmount * exchangeRateUsed;
        await syncService.saveAccountingEntry({
          id: generateUniquePaymentId(),
          date: getVenezuelaDateForFirestore(),
          type: 'egreso',
          category: 'pagos_proveedores',
          subcategory: 'abono',
          concept: `Pago a proveedor ${selectedSupplierForPayment.name} (Factura ${invoice.invoiceNumber})`,
          description: `Pago de ${formatUsd(payAmount)} USD (tasa ${formatBsNumber(exchangeRateUsed)}) = ${formatBs(amountBs)}`,
          amount: amountBs,
          referenceId: newPayment.id,
          referenceType: 'supplier_payment',
          createdAt: getVenezuelaDateTime()
        });
        const totalDebt = updatedInvoices
          .filter(i => i.supplierId === selectedSupplierForPayment.id)
          .reduce((sum, i) => sum + (i.total - i.paidAmount), 0);
        await updateSupplier({ ...selectedSupplierForPayment, totalDebt });
        toast({ title: "Pago registrado", description: `Pago de ${formatUsd(payAmount)} a ${selectedSupplierForPayment.name}` });
      } else {
        await distributePayment(
          selectedSupplierForPayment.id,
          paymentData.amount,
          exchangeRateUsed,
          paymentData.method,
          paymentData.reference,
          paymentData.bank
        );
        toast({ title: "Pago global aplicado", description: `Distribuido ${formatUsd(paymentData.amount)} entre facturas pendientes de ${selectedSupplierForPayment.name}` });
      }
      setShowPaymentModal(false);
      setSelectedSupplierForPayment(null);
      setSelectedInvoiceForPayment(null);
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      toast({ title: "Error", description: "No se pudo procesar el pago", variant: "destructive" });
    }
    setIsProcessing(false);
  };

  const handleReversePayment = useCallback(async (payment: SupplierPayment) => {
    if (!confirm(`¿Anular pago de ${formatUsd(payment.amount)}?`)) return;
    setIsProcessing(true);
    try {
      const affectedInvoices = invoices.filter(inv => inv.supplierId === payment.supplierId);
      let remainingAmount = payment.amount;
      const sortedInvoices = [...affectedInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const updatedInvoices = [...invoices];
      for (const invoice of sortedInvoices) {
        if (remainingAmount <= 0) break;
        const paidOnInvoice = Math.min(invoice.paidAmount, remainingAmount);
        if (paidOnInvoice <= 0) continue;
        const updatedInvoice: SupplierInvoice = {
          ...invoice,
          paidAmount: Math.max(0, invoice.paidAmount - paidOnInvoice),
          status: (invoice.paidAmount - paidOnInvoice) <= 0 ? 'pendiente' : 'parcial'
        };
        await syncService.savePurchaseInvoice(updatedInvoice);
        const index = updatedInvoices.findIndex(i => i.id === invoice.id);
        if (index !== -1) updatedInvoices[index] = updatedInvoice;
        remainingAmount -= paidOnInvoice;
      }
      const amountBs = payment.amount * state.exchangeRate;
      await syncService.saveAccountingEntry({
        id: generateUniquePaymentId(),
        date: getVenezuelaDateForFirestore(),
        type: 'ingreso',
        category: 'reversiones_pagos',
        subcategory: 'anulacion_pago',
        concept: `ANULACIÓN de pago a proveedor`,
        description: `Reversión de pago de ${formatUsd(payment.amount)} USD (tasa ${formatBsNumber(state.exchangeRate)}) = ${formatBs(amountBs)}`,
        amount: amountBs,
        referenceId: payment.id,
        referenceType: 'payment_reversal',
        createdAt: getVenezuelaDateTime()
      });
      await syncService.deleteSupplierPayment(payment.id);
      const supplier = suppliers.find(s => s.id === payment.supplierId);
      if (supplier) {
        const totalDebt = updatedInvoices
          .filter(i => i.supplierId === payment.supplierId)
          .reduce((sum, i) => sum + (i.total - i.paidAmount), 0);
        await updateSupplier({ ...supplier, totalDebt });
      }
      setInvoices(updatedInvoices);
      toast({ title: "Pago anulado", description: `Se anuló pago de ${formatUsd(payment.amount)}` });
    } catch (error) {
      console.error('Error al anular pago:', error);
      toast({ title: "Error", description: "No se pudo anular el pago", variant: "destructive" });
    }
    setIsProcessing(false);
  }, [invoices, suppliers, updateSupplier, state.exchangeRate]);

  const PaymentHistoryModal = memo(({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) => {
    const payments = useMemo(() => {
      return supplierPayments
        .filter(p => p.supplierId === supplier.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [supplierPayments, supplier.id]);
    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-xl shadow-xl max-h-[85vh] flex flex-col">
          <DialogHeader className="bg-[#1A2C4E] p-4 text-white rounded-t-xl flex-shrink-0">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Wallet size={16} /> Historial de Pagos
              </DialogTitle>
              <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-xs opacity-70 mt-1">{supplier.name}</p>
            <DialogDescription className="sr-only">Listado de pagos realizados al proveedor {supplier.name}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-green-50 rounded-lg p-3 mb-4 text-center border border-green-200">
              <p className="text-[9px] font-black uppercase text-green-700">Total Pagado</p>
              <p className="text-2xl font-black text-green-700">{formatUsd(totalPaid)}</p>
            </div>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-black/40">
                <Wallet size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No hay pagos registrados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map(payment => {
                  const relatedInvoice = invoices.find(i => i.id === payment.invoiceId);
                  const displayDate = formatDateFromString(payment.date);
                  return (
                    <div key={payment.id} className="border border-gray-200 rounded-lg p-3 hover:bg-slate-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-bold uppercase">{payment.method.replace('_', ' ')}</p>
                          <p className="text-[9px] text-black/50 mt-1">{displayDate}</p>
                          {relatedInvoice && <p className="text-[8px] text-black/40">Factura #{relatedInvoice.invoiceNumber}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-secondary">{formatUsd(payment.amount)}</p>
                        </div>
                      </div>
                      {payment.reference && <p className="text-[8px] text-black/40 mt-1">Ref: {payment.reference}</p>}
                      <div className="mt-2 flex justify-end">
                        <button onClick={() => handleReversePayment(payment)} className="text-[8px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1" disabled={isProcessing}>
                          <Trash2 size={10} /> ANULAR PAGO
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bg-slate-50 p-3 border-t flex justify-end">
            <Button onClick={onClose} variant="ghost" size="sm" className="h-7 text-xs">CERRAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  });

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex justify-between items-center pt-4 px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-headline font-black text-black">Gestión de Proveedores</h2>
          <p className="text-xs text-black/50">Directorio de proveedores y auditoría de compras</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingSupplier(null); setIsAdding(true); }} className="bg-primary text-black font-black h-8 text-xs px-3">
          <Plus size={13} className="mr-1" /> NUEVO PROVEEDOR
        </Button>
      </div>

      <div className="px-6 mt-3 flex-shrink-0">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <Input placeholder="Buscar por nombre o RIF..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6 mt-4">
        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm h-full flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 scrollbar-thin">
            <Table>
              <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                <TableRow>
                  {/* Agregamos una columna extra para el ícono de expansión */}
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="text-[9px] font-black uppercase">Proveedor</TableHead>
                  <TableHead className="text-[9px] font-black uppercase">RIF</TableHead>
                  <TableHead className="text-[9px] font-black uppercase">Contacto</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Compras Acum.</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Saldo Deudor</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-black/40 italic">No hay proveedores en el directorio</TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map(s => {
                    const totalPurchases = getTotalPurchases(s.id);
                    const totalPaid = getTotalPaid(s.id);
                    const debt = totalPurchases - totalPaid;
                    const isExpanded = expandedSupplierId === s.id;
                    const supplierInvoices = filteredInvoices.filter(inv => inv.supplierId === s.id);
                    
                    return (
                      <React.Fragment key={s.id}>
                        {/* Fila principal del proveedor (clickeable) */}
                        <TableRow 
                          className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5] cursor-pointer"
                          onClick={() => setExpandedSupplierId(isExpanded ? null : s.id)}
                        >
                          <TableCell className="w-[30px]">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </TableCell>
                          <TableCell><p className="font-bold text-xs text-black">{s.name}</p></TableCell>
                          <TableCell className="font-mono text-[10px] text-black/60">{s.rif}</TableCell>
                          <TableCell>
                            <p className="text-[10px] font-medium">{s.contactPerson}</p>
                            <p className="text-[9px] text-black/40">{s.phone}</p>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-secondary font-bold">{formatUsd(totalPurchases)}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-mono text-xs font-black", debt > 0 ? "text-red-600" : "text-green-600")}>{formatUsd(debt)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              {debt > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); handleOpenPaymentModal(s); }} className="h-6 w-6 rounded hover:bg-green-100 text-green-600" title="Pagar Deuda"><HandCoins size={11} /></button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="h-6 w-6 rounded hover:bg-gray-100 text-blue-600"><Pencil size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar proveedor?')) deleteSupplier(s.id); }} className="h-6 w-6 rounded hover:bg-red-100 text-red-600"><Trash2 size={11} /></button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Fila expandible con la lista de facturas */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="p-0 bg-gray-50">
                              <div className="p-4 space-y-2">
                                <h3 className="text-sm font-semibold">Facturas de este proveedor:</h3>
                                {supplierInvoices.length === 0 ? (
                                  <p className="text-xs text-black/50 italic">No hay facturas registradas para este proveedor.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {supplierInvoices.map(inv => {
                                      const itemsCount = purchaseItems[inv.id]?.length || inv.itemsCount || 0;
                                      const owed = inv.total - inv.paidAmount;
                                      return (
                                        <div
                                          key={inv.id}
                                          className="border rounded-lg p-3 bg-white hover:bg-gray-100 cursor-pointer transition-colors"
                                          onClick={() => setSelectedInvoiceModal({ invoice: inv, isOpen: true })}
                                        >
                                          <div className="flex justify-between items-center">
                                            <div>
                                              <p className="font-medium text-sm">Factura #{inv.invoiceNumber}</p>
                                              <p className="text-xs text-gray-500">{formatDate(inv.date)} • {itemsCount} items</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="font-bold text-primary">{formatUsd(inv.total)}</p>
                                              <p className="text-xs">
                                                Pagado: {formatUsd(inv.paidAmount)} / 
                                                <span className={owed > 0 ? "text-red-500" : "text-green-500"}>
                                                  {" "}Saldo: {formatUsd(owed)}
                                                </span>
                                              </p>
                                            </div>
                                          </div>
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
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Modal de agregar/editar proveedor */}
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingSupplier(null); } }}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
            <DialogDescription>Formulario para crear o editar un proveedor</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Truck size={20} className="text-primary" />
                  <h3 className="text-lg font-black">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                </div>
                <button onClick={() => setIsAdding(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Nombre / Razón Social *</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9 border-[#9E9E9E]" required /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">RIF *</label><Input value={formData.rif} onChange={e => setFormData({...formData, rif: e.target.value})} placeholder="J-12345678-0" className="h-9 border-[#9E9E9E]" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Teléfono</label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-9 border-[#9E9E9E]" /></div>
                <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Email</label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-9 border-[#9E9E9E]" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Dirección</label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="h-9 border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Persona de Contacto</label><Input value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className="h-9 border-[#9E9E9E]" /></div>
              <div className="bg-[#F5F5F5] -mx-5 -mb-5 p-4 mt-4 border-t flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="px-4 text-black">CANCELAR</Button>
                <Button type="submit" className="px-6 bg-primary text-black font-black">GUARDAR PROVEEDOR</Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de historial de pagos */}
      {viewingPayments && <PaymentHistoryModal supplier={viewingPayments} onClose={() => setViewingPayments(null)} />}
      
      {/* Modal de pago */}
      {showPaymentModal && selectedSupplierForPayment && (
        <SupplierPaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
          total={selectedInvoiceForPayment ? selectedInvoiceForPayment.total : getTotalPurchases(selectedSupplierForPayment.id)}
          currentPaid={selectedInvoiceForPayment ? selectedInvoiceForPayment.paidAmount : getTotalPaid(selectedSupplierForPayment.id)}
          supplierName={selectedSupplierForPayment.name}
          invoiceNumber={selectedInvoiceForPayment?.invoiceNumber || 'MÚLTIPLES FACTURAS'}
          exchangeRate={state.exchangeRate}
        />
      )}

      {/* ✅ Nuevo modal para detalles de factura */}
      {selectedInvoiceModal.invoice && (
        <InvoiceDetailModal
          invoice={selectedInvoiceModal.invoice}
          isOpen={selectedInvoiceModal.isOpen}
          onClose={() => setSelectedInvoiceModal({ invoice: null, isOpen: false })}
          purchaseItems={purchaseItems}
          supplierPayments={supplierPayments}
          supplierName={suppliers.find(s => s.id === selectedInvoiceModal.invoice?.supplierId)?.name || ''}
        />
      )}
    </div>
  );
}