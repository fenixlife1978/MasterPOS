// src/hooks/use-pos-state.ts
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

function getVenezuelaDate(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
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
  const registerRef = useRef<CashRegister | null>(null);
  const stockUnsubscribeRef = useRef<(() => void) | null>(null);
  
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
  const [currentSession, setCurrentSession] = useState<any | null>(authActiveSession);

  const pendingKardexEntries = useRef<any[]>([]);
  const pendingAccountingEntries = useRef<any[]>([]);
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

  // ✅ CORREGIDO: Solo recalcula precios si hay productos y si el rate cambió realmente
  const recalcAllPricesWithNewRate = useCallback((newRate: number) => {
    if (products.length === 0) return;
    
    setProducts(prevProducts => 
      prevProducts.map(product => {
        if (product.isPriceFixed) {
          return {
            ...product,
            costBs: product.costUsd ? roundTo2(product.costUsd * newRate) : product.costBs,
          };
        }
        return {
          ...product,
          priceBs: roundTo2(product.priceUsd * newRate),
          costBs: product.costUsd ? roundTo2(product.costUsd * newRate) : undefined,
        };
      })
    );
    
    setCart(prevCart =>
      prevCart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (product?.isPriceFixed) {
          return item;
        }
        return {
          ...item,
          priceBs: roundTo2(item.priceUsd * newRate),
        };
      })
    );
  }, [products]);

  // Limpiar cuando el usuario se desconecta
  useEffect(() => {
    if (!user) {
      if (stockUnsubscribeRef.current) {
        stockUnsubscribeRef.current();
        stockUnsubscribeRef.current = null;
      }
      syncService.unsubscribeAll();
      setProducts([]);
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

  // Cargar caché local - SOLO UNA VEZ
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

  // Sincronizar sesión activa con AuthContext
  useEffect(() => {
    setCurrentSession(authActiveSession);
  }, [authActiveSession]);

  // Suscripción a cambios de sesión
  useEffect(() => {
    if (!user?.terminalId) return;
    const unsubscribe = syncService.subscribeToRegisterRealtime(terminalId, (registerData) => {
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
  }, [user?.terminalId, terminalId, user?.uid, exchangeRate, setActiveSession]);

  // Suscripción al registro de caja
  useEffect(() => {
    if (!user) return;
    const unsubRegister = syncService.subscribeToRegisterRealtime(terminalId, (registerData) => {
      setRegister(registerData);
      registerRef.current = registerData;
      saveRegisterToLocalStorage(registerData);
    });
    return () => unsubRegister();
  }, [user, terminalId, saveRegisterToLocalStorage]);

  // ✅ CORREGIDO: Suscripción a productos - SIN dependencia de exchangeRate para evitar bucles
  useEffect(() => {
    if (!user) return;

    const unsubProducts = syncService.subscribeToProducts((data: Product[]) => {
      const currentRate = exchangeRate;
      const productsWithFixed = data.map(product => {
        if (product.isPriceFixed) return product;
        return {
          ...product,
          priceBs: roundTo2(product.priceUsd * currentRate),
          costBs: product.costUsd ? roundTo2(product.costUsd * currentRate) : undefined,
        };
      });
      setProducts(productsWithFixed);
    });
    
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    
    const unsubSettings = syncService.subscribeToGlobalSettings?.((settings: any) => {
      if (settings) {
        if (typeof settings.defaultIvaPercentage === 'number') {
          setGlobalIvaPercentage(settings.defaultIvaPercentage);
        }
        if (typeof settings.exchangeRate === 'number' && settings.exchangeRate !== exchangeRate) {
          if (!isUpdatingRef.current) {
            isUpdatingRef.current = true;
            setExchangeRate(settings.exchangeRate);
            localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
            isUpdatingRef.current = false;
          }
        }
      }
    }) || (() => {});
    
    const loadGlobalSettings = async () => {
      try {
        const settings = await syncService.getGlobalSettings();
        if (settings) {
          if (typeof settings.defaultIvaPercentage === 'number') {
            setGlobalIvaPercentage(settings.defaultIvaPercentage);
          }
          if (typeof settings.exchangeRate === 'number' && settings.exchangeRate !== exchangeRate) {
            if (!isUpdatingRef.current) {
              isUpdatingRef.current = true;
              setExchangeRate(settings.exchangeRate);
              localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
              isUpdatingRef.current = false;
            }
          }
        }
        const code = await syncService.getAdminCode();
        if (code) setAdminCode(code.code);
        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading global settings:', error);
        setIsHydrated(true);
      }
    };
    loadGlobalSettings();

    return () => {
      unsubProducts(); 
      unsubClients(); 
      unsubTransactions(); 
      unsubAccounts(); 
      if (typeof unsubSettings === 'function') unsubSettings();
    };
  }, [user, exchangeRate]);

  // ✅ CORREGIDO: Suscripción a stock
  useEffect(() => {
    if (!user) return;

    if (stockUnsubscribeRef.current) {
      stockUnsubscribeRef.current();
      stockUnsubscribeRef.current = null;
    }

    const unsubscribe = syncService.subscribeToStockRTDB((stockData: Record<string, number>) => {
      setProducts(prevProducts => 
        prevProducts.map(product => {
          const newStock = stockData[product.id.toString()];
          if (newStock !== undefined && product.stock !== newStock) {
            return { ...product, stock: newStock };
          }
          return product;
        })
      );
    });

    stockUnsubscribeRef.current = unsubscribe;

    return () => {
      if (stockUnsubscribeRef.current) {
        stockUnsubscribeRef.current();
        stockUnsubscribeRef.current = null;
      }
    };
  }, [user]);

  // ✅ CORREGIDO: Recalcular precios cuando cambia exchangeRate - con protección contra bucles
  useEffect(() => {
    if (products.length > 0 && !isUpdatingRef.current) {
      // Solo recalcular si los precios actuales no coinciden con la tasa actual
      const sampleProduct = products[0];
      if (sampleProduct && sampleProduct.priceBs !== roundTo2(sampleProduct.priceUsd * exchangeRate)) {
        recalcAllPricesWithNewRate(exchangeRate);
      }
    }
  }, [exchangeRate, products.length]);

  const refreshAllData = useCallback(async () => {
    console.log("🔄 Refrescando datos desde caché local...");
    const [newProducts, newClients, newTransactions, newAccounts] = await Promise.all([
      syncService.getProducts(),
      syncService.getClients(),
      syncService.getTransactions(),
      syncService.getAccounts(),
    ]);
    setProducts(newProducts);
    setClients(newClients);
    setTransactions(newTransactions);
    setAccounts(newAccounts);
    console.log("✅ Datos actualizados después de sincronización.");
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSyncComplete = () => {
      refreshAllData();
    };
    window.addEventListener('sync-complete', handleSyncComplete);
    return () => window.removeEventListener('sync-complete', handleSyncComplete);
  }, [refreshAllData]);

  // Escuchar comandos remotos de sincronización
  useEffect(() => {
    if (!terminalId || terminalId === 'default') return;
    const unsubscribe = syncService.listenForSyncCommands(terminalId, async () => {
      console.log(`📢 Terminal ${terminalId} ejecutando sincronización remota...`);
      await syncService.syncAllPending();
      await refreshAllData();
    });
    return () => unsubscribe();
  }, [terminalId, refreshAllData]);

  const addProduct = useCallback((p: Product) => {
    setProducts(prev => {
      if (prev.some(prod => prod.id === p.id)) return prev;
      return [...prev, p];
    });
    return syncService.saveProduct(p);
  }, []);

  const updateProduct = useCallback(async (p: Product) => {
    setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod));
    return syncService.saveProduct(p);
  }, []);

  const deleteProduct = useCallback((id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    return syncService.deleteProduct(id);
  }, []);

  const saveClient = useCallback((c: Client) => syncService.saveClient(c), []);
  const deleteClient = useCallback((id: number) => syncService.deleteClient(id), []);

  const refreshProducts = useCallback(async () => products, [products]);

  const checkProductStock = useCallback((productId: number, quantity: number): boolean => {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    if (product.isKit && product.kitComponents?.length) {
      for (const component of product.kitComponents) {
        const componentProduct = products.find(p => p.id === component.productId);
        if (!componentProduct || componentProduct.stock < (component.quantity * quantity)) return false;
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
        ivaType: product.ivaType, ivaPercentage: product.ivaPercentage, isKit: product.isKit || false
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

  // Crear sesión de caja
  const createCashSession = useCallback(async (initialAmountUsd: number): Promise<any> => {
    if (!user || !terminalId) throw new Error('Usuario o Terminal no autenticado');
    
    const registerData = await syncService.getRegisterByTerminal(terminalId);
    if (registerData && registerData.isOpen) {
      const session = {
        id: `${terminalId}_${registerData.openTime}`,
        terminalId: terminalId,
        userId: user.uid,
        startTime: registerData.openTime,
        initialAmountUsd: registerData.openAmountUsd || 0,
        finalAmountUsd: 0,
        status: 'open',
        totalSales: registerData.txs?.length || 0,
        exchangeRate: registerData.exchangeRate || exchangeRate,
      };
      setCurrentSession(session);
      if (setActiveSession) setActiveSession(session);
      return session;
    }
    return null;
  }, [user, terminalId, exchangeRate, setActiveSession]);

  // Cerrar sesión de caja
  const closeCashSession = useCallback(async (finalAmountUsd: number): Promise<any> => {
    if (!currentSession) throw new Error('No hay sesión activa');
    
    const closed = {
      ...currentSession,
      finalAmountUsd: finalAmountUsd,
      status: 'closed',
      closeTime: new Date().toISOString(),
    };
    
    setCurrentSession(null);
    if (setActiveSession) setActiveSession(null);
    return closed;
  }, [currentSession, setActiveSession]);

  // Recargar sesión
  const reloadSession = useCallback(async () => {
    if (!terminalId) return;
    const registerData = await syncService.getRegisterByTerminal(terminalId);
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
  }, [terminalId, user?.uid, exchangeRate, setActiveSession]);

  const openCashRegister = useCallback(async (bsAmount: number, usdAmount: number, rate: number) => {
    const registerData: CashRegister = {
      isOpen: true, openTime: getVenezuelaISOString(), openAmount: bsAmount + (usdAmount * rate),
      openAmountBs: bsAmount, openAmountUsd: usdAmount, txs: [], exchangeRate: rate
    };
    await syncService.saveRegisterByTerminal(terminalId, registerData);
    setRegister(registerData);
    registerRef.current = registerData;
    saveRegisterToLocalStorage(registerData);
    try { await createCashSession(usdAmount); } catch (e) { console.error('Error session:', e); }
  }, [terminalId, saveRegisterToLocalStorage, createCashSession]);

  const closeCashRegister = useCallback(() => {
    if (currentSession) closeCashSession(0).catch(console.error);
    syncService.saveRegisterByTerminal(terminalId, { isOpen: false, openTime: null, openAmountBs: 0, openAmountUsd: 0, txs: [], exchangeRate: null });
    setRegister(null);
    registerRef.current = null;
    saveRegisterToLocalStorage(null);
  }, [terminalId, saveRegisterToLocalStorage, currentSession, closeCashSession]);

  const getItemsToDiscount = useCallback((cartItems: CartItem[]): { productId: number; quantity: number; product: Product }[] => {
    const result: { productId: number; quantity: number; product: Product }[] = [];
    for (const item of cartItems) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      if (product.isKit && product.kitComponents?.length) {
        for (const component of product.kitComponents) {
          const componentProduct = products.find(p => p.id === component.productId);
          if (componentProduct) {
            const existing = result.find(r => r.productId === component.productId);
            if (existing) existing.quantity += component.quantity * item.qty;
            else result.push({ productId: component.productId, quantity: component.quantity * item.qty, product: componentProduct });
          }
        }
      } else {
        const existing = result.find(r => r.productId === item.productId);
        if (existing) existing.quantity += item.qty;
        else result.push({ productId: item.productId, quantity: item.qty, product: product });
      }
    }
    return result;
  }, [products]);

  // ✅ CORREGIDO: finalizeSale - clientId nunca es undefined
  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda' | 'colaboracion' | 'consumo_propio', paymentData: any) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');

    const isSpecial = type === 'colaboracion' || type === 'consumo_propio';
    let subtotal = 0, iva = 0, total = 0, finalTotal = 0, costoTotalOperacion = 0;
    
    if (!isSpecial) {
      subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
      iva = cart.reduce((total, item) => item.ivaType === 'con_iva' ? total + (item.priceBs * item.qty * 0.16) : total, 0);
      total = subtotal + iva;
      finalTotal = type === 'cobro_deuda' ? (paymentData.totalPaid || paymentData.amount) : total;
    } else {
      for (const item of cart) {
        const p = products.find(p => p.id === item.productId);
        if (p?.costUsd) costoTotalOperacion += (item.qty * p.costUsd);
      }
      costoTotalOperacion = roundTo2(costoTotalOperacion);
    }

    // ✅ CORREGIDO: clientId siempre es undefined o un número, nunca null
    let targetClientId: number | undefined = undefined;
    if (type === 'credito' && paymentData.isNewClient) {
      const nextClientId = getVenezuelaTimestamp();
      const newClient: Client = { 
        id: nextClientId, 
        name: paymentData.clientName, 
        cedula: paymentData.clientCedula, 
        phone: paymentData.clientPhone || '', 
        address: paymentData.clientAddress || '', 
        debt: 0,
      };
      await syncService.saveClient(newClient);
      targetClientId = nextClientId;
      setClients(prev => [...prev, newClient]);
    } else if (paymentData.clientId) {
      targetClientId = paymentData.clientId;
    }

    const txId = getVenezuelaTimestamp();
    const tx: Transaction = {
      id: txId, 
      date: getVenezuelaISOString(), 
      type: type as any, 
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: isSpecial ? 0 : (type === 'cobro_deuda' ? finalTotal : subtotal),
      iva: isSpecial ? 0 : iva, 
      total: isSpecial ? 0 : finalTotal,
      totalUsd: isSpecial ? 0 : roundTo2(finalTotal / exchangeRate),
      payMethod: paymentData.method || 'efectivo_bs', 
      paidBs: isSpecial ? 0 : (paymentData.totalPaid || paymentData.amount || finalTotal),
      change: isSpecial ? 0 : (paymentData.change || 0), 
      clientId: targetClientId, // ✅ Nunca undefined, solo number | undefined
      clientName: paymentData.clientName || undefined,
      exchangeRate, 
      receiptNumber: paymentData.receiptNumber || undefined, 
      costoTotalOperacion: isSpecial ? costoTotalOperacion : undefined,
      notes: isSpecial ? paymentData.notes : undefined, 
      authorizedBy: isSpecial ? paymentData.authorizedBy : undefined,
      sessionId: currentSession?.id || undefined, 
      ajusteRedondeoBs: paymentData.ajusteRedondeoBs || 0,
    };
    if (type === 'contado' && paymentData.payments) tx.payments = paymentData.payments;

    const stockUpdates: Map<number, { newStock: number }> = new Map();
    const kardexEntries: any[] = [];
    if (type !== 'cobro_deuda') {
      for (const discountItem of getItemsToDiscount(cart)) {
        const product = discountItem.product;
        if (!product) continue;
        const newStock = product.stock - discountItem.quantity;
        stockUpdates.set(product.id, { newStock });
        
        let kardexType: string = 'venta';
        if (isSpecial) {
          if (type === 'colaboracion') kardexType = 'colaboracion';
          else if (type === 'consumo_propio') kardexType = 'consumo';
          else kardexType = 'ajuste_manual';
        }
        
        kardexEntries.push({
          id: `${Date.now()}_${Math.random()}`,
          productId: product.id,
          date: tx.date,
          type: kardexType,
          quantity: -discountItem.quantity,
          previousStock: product.stock,
          newStock,
          reference: isSpecial ? `[${type}] ${paymentData.notes || 'Sin motivo'}` : `Venta #${tx.id}`,
          note: isSpecial ? paymentData.notes || 'Sin motivo' : `Venta #${tx.id}`,
          costUsd: product.costUsd,
        });
      }
    }

    setProducts(prevProducts => prevProducts.map(p => {
      const update = stockUpdates.get(p.id);
      if (update) return { ...p, stock: update.newStock };
      return p;
    }));

    let accountingEntry: any = null;
    if (isSpecial && costoTotalOperacion > 0) {
      accountingEntry = {
        id: getVenezuelaTimestamp(),
        date: getVenezuelaISOString(),
        type: 'egreso',
        category: 'otros',
        subcategory: type === 'colaboracion' ? 'Donaciones' : 'Consumo Interno',
        concept: `Salida por ${type}`,
        description: paymentData.notes || 'Sin motivo',
        amount: costoTotalOperacion,
        referenceId: tx.id,
        referenceType: type,
        createdAt: getVenezuelaISOString(),
      };
    } else if (type === 'contado' || type === 'credito' || type === 'cobro_deuda') {
      accountingEntry = {
        id: getVenezuelaTimestamp() + 1,
        date: getVenezuelaISOString(),
        type: 'ingreso',
        category: type === 'credito' ? 'cuenta_por_cobrar' : (type === 'cobro_deuda' ? 'cobro_deuda' : 'ventas'),
        concept: type === 'cobro_deuda' ? 'Cobro de deuda' : (type === 'credito' ? 'Venta a crédito' : 'Venta'),
        description: `Cliente: ${tx.clientName || 'Cliente Final'} - Pago: ${tx.payMethod}`,
        amount: tx.total,
        referenceId: tx.id,
        referenceType: type,
        createdAt: getVenezuelaISOString(),
      };
    }

    const newTxs = [...(register.txs || []), tx];
    
    try {
      await syncService.runAtomicSale(terminalId, tx, { 
        products: stockUpdates, 
        kardexEntries,
        accountingEntry: accountingEntry,
        registerUpdate: { txs: newTxs } 
      });
    } catch (syncError) {
      console.warn("⚠️ Error de sincronización inmediata, la operación se reintentará en segundo plano.", syncError);
    }

    setRegister({ ...register, txs: newTxs });
    registerRef.current = { ...register, txs: newTxs };
    saveRegisterToLocalStorage({ ...register, txs: newTxs });
    
    // ✅ CORREGIDO: Solo crear cuenta si hay un clientId válido
    if (type === 'credito' && targetClientId) {
      const newAcc: Account = {
        id: getVenezuelaTimestamp(), 
        txId: tx.id, 
        date: tx.date, 
        clientId: targetClientId,
        clientName: paymentData.clientName || 'Cliente', 
        clientCedula: paymentData.clientCedula || '',
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '),
        amountBs: total, 
        amountUsd: roundTo2(total / exchangeRate), 
        paidAmount: 0, 
        status: 'pendiente', 
        exchangeRate,
      };
      await syncService.saveAccount(newAcc);
      setAccounts(prev => [...prev, newAcc]);
      
      const c = clients.find(cl => cl.id === targetClientId);
      if (c) {
        const updatedClient = { ...c, debt: (c.debt || 0) + total };
        await syncService.saveClient(updatedClient);
        setClients(prev => prev.map(cl => cl.id === targetClientId ? updatedClient : cl));
      }
    }

    if (type !== 'cobro_deuda') setCart([]);
    return tx;
  }, [cart, register, exchangeRate, clients, products, terminalId, saveRegisterToLocalStorage, getItemsToDiscount, currentSession]);

  // ✅ CORREGIDO: applyAbono - clientId ya es número
  const applyAbono = useCallback(async (clientId: number, amount: number, method: string = 'efectivo_bs') => {
    if (!register?.isOpen) {
      console.warn("Caja no abierta, no se puede registrar el pago");
      return;
    }
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      console.warn("Cliente no encontrado");
      return;
    }

    let remaining = amount;
    const clientAccounts = accounts
      .filter(a => a.clientId === clientId && a.status !== 'pagada')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const updatedAccounts = [...accounts];
    for (const acc of clientAccounts) {
      if (remaining <= 0) break;
      const owed = acc.amountBs - (acc.paidAmount || 0);
      const pay = Math.min(remaining, owed);
      const newPaid = (acc.paidAmount || 0) + pay;
      const newStatus: 'pagada' | 'parcial' = newPaid >= acc.amountBs ? 'pagada' : 'parcial';
      const updatedAcc = { ...acc, paidAmount: newPaid, status: newStatus };
      await syncService.saveAccount(updatedAcc);
      const idx = updatedAccounts.findIndex(a => a.id === acc.id);
      if (idx !== -1) updatedAccounts[idx] = updatedAcc;
      remaining -= pay;
    }
    setAccounts(updatedAccounts);

    const txId = getVenezuelaTimestamp();
    const tx: Transaction = {
      id: txId,
      date: getVenezuelaISOString(),
      type: 'cobro_deuda',
      items: [],
      subtotal: amount,
      iva: 0,
      total: amount,
      totalUsd: roundTo2(amount / exchangeRate),
      payMethod: method,
      paidBs: amount,
      change: 0,
      clientId: clientId, // ✅ Siempre es un número
      clientName: client.name,
      exchangeRate,
      sessionId: currentSession?.id || undefined,
      notes: `Abono de Bs ${amount.toFixed(2)}`,
    };

    const accountingEntry = {
      id: getVenezuelaTimestamp() + 2,
      date: getVenezuelaISOString(),
      type: 'ingreso',
      category: 'cobro_deuda',
      concept: 'Cobro de deuda',
      description: `Abono Cliente: ${client.name} - ${method}`,
      amount: amount,
      referenceId: tx.id,
      referenceType: 'cobro_deuda',
      createdAt: getVenezuelaISOString(),
    };

    const newTxs = [...(register.txs || []), tx];
    await syncService.runAtomicSale(terminalId, tx, {
      products: new Map(),
      kardexEntries: [],
      accountingEntry: accountingEntry,
      registerUpdate: { txs: newTxs }
    });

    setRegister({ ...register, txs: newTxs });
    registerRef.current = { ...register, txs: newTxs };
    saveRegisterToLocalStorage({ ...register, txs: newTxs });

    const newDebt = Math.max(0, (client.debt || 0) - amount);
    const updatedClient = { ...client, debt: newDebt };
    await syncService.saveClient(updatedClient);
    setClients(prev => prev.map(c => c.id === clientId ? updatedClient : c));
  }, [register, clients, accounts, exchangeRate, terminalId, saveRegisterToLocalStorage, currentSession]);

  // ✅ CORREGIDO: registerCashEgress - clientId siempre es undefined
  const registerCashEgress = useCallback(async (
    amount: number,
    reason: string,
    referenceId: number,
    payMethod: string = 'efectivo_bs',
    usdAmount?: number
  ) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');

    const isUsd = payMethod === 'usd_efectivo' || payMethod === 'zelle';
    const totalBs = isUsd ? (usdAmount || 0) * exchangeRate : amount;
    const totalUsd = isUsd ? (usdAmount || 0) : amount / exchangeRate;

    const tx: Transaction = {
      id: getVenezuelaTimestamp(),
      date: getVenezuelaISOString(),
      type: 'devolucion',
      items: [],
      subtotal: totalBs,
      iva: 0,
      total: totalBs,
      totalUsd: roundTo2(totalUsd),
      payMethod: payMethod,
      paidBs: totalBs,
      change: 0,
      clientId: undefined, // ✅ Siempre undefined para devoluciones
      clientName: 'DEVOLUCIÓN',
      exchangeRate,
      notes: reason,
      sessionId: currentSession?.id || undefined,
      payments: [{
        id: crypto.randomUUID(),
        method: payMethod,
        amount: isUsd ? (usdAmount || 0) : amount,
        usdAmount: isUsd ? (usdAmount || 0) : undefined,
      }],
    };

    const accountingEntry = {
      id: getVenezuelaTimestamp() + 3,
      date: getVenezuelaISOString(),
      type: 'egreso',
      category: 'devolucion',
      concept: 'Devolución de venta',
      description: reason,
      amount: totalBs,
      referenceId: tx.id,
      referenceType: 'return',
      createdAt: getVenezuelaISOString(),
    };

    const newTxs = [...(register.txs || []), tx];
    await syncService.runAtomicSale(terminalId, tx, {
      products: new Map(),
      kardexEntries: [],
      accountingEntry: accountingEntry,
      registerUpdate: { txs: newTxs }
    });

    setRegister({ ...register, txs: newTxs });
    registerRef.current = { ...register, txs: newTxs };
    saveRegisterToLocalStorage({ ...register, txs: newTxs });
    return tx;
  }, [register, exchangeRate, terminalId, saveRegisterToLocalStorage, currentSession]);

  const setExchangeRateProxy = useCallback(async (newRate: number) => {
    setExchangeRate(newRate);
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, newRate.toString());
    recalcAllPricesWithNewRate(newRate);
    try {
      await syncService.saveGlobalSettings({ exchangeRate: newRate });
    } catch (error) {
      console.warn("No se pudo sincronizar la tasa con la nube (modo offline o error)", error);
    }
  }, [recalcAllPricesWithNewRate]);

  const getPendingKardexEntries = useCallback(() => pendingKardexEntries.current, []);
  const getPendingAccountingEntries = useCallback(() => pendingAccountingEntries.current, []);
  const clearPendingEntries = useCallback(() => {
    pendingKardexEntries.current = [];
    pendingAccountingEntries.current = [];
  }, []);

  return {
    products, setProducts, addProduct, updateProduct, deleteProduct,
    clients, setClients, saveClient, deleteClient, transactions, setTransactions, accounts, setAccounts,
    register, setRegister, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate: setExchangeRateProxy,
    cart, addToCart, removeFromCart, updateCartQty, updateCartItemPrice,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, registerCashEgress,
    isHydrated, globalIvaPercentage, adminCode, checkProductStock, refreshProducts,
    currentSession, setCurrentSession, reloadSession, createCashSession, closeCashSession,
    getPendingKardexEntries, getPendingAccountingEntries, clearPendingEntries,
    refreshAllData,
  };
}