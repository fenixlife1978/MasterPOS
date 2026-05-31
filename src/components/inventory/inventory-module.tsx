"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Plus, Search, Pencil, Trash2, X, 
  Tag, Settings, History, RefreshCw, Save,
  FileText, Share2, Printer, Percent, AlertTriangle,
  DollarSign, Package, Layers, Boxes, PlusCircle,
  FileSpreadsheet, TrendingUp, Calculator, Info, Calendar
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product, Category, AdminCode, KitComponent, AccountingEntry } from '@/lib/types';
import { syncService } from '@/services/syncService';
import * as XLSX from 'xlsx';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

// ✅ Redondeo a 2 decimales (comercial)
const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
// ✅ Redondeo a 4 decimales (para costos)
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

// ✅ Margen de ganancia por defecto
const DEFAULT_PROFIT_PERCENT = 30; // 30% máximo legal en Venezuela

// Claves para caché en localStorage
const CACHE_KEYS = {
  PRODUCTS: 'inventory_products_cache',
  CATEGORIES: 'inventory_categories_cache',
  DEPARTMENTS: 'inventory_departments_cache',
  KARDEX: 'inventory_kardex_cache',
  IVA_TYPE: 'product_iva_type',
  IVA_PERCENTAGE: 'product_iva_percentage',
};

// ✅ Tipos locales (incluye 'devolucion', 'colaboracion', 'consumo')
interface KardexEntry {
  id: string;
  productId: number;
  date: string;
  type: 'venta' | 'compra' | 'ajuste_inicial' | 'ajuste_manual' | 'devolucion' | 'colaboracion' | 'consumo';
  quantity: number;
  previousStock: number;
  newStock: number;
  reference: string;
  note: string;
  costUsd?: number;
}

// Valores por defecto (se sincronizarán con Firestore al iniciar)
const DEFAULT_CATEGORIES: Category[] = ['Whisky', 'Ron', 'Cerveza', 'Vino', 'Vodka', 'Tequila', 'Licor', 'Gin', 'Otro'];
const DEFAULT_DEPARTMENTS = ['Polar', 'Munchy', 'Otros'];

type InventoryTab = 'catalogo' | 'reporte' | 'ajustes';

