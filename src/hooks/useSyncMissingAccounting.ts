// src/hooks/useSyncMissingAccounting.ts
import { useEffect, useRef, useState } from 'react';
import { useAccounting } from './use-accounting';
import { usePOSState } from './use-pos-state';

/**
 * Hook para sincronizar transacciones del POS con el Libro Diario de Contabilidad.
 * Garantiza que todas las ventas y cobros desde el 02/07/2026 tengan un asiento contable.
 * Excluye explícitamente las Ventas a Crédito, Consumos y Colaboraciones del registro financiero.
 */
export function useSyncMissingAccounting() {
  const { entries, addEntry } = useAccounting();
  const { transactions } = usePOSState();
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    // ✅ Solo ejecutar si hay datos cargados y no se ha sincronizado aún
    if (synced || syncingRef.current || !entries.length || !transactions.length) return;
    
    syncingRef.current = true;
    setSyncing(true);

    // ✅ Fecha límite: 02/07/2026 (según requerimiento)
    const startDate = new Date('2026-07-02T00:00:00-04:00');
    
    // ✅ Obtener IDs de transacciones que ya tienen un asiento contable (referencia directa)
    const registeredIds = new Set(
      entries
        .filter(e => e.referenceId !== undefined && e.referenceId !== null)
        .map(e => String(e.referenceId))
    );

    // ✅ Filtrar transacciones del POS que faltan en contabilidad
    const missing = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      // Regla: Desde el 02/07, no duplicar y excluir tipos inválidos
      const isCorrectDate = txDate >= startDate;
      const isNotRegistered = !registeredIds.has(String(tx.id));
      
      // ✅ Regla de Oro: NO registrar ventas a crédito, consumos ni colaboraciones en el libro diario de ingresos
      const isValidType = ['contado', 'cobro_deuda', 'devolucion'].includes(tx.type);
      
      return isCorrectDate && isNotRegistered && isValidType;
    });

    if (missing.length === 0) {
      setSynced(true);
      setSyncing(false);
      syncingRef.current = false;
      return;
    }

    // ✅ Registrar transacciones faltantes una a una
    let count = 0;
    const registerAll = async () => {
      for (const tx of missing) {
        try {
          let category = 'ventas';
          let type: 'ingreso' | 'egreso' = 'ingreso';
          let concept = `Venta POS #${tx.receiptNumber || tx.id}`;

          // Normalización de categorías y tipos
          if (tx.type === 'cobro_deuda') {
            category = 'cobro_deuda';
            concept = `Cobro deuda #${tx.receiptNumber || tx.id}`;
            type = 'ingreso';
          } else if (tx.type === 'devolucion') {
            category = 'devolucion';
            concept = `Devolución #${tx.receiptNumber || tx.id}`;
            type = 'egreso';
          }

          // ✅ Persistir en el Libro Diario (RTDB)
          // ✅ Se usa un ID basado en tx.id para evitar decimales de Math.random() y asegurar unicidad
          await addEntry({
            id: `sync_${tx.id}`,
            date: tx.date,
            type: type,
            category: category,
            concept: concept,
            description: tx.clientName ? `${concept} - Cliente: ${tx.clientName}` : (tx.notes || concept),
            amount: tx.total || 0,
            totalUsd: tx.totalUsd || (tx.total / (tx.exchangeRate || 1)),
            exchangeRate: tx.exchangeRate || 1,
            referenceType: tx.type,
            referenceId: tx.id,
            createdAt: new Date().toISOString()
          });

          count++;
          setAddedCount(count);
        } catch (error) {
          console.error(`❌ Error sincronizando tx ${tx.id}:`, error);
        }
      }

      setSynced(true);
      setSyncing(false);
      syncingRef.current = false;
    };

    registerAll();

  }, [transactions, entries, addEntry, synced]);

  return { synced, syncing, addedCount };
}
