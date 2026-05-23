"use client";

import { useState, useEffect, useCallback } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem } from '@/lib/types';
import { syncService } from '@/services/syncService';
import { registerSaleEntry, registerCreditEntry, registerDebtPaymentEntry } from '@/services/accountingService';
import { useAuth } from '@/context/AuthContext';

// ✅ CORREGIDO: Genera el string ISO real adaptado estrictamente a la zona horaria de Venezuela (Caracas)
function getVenezuelaISOString(): string {
  const now = new Date();
  
  // Usamos Intl para extraer la fecha exacta según el huso horario de Venezuela sin desfases
  const formatter = new Intl.DateTimeFormat('sv-SE', { // 'sv-SE' da formato estructurado YYYY-MM-DD HH:mm:ss
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  // Construimos un string ISO 8601 legítimo especificando el desfase -04:00 de Venezuela
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}.000-04:00`;
}

// ✅ CORREGIDO: El ID de la transacción debe ser el tiempo Unix puro de la máquina para evitar saltos de día
function getVenezuelaTimestamp(): number {
  return Date.now();
}

export function usePOSState() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [exchangeRate, setExchangeRate] = useState(36.50);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isIvaEnabled, setIsIvaEnabled] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('pos');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = syncService.subscribeToProducts(setProducts);
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    const unsubRegister = syncService.subscribeToRegister(setRegister);
    
    setIsHydrated(true);

    return () => {
      unsubProducts();
      unsubClients();
      unsubTransactions();
      unsubAccounts();
      unsubRegister();
    };
  }, [user]);

  const addProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const updateProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const deleteProduct = useCallback((id: number) => syncService.deleteProduct(id), []);

  const saveClient = useCallback((c: Client) => syncService.saveClient(c), []);
  const deleteClient = useCallback((id: number) => syncService.deleteClient(id), []);

  // ✅ CORREGIDO: El precio en Bs se calcula en tiempo real usando el USD fijo del producto y la tasa actual
  const addToCart = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return false;
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      // ✅ Calcular priceBs basado en priceUsd (fijo) y la tasa actual
      const calculatedPriceBs = product.priceUsd * exchangeRate;
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        priceBs: calculatedPriceBs, 
        priceUsd: product.priceUsd, 
        qty: 1, 
        category: product.category 
      }];
    });
    return true;
  }, [products, exchangeRate]);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  // ✅ CORREGIDO: Al actualizar cantidad, también se recalcula el precio Bs por si acaso
  const updateCartQty = useCallback((productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return null as any;
        if (product && newQty > product.stock) return item;
        // ✅ Recalcular priceBs por si la tasa cambió
        const updatedPriceBs = product ? product.priceUsd * exchangeRate : item.priceBs;
        return { ...item, qty: newQty, priceBs: updatedPriceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, exchangeRate]);

  const openCashRegister = useCallback((amount: number) => {
    syncService.saveRegister({ isOpen: true, openTime: getVenezuelaISOString(), openAmount: amount, txs: [] });
  }, []);

  const closeCashRegister = useCallback(() => syncService.clearRegister(), []);

  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda', paymentData: any) => {
    if (!register?.isOpen) return;

    const subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
    const iva = isIvaEnabled ? subtotal * 0.16 : 0;
    const total = subtotal + iva;

    const finalTotal = type === 'cobro_deuda' ? paymentData.totalPaid : total;

    let targetClientId = paymentData.clientId;
    if (type === 'credito' && paymentData.isNewClient) {
      const nextClientId = getVenezuelaTimestamp();
      const newCli: Client = { id: nextClientId, name: paymentData.clientName, cedula: paymentData.clientCedula, phone: paymentData.clientPhone || '', address: paymentData.clientAddress || '', debt: 0 };
      await syncService.saveClient(newCli);
      targetClientId = nextClientId;
    }

    // Usar la fecha corregida de Venezuela
    const venezuelaDate = getVenezuelaISOString();
    const venezuelaTimestamp = getVenezuelaTimestamp();
    
    // ✅ NUEVO: Guardar la tasa de cambio actual para mantenerla como valor histórico
    const currentExchangeRate = exchangeRate;
    
    // ✅ CORREGIDO: El total en USD se calcula como suma de (priceUsd fijo * cantidad)
    const totalUsd = cart.reduce((acc, item) => acc + (item.priceUsd * item.qty), 0);

    const tx: Transaction = {
      id: venezuelaTimestamp,
      date: venezuelaDate,
      type: type,
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: type === 'cobro_deuda' ? paymentData.totalPaid : subtotal,
      iva: type === 'cobro_deuda' ? 0 : iva,
      total: finalTotal,
      totalUsd: totalUsd, // ✅ Usar el total en USD calculado desde precios fijos
      payMethod: paymentData.method || 'efectivo_bs',
      paidBs: paymentData.totalPaid || paymentData.amount || finalTotal,
      change: paymentData.change || 0,
      clientId: targetClientId,
      clientName: paymentData.clientName,
      exchangeRate: currentExchangeRate // ✅ TASA HISTÓRICA GUARDADA EN LA TRANSACCIÓN
    };

    await syncService.saveTransaction(tx);

    // ✅ ACTUALIZAR EL REGISTRO DE CAJA CON LA NUEVA TRANSACCIÓN (solo para ventas de contado y cobros)
    if (register && type !== 'credito') {
      const updatedRegister = {
        ...register,
        txs: [...(register.txs || []), tx]
      };
      await syncService.saveRegister(updatedRegister);
      setRegister(updatedRegister);
    }

    if (type !== 'cobro_deuda') {
      const updates = cart.map(item => {
        const p = products.find(prod => prod.id === item.productId);
        return p ? { ...p, stock: p.stock - item.qty } : null;
      }).filter(Boolean);
      await syncService.saveProducts(updates as Product[]);
    }

    if (type === 'credito') {
      // ✅ NUEVO: Guardar la tasa de cambio en la cuenta por cobrar también
      const acc: Account = { 
        id: getVenezuelaTimestamp(), 
        txId: tx.id, 
        date: venezuelaDate, 
        clientId: targetClientId, 
        clientName: paymentData.clientName, 
        clientCedula: paymentData.clientCedula || '', 
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '), 
        amountBs: total, 
        amountUsd: totalUsd, // ✅ Usar totalUsd calculado correctamente
        paidAmount: 0, 
        status: 'pendiente',
        exchangeRate: currentExchangeRate // ✅ TASA HISTÓRICA GUARDADA EN LA CUENTA
      };
      await syncService.saveAccount(acc);
      const client = clients.find(c => c.id === targetClientId);
      if (client) await syncService.saveClient({ ...client, debt: (client.debt || 0) + total });
      await registerCreditEntry(tx, client || { name: paymentData.clientName } as any);
    } else if (type === 'contado') {
      await registerSaleEntry(tx);
    } else if (type === 'cobro_deuda') {
      const client = clients.find(c => c.id === targetClientId);
      if (client) await registerDebtPaymentEntry(tx, client);
    }

    if (type !== 'cobro_deuda') setCart([]);
    return tx;
  }, [cart, register, exchangeRate, clients, products, isIvaEnabled]);

  const applyAbono = useCallback(async (clientId: number, amount: number) => {
    if (!register?.isOpen) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    let remaining = amount;
    const clientAccounts = accounts.filter(a => a.clientId === clientId && a.status !== 'pagada').sort((a,b) => new Date(a.date).getTime() - new Date(a.date).getTime());

    for (const acc of clientAccounts) {
      if (remaining <= 0) break;
      const owed = acc.amountBs - (acc.paidAmount || 0);
      const pay = Math.min(remaining, owed);
      const updatedAcc = { ...acc, paidAmount: (acc.paidAmount || 0) + pay, status: (acc.paidAmount || 0) + pay >= acc.amountBs ? 'pagada' : 'parcial' };
      await syncService.saveAccount(updatedAcc);
      remaining -= pay;
    }

    const venezuelaDate = getVenezuelaISOString();
    const venezuelaTimestamp = getVenezuelaTimestamp();
    const currentExchangeRate = exchangeRate;

    const tx: Transaction = { 
      id: venezuelaTimestamp, 
      date: venezuelaDate, 
      type: 'cobro_deuda', 
      items: [], 
      subtotal: amount, 
      iva: 0, 
      total: amount, 
      totalUsd: amount / currentExchangeRate, 
      payMethod: 'efectivo_bs', 
      paidBs: amount, 
      change: 0, 
      clientId, 
      clientName: client.name,
      exchangeRate: currentExchangeRate
    };
    
    await syncService.saveTransaction(tx);
    
    // ✅ ACTUALIZAR EL REGISTRO DE CAJA CON EL COBRO
    if (register) {
      const updatedRegister = {
        ...register,
        txs: [...(register.txs || []), tx]
      };
      await syncService.saveRegister(updatedRegister);
      setRegister(updatedRegister);
    }
    
    await syncService.saveClient({ ...client, debt: Math.max(0, (client.debt || 0) - amount) });
    await registerDebtPaymentEntry(tx, client);
  }, [register, clients, accounts, exchangeRate]);

  return {
    products, setProducts, addProduct, updateProduct, deleteProduct,
    clients, setClients, saveClient, deleteClient, transactions, setTransactions, accounts, setAccounts,
    register, setRegister, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate, cart, addToCart, removeFromCart, updateCartQty,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, isHydrated
  };
}