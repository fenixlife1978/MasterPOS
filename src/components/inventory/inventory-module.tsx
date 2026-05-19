"use client";

import { useState, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Plus, Search, Info, Pencil, Trash2, X, Barcode as BarcodeIcon, Tag, Boxes, TrendingUp, DollarSign, Percent, Filter, Download, Printer, Share2, FileText, FileSpreadsheet, File, AlertTriangle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product } from '@/lib/types';

interface InventoryModuleProps {
  state: ReturnType<typeof usePOSState>;
}

// Extender Product para incluir campos de costo, ganancia y stock mínimo
interface ProductWithCost extends Product {
  costBs: number;
  costUsd: number;
  profitPercent: number;
  minStock: number;
}

// Umbral mínimo global por defecto
const DEFAULT_MIN_STOCK = 5;

export default function InventoryModule({ state }: InventoryModuleProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'outOfStock' | 'lowStock'>('all');
  const [editingProduct, setEditingProduct] = useState<ProductWithCost | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [costBs, setCostBs] = useState('');
  const [costUsd, setCostUsd] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [minStock, setMinStock] = useState(DEFAULT_MIN_STOCK.toString());
  const [calculatedPriceUsd, setCalculatedPriceUsd] = useState(0);
  const [calculatedPriceBs, setCalculatedPriceBs] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const { toast } = useToast();

  // Calcular precios de venta automáticamente
  useEffect(() => {
    const costUsdNum = parseFloat(costUsd) || 0;
    const profitNum = parseFloat(profitPercent) || 0;
    const calculatedUsd = costUsdNum + (costUsdNum * profitNum / 100);
    setCalculatedPriceUsd(calculatedUsd);
    setCalculatedPriceBs(calculatedUsd * state.exchangeRate);
  }, [costUsd, profitPercent, state.exchangeRate]);

  // Cuando se edita un producto, cargar sus valores
  useEffect(() => {
    if (editingProduct) {
      setCostBs(editingProduct.costBs?.toString() || '');
      setCostUsd(editingProduct.costUsd?.toString() || '');
      setProfitPercent(editingProduct.profitPercent?.toString() || '');
      setMinStock(editingProduct.minStock?.toString() || DEFAULT_MIN_STOCK.toString());
      setCalculatedPriceUsd(editingProduct.priceUsd || 0);
      setCalculatedPriceBs(editingProduct.priceBs || 0);
    }
  }, [editingProduct]);

  // Limpiar formulario al agregar nuevo
  useEffect(() => {
    if (isAdding) {
      setCostBs('');
      setCostUsd('');
      setProfitPercent('');
      setMinStock(DEFAULT_MIN_STOCK.toString());
      setCalculatedPriceUsd(0);
      setCalculatedPriceBs(0);
    }
  }, [isAdding]);

  // Obtener el stock mínimo de un producto (si no tiene, usar el por defecto)
  const getProductMinStock = (product: any) => {
    return product.minStock || DEFAULT_MIN_STOCK;
  };

  // Verificar si un producto tiene stock bajo
  const isLowStock = (product: any) => {
    const min = getProductMinStock(product);
    return product.stock > 0 && product.stock <= min;
  };

  // Filtrar productos según búsqueda y tipo de filtro
  const filtered = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.barcode.includes(search);
    
    if (filterType === 'outOfStock') {
      return matchesSearch && p.stock === 0;
    } else if (filterType === 'lowStock') {
      return matchesSearch && isLowStock(p);
    }
    return matchesSearch;
  });

  // Contar productos por estado
  const outOfStockCount = state.products.filter(p => p.stock === 0).length;
  const lowStockCount = state.products.filter(p => isLowStock(p)).length;

  const handleDelete = (id: number) => {
    if (confirm('¿Desea eliminar este producto permanentemente?')) {
      state.deleteProduct(id);
      toast({ title: "Eliminado", description: "Producto eliminado correctamente." });
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const costBsNum = parseFloat(formData.get('costBs') as string) || 0;
    const costUsdNum = parseFloat(formData.get('costUsd') as string) || 0;
    const profitPercentNum = parseFloat(formData.get('profitPercent') as string) || 0;
    const minStockNum = parseInt(formData.get('minStock') as string) || DEFAULT_MIN_STOCK;
    
    const salePriceUsd = costUsdNum + (costUsdNum * profitPercentNum / 100);
    const salePriceBs = salePriceUsd * state.exchangeRate;
    
    const data = {
      barcode: formData.get('barcode') as string,
      name: formData.get('name') as string,
      category: formData.get('category') as any,
      costBs: costBsNum,
      costUsd: costUsdNum,
      profitPercent: profitPercentNum,
      minStock: minStockNum,
      priceUsd: salePriceUsd,
      priceBs: salePriceBs,
      stock: parseInt(formData.get('stock') as string),
    };

    if (isAdding) {
      state.addProduct({ id: Date.now(), ...data });
      toast({ title: "Éxito", description: "Producto agregado correctamente." });
      setIsAdding(false);
    } else if (editingProduct) {
      state.updateProduct({ ...editingProduct, ...data });
      toast({ title: "Éxito", description: "Producto actualizado correctamente." });
      setEditingProduct(null);
    }
  };

  const getStockColor = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "bg-red-100 text-red-700 border-red-300";
    } else if (product.stock <= minStock) {
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    } else {
      return "bg-green-100 text-green-700 border-green-300";
    }
  };

  const getStockText = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "AGOTADO";
    } else if (product.stock <= minStock) {
      return `STOCK MÍNIMO (${product.stock}/${minStock})`;
    } else {
      return `${product.stock} UDS`;
    }
  };

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = ['Código', 'Nombre', 'Categoría', 'Precio BS', 'Precio USD', 'Stock', 'Stock Mínimo', 'Costo BS', 'Costo USD', '% Ganancia'];
    const rows = filtered.map(p => [
      p.barcode,
      p.name,
      p.category,
      p.priceBs,
      p.priceUsd,
      p.stock,
      getProductMinStock(p),
      (p as any).costBs || '',
      (p as any).costUsd || '',
      (p as any).profitPercent || ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Exportado", description: "Archivo CSV generado correctamente." });
  };

  // Exportar a Excel
  const exportToExcel = () => {
    const headers = ['Código', 'Nombre', 'Categoría', 'Precio BS', 'Precio USD', 'Stock', 'Stock Mínimo', 'Costo BS', 'Costo USD', '% Ganancia'];
    const rows = filtered.map(p => [
      p.barcode,
      p.name,
      p.category,
      p.priceBs,
      p.priceUsd,
      p.stock,
      getProductMinStock(p),
      (p as any).costBs || '',
      (p as any).costUsd || '',
      (p as any).profitPercent || ''
    ]);
    
    let htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Inventario MasterPOS</title>
          <style>
            th { background: #D4A017; color: black; padding: 8px; }
            td { padding: 6px; border: 1px solid #ddd; }
            table { border-collapse: collapse; width: 100%; }
          </style>
        </head>
        <body>
          <h2>Inventario - ${new Date().toLocaleString()}</h2>
          <table>
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Precio BS</th><th>Precio USD</th><th>Stock</th><th>Stock Mínimo</th><th>Costo BS</th><th>Costo USD</th><th>% Ganancia</th></tr>
            </thead>
            <tbody>
    `;
    
    rows.forEach(row => {
      htmlContent += `<td>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    });
    
    htmlContent += `
            </tbody>
          </table>
          <p>Generado: ${new Date().toLocaleString()}</p>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0,19)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Exportado", description: "Archivo Excel generado correctamente." });
  };

  // Exportar a PDF
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Inventario MasterPOS</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #D4A017; text-align: center; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #666; margin-top: 0; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #D4A017; color: black; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            .stock-zero { color: red; font-weight: bold; }
            .stock-low { color: orange; font-weight: bold; }
            .stock-ok { color: green; }
          </style>
        </head>
        <body>
          <h1>MasterPOS</h1>
          <div class="subtitle">Reporte de Inventario</div>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Filtro: ${filterType === 'all' ? 'Todos los productos' : filterType === 'outOfStock' ? 'Productos Agotados' : 'Productos con Stock Mínimo'}</p>
          <p>Total de productos: ${filtered.length}</p>
          <table>
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Precio USD</th><th>Stock</th></tr>
            </thead>
            <tbody>
              ${filtered.map(p => `
                <tr>
                  <td>${p.barcode}</td>
                  <td>${p.name}</td>
                  <td>${p.category}</td>
                  <td>$${p.priceUsd.toFixed(2)}</td>
                  <td class="${p.stock === 0 ? 'stock-zero' : isLowStock(p) ? 'stock-low' : 'stock-ok'}">${p.stock === 0 ? 'AGOTADO' : isLowStock(p) ? `${p.stock} / ${getProductMinStock(p)}` : `${p.stock} UDS`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Reporte generado por MasterPOS - Sistema de Punto de Venta</p>
          </div>
          <script>
            window.print();
          </script>
        </body>
      </html>
    `;
    printWindow?.document.write(content);
    printWindow?.document.close();
  };

  // Imprimir
  const handlePrint = () => {
    exportToPDF();
  };

  // Compartir
  const handleShare = () => {
    const shareData = {
      title: 'Inventario MasterPOS',
      text: `Inventario actual - Total productos: ${filtered.length} | Agotados: ${outOfStockCount} | Stock mínimo: ${lowStockCount}`,
      url: window.location.href
    };
    
    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
        toast({ title: "Copiado", description: "Información copiada al portapapeles." });
      });
    } else {
      navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
      toast({ title: "Copiado", description: "Información copiada al portapapeles." });
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-headline font-black text-foreground">Inventario Premium</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar producto..." 
              className="pl-9 h-10 bg-white border-border text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={() => setIsAdding(true)}
            className="bg-primary hover:brightness-105 text-black font-black shadow-md"
          >
            <Plus size={18} className="mr-2" /> AGREGAR
          </Button>

          <Button 
            onClick={() => setShowExportModal(true)}
            className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-black/20 font-black"
          >
            <Download size={16} className="mr-2" /> EXPORTAR
          </Button>
        </div>
      </div>

      {/* Filtros de stock */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          onClick={() => setFilterType('all')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filterType === 'all' 
              ? "bg-[#1A2C4E] text-white" 
              : "bg-[#E8E8E8] text-black hover:bg-[#D4A017]"
          )}
        >
          <Filter size={12} className="mr-1" /> TODOS ({state.products.length})
        </Button>
        <Button
          onClick={() => setFilterType('outOfStock')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filterType === 'outOfStock' 
              ? "bg-red-600 text-white" 
              : "bg-red-100 text-red-700 hover:bg-red-200"
          )}
        >
          AGOTADOS ({outOfStockCount})
        </Button>
        <Button
          onClick={() => setFilterType('lowStock')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filterType === 'lowStock' 
              ? "bg-yellow-600 text-white" 
              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          )}
        >
          STOCK MÍNIMO ({lowStockCount})
        </Button>
      </div>

      {/* Modal de exportación */}
      {showExportModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-[#9E9E9E]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-black">Exportar Inventario</h3>
              <button onClick={() => setShowExportModal(false)} className="text-black/50 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { exportToCSV(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={16} /> EXPORTAR A CSV
              </button>
              <button
                onClick={() => { exportToExcel(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <FileSpreadsheet size={16} /> EXPORTAR A EXCEL
              </button>
              <button
                onClick={() => { exportToPDF(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <File size={16} /> EXPORTAR A PDF
              </button>
              <button
                onClick={() => { handlePrint(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Printer size={16} /> IMPRIMIR
              </button>
              <button
                onClick={() => { handleShare(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Share2 size={16} /> COMPARTIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de inventario - COLUMNAS CORREGIDAS */}
      <div className="bg-card/50 border border-border rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Código</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Producto</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Categoría</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Precio (USD)</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Stock</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const productMinStock = getProductMinStock(p);
              
              return (
                <TableRow key={p.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{p.barcode}</TableCell>
                  <TableCell className="font-bold text-sm text-foreground">{p.name}</TableCell>
                  <TableCell>
                    <span className="bg-primary text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                      {p.category}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-sm text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm inline-block min-w-[100px] whitespace-nowrap text-center",
                      getStockColor(p)
                    )}>
                      {getStockText(p)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-secondary hover:bg-secondary/10"
                        onClick={() => setViewingProduct(p)}
                      >
                        <Info size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-secondary hover:bg-secondary/10"
                        onClick={() => setEditingProduct(p as ProductWithCost)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                  No se encontraron productos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* MODAL EDITAR / AGREGAR */}
      <Dialog open={!!editingProduct || isAdding} onOpenChange={() => { setEditingProduct(null); setIsAdding(false); }}>
        <DialogContent className="bg-white border-border text-foreground max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{isAdding ? 'Nuevo Producto' : 'Editar Producto'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="flex flex-col">
            <div className="bg-secondary p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {isAdding ? <Plus size={20} /> : <Pencil size={20} />}
                  <h3 className="text-lg font-headline font-black">
                    {isAdding ? 'Nuevo Producto' : 'Editar Producto'}
                  </h3>
                </div>
                <button 
                  type="button"
                  onClick={() => { setEditingProduct(null); setIsAdding(false); }} 
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Fila 1: Código y Nombre */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código de Barras</label>
                  <Input name="barcode" defaultValue={editingProduct?.barcode} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nombre del Producto</label>
                  <Input name="name" defaultValue={editingProduct?.name} required className="bg-background border-border" />
                </div>
              </div>

              {/* Fila 2: Categoría, Stock y Stock Mínimo */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Categoría</label>
                  <select name="category" defaultValue={editingProduct?.category} className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm focus:ring-2 focus:ring-secondary outline-none text-foreground">
                    <option value="Whisky">Whisky</option>
                    <option value="Ron">Ron</option>
                    <option value="Cerveza">Cerveza</option>
                    <option value="Vino">Vino</option>
                    <option value="Vodka">Vodka</option>
                    <option value="Tequila">Tequila</option>
                    <option value="Licor">Licor</option>
                    <option value="Gin">Gin</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Stock Inicial</label>
                  <Input name="stock" type="number" defaultValue={editingProduct?.stock} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle size={10} /> Stock Mínimo
                  </label>
                  <Input 
                    name="minStock" 
                    type="number" 
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder={DEFAULT_MIN_STOCK.toString()}
                    required 
                    className="bg-background border-border"
                  />
                </div>
              </div>

              {/* Fila 3: Costo */}
              <div className="bg-muted/30 p-3 rounded-lg mb-4">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Tag size={10} /> DATOS DE COSTO
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Costo (Bs)</label>
                    <Input 
                      name="costBs" 
                      type="number" 
                      step="0.01"
                      value={costBs}
                      onChange={(e) => setCostBs(e.target.value)}
                      placeholder="0.00"
                      required 
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Costo (USD)</label>
                    <Input 
                      name="costUsd" 
                      type="number" 
                      step="0.01"
                      value={costUsd}
                      onChange={(e) => setCostUsd(e.target.value)}
                      placeholder="0.00"
                      required 
                      className="bg-background border-border"
                    />
                  </div>
                </div>
              </div>

              {/* Fila 4: % Ganancia y Precios calculados */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <p className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Percent size={10} /> CONFIGURACIÓN DE GANANCIA
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">% de Ganancia</label>
                    <Input 
                      name="profitPercent" 
                      type="number" 
                      step="0.01"
                      value={profitPercent}
                      onChange={(e) => setProfitPercent(e.target.value)}
                      placeholder="30"
                      required 
                      className="bg-background border-primary/30"
                    />
                  </div>
                </div>

                <div className="bg-secondary/10 p-3 rounded-lg">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-2 flex items-center gap-1">
                    <DollarSign size={10} /> PRECIOS DE VENTA (Calculados)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] font-bold text-muted-foreground">Precio Venta USD</label>
                      <div className="text-base font-black text-secondary">
                        ${calculatedPriceUsd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-muted-foreground">Precio Venta Bs</label>
                      <div className="text-base font-black text-foreground">
                        Bs {calculatedPriceBs.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-2 text-center">
                    Tasa BCV: {state.exchangeRate.toFixed(2)} Bs/USD
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-4 border-t border-border flex justify-end gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => { setEditingProduct(null); setIsAdding(false); }} 
                className="px-6 text-foreground"
              >
                CANCELAR
              </Button>
              <Button 
                type="submit" 
                className="px-6 bg-secondary text-white font-black hover:bg-secondary/90"
              >
                GUARDAR CAMBIOS
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL KARDEX */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="bg-white border-border text-foreground max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalles del Producto: {viewingProduct?.name}</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary p-6 text-white relative">
                <button onClick={() => setViewingProduct(null)} className="absolute top-4 right-4 hover:opacity-70"><X size={20} /></button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                    <BarcodeIcon size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-headline font-black leading-tight">{viewingProduct.name}</h3>
                    <p className="text-sm font-bold opacity-80 uppercase tracking-widest">{viewingProduct.category}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-3 gap-6">
                <div className="space-y-6 col-span-1 border-r border-border pr-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código Fiscal</span>
                    <p className="font-mono text-sm font-bold text-foreground">{viewingProduct.barcode}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Disponibilidad Actual</span>
                    <div className="flex items-center gap-2">
                      <Boxes size={18} className="text-secondary" />
                      <p className={cn(
                        "text-xl font-black",
                        viewingProduct.stock === 0 ? "text-red-600" :
                        isLowStock(viewingProduct) ? "text-yellow-600" :
                        "text-green-600"
                      )}>
                        {viewingProduct.stock === 0 ? "AGOTADO" : `${viewingProduct.stock} / ${getProductMinStock(viewingProduct)} Unidades`}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Precio USD</span>
                      <span className="text-lg font-black text-secondary">${viewingProduct.priceUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Precio Bs</span>
                      <span className="text-lg font-black text-foreground">Bs {viewingProduct.priceBs.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-secondary">
                      <TrendingUp size={14} /> Historial de Movimientos
                    </h4>
                    <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-bold">Últimos 30 días</span>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                    {state.transactions
                      .filter(t => t.items.some(i => i.productId === viewingProduct.id))
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 20)
                      .map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl group hover:border-secondary/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {new Date(t.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-foreground">Venta #{t.id}</div>
                              <div className="text-[9px] text-muted-foreground uppercase">{t.clientName || 'Cliente Final'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-destructive">-{t.items.find(i => i.productId === viewingProduct.id)?.qty} UDS</div>
                            <div className="text-[9px] text-muted-foreground uppercase">{t.payMethod?.toUpperCase() || 'N/A'}</div>
                          </div>
                        </div>
                      ))}
                    {state.transactions.filter(t => t.items.some(i => i.productId === viewingProduct.id)).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-muted/30">
                        <TrendingUp size={40} strokeWidth={1} />
                        <p className="text-xs font-bold mt-2">Sin movimientos registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 border-t border-border flex justify-end">
                <Button variant="ghost" onClick={() => setViewingProduct(null)} className="font-bold text-xs uppercase tracking-widest text-foreground">Cerrar Kardex</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}