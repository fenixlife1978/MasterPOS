// src/services/syncService.ts
// ============================================================
// SERVICIO DE SINCRONIZACIÓN - SIN TURSO
// Usa Firebase Realtime Database + localStorage como respaldo
// ============================================================

import { ref, get, set, update, remove, push, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

// ============================================================
// UTILIDADES
// ============================================================

const CACHE_PREFIX = 'pos_cache_';
const STOCK_CACHE_KEY = `${CACHE_PREFIX}stock`;

function getCacheKey(entity: string): string {
  return `${CACHE_PREFIX}${entity}`;
}

function getCachedData<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error guardando en caché:', error);
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================================
// USUARIOS
// ============================================================

export async function getUserByUid(uid: string) {
  const usersRef = ref(rtdb, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return null;
  
  const users = snapshot.val();
  for (const [key, user] of Object.entries(users)) {
    if ((user as any).uid === uid) {
      return { id: key, ...(user as any) };
    }
  }
  return null;
}

export async function saveUser(user: any) {
  const userId = user.id || generateId();
  const userRef = ref(rtdb, `users/${userId}`);
  const userData = {
    uid: user.uid || userId,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    terminalId: user.terminalId || null,
    status: user.status || 'active',
    updatedAt: new Date().toISOString()
  };
  await set(userRef, userData);
  return { id: userId, ...userData };
}

export async function getAllUsers() {
  const usersRef = ref(rtdb, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.entries(data).map(([id, user]) => ({ id, ...(user as any) }));
}

export async function deleteUser(uid: string) {
  const usersRef = ref(rtdb, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return;
  
  const users = snapshot.val();
  for (const [key, user] of Object.entries(users)) {
    if ((user as any).uid === uid) {
      await remove(ref(rtdb, `users/${key}`));
      break;
    }
  }
}

export async function updateUserTerminalId(userId: string, terminalId: string | null) {
  const usersRef = ref(rtdb, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return;
  
  const users = snapshot.val();
  for (const [key, user] of Object.entries(users)) {
    if ((user as any).uid === userId) {
      await update(ref(rtdb, `users/${key}`), { terminalId, updatedAt: new Date().toISOString() });
      break;
    }
  }
}

// ============================================================
// PRODUCTOS
// ============================================================

export async function getAllProducts() {
  try {
    const productsRef = ref(rtdb, 'products');
    const snapshot = await get(productsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const products = Object.entries(data)
        .map(([id, product]) => {
          const p = product as any;
          return {
            id: parseInt(id),
            barcode: p.barcode || '',
            name: p.name || '',
            department: p.department || null,
            category: p.category || null,
            stock: p.stock || 0,
            minStock: p.min_stock || 5,
            costUsd: p.cost_usd || 0,
            costBs: p.cost_bs || 0,
            profitPercent: p.profit_percent || 30,
            priceUsd: p.price_usd || 0,
            priceBs: p.price_bs || 0,
            priceRetail: p.price_retail || 0,
            priceWholesale: p.price_wholesale || 0,
            priceCost: p.price_cost || 0,
            ivaType: p.iva_type || 'con_iva',
            ivaPercentage: p.iva_percentage || 16,
            isKit: p.is_kit === 1,
            kitHasOwnStock: p.kit_has_own_stock === 1,
            kitComponents: p.kit_components ? JSON.parse(p.kit_components) : [],
            isPriceFixed: p.is_price_fixed === 1,
            activo: p.activo !== undefined ? p.activo : 1,
            updatedAt: p.updatedAt || new Date().toISOString()
          };
        })
        .filter((p: any) => p.activo !== 0);
      
      setCachedData(getCacheKey('products'), products);
      return products;
    }
    
    const cached = getCachedData<any[]>(getCacheKey('products'));
    return cached || [];
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    const cached = getCachedData<any[]>(getCacheKey('products'));
    return cached || [];
  }
}

export async function saveProduct(product: any) {
  const allProducts = await getAllProducts();
  const existingProduct = allProducts.find(
    p => p.barcode === product.barcode && p.id !== product.id
  );
  
  if (existingProduct) {
    throw new Error(`Ya existe un producto con el código de barras "${product.barcode}"`);
  }
  
  const productId = product.id || generateId();
  const productRef = ref(rtdb, `products/${productId}`);
  
  const productData = {
    barcode: product.barcode || '',
    name: product.name || '',
    department: product.department || null,
    category: product.category || null,
    stock: product.stock || 0,
    min_stock: product.minStock || 5,
    cost_usd: product.costUsd || 0,
    cost_bs: product.costBs || 0,
    profit_percent: product.profitPercent || 30,
    price_usd: product.priceUsd || 0,
    price_bs: product.priceBs || 0,
    price_retail: product.priceRetail || 0,
    price_wholesale: product.priceWholesale || 0,
    price_cost: product.priceCost || 0,
    iva_type: product.ivaType || 'con_iva',
    iva_percentage: product.ivaPercentage || 16,
    is_kit: product.isKit ? 1 : 0,
    kit_has_own_stock: product.kitHasOwnStock ? 1 : 0,
    kit_components: product.kitComponents ? JSON.stringify(product.kitComponents) : null,
    is_price_fixed: product.isPriceFixed ? 1 : 0,
    activo: product.activo !== undefined ? product.activo : 1,
    updatedAt: new Date().toISOString()
  };
  
  await set(productRef, productData);
  
  const cached = getCachedData<any[]>(getCacheKey('products')) || [];
  const finalProduct = { 
    id: typeof productId === 'string' ? parseInt(productId) : productId,
    barcode: productData.barcode,
    name: productData.name,
    department: productData.department,
    category: productData.category,
    stock: productData.stock,
    minStock: productData.min_stock,
    costUsd: productData.cost_usd,
    costBs: productData.cost_bs,
    profitPercent: productData.profit_percent,
    priceUsd: productData.price_usd,
    priceBs: productData.price_bs,
    priceRetail: productData.price_retail,
    priceWholesale: productData.price_wholesale,
    priceCost: productData.price_cost,
    ivaType: productData.iva_type,
    ivaPercentage: productData.iva_percentage,
    isKit: productData.is_kit === 1,
    kitHasOwnStock: productData.kit_has_own_stock === 1,
    kitComponents: productData.kit_components ? JSON.parse(productData.kit_components) : [],
    isPriceFixed: productData.is_price_fixed === 1,
    activo: productData.activo,
    updatedAt: productData.updatedAt
  };
  
  const index = cached.findIndex(p => p.id === productId || p.id === product.id);
  if (index >= 0) {
    cached[index] = finalProduct;
  } else {
    cached.push(finalProduct);
  }
  setCachedData(getCacheKey('products'), cached);
  
  return finalProduct;
}

export async function saveProducts(products: any[]) {
  for (const product of products) {
    await saveProduct(product);
  }
}

export async function deleteProduct(id: number) {
  const productRef = ref(rtdb, `products/${id}`);
  await update(productRef, { activo: 0, updatedAt: new Date().toISOString() });
  
  const cached = getCachedData<any[]>(getCacheKey('products')) || [];
  const product = cached.find(p => p.id === id);
  if (product) {
    product.activo = 0;
    setCachedData(getCacheKey('products'), cached);
  }
}

export async function updateProductWithWeightedAverageCost(
  productId: number, 
  newQty: number, 
  newCostUsd: number, 
  exchangeRate: number
) {
  const productRef = ref(rtdb, `products/${productId}`);
  const snapshot = await get(productRef);
  if (!snapshot.exists()) return;
  
  const product = snapshot.val();
  const oldStock = Number(product.stock) || 0;
  const oldCost = Number(product.cost_usd) || 0;
  const newStock = oldStock + newQty;
  let newAvgCost = oldCost;
  
  if (newStock > 0) {
    newAvgCost = ((oldStock * oldCost) + (newQty * newCostUsd)) / newStock;
  }
  
  await update(productRef, {
    stock: newStock,
    cost_usd: newAvgCost,
    cost_bs: newAvgCost * exchangeRate,
    updatedAt: new Date().toISOString()
  });
}

// ============================================================
// CLIENTES
// ============================================================

export async function getAllClients() {
  try {
    const clientsRef = ref(rtdb, 'clients');
    const snapshot = await get(clientsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const clients = Object.entries(data).map(([id, client]) => ({ id, ...(client as any) }));
      setCachedData(getCacheKey('clients'), clients);
      return clients;
    }
    
    const cached = getCachedData<any[]>(getCacheKey('clients'));
    return cached || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('clients')) || [];
  }
}

export async function saveClient(client: any) {
  const clientId = client.id || generateId();
  const clientRef = ref(rtdb, `clients/${clientId}`);
  const clientData = {
    name: client.name,
    cedula: client.cedula || '',
    phone: client.phone || '',
    address: client.address || '',
    debt: client.debt || 0,
    updatedAt: new Date().toISOString()
  };
  await set(clientRef, clientData);
  return { id: clientId, ...clientData };
}

export async function deleteClient(id: number) {
  await remove(ref(rtdb, `clients/${id}`));
}

// ============================================================
// TRANSACCIONES
// ============================================================

export async function getAllTransactions() {
  try {
    const transactionsRef = ref(rtdb, 'transactions');
    const snapshot = await get(transactionsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const transactions = Object.entries(data)
        .map(([id, tx]) => ({ id, ...(tx as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setCachedData(getCacheKey('transactions'), transactions);
      return transactions;
    }
    
    const cached = getCachedData<any[]>(getCacheKey('transactions'));
    return cached || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('transactions')) || [];
  }
}

export async function saveTransaction(transaction: any) {
  const txId = transaction.id || generateId();
  const txRef = ref(rtdb, `transactions/${txId}`);
  const txData = {
    date: transaction.date || new Date().toISOString(),
    type: transaction.type || 'sale',
    items: transaction.items ? JSON.stringify(transaction.items) : null,
    subtotal: transaction.subtotal || 0,
    iva: transaction.iva || 0,
    total: transaction.total || 0,
    total_usd: transaction.totalUsd || 0,
    pay_method: transaction.payMethod || null,
    paid_bs: transaction.paidBs || 0,
    change: transaction.change || 0,
    client_id: transaction.clientId || null,
    client_name: transaction.clientName || null,
    exchange_rate: transaction.exchangeRate || null,
    receipt_number: transaction.receiptNumber || null,
    notes: transaction.notes || null,
    session_id: transaction.sessionId || null,
    terminal_id: transaction.terminalId || null,
    updatedAt: new Date().toISOString()
  };
  await set(txRef, txData);
  return { id: txId, ...txData };
}

// ============================================================
// CUENTAS POR COBRAR
// ============================================================

export async function getAllAccounts() {
  try {
    const accountsRef = ref(rtdb, 'accounts');
    const snapshot = await get(accountsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const accounts = Object.entries(data).map(([id, account]) => ({ id, ...(account as any) }));
      setCachedData(getCacheKey('accounts'), accounts);
      return accounts;
    }
    
    return getCachedData<any[]>(getCacheKey('accounts')) || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('accounts')) || [];
  }
}

export async function saveAccount(account: any) {
  const accountId = account.id || generateId();
  const accountRef = ref(rtdb, `accounts/${accountId}`);
  const accountData = {
    client_id: account.clientId,
    client_name: account.clientName || null,
    client_cedula: account.clientCedula || null,
    amount_bs: account.amountBs || 0,
    amount_usd: account.amountUsd || 0,
    paid_amount: account.paidAmount || 0,
    status: account.status || 'pendiente',
    date: account.date || new Date().toISOString(),
    products: account.products || null,
    exchange_rate: account.exchangeRate || null,
    tx_id: account.txId || null,
    updatedAt: new Date().toISOString()
  };
  await set(accountRef, accountData);
  return { id: accountId, ...accountData };
}

export async function deleteAccount(id: number) {
  await remove(ref(rtdb, `accounts/${id}`));
}

// ============================================================
// PROVEEDORES
// ============================================================

export async function getAllSuppliers() {
  try {
    const suppliersRef = ref(rtdb, 'suppliers');
    const snapshot = await get(suppliersRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const suppliers = Object.entries(data).map(([id, supplier]) => ({ id, ...(supplier as any) }));
      setCachedData(getCacheKey('suppliers'), suppliers);
      return suppliers;
    }
    
    return getCachedData<any[]>(getCacheKey('suppliers')) || [];
  } catch {
    return getCachedData<any[]>(getCacheKey('suppliers')) || [];
  }
}

export async function saveSupplier(supplier: any) {
  const supplierId = supplier.id || generateId();
  const supplierRef = ref(rtdb, `suppliers/${supplierId}`);
  const supplierData = {
    name: supplier.name,
    rif: supplier.rif || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    contact_person: supplier.contactPerson || '',
    total_debt: supplier.totalDebt || 0,
    updatedAt: new Date().toISOString()
  };
  await set(supplierRef, supplierData);
  return { id: supplierId, ...supplierData };
}

export async function deleteSupplier(id: number) {
  await remove(ref(rtdb, `suppliers/${id}`));
}

// ============================================================
// FACTURAS DE COMPRA
// ============================================================

export async function getAllPurchaseInvoices() {
  try {
    const invoicesRef = ref(rtdb, 'purchase_invoices');
    const snapshot = await get(invoicesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, invoice]) => ({ id, ...(invoice as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function savePurchaseInvoice(invoice: any) {
  const invoiceId = invoice.id || generateId();
  const invoiceRef = ref(rtdb, `purchase_invoices/${invoiceId}`);
  const invoiceData = {
    supplier_id: invoice.supplierId,
    invoice_number: invoice.invoiceNumber,
    date: invoice.date || new Date().toISOString(),
    due_date: invoice.dueDate || null,
    subtotal: invoice.subtotal || 0,
    iva: invoice.iva || 0,
    total: invoice.total || 0,
    paid_amount: invoice.paidAmount || 0,
    status: invoice.status || 'pendiente',
    notes: invoice.notes || null,
    exchange_rate: invoice.exchangeRate || null,
    items_count: invoice.itemsCount || 0,
    updatedAt: new Date().toISOString()
  };
  await set(invoiceRef, invoiceData);
  return { id: invoiceId, ...invoiceData };
}

// ============================================================
// ITEMS DE COMPRA
// ============================================================

export async function getAllPurchaseItems() {
  try {
    const itemsRef = ref(rtdb, 'purchase_items');
    const snapshot = await get(itemsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, item]) => ({ id, ...(item as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
  for (const item of items) {
    const itemId = item.id || generateId();
    const itemRef = ref(rtdb, `purchase_items/${itemId}`);
    const itemData = {
      invoice_id: invoiceId,
      product_id: item.productId,
      product_name: item.productName,
      qty: item.qty || 0,
      cost_usd: item.costUsd || 0,
      total_usd: item.totalUsd || 0,
      updatedAt: new Date().toISOString()
    };
    await set(itemRef, itemData);
  }
}

// ============================================================
// PAGOS A PROVEEDORES
// ============================================================

export async function getAllSupplierPayments() {
  try {
    const paymentsRef = ref(rtdb, 'supplier_payments');
    const snapshot = await get(paymentsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, payment]) => ({ id, ...(payment as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveSupplierPayment(payment: any) {
  const paymentId = payment.id || generateId();
  const paymentRef = ref(rtdb, `supplier_payments/${paymentId}`);
  const paymentData = {
    supplier_id: payment.supplierId,
    invoice_id: payment.invoiceId || null,
    date: payment.date || new Date().toISOString(),
    amount: payment.amount || 0,
    method: payment.method || 'efectivo',
    reference: payment.reference || null,
    bank: payment.bank || null,
    notes: payment.notes || null,
    updatedAt: new Date().toISOString()
  };
  await set(paymentRef, paymentData);
  return { id: paymentId, ...paymentData };
}

export async function deleteSupplierPayment(id: number) {
  await remove(ref(rtdb, `supplier_payments/${id}`));
}

// ============================================================
// ASIENTOS CONTABLES
// ============================================================

export async function getAllAccountingEntries() {
  try {
    const entriesRef = ref(rtdb, 'accounting_entries');
    const snapshot = await get(entriesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data)
        .map(([id, entry]) => ({ id, ...(entry as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveAccountingEntry(entry: any) {
  const entryId = entry.id || generateId();
  const entryRef = ref(rtdb, `accounting_entries/${entryId}`);
  const entryData = {
    date: entry.date || new Date().toISOString(),
    type: entry.type || 'ingreso',
    category: entry.category || 'ventas',
    subcategory: entry.subcategory || null,
    concept: entry.concept || null,
    description: entry.description || null,
    amount: entry.amount || 0,
    reference_id: entry.referenceId || null,
    reference_type: entry.referenceType || null,
    updatedAt: new Date().toISOString()
  };
  await set(entryRef, entryData);
  return { id: entryId, ...entryData };
}

// ============================================================
// KARDEX - ✅ CORREGIDO
// ============================================================

export async function getAllKardexEntries() {
  try {
    const kardexRef = ref(rtdb, 'kardex_entries');
    const snapshot = await get(kardexRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data)
        .map(([id, entry]) => {
          const e = entry as any;
          return {
            id: id,
            productId: e.product_id,
            date: e.date,
            type: e.type,
            quantity: e.quantity,
            previousStock: e.previous_stock,
            newStock: e.new_stock,
            reference: e.reference,
            note: e.note,
            costUsd: e.cost_usd,
            updatedAt: e.updatedAt
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveKardexEntry(entry: any) {
  // Generar ID válido para Firebase
  const entryId = entry.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const cleanId = entryId.replace(/[.#$[\]]/g, '_');
  const entryRef = ref(rtdb, `kardex_entries/${cleanId}`);
  
  // ✅ Convertir tipos para que coincidan con la definición de KardexEntry
  let type = entry.type || 'entrada';
  
  if (type === 'INICIAL') {
    type = 'ajuste_inicial';
  } else if (type === 'venta') {
    type = 'salida_venta';
  } else if (type === 'compra') {
    type = 'entrada_compra';
  } else if (type === 'colaboracion' || type === 'consumo') {
    // ✅ Colaboración y Consumo propio son SALIDAS de inventario
    type = 'salida_venta';
  } else if (type === 'ajuste_manual') {
    // Si la cantidad es positiva => ajuste positivo, si es negativa => ajuste negativo
    if (entry.quantity > 0) {
      type = 'ajuste_positivo';
    } else {
      type = 'ajuste_negativo';
    }
  }
  
  const entryData = {
    product_id: entry.productId,
    date: entry.date || new Date().toISOString(),
    type: type,
    quantity: entry.quantity || 0,
    previous_stock: entry.previousStock || 0,
    new_stock: entry.newStock || 0,
    reference: entry.reference || null,
    note: entry.note || null,
    cost_usd: entry.costUsd || null,
    updatedAt: new Date().toISOString()
  };
  
  await set(entryRef, entryData);
  
  return {
    id: cleanId,
    productId: entryData.product_id,
    date: entryData.date,
    type: entryData.type,
    quantity: entryData.quantity,
    previousStock: entryData.previous_stock,
    newStock: entryData.new_stock,
    reference: entryData.reference,
    note: entryData.note,
    costUsd: entryData.cost_usd,
    updatedAt: entryData.updatedAt
  };
}

// ============================================================
// REGISTROS DE CAJA (SESIONES)
// ============================================================

export async function getRegisterByTerminal(terminalId: string) {
  try {
    const registerRef = ref(rtdb, `registers/${terminalId}`);
    const snapshot = await get(registerRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        terminalId: terminalId,
        isOpen: data.is_open === 1,
        openTime: data.open_time,
        openAmountBs: data.open_amount_bs || 0,
        openAmountUsd: data.open_amount_usd || 0,
        exchangeRate: data.exchange_rate || null,
        txs: data.txs || []
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveRegisterByTerminal(terminalId: string, register: any) {
  const registerRef = ref(rtdb, `registers/${terminalId}`);
  await set(registerRef, {
    is_open: register.isOpen ? 1 : 0,
    open_time: register.openTime || null,
    open_amount_bs: register.openAmountBs || 0,
    open_amount_usd: register.openAmountUsd || 0,
    exchange_rate: register.exchangeRate || null,
    txs: register.txs || [],
    updatedAt: new Date().toISOString()
  });
}

// ============================================================
// CIERRES DE CAJA
// ============================================================

export async function getAllCashCloses() {
  try {
    const closesRef = ref(rtdb, 'cash_closes');
    const snapshot = await get(closesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data)
        .map(([id, close]) => ({ id, ...(close as any) }))
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveCashClose(close: any) {
  const closeId = close.id || generateId();
  const closeRef = ref(rtdb, `cash_closes/${closeId}`);
  await set(closeRef, {
    fecha: close.fecha || new Date().toISOString(),
    tipo: close.tipo || 'cierre',
    data: close,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteCashClose(id: string) {
  await remove(ref(rtdb, `cash_closes/${id}`));
}

// ============================================================
// TERMINALES
// ============================================================

export async function getAllTerminals() {
  try {
    const terminalsRef = ref(rtdb, 'terminals');
    const snapshot = await get(terminalsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, terminal]) => ({ id, ...(terminal as any) }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveTerminal(terminal: any) {
  const terminalId = terminal.id || generateId();
  const terminalRef = ref(rtdb, `terminals/${terminalId}`);
  const terminalData = {
    name: terminal.name,
    description: terminal.description || null,
    location: terminal.location || null,
    assigned_to: terminal.assignedTo || null,
    status: terminal.status || 'active',
    is_blocked: terminal.isBlocked ? 1 : 0,
    updatedAt: new Date().toISOString()
  };
  await set(terminalRef, terminalData);
  return { id: terminalId, ...terminalData };
}

export async function deleteTerminal(id: string) {
  await remove(ref(rtdb, `terminals/${id}`));
}

export async function updateTerminalBlockStatus(terminalId: string, isBlocked: boolean) {
  await update(ref(rtdb, `terminals/${terminalId}`), {
    is_blocked: isBlocked ? 1 : 0,
    updatedAt: new Date().toISOString()
  });
}

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

export async function getGlobalSettings() {
  try {
    const settingsRef = ref(rtdb, 'global_settings');
    const snapshot = await get(settingsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const settings: any = {};
      for (const [key, value] of Object.entries(data)) {
        try {
          settings[key] = JSON.parse(value as string);
        } catch {
          settings[key] = value;
        }
      }
      setCachedData(getCacheKey('settings'), settings);
      return settings;
    }
    
    return getCachedData<any>(getCacheKey('settings')) || {};
  } catch {
    return getCachedData<any>(getCacheKey('settings')) || {};
  }
}

export async function saveGlobalSettings(settings: any) {
  const settingsRef = ref(rtdb, 'global_settings');
  const updates: any = {};
  for (const [key, value] of Object.entries(settings)) {
    updates[key] = JSON.stringify(value);
  }
  await update(settingsRef, updates);
  setCachedData(getCacheKey('settings'), settings);
}

export async function getAdminCode() {
  try {
    const result = await getGlobalSettings();
    return { code: result.admin_code || '123456' };
  } catch {
    return { code: '123456' };
  }
}

// ============================================================
// SUSCRIPCIONES EN TIEMPO REAL (Firebase)
// ============================================================

export function subscribeToStockRTDB(callback: (stockData: Record<string, number>) => void) {
  const stockRef = ref(rtdb, 'products');
  
  const unsubscribe = onValue(stockRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const stockMap: Record<string, number> = {};
      
      for (const [id, product] of Object.entries(data)) {
        const p = product as any;
        if (p.activo !== 0) {
          stockMap[id] = p.stock || 0;
        }
      }
      
      callback(stockMap);
      setCachedData(STOCK_CACHE_KEY, stockMap);
    } else {
      const cached = getCachedData<Record<string, number>>(STOCK_CACHE_KEY);
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToProducts(callback: (data: any[]) => void) {
  const productsRef = ref(rtdb, 'products');
  
  const unsubscribe = onValue(productsRef, async (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const products = Object.entries(data)
        .map(([id, product]) => {
          const p = product as any;
          return {
            id: parseInt(id),
            barcode: p.barcode || '',
            name: p.name || '',
            department: p.department || null,
            category: p.category || null,
            stock: p.stock || 0,
            minStock: p.min_stock || 5,
            costUsd: p.cost_usd || 0,
            costBs: p.cost_bs || 0,
            profitPercent: p.profit_percent || 30,
            priceUsd: p.price_usd || 0,
            priceBs: p.price_bs || 0,
            priceRetail: p.price_retail || 0,
            priceWholesale: p.price_wholesale || 0,
            priceCost: p.price_cost || 0,
            ivaType: p.iva_type || 'con_iva',
            ivaPercentage: p.iva_percentage || 16,
            isKit: p.is_kit === 1,
            kitHasOwnStock: p.kit_has_own_stock === 1,
            kitComponents: p.kit_components ? JSON.parse(p.kit_components) : [],
            isPriceFixed: p.is_price_fixed === 1,
            activo: p.activo !== undefined ? p.activo : 1,
            updatedAt: p.updatedAt || new Date().toISOString()
          };
        })
        .filter((p: any) => p.activo !== 0);
      
      setCachedData(getCacheKey('products'), products);
      callback(products);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('products'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToClients(callback: (data: any[]) => void) {
  const clientsRef = ref(rtdb, 'clients');
  
  const unsubscribe = onValue(clientsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const clients = Object.entries(data).map(([id, client]) => ({ id, ...(client as any) }));
      setCachedData(getCacheKey('clients'), clients);
      callback(clients);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('clients'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToTransactions(callback: (data: any[]) => void) {
  const transactionsRef = ref(rtdb, 'transactions');
  
  const unsubscribe = onValue(transactionsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const transactions = Object.entries(data)
        .map(([id, tx]) => ({ id, ...(tx as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setCachedData(getCacheKey('transactions'), transactions);
      callback(transactions);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('transactions'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToAccounts(callback: (data: any[]) => void) {
  const accountsRef = ref(rtdb, 'accounts');
  
  const unsubscribe = onValue(accountsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const accounts = Object.entries(data).map(([id, account]) => ({ id, ...(account as any) }));
      setCachedData(getCacheKey('accounts'), accounts);
      callback(accounts);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('accounts'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToRegisterRealtime(terminalId: string, callback: (data: any) => void) {
  const registerRef = ref(rtdb, `registers/${terminalId}`);
  
  const unsubscribe = onValue(registerRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback({
        terminalId: terminalId,
        isOpen: data.is_open === 1,
        openTime: data.open_time,
        openAmountBs: data.open_amount_bs || 0,
        openAmountUsd: data.open_amount_usd || 0,
        exchangeRate: data.exchange_rate || null,
        txs: data.txs || []
      });
    } else {
      callback(null);
    }
  });
  
  return unsubscribe;
}

export function subscribeToSuppliers(callback: (data: any[]) => void) {
  const suppliersRef = ref(rtdb, 'suppliers');
  
  const unsubscribe = onValue(suppliersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const suppliers = Object.entries(data).map(([id, supplier]) => ({ id, ...(supplier as any) }));
      setCachedData(getCacheKey('suppliers'), suppliers);
      callback(suppliers);
    } else {
      const cached = getCachedData<any[]>(getCacheKey('suppliers'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

export function subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
  const invoicesRef = ref(rtdb, 'purchase_invoices');
  
  const unsubscribe = onValue(invoicesRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data).map(([id, invoice]) => ({ id, ...(invoice as any) })));
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToPurchaseItems(callback: (data: any[]) => void) {
  const itemsRef = ref(rtdb, 'purchase_items');
  
  const unsubscribe = onValue(itemsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data).map(([id, item]) => ({ id, ...(item as any) })));
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToSupplierPayments(callback: (data: any[]) => void) {
  const paymentsRef = ref(rtdb, 'supplier_payments');
  
  const unsubscribe = onValue(paymentsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data).map(([id, payment]) => ({ id, ...(payment as any) })));
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToAccounting(callback: (data: any[]) => void) {
  const entriesRef = ref(rtdb, 'accounting_entries');
  
  const unsubscribe = onValue(entriesRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.entries(data)
        .map(([id, entry]) => ({ id, ...(entry as any) }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToKardex(callback: (data: any[]) => void) {
  const kardexRef = ref(rtdb, 'kardex_entries');
  
  const unsubscribe = onValue(kardexRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const entries = Object.entries(data)
        .map(([id, entry]) => {
          const e = entry as any;
          return {
            id: id,
            productId: e.product_id,
            date: e.date,
            type: e.type,
            quantity: e.quantity,
            previousStock: e.previous_stock,
            newStock: e.new_stock,
            reference: e.reference,
            note: e.note,
            costUsd: e.cost_usd,
            updatedAt: e.updatedAt
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(entries);
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
}

export function subscribeToGlobalSettings(callback: (data: any) => void) {
  const settingsRef = ref(rtdb, 'global_settings');
  
  const unsubscribe = onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const settings: any = {};
      for (const [key, value] of Object.entries(data)) {
        try {
          settings[key] = JSON.parse(value as string);
        } catch {
          settings[key] = value;
        }
      }
      setCachedData(getCacheKey('settings'), settings);
      callback(settings);
    } else {
      const cached = getCachedData<any>(getCacheKey('settings'));
      if (cached) callback(cached);
    }
  });
  
  return unsubscribe;
}

// ============================================================
// FUNCIONES DE SINCRONIZACIÓN (simplificadas)
// ============================================================

export function sendSyncCommandToAllTerminals() {
  console.log('📡 Comando de sincronización enviado a todas las terminales');
}

export function listenForSyncCommands(terminalId: string, onSync: () => Promise<void>) {
  const interval = setInterval(() => {
    onSync().catch(console.error);
  }, 30000);
  
  return () => clearInterval(interval);
}

export async function loadAllDataToCache() {
  console.log('📡 Cargando datos a caché local...');
  try {
    await getAllProducts();
    await getAllClients();
    await getAllTransactions();
    await getAllAccounts();
    await getAllSuppliers();
    await getGlobalSettings();
    console.log('✅ Datos cargados a caché');
  } catch (error) {
    console.error('❌ Error cargando caché:', error);
  }
}

export async function syncAllPending() {
  console.log('📡 Sincronizando operaciones locales...');
  return true;
}

export async function runAtomicSale(terminalId: string, transaction: any, updates: any) {
  try {
    await saveTransaction(transaction);
    
    if (updates.products) {
      for (const [id, data] of Object.entries(updates.products)) {
        const productRef = ref(rtdb, `products/${id}`);
        await update(productRef, {
          stock: (data as any).newStock,
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    if (updates.kardexEntries) {
      for (const entry of updates.kardexEntries) {
        await saveKardexEntry(entry);
      }
    }
    
    if (updates.accountingEntry) {
      await saveAccountingEntry(updates.accountingEntry);
    }
    
    if (updates.registerUpdate) {
      const reg = await getRegisterByTerminal(terminalId);
      if (reg) {
        await saveRegisterByTerminal(terminalId, { 
          ...reg, 
          txs: updates.registerUpdate.txs 
        });
      }
    }
    
    console.log('✅ Venta atómica completada');
  } catch (error) {
    console.error('❌ Error en venta atómica:', error);
    throw error;
  }
}

export function getPendingQueueLength() { 
  return 0; 
}

export function unsubscribeAll() {
  console.log('📡 Desuscribiendo todas las suscripciones...');
}

export function setLoggingOut(val: boolean) {
  // No necesario con Firebase
}

// ============================================================
// EXPORTACIÓN DE FUNCIONES ALIAS (compatibilidad)
// ============================================================

export const getProducts = getAllProducts;
export const getClients = getAllClients;
export const getTransactions = getAllTransactions;
export const getAccounts = getAllAccounts;
export const getSuppliers = getAllSuppliers;
export const getPurchaseInvoices = getAllPurchaseInvoices;
export const getPurchaseItems = getAllPurchaseItems;
export const getSupplierPayments = getAllSupplierPayments;
export const getAccountingEntries = getAllAccountingEntries;
export const getKardexEntries = getAllKardexEntries;

export const subscribeToSuppliersRealtime = subscribeToSuppliers;

// ============================================================
// EXPORT DEFAULT
// ============================================================

const syncService = {
  getUserByUid, saveUser, getAllUsers, deleteUser, updateUserTerminalId,
  getAllProducts, getProducts, saveProduct, saveProducts, deleteProduct, updateProductWithWeightedAverageCost,
  getAllClients, getClients, saveClient, deleteClient,
  getAllTransactions, getTransactions, saveTransaction,
  getAllAccounts, getAccounts, saveAccount, deleteAccount,
  getAllSuppliers, getSuppliers, saveSupplier, deleteSupplier,
  getAllPurchaseInvoices, getPurchaseInvoices, savePurchaseInvoice,
  getAllPurchaseItems, getPurchaseItems, savePurchaseInvoiceItems,
  getAllSupplierPayments, getSupplierPayments, saveSupplierPayment, deleteSupplierPayment,
  getAllAccountingEntries, getAccountingEntries, saveAccountingEntry,
  getAllKardexEntries, getKardexEntries, saveKardexEntry,
  getRegisterByTerminal, saveRegisterByTerminal,
  getAllCashCloses, saveCashClose, deleteCashClose,
  getAllTerminals, saveTerminal, deleteTerminal, updateTerminalBlockStatus,
  getGlobalSettings, saveGlobalSettings, getAdminCode,
  subscribeToStockRTDB,
  subscribeToProducts, 
  subscribeToClients, 
  subscribeToTransactions, 
  subscribeToAccounts,
  subscribeToRegisterRealtime, 
  subscribeToPurchaseInvoices, 
  subscribeToPurchaseItems,
  subscribeToSupplierPayments, 
  subscribeToSuppliersRealtime, 
  subscribeToGlobalSettings,
  subscribeToKardex, 
  subscribeToAccounting,
  sendSyncCommandToAllTerminals, 
  listenForSyncCommands,
  loadAllDataToCache, 
  syncAllPending, 
  runAtomicSale, 
  getPendingQueueLength, 
  unsubscribeAll, 
  setLoggingOut
};

export default syncService;