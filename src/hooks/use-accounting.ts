"use client";

import { useState, useEffect, useCallback } from 'react';
import { syncService } from '@/services/syncService';
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

  const saveEntry = useCallback((entry: any) => syncService.saveAccountingEntry(entry), []);

  return { entries, saveEntry, isHydrated };
}
