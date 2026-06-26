// src/lib/types.ts
// ============================================================
// TIPOS GLOBALES
// ============================================================

export interface Product {
  id: number;
  barcode?: string;
  name: string;
  category: Category; // ✅ Cambiado: ahora es Category, no string
  department?: string;
  stock: number;
  minStock?: number;
  priceUsd: number;
  priceBs: number;
  costUsd?: number;
  costBs?: number;
  profitPercent?: number;
  priceRetail?: number;
  priceWholesale?: number;
  priceCost?: number;
  ivaType: 'con_iva' | 'sin_iva' | 'exento';
  ivaPercentage: number;
  isKit: boolean;
  kitHasOwnStock?: boolean;
  kitComponents?: KitComponent[];
  isPriceFixed: boolean;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
  unitMeasure?: string;
}

export interface KitComponent {
  productId: number;
  quantity: number;
  productName?: string;
}

export interface Client {
  id: number;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  debt?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'contado' | 'credito' | 'cobro_deuda' | 'colaboracion' | 'consumo_propio' | 'devolucion';
  items: CartItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalUsd: number;
  payMethod: string;
  paidBs: number;
  change: number;
  clientId?: number;
  clientName?: string;
  exchangeRate: number;
  receiptNumber?: number;
  costoTotalOperacion?: number;
  notes?: string;
  authorizedBy?: string;
  sessionId?: string;
  ajusteRedondeoBs?: number;
  payments?: Payment[];
  terminalId?: string | number;
  referenceId?: string | number;
  txId?: string | number;
  referenceType?: string;
}

export interface Payment {
  id: string;
  method: string;
  amount: number;
  usdAmount?: number;
}

export interface CartItem {
  productId: number;
  name: string;
  priceBs: number;
  priceUsd: number;
  qty: number;
  category: Category;
  ivaType: string;
  ivaPercentage: number;
  isKit: boolean;
  unitMeasure?: string;
}

export interface Account {
  id: number;
  txId: number;
  date: string;
  clientId: number;
  clientName: string;
  clientCedula: string;
  products: string;
  amountBs: number;
  amountUsd: number;
  paidAmount: number;
  paidAmountUsd?: number;
  status: 'pendiente' | 'parcial' | 'pagada';
  exchangeRate: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CashRegister {
  isOpen: boolean;
  openTime: string | null;
  openAmount: number;
  openAmountBs: number;
  openAmountUsd: number;
  txs: Transaction[];
  exchangeRate: number | null;
}

export interface CashClose {
  id: string;
  terminalId: string;
  openTime: string;
  closeTime: string;
  initialAmount: number;
  finalAmount: number;
  expectedAmount: number;
  difference: number;
  totalSales: number;
  transactions: Transaction[];
  notes?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'viewer';
  terminalId?: string;
  terminalName?: string;
  status: 'active' | 'inactive' | 'blocked';
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Terminal {
  id: string;
  name: string;
  description?: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  isBlocked?: boolean;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: number;
  name: string;
  cedula?: string;
  rif?: string;
  phone: string;
  address: string;
  email?: string;
  contactPerson?: string;
  debt?: number;
  totalDebt?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierInvoice {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  invoiceNumber?: string;
  total: number;
  totalUsd?: number;
  exchangeRate: number;
  status: 'pendiente' | 'pagada' | 'parcial';
  paymentMethod?: string;
  notes?: string;
  items?: PurchaseInvoiceItem[];
  paidAmount?: number;
  itemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseInvoice {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  total: number;
  totalUsd?: number;
  exchangeRate: number;
  status: 'pendiente' | 'pagada' | 'parcial';
  paymentMethod?: string;
  notes?: string;
  items?: PurchaseItem[];
  invoiceNumber?: string;
  paidAmount?: number;
  itemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  id: string;
  invoiceId: number;
  productId: number;
  productName: string;
  quantity: number;
  costUsd: number;
  costBs: number;
  totalUsd: number;
  totalBs: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  invoiceId: number;
  productId: number;
  productName: string;
  qty: number;
  quantity?: number;
  costUsd: number;
  costBs: number;
  totalUsd: number;
  totalBs: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPayment {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  amount: number;
  amountUsd?: number;
  exchangeRate: number;
  method: string;
  invoiceId?: number;
  reference?: string;
  bank?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountingEntry {
  id: string | number;
  date: string;
  type: 'ingreso' | 'egreso';
  category: string;
  subcategory?: string;
  concept: string;
  description?: string;
  amount: number;
  referenceId?: string | number;
  referenceType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KardexEntry {
  id: string;
  productId: number;
  date: string;
  type: 'venta' | 'compra' | 'ajuste' | 'consumo' | 'colaboracion' | 'devolucion';
  quantity: number;
  previousStock: number;
  newStock: number;
  costUsd?: number;
  costBs?: number;
  reference: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Page = 'pos' | 'products' | 'clients' | 'accounts' | 'admin' | 'terminal' | 'purchases' | 'reports' | 'caja' | 'dashboard' | 'inventario' | 'registrar_compra' | 'proveedores' | 'clientes' | 'cuentas' | 'contabilidad' | 'devoluciones';

export interface GlobalSettings {
  exchangeRate: number;
  defaultIvaPercentage: number;
  adminCode: string;
  terminalId?: string;
  updatedAt?: string;
}

// ✅ Category como objeto
export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCode {
  code: string;
  updatedAt?: string;
}

// ✅ EXPENSES - Categorías de gastos
export const EXPENSE_CATEGORIES = [
  { value: 'servicios', label: 'Servicios Públicos' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'proveedores', label: 'Pagos a Proveedores' },
  { value: 'publicidad', label: 'Publicidad y Marketing' },
  { value: 'transporte', label: 'Transporte y Logística' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'materiales', label: 'Materiales y Suministros' },
  { value: 'comunicaciones', label: 'Comunicaciones' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'consultoria', label: 'Consultoría' },
  { value: 'gastos_bancarios', label: 'Gastos Bancarios' },
  { value: 'otros', label: 'Otros Gastos' },
];

export interface Expense {
  id: string | number;
  date: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ✅ INCOME - Categorías de ingresos
export const INCOME_CATEGORIES = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'alquileres', label: 'Alquileres' },
  { value: 'intereses', label: 'Intereses' },
  { value: 'transferencias', label: 'Transferencias' },
  { value: 'otros', label: 'Otros Ingresos' },
];

export interface Income {
  id: string | number;
  date: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentMethod = 'efectivo_bs' | 'usd_efectivo' | 'tarjeta' | 'biopago' | 'pago_movil' | 'zelle' | 'transferencia' | 'cheque' | 'credito';

// ✅ Categorías predefinidas para productos
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'alimentos', name: 'Alimentos' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'licores', name: 'Licores' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'cigarrillos', name: 'Cigarrillos' },
  { id: 'higiene', name: 'Higiene Personal' },
  { id: 'limpieza', name: 'Limpieza' },
  { id: 'cuidado_personal', name: 'Cuidado Personal' },
  { id: 'otros', name: 'Otros' },
];

// ✅ Función helper para obtener Category desde string
export function getCategoryById(id: string): Category {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  return found || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
}

// ✅ Función helper para obtener string desde Category
export function getCategoryId(category: Category | string): string {
  if (typeof category === 'string') return category;
  return category.id;
}

// ✅ Función helper para obtener nombre de Category
export function getCategoryName(category: Category | string): string {
  if (typeof category === 'string') {
    const found = DEFAULT_CATEGORIES.find(c => c.id === category);
    return found ? found.name : category;
  }
  return category.name;
}
