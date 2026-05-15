"use client";

import { useState, useEffect, useCallback } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem } from '@/lib/types';

const INITIAL_PRODUCTS: Product[] = [
  {id:1,barcode:'7791234567890',name:'Johnnie Walker Red Label 750ml',priceBs:912.50,priceUsd:25.00,stock:24,category:'Whisky'},
  {id:2,barcode:'7791234567906',name:'Johnnie Walker Black Label 750ml',priceBs:1642.50,priceUsd:45.00,stock:12,category:'Whisky'},
  {id:3,barcode:'7791234567913',name:'Santa Teresa 1796 750ml',priceBs:657.00,priceUsd:18.00,stock:18,category:'Ron'},
  {id:4,barcode:'7791234567920',name:'Pampero Anejo Especial 750ml',priceBs:310.25,priceUsd:8.50,stock:30,category:'Ron'},
  {id:5,barcode:'7791234567937',name:'Cerveza Polar Pilsen 6-Pack',priceBs:164.25,priceUsd:4.50,stock:120,category:'Cerveza'},
  {id:6,barcode:'7791234567944',name:'Smirnoff Vodka 750ml',priceBs:438.00,priceUsd:12.00,stock:20,category:'Vodka'},
  {id:7,barcode:'7791234567951',name:'Jose Cuervo Especial 750ml',priceBs:803.00,priceUsd:22.00,stock:15,category:'Tequila'},
  {id:8,barcode:'7791234567968',name:'Casillero del Diablo Cabernet 750ml',priceBs:365.00,priceUsd:10.00,stock:22,category:'Vino'},
  {id:9,barcode:'7791234567975',name:'Moet & Chandon Imperial 750ml',priceBs:2007.50,priceUsd:55.00,stock:8,category:'Vino'},
  {id:10,barcode:'7791234567982',name:'Zhumur Durazno 750ml',priceBs:127.75,priceUsd:3.50,stock:40,category:'Licor'},
];

const INITIAL_CLIENTS: Client[] = [
  {id:1,name:'Carlos Mendoza',cedula:'V-12345678',phone:'0414-5551234',address:'Urb. El Rosal, Calle 5, Casa 12',debt:1500.00},
  {id:2,name:'Maria Garcia',cedula:'V-23456789',phone:'0416-5555678',address:'Av. Principal de Las Delicias',debt:0},
  {id:3,name:'Jose Rodriguez',cedula:'V-34567890',phone:'0424-5559012',address:'Centro Comercial Sambil, Local 45',debt:3200.50},
];

export function usePOSState() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [exchangeRate, setExchangeRate] = useState(36.50);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentPage, setCurrentPage] = useState<Page>('pos');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedProds = localStorage.getItem('licopos_products');
    const storedClients = localStorage.getItem('licopos_clients');
    const storedTxs = localStorage.getItem('licopos_transactions');
    const storedAccounts = localStorage.getItem('licopos_accounts');
    const storedReg = localStorage.getItem('licopos_register');
    const storedRate = localStorage.getItem('licopos_rate');

    setProducts(storedProds ? JSON.parse(storedProds) : INITIAL_PRODUCTS);
    setClients(storedClients ? JSON.parse(storedClients) : INITIAL_CLIENTS);
    setTransactions(storedTxs ? JSON.parse(storedTxs) : []);
    setAccounts(storedAccounts ? JSON.parse(storedAccounts) : []);
    setRegister(storedReg ? JSON.parse(storedReg) : null);
    setExchangeRate(storedRate ? parseFloat(storedRate) : 36.50);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('licopos_products', JSON.stringify(products));
    localStorage.setItem('licopos_clients', JSON.stringify(clients));
    localStorage.setItem('licopos_transactions', JSON.stringify(transactions));
    localStorage.setItem('licopos_accounts', JSON.stringify(accounts));
    localStorage.setItem('licopos_register', JSON.stringify(register));
    localStorage.setItem('licopos_rate', exchangeRate.toString());
  }, [products, clients, transactions, accounts, register, exchangeRate, isHydrated]);

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
    setRegister({
      isOpen: true,
      openTime: new Date().toISOString(),
      openAmount: amount,
      txs: []
    });
  }, []);

  const closeCashRegister = useCallback(() => {
    setRegister(null);
  }, []);

  const finalizeSale = useCallback((type: 'contado' | 'credito', paymentData: any) => {
    if (!register || !register.isOpen) return;

    const subtotal = cart.reduce((acc, item) => acc + (item.priceBs * item.qty), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    const totalUsd = total / exchangeRate;

    const tx: Transaction = {
      id: transactions.length + 1,
      date: new Date().toISOString(),
      type: type,
      items: [...cart],
      subtotal,
      iva,
      total,
      totalUsd,
      payMethod: paymentData.method,
      paidBs: paymentData.amount || total,
      change: Math.max(0, (paymentData.amount || total) - total),
      clientId: paymentData.clientId,
      clientName: paymentData.clientName
    };

    setTransactions(prev => [...prev, tx]);
    setRegister(prev => prev ? { ...prev, txs: [...prev.txs, tx] } : null);

    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(ci => ci.productId === p.id);
      return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;
    }));

    if (type === 'credito' && paymentData.clientId) {
      const acc: Account = {
        id: accounts.length + 1,
        txId: tx.id,
        date: tx.date,
        clientId: paymentData.clientId,
        clientName: paymentData.clientName,
        clientCedula: paymentData.clientCedula,
        products: cart.map(i => `${i.name} x${i.qty}`).join(', '),
        amountBs: total,
        amountUsd: totalUsd,
        paidAmount: 0,
        status: 'pendiente'
      };
      setAccounts(prev => [...prev, acc]);
      setClients(prev => prev.map(c => c.id === paymentData.clientId ? { ...c, debt: c.debt + total } : c));
    }

    setCart([]);
  }, [cart, register, exchangeRate, transactions.length, accounts.length]);

  const applyAbono = useCallback((clientId: number, amount: number) => {
    if (!register || !register.isOpen) return;

    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const clientAccounts = accounts
      .filter(a => a.clientId === clientId && a.status !== 'pagada')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let remaining = amount;
    const updatedAccounts = [...accounts];

    for (const accIdx in updatedAccounts) {
      const acc = updatedAccounts[accIdx];
      if (acc.clientId !== clientId || acc.status === 'pagada' || remaining <= 0) continue;

      const owed = acc.amountBs - (acc.paidAmount || 0);
      if (remaining >= owed) {
        acc.paidAmount = acc.amountBs;
        acc.status = 'pagada';
        remaining -= owed;
      } else {
        acc.paidAmount = (acc.paidAmount || 0) + remaining;
        acc.status = 'parcial';
        remaining = 0;
      }
    }

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
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, debt: Math.max(0, c.debt - amount) } : c));
  }, [register, clients, accounts, transactions.length, exchangeRate]);

  return {
    products, setProducts,
    clients, setClients,
    transactions,
    accounts, setAccounts,
    register, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate,
    cart, addToCart, removeFromCart, updateCartQty,
    currentPage, setCurrentPage,
    finalizeSale, applyAbono,
    isHydrated
  };
}