
import { turso, executeQuery, getById, getAll, insert, update, remove } from '@/lib/db';

// ============================================================
// USUARIOS
// ============================================================

export async function getUserByUid(uid: string) {
  const result = await turso.execute({
    sql: 'SELECT uid, name, email, role, terminal_id as terminalId, status FROM users WHERE uid = ?',
    args: [uid]
  });
  return result.rows[0] || null;
}

export async function saveUser(user: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO users (uid, name, email, role, terminal_id, status) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [user.uid, user.name, user.email, user.role, user.terminalId || null, user.status || 'active']
  });
}

export async function getAllUsers() {
  const result = await turso.execute('SELECT uid, name, email, role, terminal_id as terminalId, status FROM users');
  return result.rows;
}

export async function deleteUser(uid: string) {
  await turso.execute({ sql: 'DELETE FROM users WHERE uid = ?', args: [uid] });
}

export async function updateUserTerminalId(userId: string, terminalId: string | null) {
  await turso.execute({
    sql: 'UPDATE users SET terminal_id = ? WHERE uid = ?',
    args: [terminalId, userId]
  });
}

// ============================================================
// PRODUCTOS
// ============================================================

export async function getAllProducts() {
  const result = await turso.execute(`SELECT 
    id, barcode, name, department, category, stock, min_stock as minStock,
    cost_usd as costUsd, cost_bs as costBs, profit_percent as profitPercent,
    price_usd as priceUsd, price_bs as priceBs, price_retail as priceRetail,
    price_wholesale as priceWholesale, price_cost as priceCost,
    iva_type as ivaType, iva_percentage as ivaPercentage,
    is_kit as isKit, kit_has_own_stock as kitHasOwnStock, kit_components as kitComponents,
    is_price_fixed as isPriceFixed, activo
    FROM products WHERE activo = 1`);
  return result.rows;
}

export async function saveProduct(product: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO products (
      id, barcode, name, department, category, stock, min_stock,
      cost_usd, cost_bs, profit_percent, price_usd, price_bs, price_retail,
      price_wholesale, price_cost, iva_type, iva_percentage,
      is_kit, kit_has_own_stock, kit_components, is_price_fixed, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      product.id, product.barcode, product.name, product.department || null, product.category,
      product.stock, product.minStock || 5,
      product.costUsd || 0, product.costBs || 0, product.profitPercent || 30,
      product.priceUsd || 0, product.priceBs || 0, product.priceRetail || 0,
      product.priceWholesale || 0, product.priceCost || 0,
      product.ivaType || 'con_iva', product.ivaPercentage || 16,
      product.isKit ? 1 : 0, product.kitHasOwnStock ? 1 : 0,
      product.kitComponents ? JSON.stringify(product.kitComponents) : null,
      product.isPriceFixed ? 1 : 0
    ]
  });
}

export async function saveProducts(products: any[]) {
  for (const product of products) {
    await saveProduct(product);
  }
}

export async function deleteProduct(id: number) {
  await turso.execute({ sql: 'UPDATE products SET activo = 0 WHERE id = ?', args: [id] });
}

export async function updateProductWithWeightedAverageCost(productId: number, newQty: number, newCostUsd: number, exchangeRate: number) {
  const product = await getById('products', productId);
  if (!product) return;
  
  const oldStock = Number(product.stock) || 0;
  const oldCost = Number(product.cost_usd) || 0;
  const newStock = oldStock + newQty;
  let newAvgCost = oldCost;
  
  if (newStock > 0) {
    newAvgCost = ((oldStock * oldCost) + (newQty * newCostUsd)) / newStock;
  }
  
  await turso.execute({
    sql: `UPDATE products SET 
      stock = ?, cost_usd = ?, cost_bs = ?, updated_at = datetime('now')
      WHERE id = ?`,
    args: [newStock, newAvgCost, newAvgCost * exchangeRate, productId]
  });
}

// ============================================================
// CLIENTES
// ============================================================

export async function getAllClients() {
  const result = await turso.execute('SELECT id, name, cedula, phone, address, debt FROM clients');
  return result.rows;
}

