'use server';

import { db } from '@/lib/firebase';
import { doc, runTransaction, collection } from 'firebase/firestore';
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
 * Registra una compra masiva de productos utilizando una transacción atómica de Firestore.
 * Actualiza stock, recalcula costo promedio ponderado y genera asientos en el Kardex.
 */
export async function registerPurchase({
  supplierId,
  invoiceNumber,
  exchangeRate,
  items
}: RegisterPurchaseInput): Promise<{ success: boolean; message: string }> {
  if (!db) throw new Error('Firestore no está inicializado');

  try {
    await runTransaction(db, async (transaction) => {
      const date = new Date().toISOString();
      const invoiceId = Date.now();

      // 1. Calcular el monto total de la factura
      const totalInvoiceBs = items.reduce((sum, item) => sum + (item.qty * item.costUsd * exchangeRate), 0);

      // 2. Crear el registro en la colección supplier_invoices
      const invoiceRef = doc(db, 'supplier_invoices', invoiceId.toString());
      const invoiceData: SupplierInvoice = {
        id: invoiceId,
        supplierId,
        invoiceNumber,
        date: date.split('T')[0],
        dueDate: date.split('T')[0],
        subtotal: totalInvoiceBs,
        iva: 0,
        total: totalInvoiceBs,
        paidAmount: totalInvoiceBs,
        status: 'pagada',
        notes: `Compra de inventario. Tasa: ${exchangeRate}`,
        createdAt: date
      };
      transaction.set(invoiceRef, invoiceData);

      // 3. Procesar cada producto del array
      for (const item of items) {
        const productRef = doc(db, 'products', item.productId.toString());
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error(`El producto con ID ${item.productId} no existe`);
        }

        const product = productSnap.data() as Product;
        const currentStock = product.stock || 0;
        const currentCostUsd = product.costUsd || 0;
        const profitPercent = product.profitPercent || 30;

        // Calcular nuevo Stock
        const newStock = currentStock + item.qty;

        // Calcular Costo Promedio Ponderado en USD
        // Formula: ((StockActual * CostoActual) + (CantEntrante * CostoEntrante)) / (StockActual + CantEntrante)
        let newCostUsd = item.costUsd;
        if (newStock > 0) {
          newCostUsd = ((currentStock * currentCostUsd) + (item.qty * item.costUsd)) / newStock;
        }

        // Calcular nuevo costBs
        const newCostBs = newCostUsd * exchangeRate;

        // Recalcular precios de venta (priceUsd y priceBs)
        const newPriceUsd = newCostUsd * (1 + profitPercent / 100);
        const newPriceBs = newPriceUsd * exchangeRate;

        // Actualizar producto
        transaction.update(productRef, {
          stock: newStock,
          costUsd: newCostUsd,
          costBs: newCostBs,
          priceUsd: newPriceUsd,
          priceBs: newPriceBs,
          updatedAt: Date.now()
        });

        // Crear documento en la colección kardex
        const kardexId = `${Date.now()}_${item.productId}`;
        const kardexRef = doc(db, 'kardex', kardexId);
        const kardexData: KardexEntry = {
          productId: item.productId,
          date: date,
          type: 'entrada_compra',
          reference: invoiceNumber,
          qty: item.qty,
          costUsd: item.costUsd,
          costBs: item.costUsd * exchangeRate,
          stockAfter: newStock
        };
        transaction.set(kardexRef, kardexData);
      }

      // 4. Registrar el asiento contable de egreso (Pago a proveedor)
      const accountingId = Date.now() + 1;
      const accountingRef = doc(db, 'accounting_entries', accountingId.toString());
      transaction.set(accountingRef, {
        id: accountingId,
        date: date.split('T')[0],
        type: 'egreso',
        category: 'compra_mercancia',
        concept: `Compra Inv. Fact #${invoiceNumber}`,
        description: `Ingreso masivo de productos - Factura #${invoiceNumber}`,
        amount: totalInvoiceBs,
        referenceId: invoiceId,
        referenceType: 'supplier_payment',
        createdAt: date
      });
    });

    return { success: true, message: 'Compra procesada exitosamente' };
  } catch (error: any) {
    console.error('Error en transacción de compra:', error);
    return { success: false, message: error.message || 'Error al procesar la compra' };
  }
}
