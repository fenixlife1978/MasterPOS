export type Category = 'Whisky' | 'Ron' | 'Cerveza' | 'Vino' | 'Vodka' | 'Tequila' | 'Licor' | 'Gin' | 'Otro';

export interface Product {
  id: number;
  barcode: string;
  name: string;
  priceBs: number;
  priceUsd: number;
  stock: number;
  category: Category;
}

export interface Client {
  id: number;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  debt: number;
}

export interface CartItem {
  productId: number;
  name: string;
  priceBs: number;
  priceUsd: number;
  qty: number;
  category: Category;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'contado' | 'credito' | 'cobro_deuda' | 'devolucion';
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
  status: 'pendiente' | 'parcial' | 'pagada';
}

export interface CashRegister {
  isOpen: boolean;
  openTime: string;
  openAmount: number;
  txs: Transaction[];
  closeTime?: string;
}

export type Page = 'dashboard' | 'pos' | 'inventario' | 'clientes' | 'cuentas' | 'caja' | 'proveedores' | 'contabilidad' | 'devoluciones';

// ============================================
// Tipos para Terminales / Múltiples Cajas
// ============================================

export interface Terminal {
  id: number;
  name: string;
  description: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalUser {
  id: number;
  terminalId: number;
  userId: number;
  role: 'cashier' | 'supervisor';
  assignedAt: string;
}

export interface SystemUser {
  id: number;
  name: string;
  email: string;
  cedula: string;
  phone: string;
  role: 'admin' | 'cashier' | 'supervisor';
  status: 'active' | 'inactive';
  terminalId: number | null;
  createdAt: string;
}

// ============================================
// Tipos para Proveedores / Cuentas por Pagar
// ============================================

export interface Supplier {
  id: number;
  name: string;
  rif: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  totalDebt: number;
  createdAt: string;
}

export interface SupplierInvoice {
  id: number;
  supplierId: number;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  subtotal: number;
  iva: number;
  total: number;
  paidAmount: number;
  status: 'pendiente' | 'parcial' | 'pagada';
  notes: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: number;
  supplierId: number;
  invoiceId: number;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  bank?: string;
  notes: string;
}

// ============================================
// Tipos para Contabilidad / Libro Diario
// ============================================

export interface AccountingEntry {
  id: number;
  date: string;
  type: 'ingreso' | 'egreso';
  category: string;
  subcategory?: string;
  concept: string;
  description: string;
  amount: number;
  referenceId?: number; // ID de la transacción, factura o pago relacionado
  referenceType?: 'sale' | 'supplier_payment' | 'expense';
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  subcategories?: string[];
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'servicios_publicos', name: 'Pago de Servicios Públicos', subcategories: ['Agua', 'Aseo', 'Electricidad', 'Teléfono CANTV'] },
  { id: 'alquiler', name: 'Pago de Alquiler' },
  { id: 'telefonia', name: 'Pago de Telefonía', subcategories: ['Movistar', 'Movilnet', 'Digitel'] },
  { id: 'impuestos_municipales', name: 'Pago de Impuestos Municipales' },
  { id: 'declaracion_renta', name: 'Declaración de Renta' },
  { id: 'servicios_profesionales', name: 'Servicios Profesionales' },
  { id: 'reparacion_local', name: 'Reparación de Local' },
  { id: 'sueldos', name: 'Pago de Sueldos' },
  { id: 'otros', name: 'Otros Gastos' },
];