export async function saveClient(client: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO clients (id, name, cedula, phone, address, debt)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [client.id, client.name, client.cedula, client.phone || '', client.address || '', client.debt || 0]
  });
}

export async function deleteClient(id: number) {
  await turso.execute({ sql: 'DELETE FROM clients WHERE id = ?', args: [id] });
}

// ============================================================
// TRANSACCIONES
// ============================================================

export async function getAllTransactions() {
  const result = await turso.execute(`SELECT 
    id, date, type, items, subtotal, iva, total, total_usd as totalUsd,
    pay_method as payMethod, paid_bs as paidBs, change,
    client_id as clientId, client_name as clientName,
    exchange_rate as exchangeRate, receipt_number as receiptNumber,
    notes, session_id as sessionId, terminal_id as terminalId
    FROM transactions ORDER BY date DESC`);
  return result.rows;
}

export async function saveTransaction(transaction: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO transactions (
      id, date, type, items, subtotal, iva, total, total_usd,
      pay_method, paid_bs, change, client_id, client_name,
      exchange_rate, receipt_number, notes, session_id, terminal_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      transaction.id, transaction.date, transaction.type,
      transaction.items ? JSON.stringify(transaction.items) : null,
      transaction.subtotal || 0, transaction.iva || 0, transaction.total || 0,
      transaction.totalUsd || 0,
      transaction.payMethod || null, transaction.paidBs || 0, transaction.change || 0,
      transaction.clientId || null, transaction.clientName || null,
      transaction.exchangeRate || null, transaction.receiptNumber || null,
      transaction.notes || null, transaction.sessionId || null, transaction.terminalId || null
    ]
  });
}

// ============================================================
// CUENTAS POR COBRAR
// ============================================================

export async function getAllAccounts() {
  const result = await turso.execute(`SELECT 
    id, client_id as clientId, client_name as clientName, client_cedula as clientCedula,
    amount_bs as amountBs, amount_usd as amountUsd, paid_amount as paidAmount,
    status, date, products, exchange_rate as exchangeRate, tx_id as txId
    FROM accounts`);
  return result.rows;
}

export async function saveAccount(account: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO accounts (
      id, client_id, client_name, client_cedula, amount_bs, amount_usd,
      paid_amount, status, date, products, exchange_rate, tx_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      account.id, account.clientId, account.clientName || null, account.clientCedula || null,
      account.amountBs, account.amountUsd || account.amountBs / (account.exchangeRate || 1),
      account.paidAmount || 0, account.status || 'pendiente',
      account.date, account.products || null, account.exchangeRate || null, account.txId || null
    ]
  });
}

export async function deleteAccount(id: number) {
  await turso.execute({ sql: 'DELETE FROM accounts WHERE id = ?', args: [id] });
}

// ============================================================
// PROVEEDORES
// ============================================================

export async function getAllSuppliers() {
  const result = await turso.execute('SELECT id, name, rif, phone, email, address, contact_person as contactPerson, total_debt as totalDebt FROM suppliers');
  return result.rows;
}

export async function saveSupplier(supplier: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO suppliers (id, name, rif, phone, email, address, contact_person, total_debt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [supplier.id, supplier.name, supplier.rif, supplier.phone || '', supplier.email || '',
           supplier.address || '', supplier.contactPerson || '', supplier.totalDebt || 0]
  });
}

export async function deleteSupplier(id: number) {
  await turso.execute({ sql: 'DELETE FROM suppliers WHERE id = ?', args: [id] });
}

// ============================================================
// FACTURAS DE COMPRA
// ============================================================

export async function getAllPurchaseInvoices() {
  const result = await turso.execute(`SELECT 
    id, supplier_id as supplierId, invoice_number as invoiceNumber,
    date, due_date as dueDate, subtotal, iva, total,
    paid_amount as paidAmount, status, notes, exchange_rate as exchangeRate,
    items_count as itemsCount
    FROM purchase_invoices`);
  return result.rows;
}

