
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

const CACHE_KEYS = {
  PRODUCTS: 'inventory_products_cache',
  CATEGORIES: 'inventory_categories_cache',
  DEPARTMENTS: 'inventory_departments_cache',
  KARDEX: 'inventory_kardex_cache',
  IVA_TYPE: 'product_iva_type',
  IVA_PERCENTAGE: 'product_iva_percentage',
};

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

const DEFAULT_CATEGORIES: Category[] = ['Whisky', 'Ron', 'Cerveza', 'Vino', 'Vodka', 'Tequila', 'Licor', 'Gin', 'Otro'];
const DEFAULT_DEPARTMENTS = ['Polar', 'Munchy', 'Otros'];

export default function InventoryModule({ state }: { state: ReturnType<typeof usePOSState> }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [viewingKardex, setViewingKardex] = useState<Product | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<Product | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showAuthCodeModal, setShowAuthCodeModal] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [pendingAdjustment, setPendingAdjustment] = useState<{ product: Product; newQty: number; reason: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [ivaType, setIvaType] = useState<'con_iva' | 'sin_iva'>('con_iva');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  const [products, setProducts] = useState<Product[]>([]);
  const [kardexEntries, setKardexEntries] = useState<Record<number, KardexEntry[]>>({});
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
  const [isKit, setIsKit] = useState(false);
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  const [searchChildProduct, setSearchChildProduct] = useState('');
  const [selectedChildProduct, setSelectedChildProduct] = useState<Product | null>(null);
  const [childQuantity, setChildQuantity] = useState('1');

  useEffect(() => {
    const cachedProducts = localStorage.getItem(CACHE_KEYS.PRODUCTS);
    if (cachedProducts) { try { setProducts(JSON.parse(cachedProducts)); } catch(e) {} }
    const cachedCategories = localStorage.getItem(CACHE_KEYS.CATEGORIES);
    if (cachedCategories) { try { setCategories(JSON.parse(cachedCategories)); } catch(e) {} }
    const cachedDepartments = localStorage.getItem(CACHE_KEYS.DEPARTMENTS);
    if (cachedDepartments) { try { setDepartments(JSON.parse(cachedDepartments)); } catch(e) {} }
    const cachedKardex = localStorage.getItem(CACHE_KEYS.KARDEX);
    if (cachedKardex) { try { setKardexEntries(JSON.parse(cachedKardex)); } catch(e) {} }
    const unsubProducts = syncService.subscribeToProducts((data: Product[]) => {
      setProducts(data);
      localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(data));
    });
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

  const calculateRetailPrice = (cost: number, profitPercent: number, ivaPercent: number, applyIva: boolean): number => {
    if (profitPercent >= 100) return cost * 100;
    const divisor = (100 - profitPercent) / 100;
    const basePrice = cost / divisor;
    const finalPrice = applyIva ? basePrice * (1 + ivaPercent / 100) : basePrice;
    return Math.round(finalPrice * 100) / 100;
  };

  const handlePriceBsChange = (newPriceBs: number) => {
    const rate = state.exchangeRate || 1;
    const priceUsd = newPriceBs / rate;
    const iva = ivaType === 'con_iva' ? ivaPercentage : 0;
    const basePriceUsd = iva > 0 ? priceUsd / (1 + iva / 100) : priceUsd;
    const cost = formData.costUsd || 0;
    
    if (cost > 0 && basePriceUsd > 0) {
      // Re-calcular el margen basado en el precio final ingresado
      // profit = 1 - (cost/basePrice)
      const profit = Math.round((1 - (cost / basePriceUsd)) * 10000) / 100;
      setFormData(prev => ({ ...prev, profitPercent: profit }));
    }
  };

  const getProductMinStock = (product: Product) => product.minStock || 5;

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
      costUsd: Math.round(cost * 10000) / 10000,
      costBs: Math.round(cost * state.exchangeRate * 100) / 100,
      profitPercent: profit,
      priceUsd: retailPrice,
      priceBs: Math.round(retailPrice * state.exchangeRate * 100) / 100,
      priceRetail: retailPrice,
      priceWholesale: Math.round(Number(formData.priceWholesale) * 100) / 100,
      priceCost: Math.round(Number(formData.priceCost) * 100) / 100,
      ivaType: ivaType,
      ivaPercentage: ivaType === 'con_iva' ? ivaPercentage : undefined,
      isKit: isKit,
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
    setIsKit(false);
    setKitComponents([]);
    setSearchChildProduct('');
    setSelectedChildProduct(null);
    setChildQuantity('1');
  };

  const addKardexEntryLocal = (productId: number, entry: KardexEntry) => {
    setKardexEntries(prev => ({
      ...prev,
      [productId]: [entry, ...(prev[productId] || [])]
    }));
    const updated = { ...kardexEntries, [productId]: [entry, ...(kardexEntries[productId] || [])] };
    localStorage.setItem(CACHE_KEYS.KARDEX, JSON.stringify(updated));
  };

  const getKardexForProduct = (productId: number): KardexEntry[] => {
    return kardexEntries[productId] || [];
  };

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

  const [showGlobalIvaModal, setShowGlobalIvaModal] = useState(false);
  const [newGlobalIva, setNewGlobalIva] = useState(16);

  const applyGlobalIva = async () => {
    if (state.register?.isOpen) {
      toast({ title: "Operación no permitida", description: "Debe cerrar la caja antes de cambiar el IVA global", variant: "destructive" });
      return;
    }
    const updatedProducts = products.map(p => {
      if (p.ivaType === 'con_iva') {
        const newRetail = calculateRetailPrice(p.costUsd || 0, p.profitPercent || 30, newGlobalIva, true);
        return { 
          ...p, 
          ivaPercentage: newGlobalIva, 
          priceRetail: newRetail, 
          priceUsd: newRetail, 
          priceBs: Math.round(newRetail * state.exchangeRate * 100) / 100 
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

  const addCategory = () => {
    if (!newCategory.trim()) return;
    const newCats = [...categories, newCategory.trim() as Category];
    setCategories(newCats);
    localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(newCats));
    syncService.saveGlobalSettings({ categories: newCats, departments }).catch(console.error);
    setNewCategory('');
    setShowCategoryModal(false);
  };

  const deleteCategory = (cat: Category) => {
    if (cat === 'Otro') return;
    const newCats = categories.filter(c => c !== cat);
    setCategories(newCats);
    localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(newCats));
    syncService.saveGlobalSettings({ categories: newCats, departments }).catch(console.error);
  };

  const addDepartment = () => {
    if (!newDepartment.trim()) return;
    const newDepts = [...departments, newDepartment.trim()];
    setDepartments(newDepts);
    localStorage.setItem(CACHE_KEYS.DEPARTMENTS, JSON.stringify(newDepts));
    syncService.saveGlobalSettings({ categories, departments: newDepts }).catch(console.error);
    setNewDepartment('');
    setShowDepartmentModal(false);
  };

  const deleteDepartment = (dept: string) => {
    if (dept === 'Otros') return;
    const newDepts = departments.filter(d => d !== dept);
    setDepartments(newDepts);
    localStorage.setItem(CACHE_KEYS.DEPARTMENTS, JSON.stringify(newDepts));
    syncService.saveGlobalSettings({ categories, departments: newDepts }).catch(console.error);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const pdfProducts = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchCat = filterCategory === 'all' || p.category === filterCategory;
      const matchDept = filterDepartment === 'all' || (p.department === filterDepartment);
      return matchSearch && matchCat && matchDept;
    });
    const html = `<html><head><title>Reporte de Inventario</title><style>body { font-family: sans-serif; margin: 30px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 8px; border: 1px solid #eee; text-align: left; } th { background: #1A2C4E; color: white; }</style></head><body><h1>Reporte de Inventario</h1><table><thead><tr><th>CÓDIGO</th><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK</th><th>PRECIO USD</th><th>PRECIO BS</th></tr></thead><tbody>${pdfProducts.map(p => `<tr><td>${p.barcode}</td><td>${p.name}</td><td>${p.category}</td><td>${p.stock}</td><td>$${p.priceUsd.toFixed(2)}</td><td>Bs ${p.priceBs.toFixed(2)}</td></tr>`).join('')}</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchCat = filterCategory === 'all' || p.category === filterCategory;
      const matchDept = filterDepartment === 'all' || (p.department === filterDepartment);
      return matchSearch && matchCat && matchDept;
    });
  }, [products, search, filterCategory, filterDepartment]);

  const currentCalculatedPriceUsd = calculateRetailPrice(formData.costUsd, formData.profitPercent, ivaType === 'con_iva' ? ivaPercentage : 0, ivaType === 'con_iva');
  const currentCalculatedPriceBs = Math.round(currentCalculatedPriceUsd * state.exchangeRate * 100) / 100;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex justify-between items-center pt-3 px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-headline font-black text-black">Catálogo de Inventario</h2>
          <p className="text-xs text-black/50">Consulta de existencias y gestión de catálogo</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowGlobalIvaModal(true)} className="h-8 text-[10px] font-black border-[#9E9E9E]"><Percent size={12} className="mr-1" /> Ajuste IVA Global</Button>
          <div className="bg-[#1A2C4E] px-3 py-1.5 rounded-xl text-white">
            <span className="text-[9px] font-black uppercase opacity-60">Tasa Sistema</span>
            <div className="text-base font-black text-primary">Bs {state.exchangeRate.toFixed(2)}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden px-6 mt-4">
        <div className="flex justify-between items-center mb-3 gap-2 flex-wrap flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
            <Input placeholder="Buscar producto..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white">
              <option value="all">📁 Todos los Deptos.</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <button onClick={() => setShowDepartmentModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button>
          </div>
          <div className="flex items-center gap-1">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="h-8 border rounded-lg px-2 text-xs font-bold bg-white">
              <option value="all">🏷️ Todas las Cats.</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowCategoryModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Button onClick={handleExportPDF} variant="outline" className="h-8 text-[10px] font-black border-[#9E9E9E] text-black"><Printer size={13} className="mr-1" /> EXPORTAR PDF</Button>
            <Button onClick={() => { resetForm(); setEditingProduct(null); setIsAdding(true); }} className="bg-primary text-black font-black h-8 text-[10px] px-3"><Plus size={13} className="mr-1" /> NUEVO PRODUCTO</Button>
          </div>
        </div>
        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 scrollbar-thin">
            <Table>
              <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10"><TableRow><TableHead className="text-[9px] font-black uppercase">Código</TableHead><TableHead className="text-[9px] font-black uppercase">Producto</TableHead><TableHead className="text-[9px] font-black uppercase text-center">Stock</TableHead><TableHead className="text-[9px] font-black uppercase text-right">Precio $</TableHead><TableHead className="text-[9px] font-black uppercase text-right">Precio Bs</TableHead><TableHead className="text-[9px] font-black uppercase text-center">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredProducts.map((p) => (
                  <TableRow key={p.id} className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5]">
                    <TableCell className="font-mono text-[10px] text-black/60">{p.barcode}</TableCell>
                    <TableCell><p className="font-bold text-xs text-black">{p.name}</p><p className="text-[8px] font-bold text-primary uppercase">{p.category} | {p.department || 'Sin Dept.'}</p></TableCell>
                    <TableCell className="text-center"><span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black border", p.stock <= getProductMinStock(p) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{p.stock} UDS</span></TableCell>
                    <TableCell className="text-right font-black text-xs text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black text-xs text-black">Bs {p.priceBs.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setViewingKardex(p)} className="h-6 w-6 rounded hover:bg-blue-100 text-blue-600"><History size={11} /></button>
                        <button onClick={() => requestStockAdjust(p)} className="h-6 w-6 rounded hover:bg-amber-100 text-amber-600"><RefreshCw size={11} /></button>
                        <button onClick={() => handleEdit(p)} className="h-6 w-6 rounded hover:bg-gray-100 text-blue-600"><Pencil size={11} /></button>
                        <button onClick={() => { if(confirm('¿Eliminar este producto?')) state.deleteProduct(p.id) }} className="h-6 w-6 rounded hover:bg-red-100 text-red-600"><Trash2 size={11} /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingProduct(null); resetForm(); } }}>
        <DialogContent className="bg-white max-w-2xl p-0 rounded-xl">
          <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><div className="flex justify-between items-center"><DialogTitle className="text-sm font-black">{editingProduct ? 'Editar' : 'Nuevo'} Producto</DialogTitle><button type="button" onClick={() => setIsAdding(false)}><X size={16} /></button></div></DialogHeader>
          <form onSubmit={handleSave} className="p-4 grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div><label className="text-[8px] font-black uppercase">Código de Barras</label><Input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="h-7 text-xs" required /></div>
              <div><label className="text-[8px] font-black uppercase">Nombre del Producto</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-7 text-xs" required /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[8px] font-black uppercase">Departamento</label><select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full h-7 border rounded px-2 text-xs bg-white">{departments.map(d => <option key={d}>{d}</option>)}</select></div>
                <div><label className="text-[8px] font-black uppercase">Categoría</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})} className="w-full h-7 border rounded px-2 text-xs bg-white">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[8px] font-black uppercase">Stock Inicial</label><Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="h-7 text-xs" /></div>
                <div><label className="text-[8px] font-black uppercase">Stock Mínimo</label><Input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} className="h-7 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[8px] font-black uppercase">Precio Mayor (USD)</label><Input type="number" step="0.01" value={formData.priceWholesale} onChange={e => setFormData({...formData, priceWholesale: Number(e.target.value)})} className="h-7 text-xs" /></div>
                <div><label className="text-[8px] font-black uppercase">Precio Costo (USD)</label><Input type="number" step="0.01" value={formData.priceCost} onChange={e => setFormData({...formData, priceCost: Number(e.target.value)})} className="h-7 text-xs" /></div>
              </div>
            </div>
            <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[7px] font-bold uppercase">Costo Unitario USD</label><Input type="number" step="0.01" value={formData.costUsd} onChange={e => setFormData({...formData, costUsd: Number(e.target.value)})} className="bg-white h-7 text-xs" /></div>
                <div><label className="text-[7px] font-bold uppercase">% Ganancia (Margen)</label><Input type="number" value={formData.profitPercent} onChange={e => setFormData({...formData, profitPercent: Number(e.target.value)})} className="bg-white h-7 text-xs" /></div>
              </div>
              <div className="border-t pt-2 mt-1">
                <label className="text-[7px] font-bold uppercase text-black/60 block mb-1">Configuración de IVA</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIvaType('con_iva')} className={cn("flex-1 py-1 text-[9px] font-bold rounded border", ivaType === 'con_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300")}>Con I.V.A.</button>
                  <button type="button" onClick={() => setIvaType('sin_iva')} className={cn("flex-1 py-1 text-[9px] font-bold rounded border", ivaType === 'sin_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300")}>Sin I.V.A.</button>
                </div>
              </div>
              <div className="bg-white rounded p-1.5 border mt-2">
                <div className="flex justify-between text-[10px] font-bold border-b pb-1 mb-1 items-center">
                  <span className="whitespace-nowrap">PRECIO DETAL FINAL (BS)</span>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={currentCalculatedPriceBs || ''} 
                    onChange={e => handlePriceBsChange(Number(e.target.value))} 
                    className="h-7 w-28 text-right font-black border-primary bg-white focus:ring-1 focus:ring-primary" 
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between text-[9px] text-black/50"><span>Precio Detal USD:</span><span>${currentCalculatedPriceUsd.toFixed(2)}</span></div>
              </div>
              <div className="flex justify-end pt-2"><Button type="submit" className="bg-primary text-black font-black px-6 h-7 text-xs">GUARDAR PRODUCTO</Button></div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