export default function InventoryModule({ state }: { state: ReturnType<typeof usePOSState> }) {
  const { toast } = useToast();
  
  // ==================== ESTADOS LOCALES ====================
  const [activeTab, setActiveTab] = useState<InventoryTab>('catalogo');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [viewingKardex, setViewingKardex] = useState<Product | null>(null);
  const [viewingCostDetail, setViewingCostDetail] = useState<Product | null>(null);
  
  const [adjustingStock, setAdjustingStock] = useState<Product | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showAuthCodeModal, setShowAuthCodeModal] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [pendingAdjustment, setPendingAdjustment] = useState<{ product: Product; delta: number; reason: string } | null>(null);
  
  const [adjustmentStartDate, setAdjustmentStartDate] = useState('');
  const [adjustmentEndDate, setAdjustmentEndDate] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<'day' | 'month' | 'year' | 'custom'>('day');
  
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  
  const [ivaType, setIvaType] = useState<'con_iva' | 'sin_iva'>('con_iva');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  
  const products = state.products;
  
  const [kardexEntries, setKardexEntries] = useState<Record<number, KardexEntry[]>>({});
  
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    department: '',
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
  
  // ==================== NUEVO: KITS / COMBOS ====================
  const [isKit, setIsKit] = useState(false);
  const [containerHasOwnStock, setKitHasOwnStock] = useState(false);
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  const [searchChildProduct, setSearchChildProduct] = useState('');
  const [selectedChildProduct, setSelectedChildProduct] = useState<Product | null>(null);
  const [childQuantity, setChildQuantity] = useState('1');
  const [hideChildResults, setHideChildResults] = useState(false);
  
  // ==================== ESTADO LOCAL PARA EL PRECIO USD EDITABLE ====================
  const [localPriceUsd, setLocalPriceUsd] = useState('');
  
  // ✅ Función para calcular Precio Detal USD desde Costo y % de Ganancia
  const calculatePriceUsdFromCostAndProfit = (cost: number, profitPercent: number): number => {
    if (cost <= 0) return 0;
    const marginDecimal = profitPercent / 100;
    const priceUsd = cost / (1 - marginDecimal);
    return roundTo2(priceUsd);
  };
  
  // ✅ Función para calcular % de Ganancia desde Costo y Precio USD
  const calculateProfitFromCostAndPriceUsd = (cost: number, priceUsd: number): number => {
    if (cost <= 0 || priceUsd <= 0) return DEFAULT_PROFIT_PERCENT;
    const profitPercent = ((priceUsd / cost) - 1) * 100;
    return Math.min(roundTo2(profitPercent), 99.99);
  };
  
  // ✅ Validar código de barras duplicado
  const isBarcodeDuplicado = (barcode: string, excludeId?: number): boolean => {
    return products.some(p => 
      p.barcode.toLowerCase() === barcode.toLowerCase() && 
      (excludeId === undefined || p.id !== excludeId)
    );
  };
  
  // ✅ Función para formatear fecha de Venezuela
  const formatVenezuelaDateTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return date.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };
  
  const childProductResults = useMemo(() => {
    if (!searchChildProduct.trim() || hideChildResults) return [];
    const q = searchChildProduct.toLowerCase();
    return products.filter(p => 
      p.id !== editingProduct?.id && 
      (p.name.toLowerCase().includes(q) || p.barcode.includes(q))
    ).slice(0, 5);
  }, [searchChildProduct, products, editingProduct, hideChildResults]);
  
  const addKitComponent = () => {
    if (!selectedChildProduct) return;
    const qty = parseInt(childQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Error", description: "Cantidad no válida", variant: "destructive" });
      return;
    }
    if (kitComponents.some(c => c.productId === selectedChildProduct.id)) {
      toast({ title: "Error", description: "El producto ya está en la lista", variant: "destructive" });
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
  
  // ==================== INICIALIZACIÓN: CARGAR KARDEX DESDE FIRESTORE ====================
  useEffect(() => {
    const cachedCategories = localStorage.getItem(CACHE_KEYS.CATEGORIES);
    if (cachedCategories) {
      try { setCategories(JSON.parse(cachedCategories)); } catch(e) {}
    }
    const cachedDepartments = localStorage.getItem(CACHE_KEYS.DEPARTMENTS);
    if (cachedDepartments) {
      try { setDepartments(JSON.parse(cachedDepartments)); } catch(e) {}
    }
    const cachedKardex = localStorage.getItem(CACHE_KEYS.KARDEX);
    if (cachedKardex) {
      try { setKardexEntries(JSON.parse(cachedKardex)); } catch(e) {}
    }
    
    const unsubSettings = syncService.subscribeToGlobalSettings?.((settings: any) => {
      if (settings) {
        if (settings.categories) setCategories(settings.categories);
        if (settings.departments) setDepartments(settings.departments);
        if (settings.defaultIvaPercentage) setIvaPercentage(settings.defaultIvaPercentage);
        if (settings.categories) localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(settings.categories));
        if (settings.departments) localStorage.setItem(CACHE_KEYS.DEPARTMENTS, JSON.stringify(settings.departments));
      }
    }) || (() => {});
    
    const unsubKardex = syncService.subscribeToKardex?.((entries: KardexEntry[]) => {
      const uniqueEntries = entries.reduce((acc, entry) => {
        if (!acc.some(e => e.id === entry.id)) {
          acc.push(entry);
        }
        return acc;
      }, [] as KardexEntry[]);
      
      const grouped: Record<number, KardexEntry[]> = {};
      uniqueEntries.forEach(entry => {
        const productIdNum = Number(entry.productId);
        if (!grouped[productIdNum]) grouped[productIdNum] = [];
        if (!grouped[productIdNum].some(e => e.id === entry.id)) {
          grouped[productIdNum].push(entry);
        }
      });
      
      Object.keys(grouped).forEach(productIdKey => {
        const pid = Number(productIdKey);
        const arr = grouped[pid];
        if (arr && Array.isArray(arr)) {
          arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      });
      
      setKardexEntries(grouped);
      localStorage.setItem(CACHE_KEYS.KARDEX, JSON.stringify(grouped));
    }) || (() => {});
    
    return () => {
      if (typeof unsubSettings === 'function') unsubSettings();
      if (typeof unsubKardex === 'function') unsubKardex();
    };
  }, []);
  
  // ==================== FUNCIONES AUXILIARES ====================
  const calculateRetailPriceFromCost = (cost: number, profitPercent: number, ivaPercent: number, applyIva: boolean): number => {
    const basePrice = cost / (1 - profitPercent / 100);
    const result = applyIva ? basePrice * (1 + ivaPercent / 100) : basePrice;
    return roundTo2(result);
  };
  
  const getProductMinStock = (product: Product) => product.minStock || 5;
  
  const exportKardexToPDF = (product: Product) => {
    const entries = getKardexForProduct(product.id);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>Kardex - ${product.name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #1A2C4E; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { margin: 0; color: #1A2C4E; font-size: 20px; }
            .info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #1A2C4E; color: white; text-align: left; padding: 8px; font-size: 11px; }
            td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MasterPOS - Tarjeta Kardex</h1>
          </div>
          <div class="info">
            <p><strong>Producto:</strong> ${product.name}</p>
            <p><strong>Código:</strong> ${product.barcode}</p>
            <p><strong>Categoría:</strong> ${product.category}</p>
            <p><strong>Stock Actual:</strong> ${product.stock} UDS</p>
            <p><strong>Costo Promedio Actual:</strong> ${formatUsd(product.costUsd || 0, 4)}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-VE')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>FECHA</th>
                <th>TIPO</th>
                <th>DETALLE</th>
                <th class="text-right">ENTRADA</th>
                <th class="text-right">SALIDA</th>
                <th class="text-right">SALDO</th>
                <th class="text-right">COSTO PROM.</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(entry => {
                let entrada = 0;
                let salida = 0;
                const absQty = Math.abs(entry.quantity);
                // Determinar si es entrada o salida según tipo
                if (entry.type === 'compra' || entry.type === 'ajuste_inicial' || entry.type === 'devolucion') {
                  entrada = absQty;
                } else if (entry.type === 'ajuste_manual' || entry.type === 'colaboracion' || entry.type === 'consumo') {
                  if (entry.quantity > 0) entrada = absQty;
                  else salida = absQty;
                } else {
                  salida = absQty;
                }
                let displayType = '';
                if (entry.type === 'compra') displayType = 'COMPRA';
                else if (entry.type === 'ajuste_inicial') displayType = 'INICIAL';
                else if (entry.type === 'devolucion') displayType = 'DEVOLUCIÓN';
                else if (entry.type === 'ajuste_manual') displayType = 'AJUSTE';
                else if (entry.type === 'colaboracion') displayType = 'COLABORACIÓN';
                else if (entry.type === 'consumo') displayType = 'CONSUMO';
                else displayType = 'VENTA';
                let detalle = entry.reference || entry.note || '';
                return `
                  <tr>
                    <td>${entry.date}</td>
                    <td>${displayType}</td>
                    <td>${detalle}</td>
                    <td class="text-right">${entrada > 0 ? entrada : '-'}</td>
                    <td class="text-right">${salida > 0 ? salida : '-'}</td>
                    <td class="text-right">${entry.newStock}</td>
                    <td class="text-right">${entry.costUsd ? formatUsdNumber(entry.costUsd, 4) : '-'}</td>
                  </tr>
                `;
              }).join('')}
              ${entries.length === 0 ? '<tr><td colspan="7" class="text-center">No hay movimientos registrados</td>' : ''}
            </tbody>
          </table>
          <div class="footer">Documento generado desde MasterPOS - Sistema de Punto de Venta</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };
  
  const shareKardexPDF = (product: Product) => {
    if (navigator.share) {
      const entries = getKardexForProduct(product.id);
      const content = `Kardex - ${product.name}\nStock Actual: ${product.stock} UDS\nCosto Promedio Actual: ${formatUsd(product.costUsd || 0, 4)}\n\nMovimientos:\n${entries.map(e => `${e.date} - ${e.type}: cantidad ${e.quantity} uds (Saldo: ${e.newStock})`).join('\n')}`;
      navigator.share({
        title: `Kardex - ${product.name}`,
        text: content,
      }).catch(() => exportKardexToPDF(product));
    } else {
      exportKardexToPDF(product);
    }
  };
  
  const exportKardexToExcel = (product: Product) => {
    const entries = getKardexForProduct(product.id);
    const data = entries.map(entry => {
      let entrada = 0, salida = 0;
      const absQty = Math.abs(entry.quantity);
      if (entry.type === 'compra' || entry.type === 'ajuste_inicial' || entry.type === 'devolucion') {
        entrada = absQty;
      } else if (entry.type === 'ajuste_manual' || entry.type === 'colaboracion' || entry.type === 'consumo') {
        if (entry.quantity > 0) entrada = absQty;
        else salida = absQty;
      } else {
        salida = absQty;
      }
      let displayType = '';
      if (entry.type === 'compra') displayType = 'COMPRA';
      else if (entry.type === 'ajuste_inicial') displayType = 'INICIAL';
      else if (entry.type === 'devolucion') displayType = 'DEVOLUCIÓN';
      else if (entry.type === 'ajuste_manual') displayType = 'AJUSTE';
      else if (entry.type === 'colaboracion') displayType = 'COLABORACIÓN';
      else if (entry.type === 'consumo') displayType = 'CONSUMO';
      else displayType = 'VENTA';
      return {
        FECHA: entry.date,
        TIPO: displayType,
        DETALLE: entry.reference || entry.note || '',
        ENTRADA: entrada > 0 ? entrada : '-',
        SALIDA: salida > 0 ? salida : '-',
        SALDO: entry.newStock,
        COSTO_PROMEDIO: entry.costUsd ? entry.costUsd : '-',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Kardex_${product.name}`);
    XLSX.writeFile(wb, `Kardex_${product.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exportado", description: "Kardex exportado a Excel correctamente" });
  };
  
  // ==================== MANEJO DE PRODUCTOS (CRUD) ====================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Validar código de barras duplicado
    if (isBarcodeDuplicado(formData.barcode, editingProduct?.id)) {
      toast({ title: "Error", description: `Ya existe un producto con el código ${formData.barcode}. No se puede duplicar.`, variant: "destructive" });
      return;
    }
    
    const cost = parseFloat(costUsdInput) || 0;
    const profitPercent = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT;
    
    let finalPriceUsd, finalPriceBs;
    if (isPriceFixed) {
      const manualUsd = parseFloat(localPriceUsd);
      const manualBs = parseFloat(priceRetailBs);
      if (!isNaN(manualUsd) && manualUsd > 0) {
        finalPriceUsd = manualUsd;
        finalPriceBs = roundTo2(manualUsd * state.exchangeRate);
      } else if (!isNaN(manualBs) && manualBs > 0) {
        finalPriceBs = manualBs;
        finalPriceUsd = finalPriceBs / state.exchangeRate;
      } else {
        finalPriceUsd = calculatePriceUsdFromCostAndProfit(cost, profitPercent);
        finalPriceBs = finalPriceUsd * state.exchangeRate;
      }
    } else {
      finalPriceUsd = calculatePriceUsdFromCostAndProfit(cost, profitPercent);
      finalPriceBs = finalPriceUsd * state.exchangeRate;
    }
    
    const productData: Product = {
      id: editingProduct?.id || Date.now(),
      barcode: formData.barcode,
      name: formData.name,
      department: formData.department || 'Otros',
      category: formData.category,
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
      kitHasOwnStock: isKit ? containerHasOwnStock : undefined,
      kitComponents: isKit && kitComponents.length > 0 ? kitComponents : undefined,
    };
    
    if (editingProduct) {
      await state.updateProduct(productData);
      toast({ title: "Actualizado", description: "Producto modificado correctamente." });
    } else {
      await state.addProduct(productData);
      const kardexEntry: KardexEntry = {
        id: `${Date.now()}_${Math.random()}`,
        productId: productData.id,
        date: new Date().toISOString(),
        type: 'ajuste_inicial',
        quantity: productData.stock,
        previousStock: 0,
        newStock: productData.stock,
        reference: 'Creación de producto',
        note: 'Stock inicial',
        costUsd: productData.costUsd,
      };
      await syncService.saveKardexEntry?.(kardexEntry);
      addKardexEntryLocal(productData.id, kardexEntry);
      toast({ title: "Creado", description: "Nuevo producto registrado." });
    }
    setIsAdding(false);
    setEditingProduct(null);
    resetForm();
  };
  
  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      barcode: p.barcode,
      name: p.name,
      department: p.department || 'Otros',
      category: p.category,
      stock: p.stock,
      minStock: p.minStock || 5,
      costUsd: p.costUsd || 0,
      priceWholesale: p.priceWholesale || 0,
      priceCost: p.priceCost || 0,
    });
    setCostUsdInput(p.costUsd?.toString() || '');
    setPriceWholesaleInput(p.priceWholesale?.toString() || '');
    setPriceCostInput(p.priceCost?.toString() || '');
    setStockInput(p.stock.toString());
    setMinStockInput((p.minStock || 5).toString());
    setProfitPercentInput((p.profitPercent || DEFAULT_PROFIT_PERCENT).toString());
    setIvaType(p.ivaType || 'con_iva');
    setIvaPercentage(p.ivaPercentage || 16);
    setIsKit(p.isKit || false);
    setKitHasOwnStock(p.kitHasOwnStock || false);
    setKitComponents(p.kitComponents || []);
    setPriceRetailBs(p.priceBs.toString());
    setLocalPriceUsd(p.priceUsd.toString());
    setIsPriceFixed(true);
    setIsAdding(true);
  };
  
  const resetForm = () => {
    setFormData({
      barcode: '', name: '', department: 'Otros', category: 'Otro', stock: 0, minStock: 5,
      costUsd: 0, priceWholesale: 0, priceCost: 0
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
    setLocalPriceUsd('');
    setIsPriceFixed(false);
  };
  
  // ==================== KARDEX ====================
  const addKardexEntryLocal = (productId: number, entry: KardexEntry) => {
    setKardexEntries(prev => {
      const existing = prev[productId] || [];
      if (existing.some(e => e.id === entry.id)) {
        return prev;
      }
      const updated = {
        ...prev,
        [productId]: [entry, ...existing]
      };
      localStorage.setItem(CACHE_KEYS.KARDEX, JSON.stringify(updated));
      return updated;
    });
  };
  
  const getKardexForProduct = (productId: number): KardexEntry[] => {
    return kardexEntries[productId] || [];
  };
  
  const registerAdjustmentAccountingEntry = async (product: Product, delta: number, reason: string, exchangeRate: number) => {
    const absDelta = Math.abs(delta);
    const valorBs = absDelta * (product.costUsd || 0) * exchangeRate;
    const entryType = delta > 0 ? 'ingreso' : 'egreso';
    const category = 'Inventario';
    const subcategory = delta > 0 ? 'Sobrante' : 'Merma / Rotura';
    const concept = delta > 0 ? 'Ajuste positivo de inventario' : 'Ajuste negativo de inventario';
    const description = `${reason} | Producto: ${product.name} (${product.barcode}) | Cantidad: ${absDelta} uds | Costo USD: ${formatUsd(product.costUsd || 0, 4)}`;
    
    const accountingEntry: AccountingEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      type: entryType,
      category,
      subcategory,
      concept,
      description,
      amount: roundTo2(valorBs),
      referenceId: product.id,
      referenceType: 'inventory_adjustment',
      createdAt: new Date().toISOString(),
    };
    
    await syncService.saveAccountingEntry(accountingEntry);
    toast({ title: "Asiento contable registrado", description: `${entryType === 'ingreso' ? 'Ingreso' : 'Egreso'} por ${formatBs(valorBs)}` });
  };
  
  // ==================== AJUSTE DE STOCK CON CÓDIGO DE AUTORIZACIÓN ====================
  const requestStockAdjust = (product: Product) => {
    setAdjustingStock(product);
    setAdjustmentDelta('');
    setAdjustmentReason('');
  };
  
  const confirmStockAdjustmentRequest = () => {
    if (!adjustingStock) return;
    const delta = parseInt(adjustmentDelta);
    if (isNaN(delta) || delta === 0) {
      toast({ title: "Error", description: "Ingrese una cantidad válida (distinta de cero)", variant: "destructive" });
      return;
    }
    const newQty = adjustingStock.stock + delta;
    if (newQty < 0) {
      toast({ title: "Error", description: "El stock no puede quedar negativo", variant: "destructive" });
      return;
    }
    if (!adjustmentReason.trim()) {
      toast({ title: "Error", description: "Ingrese un motivo para el ajuste", variant: "destructive" });
      return;
    }
    setPendingAdjustment({
      product: adjustingStock,
      delta,
      reason: adjustmentReason
    });
    setShowAuthCodeModal(true);
  };
  
  const verifyAuthCode = async () => {
    const adminCodeData = await syncService.getAdminCode();
    if (adminCodeData && adminCodeData.code === authCodeInput) {
      if (pendingAdjustment) {
        const { product, delta, reason } = pendingAdjustment;
        const previousStock = product.stock;
        const newQty = previousStock + delta;
        const updatedProduct = { ...product, stock: newQty };
        
        await state.updateProduct(updatedProduct);
        
        const kardexEntry: KardexEntry = {
          id: `${Date.now()}_${Math.random()}`,
          productId: product.id,
          date: new Date().toISOString(),
          type: 'ajuste_manual',
          quantity: delta,
          previousStock: previousStock,
          newStock: newQty,
          reference: `Ajuste manual - ${reason}`,
          note: reason,
          costUsd: product.costUsd,
        };
        await syncService.saveKardexEntry?.(kardexEntry);
        addKardexEntryLocal(product.id, kardexEntry);
        await registerAdjustmentAccountingEntry(product, delta, reason, state.exchangeRate);
        toast({ title: "Ajuste Realizado", description: `${delta > 0 ? 'Agregadas' : 'Quitadas'} ${Math.abs(delta)} unidades. Nuevo stock: ${newQty}` });
        setAdjustingStock(null);
        setPendingAdjustment(null);
        setAuthCodeInput('');
        setShowAuthCodeModal(false);
      }
    } else {
      toast({ title: "Acceso denegado", description: "Código de autorización incorrecto", variant: "destructive" });
      setAuthCodeInput('');
    }
  };
  
  // ==================== GESTIÓN GLOBAL DE IVA ====================
  const [showGlobalIvaModal, setShowGlobalIvaModal] = useState(false);
  const [newGlobalIva, setNewGlobalIva] = useState(16);
  
  const applyGlobalIva = async () => {
    if (state.register?.isOpen) {
      toast({ title: "Operación no permitida", description: "Debe cerrar la caja antes de cambiar el IVA global", variant: "destructive" });
      return;
    }
    const updatedProducts = products.map(p => {
      if (p.ivaType === 'con_iva') {
        const newRetail = calculateRetailPriceFromCost(p.costUsd || 0, p.profitPercent || DEFAULT_PROFIT_PERCENT, newGlobalIva, true);
        return { 
          ...p, 
          ivaPercentage: newGlobalIva, 
          priceRetail: newRetail, 
          priceUsd: newRetail, 
          priceBs: roundTo2(newRetail * state.exchangeRate)
        };
      }
      return p;
    });
    for (const prod of updatedProducts) {
      await state.updateProduct(prod);
    }
    await syncService.saveGlobalSettings({ defaultIvaPercentage: newGlobalIva });
    setIvaPercentage(newGlobalIva);
    toast({ title: "IVA actualizado", description: `Nuevo porcentaje global: ${newGlobalIva}%` });
    setShowGlobalIvaModal(false);
  };
  
  // ==================== CATEGORÍAS Y DEPARTAMENTOS ====================
  const addCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim() as Category)) {
      toast({ title: "Error", description: "Esta categoría ya existe", variant: "destructive" });
      return;
    }
    const newCats = [...categories, newCategory.trim() as Category];
    setCategories(newCats);
    localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(newCats));
    syncService.saveGlobalSettings({ categories: newCats, departments }).catch(console.error);
    setNewCategory('');
    setShowCategoryModal(false);
  };
  
  const deleteCategory = (cat: Category) => {
    if (cat === 'Otro') {
      toast({ title: "No se puede eliminar", description: "La categoría 'Otro' es requerida", variant: "destructive" });
      return;
    }
    if (products.some(p => p.category === cat)) {
      toast({ title: "No se puede eliminar", description: "Hay productos asociados a esta categoría", variant: "destructive" });
      return;
    }
    const newCats = categories.filter(c => c !== cat);
    setCategories(newCats);
    localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(newCats));
    syncService.saveGlobalSettings({ categories: newCats, departments }).catch(console.error);
  };
  
  const addDepartment = () => {
    if (!newDepartment.trim()) return;
    if (departments.includes(newDepartment.trim())) {
      toast({ title: "Error", description: "Este departamento ya existe", variant: "destructive" });
      return;
    }
    const newDepts = [...departments, newDepartment.trim()];
    setDepartments(newDepts);
    localStorage.setItem(CACHE_KEYS.DEPARTMENTS, JSON.stringify(newDepts));
    syncService.saveGlobalSettings({ categories, departments: newDepts }).catch(console.error);
    setNewDepartment('');
    setShowDepartmentModal(false);
  };
  
  const deleteDepartment = (dept: string) => {
    if (dept === 'Otros') {
      toast({ title: "No se puede eliminar", description: "El departamento 'Otros' es requerido", variant: "destructive" });
      return;
    }
    if (products.some(p => p.department === dept)) {
      toast({ title: "No se puede eliminar", description: "Hay productos asociados a este departamento", variant: "destructive" });
      return;
    }
    const newDepts = departments.filter(d => d !== dept);
    setDepartments(newDepts);
    localStorage.setItem(CACHE_KEYS.DEPARTMENTS, JSON.stringify(newDepts));
    syncService.saveGlobalSettings({ categories, departments: newDepts }).catch(console.error);
  };
  
  // ==================== EXPORTACIÓN E IMPRESIÓN ====================
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const pdfProducts = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchCat = filterCategory === 'all' || p.category === filterCategory;
      const matchDept = filterDepartment === 'all' || (p.department === filterDepartment);
      return matchSearch && matchCat && matchDept;
    });
    
    const html = `
      <html>
        <head>
          <title>Reporte de Inventario - MasterPOS</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #D4A017; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { margin: 0; color: #1A2C4E; font-size: 24px; text-transform: uppercase; }
            .info { display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #1A2C4E; color: white; text-align: left; padding: 10px; font-size: 10px; text-transform: uppercase; }
            td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 10px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .low-stock { color: #e74c3c; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
            .summary { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 8px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LICOPOS ELITE - REPORTE DE INVENTARIO</h1>
          </div>
          <div class="info">
            <span>FECHA: ${new Date().toLocaleString('es-VE')}</span>
            <span>TASA BCV: ${formatBs(state.exchangeRate)}</span>
          </div>
          <div class="summary">
            <span class="bold">RESUMEN:</span> ${pdfProducts.length} productos listados | 
            Total ítems en stock: ${pdfProducts.reduce((s, p) => s + p.stock, 0)}
          </div>
          <table>
            <thead>
              <tr>
                <th>CÓDIGO</th>
                <th>PRODUCTO</th>
                <th>CATEGORÍA</th>
                <th class="text-center">STOCK</th>
                <th class="text-right">PRECIO USD</th>
                <th class="text-right">PRECIO BS</th>
              </tr>
            </thead>
            <tbody>
              ${pdfProducts.map(p => `
                <tr>
                  <td>${p.barcode}</td>
                  <td class="bold">${p.name}</td>
                  <td>${p.category}</td>
                  <td class="text-center ${p.stock <= getProductMinStock(p) ? 'low-stock' : ''}">${p.stock}</td>
                  <td class="text-right">${formatUsd(p.priceUsd)}</td>
                  <td class="text-right">${formatBs(p.priceBs)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Este documento es una representación digital del inventario actual en el sistema MasterPOS.</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };
  
  const handleSharePDF = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Inventario MasterPOS',
        text: `Reporte de inventario generado el ${new Date().toLocaleDateString()}. Total productos: ${filteredProducts.length}`,
      }).catch(() => handleExportPDF());
    } else {
      handleExportPDF();
    }
  };
  
  // ==================== FILTRADO DE PRODUCTOS ====================
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchCat = filterCategory === 'all' || p.category === filterCategory;
      const matchDept = filterDepartment === 'all' || (p.department === filterDepartment);
      return matchSearch && matchCat && matchDept;
    });
  }, [products, search, filterCategory, filterDepartment]);
  
  const reportProducts = useMemo(() => {
    let filtered = [...products];
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(p => p.department === filterDepartment);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filterDepartment, filterCategory]);
  
  // ✅ Total del valor de inventario en USD
  const totalInventoryValueUsd = useMemo(() => {
    return reportProducts.reduce((sum, p) => sum + ((p.costUsd || 0) * p.stock), 0);
  }, [reportProducts]);
  
  // ==================== HISTORIAL DE AJUSTES ====================
  const allAdjustments = useMemo(() => {
    const adjustments: (KardexEntry & { productName: string; productBarcode: string; costBsValue: number })[] = [];
    for (const product of products) {
      const entries = getKardexForProduct(product.id);
      const productAdjustments = entries.filter(e => e.type === 'ajuste_manual');
      for (const entry of productAdjustments) {
        adjustments.push({
          ...entry,
          productName: product.name,
          productBarcode: product.barcode,
          costBsValue: (entry.costUsd || 0) * state.exchangeRate,
        });
      }
    }
    adjustments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return adjustments;
  }, [products, kardexEntries, state.exchangeRate]);
  
  const filteredAdjustments = useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;
    
    const now = new Date();
    switch (dateRangePreset) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, -1);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'custom':
        if (adjustmentStartDate && adjustmentEndDate) {
          start = new Date(adjustmentStartDate);
          start.setHours(0,0,0,0);
          end = new Date(adjustmentEndDate);
          end.setHours(23,59,59,999);
        }
        break;
    }
    
    if (!start) return allAdjustments;
    
    return allAdjustments.filter(adj => {
      const adjDate = new Date(adj.date);
      return adjDate >= start! && adjDate <= (end || new Date());
    });
  }, [allAdjustments, dateRangePreset, adjustmentStartDate, adjustmentEndDate]);
  
  const totalAdjustmentValue = useMemo(() => {
    return filteredAdjustments.reduce((sum, adj) => {
      const valorBs = Math.abs(adj.quantity) * (adj.costUsd || 0) * state.exchangeRate;
      return sum + valorBs;
    }, 0);
  }, [filteredAdjustments, state.exchangeRate]);
  
  // ✅ Total de ajustes en USD
  const totalAdjustmentUsd = useMemo(() => {
    return filteredAdjustments.reduce((sum, adj) => {
      return sum + (Math.abs(adj.quantity) * (adj.costUsd || 0));
    }, 0);
  }, [filteredAdjustments]);
  
  // ==================== RENDERIZADO ====================
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex justify-between items-center pt-3 px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-headline font-black text-black">Catálogo de Inventario</h2>
          <p className="text-xs text-black/50">Consulta de existencias y gestión de catálogo</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowGlobalIvaModal(true)} 
            className="h-8 text-[10px] font-black border-[#9E9E9E]"
          >
            <Percent size={12} className="mr-1" /> Ajuste IVA Global
          </Button>
          <div className="bg-[#1A2C4E] px-3 py-1.5 rounded-xl text-white">
            <span className="text-[9px] font-black uppercase opacity-60">Tasa Sistema</span>
            <div className="text-base font-black text-primary">{formatBs(state.exchangeRate)}</div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 px-6 mt-2 border-b border-[#9E9E9E] flex-shrink-0">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm transition-all",
            activeTab === 'catalogo'
              ? "bg-white text-black border border-b-0 border-[#9E9E9E]"
              : "text-black/60 hover:bg-white/50"
          )}
        >
          <Package size={14} />
          Catálogo de Productos
        </button>
        <button
          onClick={() => setActiveTab('reporte')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm transition-all",
            activeTab === 'reporte'
              ? "bg-white text-black border border-b-0 border-[#9E9E9E]"
              : "text-black/60 hover:bg-white/50"
          )}
        >
          <FileSpreadsheet size={14} />
          Reporte General de Inventario
        </button>
        <button
          onClick={() => setActiveTab('ajustes')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm transition-all",
            activeTab === 'ajustes'
              ? "bg-white text-black border border-b-0 border-[#9E9E9E]"
              : "text-black/60 hover:bg-white/50"
          )}
        >
          <History size={14} />
          Historial de Ajustes
        </button>
      </div>
      
      {activeTab === 'catalogo' ? (
        <div className="flex-1 flex flex-col overflow-hidden px-6 mt-4">
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap flex-shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
              <Input placeholder="Buscar producto..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white"><option value="all">📁 Todos los Deptos.</option>{departments.map(d => <option key={d}>{d}</option>)}</select>
              <button onClick={() => setShowDepartmentModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button>
            </div>
            <div className="flex items-center gap-1">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white"><option value="all">🏷️ Todas las Cats.</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
              <button onClick={() => setShowCategoryModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button onClick={handleExportPDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Printer size={13} className="mr-1" /> EXPORTAR PDF</Button>
              <Button onClick={handleSharePDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Share2 size={13} className="mr-1" /> COMPARTIR</Button>
              <Button onClick={() => { resetForm(); setEditingProduct(null); setIsAdding(true); }} className="bg-primary text-black font-black h-8 text-[10px] px-3"><Plus size={13} className="mr-1" /> NUEVO PRODUCTO</Button>
            </div>
          </div>
          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
            <div className="overflow-y-auto flex-1 scrollbar-thin">
              <Table>
                <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase">Código</TableHead>
                    <TableHead className="text-[9px] font-black uppercase">Producto</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Stock</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">Precio $</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">Precio Bs</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id} className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5]">
                      <TableCell className="font-mono text-[10px] text-black/60">{p.barcode}</TableCell>
                      <TableCell><p className="font-bold text-xs text-black">{p.name}</p><p className="text-[8px] font-bold text-primary uppercase">{p.category} | {p.department || 'Sin Dept.'}</p></TableCell>
                      <TableCell className="text-center"><span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black border", p.stock <= getProductMinStock(p) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{p.stock} UDS</span></TableCell>
                      <TableCell className="text-right font-black text-xs text-secondary">{formatUsd(p.priceUsd)}</TableCell>
                      <TableCell className="text-right font-black text-xs text-black">{formatBs(p.priceBs)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setViewingKardex(p)} className="h-6 w-6 rounded hover:bg-blue-100 text-blue-600" title="Ver Kardex"><History size={11} /></button>
                          <button onClick={() => requestStockAdjust(p)} className="h-6 w-6 rounded hover:bg-amber-100 text-amber-600" title="Ajustar Stock"><RefreshCw size={11} /></button>
                          <button onClick={() => handleEdit(p)} className="h-6 w-6 rounded hover:bg-gray-100 text-blue-600"><Pencil size={11} /></button>
                          <button onClick={() => { if(confirm('¿Eliminar este producto?')) state.deleteProduct(p.id) }} className="h-6 w-6 rounded hover:bg-red-100 text-red-600"><Trash2 size={11} /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProducts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-black/40 italic">No se encontraron productos</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : activeTab === 'reporte' ? (
        <div className="flex-1 flex flex-col overflow-hidden px-6 mt-4">
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap flex-shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
              <Input placeholder="Buscar producto en el reporte..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white"><option value="all">📁 Todos los Deptos.</option>{departments.map(d => <option key={d}>{d}</option>)}</select>
            </div>
            <div className="flex items-center gap-1">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white"><option value="all">🏷️ Todas las Cats.</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button onClick={handleExportPDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Printer size={13} className="mr-1" /> EXPORTAR PDF</Button>
            </div>
          </div>
          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
            <div className="overflow-y-auto flex-1 scrollbar-thin">
              <Table>
                <TableHeader className="bg-[#1A2C4E] sticky top-0 z-10">
                  <TableRow className="border-b border-white/20">
                    <TableHead className="text-[9px] font-black uppercase text-white">Código</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-white">Producto</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-white text-right">Costo $</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-white text-center">Stock</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-white text-right">Valor Inventario $</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-white text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                    <TableRow key={p.id} className="border-b border-[#9E9E9E]/30 hover:bg-[#F5F5F5] py-1">
                      <TableCell className="font-mono text-[9px] text-black/60 py-1.5">{p.barcode}</TableCell>
                      <TableCell className="py-1.5"><p className="font-bold text-xs text-black">{p.name}</p><p className="text-[7px] font-bold text-primary/70 uppercase">{p.category} | {p.department || 'Sin Dept.'}</p></TableCell>
                      <TableCell className="text-right font-mono text-[10px] font-bold text-black/80 py-1.5">{formatUsd(p.costUsd || 0, 4)}</TableCell>
                      <TableCell className="text-center py-1.5"><span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black", p.stock <= getProductMinStock(p) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{p.stock} UDS</span></TableCell>
                      <TableCell className="text-right font-mono text-[10px] font-black text-black/80 py-1.5">{formatUsd((p.costUsd || 0) * p.stock)}</TableCell>
                      <TableCell className="text-center py-1.5">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => setViewingCostDetail(p)} className="h-7 w-7 rounded hover:bg-blue-100 text-blue-600 flex items-center justify-center" title="Ver detalle de costo"><Calculator size={14} /></button>
                          <button onClick={() => setViewingKardex(p)} className="h-7 w-7 rounded hover:bg-blue-100 text-blue-600 flex items-center justify-center" title="Ver Kardex"><History size={14} /></button>
                          <button onClick={() => requestStockAdjust(p)} className="h-7 w-7 rounded hover:bg-amber-100 text-amber-600 flex items-center justify-center" title="Ajustar Stock"><RefreshCw size={14} /></button>
                          <button onClick={() => handleEdit(p)} className="h-7 w-7 rounded hover:bg-gray-100 text-blue-600 flex items-center justify-center"><Pencil size={14} /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reportProducts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-black/40 italic">No hay productos para mostrar con los filtros seleccionados</TableCell></TableRow>}
                </TableBody>
                <tfoot className="bg-[#F0F0F0] border-t-2 border-[#9E9E9E]">
                  <tr className="font-black">
                    <td colSpan={4} className="p-3 text-right text-lg font-black">TOTAL VALOR INVENTARIO:</td>
                    <td className="p-3 text-right text-xl font-black text-primary">{formatUsd(totalInventoryValueUsd)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </div>
          <div className="mt-3 bg-gray-100 rounded-lg p-2 flex justify-between items-center flex-shrink-0">
            <div className="text-[9px] text-black/60"><span className="font-bold">{reportProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).length}</span> productos mostrados</div>
            <div className="text-[9px] text-black/60">Valor total inventario: <span className="font-bold text-black">{formatUsd(reportProducts.reduce((sum, p) => sum + ((p.costUsd || 0) * p.stock), 0))}</span></div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden px-6 mt-4">
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-black/60">Filtrar por:</span>
              <div className="flex gap-1">
                <button onClick={() => setDateRangePreset('day')} className={cn("px-2 py-1 text-[10px] font-bold rounded border", dateRangePreset === 'day' ? "bg-primary text-black" : "bg-white")}>Hoy</button>
                <button onClick={() => setDateRangePreset('month')} className={cn("px-2 py-1 text-[10px] font-bold rounded border", dateRangePreset === 'month' ? "bg-primary text-black" : "bg-white")}>Este Mes</button>
                <button onClick={() => setDateRangePreset('year')} className={cn("px-2 py-1 text-[10px] font-bold rounded border", dateRangePreset === 'year' ? "bg-primary text-black" : "bg-white")}>Este Año</button>
                <button onClick={() => setDateRangePreset('custom')} className={cn("px-2 py-1 text-[10px] font-bold rounded border", dateRangePreset === 'custom' ? "bg-primary text-black" : "bg-white")}>Personalizado</button>
              </div>
            </div>
            {dateRangePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" value={adjustmentStartDate} onChange={e => setAdjustmentStartDate(e.target.value)} className="h-7 text-xs w-36" />
                <span className="text-xs">-</span>
                <Input type="date" value={adjustmentEndDate} onChange={e => setAdjustmentEndDate(e.target.value)} className="h-7 text-xs w-36" />
              </div>
            )}
            <div className="ml-auto text-xs bg-gray-100 px-3 py-1 rounded-full">
              Total ajustes: <span className="font-bold">{formatUsd(totalAdjustmentUsd)}</span>
            </div>
          </div>
          
          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-center">Tipo</th>
                    <th className="p-2 text-right">Cantidad</th>
                    <th className="p-2 text-right">Costo USD</th>
                    <th className="p-2 text-right">Valor Ajuste (Bs)</th>
                    <th className="p-2 text-left">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdjustments.map((adj, idx) => (
                    <tr key={`${adj.id}_${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* ✅ Fecha formateada correctamente */}
                      <td className="p-2 whitespace-nowrap text-[11px] font-mono">{formatVenezuelaDateTime(adj.date)}</td>
                      <td className="p-2">
                        <div className="font-bold">{adj.productName}</div>
                        <div className="text-[9px] text-black/50">{adj.productBarcode}</div>
                      </td>
                      <td className="p-2 text-center">
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", adj.quantity > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {adj.quantity > 0 ? "INGRESO" : "EGRESO"}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono">{Math.abs(adj.quantity)} uds</td>
                      <td className="p-2 text-right font-mono">{formatUsd(adj.costUsd || 0, 4)}</td>
                      <td className="p-2 text-right font-mono font-bold">{formatBs(Math.abs(adj.quantity) * (adj.costUsd || 0) * state.exchangeRate)}</td>
                      <td className="p-2 text-left max-w-[200px] truncate" title={adj.note || adj.reference}>{adj.note || adj.reference}</td>
                    </tr>
                  ))}
                  {filteredAdjustments.length === 0 && (
                    <tr><td colSpan={7} className="p-4 text-center text-black/40 italic">No hay ajustes manuales en el período seleccionado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 p-2 border-t text-[10px] text-black/40 flex justify-between">
              <span>{filteredAdjustments.length} registros</span>
              <span>Los ajustes generan automáticamente asientos contables (ingresos/egresos)</span>
            </div>
          </div>
        </div>
      )}
      
      {/* ==================== MODALES ==================== */}
      
      {/* Modal de detalle de costo */}
      {viewingCostDetail && (
        <Dialog open={true} onOpenChange={() => setViewingCostDetail(null)}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-lg p-0 rounded-xl shadow-xl max-h-[85vh] flex flex-col">
            <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl flex-shrink-0">
              <div className="flex justify-between items-center">
                <DialogTitle className="text-sm font-black flex items-center gap-2"><Calculator size={14} /> Detalle de Costo - CPP</DialogTitle>
                <button onClick={() => setViewingCostDetail(null)} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center mb-4"><p className="font-bold text-base">{viewingCostDetail.name}</p><p className="text-[9px] text-black/50">{viewingCostDetail.barcode}</p></div>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3"><div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase text-black/60">Costo Actual (Ponderado)</span><span className="font-mono text-lg font-black text-blue-600">{formatUsd(viewingCostDetail.costUsd || 0, 4)}</span></div></div>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-[9px] font-bold uppercase text-black/60 mb-2">Historial de Costos (últimas compras)</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(() => {
                      const entries = kardexEntries[viewingCostDetail.id] || [];
                      const purchaseEntries = entries.filter(e => e.type === 'compra').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      if (purchaseEntries.length === 0) return <p className="text-[9px] text-black/40 italic text-center">No hay registros de compras previas</p>;
                      return purchaseEntries.map((entry, idx) => {
                        const previousEntry = purchaseEntries[idx + 1];
                        const previousCost = previousEntry?.costUsd;
                        const newCost = entry.costUsd;
                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg p-2 bg-white">
                            <div className="flex justify-between items-center text-[10px]"><span className="text-black/60">{new Date(entry.date).toLocaleDateString('es-VE')}</span><span className="font-mono font-bold text-blue-600">{formatUsd(newCost || 0, 4)}</span><span className="text-[8px] text-black/40">x{entry.quantity} uds</span></div>
                            {previousCost !== undefined && (<div className="flex justify-between items-center text-[9px] mt-1 pt-1 border-t border-gray-100"><span className="text-black/40">Costo anterior:</span><span className="font-mono text-black/60">{formatUsd(previousCost, 4)}</span><span className="text-black/40">→</span><span className="font-mono font-bold text-green-600">{formatUsd(newCost || 0, 4)}</span></div>)}
                            {idx === 0 && purchaseEntries.length > 1 && (<div className="flex justify-between items-center text-[9px] mt-1 pt-1 border-t border-blue-100"><span className="text-blue-600">📊 Variación:</span>{(() => { const prev = purchaseEntries[1]?.costUsd; if (prev && newCost) { const variation = ((newCost - prev) / prev) * 100; return <span className={cn("font-mono font-bold", variation >= 0 ? "text-red-600" : "text-green-600")}>{variation >= 0 ? `+${variation.toFixed(2)}%` : `${variation.toFixed(2)}%`}</span> } return null; })()}</div>)}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 mt-2 border border-amber-200 flex-shrink-0"><p className="text-[7px] text-amber-700 text-center">El costo actual se calcula mediante <strong>Promedio Ponderado (CPP)</strong><br />Fórmula: ((Stock Ant × Costo Ant) + (Cantidad Nueva × Costo Nuevo)) / Stock Total</p></div>
              </div>
            </div>
            <div className="bg-gray-50 p-2 border-t flex justify-end flex-shrink-0"><Button onClick={() => setViewingCostDetail(null)} variant="ghost" size="sm" className="h-7 text-xs">CERRAR</Button></div>
          </DialogContent>
        </Dialog>
      )}
      
      {viewingKardex && (
        <Dialog open={true} onOpenChange={() => setViewingKardex(null)}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-6xl w-[95vw] p-0 overflow-hidden rounded-xl shadow-xl max-h-[90vh] flex flex-col">
            <DialogHeader className="bg-[#1A2C4E] p-4 text-white sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="text-xl font-black flex items-center gap-2"><History size={20} /> Tarjeta Kardex</DialogTitle>
                  <p className="text-sm font-bold opacity-90 mt-1">{viewingKardex.name}</p>
                  <p className="text-[11px] opacity-70 font-mono">{viewingKardex.barcode}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => exportKardexToPDF(viewingKardex)} className="text-white/70 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10" title="Exportar a PDF"><Printer size={18} /></button>
                  <button onClick={() => shareKardexPDF(viewingKardex)} className="text-white/70 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10" title="Compartir PDF"><Share2 size={18} /></button>
                  <button onClick={() => exportKardexToExcel(viewingKardex)} className="text-white/70 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10" title="Exportar a Excel"><FileSpreadsheet size={18} /></button>
                  <button onClick={() => setViewingKardex(null)} className="text-white/70 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10"><X size={20} /></button>
                </div>
              </div>
            </DialogHeader>
            <div className="p-5 overflow-y-auto flex-1 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 shadow-sm border border-green-200"><p className="text-[11px] font-black uppercase text-green-700 tracking-wider">📦 STOCK ACTUAL</p><p className={cn("text-3xl font-black mt-1", viewingKardex.stock === 0 ? "text-red-600" : "text-green-700")}>{viewingKardex.stock.toLocaleString('es-VE')} <span className="text-base font-bold">UDS</span></p></div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 shadow-sm border border-blue-200"><p className="text-[11px] font-black uppercase text-blue-700 tracking-wider">💰 COSTO PROMEDIO ACTUAL</p><p className="text-3xl font-black text-blue-700 mt-1">{formatUsd(viewingKardex.costUsd || 0, 4)}</p></div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 shadow-sm border border-amber-200"><p className="text-[11px] font-black uppercase text-amber-700 tracking-wider">💵 VALOR INVENTARIO</p><p className="text-3xl font-black text-amber-700 mt-1">{formatUsd((viewingKardex.costUsd || 0) * viewingKardex.stock)}</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 whitespace-nowrap">FECHA</th>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 whitespace-nowrap">TIPO</th>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 whitespace-nowrap">DETALLE</th>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 text-right whitespace-nowrap">ENTRADA</th>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 text-right whitespace-nowrap">SALIDA</th>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 text-right whitespace-nowrap">SALDO</th>
                        <th className="p-3 text-[12px] font-black uppercase text-gray-700 text-right whitespace-nowrap">COSTO PROM.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const entries = getKardexForProduct(viewingKardex.id);
                        const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        return sortedEntries.map((entry, idx) => {
                          let entrada = 0, salida = 0;
                          const absQty = Math.abs(entry.quantity);
                          if (entry.type === 'compra' || entry.type === 'ajuste_inicial' || entry.type === 'devolucion') {
                            entrada = absQty;
                          } else if (entry.type === 'ajuste_manual' || entry.type === 'colaboracion' || entry.type === 'consumo') {
                            if (entry.quantity > 0) entrada = absQty;
                            else salida = absQty;
                          } else {
                            salida = absQty;
                          }
                          let displayType = '', badgeColor = '';
                          switch (entry.type) {
                            case 'compra':
                              displayType = 'COMPRA';
                              badgeColor = "bg-green-100 text-green-700";
                              break;
                            case 'ajuste_inicial':
                              displayType = 'INICIAL';
                              badgeColor = "bg-blue-100 text-blue-700";
                              break;
                            case 'devolucion':
                              displayType = 'DEVOLUCIÓN';
                              badgeColor = "bg-purple-100 text-purple-700";
                              break;
                            case 'ajuste_manual':
                              displayType = 'AJUSTE';
                              badgeColor = "bg-orange-100 text-orange-700";
                              break;
                            case 'colaboracion':
                              displayType = 'COLABORACIÓN';
                              badgeColor = "bg-indigo-100 text-indigo-700";
                              break;
                            case 'consumo':
                              displayType = 'CONSUMO';
                              badgeColor = "bg-pink-100 text-pink-700";
                              break;
                            default:
                              displayType = 'VENTA';
                              badgeColor = "bg-red-100 text-red-700";
                          }
                          let detalle = entry.reference || entry.note || '';
                          let formattedDate = '';
                          try {
                            const dateObj = new Date(entry.date);
                            if (!isNaN(dateObj.getTime())) formattedDate = dateObj.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                            else formattedDate = entry.date;
                          } catch(e) { formattedDate = entry.date; }
                          return (
                            <tr key={`${entry.id}_${idx}`} className="hover:bg-gray-50 transition-colors">
                              <td className="p-3 font-mono text-[12px] font-semibold text-gray-700 whitespace-nowrap">{formattedDate}</td>
                              <td className="p-3 whitespace-nowrap"><span className={cn("px-2 py-1 rounded-full text-[10px] font-black", badgeColor)}>{displayType}</span></td>
                              <td className="p-3 text-[11px] text-gray-600 max-w-[250px] truncate whitespace-nowrap">{detalle}</td>
                              <td className="p-3 text-right font-mono text-[13px] font-black text-green-600 whitespace-nowrap">{entrada > 0 ? entrada.toLocaleString('es-VE') : '-'}</td>
                              <td className="p-3 text-right font-mono text-[13px] font-black text-red-600 whitespace-nowrap">{salida > 0 ? salida.toLocaleString('es-VE') : '-'}</td>
                              <td className="p-3 text-right font-mono text-[13px] font-black text-blue-700 whitespace-nowrap">{entry.newStock.toLocaleString('es-VE')}</td>
                              <td className="p-3 text-right font-mono text-[12px] font-bold text-gray-800 whitespace-nowrap">{entry.costUsd ? formatUsd(entry.costUsd, 4) : '-'}</td>
                            </tr>
                          );
                        });
                      })()}
                      {getKardexForProduct(viewingKardex.id).length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-400 italic text-sm">No hay movimientos registrados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-4 text-[10px] text-gray-400 text-center border-t pt-3">Los movimientos reflejan el historial completo de inventario del producto</div>
            </div>
            <div className="bg-gray-100 p-3 border-t flex justify-end"><Button onClick={() => setViewingKardex(null)} variant="ghost" className="text-sm font-bold px-5">CERRAR</Button></div>
          </DialogContent>
        </Dialog>
      )}
      
      <Dialog open={!!adjustingStock} onOpenChange={() => setAdjustingStock(null)}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-amber-500 p-3 text-white rounded-t-xl"><div className="flex justify-between items-center"><DialogTitle className="text-sm font-black">Ajustar Stock</DialogTitle><button onClick={() => setAdjustingStock(null)}><X size={16} /></button></div></DialogHeader>
          <div className="p-4 space-y-3">
            <div><label className="text-[9px] font-black uppercase block mb-1">Cantidad a ajustar (negativa para quitar, positiva para agregar)</label><Input type="number" value={adjustmentDelta} onChange={(e) => setAdjustmentDelta(e.target.value)} className="text-sm" placeholder="Ej: +5 o -3" />{adjustingStock && <p className="text-[8px] text-black/50 mt-1">Stock actual: {adjustingStock.stock} uds → Nuevo stock: {adjustingStock.stock + (parseInt(adjustmentDelta) || 0)} uds</p>}</div>
            <div><label className="text-[9px] font-black uppercase block mb-1">Motivo del Ajuste</label><textarea value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} rows={2} className="w-full border rounded-lg px-2 py-1 text-xs resize-none" placeholder="Ej: Rotura, merma, inventario físico, sobrante..." /></div>
            <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setAdjustingStock(null)}>CANCELAR</Button><Button onClick={confirmStockAdjustmentRequest} className="bg-amber-500 text-white font-black h-7 text-xs px-4">SOLICITAR AJUSTE</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showAuthCodeModal} onOpenChange={setShowAuthCodeModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-red-600 p-3 text-white rounded-t-xl"><DialogTitle className="text-sm font-black flex items-center gap-2"><AlertTriangle size={14} /> Autorización requerida</DialogTitle></DialogHeader>
          <div className="p-4 space-y-3"><p className="text-xs text-black/70">Ingrese el código de autorización para realizar este ajuste de inventario:</p><Input type="password" placeholder="Código de seguridad" value={authCodeInput} onChange={(e) => setAuthCodeInput(e.target.value)} className="font-mono text-center text-base" autoFocus /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowAuthCodeModal(false)}>Cancelar</Button><Button onClick={verifyAuthCode} className="bg-red-600 text-white">Verificar y Ajustar</Button></div></div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-xs font-black">🏷️ Gestionar Categorías</DialogTitle></DialogHeader>
          <div className="p-3">
            <div className="flex gap-2 mb-3"><Input placeholder="Nueva categoría..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 h-7 text-xs" onKeyPress={(e) => e.key === 'Enter' && addCategory()} /><Button onClick={addCategory} className="bg-primary text-black h-7 text-xs px-3">AGREGAR</Button></div>
            <div className="max-h-52 overflow-y-auto border rounded-lg divide-y">{categories.map(cat => (<div key={cat} className="flex justify-between items-center px-2 py-1.5"><span className="text-xs">{cat}</span>{cat !== 'Otro' && (<button onClick={() => deleteCategory(cat)} className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>)}</div>))}</div>
            <p className="text-[8px] text-black/40 mt-2 text-center">* La categoría "Otro" no se puede eliminar</p>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showDepartmentModal} onOpenChange={setShowDepartmentModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-xs font-black">📁 Gestionar Departamentos</DialogTitle></DialogHeader>
          <div className="p-3">
            <div className="flex gap-2 mb-3"><Input placeholder="Nuevo departamento..." value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1 h-7 text-xs" onKeyPress={(e) => e.key === 'Enter' && addDepartment()} /><Button onClick={addDepartment} className="bg-primary text-black h-7 text-xs px-3">AGREGAR</Button></div>
            <div className="max-h-52 overflow-y-auto border rounded-lg divide-y">{departments.map(dept => (<div key={dept} className="flex justify-between items-center px-2 py-1.5"><span className="text-xs">{dept}</span>{dept !== 'Otros' && (<button onClick={() => deleteDepartment(dept)} className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>)}</div>))}</div>
            <p className="text-[8px] text-black/40 mt-2 text-center">* El departamento "Otros" no se puede eliminar</p>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showGlobalIvaModal} onOpenChange={setShowGlobalIvaModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-sm font-black">Ajuste de IVA Global</DialogTitle></DialogHeader>
          <div className="p-4 space-y-4">
            <div><label className="text-[10px] font-black uppercase text-black/60 block mb-1">Nuevo porcentaje de IVA (%)</label><Input type="number" step="0.1" value={newGlobalIva} onChange={(e) => setNewGlobalIva(Number(e.target.value))} className="font-bold" /></div>
            <div className="bg-amber-50 p-2 rounded-lg border border-amber-200"><p className="text-[9px] text-amber-700 flex items-center gap-1"><AlertTriangle size={10} /> Esta acción actualizará TODOS los productos marcados como "Con I.V.A.".</p><p className="text-[8px] text-amber-600 mt-1">Solo se puede realizar si la caja está cerrada.</p></div>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowGlobalIvaModal(false)}>CANCELAR</Button><Button onClick={applyGlobalIva} className="bg-primary text-black font-black">APLICAR CAMBIO</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingProduct(null); resetForm(); } }}>
        <DialogContent className="bg-white max-w-3xl p-0 rounded-xl max-h-[90vh] flex flex-col">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl flex-shrink-0">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-sm font-black">{editingProduct ? 'Editar' : 'Nuevo'} Producto</DialogTitle>
              <button type="button" onClick={() => setIsAdding(false)}><X size={16} /></button>
            </div>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div><label className="text-[8px] font-black uppercase">Código de Barras</label><Input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="h-7 text-xs" required /></div>
                  <div><label className="text-[8px] font-black uppercase">Nombre del Producto</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-7 text-xs" required /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[8px] font-black uppercase">Departamento</label><select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full h-7 border rounded px-2 text-xs bg-white">{departments.map(d => <option key={d}>{d}</option>)}</select></div>
                    <div><label className="text-[8px] font-black uppercase">Categoría</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})} className="w-full h-7 border rounded px-2 text-xs bg-white">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[8px] font-black uppercase">Stock Inicial</label><Input type="text" inputMode="numeric" value={stockInput} onChange={(e) => setStockInput(e.target.value)} className={cn("h-7 text-xs", !!editingProduct && "bg-gray-100 opacity-70")} placeholder="0" readOnly={!!editingProduct} /></div>
                    <div><label className="text-[8px] font-black uppercase">Stock Mínimo</label><Input type="text" inputMode="numeric" value={minStockInput} onChange={(e) => setMinStockInput(e.target.value)} className="h-7 text-xs" placeholder="5" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[8px] font-black uppercase">Precio Mayor (USD)</label><Input type="text" inputMode="decimal" value={priceWholesaleInput} onChange={(e) => setPriceWholesaleInput(e.target.value)} className="h-7 text-xs" placeholder="0.00" /></div>
                    <div><label className="text-[8px] font-black uppercase">Precio Costo (USD)</label><Input type="text" inputMode="decimal" value={priceCostInput} onChange={(e) => setPriceCostInput(e.target.value)} className="h-7 text-xs" placeholder="0.00" /></div>
                  </div>
                  <div className="border-t pt-2 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isKit} onChange={e => setIsKit(e.target.checked)} className="rounded text-primary" /><span className="text-[9px] font-black uppercase">Es kit / compuesto</span></label>
                    <p className="text-[7px] text-black/40 mt-1">Al vender este producto, se descontarán las cantidades de sus componentes.</p>
                  </div>
                  {isKit && (
                    <div className="border border-dashed border-blue-300 rounded-lg p-2 bg-blue-50/30 space-y-2">
                      <div className="flex items-center justify-between bg-white/50 rounded p-1.5"><span className="text-[8px] font-bold uppercase">Stock del kit:</span><div className="flex gap-2"><button type="button" onClick={() => setKitHasOwnStock(false)} className={cn("px-2 py-0.5 rounded text-[9px] font-bold transition-all", !containerHasOwnStock ? "bg-primary text-black" : "bg-gray-200 text-gray-600")}>Sin stock propio</button><button type="button" onClick={() => setKitHasOwnStock(true)} className={cn("px-2 py-0.5 rounded text-[9px] font-bold transition-all", containerHasOwnStock ? "bg-primary text-black" : "bg-gray-200 text-gray-600")}>Con stock propio</button></div></div>
                      <p className="text-[7px] text-blue-700 bg-blue-100 rounded px-2 py-1">{!containerHasOwnStock ? "📦 Sin stock propio: El kit siempre se puede vender si hay suficiente stock de sus componentes. Al vender, SOLO se descuentan los componentes." : "⚠️ Con stock propio: El kit tiene su propio inventario. Al vender, se descuenta 1 del kit + las cantidades de sus componentes."}</p>
                      <p className="text-[8px] font-bold text-blue-800 mb-1 flex items-center gap-1"><Package size={10} /> Componentes del kit</p>
                      <div className="space-y-2">
                        {kitComponents.length > 0 && (<div className="max-h-24 overflow-y-auto space-y-1">{kitComponents.map(comp => { const childProd = products.find(p => p.id === comp.productId); return <div key={comp.productId} className="flex justify-between items-center bg-white rounded px-2 py-1 text-[10px]"><span>{childProd?.name || 'Producto'} x{comp.quantity}</span><button type="button" onClick={() => removeKitComponent(comp.productId)} className="text-red-500"><Trash2 size={10} /></button></div>; })}</div>)}
                        <div className="flex flex-col gap-1">
                          <div className="relative"><Input type="text" placeholder="Buscar producto componente..." value={searchChildProduct} onChange={(e) => { setSearchChildProduct(e.target.value); setHideChildResults(false); if (selectedChildProduct && e.target.value !== selectedChildProduct.name) setSelectedChildProduct(null); }} className="h-7 text-xs pr-7" />{!hideChildResults && searchChildProduct && childProductResults.length > 0 && (<div className="absolute top-full left-0 right-0 bg-white border rounded shadow z-20 mt-1 max-h-24 overflow-y-auto">{childProductResults.map(p => (<button key={p.id} type="button" onClick={() => { setSelectedChildProduct(p); setSearchChildProduct(p.name); setHideChildResults(true); }} className="w-full text-left px-2 py-1 text-[10px] hover:bg-primary/10">{p.name} ({formatUsd(p.priceUsd)})</button>))}</div>)}</div>
                          {selectedChildProduct && (<div className="flex gap-1 items-center"><Input type="text" inputMode="numeric" value={childQuantity} onChange={e => setChildQuantity(e.target.value)} className="h-7 text-xs w-20 text-center" placeholder="Cant." /><Button type="button" onClick={addKitComponent} size="sm" className="h-7 text-[9px] bg-primary text-black">Agregar</Button></div>)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
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
                        if (costVal > 0) {
                          const newPriceUsd = roundTo2(costVal / (1 - profitVal / 100));
                          setLocalPriceUsd(newPriceUsd.toFixed(2));
                          setPriceRetailBs(roundTo2(newPriceUsd * state.exchangeRate).toFixed(2));
                        } else if (costVal === 0) {
                          setLocalPriceUsd('');
                          setPriceRetailBs('');
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
                          const raw = e.target.value;
                          setProfitPercentInput(raw);
                          const newProfit = parseFloat(raw);
                          const costVal = parseFloat(costUsdInput) || 0;
                          if (!isNaN(newProfit) && costVal > 0) {
                            const newPriceUsd = roundTo2(costVal / (1 - newProfit / 100));
                            setLocalPriceUsd(newPriceUsd.toFixed(2));
                            setPriceRetailBs(roundTo2(newPriceUsd * state.exchangeRate).toFixed(2));
                            setIsPriceFixed(true);
                          } else if (costVal === 0) {
                            setLocalPriceUsd('');
                            setPriceRetailBs('');
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
                        value={localPriceUsd}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                            setLocalPriceUsd(raw);
                            const usdVal = parseFloat(raw);
                            const costVal = parseFloat(costUsdInput) || 0;
                            if (!isNaN(usdVal) && usdVal > 0 && costVal > 0) {
                              const newProfit = roundTo2(((usdVal / costVal) - 1) * 100);
                              setProfitPercentInput(newProfit.toString());
                              setPriceRetailBs(roundTo2(usdVal * state.exchangeRate).toFixed(2));
                              setIsPriceFixed(true);
                            } else if (usdVal === 0 || costVal === 0) {
                              if (costVal === 0 && usdVal > 0) {
                                setProfitPercentInput('');
                                setPriceRetailBs(roundTo2(usdVal * state.exchangeRate).toFixed(2));
                              } else if (usdVal === 0) {
                                setProfitPercentInput('');
                                setPriceRetailBs('');
                              }
                            }
                          }
                        }}
                        className="bg-white h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[7px] font-bold uppercase">Precio Detal Bs (final)</label>
                      <Input 
                        type="text" 
                        inputMode="decimal" 
                        value={priceRetailBs} 
                        onChange={(e) => { 
                          const newValue = e.target.value;
                          setPriceRetailBs(newValue);
                          const bsValue = parseFloat(newValue) || 0;
                          const costVal = parseFloat(costUsdInput) || 0;
                          if (bsValue > 0 && costVal > 0) {
                            const newPriceUsd = roundTo2(bsValue / state.exchangeRate);
                            setLocalPriceUsd(newPriceUsd.toFixed(2));
                            const newProfit = roundTo2(((newPriceUsd / costVal) - 1) * 100);
                            setProfitPercentInput(newProfit.toString());
                            setIsPriceFixed(true);
                          } else if (bsValue === 0 || costVal === 0) {
                            if (costVal === 0 && bsValue > 0) {
                              const newPriceUsd = roundTo2(bsValue / state.exchangeRate);
                              setLocalPriceUsd(newPriceUsd.toFixed(2));
                              setProfitPercentInput('');
                            } else if (bsValue === 0) {
                              setLocalPriceUsd('');
                              setProfitPercentInput('');
                            }
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
                        const defaultProfit = DEFAULT_PROFIT_PERCENT;
                        if (costVal > 0) {
                          const priceUsd = calculatePriceUsdFromCostAndProfit(costVal, defaultProfit);
                          setProfitPercentInput(defaultProfit.toString());
                          setLocalPriceUsd(priceUsd.toFixed(2));
                          setPriceRetailBs(roundTo2(priceUsd * state.exchangeRate).toFixed(2));
                        } else {
                          setProfitPercentInput(defaultProfit.toString());
                          setLocalPriceUsd('');
                          setPriceRetailBs('');
                        }
                        setIsPriceFixed(false);
                      }} 
                      className="h-7 text-[9px] px-3 bg-primary text-black font-bold"
                    >
                      <RefreshCw size={12} className="mr-1" /> Sincronizar
                    </Button>
                  </div>
                  <div className="border-t pt-2 mt-1"><label className="text-[7px] font-bold uppercase text-black/60 block mb-1">Configuración de IVA</label><div className="flex gap-2"><button type="button" onClick={() => setIvaType('con_iva')} className={cn("flex-1 py-1 text-[9px] font-bold rounded border", ivaType === 'con_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300")}>Con I.V.A.</button><button type="button" onClick={() => setIvaType('sin_iva')} className={cn("flex-1 py-1 text-[9px] font-bold rounded border", ivaType === 'sin_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300")}>Sin I.V.A.</button></div>{ivaType === 'con_iva' && (<div className="flex items-center gap-2 mt-2"><Percent size={10} className="text-black/40" /><Input type="text" inputMode="decimal" value={isNaN(ivaPercentage) ? '' : ivaPercentage} onChange={(e) => setIvaPercentage(e.target.value === '' ? 0 : Number(e.target.value))} className="h-6 text-[9px] w-20 text-center" /><span className="text-[8px] text-black/60">% de I.V.A.</span></div>)}</div>
                  <div className="bg-white rounded p-1.5 border mt-2">
                    <div className="flex justify-between text-[10px]"><span className="text-black/60">Precio Base USD (sin IVA):</span><span className="font-black text-secondary">{formatUsd((() => { const costVal = parseFloat(costUsdInput) || 0; const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT; return calculatePriceUsdFromCostAndProfit(costVal, profitVal); })())}</span></div>
                    {ivaType === 'con_iva' && (<div className="flex justify-between text-[9px]"><span className="text-black/60">+ IVA ({isNaN(ivaPercentage) ? 0 : ivaPercentage}%):</span><span className="text-black/70">{formatUsd((() => { const costVal = parseFloat(costUsdInput) || 0; const profitVal = parseFloat(profitPercentInput) || DEFAULT_PROFIT_PERCENT; const priceUsd = calculatePriceUsdFromCostAndProfit(costVal, profitVal); return priceUsd * (isNaN(ivaPercentage) ? 0 : ivaPercentage) / 100; })())}</span></div>)}
                    <div className="flex justify-between text-[10px] pt-1 border-t mt-1"><span className="text-black/60">Precio Mayor USD:</span><span className="font-black text-secondary">{formatUsd(parseFloat(priceWholesaleInput) || 0)}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-black/60">Precio Costo USD:</span><span className="font-black text-secondary">{formatUsd(parseFloat(priceCostInput) || 0)}</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-[#F5F5F5] p-3 border-t flex justify-end gap-2 flex-shrink-0"><Button type="submit" className="bg-primary text-black font-black px-6 h-8 text-xs">GUARDAR PRODUCTO</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}