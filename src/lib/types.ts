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
  type: 'contado' | 'credito' | 'cobro_deuda';
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

export type Page = 'pos' | 'inventario' | 'clientes' | 'cuentas' | 'caja';
