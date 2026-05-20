"use client";

import { useState, useEffect, useCallback } from 'react';
import { AccountingEntry, EXPENSE_CATEGORIES } from '@/lib/types';
import { syncService } from '@/services/syncService';

const STORAGE_KEY = 'masterpos_accounting_entries';

export function useAccounting() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Intentar cargar de Firebase primero
      const fbEntries = await syncService.loadAccountingEntries();
      if (fbEntries && fbEntries.length > 0) {
        setEntries(fbEntries as AccountingEntry[]);
      } else {
        // Fallback a localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setEntries(JSON.parse(stored));
        }
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoaded]);

  const addEntry = useCallback(async (entry: Omit<AccountingEntry, 'id' | 'createdAt'>) => {
    const newId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : Date.now();
    const newEntry: AccountingEntry = {
      ...entry,
      id: newId,
      createdAt: new Date().toISOString()
    };
    
    // Guardar en estado local para UI inmediata
    setEntries(prev => [newEntry, ...prev]);
    
    // Persistir en Firebase
    await syncService.saveAccountingEntry(newEntry);
    
    return newEntry;
  }, [entries]);

  const getEntriesByDateRange = useCallback((startDate: Date, endDate: Date) => {
    return entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startDate && entryDate <= endDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  const getTotalIngresos = useCallback(() => {
    return entries.filter(e => e.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const getTotalEgresos = useCallback(() => {
    return entries.filter(e => e.type === 'egreso').reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const getBalance = useCallback(() => {
    return getTotalIngresos() - getTotalEgresos();
  }, [getTotalIngresos, getTotalEgresos]);

  return {
    entries,
    addEntry,
    getEntriesByDateRange,
    getTotalIngresos,
    getTotalEgresos,
    getBalance,
    EXPENSE_CATEGORIES
  };
}
