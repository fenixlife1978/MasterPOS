"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Plus, Search, Info, Pencil, Trash2, X, 
  Barcode as BarcodeIcon, Tag, Boxes, 
  TrendingUp, DollarSign, Percent, Filter, 
  LayoutGrid, BarChart3, ShoppingBag, 
  ArrowUpRight, ArrowDownRight, Package
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

const CATEGORIES: Category[] = ['Whisky', 'Ron', 'Cerveza', 'Vino', 'Vodka', 'Tequila', 'Licor', 'Gin', 'Otro'];
const DEPARTMENTS = ['Polar', 'Munchy', 'Otros'];

export default function InventoryModule({ state }: InventoryModuleProps) {
  const [activeTab, setActiveTab] = useState("catalogo");
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
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

  // Cálculos automáticos de precios de venta para el formulario
  const calculatedPriceUsd = formData.costUsd * (1 + formData.profitPercent / 100);
  const calculatedPriceBs = calculatedPriceUsd * state.exchangeRate;

  // Filtrado de productos para la tabla
  const filteredProducts = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // ========== LÓGICA DE REPORTES Y VALORACIÓN ==========
  const reports = useMemo(() => {
    const totalCostUsd = state.products.reduce((acc, p) => acc + ((p.costUsd || 0) * p.stock), 0);
    const totalSaleUsd = state.products.reduce((acc, p) => acc + (p.priceUsd * p.stock), 0);
    const grossProfit = totalSaleUsd - totalCostUsd;
    const profitMargin = totalCostUsd > 0 ? (grossProfit / totalCostUsd) * 100 : 0;

    // Desglose por Departamento
    const byDept = DEPARTMENTS.reduce((acc, dept) => {
      const deptProducts = state.products.filter(p => p.department === dept);
      const valueUsd = deptProducts.reduce((sum, p) => sum + (p.priceUsd * p.stock), 0);
      acc[dept] = { count: deptProducts.length, valueUsd };
      return acc;
    }, {} as Record<string, { count: number; valueUsd: number }>);

    // Desglose por Categoría
    const byCat = CATEGORIES.reduce((acc, cat) => {
      const catProducts = state.products.filter(p => p.category === cat);
      const stockTotal = catProducts.reduce((sum, p) => sum + p.stock, 0);
      if (stockTotal > 0) acc[cat] = stockTotal;
      return acc;
    }, {} as Record<string, number>);

    return { totalCostUsd, totalSaleUsd, grossProfit, profitMargin, byDept, byCat };
  }, [state.products]);

  // ========== ACCIONES ==========
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
      department: p.department || 'Otros',
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

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black">Gestión de Inventario</h2>
          <p className="text-sm text-black/50">Control de stock, valoración y entradas de mercancía</p>
        </div>
        <div className="bg-[#1A2C4E] px-4 py-2 rounded-xl text-white">
          <span className="text-[10px] font-black uppercase opacity-60">Tasa Sistema</span>
          <div className="text-lg font-black text-primary">Bs {state.exchangeRate.toFixed(2)}</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-[#E8E8E8] p-1 rounded-xl w-fit mb-6">
          <TabsTrigger value="catalogo" className="px-6 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black font-bold text-sm">
            <LayoutGrid size={16} className="mr-2" /> Catálogo y Registro
          </TabsTrigger>
          <TabsTrigger value="reportes" className="px-6 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black font-bold text-sm">
            <BarChart3 size={16} className="mr-2" /> Reportes y Valoración
          </TabsTrigger>
          <TabsTrigger value="compras" className="px-6 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black font-bold text-sm">
            <ShoppingBag size={16} className="mr-2" /> Entrada por Compra
          </TabsTrigger>
        </TabsList>

        {/* CONTENIDO: CATÁLOGO */}
        <TabsContent value="catalogo" className="flex-1 flex flex-col overflow-hidden m-0 outline-none">
          <div className="flex justify-between items-center mb-4 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
              <Input 
                placeholder="Buscar por nombre o código..." 
                className="pl-9 h-10 border-[#9E9E9E]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="h-10 border border-[#9E9E9E] rounded-lg px-3 text-sm font-bold bg-white"
            >
              <option value="all">Todas las Categorías</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <Button 
              onClick={() => { resetForm(); setEditingProduct(null); setIsAdding(true); }}
              className="bg-primary hover:brightness-110 text-black font-black"
            >
              <Plus size={18} className="mr-2" /> AGREGAR PRODUCTO
            </Button>
          </div>

          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md flex-1 overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Código</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Producto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Stock</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Costo USD</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Precio USD</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Precio Bs</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => (
                  <TableRow key={p.id} className="border-b border-[#9E9E9E]/40 hover:bg-[#F5F5F5]">
                    <TableCell className="font-mono text-xs text-black/60">{p.barcode}</TableCell>
                    <TableCell>
                      <p className="font-bold text-sm text-black">{p.name}</p>
                      <p className="text-[9px] font-bold text-primary uppercase">{p.category} | {p.department || 'Sin Dept.'}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black border",
                        p.stock <= (p.minStock || 5) ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"
                      )}>
                        {p.stock} UDS
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-black/60">${(p.costUsd || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black text-sm text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black text-sm text-black">Bs {p.priceBs.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600" onClick={() => handleEdit(p)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={() => { if(confirm('¿Eliminar?')) state.deleteProduct(p.id) }}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* CONTENIDO: REPORTES */}
        <TabsContent value="reportes" className="flex-1 overflow-y-auto scrollbar-thin m-0 outline-none pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Valor Inventario (Costo)</p>
              <p className="text-2xl font-black text-black">${reports.totalCostUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-bold text-black/50">Bs {(reports.totalCostUsd * state.exchangeRate).toLocaleString()}</p>
            </div>
            <div className="bg-[#1A2C4E] rounded-xl p-4 shadow-md">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Valor Inventario (Venta)</p>
              <p className="text-2xl font-black text-primary">${reports.totalSaleUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-bold text-white/50">Bs {(reports.totalSaleUsd * state.exchangeRate).toLocaleString()}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-green-800/40 uppercase tracking-widest mb-1">Ganancia Proyectada</p>
                  <p className="text-2xl font-black text-green-700">${reports.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-green-100 p-1 rounded-lg text-green-700"><ArrowUpRight size={20} /></div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest mb-1">Margen Almacén</p>
              <p className="text-2xl font-black text-blue-700">{reports.profitMargin.toFixed(1)}%</p>
              <p className="text-[9px] text-blue-800/60 mt-1 uppercase font-bold">Promedio sobre el costo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breakdown Dept */}
            <div className="bg-white border border-[#9E9E9E] rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#E8E8E8] p-4 border-b border-[#9E9E9E] flex justify-between items-center">
                <h3 className="text-sm font-black uppercase text-black flex items-center gap-2"><LayoutGrid size={16} /> Valor por Departamento</h3>
              </div>
              <div className="p-4 space-y-4">
                {DEPARTMENTS.map(dept => (
                  <div key={dept} className="flex items-center justify-between group hover:bg-[#F5F5F5] p-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1A2C4E]/10 flex items-center justify-center font-bold text-black">{dept[0]}</div>
                      <div>
                        <p className="text-sm font-black text-black">{dept}</p>
                        <p className="text-[10px] text-black/40 font-bold uppercase">{reports.byDept[dept].count} Productos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-black">${reports.byDept[dept].valueUsd.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-primary">Bs {(reports.byDept[dept].valueUsd * state.exchangeRate).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dominio de Categoría */}
            <div className="bg-white border border-[#9E9E9E] rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#E8E8E8] p-4 border-b border-[#9E9E9E]">
                <h3 className="text-sm font-black uppercase text-black flex items-center gap-2"><Package size={16} /> Stock por Categoría</h3>
              </div>
              <div className="p-4 overflow-y-auto max-h-[300px]">
                {Object.entries(reports.byCat).sort((a,b) => b[1] - a[1]).map(([cat, stock]) => (
                  <div key={cat} className="flex items-center gap-4 mb-4 last:mb-0">
                    <div className="w-24 text-right">
                      <span className="text-[10px] font-black uppercase text-black/60">{cat}</span>
                    </div>
                    <div className="flex-1 h-3 bg-[#E8E8E8] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (stock / state.products.length) * 100)}%` }}
                      />
                    </div>
                    <div className="w-16">
                      <span className="text-xs font-black text-black">{stock} Uds</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* CONTENIDO: COMPRAS (REUTILIZADO) */}
        <TabsContent value="compras" className="flex-1 overflow-hidden m-0 outline-none">
          <RegisterPurchase />
        </TabsContent>
      </Tabs>

      {/* MODAL AGREGAR / EDITAR PRODUCTO */}
      <Dialog open={isAdding} onOpenChange={(val) => { if(!val) { setIsAdding(false); setEditingProduct(null); } }}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Tag size={20} className="text-primary" />
                <h3 className="text-lg font-black">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              </div>
              <button type="button" onClick={() => setIsAdding(false)}><X size={18} /></button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-black/40 block mb-1">Código de Barras</label>
                  <Input 
                    value={formData.barcode} 
                    onChange={e => setFormData({...formData, barcode: e.target.value})} 
                    placeholder="Escanee o escriba código" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-black/40 block mb-1">Nombre del Producto</label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="Ej: Whisky Old Parr 12 Años" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-black/40 block mb-1">Departamento</label>
                    <select 
                      value={formData.department} 
                      onChange={e => setFormData({...formData, department: e.target.value})}
                      className="w-full h-10 border border-[#9E9E9E] rounded-lg px-2 text-sm font-bold bg-white"
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-black/40 block mb-1">Categoría</label>
                    <select 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value as Category})}
                      className="w-full h-10 border border-[#9E9E9E] rounded-lg px-2 text-sm font-bold bg-white"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-black/40 block mb-1">Stock Físico</label>
                    <Input 
                      type="number" 
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-black/40 block mb-1">Alerta Mínimo</label>
                    <Input 
                      type="number" 
                      value={formData.minStock} 
                      onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} 
                      required 
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#F5F5F5] rounded-2xl p-4 space-y-4">
                <div className="border-b border-[#9E9E9E] pb-3">
                  <h4 className="text-[10px] font-black uppercase text-black flex items-center gap-1.5 mb-3"><DollarSign size={10} /> Datos de Costo y Margen</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-black/40 block mb-1">Costo Unitario USD</label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={formData.costUsd} 
                        onChange={e => setFormData({...formData, costUsd: Number(e.target.value)})} 
                        className="bg-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-black/40 block mb-1">% de Ganancia</label>
                      <div className="relative">
                        <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40" />
                        <Input 
                          type="number" 
                          value={formData.profitPercent} 
                          onChange={e => setFormData({...formData, profitPercent: Number(e.target.value)})} 
                          className="bg-white font-bold"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-black/40 mt-2">Costo en Bs: <span className="font-bold">{(formData.costUsd * state.exchangeRate).toFixed(2)}</span></p>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase text-black flex items-center gap-1.5 mb-3"><Tag size={10} /> Precios de Venta Final</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-white border border-[#9E9E9E] rounded-xl p-3 flex justify-between items-center shadow-inner">
                      <span className="text-[10px] font-black uppercase text-secondary">Precio USD</span>
                      <span className="text-lg font-black text-secondary">${calculatedPriceUsd.toFixed(2)}</span>
                    </div>
                    <div className="bg-white border border-[#9E9E9E] rounded-xl p-3 flex justify-between items-center shadow-inner">
                      <span className="text-[10px] font-black uppercase text-black">Precio Bolívares</span>
                      <span className="text-lg font-black text-black">Bs {calculatedPriceBs.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-black/30 mt-3 text-center italic">Los precios se recalculan automáticamente según el costo y margen ingresados.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>CANCELAR</Button>
              <Button type="submit" className="bg-primary text-black font-black px-10">
                {editingProduct ? 'GUARDAR CAMBIOS' : 'CREAR PRODUCTO'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
