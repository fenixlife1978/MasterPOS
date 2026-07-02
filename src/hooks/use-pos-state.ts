"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem, KitComponent } from '@/lib/types';
import syncService from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

function getVenezuelaISOString(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}.${partMap.fractionalSecond}-04:00`;
}

function getVenezuelaTimestamp(): number {
  return Date.now();
}

const STORAGE_KEYS = {
  EXCHANGE_RATE: 'bcv_exchange_rate',
  POS_REGISTER: 'pos_register',
};

export function usePOSState() {
  const { user, activeSession: authActiveSession, setActiveSession } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const terminalNameId = user?.terminalName || user?.terminalId || 'default';
  
  const registerRef = useRef<CashRegister | null>(null);
  const stockUnsubscribeRef = useRef<(() => void) | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [rawProducts, setRawProducts] = useState<Product[]>([]); // ✅ Almacén de datos puros de la DB
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
  const [currentSession, setCurrentSession] = useState<any | null>(authActiveSession);

  const isUpdatingRef = useRef(false);

  const saveRegisterToLocalStorage = useCallback((registerData: CashRegister | null) => {
    if (typeof window !== 'undefined') {
      if (registerData) {
        localStorage.setItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`, JSON.stringify(registerData));
      } else {
        localStorage.removeItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
      }
    }
  }, [terminalId]);

  // ✅ Limpieza en logout
  useEffect(() => {
    if (!user) {
      if (stockUnsubscribeRef.current) {
        stockUnsubscribeRef.current();
        stockUnsubscribeRef.current = null;
      }
      syncService.unsubscribeAll();
      setProducts([]);
      setRawProducts([]);
      setClients([]);
      setTransactions([]);
      setAccounts([]);
      setRegister(null);
      registerRef.current = null;
      setCurrentSession(null);
      setCart([]);
      localStorage.removeItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
    }
  }, [user, terminalId]);

  // ✅ Hidratación inicial (Caché local)
  useEffect(() => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    
    const cachedRegister = localStorage.getItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
    if (cachedRegister) {
      try { 
        const parsed = JSON.parse(cachedRegister);
        setRegister(parsed);
        registerRef.current = parsed;
      } catch (e) {}
    }
    const cachedRate = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
    if (cachedRate) {
      const rate = parseFloat(cachedRate);
      if (!isNaN(rate)) setExchangeRate(rate);
    }
    
    isUpdatingRef.current = false;
  }, [terminalId]);

  // ✅ Suscripción a Caja y Sesión Realtime
  useEffect(() => {
    if (!user?.terminalId) return;
    const unsubscribe = syncService.subscribeToRegisterRealtime(terminalId, (registerData) => {
      setRegister(registerData);
      registerRef.current = registerData;
      saveRegisterToLocalStorage(registerData);
      
      if (registerData && registerData.isOpen) {
        const session = {
          id: `${terminalId}_${registerData.openTime}`,
          terminalId: terminalId,
          userId: user?.uid || 'unknown',
          startTime: registerData.openTime,
          initialAmountUsd: registerData.openAmountUsd || 0,
          finalAmountUsd: 0,
          status: 'open',
          totalSales: registerData.txs?.length || 0,
          exchangeRate: registerData.exchangeRate || exchangeRate,
        };
        setCurrentSession(session);
        if (setActiveSession) setActiveSession(session);
      } else {
        setCurrentSession(null);
        if (setActiveSession) setActiveSession(null);
      }
    });
    return () => unsubscribe();
  }, [user?.terminalId, terminalId, user?.uid, exchangeRate, setActiveSession, saveRegisterToLocalStorage]);

  // ✅ SUSCRIPCIONES CENTRALES (Independientes de la tasa para evitar bucles)
  useEffect(() => {
    if (!user) return;

    // Suscripción a datos brutos
    const unsubProducts = syncService.subscribeToProducts((data: Product[]) => {
      setRawProducts(data);
    });
    
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    
    // Suscripción a configuración global (Tasa BCV) en tiempo real
    const unsubSettings = syncService.subscribeToGlobalSettings?.((settings: any) => {
      if (settings) {
        if (typeof settings.defaultIvaPercentage === 'number') {
          setGlobalIvaPercentage(settings.defaultIvaPercentage);
        }
        if (typeof settings.exchangeRate === 'number') {
          setExchangeRate(prev => {
            if (prev !== settings.exchangeRate) {
              localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
              return settings.exchangeRate;
            }
            return prev;
          });
        }
        if (settings.adminCode) setAdminCode(String(settings.adminCode));
      }
    }) || (() => {});
    
    const loadInitialSettings = async () => {
      try {
        const settings = await syncService.getGlobalSettings();
        if (settings) {
          if (typeof settings.defaultIvaPercentage === 'number') setGlobalIvaPercentage(settings.defaultIvaPercentage);
          if (typeof settings.exchangeRate === 'number') setExchangeRate(settings.exchangeRate);
          if (settings.adminCode) setAdminCode(String(settings.adminCode));
        }
        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading initial global settings:', error);
        setIsHydrated(true);
      }
    };
    loadInitialSettings();

    return () => {
      unsubProducts(); 
      unsubClients(); 
      unsubTransactions(); 
      unsubAccounts(); 
      if (typeof unsubSettings === 'function') unsubSettings();
    };
  }, [user]);

  // ✅ MAPEO DINÁMICO DE PRECIOS (Se dispara al cambiar la Tasa o los datos de DB)
  useEffect(() => {
    const rate = exchangeRate;
    const updated = rawProducts.map(p => {
      if (p.isPriceFixed) return p;
      return {
        ...p,
        priceBs: roundTo2(p.priceUsd * rate),
        costBs: p.costUsd ? roundTo2(p.costUsd * rate) : p.costBs,
      };
    });
    setProducts(updated);
  }, [rawProducts, exchangeRate]);

  // ✅ SINCRO DEL CARRITO EN TIEMPO REAL (Recalcula el total incluso con el carrito abierto)
  useEffect(() => {
    if (!isHydrated || cart.length === 0) return;

    setCart(prevCart => {
      let hasChanges = false;
      const updatedCart = prevCart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const masterPriceUsd = product.priceUsd;
          // El precio en Bs siempre se deriva de la tasa actual a menos que el producto sea de precio fijo
          const targetPriceBs = product.isPriceFixed ? item.priceBs : roundTo2(masterPriceUsd * exchangeRate);
          
          if (item.priceUsd !== masterPriceUsd || item.priceBs !== targetPriceBs) {
            hasChanges = true;
            return {
              ...item,
              priceUsd: masterPriceUsd,
              priceBs: targetPriceBs
            };
          }
        }
        return item;
      });

      return hasChanges ? updatedCart : prevCart;
    });
  }, [products, exchangeRate, isHydrated]);

  // ✅ Suscripción a stock físico (RTDB)
  useEffect(() => {
    if (!user) return;
    if (stockUnsubscribeRef.current) stockUnsubscribeRef.current();

    stockUnsubscribeRef.current = syncService.subscribeToStockRTDB((stockData: Record<string, number>) => {
      setRawProducts(prev => prev.map(p => {
        const s = stockData[p.id.toString()];
        return (s !== undefined && p.stock !== s) ? { ...p, stock: s } : p;
      }));
    });

    return () => { if (stockUnsubscribeRef.current) stockUnsubscribeRef.current(); };
  }, [user]);

  const addProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const updateProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const deleteProduct = useCallback((id: number) => syncService.deleteProduct(id), []);
  const saveClient = useCallback((c: Client) => syncService.saveClient(c), []);
  const deleteClient = useCallback((id: number) => syncService.deleteClient(id), []);

  const checkProductStock = useCallback((productId: number, quantity: number): boolean => {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    if (product.isKit && product.kitComponents?.length) {
      for (const component of product.kitComponents) {
        const comp = products.find(p => p.id === component.productId);
        if (!comp || comp.stock < (component.quantity * quantity)) return false;
      }
      return true;
    }
    return product.stock >= quantity;
  }, [products]);

  const addToCart = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !checkProductStock(productId, 1)) return false;
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (!checkProductStock(productId, existing.qty + 1)) return prev;
        return prev.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { 
        productId: product.id, name: product.name, priceBs: product.priceBs,
        priceUsd: product.priceUsd, qty: 1, category: product.category,
        ivaType: product.ivaType || 'sin_iva', ivaPercentage: product.ivaPercentage || 0, isKit: product.isKit || false,
        unitMeasure: product.unitMeasure || ''
      }];
    });
    return true;
  }, [products, checkProductStock]);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const updateCartQty = useCallback((productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return null as any;
        if (product && !checkProductStock(productId, newQty)) return item;
        return { ...item, qty: newQty, priceBs: product ? product.priceBs : item.priceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, checkProductStock]);

  const updateCartItemPrice = useCallback((productId: number, newPriceUsd: number, newPriceBs: number) => {
    setCart(prevCart => prevCart.map(item => item.productId === productId ? { ...item, priceUsd: roundTo2(newPriceUsd), priceBs: roundTo2(newPriceBs) } : item));
  }, []);

  const openCashRegister = useCallback(async (bsAmount: number, usdAmount: number, rate: number) => {
    const registerData: CashRegister = {
      isOpen: true, openTime: getVenezuelaISOString(), openAmount: bsAmount + (usdAmount * rate),
      openAmountBs: bsAmount, openAmountUsd: usdAmount, txs: [], exchangeRate: rate
    };
    await syncService.saveRegisterByTerminal(terminalId, registerData);
    setRegister(registerData);
    registerRef.current = registerData;
    saveRegisterToLocalStorage(registerData);
  }, [terminalId, saveRegisterToLocalStorage]);

  const closeCashRegister = useCallback(() => {
    syncService.saveRegisterByTerminal(terminalId, { isOpen: false, openTime: null, openAmountBs: 0, openAmountUsd: 0, txs: [], exchangeRate: null });
    setRegister(null);
    registerRef.current = null;
    saveRegisterToLocalStorage(null);
  }, [terminalId, saveRegisterToLocalStorage]);

  const finalizeSale = useCallback(async (type: any, paymentData: any) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');
    const isSpecial = type === 'colaboracion' || type === 'consumo_propio';
    let subtotal = 0, iva = 0, total = 0, costoTotalOperacion = 0;
    
    if (!isSpecial) {
      subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
      iva = cart.reduce((total, item) => item.ivaType === 'con_iva' ? total + (item.priceBs * item.qty * 0.16) : total, 0);
      total = subtotal + iva;
    } else {
      for (const item of cart) {
        const p = products.find(p => p.id === item.productId);
        if (p?.costUsd) costoTotalOperacion += (item.qty * p.costUsd);
      }
      costoTotalOperacion = roundTo2(costoTotalOperacion);
    }

    let targetClientId: number | undefined = paymentData.clientId ? Number(paymentData.clientId) : undefined;
    if (type === 'credito' && paymentData.isNewClient) {
      const nextClientId = getVenezuelaTimestamp();
      const newClient: Client = { 
        id: nextClientId, name: paymentData.clientName, cedula: paymentData.clientCedula, 
        phone: paymentData.clientPhone || '', address: paymentData.clientAddress || '', debt: 0,
      };
      await syncService.saveClient(newClient);
      targetClientId = nextClientId;
      setClients(prev => [...prev, newClient]);
    }

    const txId = getVenezuelaTimestamp();
    const tx: Transaction = {
      id: txId, date: getVenezuelaISOString(), type, items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: isSpecial ? 0 : (type === 'cobro_deuda' ? (paymentData.totalPaid || total) : subtotal),
      iva: isSpecial ? 0 : iva, total: isSpecial ? 0 : (type === 'cobro_deuda' ? (paymentData.totalPaid || total) : total),
      totalUsd: isSpecial ? costoTotalOperacion : roundTo2(total / exchangeRate),
      payMethod: paymentData.method || 'efectivo_bs', paidBs: isSpecial ? 0 : (paymentData.totalPaid || total),
      change: isSpecial ? 0 : (paymentData.change || 0), clientId: targetClientId, 
      clientName: paymentData.clientName || undefined, exchangeRate, 
      receiptNumber: paymentData.receiptNumber || undefined, terminalId: terminalNameId,
    };
    if (type === 'contado' && paymentData.payments) tx.payments = paymentData.payments;

    const stockUpdates = new Map();
    const kardexEntries = [];
    if (type !== 'cobro_deuda' && type !== 'devolucion') {
      for (const item of cart) {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
          const newStock = p.stock - item.qty;
          stockUpdates.set(p.id, { newStock });
          kardexEntries.push({
            id: `${Date.now()}_${p.id}`, productId: p.id, date: tx.date, type: isSpecial ? 'consumo' : 'venta',
            quantity: -item.qty, previousStock: p.stock, newStock, reference: `Venta #${txId}`, costUsd: p.costUsd,
          });
        }
      }
    }

    const newTxs = [...(register.txs || []), tx];
    await syncService.runAtomicSale(terminalId, tx, { products: stockUpdates, kardexEntries, registerUpdate: { txs: newTxs } });

    if (type === 'credito' && targetClientId) {
      await syncService.saveAccount({
        id: getVenezuelaTimestamp(), txId: tx.id, date: tx.date, clientId: targetClientId,
        clientName: tx.clientName, amountBs: total, amountUsd: roundTo2(total / exchangeRate), 
        paidAmount: 0, status: 'pendiente', exchangeRate, products: cart.map(i => `${i.name} x${i.qty}`).join(', ')
      });
      const c = clients.find(cl => cl.id === targetClientId);
      if (c) await syncService.saveClient({ ...c, debt: (c.debt || 0) + total });
    }

    if (type !== 'cobro_deuda') setCart([]);
    return tx;
  }, [cart, register, exchangeRate, clients, products, terminalId, terminalNameId]);

  const applyAbono = useCallback(async (clientId: number, amount: number) => {
    if (!register?.isOpen) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    const tx = await finalizeSale('cobro_deuda', { clientId, totalPaid: amount, clientName: client.name });
    const newDebt = Math.max(0, (client.debt || 0) - amount);
    await syncService.saveClient({ ...client, debt: newDebt });
    return tx;
  }, [register, clients, finalizeSale]);

  const setExchangeRateProxy = useCallback(async (newRate: number) => {
    // ✅ Actualización local optimista
    setExchangeRate(newRate);
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, newRate.toString());
    
    // ✅ Persistencia en la nube (esto disparará la suscripción para todos los usuarios)
    try {
      await syncService.saveGlobalSettings({ exchangeRate: newRate });
    } catch (error) {
      console.warn("Error persistiendo tasa en la nube:", error);
    }
  }, []);

  return {
    products, addProduct, updateProduct, deleteProduct,
    clients, saveClient, deleteClient, transactions, accounts,
    register, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate: setExchangeRateProxy,
    cart, addToCart, removeFromCart, updateCartQty, updateCartItemPrice,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, isHydrated, globalIvaPercentage, adminCode,
    currentSession, createCashSession: (amt: number) => syncService.saveRegisterByTerminal(terminalId, { ...register, isOpen: true, openAmountUsd: amt }),
    closeCashSession: (amt: number) => syncService.saveRegisterByTerminal(terminalId, { ...register, isOpen: false }),
    refreshAllData: () => syncService.loadAllDataToCache(),
  };
}
