"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import firebaseService from '@/services/firebaseService';
import { Product, Client, Transaction, Account } from '@/lib/types';

// Cola de sincronización para evitar múltiples llamadas
let syncQueue: Promise<any> | null = null;

export function useFirebase() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cambios de conectividad
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sincronizar datos al iniciar
  const syncData = useCallback(async () => {
    if (syncQueue) return syncQueue;
    
    syncQueue = firebaseService.syncAll();
    const data = await syncQueue;
    syncQueue = null;
    
    return data;
  }, []);

  // Guardar transacción (escritura diferida)
  const saveTransaction = useCallback((transaction: Transaction) => {
    firebaseService.addTransaction(transaction);
  }, []);

  // Forzar sincronización de transacciones pendientes
  const flushTransactions = useCallback(async () => {
    await firebaseService.flushTransactions();
  }, []);

  // Auto-sincronización periódica (cada 30 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        firebaseService.flushTransactions();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isOnline]);

  return {
    syncData,
    saveTransaction,
    flushTransactions,
    isLoading,
    isOnline,
    // Exponer métodos individuales
    loadProducts: firebaseService.loadProducts,
    loadClients: firebaseService.loadClients,
    loadTransactions: firebaseService.loadTransactions,
    loadAccounts: firebaseService.loadAccounts,
    saveProducts: firebaseService.saveProducts,
    saveClients: firebaseService.saveClients,
    saveAccounts: firebaseService.saveAccounts,
    updateProduct: firebaseService.updateProduct,
    addProduct: firebaseService.addProduct,
    deleteProduct: firebaseService.deleteProduct,
    saveRegister: firebaseService.saveRegister,
    clearRegister: firebaseService.clearRegister,
    subscribeToRegister: firebaseService.subscribeToRegister,
  };
}
