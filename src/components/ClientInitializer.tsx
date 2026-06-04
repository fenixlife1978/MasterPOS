'use client';

import { useEffect } from 'react';
import { syncService } from '@/services/syncService';  // ✅ ruta corregida

export function ClientInitializer() {
  useEffect(() => {
    syncService.loadAllDataToCache().catch(console.error);
  }, []);
  return null;
}