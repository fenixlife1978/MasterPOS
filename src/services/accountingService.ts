"use client";

import { syncService } from './syncService';
import { Transaction } from '@/lib/types';

// Generar ID único para asientos contables
const generateId = (): number => {
  return Date.now();
};

// Registrar asiento de ingreso por venta
export const registerSaleEntry = async (transaction: Transaction) => {
  const entry = {
    id: generateId(),
    date: transaction.date.split('T')[0],
    type: 'ingreso',
    category: 'ventas',
    concept: `Venta`,
    description: `Venta al contado - Cliente: ${transaction.clientName || 'Cliente Final'} - Método: ${transaction.payMethod?.replace('_', ' ') || 'EFECTIVO'}`,
    amount: transaction.total,
    referenceId: transaction.id,
    referenceType: 'sale',
    createdAt: new Date().toISOString()
  };
  
  await syncService.saveAccountingEntry(entry);
  return entry;
};

// Registrar asiento de egreso por devolución
export const registerReturnEntry = async (transaction: Transaction, originalSaleId: number) => {
  const entry = {
    id: generateId(),
    date: transaction.date.split('T')[0],
    type: 'egreso',
    category: 'devolucion',
    concept: `Devolución de venta`,
    description: `Devolución - Cliente: ${transaction.clientName || 'Cliente Final'} - Monto: Bs ${transaction.total.toFixed(2)}`,
    amount: transaction.total,
    referenceId: transaction.id,
    referenceType: 'return',
    createdAt: new Date().toISOString()
  };
  
  await syncService.saveAccountingEntry(entry);
  return entry;
};

// Registrar asiento de egreso por pago a proveedor
export const registerSupplierPaymentEntry = async (payment: any, invoice: any, supplier: any) => {
  const entry = {
    id: generateId(),
    date: payment.date.split('T')[0],
    type: 'egreso',
    category: 'compra_mercancia',
    concept: `Pago a proveedor`,
    description: `Pago a ${supplier.name} por compra de mercancía. Método: ${payment.method}`,
    amount: payment.amount,
    referenceId: payment.id,
    referenceType: 'supplier_payment',
    createdAt: new Date().toISOString()
  };
  
  await syncService.saveAccountingEntry(entry);
  return entry;
};

// Registrar asiento de egreso por gasto operacional
export const registerExpenseEntry = async (expenseData: {
  category: string;
  subcategory?: string;
  concept: string;
  description: string;
  amount: number;
  date: string;
}) => {
  const entry = {
    id: generateId(),
    date: expenseData.date,
    type: 'egreso',
    category: expenseData.category,
    subcategory: expenseData.subcategory,
    concept: expenseData.concept,
    description: expenseData.description,
    amount: expenseData.amount,
    referenceType: 'expense',
    createdAt: new Date().toISOString()
  };
  
  await syncService.saveAccountingEntry(entry);
  return entry;
};

// Registrar asiento de ingreso por cobro de deuda
export const registerDebtPaymentEntry = async (transaction: Transaction, client: any) => {
  const entry = {
    id: generateId(),
    date: transaction.date.split('T')[0],
    type: 'ingreso',
    category: 'cobro_deuda',
    concept: `Cobro de deuda`,
    description: `Abono a cuenta - Cliente: ${client.name} - Método: ${transaction.payMethod?.replace('_', ' ') || 'EFECTIVO'}`,
    amount: transaction.total,
    referenceId: transaction.id,
    referenceType: 'debt_payment',
    createdAt: new Date().toISOString()
  };
  
  await syncService.saveAccountingEntry(entry);
  return entry;
};

// Registrar asiento de ingreso por crédito concedido
export const registerCreditEntry = async (transaction: Transaction, client: any) => {
  const entry = {
    id: generateId(),
    date: transaction.date.split('T')[0],
    type: 'ingreso',
    category: 'cuenta_por_cobrar',
    concept: `Venta a crédito`,
    description: `Cliente: ${client.name} - Monto: Bs ${transaction.total.toFixed(2)}`,
    amount: transaction.total,
    referenceId: transaction.id,
    referenceType: 'credit_sale',
    createdAt: new Date().toISOString()
  };
  
  await syncService.saveAccountingEntry(entry);
  return entry;
};