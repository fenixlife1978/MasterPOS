"use client";

import { useState, useEffect, useCallback } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem, KitComponent } from '@/lib/types';
import { syncService } from '@/services/syncService';
import { registerSaleEntry, registerCreditEntry, registerDebtPaymentEntry } from '@/services/accountingService';
import { useAuth } from '@/context/AuthContext';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

// ✅ Redondeo a 2 decimales (comercial)
const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
// ✅ Redondeo a 4 decimales (para costos)
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

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

  // ✅ Función para recalcular precios en Bs de todos los productos cuando cambia la tasa
  const recalcAllPricesWithNewRate = useCallback((newRate: number) => {
    console.log(`🔄 Recalculando precios con nueva tasa: ${newRate}`);
    setProducts(prevProducts => 
      prevProducts.map(product => ({
        ...product,
        priceBs: roundTo2(product.priceUsd * newRate),
        costBs: product.costUsd ? roundTo2(product.costUsd * newRate) : undefined,
      }))
    );
    
    // ✅ También actualizar los precios en el carrito
    setCart(prevCart =>
      prevCart.map(item => ({
        ...item,
        priceBs: roundTo2(item.priceUsd * newRate),
      }))
    );
  }, []);

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

    // ✅ Suscripción a productos - asegurar que priceBs esté calculado con la tasa actual
    const unsubProducts = syncService.subscribeToProducts((data: Product[]) => {
      const productsWithCorrectBs = data.map(product => ({
        ...product,
        priceBs: roundTo2(product.priceUsd * exchangeRate),
        costBs: product.costUsd ? roundTo2(product.costUsd * exchangeRate) : undefined,
      }));
      setProducts(productsWithCorrectBs);
    });
    
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    const unsubRegister = syncService.subscribeToRegisterByTerminal(terminalId, (registerData) => {
      setRegister(registerData);
      saveRegisterToLocalStorage(registerData);
    });
    
    // ✅ SUSCRIPCIÓN A CAMBIOS GLOBALES (TASA BCV) - ESTO ES LO QUE FALTABA
    const unsubSettings = syncService.subscribeToGlobalSettings?.((settings: any) => {
      console.log('📡 Cambios globales recibidos:', settings);
      if (settings) {
        if (typeof settings.defaultIvaPercentage === 'number') {
          setGlobalIvaPercentage(settings.defaultIvaPercentage);
        }
        if (typeof settings.exchangeRate === 'number' && settings.exchangeRate !== exchangeRate) {
          console.log(`💰 Tasa BCV actualizada en tiempo real: ${exchangeRate} → ${settings.exchangeRate}`);
          setExchangeRate(settings.exchangeRate);
          localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
          // ✅ Recalcular todos los precios en Bs automáticamente
          recalcAllPricesWithNewRate(settings.exchangeRate);
        }
      }
    }) || (() => {});
    
    const loadGlobalSettings = async () => {
      const settings = await syncService.getGlobalSettings();
      if (settings) {
        if (typeof settings.defaultIvaPercentage === 'number') setGlobalIvaPercentage(settings.defaultIvaPercentage);
        if (typeof settings.exchangeRate === 'number' && settings.exchangeRate !== exchangeRate) {
          console.log(`💰 Tasa BCV cargada inicial: ${exchangeRate} → ${settings.exchangeRate}`);
          setExchangeRate(settings.exchangeRate);
          localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
          // ✅ Recalcular precios con la nueva tasa
          recalcAllPricesWithNewRate(settings.exchangeRate);
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
      if (typeof unsubSettings === 'function') unsubSettings();
    };
  }, [user, terminalId, saveRegisterToLocalStorage, exchangeRate, recalcAllPricesWithNewRate]);

  const addProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const updateProduct = useCallback((p: Product) => syncService.saveProduct(p), []);
  const deleteProduct = useCallback((id: number) => syncService.deleteProduct(id), []);
  const saveClient = useCallback((c: Client) => syncService.saveClient(c), []);
  const deleteClient = useCallback((id: number) => syncService.deleteClient(id), []);

  // ✅ Método para refrescar productos desde Firestore
  const refreshProducts = useCallback(async () => {
    return products;
  }, [products]);

  // ✅ Verificar stock de un producto (incluyendo componentes de kits)
  const checkProductStock = useCallback((productId: number, quantity: number): boolean => {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    
    if (product.isKit && product.kitComponents && product.kitComponents.length > 0) {
      for (const component of product.kitComponents) {
        const componentProduct = products.find(p => p.id === component.productId);
        if (!componentProduct) return false;
        const neededQuantity = component.quantity * quantity;
        if (componentProduct.stock < neededQuantity) {
          return false;
        }
      }
      return true;
    }
    
    return product.stock >= quantity;
  }, [products]);

  const addToCart = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    
    if (!checkProductStock(productId, 1)) return false;
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (!checkProductStock(productId, existing.qty + 1)) return prev;
        return prev.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      const priceBs = roundTo2(product.priceUsd * exchangeRate);
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        priceBs: priceBs, 
        priceUsd: product.priceUsd, 
        qty: 1, 
        category: product.category,
        ivaType: product.ivaType,
        ivaPercentage: product.ivaPercentage,
        isKit: product.isKit || false
      }];
    });
    return true;
  }, [products, exchangeRate, checkProductStock]);

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
        const newPriceBs = product ? roundTo2(product.priceUsd * exchangeRate) : item.priceBs;
        return { ...item, qty: newQty, priceBs: newPriceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, exchangeRate, checkProductStock]);

  const updateCartItemPrice = useCallback((productId: number, newPriceUsd: number, newPriceBs: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId
          ? { ...item, priceUsd: roundTo2(newPriceUsd), priceBs: roundTo2(newPriceBs) }
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
    await syncService.saveRegisterByTerminal(terminalId, registerData);
    setRegister(registerData);
    saveRegisterToLocalStorage(registerData);
  }, [terminalId, saveRegisterToLocalStorage]);

  const closeCashRegister = useCallback(() => {
    syncService.clearRegisterByTerminal(terminalId);
    setRegister(null);
    saveRegisterToLocalStorage(null);
  }, [terminalId, saveRegisterToLocalStorage]);

  const getKitComponents = useCallback((product: Product, qty: number): { productId: number; quantity: number }[] => {
    if (!product.isKit || !product.kitComponents || product.kitComponents.length === 0) {
      return [];
    }
    return product.kitComponents.map(comp => ({
      productId: comp.productId,
      quantity: comp.quantity * qty
    }));
  }, []);

  const getItemsToDiscount = useCallback((cartItems: CartItem[]): { productId: number; quantity: number; product: Product }[] => {
    const result: { productId: number; quantity: number; product: Product }[] = [];
    
    for (const item of cartItems) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      
      if (product.isKit && product.kitComponents && product.kitComponents.length > 0) {
        for (const component of product.kitComponents) {
          const componentProduct = products.find(p => p.id === component.productId);
          if (componentProduct) {
            const existing = result.find(r => r.productId === component.productId);
            if (existing) {
              existing.quantity += component.quantity * item.qty;
            } else {
              result.push({
                productId: component.productId,
                quantity: component.quantity * item.qty,
                product: componentProduct
              });
            }
          }
        }
      } else {
        const existing = result.find(r => r.productId === item.productId);
        if (existing) {
          existing.quantity += item.qty;
        } else {
          result.push({
            productId: item.productId,
            quantity: item.qty,
            product: product
          });
        }
      }
    }
    
    return result;
  }, [products]);

  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda' | 'colaboracion' | 'consumo_propio', paymentData: any) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');

    const isSpecial = type === 'colaboracion' || type === 'consumo_propio';
    let subtotal = 0, iva = 0, total = 0, finalTotal = 0;
    let costoTotalOperacion = 0;
    
    if (!isSpecial) {
      subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
      iva = cart.reduce((total, item) => {
        if (item.ivaType === 'con_iva') return total + (item.priceBs * item.qty * 0.16);
        return total;
      }, 0);
      total = subtotal + iva;
      finalTotal = type === 'cobro_deuda' ? (paymentData.totalPaid || paymentData.amount) : total;
    } else {
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product && product.costUsd) {
          costoTotalOperacion += (item.qty * product.costUsd);
        }
      }
      costoTotalOperacion = roundTo2(costoTotalOperacion);
      finalTotal = 0;
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
      clientId: targetClientId,
      clientName: paymentData.clientName,
      exchangeRate,
      receiptNumber: paymentData.receiptNumber,
      costoTotalOperacion: isSpecial ? costoTotalOperacion : undefined,
      notes: isSpecial ? paymentData.notes : undefined,
      authorizedBy: isSpecial ? paymentData.authorizedBy : undefined,
    };

    const itemsToDiscount = getItemsToDiscount(cart);
    
    const stockUpdates: Map<number, { newStock: number }> = new Map();
    const kardexEntries: any[] = [];
    
    if (type !== 'cobro_deuda') {
      for (const discountItem of itemsToDiscount) {
        const product = discountItem.product;
        if (!product) continue;
        
        const qtyToSubtract = discountItem.quantity;
        const newStock = product.stock - qtyToSubtract;
        stockUpdates.set(product.id, { newStock });
        
        const kardexType = isSpecial ? 'ajuste_negativo' : 'salida_venta';
        const reference = isSpecial 
          ? `[${type === 'colaboracion' ? 'Colaboración' : 'Consumo Propio'}] ${paymentData.notes || 'Sin motivo'}`
          : `Venta #${tx.id}`;
        
        kardexEntries.push({
          id: `${Date.now()}_${Math.random()}`,
          productId: product.id,
          date: tx.date,
          type: kardexType,
          quantity: qtyToSubtract,
          previousStock: product.stock,
          newStock,
          reference,
          note: isSpecial ? paymentData.notes : `Venta ID: ${tx.id}`,
          costUsd: product.costUsd,
          costBs: product.costBs,
        });
      }
    }

    let accountingEntry: any = null;
    if (isSpecial && costoTotalOperacion > 0) {
      accountingEntry = {
        id: getVenezuelaTimestamp(),
        date: tx.date,
        type: 'egreso',
        category: 'otros',
        subcategory: type === 'colaboracion' ? 'Donaciones' : 'Consumo Interno',
        concept: `Salida por ${type === 'colaboracion' ? 'Colaboración' : 'Consumo Propio'}`,
        description: paymentData.notes || 'Sin motivo detallado',
        amount: costoTotalOperacion,
        referenceId: tx.id,
        referenceType: type === 'colaboracion' ? 'colaboracion' : 'consumo_propio',
        createdAt: tx.date,
      };
    }

    const newTxs = [...(register.txs || []), tx];
    const registerUpdate = { txs: newTxs };

    await syncService.runAtomicSale(terminalId, tx, {
      products: stockUpdates,
      kardexEntries,
      accountingEntry,
      registerUpdate
    });

    setRegister({ ...register, txs: newTxs });
    saveRegisterToLocalStorage({ ...register, txs: newTxs });
    
    const updatedProducts = [...products];
    for (const [prodId, update] of stockUpdates.entries()) {
      const idx = updatedProducts.findIndex(p => p.id === prodId);
      if (idx !== -1) updatedProducts[idx] = { ...updatedProducts[idx], stock: update.newStock };
    }
    setProducts(updatedProducts);

    if (type === 'credito') {
      const newAccount: Account = {
        id: getVenezuelaTimestamp(),
        txId: tx.id,
        date: tx.date,
        clientId: targetClientId!,
        clientName: paymentData.clientName,
        clientCedula: paymentData.clientCedula || '',
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '),
        amountBs: total,
        amountUsd: roundTo2(total / exchangeRate),
        paidAmount: 0,
        status: 'pendiente',
        exchangeRate,
      };
      setAccounts(prev => [...prev, newAccount]);
      const client = clients.find(c => c.id === targetClientId);
      if (client) {
        const updatedClient = { ...client, debt: (client.debt || 0) + total };
        setClients(prev => prev.map(c => c.id === targetClientId ? updatedClient : c));
      }
      await registerCreditEntry(tx, client || { name: paymentData.clientName } as any);
    } else if (type === 'contado') {
      await registerSaleEntry(tx);
    } else if (type === 'cobro_deuda') {
      const client = clients.find(c => c.id === targetClientId);
      if (client) await registerDebtPaymentEntry(tx, client);
    }

    if (type !== 'cobro_deuda') setCart([]);
    return tx;
  }, [cart, register, exchangeRate, clients, products, terminalId, saveRegisterToLocalStorage, getItemsToDiscount]);

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
      totalUsd: roundTo2(amount / exchangeRate), 
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
    await syncService.saveRegisterByTerminal(terminalId, updatedRegister);
    setRegister(updatedRegister);
    saveRegisterToLocalStorage(updatedRegister);
    
    await syncService.saveClient({ ...client, debt: Math.max(0, (client.debt || 0) - amount) });
    await registerDebtPaymentEntry(tx, client);
  }, [register, clients, accounts, exchangeRate, terminalId, saveRegisterToLocalStorage]);

  const setExchangeRateProxy = useCallback(async (newRate: number) => {
    console.log(`💰 Actualizando tasa BCV: ${exchangeRate} → ${newRate}`);
    setExchangeRate(newRate);
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, newRate.toString());
    await syncService.saveGlobalSettings({ exchangeRate: newRate });
    // ✅ Recalcular precios con la nueva tasa
    recalcAllPricesWithNewRate(newRate);
  }, [exchangeRate, recalcAllPricesWithNewRate]);

  return {
    products, setProducts, addProduct, updateProduct, deleteProduct,
    clients, setClients, saveClient, deleteClient, transactions, setTransactions, accounts, setAccounts,
    register, setRegister, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate: setExchangeRateProxy,
    cart, addToCart, removeFromCart, updateCartQty, updateCartItemPrice,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, isHydrated,
    globalIvaPercentage,
    adminCode,
    checkProductStock,
    refreshProducts
  };
}