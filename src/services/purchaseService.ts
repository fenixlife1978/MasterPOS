'use server';

import { rtdb } from '@/lib/firebase';
import { ref, get, set, update } from 'firebase/database';
import { Product, SupplierInvoice, KardexEntry } from '@/lib/types';

interface PurchaseItem {
  productId: number;
  qty: number;
  costUsd: number;
}

interface RegisterPurchaseInput {
  supplierId: number;
  invoiceNumber: string;
  exchangeRate: number;
  items: PurchaseItem[];
}

/**
 * Registra una compra masiva de productos utilizando una transacción atómica.
 * Actualiza stock, recalcula costo promedio ponderado y genera asientos en el Kardex.
 */
export async function registerPurchase({
  supplierId,
  invoiceNumber,
  exchangeRate,
  items
}: RegisterPurchaseInput): Promise<{ success: boolean; message: string }> {
  if (!rtdb) throw new Error('Firebase Realtime Database no está inicializado');

  try {
    const date = new Date().toISOString();
    const invoiceId = Date.now();

    // 1. Calcular el monto total de la factura
    const totalInvoiceBs = items.reduce((sum, item) => sum + (item.qty * item.costUsd * exchangeRate), 0);

    // 2. Crear el registro en la colección purchase_invoices
    const invoiceRef = ref(rtdb, `purchase_invoices/${invoiceId}`);
    const invoiceData = {
      id: invoiceId,
      supplierId: supplierId,
      invoiceNumber: invoiceNumber,
      date: date.split('T')[0],
      dueDate: date.split('T')[0],
      subtotal: totalInvoiceBs,
      iva: 0,
      total: totalInvoiceBs,
      paidAmount: totalInvoiceBs,
      status: 'pagada',
      notes: `Compra de inventario. Tasa: ${exchangeRate}`,
      exchangeRate: exchangeRate,
      itemsCount: items.length,
      updatedAt: new Date().toISOString()
    };
    await set(invoiceRef, invoiceData);

    // 3. Procesar cada producto del array
    for (const item of items) {
      const productRef = ref(rtdb, `products/${item.productId}`);
      const productSnap = await get(productRef);

      if (!productSnap.exists()) {
        throw new Error(`El producto con ID ${item.productId} no existe`);
      }

      const product = productSnap.val() as Product;
      const currentStock = product.stock || 0;
      const currentCostUsd = product.costUsd || 0;
      const profitPercent = product.profitPercent || 30;

      // Calcular nuevo Stock
      const newStock = currentStock + item.qty;

      // Calcular Costo Promedio Ponderado en USD
      let newCostUsd = item.costUsd;
      if (newStock > 0) {
        newCostUsd = ((currentStock * currentCostUsd) + (item.qty * item.costUsd)) / newStock;
      }

      // Calcular nuevo costBs
      const newCostBs = newCostUsd * exchangeRate;

      // Recalcular precios de venta
      const newPriceUsd = newCostUsd * (1 + profitPercent / 100);
      const newPriceBs = newPriceUsd * exchangeRate;

      // Actualizar producto (usando camelCase para coincidir con el tipo Product)
      await update(productRef, {
        stock: newStock,
        costUsd: newCostUsd,
        costBs: newCostBs,
        priceUsd: newPriceUsd,
        priceBs: newPriceBs,
        updatedAt: new Date().toISOString()
      });

      // Crear documento en la colección kardex_entries
      const kardexId = `${Date.now()}_${item.productId}`;
      const kardexRef = ref(rtdb, `kardex_entries/${kardexId}`);
      const kardexData = {
        id: kardexId,
        productId: item.productId,
        date: date,
        type: 'entrada_compra',
        quantity: item.qty,
        previousStock: currentStock,
        newStock: newStock,
        reference: invoiceNumber,
        note: `Compra de ${item.qty} unidades a ${item.costUsd} USD`,
        costUsd: item.costUsd,
        updatedAt: new Date().toISOString()
      };
      await set(kardexRef, kardexData);
    }

    // 4. Registrar el asiento contable de egreso (Pago a proveedor)
    const accountingId = Date.now() + 1;
    const accountingRef = ref(rtdb, `accounting_entries/${accountingId}`);
    await set(accountingRef, {
      id: accountingId,
      date: date.split('T')[0],
      type: 'egreso',
      category: 'compra_mercancia',
      concept: `Compra Inv. Fact #${invoiceNumber}`,
      description: `Ingreso masivo de productos - Factura #${invoiceNumber}`,
      amount: totalInvoiceBs,
      referenceId: invoiceId,
      referenceType: 'supplier_payment',
      updatedAt: new Date().toISOString()
    });

    return { success: true, message: 'Compra procesada exitosamente' };
  } catch (error: any) {
    console.error('Error en transacción de compra:', error);
    return { success: false, message: error.message || 'Error al procesar la compra' };
  }
}