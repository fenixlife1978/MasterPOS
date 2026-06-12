"use client";

import { useState, useEffect, useCallback } from 'react';
import syncService from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

export function useAccounting() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsub = syncService.subscribeToAccounting(setEntries as any);
    setIsHydrated(true);

    return () => unsub();
  }, [user]);

  // ✅ Función para guardar una entrada (alias de saveEntry)
  const saveEntry = useCallback((entry: any) => syncService.saveAccountingEntry(entry), []);
  
  // ✅ Alias para mantener compatibilidad con el módulo de contabilidad
  const addEntry = saveEntry;

  // ✅ Función para obtener total de ingresos
  const getTotalIngresos = useCallback(() => {
    return entries
      .filter(e => e.type === 'ingreso')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [entries]);

  // ✅ Función para obtener total de egresos
  const getTotalEgresos = useCallback(() => {
    return entries
      .filter(e => e.type === 'egreso')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [entries]);

  return { 
    entries, 
    saveEntry, 
    addEntry,      // ✅ Exportado para compatibilidad
    getTotalIngresos,
    getTotalEgresos,
    isHydrated 
  };
}