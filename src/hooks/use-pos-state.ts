"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem } from '@/lib/types';
import { syncService } from '@/services/syncService';

const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_CLIENTS: Client[] = [];

let firebaseLoaded = false;

export function usePOSState() {
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
  const [isSyncing, setIsSyncing] = useState(false);
  
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const storedProds = localStorage.getItem('licopos_products');
      const storedClients = localStorage.getItem('licopos_clients');
      const storedTxs = localStorage.getItem('licopos_transactions');
      const storedAccounts = localStorage.getItem('licopos_accounts');
      const storedReg = localStorage.getItem('licopos_register');
      const storedRate = localStorage.getItem('licopos_rate');

      let localProducts = storedProds ? JSON.parse(storedProds) : INITIAL_PRODUCTS;
      let localClients = storedClients ? JSON.parse(storedClients) : INITIAL_CLIENTS;
      let localTransactions = storedTxs ? JSON.parse(storedTxs) : [];
      let localAccounts = storedAccounts ? JSON.parse(storedAccounts) : [];
      let localRegister = storedReg ? JSON.parse(storedReg) : null;
      let localRate = storedRate ? parseFloat(storedRate) : 36.50;

      setProducts(localProducts);
      setClients(localClients);
      setTransactions(localTransactions);
      setAccounts(localAccounts);
      setRegister(localRegister);
      setExchangeRate(localRate);
      setIsHydrated(true);

      if (!firebaseLoaded && typeof window !== 'undefined') {
        firebaseLoaded = true;
        setIsSyncing(true);
        
        try {
          const fbProducts = await syncService.loadProducts();
          if (fbProducts && fbProducts.length > 0) {
            setProducts(fbProducts as Product[]);
            localStorage.setItem('licopos_products', JSON.stringify(fbProducts));
          }
          
          const fbClients = await syncService.loadClients();
          if (fbClients && fbClients.length > 0) {
            setClients(fbClients as Client[]);
            localStorage.setItem('licopos_clients', JSON.stringify(fbClients));
          }
          
          const fbTransactions = await syncService.loadTransactions();
          if (fbTransactions && fbTransactions.length > 0) {
            setTransactions(fbTransactions as Transaction[]);
            localStorage.setItem('licopos_transactions', JSON.stringify(fbTransactions));
          }
          
          const fbAccounts = await syncService.loadAccounts();
          if (fbAccounts && fbAccounts.length > 0) {
            setAccounts(fbAccounts as Account[]);
            localStorage.setItem('licopos_accounts', JSON.stringify(fbAccounts));
          }
          
          const fbRegister = await syncService.loadRegister();
          if (fbRegister) {
            setRegister(fbRegister as CashRegister);
            localStorage.setItem('licopos_register', JSON.stringify(fbRegister));
          }
        } catch (error) {
          console.error('Error syncing with Firebase:', error);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    
    localStorage.setItem('licopos_products', JSON.stringify(products));
    localStorage.setItem('licopos_clients', JSON.stringify(clients));
    localStorage.setItem('licopos_transactions', JSON.stringify(transactions));
    localStorage.setItem('licopos_accounts', JSON.stringify(accounts));
    localStorage.setItem('licopos_register', JSON.stringify(register));
    localStorage.setItem('licopos_rate', exchangeRate.toString());
    
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncToFirebase();
    }, 5000);
  }, [products, clients, transactions, accounts, register, exchangeRate, isHydrated]);

  const syncToFirebase = useCallback(async () => {
    if (!isHydrated) return;
    
    try {
      await Promise.all([
        syncService.saveProducts(products),
        syncService.saveClients(clients),
        syncService.saveRegister(register),
      ]);
      
      const lastTx = transactions[transactions.length - 1];
      if (lastTx) {
        await syncService.saveTransaction(lastTx);
      }
      
      const lastAccount = accounts[accounts.length - 1];
      if (lastAccount) {
        await syncService.saveAccount(lastAccount);
      }
      
      console.log('✅ Firebase sync completed');
    } catch (error) {
      console.error('❌ Firebase sync error:', error);
    }
  }, [products, clients, transactions, accounts, register, isHydrated]);

  const addProduct = useCallback((p: Product) => {
    setProducts(prev => [...prev, p]);
  }, []);

  const updateProduct = useCallback((p: Product) => {
    setProducts(prev => prev.map(old => old.id === p.id ? p : old));
  }, []);

  const deleteProduct = useCallback((id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

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
        priceBs: product.priceBs,
        priceUsd: product.priceUsd,
        qty: 1,
        category: product.category
      }];
    });
    return true;
  }, [products]);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const updateCartQty = useCallback((productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    setCart(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const newQty = item.qty + delta;
          if (newQty <= 0) return null as any;
          if (product && newQty > product.stock) return item;
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  }, [products]);

  const openCashRegister = useCallback((amount: number) => {
    const newRegister = {
      isOpen: true,
      openTime: new Date().toISOString(),
      openAmount: amount,
      txs: []
    };
    setRegister(newRegister);
    syncService.saveRegister(newRegister).catch(console.error);
  }, []);

  const closeCashRegister = useCallback(() => {
    setRegister(null);
    syncService.clearRegister().catch(console.error);
  }, []);

  const finalizeSale = useCallback((type: 'contado' | 'credito' | 'cobro_deuda', paymentData: any) => {
    if (!register || !register.isOpen) return;

    const subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
    const iva = isIvaEnabled ? subtotal * 0.16 : 0;
    const total = subtotal + iva;

    const finalTotal = type === 'cobro_deuda' ? paymentData.totalPaid : total;
    const finalSubtotal = type === 'cobro_deuda' ? paymentData.totalPaid : subtotal;
    const finalIva = type === 'cobro_deuda' ? 0 : iva;

    let targetClientId = paymentData.clientId;
    let targetClientName = paymentData.clientName;
    let targetClientCedula = paymentData.clientCedula;

    if (type === 'credito' && paymentData.isNewClient) {
      const nextClientId = clients.length ? Math.max(...clients.map(c => c.id)) + 1 : 1;
      const newCli: Client = {
        id: nextClientId,
        name: paymentData.clientName,
        cedula: paymentData.clientCedula,
        phone: paymentData.clientPhone || '',
        address: paymentData.clientAddress || '',
        debt: 0
      };
      setClients(prev => [...prev, newCli]);
      targetClientId = nextClientId;
    }

    let payMethod = paymentData.method;
    if (paymentData.payments && paymentData.payments.length > 0) {
      const methods = paymentData.payments.map((p: any) => p.method).join('+');
      payMethod = methods;
    }

    const tx: Transaction = {
      id: transactions.length + 1,
      date: new Date().toISOString(),
      type: type,
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: finalSubtotal,
      iva: finalIva,
      total: finalTotal,
      totalUsd: finalTotal / exchangeRate,
      payMethod: payMethod || paymentData.payments?.[0]?.method || 'efectivo_bs',
      paidBs: paymentData.totalPaid || paymentData.amount || finalTotal,
      change: paymentData.change || 0,
      clientId: targetClientId,
      clientName: targetClientName
    };

    setTransactions(prev => [...prev, tx]);
    setRegister(prev => prev ? { ...prev, txs: [...prev.txs, tx] } : null);

    if (type !== 'cobro_deuda') {
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(ci => ci.productId === p.id);
        return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;
      }));
    }

    if (type === 'credito') {
      const acc: Account = {
        id: accounts.length + 1,
        txId: tx.id,
        date: tx.date,
        clientId: targetClientId,
        clientName: targetClientName,
        clientCedula: targetClientCedula || '',
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '),
        amountBs: total,
        amountUsd: total / exchangeRate,
        paidAmount: 0,
        status: 'pendiente'
      };
      setAccounts(prev => [...prev, acc]);
      setClients(prev => prev.map(c => c.id === targetClientId ? { ...c, debt: (c.debt || 0) + total } : c));
    }

    if (type !== 'cobro_deuda') {
      setCart([]);
    }

    return tx;
  }, [cart, register, exchangeRate, transactions.length, accounts.length, clients, isIvaEnabled]);

  const applyAbono = useCallback((clientId: number, amount: number) => {
    console.log('🔄 Aplicando abono:', { clientId, amount });
    
    if (!register || !register.isOpen) {
      console.log('❌ Caja no está abierta');
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (!client) {
      console.log('❌ Cliente no encontrado');
      return;
    }

    const clientAccounts = accounts
      .filter(a => a.clientId === clientId && a.status !== 'pagada')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('📋 Cuentas pendientes:', clientAccounts.length);

    if (clientAccounts.length === 0) {
      console.log('⚠️ No hay cuentas pendientes');
      return;
    }

    let remaining = amount;
    const updatedAccounts = accounts.map(acc => {
      if (acc.clientId !== clientId || acc.status === 'pagada' || remaining <= 0) {
        return acc;
      }
      
      const owed = acc.amountBs - (acc.paidAmount || 0);
      if (remaining >= owed) {
        const newPaidAmount = acc.amountBs;
        const newStatus: 'pagada' = 'pagada';
        remaining -= owed;
        console.log(`✅ Cuenta ${acc.id} pagada completamente. Owed: ${owed}, Restante: ${remaining}`);
        return { ...acc, paidAmount: newPaidAmount, status: newStatus };
      } else {
        const newPaidAmount = (acc.paidAmount || 0) + remaining;
        const newStatus: 'parcial' = 'parcial';
        console.log(`🟡 Cuenta ${acc.id} pagada parcialmente. Nuevo paidAmount: ${newPaidAmount}, Restante: 0`);
        remaining = 0;
        return { ...acc, paidAmount: newPaidAmount, status: newStatus };
      }
    });

    const tx: Transaction = {
      id: transactions.length + 1,
      date: new Date().toISOString(),
      type: 'cobro_deuda',
      items: [],
      subtotal: amount,
      iva: 0,
      total: amount,
      totalUsd: amount / exchangeRate,
      payMethod: 'efectivo_bs',
      paidBs: amount,
      change: 0,
      clientId: clientId,
      clientName: client.name
    };

    setAccounts(updatedAccounts);
    setTransactions(prev => [...prev, tx]);
    setRegister(prev => prev ? { ...prev, txs: [...prev.txs, tx] } : null);
    
    const newDebt = Math.max(0, (client.debt || 0) - amount);
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, debt: newDebt } : c));
    
    console.log(`✅ Abono aplicado. Cliente: ${client.name}, Deuda anterior: ${client.debt}, Monto: ${amount}, Nueva deuda: ${newDebt}`);
  }, [register, clients, accounts, transactions.length, exchangeRate]);

  return {
    products, setProducts, addProduct, updateProduct, deleteProduct,
    clients, setClients,
    transactions,
    accounts, setAccounts,
    register, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate,
    cart, addToCart, removeFromCart, updateCartQty,
    isIvaEnabled, setIsIvaEnabled,
    currentPage, setCurrentPage,
    finalizeSale, applyAbono,
    isHydrated,
    isSyncing
  };
}
