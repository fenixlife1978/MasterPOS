"use client";

import { useState, useEffect, useCallback } from 'react';
import { Supplier, SupplierInvoice, SupplierPayment } from '@/lib/types';

const STORAGE_KEY_SUPPLIERS = 'masterpos_suppliers';
const STORAGE_KEY_INVOICES = 'masterpos_supplier_invoices';
const STORAGE_KEY_PAYMENTS = 'masterpos_supplier_payments';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedSuppliers = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
    const storedInvoices = localStorage.getItem(STORAGE_KEY_INVOICES);
    const storedPayments = localStorage.getItem(STORAGE_KEY_PAYMENTS);

    if (storedSuppliers) setSuppliers(JSON.parse(storedSuppliers));
    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));
    if (storedPayments) setPayments(JSON.parse(storedPayments));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers));
      localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices));
      localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(payments));
    }
  }, [suppliers, invoices, payments, isLoaded]);

  const addSupplier = useCallback((supplier: Omit<Supplier, 'id' | 'totalDebt' | 'createdAt'>) => {
    const newId = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.id)) + 1 : 1;
    const newSupplier: Supplier = {
      ...supplier,
      id: newId,
      totalDebt: 0,
      createdAt: new Date().toISOString(),
    };
    setSuppliers(prev => [...prev, newSupplier]);
    return newSupplier;
  }, [suppliers]);

  const updateSupplier = useCallback((supplier: Supplier) => {
    setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s));
  }, []);

  const deleteSupplier = useCallback((id: number) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setInvoices(prev => prev.filter(i => i.supplierId !== id));
    setPayments(prev => prev.filter(p => p.supplierId !== id));
  }, []);

  const addInvoice = useCallback((invoice: Omit<SupplierInvoice, 'id' | 'paidAmount' | 'status' | 'createdAt'>) => {
    const newId = invoices.length > 0 ? Math.max(...invoices.map(i => i.id)) + 1 : 1;
    const newInvoice: SupplierInvoice = {
      ...invoice,
      id: newId,
      paidAmount: 0,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [...prev, newInvoice]);
    
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    if (supplier) {
      setSuppliers(prev => prev.map(s => 
        s.id === invoice.supplierId 
          ? { ...s, totalDebt: (s.totalDebt || 0) + invoice.total }
          : s
      ));
    }
    return newInvoice;
  }, [invoices, suppliers]);

  const addPayment = useCallback((payment: Omit<SupplierPayment, 'id'>) => {
    const newId = payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1;
    const newPayment: SupplierPayment = { ...payment, id: newId };
    setPayments(prev => [...prev, newPayment]);
    
    const invoice = invoices.find(i => i.id === payment.invoiceId);
    if (invoice) {
      const newPaidAmount = invoice.paidAmount + payment.amount;
      const newStatus = newPaidAmount >= invoice.total ? 'pagada' : (newPaidAmount > 0 ? 'parcial' : 'pendiente');
      setInvoices(prev => prev.map(i => 
        i.id === payment.invoiceId 
          ? { ...i, paidAmount: newPaidAmount, status: newStatus }
          : i
      ));
      
      const supplier = suppliers.find(s => s.id === payment.supplierId);
      if (supplier) {
        const newDebt = Math.max(0, (supplier.totalDebt || 0) - payment.amount);
        setSuppliers(prev => prev.map(s => 
          s.id === payment.supplierId ? { ...s, totalDebt: newDebt } : s
        ));
      }
    }
    return newPayment;
  }, [payments, invoices, suppliers]);

  const getSupplierInvoices = useCallback((supplierId: number) => {
    return invoices.filter(i => i.supplierId === supplierId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices]);

  const getInvoicePayments = useCallback((invoiceId: number) => {
    return payments.filter(p => p.invoiceId === invoiceId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payments]);

  return {
    suppliers,
    invoices,
    payments,
    isLoaded,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addInvoice,
    addPayment,
    getSupplierInvoices,
    getInvoicePayments,
  };
}
