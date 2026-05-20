"use client";

import { useState, useEffect, useCallback } from 'react';
import { AccountingEntry, EXPENSE_CATEGORIES } from '@/lib/types';
import { syncService } from '@/services/syncService';

export function useAccounting() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsub = syncService.subscribeToAccounting(setEntries as any);
    setIsLoaded(true);
    return () => unsub();
  }, []);

  const addEntry = useCallback(async (entry: Omit<AccountingEntry, 'id' | 'createdAt'>) => {
    const newEntry: AccountingEntry = {
      ...entry,
      id: Date.now(),
      createdAt: new Date().toISOString()
    };
    await syncService.saveAccountingEntry(newEntry);
    return newEntry;
  }, []);

  const getEntriesByDateRange = useCallback((start: Date, end: Date) => {
    return entries.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  const getTotalIngresos = useCallback(() => entries.filter(e => e.type === 'ingreso').reduce((s,e) => s + e.amount, 0), [entries]);
  const getTotalEgresos = useCallback(() => entries.filter(e => e.type === 'egreso').reduce((s,e) => s + e.amount, 0), [entries]);
  const getBalance = useCallback(() => getTotalIngresos() - getTotalEgresos(), [getTotalIngresos, getTotalEgresos]);

  return { entries, addEntry, getEntriesByDateRange, getTotalIngresos, getTotalEgresos, getBalance, EXPENSE_CATEGORIES };
}
