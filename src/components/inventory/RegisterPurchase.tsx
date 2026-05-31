import { useState, useMemo, useRef, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import { Search, Plus, Trash2, Package, Truck, Receipt, DollarSign, Loader2, Save, CalendarDays, HandCoins, X, PlusCircle, RefreshCw, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Product, SupplierInvoice, PurchaseInvoiceItem, Category, KitComponent, AccountingEntry } from '@/lib/types';
import { syncService } from '@/services/syncService';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface PurchaseItemTemp {
  productId: number;
  name: string;
  qty: number;
  costUsd: number;
}

type PaymentType = 'contado' | 'credito' | 'mixto';

// ✅ Redondeo a 2 decimales (comercial)
const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
// ✅ Redondeo a 4 decimales (para costos)
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

// ✅ Margen de ganancia por defecto
const DEFAULT_PROFIT_PERCENT = 30;

// ✅ Categorías por defecto (deben coincidir con las del sistema)
const DEFAULT_CATEGORIES: Category[] = ['Whisky', 'Ron', 'Cerveza', 'Vino', 'Vodka', 'Tequila', 'Licor', 'Gin', 'Otro'];
const DEFAULT_DEPARTMENTS = ['Polar', 'Munchy', 'Otros'];

// ✅ Función para obtener fecha local de Venezuela en formato YYYY-MM-DD (sin desfase horario)
function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RegisterPurchase() {
  const state = usePOSState();
  const { suppliers } = useSuppliers();
  
  // Datos de la factura
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [exchangeRate, setExchangeRate] = useState(state.exchangeRate.toFixed(2));
  
  // Items temporales
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemCostUsd, setItemCostUsd] = useState('');
  const [tempItems, setTempItems] = useState<PurchaseItemTemp[]>([]);
  
  // Estados para el tipo de pago
  const [paymentType, setPaymentType] = useState<PaymentType>('contado');
  const [paidUsd, setPaidUsd] = useState<number>(0);
  const [paidBs, setPaidBs] = useState<number>(0);
  const [creditTermDays, setCreditTermDays] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados para el modal de nuevo producto
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Estados para el formulario de producto (copiados de InventoryModule)
  const [productForm, setProductForm] = useState({
    barcode: '',
    name: '',
    department: 'Otros',
    category: 'Otro' as Category,
    stock: 0,
    minStock: 5,
    costUsd: 0,
    priceWholesale: 0,
    priceCost: 0,
  });
  const [costUsdInput, setCostUsdInput] = useState('');
  const [priceWholesaleInput, setPriceWholesaleInput] = useState('');
  const [priceCostInput, setPriceCostInput] = useState('');
  const [stockInput, setStockInput] = useState('');
  const [minStockInput, setMinStockInput] = useState('');
  const [profitPercentInput, setProfitPercentInput] = useState(DEFAULT_PROFIT_PERCENT.toString());
  const [priceRetailBs, setPriceRetailBs] = useState('');
  const [isPriceFixed, setIsPriceFixed] = useState(false);
  const [isUpdatingFromProfit, setIsUpdatingFromProfit] = useState(false);
  const [isUpdatingFromPriceBs, setIsUpdatingFromPriceBs] = useState(false);
  const [ivaType, setIvaType] = useState<'con_iva' | 'sin_iva'>('con_iva');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  const [isKit, setIsKit] = useState(false);
  const [kitHasOwnStock, setKitHasOwnStock] = useState(false);
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [searchChildProduct, setSearchChildProduct] = useState('');
  const [selectedChildProduct, setSelectedChildProduct] = useState<Product | null>(null);
  const [childQuantity, setChildQuantity] = useState('1');
  const [hideChildResults, setHideChildResults] = useState(false);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  // Actualizar tasa cuando cambie en el sistema
  useEffect(() => {
    setExchangeRate(state.exchangeRate.toFixed(2));
  }, [state.exchangeRate]);

  // Cargar categorías y departamentos desde settings al iniciar
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await syncService.getGlobalSettings();
      if (settings) {
        if (settings.categories) setCategories(settings.categories as Category[]);
        if (settings.departments) setDepartments(settings.departments);
      }
    };
    loadSettings();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        // no hacer nada, solo mantener el dropdown
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Funciones de arrastre para el modal
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    setIsDragging(true);
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !modalRef.current) return;
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      setModalPosition({ x: newX, y: newY });
      modalRef.current.style.left = `${newX}px`;
      modalRef.current.style.top = `${newY}px`;
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const productResults = useMemo(() => {
    if (!productQuery.trim()) return [];
    if (selectedProduct) return [];
    const q = productQuery.toLowerCase();
    return state.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.barcode.includes(q)
    ).slice(0, 5);
  }, [productQuery, state.products, selectedProduct]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductQuery(product.name);
    setItemCostUsd(product.costUsd?.toFixed(4) || '');
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setProductQuery('');
    setItemCostUsd('');
    setItemQty('1');
  };

  const handleAddTempItem = () => {
    if (!selectedProduct) return;
    const qty = parseInt(itemQty);
    const cost = parseFloat(itemCostUsd);

    if (isNaN(qty) || qty <= 0) return alert('Cantidad no válida');
    if (isNaN(cost) || cost <= 0) return alert('Costo no válido');

    setTempItems(prev => [
      ...prev,
      {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        qty,
        costUsd: roundTo4(cost)
      }
    ]);

    handleClearSelection();
  };

  const handleRemoveTempItem = (index: number) => {
    setTempItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalInvoiceUsd = parseFloat(tempItems.reduce((sum, item) => sum + (item.qty * item.costUsd), 0).toFixed(4));
  const rateNum = parseFloat(parseFloat(exchangeRate).toFixed(2)) || state.exchangeRate;
  const totalInvoiceBs = roundTo2(totalInvoiceUsd * rateNum);

  const handlePaidUsdChange = (value: number) => {
    const roundedUsd = roundTo2(value);
    setPaidUsd(roundedUsd);
    if (paymentType === 'mixto') {
      const roundedBs = roundTo2(roundedUsd * rateNum);
      setPaidBs(roundedBs);
    }
  };

  const handlePaidBsChange = (value: number) => {
    const roundedBs = roundTo2(value);
    setPaidBs(roundedBs);
    if (paymentType === 'mixto') {
      const roundedUsd = roundTo2(roundedBs / rateNum);
      setPaidUsd(roundedUsd);
    }
  };

  const totalPaidUsd = paymentType === 'contado' ? totalInvoiceUsd : (paymentType === 'credito' ? 0 : paidUsd);
  const totalPaidBs = roundTo2(totalPaidUsd * rateNum);
  const remainingUsd = parseFloat(Math.max(0, totalInvoiceUsd - totalPaidUsd).toFixed(4));
  const remainingBs = roundTo2(remainingUsd * rateNum);

  const invoiceStatus = () => {
    if (paymentType === 'contado') return 'pagada';
    if (paymentType === 'credito') return 'pendiente';
    if (remainingUsd <= 0) return 'pagada';
    if (totalPaidUsd > 0 && remainingUsd > 0) return 'parcial';
    return 'pendiente';
  };

  const handleProcessPurchase = async () => {
    if (!selectedSupplierId) return alert('Seleccione un proveedor');
    if (!invoiceNumber) return alert('Ingrese el número de factura');
    if (tempItems.length === 0) return alert('No hay productos en la lista');

    setIsProcessing(true);
    
    try {
      const subtotal = totalInvoiceUsd / 1.16;
      const iva = totalInvoiceUsd - subtotal;
      const timestamp = new Date().toISOString();
      const invoiceId = Date.now();
      
      const paymentNotes = `Tipo de pago: ${paymentType === 'contado' ? 'Contado' : paymentType === 'credito' ? `Crédito a ${creditTermDays} días` : `Mixto (USD: ${formatUsdNumber(paidUsd)} / Bs: ${formatBsNumber(paidBs)})`}. Saldo pendiente: ${formatUsd(remainingUsd, 4)}`;
      
      const newInvoice: SupplierInvoice = {
        id: invoiceId,
        supplierId: parseInt(selectedSupplierId),
        invoiceNumber: invoiceNumber,
        date: timestamp,
        dueDate: paymentType === 'credito' 
          ? new Date(Date.now() + creditTermDays * 24 * 60 * 60 * 1000).toISOString()
          : timestamp,
        subtotal: parseFloat(subtotal.toFixed(4)),
        iva: parseFloat(iva.toFixed(4)),
        total: totalInvoiceUsd,
        paidAmount: totalPaidUsd,
        status: invoiceStatus(),
        notes: paymentNotes,
        exchangeRate: rateNum,
        itemsCount: tempItems.length,
        createdAt: timestamp,
      };
      
      await syncService.savePurchaseInvoice(newInvoice);
      
      const items: PurchaseInvoiceItem[] = tempItems.map((item, idx) => ({
        id: `${invoiceId}_${idx}`,
        invoiceId: invoiceId,
        productId: item.productId,
        productName: item.name,
        qty: item.qty,
        costUsd: item.costUsd,
        totalUsd: parseFloat((item.qty * item.costUsd).toFixed(4)),
        createdAt: timestamp
      }));
      
      await syncService.savePurchaseInvoiceItems(invoiceId, items);
      
      for (const item of tempItems) {
        await syncService.updateProductWithWeightedAverageCost(
          item.productId,
          item.qty,
          item.costUsd,
          rateNum
        );
      }
      
      const supplier = suppliers.find(s => s.id === parseInt(selectedSupplierId));
      if (supplier && remainingUsd > 0) {
        await syncService.saveSupplier({
          ...supplier,
          totalDebt: parseFloat(((supplier.totalDebt || 0) + remainingUsd).toFixed(2))
        });
      }
      
      // ✅ Crear entrada contable SOLO para la parte pagada de contado (NO para crédito)
      if (paymentType !== 'credito') {
        const paidAmountBs = totalPaidUsd * rateNum; // Monto en Bs pagado de contado
        const localDate = getLocalDate(); // Fecha local sin desfase
        
        const accountingEntry: AccountingEntry = {
          id: Date.now(),
          date: localDate,
          type: 'egreso',
          category: 'compra_mercancia',
          subcategory: 'compra',
          concept: `Compra de mercancía - Factura ${invoiceNumber} (Pago contado)`,
          description: `Proveedor: ${supplier?.name || 'N/A'} | Total factura: ${formatUsd(totalInvoiceUsd)} | Pagado: ${formatUsd(totalPaidUsd)}`,
          amount: paidAmountBs,
          referenceId: invoiceId,
          referenceType: 'purchase',
          createdAt: timestamp,
        };
        await syncService.saveAccountingEntry(accountingEntry);
      }
      
      await state.refreshProducts?.();
      
      alert(`✅ Compra registrada exitosamente\nEstado: ${invoiceStatus()}\nTotal: ${formatUsd(totalInvoiceUsd, 4)}\nPagado: ${formatUsd(totalPaidUsd)}\nSaldo: ${formatUsd(remainingUsd, 4)}`);
      setTempItems([]);
      setInvoiceNumber('');
      setSelectedSupplierId('');
      setPaidUsd(0);
      setPaidBs(0);
      setPaymentType('contado');
      
    } catch (error) {
      console.error('Error al registrar compra:', error);
      alert('❌ Error al registrar la compra');
    }
    
    setIsProcessing(false);
  };

  // ==================== Funciones para el formulario de producto ====================
  const calculatePriceUsdFromCostAndProfit = (cost: number, profitPercent: number): number => {
    if (cost <= 0) return 0;
    const marginDecimal = profitPercent / 100;
    const priceUsd = cost / (1 - marginDecimal);
    return roundTo2(priceUsd);
  };

  const calculateProfitFromCostAndPriceUsd = (cost: number, priceUsd: number): number => {
    if (cost <= 0 || priceUsd <= 0) return DEFAULT_PROFIT_PERCENT;
    const profitPercent = (1 - (cost / priceUsd)) * 100;
    return Math.min(roundTo2(profitPercent), 99.99);
  };

  const updatePricesFromProfit = (profitPercent: number, currentCost: number) => {
    if (isUpdatingFromPriceBs) return;
    setIsUpdatingFromProfit(true);
    const priceUsd = calculatePriceUsdFromCostAndProfit(currentCost, profitPercent);
    const priceBs = priceUsd * state.exchangeRate;
    setPriceRetailBs(roundTo2(priceBs).toFixed(2));
    setIsPriceFixed(false);
    setIsUpdatingFromProfit(false);
  };

  const updateProfitFromPriceBs = (priceBsValue: number, currentCost: number) => {
    if (isUpdatingFromProfit) return;
    setIsUpdatingFromPriceBs(true);
    const priceUsd = priceBsValue / state.exchangeRate;
    const newProfitPercent = calculateProfitFromCostAndPriceUsd(currentCost, priceUsd);
    setProfitPercentInput(roundTo2(newProfitPercent).toString());
    setIsPriceFixed(true);
    setIsUpdatingFromPriceBs(false);
  };

  const childProductResults = useMemo(() => {
    if (!searchChildProduct.trim() || hideChildResults) return [];
    const q = searchChildProduct.toLowerCase();
    return state.products.filter(p => 
      p.name.toLowerCase().includes(q) || p.barcode.includes(q)
    ).slice(0, 5);
  }, [searchChildProduct, state.products, hideChildResults]);

  const addKitComponent = () => {
    if (!selectedChildProduct) return;
    const qty = parseInt(childQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Cantidad no válida');
      return;
    }
    if (kitComponents.some(c => c.productId === selectedChildProduct.id)) {
      alert('El producto ya está en la lista');
      return;
    }
    setKitComponents(prev => [...prev, { productId: selectedChildProduct.id, quantity: qty }]);
    setSelectedChildProduct(null);
    setSearchChildProduct('');
    setChildQuantity('1');
    setHideChildResults(false);
  };

  const removeKitComponent = (productId: number) => {
    setKitComponents(prev => prev.filter(c => c.productId !== productId));
  };

  const resetProductForm = () => {
    setProductForm({
      barcode: '',
      name: '',
      department: 'Otros',
      category: 'Otro',
      stock: 0,
      minStock: 5,
      costUsd: 0,
      priceWholesale: 0,
      priceCost: 0,
    });
    setCostUsdInput('');
    setPriceWholesaleInput('');
    setPriceCostInput('');
    setStockInput('');
    setMinStockInput('');
    setProfitPercentInput(DEFAULT_PROFIT_PERCENT.toString());
    setIvaType('con_iva');
    setIvaPercentage(16);
    setIsKit(false);
    setKitHasOwnStock(false);
    setKitComponents([]);
    setSearchChildProduct('');
    setSelectedChildProduct(null);
    setChildQuantity('1');
    setHideChildResults(false);
    setPriceRetailBs('');
    setIsPriceFixed(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(costUsdInput) || 0;
    const profitPercent = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
    
    let finalPriceUsd, finalPriceBs;
    if (isPriceFixed && priceRetailBs !== '' && priceRetailBs !== 'NaN') {
      finalPriceBs = parseFloat(priceRetailBs) || 0;
      finalPriceUsd = finalPriceBs / state.exchangeRate;
    } else {
      finalPriceUsd = calculatePriceUsdFromCostAndProfit(cost, profitPercent);
      finalPriceBs = finalPriceUsd * state.exchangeRate;
    }
    
    const productData: Product = {
      id: Date.now(),
      barcode: productForm.barcode,
      name: productForm.name,
      department: productForm.department,
      category: productForm.category,
      stock: parseInt(stockInput) || 0,
      minStock: parseInt(minStockInput) || 5,
      costUsd: roundTo4(cost),
      costBs: roundTo2(cost * state.exchangeRate),
      profitPercent: profitPercent,
      priceUsd: finalPriceUsd,
      priceBs: roundTo2(finalPriceBs),
      priceRetail: finalPriceUsd,
      priceWholesale: roundTo2(parseFloat(priceWholesaleInput) || 0),
      priceCost: roundTo2(parseFloat(priceCostInput) || 0),
      ivaType: ivaType,
      ivaPercentage: ivaType === 'con_iva' ? ivaPercentage : undefined,
      isKit: isKit,
      kitHasOwnStock: isKit ? kitHasOwnStock : undefined,
      kitComponents: isKit && kitComponents.length > 0 ? kitComponents : undefined,
    };
    
    setIsSubmittingProduct(true);
    try {
      await syncService.saveProduct(productData);
      // Crear entrada de kardex inicial
      const kardexEntry = {
        id: `${Date.now()}_${Math.random()}`,
        productId: productData.id,
        date: new Date().toLocaleString('es-VE'),
        type: 'ajuste_inicial',
        quantity: productData.stock,
        previousStock: 0,
        newStock: productData.stock,
        reference: 'Creación de producto',
        note: 'Stock inicial',
        costUsd: productData.costUsd,
      };
      await syncService.saveKardexEntry?.(kardexEntry);
      await state.refreshProducts?.();
      alert(`✅ Producto "${productData.name}" creado exitosamente`);
      setShowProductModal(false);
      resetProductForm();
    } catch (error) {
      console.error('Error al crear producto:', error);
      alert('❌ Error al crear el producto');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  return (
    <div className="h-full w-full overflow-hidden p-6 bg-background">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-headline font-black text-black flex items-center gap-2">
              <Truck size={24} className="text-primary" /> Registrar Entrada por Compra
            </h2>
            <p className="text-xs text-black/50">Módulo de gestión de ingresos masivos</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Columna izquierda */}
            <div className="lg:col-span-1 space-y-4">
              {/* Datos de la factura */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <Receipt size={13} /> Datos de la Factura
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-black/40">Proveedor</label>
                    <select 
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full h-8 border border-[#9E9E9E] rounded-lg px-2 text-sm font-bold bg-white"
                    >
                      <option value="">Seleccionar Proveedor...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.rif})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-black/40">N° Factura</label>
                    <Input 
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Ej: 000123"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-black/40">Tasa BCV Aplicada (Bs/$)</label>
                    <div className="relative">
                      <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black/30" />
                      <Input 
                        type="number"
                        step="0.01"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        className="pl-7 h-8 text-sm font-mono"
                      />
                    </div>
                    <p className="text-[8px] text-black/40 mt-1">
                      Tasa actual del sistema: {formatBs(state.exchangeRate)} — Puede modificarla según la factura
                    </p>
                  </div>
                </div>
              </div>

              {/* Condiciones de pago */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <HandCoins size={13} /> Condiciones de Pago
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('contado');
                        setPaidUsd(totalInvoiceUsd);
                        setPaidBs(roundTo2(totalInvoiceUsd * rateNum));
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded border transition-all",
                        paymentType === 'contado' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      CONTADO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('credito');
                        setPaidUsd(0);
                        setPaidBs(0);
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded border transition-all",
                        paymentType === 'credito' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      CRÉDITO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('mixto');
                        setPaidUsd(0);
                        setPaidBs(0);
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded border transition-all",
                        paymentType === 'mixto' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      MIXTO
                    </button>
                  </div>

                  {paymentType === 'credito' && (
                    <div className="flex items-center gap-2">
                      <CalendarDays size={12} className="text-black/40" />
                      <Input
                        type="number"
                        value={creditTermDays}
                        onChange={(e) => setCreditTermDays(Number(e.target.value))}
                        className="h-7 text-xs w-20 text-center"
                      />
                      <span className="text-[9px] text-black/60">días de plazo</span>
                    </div>
                  )}

                  {paymentType === 'mixto' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[8px] font-bold uppercase text-black/40">Pago en USD</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paidUsd}
                          onChange={(e) => handlePaidUsdChange(Number(e.target.value))}
                          className="h-7 text-xs"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold uppercase text-black/40">Pago en Bs</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paidBs}
                          onChange={(e) => handlePaidBsChange(Number(e.target.value))}
                          className="h-7 text-xs"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 p-2 rounded-md mt-2">
                    <div className="flex justify-between text-[9px]">
                      <span>Total factura USD:</span>
                      <span className="font-bold">{formatUsd(totalInvoiceUsd, 4)}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span>Total pagado USD:</span>
                      <span className="font-bold text-green-600">{formatUsd(totalPaidUsd)}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold">
                      <span>Saldo pendiente USD:</span>
                      <span className={remainingUsd > 0 ? "text-red-600" : "text-green-600"}>{formatUsd(remainingUsd, 4)}</span>
                    </div>
                    {paymentType === 'credito' && (
                      <div className="text-[8px] text-amber-600 mt-1 text-center">
                        Plazo de crédito: {creditTermDays} días
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Añadir productos */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <Package size={13} /> Añadir Productos al Lote
                </h3>
                <div className="space-y-3">
                  <div className="relative" ref={searchRef}>
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black/30" />
                    <Input 
                      placeholder="Buscar producto..."
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-transparent hover:bg-primary/20 text-primary"
                      title="Crear nuevo producto"
                    >
                      <PlusCircle size={14} />
                    </Button>
                    {productResults.length > 0 && !selectedProduct && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-[#9E9E9E] rounded-lg shadow-lg z-20 mt-1 overflow-hidden">
                        {productResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            className="w-full text-left p-2 hover:bg-primary/10 transition-colors border-b border-gray-100 last:border-0 text-xs"
                          >
                            <p className="font-bold">{p.name}</p>
                            <p className="text-[9px] text-black/40">Stock: {p.stock} | Costo: {formatUsd(p.costUsd || 0, 4)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedProduct && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 relative">
                      <button
                        onClick={handleClearSelection}
                        className="absolute top-2 right-2 text-black/40 hover:text-red-500"
                        title="Limpiar selección"
                      >
                        <X size={14} />
                      </button>
                      <p className="text-[9px] font-black text-primary uppercase mb-1">Producto: {selectedProduct.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-bold text-black/50 uppercase">Cant. Entrante</label>
                          <Input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="h-7 text-sm" />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-black/50 uppercase">Costo USD (Unit)</label>
                          <Input type="number" step="0.0001" value={itemCostUsd} onChange={(e) => setItemCostUsd(e.target.value)} className="h-7 text-sm font-mono" placeholder="0.0000" />
                        </div>
                      </div>
                      <Button onClick={handleAddTempItem} className="w-full mt-2 bg-primary text-black font-black h-7 text-xs">
                        <Plus size={12} className="mr-1" /> AGREGAR A LISTA
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha: tabla de items */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="bg-white border border-[#9E9E9E] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-[#1A2C4E] p-3 text-white flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider">Detalle del Ingreso ({tempItems.length} items)</h3>
                  <div className="text-right">
                    <p className="text-[9px] text-white/60">Total Factura USD</p>
                    <p className="text-lg font-black text-primary">{formatUsd(totalInvoiceUsd, 4)}</p>
                  </div>
                </div>
                
                <div className="max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase">Producto</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-center w-16">Cant.</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right w-20">Costo $</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right w-24">Subtotal $</TableHead>
                        <TableHead className="text-center w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tempItems.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-black/30 italic text-xs">Añada productos para comenzar</TableCell></TableRow>
                      ) : (
                        tempItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold text-xs">{item.name}</TableCell>
                            <TableCell className="text-center text-xs">{item.qty}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatUsd(item.costUsd, 4)}</TableCell>
                            <TableCell className="text-right font-black text-xs">{formatUsd(item.qty * item.costUsd, 4)}</TableCell>
                            <TableCell><button onClick={() => handleRemoveTempItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-[#F5F5F5] p-3 border-t flex justify-between items-center">
                  <div className="flex gap-3">
                    <div className="bg-white border border-gray-300 rounded px-2 py-1">
                      <span className="text-[8px] block text-gray-500 uppercase">Total en Bolívares</span>
                      <span className="text-xs font-black text-secondary">{formatBs(totalInvoiceBs)}</span>
                    </div>
                    <div className="bg-white border border-gray-300 rounded px-2 py-1">
                      <span className="text-[8px] block text-gray-500 uppercase">Total USD</span>
                      <span className="text-xs font-black text-secondary">{formatUsd(totalInvoiceUsd, 4)}</span>
                    </div>
                    {paymentType !== 'contado' && remainingUsd > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                        <span className="text-[8px] block text-yellow-700 uppercase">Crédito pendiente</span>
                        <span className="text-xs font-black text-yellow-800">{formatUsd(remainingUsd, 4)}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    disabled={isProcessing || tempItems.length === 0}
                    onClick={handleProcessPurchase}
                    className="bg-primary hover:brightness-110 text-black font-black px-6 h-8 text-xs"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} className="mr-1" /> PROCESAR COMPRA</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal arrastrable para crear nuevo producto */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowProductModal(false)}>
          <div
            ref={modalRef}
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]"
            style={{ position: 'absolute', left: modalPosition.x || 'auto', top: modalPosition.y || 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header arrastrable */}
            <div
              ref={dragHandleRef}
              onMouseDown={handleMouseDown}
              className="bg-[#1A2C4E] p-3 text-white rounded-t-xl cursor-move flex justify-between items-center flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <h3 className="text-sm font-black">Nuevo Producto</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Formulario de producto */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Columna izquierda */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[8px] font-black uppercase">Código de Barras</label>
                    <Input 
                      value={productForm.barcode} 
                      onChange={e => setProductForm({...productForm, barcode: e.target.value})} 
                      className="h-7 text-xs" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Nombre del Producto</label>
                    <Input 
                      value={productForm.name} 
                      onChange={e => setProductForm({...productForm, name: e.target.value})} 
                      className="h-7 text-xs" 
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-black uppercase">Departamento</label>
                      <select 
                        value={productForm.department} 
                        onChange={e => setProductForm({...productForm, department: e.target.value})} 
                        className="w-full h-7 border rounded px-2 text-xs bg-white"
                      >
                        {departments.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase">Categoría</label>
                      <select 
                        value={productForm.category} 
                        onChange={e => setProductForm({...productForm, category: e.target.value as Category})} 
                        className="w-full h-7 border rounded px-2 text-xs bg-white"
                      >
                        {categories.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-black uppercase">Stock Inicial</label>
                      <Input 
                        type="text"
                        inputMode="numeric"
                        value={stockInput}
                        onChange={(e) => setStockInput(e.target.value)}
                        className="h-7 text-xs" 
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase">Stock Mínimo</label>
                      <Input 
                        type="text"
                        inputMode="numeric"
                        value={minStockInput}
                        onChange={(e) => setMinStockInput(e.target.value)}
                        className="h-7 text-xs" 
                        placeholder="5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-black uppercase">Precio Mayor (USD)</label>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        value={priceWholesaleInput}
                        onChange={(e) => setPriceWholesaleInput(e.target.value)}
                        className="h-7 text-xs" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase">Precio Costo (USD)</label>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        value={priceCostInput}
                        onChange={(e) => setPriceCostInput(e.target.value)}
                        className="h-7 text-xs" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="border-t pt-2 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isKit} 
                        onChange={e => setIsKit(e.target.checked)} 
                        className="rounded text-primary" 
                      />
                      <span className="text-[9px] font-black uppercase">Es kit / compuesto</span>
                    </label>
                    <p className="text-[7px] text-black/40 mt-1">Al vender este producto, se descontarán las cantidades de sus componentes.</p>
                  </div>
                  
                  {isKit && (
                    <div className="border border-dashed border-blue-300 rounded-lg p-2 bg-blue-50/30 space-y-2">
                      <div className="flex items-center justify-between bg-white/50 rounded p-1.5">
                        <span className="text-[8px] font-bold uppercase">Stock del kit:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setKitHasOwnStock(false)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                              !kitHasOwnStock ? "bg-primary text-black" : "bg-gray-200 text-gray-600"
                            )}
                          >
                            Sin stock propio
                          </button>
                          <button
                            type="button"
                            onClick={() => setKitHasOwnStock(true)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                              kitHasOwnStock ? "bg-primary text-black" : "bg-gray-200 text-gray-600"
                            )}
                          >
                            Con stock propio
                          </button>
                        </div>
                      </div>
                      <p className="text-[7px] text-blue-700 bg-blue-100 rounded px-2 py-1">
                        {!kitHasOwnStock 
                          ? "📦 Sin stock propio: El kit siempre se puede vender si hay suficiente stock de sus componentes. Al vender, SOLO se descuentan los componentes."
                          : "⚠️ Con stock propio: El kit tiene su propio inventario. Al vender, se descuenta 1 del kit + las cantidades de sus componentes."
                        }
                      </p>
                      <p className="text-[8px] font-bold text-blue-800 mb-1 flex items-center gap-1"><Package size={10} /> Componentes del kit</p>
                      <div className="space-y-2">
                        {kitComponents.length > 0 && (
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {kitComponents.map(comp => {
                              const childProd = state.products.find(p => p.id === comp.productId);
                              return <div key={comp.productId} className="flex justify-between items-center bg-white rounded px-2 py-1 text-[10px]"><span>{childProd?.name || 'Producto'} x{comp.quantity}</span><button type="button" onClick={() => removeKitComponent(comp.productId)} className="text-red-500"><Trash2 size={10} /></button></div>;
                            })}
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="relative">
                            <Input 
                              type="text"
                              placeholder="Buscar producto componente..."
                              value={searchChildProduct}
                              onChange={(e) => {
                                setSearchChildProduct(e.target.value);
                                setHideChildResults(false);
                                if (selectedChildProduct && e.target.value !== selectedChildProduct.name) {
                                  setSelectedChildProduct(null);
                                }
                              }}
                              className="h-7 text-xs pr-7"
                            />
                            {!hideChildResults && searchChildProduct && childProductResults.length > 0 && (
                              <div className="absolute top-full left-0 right-0 bg-white border rounded shadow z-20 mt-1 max-h-24 overflow-y-auto">
                                {childProductResults.map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedChildProduct(p);
                                      setSearchChildProduct(p.name);
                                      setHideChildResults(true);
                                    }}
                                    className="w-full text-left px-2 py-1 text-[10px] hover:bg-primary/10"
                                  >
                                    {p.name} ({formatUsd(p.priceUsd)})
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {selectedChildProduct && (
                            <div className="flex gap-1 items-center">
                              <Input type="text" inputMode="numeric" value={childQuantity} onChange={e => setChildQuantity(e.target.value)} className="h-7 text-xs w-20 text-center" placeholder="Cant." />
                              <Button type="button" onClick={addKitComponent} size="sm" className="h-7 text-[9px] bg-primary text-black">Agregar</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Columna derecha: costos y precios */}
                <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
                  <div className="w-3/4">
                    <label className="text-[7px] font-bold uppercase">Costo Unitario USD</label>
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      value={costUsdInput} 
                      onChange={(e) => {
                        setCostUsdInput(e.target.value);
                        const costVal = parseFloat(e.target.value) || 0;
                        const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
                        if (!isUpdatingFromPriceBs) {
                          const newPriceUsd = calculatePriceUsdFromCostAndProfit(costVal, profitVal);
                          const newPriceBs = newPriceUsd * state.exchangeRate;
                          setPriceRetailBs(roundTo2(newPriceBs).toFixed(2));
                          setIsPriceFixed(false);
                        }
                      }} 
                      className="bg-white h-7 text-xs font-mono" 
                      placeholder="0.0000" 
                    />
                  </div>
                  
                  <div>
                    <label className="text-[7px] font-bold uppercase">% de Ganancia</label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="text" 
                        inputMode="decimal" 
                        value={profitPercentInput} 
                        onChange={(e) => {
                          const newProfit = parseFloat(e.target.value) || 0;
                          setProfitPercentInput(e.target.value);
                          const costVal = parseFloat(costUsdInput) || 0;
                          if (!isUpdatingFromPriceBs) {
                            const newPriceUsd = calculatePriceUsdFromCostAndProfit(costVal, newProfit);
                            const newPriceBs = newPriceUsd * state.exchangeRate;
                            setPriceRetailBs(roundTo2(newPriceBs).toFixed(2));
                            setIsPriceFixed(false);
                          }
                        }}
                        className="bg-white h-7 text-xs font-mono w-24 text-right"
                        placeholder="0"
                      />
                      <span className="text-[9px] text-black/60">%</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[7px] font-bold uppercase">Precio Detal USD</label>
                      <Input 
                        type="text" 
                        inputMode="decimal" 
                        value={(() => {
                          const costVal = parseFloat(costUsdInput) || 0;
                          const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
                          const priceUsd = calculatePriceUsdFromCostAndProfit(costVal, profitVal);
                          return priceUsd.toFixed(2);
                        })()}
                        className="bg-white h-7 text-xs font-mono"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="text-[7px] font-bold uppercase">Precio Detal Bs (final)</label>
                      <Input 
                        type="text" 
                        inputMode="decimal" 
                        value={priceRetailBs === 'NaN' || isNaN(parseFloat(priceRetailBs)) ? '' : priceRetailBs}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setPriceRetailBs(newValue);
                          setIsPriceFixed(true);
                          const bsValue = parseFloat(newValue) || 0;
                          const costVal = parseFloat(costUsdInput) || 0;
                          if (bsValue > 0 && costVal > 0) {
                            const priceUsd = bsValue / state.exchangeRate;
                            const newProfitPercent = calculateProfitFromCostAndPriceUsd(costVal, priceUsd);
                            setProfitPercentInput(roundTo2(newProfitPercent).toString());
                          }
                        }}
                        className="bg-white h-7 text-xs font-mono w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        const costVal = parseFloat(costUsdInput) || 0;
                        const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
                        const priceUsd = calculatePriceUsdFromCostAndProfit(costVal, profitVal);
                        const calculatedBs = priceUsd * state.exchangeRate;
                        setPriceRetailBs(roundTo2(calculatedBs).toFixed(2));
                        setIsPriceFixed(false);
                      }}
                      className="h-7 text-[9px] px-3 bg-primary text-black font-bold"
                    >
                      <RefreshCw size={12} className="mr-1" />
                      Sincronizar
                    </Button>
                  </div>
                  
                  <div className="border-t pt-2 mt-1">
                    <label className="text-[7px] font-bold uppercase text-black/60 block mb-1">Configuración de IVA</label>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setIvaType('con_iva')}
                        className={cn(
                          "flex-1 py-1 text-[9px] font-bold rounded border transition-all",
                          ivaType === 'con_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                        )}
                      >
                        Con I.V.A.
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIvaType('sin_iva')}
                        className={cn(
                          "flex-1 py-1 text-[9px] font-bold rounded border transition-all",
                          ivaType === 'sin_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                        )}
                      >
                        Sin I.V.A.
                      </button>
                    </div>
                    {ivaType === 'con_iva' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Percent size={10} className="text-black/40" />
                        <Input 
                          type="text"
                          inputMode="decimal"
                          value={isNaN(ivaPercentage) ? '' : ivaPercentage}
                          onChange={(e) => setIvaPercentage(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="h-6 text-[9px] w-20 text-center"
                        />
                        <span className="text-[8px] text-black/60">% de I.V.A.</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-white rounded p-1.5 border mt-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-black/60">Precio Base USD (sin IVA):</span>
                      <span className="font-black text-secondary">
                        {formatUsd((() => {
                          const costVal = parseFloat(costUsdInput) || 0;
                          const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
                          return calculatePriceUsdFromCostAndProfit(costVal, profitVal);
                        })())}
                      </span>
                    </div>
                    {ivaType === 'con_iva' && (
                      <div className="flex justify-between text-[9px]">
                        <span className="text-black/60">+ IVA ({isNaN(ivaPercentage) ? 0 : ivaPercentage}%):</span>
                        <span className="text-black/70">
                          {formatUsd((() => {
                            const costVal = parseFloat(costUsdInput) || 0;
                            const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
                            const priceUsd = calculatePriceUsdFromCostAndProfit(costVal, profitVal);
                            return priceUsd * (isNaN(ivaPercentage) ? 0 : ivaPercentage) / 100;
                          })())}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] pt-1 border-t mt-1">
                      <span className="text-black/60">Precio Mayor USD:</span>
                      <span className="font-black text-secondary">{formatUsd(parseFloat(priceWholesaleInput) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-black/60">Precio Costo USD:</span>
                      <span className="font-black text-secondary">{formatUsd(parseFloat(priceCostInput) || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#F5F5F5] p-3 border-t flex justify-end gap-2 mt-4">
                <Button type="submit" disabled={isSubmittingProduct} className="bg-primary text-black font-black px-6 h-8 text-xs">
                  {isSubmittingProduct ? <Loader2 size={14} className="animate-spin" /> : 'GUARDAR PRODUCTO'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}