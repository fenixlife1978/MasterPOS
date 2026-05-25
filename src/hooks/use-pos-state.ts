"use client";

import { useState, useEffect, useCallback } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem, AdminCode, GlobalSettings } from '@/lib/types';
import { syncService } from '@/services/syncService';
import { registerSaleEntry, registerCreditEntry, registerDebtPaymentEntry } from '@/services/accountingService';
import { useAuth } from '@/context/AuthContext';

// ✅ CORREGIDO: Genera el string ISO real adaptado estrictamente a la zona horaria de Venezuela (Caracas)
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

// ✅ CORREGIDO: El ID de la transacción debe ser el tiempo Unix puro de la máquina para evitar saltos de día
function getVenezuelaTimestamp(): number {
  return Date.now();
}

// Clave para localStorage de la tasa BCV
const STORAGE_KEYS = {
  EXCHANGE_RATE: 'bcv_exchange_rate',
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
  
  // ✅ Nuevos estados para gestión global
  const [globalIvaPercentage, setGlobalIvaPercentage] = useState(16);
  const [adminCode, setAdminCode] = useState<string>('');

  // ✅ Cargar tasa BCV desde Firestore y localStorage al iniciar
  useEffect(() => {
    const loadExchangeRate = async () => {
      // 1. Intentar cargar desde localStorage (caché rápido)
      const cachedRate = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
      if (cachedRate) {
        const rate = parseFloat(cachedRate);
        if (!isNaN(rate) && rate > 0) {
          setExchangeRate(rate);
        }
      }
      
      // 2. Cargar desde Firestore (fuente de verdad)
      const settings = await syncService.getGlobalSettings();
      if (settings && typeof settings.exchangeRate === 'number' && settings.exchangeRate > 0) {
        setExchangeRate(settings.exchangeRate);
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
      } else if (settings && typeof settings.defaultIvaPercentage === 'number') {
        // Si existe global_settings pero no tiene exchangeRate, guardamos el actual
        await syncService.saveGlobalSettings({ 
          defaultIvaPercentage: settings.defaultIvaPercentage || 16,
          exchangeRate: exchangeRate,
          categories: settings.categories,
          departments: settings.departments
        });
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, exchangeRate.toString());
      }
    };
    
    loadExchangeRate();
  }, []);

  // ✅ Función para actualizar la tasa BCV (guarda en Firestore y localStorage)
  const updateExchangeRate = useCallback(async (newRate: number) => {
    if (isNaN(newRate) || newRate <= 0) return;
    
    // Actualizar estado local
    setExchangeRate(newRate);
    
    // Guardar en localStorage
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, newRate.toString());
    
    // Guardar en Firestore dentro de global_settings
    try {
      const currentSettings = await syncService.getGlobalSettings();
      await syncService.saveGlobalSettings({
        defaultIvaPercentage: currentSettings?.defaultIvaPercentage || 16,
        exchangeRate: newRate,
        categories: currentSettings?.categories,
        departments: currentSettings?.departments
      });
    } catch (error) {
      console.error('Error al guardar la tasa BCV en Firestore:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = syncService.subscribeToProducts(setProducts);
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    const unsubRegister = syncService.subscribeToRegister(setRegister);
    
    // ✅ Cargar configuración global y código de administrador desde Firestore
    const loadGlobalSettings = async () => {
      const settings = await syncService.getGlobalSettings();
      if (settings && typeof settings.defaultIvaPercentage === 'number') {
        setGlobalIvaPercentage(settings.defaultIvaPercentage);
      }
      // Cargar tasa BCV si no se cargó antes
      if (settings && typeof settings.exchangeRate === 'number' && settings.exchangeRate > 0) {
        setExchangeRate(settings.exchangeRate);
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
      }
      const code = await syncService.getAdminCode();
      if (code && typeof code.code === 'string') {
        setAdminCode(code.code);
      }
    };
    loadGlobalSettings(); // No es necesario await porque no bloquea el renderizado
    
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

  // ✅ CORREGIDO: addToCart ahora conserva la información de IVA del producto
  const addToCart = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return false;
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      const calculatedPriceBs = product.priceUsd * exchangeRate;
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        priceBs: calculatedPriceBs, 
        priceUsd: product.priceUsd, 
        qty: 1, 
        category: product.category,
        // ✅ Propagar información de IVA al carrito
        ivaType: product.ivaType,
        ivaPercentage: product.ivaPercentage
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
        const updatedPriceBs = product ? product.priceUsd * exchangeRate : item.priceBs;
        return { ...item, qty: newQty, priceBs: updatedPriceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, exchangeRate]);

  // ✅ CORREGIDO: openCashRegister simplificado
  const openCashRegister = useCallback(async (amount: number) => {
    const registerData = {
      isOpen: true,
      openTime: getVenezuelaISOString(),
      openAmount: amount,
      txs: [],
      exchangeRate: exchangeRate || 36.50
    };
    await syncService.saveRegister(registerData);
  }, [exchangeRate]);

  const closeCashRegister = useCallback(() => syncService.clearRegister(), []);

  // ========== NUEVAS FUNCIONES ==========

  // ✅ Actualizar el porcentaje de IVA global (solo si no hay caja abierta)
  const updateGlobalIvaPercentage = useCallback(async (newPercentage: number) => {
    if (register?.isOpen) {
      throw new Error('No se puede cambiar el IVA global mientras la caja está abierta.');
    }
    await syncService.saveGlobalSettings({ defaultIvaPercentage: newPercentage });
    setGlobalIvaPercentage(newPercentage);
  }, [register]);

  // ✅ Verificar código de autorización para ajustes de inventario
  const verifyAdjustmentCode = useCallback(async (code: string): Promise<boolean> => {
    const storedCode = await syncService.getAdminCode();
    return storedCode?.code === code;
  }, []);

  // ✅ Actualizar el código de autorización (solo administrador)
  const updateAdjustmentCode = useCallback(async (newCode: string) => {
    await syncService.saveAdminCode({ code: newCode });
    setAdminCode(newCode);
  }, []);

  // ✅ Aplicar cambio de IVA global a todos los productos marcados como "con_iva"
  const applyGlobalIvaChange = useCallback(async (newPercentage: number) => {
    if (register?.isOpen) {
      throw new Error('No se puede aplicar el cambio de IVA mientras la caja está abierta.');
    }
    const updatedProducts = products.map(product => {
      if (product.ivaType === 'con_iva') {
        // Recalcular priceRetail (si existe) con la nueva fórmula
        const basePrice = product.costUsd ? (product.costUsd / ((100 - (product.profitPercent || 30)) / 100)) : 0;
        const newRetail = basePrice * (1 + newPercentage / 100);
        return { ...product, ivaPercentage: newPercentage, priceRetail: newRetail, priceUsd: newRetail };
      }
      return product;
    });
    for (const p of updatedProducts) {
      await syncService.saveProduct(p);
    }
    setProducts(updatedProducts);
    await updateGlobalIvaPercentage(newPercentage);
  }, [products, register, updateGlobalIvaPercentage]);

  // ========== FUNCIONES EXISTENTES (sin cambios) ==========

  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda', paymentData: any) => {
    if (!register?.isOpen) return;

    const subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
    // ✅ Calcular IVA solo para productos marcados como "con_iva"
    const iva = cart.reduce((total, item) => {
      const hasIva = (item as any).ivaType === 'con_iva';
      if (hasIva) {
        const itemTotal = item.priceBs * item.qty;
        return total + (itemTotal * 0.16);
      }
      return total;
    }, 0);
    const total = subtotal + iva;

    const finalTotal = type === 'cobro_deuda' ? paymentData.totalPaid : total;

    let targetClientId = paymentData.clientId;
    if (type === 'credito' && paymentData.isNewClient) {
      const nextClientId = getVenezuelaTimestamp();
      const newCli: Client = { id: nextClientId, name: paymentData.clientName, cedula: paymentData.clientCedula, phone: paymentData.clientPhone || '', address: paymentData.clientAddress || '', debt: 0 };
      await syncService.saveClient(newCli);
      targetClientId = nextClientId;
    }

    const venezuelaDate = getVenezuelaISOString();
    const venezuelaTimestamp = getVenezuelaTimestamp();
    const currentExchangeRate = exchangeRate;
    const totalUsd = cart.reduce((acc, item) => acc + (item.priceUsd * item.qty), 0);

    const tx: Transaction = {
      id: venezuelaTimestamp,
      date: venezuelaDate,
      type: type,
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: type === 'cobro_deuda' ? paymentData.totalPaid : subtotal,
      iva: iva,
      total: finalTotal,
      totalUsd: totalUsd,
      payMethod: paymentData.method || 'efectivo_bs',
      paidBs: paymentData.totalPaid || paymentData.amount || finalTotal,
      change: paymentData.change || 0,
      clientId: targetClientId,
      clientName: paymentData.clientName,
      exchangeRate: currentExchangeRate
    };

    await syncService.saveTransaction(tx);

    if (register && type !== 'credito') {
      const updatedRegister = {
        ...register,
        txs: [...(register.txs || []), tx],
        exchangeRate: (register as any).exchangeRate || currentExchangeRate || 36.50
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
      const acc: Account = { 
        id: getVenezuelaTimestamp(), 
        txId: tx.id, 
        date: venezuelaDate, 
        clientId: targetClientId, 
        clientName: paymentData.clientName, 
        clientCedula: paymentData.clientCedula || '', 
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '), 
        amountBs: total, 
        amountUsd: totalUsd,
        paidAmount: 0, 
        status: 'pendiente',
        exchangeRate: currentExchangeRate
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
  }, [cart, register, exchangeRate, clients, products]);

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
    
    if (register) {
      const updatedRegister = {
        ...register,
        txs: [...(register.txs || []), tx],
        exchangeRate: (register as any).exchangeRate || currentExchangeRate || 36.50
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
    exchangeRate, setExchangeRate: updateExchangeRate,
    cart, addToCart, removeFromCart, updateCartQty,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, isHydrated,
    // ✅ Nuevos valores y funciones expuestos
    globalIvaPercentage,
    updateGlobalIvaPercentage,
    verifyAdjustmentCode,
    updateAdjustmentCode,
    applyGlobalIvaChange
  };
}