export async function savePurchaseInvoice(invoice: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO purchase_invoices (
      id, supplier_id, invoice_number, date, due_date, subtotal, iva,
      total, paid_amount, status, notes, exchange_rate, items_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      invoice.id, invoice.supplierId, invoice.invoiceNumber, invoice.date,
      invoice.dueDate || null, invoice.subtotal || 0, invoice.iva || 0,
      invoice.total, invoice.paidAmount || 0, invoice.status || 'pendiente',
      invoice.notes || null, invoice.exchangeRate || null, invoice.itemsCount || 0
    ]
  });
}

// ============================================================
// ITEMS DE COMPRA
// ============================================================

export async function getAllPurchaseItems() {
  const result = await turso.execute(`SELECT 
    id, invoice_id as invoiceId, product_id as productId,
    product_name as productName, qty, cost_usd as costUsd, total_usd as totalUsd
    FROM purchase_items`);
  return result.rows;
}

export async function savePurchaseInvoiceItems(invoiceId: number, items: any[]) {
  for (const item of items) {
    await turso.execute({
      sql: `INSERT OR REPLACE INTO purchase_items (
        id, invoice_id, product_id, product_name, qty, cost_usd, total_usd
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, invoiceId, item.productId, item.productName, item.qty, item.costUsd, item.totalUsd]
    });
  }
}

// ============================================================
// PAGOS A PROVEEDORES
// ============================================================

export async function getAllSupplierPayments() {
  const result = await turso.execute(`SELECT 
    id, supplier_id as supplierId, invoice_id as invoiceId,
    date, amount, method, reference, bank, notes
    FROM supplier_payments`);
  return result.rows;
}

export async function saveSupplierPayment(payment: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO supplier_payments (
      id, supplier_id, invoice_id, date, amount, method, reference, bank, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      payment.id, payment.supplierId, payment.invoiceId || null, payment.date,
      payment.amount, payment.method, payment.reference || null, payment.bank || null,
      payment.notes || null
    ]
  });
}

export async function deleteSupplierPayment(id: number) {
  await turso.execute({ sql: 'DELETE FROM supplier_payments WHERE id = ?', args: [id] });
}

// ============================================================
// ASIENTOS CONTABLES
// ============================================================

export async function getAllAccountingEntries() {
  const result = await turso.execute(`SELECT 
    id, date, type, category, subcategory, concept, description,
    amount, reference_id as referenceId, reference_type as referenceType
    FROM accounting_entries ORDER BY date DESC`);
  return result.rows;
}

export async function saveAccountingEntry(entry: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO accounting_entries (
      id, date, type, category, subcategory, concept, description,
      amount, reference_id, reference_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.id, entry.date, entry.type, entry.category, entry.subcategory || null,
      entry.concept || null, entry.description || null, entry.amount,
      entry.referenceId || null, entry.referenceType || null
    ]
  });
}

// ============================================================
// KARDEX
// ============================================================

export async function getAllKardexEntries() {
  const result = await turso.execute(`SELECT 
    id, product_id as productId, date, type, quantity,
    previous_stock as previousStock, new_stock as newStock,
    reference, note, cost_usd as costUsd
    FROM kardex_entries ORDER BY date DESC`);
  return result.rows;
}

export async function saveKardexEntry(entry: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO kardex_entries (
      id, product_id, date, type, quantity, previous_stock, new_stock,
      reference, note, cost_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.id, entry.productId, entry.date, entry.type, entry.quantity,
      entry.previousStock, entry.newStock, entry.reference || null,
      entry.note || null, entry.costUsd || null
    ]
  });
}

// ============================================================
// REGISTROS DE CAJA (SESIONES)
// ============================================================

export async function getRegisterByTerminal(terminalId: string) {
  const result = await turso.execute({
    sql: `SELECT terminal_id as terminalId, is_open as isOpen, open_time as openTime,
          open_amount_bs as openAmountBs, open_amount_usd as openAmountUsd,
          exchange_rate as exchangeRate, txs
          FROM registers WHERE terminal_id = ?`,
    args: [terminalId]
  });
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    terminalId: row.terminalId,
    isOpen: row.isOpen === 1,
    openTime: row.openTime,
    openAmountBs: row.openAmountBs,
    openAmountUsd: row.openAmountUsd,
    exchangeRate: row.exchangeRate,
    txs: row.txs ? JSON.parse(row.txs) : []
  };
}

export async function saveRegisterByTerminal(terminalId: string, register: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO registers (
      terminal_id, is_open, open_time, open_amount_bs, open_amount_usd,
      exchange_rate, txs
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      terminalId, register.isOpen ? 1 : 0, register.openTime || null,
      register.openAmountBs || 0, register.openAmountUsd || 0,
      register.exchangeRate || null, register.txs ? JSON.stringify(register.txs) : '[]'
    ]
  });
}

// ============================================================
// CIERRES DE CAJA
// ============================================================

export async function getAllCashCloses() {
  const result = await turso.execute('SELECT id, fecha, tipo, data FROM cash_closes ORDER BY fecha DESC');
  return result.rows.map((row: any) => ({ ...JSON.parse(row.data), id: row.id, fecha: row.fecha, tipo: row.tipo }));
}

export async function saveCashClose(close: any) {
  await turso.execute({
    sql: 'INSERT OR REPLACE INTO cash_closes (id, fecha, tipo, data) VALUES (?, ?, ?, ?)',
    args: [close.id, close.fecha, close.tipo, JSON.stringify(close)]
  });
}

export async function deleteCashClose(id: string) {
  await turso.execute({ sql: 'DELETE FROM cash_closes WHERE id = ?', args: [id] });
}

// ============================================================
// TERMINALES
// ============================================================

export async function getAllTerminals() {
  const result = await turso.execute(`SELECT 
    id, name, description, location, assigned_to as assignedTo,
    status, is_blocked as isBlocked
    FROM terminals`);
  return result.rows;
}

export async function saveTerminal(terminal: any) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO terminals (
      id, name, description, location, assigned_to, status, is_blocked, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      terminal.id, terminal.name, terminal.description || null,
      terminal.location || null, terminal.assignedTo || null,
      terminal.status || 'active', terminal.isBlocked ? 1 : 0
    ]
  });
}

export async function deleteTerminal(id: string) {
  await turso.execute({ sql: 'DELETE FROM terminals WHERE id = ?', args: [id] });
}

export async function updateTerminalBlockStatus(terminalId: string, isBlocked: boolean) {
  await turso.execute({
    sql: 'UPDATE terminals SET is_blocked = ?, updated_at = datetime("now") WHERE id = ?',
    args: [isBlocked ? 1 : 0, terminalId]
  });
}

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

export async function getGlobalSettings() {
  const result = await turso.execute('SELECT key, value FROM global_settings');
  const settings: any = {};
  for (const row of result.rows) {
    try {
      const key = String(row.key);
      const value = String(row.value);
      try {
        settings[key] = JSON.parse(value);
      } catch {
        settings[key] = value;
      }
    } catch {
      settings[row.key as string] = row.value;
    }
  }
  return settings;
}

export async function saveGlobalSettings(settings: any) {
  for (const [key, value] of Object.entries(settings)) {
    await turso.execute({
      sql: 'INSERT OR REPLACE INTO global_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
      args: [key, JSON.stringify(value)]
    });
  }
}

export async function getAdminCode() {
  const result = await turso.execute({
    sql: "SELECT value FROM global_settings WHERE key = 'admin_code'"
  });
  if (result.rows.length === 0) return { code: '123456' };
  const val = result.rows[0].value;
  try {
    return { code: typeof val === 'string' ? JSON.parse(val) : val };
  } catch {
    return { code: val };
  }
}

// ============================================================
// SUSCRIPCIONES Y COMANDOS
// ============================================================

export function subscribeToRegisterRealtime(terminalId: string, callback: (data: any) => void) {
  const fetchData = async () => {
    const data = await getRegisterByTerminal(terminalId);
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 3000);
  return () => clearInterval(interval);
}

export function subscribeToProducts(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllProducts();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
}

export function subscribeToClients(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllClients();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToTransactions(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllTransactions();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
}

export function subscribeToAccounts(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllAccounts();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToSuppliers(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllSuppliers();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToPurchaseInvoices(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllPurchaseInvoices();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToPurchaseItems(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllPurchaseItems();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToSupplierPayments(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllSupplierPayments();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToAccounting(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllAccountingEntries();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToKardex(callback: (data: any[]) => void) {
  const fetchData = async () => {
    const data = await getAllKardexEntries();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export function subscribeToGlobalSettings(callback: (data: any) => void) {
  const fetchData = async () => {
    const data = await getGlobalSettings();
    callback(data);
  };
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}

export async function sendSyncCommandToAllTerminals() {
  const terminals = await getAllTerminals();
  for (const t of terminals) {
    await turso.execute({
      sql: 'INSERT OR REPLACE INTO remote_commands (terminal_id, command, status, created_at) VALUES (?, ?, ?, datetime("now"))',
      args: [t.id, 'sync', 'pending']
    });
  }
}

export function listenForSyncCommands(terminalId: string, onSync: () => Promise<void>) {
  const interval = setInterval(async () => {
    const result = await turso.execute({
      sql: 'SELECT id FROM remote_commands WHERE terminal_id = ? AND command = "sync" AND status = "pending"',
      args: [terminalId]
    });
    if (result.rows.length > 0) {
      await onSync();
      for (const row of result.rows) {
        await turso.execute({
          sql: 'UPDATE remote_commands SET status = "completed", updated_at = datetime("now") WHERE id = ?',
          args: [row.id]
        });
      }
    }
  }, 5000);
  return () => clearInterval(interval);
}

export async function loadAllDataToCache() {
  console.log('📡 Cargando datos maestros a la sesión local...');
}

export async function syncAllPending() {
  console.log('📡 Sincronizando operaciones locales con la nube...');
  return true;
}

export async function runAtomicSale(terminalId: string, transaction: any, updates: any) {
  await saveTransaction(transaction);
  if (updates.products) {
    for (const [id, data] of updates.products) {
      await turso.execute({
        sql: 'UPDATE products SET stock = ?, updated_at = datetime("now") WHERE id = ?',
        args: [data.newStock, id]
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
      await saveRegisterByTerminal(terminalId, { ...reg, txs: updates.registerUpdate.txs });
    }
  }
}

export function getPendingQueueLength() { return 0; }
export function unsubscribeAll() {}
export function setLoggingOut(val: boolean) {}

const syncService = {
  getUserByUid, saveUser, getAllUsers, deleteUser, updateUserTerminalId,
  getAllProducts, getProducts: getAllProducts, saveProduct, saveProducts, deleteProduct, updateProductWithWeightedAverageCost,
  getAllClients, getClients: getAllClients, saveClient, deleteClient,
  getAllTransactions, getTransactions: getAllTransactions, saveTransaction,
  getAllAccounts, getAccounts: getAllAccounts, saveAccount, deleteAccount,
  getAllSuppliers, getSuppliers: getAllSuppliers, saveSupplier, deleteSupplier,
  getAllPurchaseInvoices, getPurchaseInvoices: getAllPurchaseInvoices, savePurchaseInvoice,
  getAllPurchaseItems, getPurchaseItems: getAllPurchaseItems, savePurchaseInvoiceItems,
  getAllSupplierPayments, getSupplierPayments: getAllSupplierPayments, saveSupplierPayment, deleteSupplierPayment,
  getAllAccountingEntries, getAccountingEntries: getAllAccountingEntries, saveAccountingEntry,
  getAllKardexEntries, getKardexEntries: getAllKardexEntries, saveKardexEntry,
  getRegisterByTerminal, saveRegisterByTerminal,
  getAllCashCloses, saveCashClose, deleteCashClose,
  getAllTerminals, saveTerminal, deleteTerminal, updateTerminalBlockStatus,
  getGlobalSettings, saveGlobalSettings, getAdminCode,
  subscribeToProducts, subscribeToClients, subscribeToTransactions, subscribeToAccounts,
  subscribeToRegisterRealtime, subscribeToPurchaseInvoices, subscribeToPurchaseItems,
  subscribeToSupplierPayments, subscribeToSuppliersRealtime: subscribeToSuppliers, subscribeToGlobalSettings,
  subscribeToKardex, subscribeToAccounting,
  sendSyncCommandToAllTerminals, listenForSyncCommands,
  loadAllDataToCache, syncAllPending, runAtomicSale, getPendingQueueLength, unsubscribeAll, setLoggingOut
};

export default syncService;
