"use client";

import { useState, useEffect, useCallback } from 'react';
import { Supplier, SupplierInvoice, SupplierPayment } from '@/lib/types';
import { syncService } from '@/services/syncService';
import { registerSupplierPaymentEntry } from '@/services/accountingService';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsubSuppliers = syncService.subscribeToSuppliers(setSuppliers);
    const unsubInvoices = syncService.subscribeToInvoices(setInvoices);
    const unsubPayments = syncService.subscribeToSupplierPayments(setPayments as any);
    
    setIsLoaded(true);

    return () => {
      unsubSuppliers();
      unsubInvoices();
      unsubPayments();
    };
  }, []);

  const addSupplier = useCallback(async (s: Omit<Supplier, 'id' | 'totalDebt' | 'createdAt'>) => {
    const newId = Date.now();
    const newSupplier = { ...s, id: newId, totalDebt: 0, createdAt: new Date().toISOString() };
    await syncService.saveSupplier(newSupplier);
    return newSupplier;
  }, []);

  const updateSupplier = useCallback(async (s: Supplier) => {
    await syncService.saveSupplier(s);
  }, []);

  const deleteSupplier = useCallback(async (id: number) => {
    await syncService.deleteSupplier(id);
  }, []);

  const addInvoice = useCallback(async (inv: Omit<SupplierInvoice, 'id' | 'paidAmount' | 'status' | 'createdAt'>) => {
    const newId = Date.now();
    const newInvoice = { ...inv, id: newId, paidAmount: 0, status: 'pendiente' as const, createdAt: new Date().toISOString() };
    await syncService.saveInvoice(newInvoice);
    
    const supplier = suppliers.find(s => s.id === inv.supplierId);
    if (supplier) {
      await syncService.saveSupplier({ ...supplier, totalDebt: (supplier.totalDebt || 0) + inv.total });
    }
    return newInvoice;
  }, [suppliers]);

  const addPayment = useCallback(async (p: Omit<SupplierPayment, 'id'>) => {
    const newId = Date.now();
    const newPayment = { ...p, id: newId };
    await syncService.saveSupplierPayment(newPayment);
    
    const invoice = invoices.find(i => i.id === p.invoiceId);
    if (invoice) {
      const newPaid = invoice.paidAmount + p.amount;
      const status = newPaid >= invoice.total ? 'pagada' : (newPaid > 0 ? 'parcial' : 'pendiente');
      await syncService.saveInvoice({ ...invoice, paidAmount: newPaid, status });
      
      const supplier = suppliers.find(s => s.id === p.supplierId);
      if (supplier) {
        await syncService.saveSupplier({ ...supplier, totalDebt: Math.max(0, (supplier.totalDebt || 0) - p.amount) });
        await registerSupplierPaymentEntry(newPayment, invoice, supplier);
      }
    }
    return newPayment;
  }, [invoices, suppliers]);

  const getSupplierInvoices = useCallback((id: number) => invoices.filter(i => i.supplierId === id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [invoices]);
  const getInvoicePayments = useCallback((id: number) => payments.filter(p => p.invoiceId === id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [payments]);

  return {
    suppliers, invoices, payments, isLoaded,
    addSupplier, updateSupplier, deleteSupplier,
    addInvoice, addPayment, getSupplierInvoices, getInvoicePayments
  };
}
