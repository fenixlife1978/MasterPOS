"use client";

import { useState, useEffect, useCallback } from 'react';
import { syncService } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

export function useSuppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubSuppliers = syncService.subscribeToSuppliers(setSuppliers);
    const unsubInvoices = syncService.subscribeToInvoices(setInvoices);
    const unsubPayments = syncService.subscribeToSupplierPayments(setPayments as any);
    setIsHydrated(true);

    return () => {
      unsubSuppliers();
      unsubInvoices();
      unsubPayments();
    };
  }, [user]);

  const addSupplier = useCallback((s: any) => {
    const id = s.id || Date.now();
    return syncService.saveSupplier({ ...s, id, createdAt: new Date().toISOString() });
  }, []);

  const updateSupplier = useCallback((s: any) => {
    return syncService.saveSupplier(s);
  }, []);
  
  const deleteSupplier = useCallback((id: number) => {
    return syncService.deleteSupplier(id);
  }, []);

  const addInvoice = useCallback((inv: any) => {
    const id = inv.id || Date.now();
    return syncService.saveInvoice({ ...inv, id, createdAt: new Date().toISOString() });
  }, []);

  const addPayment = useCallback(async (p: any) => {
    const id = p.id || Date.now();
    // 1. Guardar el registro del pago
    await syncService.saveSupplierPayment({ ...p, id, createdAt: new Date().toISOString() });
    
    // 2. Actualizar la factura relacionada (paidAmount y status) en Firestore
    const invoice = invoices.find(inv => inv.id === p.invoiceId);
    if (invoice) {
      const newPaidAmount = (invoice.paidAmount || 0) + p.amount;
      const newStatus = newPaidAmount >= invoice.total ? 'pagada' : 'parcial';
      
      await syncService.saveInvoice({
        ...invoice,
        paidAmount: newPaidAmount,
        status: newStatus
      });
    }
  }, [invoices]);

  // Funciones auxiliares para filtrar datos en la UI
  const getSupplierInvoices = useCallback((supplierId: number) => {
    return invoices.filter(inv => inv.supplierId === supplierId);
  }, [invoices]);

  const getInvoicePayments = useCallback((invoiceId: number) => {
    return payments.filter(p => p.invoiceId === invoiceId);
  }, [payments]);

  return { 
    suppliers, 
    invoices, 
    payments, 
    addSupplier, 
    updateSupplier, 
    deleteSupplier, 
    addInvoice, 
    addPayment, 
    getSupplierInvoices, 
    getInvoicePayments,
    isHydrated 
  };
}
