"use client";

import { useState, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Plus, Search, Pencil, Trash2, X, 
  Tag, Settings, History, RefreshCw, Save
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product, Category } from '@/lib/types';

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
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
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

  useEffect(() => {
    const savedKardex = localStorage.getItem('kardex_entries');
    if (savedKardex) {
      try { setKardexEntries(JSON.parse(savedKardex)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kardex_entries', JSON.stringify(kardexEntries));
  }, [kardexEntries]);

  useEffect(() => {
    const savedCategories = localStorage.getItem('inventory_categories');
    if (savedCategories) { try { setCategories(JSON.parse(savedCategories)); } catch (e) {} }
    const savedDepartments = localStorage.getItem('inventory_departments');
    if (savedDepartments) { try { setDepartments(JSON.parse(savedDepartments)); } catch (e) {} }
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

  const addKardexEntry = (productId: number, entry: KardexEntry) => {
    setKardexEntries(prev => ({
      ...prev,
      [productId]: [entry, ...(prev[productId] || [])]
    }));
  };

  const getKardexForProduct = (productId: number): KardexEntry[] => {
    return kardexEntries[productId] || [];
  };

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
    
    toast({ title: "Ajuste Realizado", description: `Stock actualizado` });
    setAdjustingStock(null);
  };

  const addCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim() as Category)) {
      toast({ title: "Error", description: "Esta categoría ya existe", variant: "destructive" });
      return;
    }
    setCategories([...categories, newCategory.trim() as Category]);
    setNewCategory('');
    setShowCategoryModal(false);
  };

  const deleteCategory = (catToDelete: Category) => {
    const productsInCategory = state.products.filter(p => p.category === catToDelete);
    if (productsInCategory.length > 0) {
      toast({ title: "No se puede eliminar", description: "Categoría en uso", variant: "destructive" });
      return;
    }
    if (confirm(`¿Eliminar la categoría "${catToDelete}"?`)) {
      setCategories(categories.filter(c => c !== catToDelete));
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
  };

  const deleteDepartment = (deptToDelete: string) => {
    const productsInDepartment = state.products.filter(p => (p as any).department === deptToDelete);
    if (productsInDepartment.length > 0) {
      toast({ title: "No se puede eliminar", description: "Depto en uso", variant: "destructive" });
      return;
    }
    if (confirm(`¿Eliminar el departamento "${deptToDelete}"?`)) {
      setDepartments(departments.filter(d => d !== deptToDelete));
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
      toast({ title: "Actualizado", description: "Producto modificado." });
    } else {
      await state.addProduct(productData);
      const kardexEntry: KardexEntry = {
        id: Date.now(),
        date: new Date().toLocaleString('es-VE'),
        type: 'ajuste_inicial',
        quantity: Number(formData.stock),
        previousStock: 0,
        newStock: Number(formData.stock),
        reference: 'Creación',
        note: 'Stock inicial'
      };
      addKardexEntry(productData.id, kardexEntry);
      toast({ title: "Creado", description: "Producto registrado." });
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
    setFormData({ barcode: '', name: '', department: 'Otros', category: 'Otro' as Category, stock: 0, minStock: 5, costUsd: 0, profitPercent: 30 });
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex justify-between items-center pt-3 px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-headline font-black text-black">Catálogo de Inventario</h2>
          <p className="text-xs text-black/50">Consulta de existencias y gestión de catálogo</p>
        </div>
        <div className="bg-[#1A2C4E] px-3 py-1.5 rounded-xl text-white">
          <span className="text-[9px] font-black uppercase opacity-60">Tasa Sistema</span>
          <div className="text-base font-black text-primary">Bs {state.exchangeRate.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-6 mt-4">
        <div className="flex justify-between items-center mb-3 gap-3 flex-wrap flex-shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
            <Input placeholder="Buscar..." className="pl-9 h-8 border-[#9E9E9E] text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="h-8 border rounded-lg px-2 text-xs font-bold">
              <option value="all">📁 Deptos.</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <button onClick={() => setShowDepartmentModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button>
          </div>
          <div className="flex items-center gap-1">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="h-8 border rounded-lg px-2 text-xs font-bold">
              <option value="all">🏷️ Cats.</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowCategoryModal(true)} className="h-8 w-8 border rounded-lg flex items-center justify-center hover:bg-gray-100"><Settings size={13} /></button>
          </div>
          <Button onClick={() => { resetForm(); setEditingProduct(null); setIsAdding(true); }} className="bg-primary text-black font-black h-8 text-xs px-3">
            <Plus size={13} className="mr-1" /> NUEVO PRODUCTO
          </Button>
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
                    <TableCell>
                      <p className="font-bold text-xs text-black">{p.name}</p>
                      <p className="text-[8px] font-bold text-primary uppercase">{p.category} | {(p as any).department}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black border", p.stock <= (p.minStock || 5) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                        {p.stock} UDS
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-black text-xs text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black text-xs text-black">Bs {p.priceBs.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setViewingKardex(p)} className="h-6 w-6 rounded hover:bg-blue-100 text-blue-600" title="Kardex"><History size={11} /></button>
                        <button onClick={() => handleOpenStockAdjust(p)} className="h-6 w-6 rounded hover:bg-amber-100 text-amber-600" title="Ajuste"><RefreshCw size={11} /></button>
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
      </div>

      {viewingKardex && (
        <Dialog open={true} onOpenChange={() => setViewingKardex(null)}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-3xl p-0 overflow-hidden rounded-xl shadow-xl max-h-[85vh]">
            <DialogHeader className="sr-only"><DialogTitle>Kardex - {viewingKardex.name}</DialogTitle></DialogHeader>
            <div className="flex flex-col h-full">
              <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
                <div><h3 className="text-base font-black flex items-center gap-2"><History size={16} /> Tarjeta Kardex</h3><p className="text-xs">{viewingKardex.name}</p></div>
                <button onClick={() => setViewingKardex(null)}><X size={18} /></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="bg-slate-50 p-3 rounded-lg mb-4 grid grid-cols-3 gap-3">
                  <div><p className="text-[8px] font-black uppercase text-slate-500">Stock Actual</p><p className={cn("text-xl font-black", viewingKardex.stock === 0 ? "text-red-600" : "text-green-600")}>{viewingKardex.stock} UDS</p></div>
                  <div><p className="text-[8px] font-black uppercase text-slate-500">Precio USD</p><p className="text-xl font-black text-secondary">${viewingKardex.priceUsd.toFixed(2)}</p></div>
                  <div><p className="text-[8px] font-black uppercase text-slate-500">Valor</p><p className="text-xl font-black text-blue-600">${(viewingKardex.priceUsd * viewingKardex.stock).toFixed(2)}</p></div>
                </div>
                <table className="w-full text-left text-[9px]"><thead className="bg-slate-100"><tr><th className="p-1.5">FECHA</th><th className="p-1.5">TIPO</th><th className="p-1.5 text-right">CANT</th><th className="p-1.5 text-right">STOCK</th><th className="p-1.5">MOTIVO</th></tr></thead><tbody className="divide-y">{getKardexForProduct(viewingKardex.id).map(entry => (<tr key={entry.id} className="hover:bg-slate-50"><td className="p-1.5 font-mono">{entry.date}</td><td className="p-1.5">{entry.type}</td><td className="p-1.5 text-right">{entry.quantity}</td><td className="p-1.5 text-right font-bold">{entry.newStock}</td><td className="p-1.5">{entry.note}</td></tr>))}</tbody></table>
              </div>
              <div className="bg-slate-50 p-2 border-t flex justify-end"><Button onClick={() => setViewingKardex(null)} variant="ghost" size="sm">CERRAR</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!adjustingStock} onOpenChange={() => setAdjustingStock(null)}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-amber-500 p-3 text-white rounded-t-xl"><DialogTitle className="sr-only">Ajustar Stock</DialogTitle><div className="flex justify-between items-center"><h3 className="text-sm font-black">Ajustar Stock</h3><button onClick={() => setAdjustingStock(null)}><X size={16} /></button></div></DialogHeader>
          <div className="p-4 space-y-3"><div><label className="text-[9px] font-black uppercase block mb-1">Nueva Cantidad</label><Input type="number" value={adjustmentQuantity} onChange={(e) => setAdjustmentQuantity(e.target.value)} className="text-sm" /></div><div><label className="text-[9px] font-black uppercase block mb-1">Motivo</label><textarea value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} rows={2} className="w-full border rounded-lg px-2 py-1 text-xs" /></div></div>
          <div className="bg-slate-50 p-3 border-t flex justify-end gap-2"><Button onClick={confirmStockAdjustment} className="bg-amber-500 text-white font-black h-7 text-xs px-4">CONFIRMAR</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl"><DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-xs font-black">🏷️ Categorías</DialogTitle></DialogHeader><div className="p-3"><div className="flex gap-2 mb-3"><Input placeholder="Nueva..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 h-7 text-xs" /><Button onClick={addCategory} className="bg-primary text-black h-7 text-xs px-3">ADD</Button></div><div className="max-h-52 overflow-y-auto border rounded-lg divide-y">{categories.map(cat => (<div key={cat} className="flex justify-between items-center px-2 py-1.5"><span className="text-xs">{cat}</span>{cat !== 'Otro' && <button onClick={() => deleteCategory(cat)} className="text-red-500"><Trash2 size={12} /></button>}</div>))}</div></div></DialogContent>
      </Dialog>

      <Dialog open={showDepartmentModal} onOpenChange={setShowDepartmentModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl"><DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl"><DialogTitle className="text-xs font-black">📁 Departamentos</DialogTitle></DialogHeader><div className="p-3"><div className="flex gap-2 mb-3"><Input placeholder="Nuevo..." value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1 h-7 text-xs" /><Button onClick={addDepartment} className="bg-primary text-black h-7 text-xs px-3">ADD</Button></div><div className="max-h-52 overflow-y-auto border rounded-lg divide-y">{departments.map(dept => (<div key={dept} className="flex justify-between items-center px-2 py-1.5"><span className="text-xs">{dept}</span>{dept !== 'Otros' && <button onClick={() => deleteDepartment(dept)} className="text-red-500"><Trash2 size={12} /></button>}</div>))}</div></div></DialogContent>
      </Dialog>

      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingProduct(null); } }}>
        <DialogContent className="bg-white max-w-2xl p-0 rounded-xl">
          <DialogHeader className="sr-only"><DialogTitle>Producto</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <div className="bg-[#1A2C4E] p-3 text-white flex justify-between"><h3 className="text-sm font-black">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3><button type="button" onClick={() => setIsAdding(false)}><X size={16} /></button></div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div><label className="text-[8px] font-black uppercase">Código</label><Input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="h-7 text-xs" required /></div>
                <div><label className="text-[8px] font-black uppercase">Nombre</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-7 text-xs" required /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[8px] font-black uppercase">Depto.</label><select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full h-7 border rounded px-2 text-xs">{departments.map(d => <option key={d}>{d}</option>)}</select></div>
                  <div><label className="text-[8px] font-black uppercase">Categoría</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})} className="w-full h-7 border rounded px-2 text-xs">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[8px] font-black uppercase">Stock</label><Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="h-7 text-xs" /></div>
                  <div><label className="text-[8px] font-black uppercase">Min</label><Input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} className="h-7 text-xs" /></div>
                </div>
              </div>
              <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[7px] font-bold uppercase">Costo USD</label><Input type="number" step="0.01" value={formData.costUsd} onChange={e => setFormData({...formData, costUsd: Number(e.target.value)})} className="bg-white h-7 text-xs" /></div>
                  <div><label className="text-[7px] font-bold uppercase">% Ganancia</label><Input type="number" value={formData.profitPercent} onChange={e => setFormData({...formData, profitPercent: Number(e.target.value)})} className="bg-white h-7 text-xs" /></div>
                </div>
                <div className="bg-white rounded p-1.5 border mt-2">
                  <div className="flex justify-between text-[10px]"><span className="text-black/60">USD:</span><span className="font-black text-secondary">${calculatedPriceUsd.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[10px]"><span className="text-black/60">Bs:</span><span className="font-black">Bs {calculatedPriceBs.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
            <div className="bg-[#F5F5F5] p-2 border-t flex justify-end gap-2"><Button type="submit" className="bg-primary text-black font-black px-6 h-7 text-xs">GUARDAR</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
