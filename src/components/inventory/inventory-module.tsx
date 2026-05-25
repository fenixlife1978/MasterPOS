"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Plus, Search, Pencil, Trash2, X, 
  Tag, Settings, History, RefreshCw, Save,
  FileText, Share2, Printer, Percent, AlertTriangle,
  DollarSign, Package, Layers, Boxes, PlusCircle
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product, Category, AdminCode, KitComponent } from '@/lib/types';
import { syncService } from '@/services/syncService';

// Claves para caché en localStorage
const CACHE_KEYS = {
  PRODUCTS: 'inventory_products_cache',
  CATEGORIES: 'inventory_categories_cache',
  DEPARTMENTS: 'inventory_departments_cache',
  KARDEX: 'inventory_kardex_cache',
  IVA_TYPE: 'product_iva_type',
  IVA_PERCENTAGE: 'product_iva_percentage',
};

// Tipos locales (coinciden con los de types.ts)
interface KardexEntry {
  id: string;
  productId: number;
  date: string;
  type: 'venta' | 'compra' | 'ajuste_inicial' | 'ajuste_manual';
  quantity: number;
  previousStock: number;
  newStock: number;
  reference: string;
  note: string;
}

// Valores por defecto (se sincronizarán con Firestore al iniciar)
const DEFAULT_CATEGORIES: Category[] = ['Whisky', 'Ron', 'Cerveza', 'Vino', 'Vodka', 'Tequila', 'Licor', 'Gin', 'Otro'];
const DEFAULT_DEPARTMENTS = ['Polar', 'Munchy', 'Otros'];

