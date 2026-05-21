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

  const saveSupplier = useCallback((s: any) => syncService.saveSupplier(s), []);
  const deleteSupplier = useCallback((id: number) => syncService.deleteSupplier(id), []);
  const saveInvoice = useCallback((inv: any) => syncService.saveInvoice(inv), []);
  const savePayment = useCallback((p: any) => syncService.saveSupplierPayment(p), []);

  return { suppliers, invoices, payments, saveSupplier, deleteSupplier, saveInvoice, savePayment, isHydrated };
}
