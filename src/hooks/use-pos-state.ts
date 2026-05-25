"use client";

import { useState, useEffect, useCallback } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem, KitComponent } from '@/lib/types';
import { syncService } from '@/services/syncService';
import { registerSaleEntry, registerCreditEntry, registerDebtPaymentEntry } from '@/services/accountingService';
import { useAuth } from '@/context/AuthContext';

function getVenezuelaISOString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
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
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}.000-04:00`;
}

function getVenezuelaTimestamp(): number {
  return Date.now();
}

const STORAGE_KEYS = {
  EXCHANGE_RATE: 'bcv_exchange_rate',
  POS_REGISTER: 'pos_register',
};

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
  const [globalIvaPercentage, setGlobalIvaPercentage] = useState(16);
  const [adminCode, setAdminCode] = useState<string>('');

  const saveRegisterToLocalStorage = useCallback((registerData: CashRegister | null) => {
    if (typeof window !== 'undefined') {
      if (registerData) {
        localStorage.setItem(STORAGE_KEYS.POS_REGISTER, JSON.stringify(registerData));
      } else {
        localStorage.removeItem(STORAGE_KEYS.POS_REGISTER);
      }
    }
  }, []);

  useEffect(() => {
    const cachedRegister = localStorage.getItem(STORAGE_KEYS.POS_REGISTER);
    if (cachedRegister) {
      try {
        setRegister(JSON.parse(cachedRegister));
      } catch (e) {}
    }
    
    const cachedRate = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
    if (cachedRate) {
      const rate = parseFloat(cachedRate);
      if (!isNaN(rate)) setExchangeRate(rate);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = syncService.subscribeToProducts(setProducts);
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    const unsubRegister = syncService.subscribeToRegister((registerData) => {
      setRegister(registerData);
      saveRegisterToLocalStorage(registerData);
    });
    
    const loadGlobalSettings = async () => {
      const settings = await syncService.getGlobalSettings();
      if (settings) {
        if (typeof settings.defaultIvaPercentage === 'number') setGlobalIvaPercentage(settings.defaultIvaPercentage);
        if (typeof settings.exchangeRate === 'number') {
          setExchangeRate(settings.exchangeRate);
          localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
        }
      }
      const code = await syncService.getAdminCode();
      if (code) setAdminCode(code.code);
    };
    loadGlobalSettings();
    
    setIsHydrated(true);

    return () => {
      unsubProducts();
      unsubClients();
      unsubTransactions();
      unsubAccounts();
      unsubRegister();
    };
  }, [user, saveRegisterToLocalStorage]);

  const addProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const updateProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const deleteProduct = useCallback((id: number) => syncService.deleteProduct(id), []);
  const saveClient = useCallback((c: Client) => syncService.saveClient(c), []);
  const deleteClient = useCallback((id: number) => syncService.deleteClient(id), []);

  const addToCart = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return false;
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        priceBs: product.priceUsd * exchangeRate, 
        priceUsd: product.priceUsd, 
        qty: 1, 
        category: product.category,
        ivaType: product.ivaType,
        ivaPercentage: product.ivaPercentage,
        isKit: product.isKit || false
      }];
    });
    return true;
  }, [products, exchangeRate]);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const updateCartQty = useCallback((productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return null as any;
        if (product && newQty > product.stock) return item;
        return { ...item, qty: newQty, priceBs: product ? product.priceUsd * exchangeRate : item.priceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, exchangeRate]);

  const updateCartItemPrice = useCallback((productId: number, newPriceUsd: number, newPriceBs: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId
          ? { ...item, priceUsd: newPriceUsd, priceBs: newPriceBs }
          : item
      )
    );
  }, []);

  const openCashRegister = useCallback(async (bsAmount: number, usdAmount: number, rate: number) => {
    const registerData: CashRegister = {
      isOpen: true,
      openTime: getVenezuelaISOString(),
      openAmount: bsAmount + (usdAmount * rate),
      openAmountBs: bsAmount,
      openAmountUsd: usdAmount,
      txs: [],
      exchangeRate: rate
    };
    await syncService.saveRegister(registerData);
    setRegister(registerData);
    saveRegisterToLocalStorage(registerData);
  }, [saveRegisterToLocalStorage]);

  const closeCashRegister = useCallback(() => {
    syncService.clearRegister();
    setRegister(null);
    saveRegisterToLocalStorage(null);
  }, [saveRegisterToLocalStorage]);

  const getKitComponents = (product: Product, qty: number): { productId: number; quantity: number }[] => {
    if (!product.isKit || !product.kitComponents || product.kitComponents.length === 0) {
      return [];
    }
    return product.kitComponents.map(comp => ({
      productId: comp.productId,
      quantity: comp.quantity * qty
    }));
  };

  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda', paymentData: any) => {
    if (!register?.isOpen) return;

    const subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
    const iva = cart.reduce((total, item) => {
      if (item.ivaType === 'con_iva') {
        return total + (item.priceBs * item.qty * 0.16);
      }
      return total;
    }, 0);
    const total = subtotal + iva;
    const finalTotal = type === 'cobro_deuda' ? (paymentData.totalPaid || paymentData.amount) : total;

    let targetClientId = paymentData.clientId;
    if (type === 'credito' && paymentData.isNewClient) {
      const nextClientId = getVenezuelaTimestamp();
      await syncService.saveClient({ 
        id: nextClientId, 
        name: paymentData.clientName, 
        cedula: paymentData.clientCedula, 
        phone: paymentData.clientPhone || '', 
        address: paymentData.clientAddress || '', 
        debt: 0 
      });
      targetClientId = nextClientId;
    }

    const tx: Transaction = {
      id: getVenezuelaTimestamp(),
      date: getVenezuelaISOString(),
      type,
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: type === 'cobro_deuda' ? finalTotal : subtotal,
      iva,
      total: finalTotal,
      totalUsd: finalTotal / exchangeRate,
      payMethod: paymentData.method || 'efectivo_bs',
      paidBs: paymentData.totalPaid || paymentData.amount || finalTotal,
      change: paymentData.change || 0,
      clientId: targetClientId,
      clientName: paymentData.clientName,
      exchangeRate,
      receiptNumber: paymentData.receiptNumber // ✅ Se guarda el numero correlativo en la transaccion
    };

    await syncService.saveTransaction(tx);

    const updatedRegister = {
      ...register,
      txs: [...(register.txs || []), tx],
    };
    await syncService.saveRegister(updatedRegister);
    setRegister(updatedRegister);
    saveRegisterToLocalStorage(updatedRegister);

    if (type !== 'cobro_deuda') {
      const stockUpdates: Map<number, number> = new Map();
      
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        
        if (product.isKit && product.kitComponents && product.kitComponents.length > 0) {
          const components = getKitComponents(product, item.qty);
          for (const comp of components) {
            const current = stockUpdates.get(comp.productId) || 0;
            stockUpdates.set(comp.productId, current + comp.quantity);
          }
          if (product.stock !== undefined && product.stock > 0) {
            const currentKit = stockUpdates.get(product.id) || 0;
            stockUpdates.set(product.id, currentKit + item.qty);
          }
        } else {
          const current = stockUpdates.get(product.id) || 0;
          stockUpdates.set(product.id, current + item.qty);
        }
      }
      
      for (const [prodId, qtyToSubtract] of stockUpdates.entries()) {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          const newStock = prod.stock - qtyToSubtract;
          await syncService.saveProduct({ ...prod, stock: Math.max(0, newStock) });
        }
      }
      
      const updatedProducts = [...products];
      for (const [prodId, qtyToSubtract] of stockUpdates.entries()) {
        const index = updatedProducts.findIndex(p => p.id === prodId);
        if (index !== -1) {
          updatedProducts[index] = { ...updatedProducts[index], stock: Math.max(0, updatedProducts[index].stock - qtyToSubtract) };
        }
      }
      setProducts(updatedProducts);
    }

    if (type === 'credito') {
      await syncService.saveAccount({ 
        id: getVenezuelaTimestamp(), 
        txId: tx.id, 
        date: tx.date, 
        clientId: targetClientId!, 
        clientName: paymentData.clientName, 
        clientCedula: paymentData.clientCedula || '', 
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '), 
        amountBs: total, 
        amountUsd: total / exchangeRate,
        paidAmount: 0, 
        status: 'pendiente',
        exchangeRate,
        receiptNumber: paymentData.receiptNumber
      });
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
  }, [cart, register, exchangeRate, clients, products, saveRegisterToLocalStorage]);

  const applyAbono = useCallback(async (clientId: number, amount: number) => {
    if (!register?.isOpen) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    let remaining = amount;
    const clientAccounts = accounts.filter(a => a.clientId === clientId && a.status !== 'pagada')
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const acc of clientAccounts) {
      if (remaining <= 0) break;
      const owed = acc.amountBs - (acc.paidAmount || 0);
      const pay = Math.min(remaining, owed);
      await syncService.saveAccount({ 
        ...acc, 
        paidAmount: (acc.paidAmount || 0) + pay, 
        status: (acc.paidAmount || 0) + pay >= acc.amountBs ? 'pagada' : 'parcial' 
      });
      remaining -= pay;
    }

    const tx: Transaction = { 
      id: getVenezuelaTimestamp(), 
      date: getVenezuelaISOString(), 
      type: 'cobro_deuda', 
      items: [], 
      subtotal: amount, 
      iva: 0, 
      total: amount, 
      totalUsd: amount / exchangeRate, 
      payMethod: 'efectivo_bs', 
      paidBs: amount, 
      change: 0, 
      clientId, 
      clientName: client.name,
      exchangeRate
    };
    
    await syncService.saveTransaction(tx);
    
    const updatedRegister = {
      ...register,
      txs: [...(register.txs || []), tx],
    };
    await syncService.saveRegister(updatedRegister);
    setRegister(updatedRegister);
    saveRegisterToLocalStorage(updatedRegister);
    
    await syncService.saveClient({ ...client, debt: Math.max(0, (client.debt || 0) - amount) });
    await registerDebtPaymentEntry(tx, client);
  }, [register, clients, accounts, exchangeRate, saveRegisterToLocalStorage]);

  const setExchangeRateProxy = useCallback(async (newRate: number) => {
    setExchangeRate(newRate);
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, newRate.toString());
    await syncService.saveGlobalSettings({ exchangeRate: newRate });
  }, []);

  return {
    products, setProducts, addProduct, updateProduct, deleteProduct,
    clients, setClients, saveClient, deleteClient, transactions, setTransactions, accounts, setAccounts,
    register, setRegister, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate: setExchangeRateProxy,
    cart, addToCart, removeFromCart, updateCartQty, updateCartItemPrice,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, isHydrated,
    globalIvaPercentage,
    adminCode
  };
}