export default function InventoryModule({ state }: { state: ReturnType<typeof usePOSState> }) {
  const { toast } = useToast();
  
  // ==================== ESTADOS LOCALES ====================
  // UI y filtros
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [viewingKardex, setViewingKardex] = useState<Product | null>(null);
  
  // Ajuste de stock con autorización
  const [adjustingStock, setAdjustingStock] = useState<Product | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showAuthCodeModal, setShowAuthCodeModal] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [pendingAdjustment, setPendingAdjustment] = useState<{ product: Product; newQty: number; reason: string } | null>(null);
  
  // Gestión de categorías y departamentos
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  
  // Configuración de IVA para el formulario de producto
  const [ivaType, setIvaType] = useState<'con_iva' | 'sin_iva'>('con_iva');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  
  // Datos principales (caché local sincronizada con Firestore)
  const [products, setProducts] = useState<Product[]>([]);
  const [kardexEntries, setKardexEntries] = useState<Record<number, KardexEntry[]>>({});
  
  // Formulario de producto (incluye los tres precios)
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    department: '',
    category: 'Otro' as Category,
    stock: 0,
    minStock: 5,
    costUsd: 0,
    profitPercent: 30,
    priceWholesale: 0,
    priceCost: 0,
  });
  
  // ==================== NUEVO: KITS / COMBOS ====================
  const [isKit, setIsKit] = useState(false);
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  const [searchChildProduct, setSearchChildProduct] = useState('');
  const [selectedChildProduct, setSelectedChildProduct] = useState<Product | null>(null);
  const [childQuantity, setChildQuantity] = useState('1');
  
  const childProductResults = useMemo(() => {
    if (!searchChildProduct.trim()) return [];
    const q = searchChildProduct.toLowerCase();
    return products.filter(p => 
      p.id !== editingProduct?.id && 
      (p.name.toLowerCase().includes(q) || p.barcode.includes(q))
    ).slice(0, 5);
  }, [searchChildProduct, products, editingProduct]);
  
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
  };
  
  const removeKitComponent = (productId: number) => {
    setKitComponents(prev => prev.filter(c => c.productId !== productId));
  };
  
  // ==================== INICIALIZACIÓN: CARGAR DESDE CACHÉ Y FIRESTORE ====================
  useEffect(() => {
    // 1. Carga inmediata desde localStorage (muestra datos antiguos mientras llegan los nuevos)
    const cachedProducts = localStorage.getItem(CACHE_KEYS.PRODUCTS);
    if (cachedProducts) {
      try { setProducts(JSON.parse(cachedProducts)); } catch(e) {}
    }
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
    
    // 2. Suscripciones en tiempo real a Firestore (actualizan caché y estado)
    // Productos
    const unsubProducts = syncService.subscribeToProducts((data: Product[]) => {
      setProducts(data);
      localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(data));
    });
    
    // Configuración global (categorías, departamentos, IVA global)
    const unsubSettings = syncService.subscribeToGlobalSettings?.((settings: any) => {
      if (settings) {
        if (settings.categories) setCategories(settings.categories);
        if (settings.departments) setDepartments(settings.departments);
        if (settings.defaultIvaPercentage) setIvaPercentage(settings.defaultIvaPercentage);
        // Guardar en caché
        if (settings.categories) localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(settings.categories));
        if (settings.departments) localStorage.setItem(CACHE_KEYS.DEPARTMENTS, JSON.stringify(settings.departments));
      }
    }) || (() => {});
    
    // Kardex (solo para los productos que se van viendo, se podría cargar bajo demanda)
    const unsubKardex = syncService.subscribeToKardex?.((entries: KardexEntry[]) => {
      const grouped: Record<number, KardexEntry[]> = {};
      entries.forEach(entry => {
        if (!grouped[entry.productId]) grouped[entry.productId] = [];
        grouped[entry.productId].push(entry);
      });
      setKardexEntries(grouped);
      localStorage.setItem(CACHE_KEYS.KARDEX, JSON.stringify(grouped));
    }) || (() => {});
    
    return () => {
      unsubProducts();
      if (typeof unsubSettings === 'function') unsubSettings();
      if (typeof unsubKardex === 'function') unsubKardex();
    };
  }, []);
  
  // ==================== FUNCIONES AUXILIARES ====================
  // Calcula el precio al detal según la fórmula proporcionada
  const calculateRetailPrice = (cost: number, profitPercent: number, ivaPercent: number, applyIva: boolean): number => {
    if (profitPercent >= 100) return cost * 100;
    const divisor = (100 - profitPercent) / 100;
    const basePrice = cost / divisor;
    return applyIva ? basePrice * (1 + ivaPercent / 100) : basePrice;
  };
  
  // Obtiene el stock mínimo de un producto (para estilos)
  const getProductMinStock = (product: Product) => product.minStock || 5;
  
  // ==================== MANEJO DE PRODUCTOS (CRUD) ====================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(formData.costUsd);
    const profit = Number(formData.profitPercent);
    const iva = ivaType === 'con_iva' ? ivaPercentage : 0;
    const retailPrice = calculateRetailPrice(cost, profit, iva, ivaType === 'con_iva');
    
    const productData: Product = {
      id: editingProduct?.id || Date.now(),
      barcode: formData.barcode,
      name: formData.name,
      department: formData.department || 'Otros',
      category: formData.category,
      stock: Number(formData.stock),
      minStock: Number(formData.minStock),
      costUsd: cost,
      costBs: cost * state.exchangeRate,
      profitPercent: profit,
      priceUsd: retailPrice,
      priceBs: retailPrice * state.exchangeRate,
      priceRetail: retailPrice,
      priceWholesale: Number(formData.priceWholesale),
      priceCost: Number(formData.priceCost),
      ivaType: ivaType,
      ivaPercentage: ivaType === 'con_iva' ? ivaPercentage : undefined,
      // ✅ Nuevos campos para kits
      isKit: isKit,
      kitComponents: isKit && kitComponents.length > 0 ? kitComponents : undefined,
    };
    
    if (editingProduct) {
      await state.updateProduct(productData);
      toast({ title: "Actualizado", description: "Producto modificado correctamente." });
    } else {
      await state.addProduct(productData);
      // Registrar entrada inicial en Kardex - ID ÚNICO con timestamp + random
      const kardexEntry: KardexEntry = {
        id: `${Date.now()}_${Math.random()}`,
        productId: productData.id,
        date: new Date().toLocaleString('es-VE'),
        type: 'ajuste_inicial',
        quantity: productData.stock,
        previousStock: 0,
        newStock: productData.stock,
        reference: 'Creación de producto',
        note: 'Stock inicial'
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
      profitPercent: p.profitPercent || 30,
      priceWholesale: p.priceWholesale || 0,
      priceCost: p.priceCost || 0,
    });
    setIvaType(p.ivaType || 'con_iva');
    setIvaPercentage(p.ivaPercentage || 16);
    // ✅ Cargar datos del kit si existe
    setIsKit(p.isKit || false);
    setKitComponents(p.kitComponents || []);
    setIsAdding(true);
  };
  
  const resetForm = () => {
    setFormData({
      barcode: '', name: '', department: 'Otros', category: 'Otro', stock: 0, minStock: 5,
      costUsd: 0, profitPercent: 30, priceWholesale: 0, priceCost: 0
    });
    setIvaType('con_iva');
    setIvaPercentage(16);
    // ✅ Limpiar estados de kit
    setIsKit(false);
    setKitComponents([]);
    setSearchChildProduct('');
    setSelectedChildProduct(null);
    setChildQuantity('1');
  };
  
  // ==================== KARDEX ====================
  const addKardexEntryLocal = (productId: number, entry: KardexEntry) => {
    setKardexEntries(prev => ({
      ...prev,
      [productId]: [entry, ...(prev[productId] || [])]
    }));
    // Actualizar caché
    const updated = { ...kardexEntries, [productId]: [entry, ...(kardexEntries[productId] || [])] };
    localStorage.setItem(CACHE_KEYS.KARDEX, JSON.stringify(updated));
  };
  
  const getKardexForProduct = (productId: number): KardexEntry[] => {
    return kardexEntries[productId] || [];
  };
  
  // ==================== AJUSTE DE STOCK CON CÓDIGO DE AUTORIZACIÓN ====================
  const requestStockAdjust = (product: Product) => {
    setAdjustingStock(product);
    setAdjustmentQuantity('');
    setAdjustmentReason('');
  };
  
  const confirmStockAdjustmentRequest = () => {
    if (!adjustingStock) return;
    const newQty = parseInt(adjustmentQuantity);
    if (isNaN(newQty) || newQty < 0) {
      toast({ title: "Error", description: "Ingrese una cantidad válida", variant: "destructive" });
      return;
    }
    if (!adjustmentReason.trim()) {
      toast({ title: "Error", description: "Ingrese un motivo para el ajuste", variant: "destructive" });
      return;
    }
    setPendingAdjustment({
      product: adjustingStock,
      newQty,
      reason: adjustmentReason
    });
    setShowAuthCodeModal(true);
  };
  
  const verifyAuthCode = async () => {
    const adminCodeData = await syncService.getAdminCode();
    if (adminCodeData && adminCodeData.code === authCodeInput) {
      if (pendingAdjustment) {
        const { product, newQty, reason } = pendingAdjustment;
        const previousStock = product.stock;
        const updatedProduct = { ...product, stock: newQty };
        await state.updateProduct(updatedProduct);
        
        // ID ÚNICO con timestamp + random
        const kardexEntry: KardexEntry = {
          id: `${Date.now()}_${Math.random()}`,
          productId: product.id,
          date: new Date().toLocaleString('es-VE'),
          type: 'ajuste_manual',
          quantity: newQty - previousStock,
          previousStock,
          newStock: newQty,
          reference: 'Ajuste manual',
          note: reason
        };
        await syncService.saveKardexEntry?.(kardexEntry);
        addKardexEntryLocal(product.id, kardexEntry);
        
        toast({ title: "Ajuste Realizado", description: `Stock actualizado de ${previousStock} a ${newQty} unidades` });
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
    // Actualizar todos los productos con ivaType === 'con_iva'
    const updatedProducts = products.map(p => {
      if (p.ivaType === 'con_iva') {
        const newRetail = calculateRetailPrice(p.costUsd || 0, p.profitPercent || 30, newGlobalIva, true);
        return { 
          ...p, 
          ivaPercentage: newGlobalIva, 
          priceRetail: newRetail, 
          priceUsd: newRetail, 
          priceBs: newRetail * state.exchangeRate 
        };
      }
      return p;
    });
    for (const prod of updatedProducts) {
      await state.updateProduct(prod);
    }
    // Guardar nueva configuración global en Firestore
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
    // Actualizar en Firestore (dentro de global_settings)
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
    
    // Calcular filteredProducts para el PDF
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
            <span>TASA BCV: Bs ${state.exchangeRate.toFixed(2)}</span>
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
                  <td class="text-right">$${p.priceUsd.toFixed(2)}</td>
                  <td class="text-right">Bs ${p.priceBs.toFixed(2)}</td>
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
  
  // ==================== RENDERIZADO ====================
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header con tasa y botón de ajuste global de IVA */}
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
            <div className="text-base font-black text-primary">Bs {state.exchangeRate.toFixed(2)}</div>
          </div>
        </div>
      </div>
      
      {/* Barra de filtros y acciones */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 mt-4">
        <div className="flex justify-between items-center mb-3 gap-2 flex-wrap flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
            <Input 
              placeholder="Buscar producto..." 
              className="pl-9 h-8 border-[#9E9E9E] text-xs" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          
          <div className="flex items-center gap-1">
            <select 
              value={filterDepartment} 
              onChange={(e) => setFilterDepartment(e.target.value)} 
              className="h-8 border rounded-lg px-2 text-xs font-bold bg-white"
            >
              <option value="all">📁 Todos los Deptos.</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <button 
              onClick={() => setShowDepartmentModal(true)} 
              className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"
            >
              <Settings size={13} />
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value as any)} 
              className="h-8 border rounded-lg px-2 text-xs font-bold bg-white"
            >
              <option value="all">🏷️ Todas las Cats.</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <button 
              onClick={() => setShowCategoryModal(true)} 
              className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"
            >
              <Settings size={13} />
            </button>
          </div>
          
          <div className="flex items-center gap-1 ml-auto">
            <Button onClick={handleExportPDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black">
              <Printer size={13} className="mr-1" /> EXPORTAR PDF
            </Button>
            <Button onClick={handleSharePDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black">
              <Share2 size={13} className="mr-1" /> COMPARTIR
            </Button>
            <Button 
              onClick={() => { resetForm(); setEditingProduct(null); setIsAdding(true); }} 
              className="bg-primary text-black font-black h-8 text-[10px] px-3"
            >
              <Plus size={13} className="mr-1" /> NUEVO PRODUCTO
            </Button>
          </div>
        </div>
        
        {/* Tabla de productos */}
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
                    <TableCell>
                      <p className="font-bold text-xs text-black">{p.name}</p>
                      <p className="text-[8px] font-bold text-primary uppercase">{p.category} | {p.department || 'Sin Dept.'}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black border",
                        p.stock <= getProductMinStock(p) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {p.stock} UDS
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-black text-xs text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black text-xs text-black">Bs {p.priceBs.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <button 
                          onClick={() => setViewingKardex(p)} 
                          className="h-6 w-6 rounded hover:bg-blue-100 text-blue-600" 
                          title="Ver Kardex"
                        >
                          <History size={11} />
                        </button>
                        <button 
                          onClick={() => requestStockAdjust(p)} 
                          className="h-6 w-6 rounded hover:bg-amber-100 text-amber-600" 
                          title="Ajustar Stock"
                        >
                          <RefreshCw size={11} />
                        </button>
                        <button 
                          onClick={() => handleEdit(p)} 
                          className="h-6 w-6 rounded hover:bg-gray-100 text-blue-600"
                        >
                          <Pencil size={11} />
                        </button>
                        <button 
                          onClick={() => { if(confirm('¿Eliminar este producto?')) state.deleteProduct(p.id) }} 
                          className="h-6 w-6 rounded hover:bg-red-100 text-red-600"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-black/40 italic">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
      {/* ==================== MODALES ==================== */}
      
      {/* Modal de Kardex */}
      {viewingKardex && (
        <Dialog open={true} onOpenChange={() => setViewingKardex(null)}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-3xl p-0 overflow-hidden rounded-xl shadow-xl max-h-[85vh]">
            <DialogHeader className="bg-[#1A2C4E] p-4 text-white sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="text-base font-black flex items-center gap-2">
                    <History size={16} /> Tarjeta Kardex
                  </DialogTitle>
                  <p className="text-xs opacity-70">{viewingKardex.name}</p>
                </div>
                <button onClick={() => setViewingKardex(null)}><X size={18} /></button>
              </div>
            </DialogHeader>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="bg-slate-50 p-3 rounded-lg mb-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Stock Actual</p>
                  <p className={cn("text-xl font-black", viewingKardex.stock === 0 ? "text-red-600" : "text-green-600")}>
                    {viewingKardex.stock} UDS
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Precio USD</p>
                  <p className="text-xl font-black text-secondary">${viewingKardex.priceUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Valor Inventario</p>
                  <p className="text-xl font-black text-blue-600">${(viewingKardex.priceUsd * viewingKardex.stock).toFixed(2)}</p>
                </div>
              </div>
              <table className="w-full text-left text-[9px]">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-1.5">FECHA</th>
                    <th className="p-1.5">TIPO</th>
                    <th className="p-1.5 text-right">CANTIDAD</th>
                    <th className="p-1.5 text-right">STOCK PREVIO</th>
                    <th className="p-1.5 text-right">STOCK NUEVO</th>
                    <th className="p-1.5">MOTIVO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getKardexForProduct(viewingKardex.id).map((entry, idx) => (
                    <tr key={`${entry.id}_${idx}`} className="hover:bg-slate-50">
                      <td className="p-1.5 font-mono">{entry.date}</td>
                      <td className="p-1.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full text-[8px] font-bold",
                          entry.type === 'venta' ? "bg-red-100 text-red-700" :
                          entry.type === 'compra' ? "bg-green-100 text-green-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {entry.type === 'venta' ? 'VENTA' : entry.type === 'compra' ? 'COMPRA' : 'AJUSTE'}
                        </span>
                      </td>
                      <td className={cn("p-1.5 text-right font-mono font-bold", entry.quantity < 0 ? "text-red-600" : "text-green-600")}>
                        {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                       </td>
                      <td className="p-1.5 text-right font-mono">{entry.previousStock}</td>
                      <td className="p-1.5 text-right font-mono font-bold">{entry.newStock}</td>
                      <td className="p-1.5 text-slate-500 max-w-[150px] truncate">{entry.note || entry.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 p-2 border-t flex justify-end">
              <Button onClick={() => setViewingKardex(null)} variant="ghost" size="sm">CERRAR</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Modal de ajuste de stock (solicitud de nueva cantidad) */}
      <Dialog open={!!adjustingStock} onOpenChange={() => setAdjustingStock(null)}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-amber-500 p-3 text-white rounded-t-xl">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-sm font-black">Ajustar Stock</DialogTitle>
              <button onClick={() => setAdjustingStock(null)}><X size={16} /></button>
            </div>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[9px] font-black uppercase block mb-1">Nueva Cantidad</label>
              <Input 
                type="number" 
                value={adjustmentQuantity} 
                onChange={(e) => setAdjustmentQuantity(e.target.value)} 
                className="text-sm" 
                placeholder="Ingrese la nueva cantidad"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase block mb-1">Motivo del Ajuste</label>
              <textarea 
                value={adjustmentReason} 
                onChange={(e) => setAdjustmentReason(e.target.value)} 
                rows={2} 
                className="w-full border rounded-lg px-2 py-1 text-xs resize-none" 
                placeholder="Ej: Rotura, merma, inventario físico..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdjustingStock(null)}>CANCELAR</Button>
              <Button onClick={confirmStockAdjustmentRequest} className="bg-amber-500 text-white font-black h-7 text-xs px-4">
                SOLICITAR AJUSTE
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de autorización (código de administrador) */}
      <Dialog open={showAuthCodeModal} onOpenChange={setShowAuthCodeModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-red-600 p-3 text-white rounded-t-xl">
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <AlertTriangle size={14} /> Autorización requerida
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <p className="text-xs text-black/70">Ingrese el código de autorización para realizar este ajuste de inventario:</p>
            <Input 
              type="password" 
              placeholder="Código de seguridad" 
              value={authCodeInput} 
              onChange={(e) => setAuthCodeInput(e.target.value)} 
              className="font-mono text-center text-base"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAuthCodeModal(false)}>Cancelar</Button>
              <Button onClick={verifyAuthCode} className="bg-red-600 text-white">Verificar y Ajustar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de gestión de categorías */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl">
            <DialogTitle className="text-xs font-black">🏷️ Gestionar Categorías</DialogTitle>
          </DialogHeader>
          <div className="p-3">
            <div className="flex gap-2 mb-3">
              <Input 
                placeholder="Nueva categoría..." 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value)} 
                className="flex-1 h-7 text-xs" 
                onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              />
              <Button onClick={addCategory} className="bg-primary text-black h-7 text-xs px-3">AGREGAR</Button>
            </div>
            <div className="max-h-52 overflow-y-auto border rounded-lg divide-y">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center px-2 py-1.5">
                  <span className="text-xs">{cat}</span>
                  {cat !== 'Otro' && (
                    <button onClick={() => deleteCategory(cat)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[8px] text-black/40 mt-2 text-center">* La categoría "Otro" no se puede eliminar</p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de gestión de departamentos */}
      <Dialog open={showDepartmentModal} onOpenChange={setShowDepartmentModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl">
            <DialogTitle className="text-xs font-black">📁 Gestionar Departamentos</DialogTitle>
          </DialogHeader>
          <div className="p-3">
            <div className="flex gap-2 mb-3">
              <Input 
                placeholder="Nuevo departamento..." 
                value={newDepartment} 
                onChange={(e) => setNewDepartment(e.target.value)} 
                className="flex-1 h-7 text-xs" 
                onKeyPress={(e) => e.key === 'Enter' && addDepartment()}
              />
              <Button onClick={addDepartment} className="bg-primary text-black h-7 text-xs px-3">AGREGAR</Button>
            </div>
            <div className="max-h-52 overflow-y-auto border rounded-lg divide-y">
              {departments.map(dept => (
                <div key={dept} className="flex justify-between items-center px-2 py-1.5">
                  <span className="text-xs">{dept}</span>
                  {dept !== 'Otros' && (
                    <button onClick={() => deleteDepartment(dept)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[8px] text-black/40 mt-2 text-center">* El departamento "Otros" no se puede eliminar</p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de ajuste global de IVA */}
      <Dialog open={showGlobalIvaModal} onOpenChange={setShowGlobalIvaModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl">
            <DialogTitle className="text-sm font-black">Ajuste de IVA Global</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-black/60 block mb-1">Nuevo porcentaje de IVA (%)</label>
              <Input 
                type="number" 
                step="0.1" 
                value={newGlobalIva} 
                onChange={(e) => setNewGlobalIva(Number(e.target.value))} 
                className="font-bold"
              />
            </div>
            <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
              <p className="text-[9px] text-amber-700 flex items-center gap-1">
                <AlertTriangle size={10} /> Esta acción actualizará TODOS los productos marcados como "Con I.V.A.".
              </p>
              <p className="text-[8px] text-amber-600 mt-1">Solo se puede realizar si la caja está cerrada.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowGlobalIvaModal(false)}>CANCELAR</Button>
              <Button onClick={applyGlobalIva} className="bg-primary text-black font-black">APLICAR CAMBIO</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal para crear/editar producto (con tres precios y configuración de IVA) */}
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingProduct(null); resetForm(); } }}>
        <DialogContent className="bg-white max-w-2xl p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-sm font-black">{editingProduct ? 'Editar' : 'Nuevo'} Producto</DialogTitle>
              <button type="button" onClick={() => setIsAdding(false)}><X size={16} /></button>
            </div>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="p-4 grid grid-cols-2 gap-3">
              {/* Columna izquierda: datos básicos */}
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] font-black uppercase">Código de Barras</label>
                  <Input 
                    value={formData.barcode} 
                    onChange={e => setFormData({...formData, barcode: e.target.value})} 
                    className="h-7 text-xs" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase">Nombre del Producto</label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-7 text-xs" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-black uppercase">Departamento</label>
                    <select 
                      value={formData.department} 
                      onChange={e => setFormData({...formData, department: e.target.value})} 
                      className="w-full h-7 border rounded px-2 text-xs bg-white"
                    >
                      {departments.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Categoría</label>
                    <select 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value as Category})} 
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
                      type="number" 
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
                      className="h-7 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Stock Mínimo</label>
                    <Input 
                      type="number" 
                      value={formData.minStock} 
                      onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} 
                      className="h-7 text-xs" 
                    />
                  </div>
                </div>
                {/* Nuevos campos para precios Mayor y Costo */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-black uppercase">Precio Mayor (USD)</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.priceWholesale} 
                      onChange={e => setFormData({...formData, priceWholesale: Number(e.target.value)})} 
                      className="h-7 text-xs" 
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Precio Costo (USD)</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.priceCost} 
                      onChange={e => setFormData({...formData, priceCost: Number(e.target.value)})} 
                      className="h-7 text-xs" 
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                {/* ✅ SECCIÓN DE KIT / COMPUESTO */}
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
                  <div className="border border-dashed border-blue-300 rounded-lg p-2 bg-blue-50/30">
                    <p className="text-[8px] font-bold text-blue-800 mb-2 flex items-center gap-1"><Package size={10} /> Componentes del kit</p>
                    <div className="space-y-2">
                      {/* Lista actual de componentes */}
                      {kitComponents.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {kitComponents.map(comp => {
                            const childProd = products.find(p => p.id === comp.productId);
                            return (
                              <div key={comp.productId} className="flex justify-between items-center bg-white rounded px-2 py-1 text-[10px]">
                                <span>{childProd?.name || 'Producto'} x{comp.quantity}</span>
                                <button type="button" onClick={() => removeKitComponent(comp.productId)} className="text-red-500"><Trash2 size={10} /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Agregar nuevo componente */}
                      <div className="flex flex-col gap-1">
                        <div className="relative">
                          <Input 
                            type="text"
                            placeholder="Buscar producto componente..."
                            value={searchChildProduct}
                            onChange={(e) => setSearchChildProduct(e.target.value)}
                            className="h-7 text-xs pr-7"
                          />
                          {childProductResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border rounded shadow z-20 mt-1 max-h-32 overflow-y-auto">
                              {childProductResults.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedChildProduct(p);
                                    setSearchChildProduct(p.name);
                                  }}
                                  className="w-full text-left px-2 py-1 text-[10px] hover:bg-primary/10"
                                >
                                  {p.name} (${p.priceUsd.toFixed(2)})
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedChildProduct && (
                          <div className="flex gap-1 items-center">
                            <Input type="number" value={childQuantity} onChange={e => setChildQuantity(e.target.value)} className="h-7 text-xs w-20 text-center" placeholder="Cant." />
                            <Button type="button" onClick={addKitComponent} size="sm" className="h-7 text-[9px] bg-primary text-black">Agregar</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Columna derecha: costos, márgenes y configuración de IVA (sin cambios) */}
              <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[7px] font-bold uppercase">Costo Unitario USD</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.costUsd} 
                      onChange={e => setFormData({...formData, costUsd: Number(e.target.value)})} 
                      className="bg-white h-7 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-[7px] font-bold uppercase">% Ganancia (Margen)</label>
                    <Input 
                      type="number" 
                      value={formData.profitPercent} 
                      onChange={e => setFormData({...formData, profitPercent: Number(e.target.value)})} 
                      className="bg-white h-7 text-xs" 
                    />
                  </div>
                </div>
                
                {/* Selector de IVA por producto */}
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
                        type="number" 
                        step="0.1"
                        value={ivaPercentage}
                        onChange={(e) => setIvaPercentage(Number(e.target.value))}
                        className="h-6 text-[9px] w-20 text-center"
                      />
                      <span className="text-[8px] text-black/60">% de I.V.A.</span>
                    </div>
                  )}
                </div>
                
                {/* Precios calculados */}
                <div className="bg-white rounded p-1.5 border mt-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-black/60">Precio Base USD (sin IVA):</span>
                    <span className="font-black text-secondary">
                      ${calculateRetailPrice(formData.costUsd, formData.profitPercent, ivaType === 'con_iva' ? ivaPercentage : 0, false).toFixed(2)}
                    </span>
                  </div>
                  {ivaType === 'con_iva' && (
                    <div className="flex justify-between text-[9px]">
                      <span className="text-black/60">+ IVA ({ivaPercentage}%):</span>
                      <span className="text-black/70">
                        ${(calculateRetailPrice(formData.costUsd, formData.profitPercent, 0, false) * ivaPercentage / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] pt-1 border-t mt-1">
                    <span className="text-black/60">Precio Detal USD (final):</span>
                    <span className="font-black text-secondary">
                      ${calculateRetailPrice(formData.costUsd, formData.profitPercent, ivaType === 'con_iva' ? ivaPercentage : 0, ivaType === 'con_iva').toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-black/60">Precio Detal Bs:</span>
                    <span className="font-black">
                      Bs {(calculateRetailPrice(formData.costUsd, formData.profitPercent, ivaType === 'con_iva' ? ivaPercentage : 0, ivaType === 'con_iva') * state.exchangeRate).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-[#F5F5F5] p-2 border-t flex justify-end gap-2">
              <Button type="submit" className="bg-primary text-black font-black px-6 h-7 text-xs">GUARDAR PRODUCTO</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}