export type Category = 'Whisky' | 'Ron' | 'Cerveza' | 'Vino' | 'Vodka' | 'Tequila' | 'Licor' | 'Gin' | 'Otro';

// ✅ Nueva interfaz para componentes de kit
export interface KitComponent {
  productId: number;
  quantity: number;
}

export interface Product {
  id: number;
  barcode: string;
  name: string;
  priceBs: number;
  priceUsd: number;
  stock: number;
  category: Category;
  minStock?: number;
  costBs?: number;
  costUsd?: number;
  profitPercent?: number;
  department?: string;
  priceRetail?: number;
  priceWholesale?: number;
  priceCost?: number;
  ivaType?: 'con_iva' | 'sin_iva';
  ivaPercentage?: number;
  // ✅ Nuevos campos para kits/combos
  isKit?: boolean;
  kitComponents?: KitComponent[];
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
  ivaType?: 'con_iva' | 'sin_iva';
  ivaPercentage?: number;
  // ✅ Opcional: para poder expandir el kit en el ticket si se desea, pero no necesario
  isKit?: boolean;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'contado' | 'credito' | 'cobro_deuda' | 'devolucion' | 'colaboracion' | 'consumo_propio';
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
  exchangeRate?: number;
  receiptNumber?: number; // ✅ Numero correlativo para el recibo (00000001...)
  // ✅ Nuevos campos para colaboraciones y consumo propio
  costoTotalOperacion?: number;
  notes?: string;
  authorizedBy?: string;
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
  exchangeRate?: number;
}

export interface CashRegister {
  isOpen: boolean;
  openTime: string;
  openAmount: number;
  openAmountBs: number;
  openAmountUsd: number;
  txs: Transaction[];
  exchangeRate: number;
}

export type Page = 'dashboard' | 'pos' | 'inventario' | 'clientes' | 'cuentas' | 'caja' | 'proveedores' | 'contabilidad' | 'devoluciones' | 'registrar_compra';

export interface KardexEntry {
  id?: string;
  productId: number;
  date: string;
  type: 'entrada_compra' | 'salida_venta' | 'ajuste_positivo' | 'ajuste_negativo' | 'devolucion' | 'ajuste_inicial' | 'ajuste_manual';
  reference: string;
  qty?: number;
  quantity: number;
  previousStock: number;
  newStock: number;
  note?: string;
  costUsd?: number;
  costBs?: number;
  stockAfter?: number;
}

export interface Terminal {
  id: number;
  name: string;
  description: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  exchangeRate: number;
  itemsCount: number;
  createdAt: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  invoiceId: number;
  productId: number;
  productName: string;
  qty: number;
  costUsd: number;
  totalUsd: number;
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

export interface AccountingEntry {
  id: number;
  date: string;
  type: 'ingreso' | 'egreso';
  category: string;
  subcategory?: string;
  concept: string;
  description: string;
  amount: number;
  referenceId?: number;
  referenceType?: 'sale' | 'supplier_payment' | 'expense' | 'return' | 'payment_reversal' | 'credit_sale' | 'debt_payment' | 'colaboracion' | 'consumo_propio';
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  subcategories?: string[];
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'ventas', name: 'Ventas' },
  { id: 'pagos_proveedores', name: 'Pagos a Proveedores' },
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

export interface AdminCode {
  id: string;
  code: string;
  updatedAt: string;
}

export interface GlobalSettings {
  id: string;
  defaultIvaPercentage: number;
  exchangeRate?: number;
  categories?: string[];
  departments?: string[];
  updatedAt: string;
}