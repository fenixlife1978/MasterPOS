"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Plus, Search, Info, Pencil, Trash2, X, 
  Barcode as BarcodeIcon, Tag, Boxes, 
  TrendingUp, DollarSign, Percent, Filter, 
  LayoutGrid, BarChart3, ShoppingBag, 
  ArrowUpRight, ArrowDownRight, Package,
  FolderPlus, FolderMinus, Settings, History, RefreshCw, Save
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product, Category } from '@/lib/types';
import RegisterPurchase from './RegisterPurchase';

interface InventoryModuleProps {
  state: ReturnType<typeof usePOSState>;
}

interface KardexEntry {
  id: number;
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

export default function InventoryModule({ state }: InventoryModuleProps) {
  const [activeTab, setActiveTab] = useState("catalogo");
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Estados para Kardex y Ajuste de Stock
  const [viewingKardex, setViewingKardex] = useState<Product | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<Product | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [kardexEntries, setKardexEntries] = useState<Record<number, KardexEntry[]>>({});
  
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    department: 'Otros',
    category: 'Otro' as Category,
    stock: 0,
    minStock: 5,
    costUsd: 0,
    profitPercent: 30
  });

  const { toast } = useToast();

  // Cargar Kardex desde localStorage
  useEffect(() => {
    const savedKardex = localStorage.getItem('kardex_entries');
    if (savedKardex) {
      setKardexEntries(JSON.parse(savedKardex));
    }
  }, []);

  // Guardar Kardex
  useEffect(() => {
    localStorage.setItem('kardex_entries', JSON.stringify(kardexEntries));
  }, [kardexEntries]);

  useEffect(() => {
    const savedCategories = localStorage.getItem('inventory_categories');
    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }
    const savedDepartments = localStorage.getItem('inventory_departments');
    if (savedDepartments) {
      setDepartments(JSON.parse(savedDepartments));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('inventory_categories', JSON.stringify(categories));
    localStorage.setItem('inventory_departments', JSON.stringify(departments));
  }, [categories, departments]);

  const calculatedPriceUsd = formData.costUsd * (1 + formData.profitPercent / 100);
  const calculatedPriceBs = calculatedPriceUsd * state.exchangeRate;

  const filteredProducts = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesDepartment = filterDepartment === 'all' || (p as any).department === filterDepartment;
    return matchesSearch && matchesCategory && matchesDepartment;
  });

  const reports = useMemo(() => {
    const totalCostUsd = state.products.reduce((acc, p) => acc + ((p.costUsd || 0) * p.stock), 0);
    const totalSaleUsd = state.products.reduce((acc, p) => acc + (p.priceUsd * p.stock), 0);
    const grossProfit = totalSaleUsd - totalCostUsd;
    const profitMargin = totalCostUsd > 0 ? (grossProfit / totalCostUsd) * 100 : 0;

    const byDept = departments.reduce((acc, dept) => {
      const deptProducts = state.products.filter(p => (p as any).department === dept);
      const valueUsd = deptProducts.reduce((sum, p) => sum + (p.priceUsd * p.stock), 0);
      acc[dept] = { count: deptProducts.length, valueUsd };
      return acc;
    }, {} as Record<string, { count: number; valueUsd: number }>);

    const byCat = categories.reduce((acc, cat) => {
      const catProducts = state.products.filter(p => p.category === cat);
      const stockTotal = catProducts.reduce((sum, p) => sum + p.stock, 0);
      if (stockTotal > 0) acc[cat] = stockTotal;
      return acc;
    }, {} as Record<string, number>);

    return { totalCostUsd, totalSaleUsd, grossProfit, profitMargin, byDept, byCat };
  }, [state.products, departments, categories]);

  // ========== FUNCIONES DE KARDEX ==========
  const addKardexEntry = (productId: number, entry: KardexEntry) => {
    setKardexEntries(prev => ({
      ...prev,
      [productId]: [entry, ...(prev[productId] || [])]
    }));
  };

  const getKardexForProduct = (productId: number): KardexEntry[] => {
    return kardexEntries[productId] || [];
  };

  // ========== FUNCIÓN DE AJUSTE DE STOCK ==========
  const handleOpenStockAdjust = (product: Product) => {
    setAdjustingStock(product);
    setAdjustmentQuantity('');
    setAdjustmentReason('');
  };

  const confirmStockAdjustment = () => {
    if (!adjustingStock) return;
    
    const newQuantity = parseInt(adjustmentQuantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      toast({ title: "Error", description: "Ingrese una cantidad válida", variant: "destructive" });
      return;
    }
    
    if (!adjustmentReason.trim()) {
      toast({ title: "Error", description: "Ingrese un motivo para el ajuste", variant: "destructive" });
      return;
    }
    
    const previousStock = adjustingStock.stock;
    const updatedProduct = { ...adjustingStock, stock: newQuantity };
    state.updateProduct(updatedProduct);
    
    // Registrar en Kardex
    const kardexEntry: KardexEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('es-VE'),
      type: 'ajuste_manual',
      quantity: newQuantity - previousStock,
      previousStock: previousStock,
      newStock: newQuantity,
      reference: `Ajuste manual`,
      note: adjustmentReason
    };
    addKardexEntry(adjustingStock.id, kardexEntry);
    
    toast({ title: "Ajuste Realizado", description: `Stock actualizado de ${previousStock} a ${newQuantity} unidades` });
    setAdjustingStock(null);
  };

  // ========== GESTIÓN DE CATEGORÍAS/DEPARTAMENTOS ==========
  const addCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim() as Category)) {
      toast({ title: "Error", description: "Esta categoría ya existe", variant: "destructive" });
      return;
    }
    setCategories([...categories, newCategory.trim() as Category]);
    setNewCategory('');
    setShowCategoryModal(false);
    toast({ title: "Categoría creada", description: `"${newCategory.trim()}" agregada correctamente.` });
  };

  const deleteCategory = (catToDelete: Category) => {
    const productsInCategory = state.products.filter(p => p.category === catToDelete);
    if (productsInCategory.length > 0) {
      toast({ 
        title: "No se puede eliminar", 
        description: `Hay ${productsInCategory.length} producto(s) en esta categoría. Reasígnelos primero.`, 
        variant: "destructive" 
      });
      return;
    }
    if (confirm(`¿Eliminar la categoría "${catToDelete}"?`)) {
      setCategories(categories.filter(c => c !== catToDelete));
      if (filterCategory === catToDelete) setFilterCategory('all');
      toast({ title: "Categoría eliminada", description: `"${catToDelete}" ha sido eliminada.` });
    }
  };

  const addDepartment = () => {
    if (!newDepartment.trim()) return;
    if (departments.includes(newDepartment.trim())) {
      toast({ title: "Error", description: "Este departamento ya existe", variant: "destructive" });
      return;
    }
    setDepartments([...departments, newDepartment.trim()]);
    setNewDepartment('');
    setShowDepartmentModal(false);
    toast({ title: "Departamento creado", description: `"${newDepartment.trim()}" agregado correctamente.` });
  };

  const deleteDepartment = (deptToDelete: string) => {
    const productsInDepartment = state.products.filter(p => (p as any).department === deptToDelete);
    if (productsInDepartment.length > 0) {
      toast({ 
        title: "No se puede eliminar", 
        description: `Hay ${productsInDepartment.length} producto(s) en este departamento. Reasígnelos primero.`, 
        variant: "destructive" 
      });
      return;
    }
    if (confirm(`¿Eliminar el departamento "${deptToDelete}"?`)) {
      setDepartments(departments.filter(d => d !== deptToDelete));
      if (filterDepartment === deptToDelete) setFilterDepartment('all');
      toast({ title: "Departamento eliminado", description: `"${deptToDelete}" ha sido eliminado.` });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData: Product = {
      id: editingProduct?.id || Date.now(),
      barcode: formData.barcode,
      name: formData.name,
      department: formData.department,
      category: formData.category,
      stock: Number(formData.stock),
      minStock: Number(formData.minStock),
      costUsd: Number(formData.costUsd),
      costBs: Number(formData.costUsd * state.exchangeRate),
      profitPercent: Number(formData.profitPercent),
      priceUsd: calculatedPriceUsd,
      priceBs: calculatedPriceBs
    };

    if (editingProduct) {
      await state.updateProduct(productData);
      toast({ title: "Actualizado", description: "Producto modificado correctamente." });
    } else {
      await state.addProduct(productData);
      // Registrar ajuste inicial en Kardex
      const kardexEntry: KardexEntry = {
        id: Date.now(),
        date: new Date().toLocaleString('es-VE'),
        type: 'ajuste_inicial',
        quantity: Number(formData.stock),
        previousStock: 0,
        newStock: Number(formData.stock),
        reference: 'Creación de producto',
        note: 'Stock inicial registrado'
      };
      addKardexEntry(productData.id, kardexEntry);
      toast({ title: "Creado", description: "Nuevo producto registrado en el catálogo." });
    }

    setEditingProduct(null);
    setIsAdding(false);
    resetForm();
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      barcode: p.barcode,
      name: p.name,
      department: (p as any).department || 'Otros',
      category: p.category,
      stock: p.stock,
      minStock: p.minStock || 5,
      costUsd: p.costUsd || 0,
      profitPercent: p.profitPercent || 30
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      barcode: '',
      name: '',
      department: 'Otros',
      category: 'Otro' as Category,
      stock: 0,
      minStock: 5,
      costUsd: 0,
      profitPercent: 30
    });
  };

  // Componente Modal de Kardex
  const KardexModal = ({ product, onClose }: { product: Product; onClose: () => void }) => {
    const kardex = getKardexForProduct(product.id);
    
    const getTypeColor = (type: string) => {
      switch(type) {
        case 'venta': return 'bg-red-100 text-red-700 border-red-200';
        case 'compra': return 'bg-green-100 text-green-700 border-green-200';
        default: return 'bg-blue-100 text-blue-700 border-blue-200';
      }
    };
    
    const getTypeText = (type: string) => {
      switch(type) {
        case 'venta': return 'VENTA';
        case 'compra': return 'COMPRA';
        case 'ajuste_inicial': return 'AJUSTE INICIAL';
        default: return 'AJUSTE MANUAL';
      }
    };

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-3xl p-0 overflow-hidden rounded-xl shadow-xl max-h-[85vh]">
          <DialogHeader className="sr-only"><DialogTitle>Kardex - {product.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col h-full">
            <div className="bg-[#1A2C4E] p-4 text-white sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2"><History size={16} /> Tarjeta Kardex</h3>
                  <p className="text-xs font-bold opacity-90">{product.name}</p>
                  <p className="text-[10px] opacity-70">Código: {product.barcode}</p>
                </div>
                <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="bg-slate-50 p-3 rounded-lg mb-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Stock Actual</p>
                  <p className={cn("text-xl font-black", product.stock === 0 ? "text-red-600" : "text-green-600")}>{product.stock} UDS</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Precio USD</p>
                  <p className="text-xl font-black text-secondary">${product.priceUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Valor Inventario</p>
                  <p className="text-xl font-black text-blue-600">${(product.priceUsd * product.stock).toFixed(2)}</p>
                </div>
              </div>
              
              <h4 className="text-[10px] font-black uppercase mb-2 text-[#1A2C4E] flex items-center gap-1"><History size={10} /> HISTORIAL DE MOVIMIENTOS</h4>
              
              {kardex.length === 0 ? (
                <div className="text-center py-8 text-slate-400"><Package size={32} className="mx-auto mb-2 opacity-30" /><p className="text-[10px]">No hay movimientos registrados</p></div>
              ) : (
                <div className="space-y-1 max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr><th className="p-1.5">FECHA</th><th className="p-1.5">TIPO</th><th className="p-1.5 text-right">CANTIDAD</th><th className="p-1.5 text-right">STOCK PREVIO</th><th className="p-1.5 text-right">STOCK NUEVO</th><th className="p-1.5">MOTIVO</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kardex.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="p-1.5 font-mono">{new Date(entry.date).toLocaleString('es-VE')}</td>
                          <td className="p-1.5"><span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-bold", getTypeColor(entry.type))}>{getTypeText(entry.type)}</span></td>
                          <td className={cn("p-1.5 text-right font-mono font-bold", entry.quantity < 0 ? "text-red-600" : "text-green-600")}>{entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}</td>
                          <td className="p-1.5 text-right font-mono">{entry.previousStock}</td>
                          <td className="p-1.5 text-right font-mono font-bold">{entry.newStock}</td>
                          <td className="p-1.5 text-slate-500 max-w-[120px] truncate">{entry.note || entry.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-2 border-t flex justify-end"><Button onClick={onClose} variant="ghost" size="sm" className="h-7 text-[10px]">CERRAR</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex justify-between items-center pt-3 px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-headline font-black text-black">Gestión de Inventario</h2>
          <p className="text-xs text-black/50">Control de stock, valoración y entradas de mercancía</p>
        </div>
        <div className="bg-[#1A2C4E] px-3 py-1.5 rounded-xl text-white">
          <span className="text-[9px] font-black uppercase opacity-60">Tasa Sistema</span>
          <div className="text-base font-black text-primary">Bs {state.exchangeRate.toFixed(2)}</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden px-6">
        <TabsList className="bg-[#E8E8E8] p-1 rounded-xl w-fit mt-3 mb-3 flex-shrink-0">
          <TabsTrigger value="catalogo" className="px-5 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black font-bold text-xs"><LayoutGrid size={14} className="mr-1.5" /> Catálogo</TabsTrigger>
          <TabsTrigger value="reportes" className="px-5 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black font-bold text-xs"><BarChart3 size={14} className="mr-1.5" /> Reportes</TabsTrigger>
          <TabsTrigger value="compras" className="px-5 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black font-bold text-xs"><ShoppingBag size={14} className="mr-1.5" /> Compras</TabsTrigger>
        </TabsList>

        {/* TAB: CATÁLOGO */}
        <TabsContent value="catalogo" className="flex-1 flex flex-col overflow-hidden m-0 p-0 outline-none">
          <div className="flex justify-between items-center mb-3 gap-3 flex-wrap flex-shrink-0">
            <div className="relative flex-1 max-w-md"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" /><Input placeholder="Buscar..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="flex items-center gap-1"><select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="h-8 border rounded-lg px-2 text-xs font-bold"><option value="all">📁 Todos los Deptos.</option>{departments.map(d => <option key={d}>{d}</option>)}</select><button onClick={() => setShowDepartmentModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button></div>
            <div className="flex items-center gap-1"><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="h-8 border rounded-lg px-2 text-xs font-bold"><option value="all">🏷️ Todas las Cats.</option>{categories.map(c => <option key={c}>{c}</option>)}</select><button onClick={() => setShowCategoryModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button></div>
            <Button onClick={() => { resetForm(); setEditingProduct(null); setIsAdding(true); }} className="bg-primary text-black font-black h-8 text-xs px-3"><Plus size={13} className="mr-1" /> AGREGAR</Button>
          </div>

          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
            <div className="overflow-y-auto flex-1 scrollbar-thin">
              <Table>
                <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase">Código</TableHead>
                    <TableHead className="text-[9px] font-black uppercase">Producto</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Stock</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">Costo $</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">Precio $</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">Precio Bs</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id} className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5]">
                      <TableCell className="font-mono text-[10px] text-black/60">{p.barcode}</TableCell>
                      <TableCell><p className="font-bold text-xs text-black">{p.name}</p><p className="text-[8px] font-bold text-primary uppercase">{p.category} | {(p as any).department || 'Sin Dept.'}</p></TableCell>
                      <TableCell className="text-center"><span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black border", p.stock <= (p.minStock || 5) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{p.stock} UDS</span></TableCell>
                      <TableCell className="text-right font-mono text-[10px] text-black/60">${(p.costUsd || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-xs text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-xs text-black">Bs {p.priceBs.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setViewingKardex(p)} className="h-6 w-6 rounded hover:bg-blue-100 text-blue-600" title="Ver Kardex"><History size={11} /></button>
                          <button onClick={() => handleOpenStockAdjust(p)} className="h-6 w-6 rounded hover:bg-amber-100 text-amber-600" title="Ajustar Stock"><RefreshCw size={11} /></button>
                          <button onClick={() => handleEdit(p)} className="h-6 w-6 rounded hover:bg-gray-100 text-blue-600"><Pencil size={11} /></button>
                          <button onClick={() => { if(confirm('¿Eliminar?')) state.deleteProduct(p.id) }} className="h-6 w-6 rounded hover:bg-red-100 text-red-600"><Trash2 size={11} /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* TAB: REPORTES */}
        <TabsContent value="reportes" className="flex-1 overflow-y-auto m-0 p-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white border rounded-lg p-3"><p className="text-[8px] font-black text-black/40 uppercase">Valor Inventario (Costo)</p><p className="text-lg font-black">${reports.totalCostUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p><p className="text-[9px] font-bold text-black/50">Bs {(reports.totalCostUsd * state.exchangeRate).toLocaleString()}</p></div>
            <div className="bg-[#1A2C4E] rounded-lg p-3"><p className="text-[8px] font-black text-white/40 uppercase">Valor Inventario (Venta)</p><p className="text-lg font-black text-primary">${reports.totalSaleUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p><p className="text-[9px] font-bold text-white/50">Bs {(reports.totalSaleUsd * state.exchangeRate).toLocaleString()}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3"><div className="flex justify-between"><div><p className="text-[8px] font-black text-green-800/40 uppercase">Ganancia Proyectada</p><p className="text-lg font-black text-green-700">${reports.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div><ArrowUpRight size={16} className="text-green-700" /></div></div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3"><p className="text-[8px] font-black text-blue-800/40 uppercase">Margen Almacén</p><p className="text-lg font-black text-blue-700">{reports.profitMargin.toFixed(1)}%</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg overflow-hidden"><div className="bg-[#E8E8E8] p-2 border-b"><h3 className="text-[10px] font-black uppercase flex items-center gap-2"><LayoutGrid size={12} /> Valor por Departamento</h3></div><div className="p-3 space-y-2">{departments.map(dept => (<div key={dept} className="flex justify-between items-center p-1.5 rounded-md"><div className="flex gap-2"><div className="w-6 h-6 rounded-md bg-[#1A2C4E]/10 flex items-center justify-center font-bold text-[10px]">{dept[0]}</div><div><p className="text-xs font-black">{dept}</p><p className="text-[8px] text-black/40">{reports.byDept[dept]?.count || 0} Productos</p></div></div><div className="text-right"><p className="text-xs font-black">${reports.byDept[dept]?.valueUsd?.toLocaleString() || '0'}</p><p className="text-[7px] font-bold text-primary">Bs {((reports.byDept[dept]?.valueUsd || 0) * state.exchangeRate).toLocaleString()}</p></div></div>))}</div></div>
            <div className="bg-white border rounded-lg overflow-hidden"><div className="bg-[#E8E8E8] p-2 border-b"><h3 className="text-[10px] font-black uppercase flex items-center gap-2"><Package size={12} /> Stock por Categoría</h3></div><div className="p-3 max-h-[280px] overflow-y-auto space-y-2">{Object.entries(reports.byCat).sort((a,b) => b[1] - a[1]).map(([cat, stock]) => (<div key={cat} className="flex items-center gap-2"><div className="w-20 text-right"><span className="text-[8px] font-bold uppercase text-black/60">{cat}</span></div><div className="flex-1 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (stock / state.products.length) * 100)}%` }} /></div><div className="w-10 text-right"><span className="text-[9px] font-black">{stock}</span></div></div>))}</div></div>
          </div>
        </TabsContent>

        {/* TAB: COMPRAS */}
        <TabsContent value="compras" className="flex-1 overflow-hidden m-0 p-0 outline-none">
          <RegisterPurchase />
        </TabsContent>
      </Tabs>

      {/* MODAL KARDEX */}
      {viewingKardex && <KardexModal product={viewingKardex} onClose={() => setViewingKardex(null)} />}

      {/* MODAL AJUSTE DE STOCK */}
      <Dialog open={!!adjustingStock} onOpenChange={() => setAdjustingStock(null)}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-xl shadow-xl">
          <DialogHeader className="bg-amber-500 p-3 text-white rounded-t-xl">
            <DialogTitle className="sr-only">Ajustar Stock</DialogTitle>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><RefreshCw size={16} /><h3 className="text-sm font-black">Ajustar Stock</h3></div><button onClick={() => setAdjustingStock(null)}><X size={16} /></button></div>
            {adjustingStock && <><p className="text-xs font-bold mt-1">{adjustingStock.name}</p><p className="text-[9px] opacity-80">Stock actual: {adjustingStock.stock} UDS</p></>}
          </DialogHeader>
          <div className="p-4">
            <div className="space-y-3">
              <div><label className="text-[9px] font-black uppercase text-black/40 mb-1 block">Nueva Cantidad</label><Input type="number" value={adjustmentQuantity} onChange={(e) => setAdjustmentQuantity(e.target.value)} placeholder="Ingrese la nueva cantidad" className="text-sm" autoFocus /></div>
              <div><label className="text-[9px] font-black uppercase text-black/40 mb-1 block">Motivo del Ajuste</label><textarea value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Ej: Rotura, merma, inventario físico, etc." rows={2} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none" /></div>
            </div>
          </div>
          <div className="bg-slate-50 p-3 border-t flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setAdjustingStock(null)} className="h-7 text-xs">CANCELAR</Button><Button onClick={confirmStockAdjustment} className="bg-amber-500 text-white font-black h-7 text-xs px-4"><Save size={12} className="mr-1" /> CONFIRMAR</Button></div>
        </DialogContent>
      </Dialog>

      {/* MODALES CATEGORÍAS Y DEPARTAMENTOS */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl"><DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-xs font-black">🏷️ Gestionar Categorías</DialogTitle></DialogHeader><div className="p-3"><div className="flex gap-2 mb-3"><Input placeholder="Nueva categoría..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 h-7 text-xs" onKeyPress={(e) => e.key === 'Enter' && addCategory()} /><Button onClick={addCategory} className="bg-primary text-black h-7 text-xs px-3">AGREGAR</Button></div><div className="max-h-52 overflow-y-auto border rounded-lg divide-y">{categories.map(cat => (<div key={cat} className="flex justify-between items-center px-2 py-1.5"><span className="text-xs">{cat}</span>{cat !== 'Otro' && <button onClick={() => deleteCategory(cat)} className="text-red-500"><Trash2 size={12} /></button>}</div>))}</div><p className="text-[8px] text-black/40 mt-2 text-center">* "Otro" no se puede eliminar</p></div></DialogContent>
      </Dialog>

      <Dialog open={showDepartmentModal} onOpenChange={setShowDepartmentModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl"><DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-xs font-black">📁 Gestionar Departamentos</DialogTitle></DialogHeader><div className="p-3"><div className="flex gap-2 mb-3"><Input placeholder="Nuevo departamento..." value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1 h-7 text-xs" onKeyPress={(e) => e.key === 'Enter' && addDepartment()} /><Button onClick={addDepartment} className="bg-primary text-black h-7 text-xs px-3">AGREGAR</Button></div><div className="max-h-52 overflow-y-auto border rounded-lg divide-y">{departments.map(dept => (<div key={dept} className="flex justify-between items-center px-2 py-1.5"><span className="text-xs">{dept}</span>{dept !== 'Otros' && <button onClick={() => deleteDepartment(dept)} className="text-red-500"><Trash2 size={12} /></button>}</div>))}</div><p className="text-[8px] text-black/40 mt-2 text-center">* "Otros" no se puede eliminar</p></div></DialogContent>
      </Dialog>

      {/* MODAL AGREGAR/EDITAR PRODUCTO */}
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingProduct(null); } }}>
        <DialogContent className="bg-white max-w-2xl p-0 rounded-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="bg-[#1A2C4E] p-3 text-white flex justify-between"><div className="flex gap-2"><Tag size={16} /><h3 className="text-sm font-black">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3></div><button type="button" onClick={() => setIsAdding(false)}><X size={16} /></button></div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="space-y-2"><div><label className="text-[8px] font-black uppercase">Código</label><Input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="h-7 text-xs" required /></div><div><label className="text-[8px] font-black uppercase">Nombre</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-7 text-xs" required /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[8px] font-black uppercase">Depto.</label><select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full h-7 border rounded px-2 text-xs">{departments.map(d => <option key={d}>{d}</option>)}</select></div><div><label className="text-[8px] font-black uppercase">Categoría</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})} className="w-full h-7 border rounded px-2 text-xs">{categories.map(c => <option key={c}>{c}</option>)}</select></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[8px] font-black uppercase">Stock</label><Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="h-7 text-xs" /></div><div><label className="text-[8px] font-black uppercase">Stock Mínimo</label><Input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} className="h-7 text-xs" /></div></div></div>
              <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2"><div><h4 className="text-[8px] font-black uppercase">Costo y Margen</h4><div className="grid grid-cols-2 gap-2 mt-1"><div><label className="text-[7px] font-bold uppercase">Costo USD</label><Input type="number" step="0.01" value={formData.costUsd} onChange={e => setFormData({...formData, costUsd: Number(e.target.value)})} className="bg-white h-7 text-xs" /></div><div><label className="text-[7px] font-bold uppercase">% Ganancia</label><Input type="number" value={formData.profitPercent} onChange={e => setFormData({...formData, profitPercent: Number(e.target.value)})} className="bg-white h-7 text-xs" /></div></div></div><div className="border-t pt-2"><h4 className="text-[8px] font-black uppercase">Precios de Venta</h4><div className="bg-white rounded p-1.5 mt-1 border"><div className="flex justify-between text-[10px]"><span className="text-black/60">USD:</span><span className="font-black text-secondary">${calculatedPriceUsd.toFixed(2)}</span></div><div className="flex justify-between text-[10px]"><span className="text-black/60">Bs:</span><span className="font-black">Bs {calculatedPriceBs.toFixed(2)}</span></div></div></div></div>
            </div>
            <div className="bg-[#F5F5F5] p-2 border-t flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>CANCELAR</Button><Button type="submit" className="bg-primary text-black font-black px-6 h-7 text-xs">GUARDAR</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
