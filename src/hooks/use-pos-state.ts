
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

// Helper universal de redondeo a 2 decimales
const round = (n: number) => Math.round(n * 100) / 100;

export function usePOSState() {
  const { user } = useAuth();
  const terminalId = user?.terminalId || 'default';
  
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
        localStorage.setItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`, JSON.stringify(registerData));
      } else {
        localStorage.removeItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
      }
    }
  }, [terminalId]);

  useEffect(() => {
    const cachedRegister = localStorage.getItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
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
  }, [terminalId]);

  useEffect(() => {
    if (!user) return;
    const unsubProducts = syncService.subscribeToProducts(setProducts);
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    const unsubRegister = syncService.subscribeToRegisterByTerminal(terminalId, (registerData) => {
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
  }, [user, terminalId, saveRegisterToLocalStorage]);

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
        priceBs: round(product.priceUsd * exchangeRate), 
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
        return { ...item, qty: newQty, priceBs: product ? round(product.priceUsd * exchangeRate) : item.priceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, exchangeRate]);

  const updateCartItemPrice = useCallback((productId: number, newPriceUsd: number, newPriceBs: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId
          ? { ...item, priceUsd: round(newPriceUsd), priceBs: round(newPriceBs) }
          : item
      )
    );
  }, []);

  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda' | 'colaboracion' | 'consumo_propio', paymentData: any) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');
    const isSpecial = type === 'colaboracion' || type === 'consumo_propio';
    let subtotal = 0, iva = 0, total = 0, finalTotal = 0;
    
    if (!isSpecial) {
      subtotal = round(cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0));
      iva = round(cart.reduce((totalIva, item) => {
        if (item.ivaType === 'con_iva') return totalIva + round(item.priceBs * item.qty * 0.16);
        return totalIva;
      }, 0));
      total = round(subtotal + iva);
      finalTotal = type === 'cobro_deuda' ? round(paymentData.totalPaid || paymentData.amount) : total;
    }

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
      type: type as any,
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: isSpecial ? 0 : round(subtotal),
      iva: isSpecial ? 0 : round(iva),
      total: isSpecial ? 0 : round(finalTotal),
      totalUsd: isSpecial ? 0 : round(finalTotal / exchangeRate),
      payMethod: paymentData.method || 'efectivo_bs',
      paidBs: isSpecial ? 0 : round(paymentData.totalPaid || paymentData.amount || finalTotal),
      change: isSpecial ? 0 : round(paymentData.change || 0),
      clientId: targetClientId,
      clientName: paymentData.clientName,
      exchangeRate,
      receiptNumber: paymentData.receiptNumber,
    };

    const stockUpdates: Map<number, { newStock: number }> = new Map();
    const kardexEntries: any[] = [];
    if (type !== 'cobro_deuda') {
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const newStock = product.stock - item.qty;
          stockUpdates.set(product.id, { newStock });
          kardexEntries.push({
            id: `${Date.now()}_${Math.random()}`,
            productId: product.id,
            date: tx.date,
            type: isSpecial ? 'ajuste_negativo' : 'salida_venta',
            quantity: item.qty,
            previousStock: product.stock,
            newStock,
            reference: `Venta #${tx.id}`,
          });
        }
      }
    }

    await syncService.runAtomicSale(terminalId, tx, {
      products: stockUpdates,
      kardexEntries,
      registerUpdate: { txs: [...(register.txs || []), tx] }
    });

    if (type === 'credito') {
      const client = clients.find(c => c.id === targetClientId);
      if (client) await syncService.saveClient({ ...client, debt: round((client.debt || 0) + total) });
      await registerCreditEntry(tx, client || { name: paymentData.clientName } as any);
    } else if (type === 'contado') {
      await registerSaleEntry(tx);
    }

    setCart([]);
    return tx;
  }, [cart, register, exchangeRate, clients, products, terminalId]);

  const applyAbono = useCallback(async (clientId: number, amount: number) => {
    if (!register?.isOpen) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    let remaining = round(amount);
    const clientAccounts = accounts.filter(a => a.clientId === clientId && a.status !== 'pagada')
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const acc of clientAccounts) {
      if (remaining <= 0) break;
      const owed = round(acc.amountBs - (acc.paidAmount || 0));
      const pay = Math.min(remaining, owed);
      await syncService.saveAccount({ 
        ...acc, 
        paidAmount: round((acc.paidAmount || 0) + pay), 
        status: round((acc.paidAmount || 0) + pay) >= acc.amountBs ? 'pagada' : 'parcial' 
      });
      remaining = round(remaining - pay);
    }
    const tx: Transaction = { 
      id: getVenezuelaTimestamp(), date: getVenezuelaISOString(), type: 'cobro_deuda', items: [], 
      subtotal: round(amount), iva: 0, total: round(amount), totalUsd: round(amount / exchangeRate), 
      payMethod: 'efectivo_bs', paidBs: round(amount), change: 0, clientId, clientName: client.name, exchangeRate
    };
    await syncService.saveTransaction(tx);
    await syncService.saveClient({ ...client, debt: Math.max(0, round((client.debt || 0) - amount)) });
  }, [register, clients, accounts, exchangeRate]);

  return {
    products, setProducts, addProduct: (p: Product) => syncService.saveProduct(p), 
    updateProduct: (p: Product) => syncService.saveProduct(p), 
    deleteProduct: (id: number) => syncService.deleteProduct(id),
    clients, setClients, saveClient: (c: Client) => syncService.saveClient(c), 
    deleteClient: (id: number) => syncService.deleteClient(id),
    transactions, setTransactions, accounts, setAccounts,
    register, setRegister, 
    openCashRegister: async (bs: number, usd: number, r: number) => {
      const regData = { isOpen: true, openTime: getVenezuelaISOString(), openAmount: round(bs + (usd * r)), openAmountBs: bs, openAmountUsd: usd, txs: [], exchangeRate: r };
      await syncService.saveRegisterByTerminal(terminalId, regData);
    },
    closeCashRegister: () => syncService.clearRegisterByTerminal(terminalId),
    exchangeRate, setExchangeRate: (r: number) => { setExchangeRate(r); localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, r.toString()); syncService.saveGlobalSettings({ exchangeRate: r }); },
    cart, addToCart, removeFromCart, updateCartQty, updateCartItemPrice,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, isHydrated,
  };
}
