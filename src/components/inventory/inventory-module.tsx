"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Plus, Search, Info, Pencil, Trash2, X, Barcode as BarcodeIcon, Tag, Boxes, TrendingUp } from 'lucide-react';
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

export default function InventoryModule({ state }: InventoryModuleProps) {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const { toast } = useToast();

  const filtered = state.products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  const handleDelete = (id: number) => {
    if (confirm('¿Desea eliminar este producto permanentemente?')) {
      state.deleteProduct(id);
      toast({ title: "Eliminado", description: "Producto eliminado correctamente." });
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      barcode: formData.get('barcode') as string,
      name: formData.get('name') as string,
      category: formData.get('category') as any,
      priceBs: parseFloat(formData.get('priceBs') as string),
      priceUsd: parseFloat(formData.get('priceUsd') as string),
      stock: parseInt(formData.get('stock') as string),
    };

    if (isAdding) {
      state.addProduct({ id: Date.now(), ...data });
      toast({ title: "Éxito", description: "Producto agregado." });
      setIsAdding(false);
    } else if (editingProduct) {
      state.updateProduct({ ...editingProduct, ...data });
      toast({ title: "Éxito", description: "Producto actualizado." });
      setEditingProduct(null);
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full scrollbar-thin">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-headline font-black text-foreground">Inventario Premium</h2>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input 
              placeholder="Buscar producto..." 
              className="pl-9 h-10 bg-card border-border text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button 
            onClick={() => setIsAdding(true)}
            className="bg-primary hover:bg-primary/90 text-black font-black shadow-md"
          >
            <Plus size={18} className="mr-2" /> AGREGAR PRODUCTO
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-[#111111]">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Código</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Producto</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Categoría</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Precio (BS)</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest text-center">Stock</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="border-border hover:bg-secondary/30 transition-colors">
                <TableCell className="font-mono text-[11px] text-muted-foreground">{p.barcode}</TableCell>
                <TableCell className="font-bold text-sm text-foreground">{p.name}</TableCell>
                <TableCell>
                  <span className="bg-primary text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border border-primary/20">
                    {p.category}
                  </span>
                </TableCell>
                <TableCell className="font-bold text-sm text-foreground">{p.priceBs.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <span className="bg-[#00FF00] text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md border border-green-800 inline-block min-w-[90px] whitespace-nowrap text-center">
                    {p.stock} UDS
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-accent hover:bg-accent/10"
                      onClick={() => setViewingProduct(p)}
                    >
                      <Info size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-accent hover:bg-accent/10"
                      onClick={() => setEditingProduct(p)}
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MODAL EDITAR / AGREGAR */}
      <Dialog open={!!editingProduct || isAdding} onOpenChange={() => { setEditingProduct(null); setIsAdding(false); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-black text-primary flex items-center gap-2">
              {isAdding ? <Plus className="text-primary" /> : <Pencil className="text-primary" />}
              {isAdding ? 'Nuevo Producto' : 'Editar Producto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Código de Barras</label>
                <Input name="barcode" defaultValue={editingProduct?.barcode} required className="bg-background border-border" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Nombre</label>
                <Input name="name" defaultValue={editingProduct?.name} required className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Precio BS</label>
                <Input name="priceBs" type="number" step="0.01" defaultValue={editingProduct?.priceBs} required className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Precio USD</label>
                <Input name="priceUsd" type="number" step="0.01" defaultValue={editingProduct?.priceUsd} required className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Stock</label>
                <Input name="stock" type="number" defaultValue={editingProduct?.stock} required className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Categoría</label>
                <select name="category" defaultValue={editingProduct?.category} className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm focus:ring-2 focus:ring-primary outline-none text-foreground">
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
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => { setEditingProduct(null); setIsAdding(false); }} className="flex-1 text-foreground">CANCELAR</Button>
              <Button type="submit" className="flex-1 bg-primary text-black font-black">GUARDAR CAMBIOS</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL KARDEX (DETALLES) */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl p-0 overflow-hidden rounded-2xl shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalles del Producto: {viewingProduct?.name}</DialogTitle>
            <DialogDescription>
              Ficha técnica e historial de movimientos de inventario para el producto {viewingProduct?.name}.
            </DialogDescription>
          </DialogHeader>
          {viewingProduct && (
            <div className="flex flex-col h-full">
              <div className="gold-gradient p-6 text-black relative">
                <button onClick={() => setViewingProduct(null)} className="absolute top-4 right-4 hover:opacity-70"><X size={20} /></button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-black/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
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
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Código Fiscal</span>
                    <p className="font-mono text-sm font-bold text-foreground">{viewingProduct.barcode}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Disponibilidad Actual</span>
                    <div className="flex items-center gap-2">
                      <Boxes size={18} className="text-primary" />
                      <p className="text-xl font-black text-[#00FF00]">{viewingProduct.stock} Unidades</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted uppercase">Precio BS</span>
                      <span className="text-lg font-black text-foreground">{viewingProduct.priceBs.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted uppercase">Precio USD</span>
                      <span className="text-lg font-black text-primary">{viewingProduct.priceUsd.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                      <TrendingUp size={14} /> Historial de Movimientos
                    </h4>
                    <span className="text-[9px] bg-secondary text-muted px-2 py-0.5 rounded font-bold">Últimos 30 días</span>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                    {state.transactions
                      .filter(t => t.items.some(i => i.productId === viewingProduct.id))
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 bg-secondary/50 border border-border rounded-xl group hover:border-primary/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-[10px] font-bold text-muted">
                              {new Date(t.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-foreground">Venta #{t.id}</div>
                              <div className="text-[9px] text-muted uppercase">{t.clientName || 'Cliente Final'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-destructive">-{t.items.find(i => i.productId === viewingProduct.id)?.qty} UDS</div>
                            <div className="text-[9px] text-muted uppercase">{t.payMethod.toUpperCase()}</div>
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

              <div className="bg-secondary/30 p-4 border-t border-border flex justify-end">
                <Button variant="ghost" onClick={() => setViewingProduct(null)} className="font-bold text-xs uppercase tracking-widest text-foreground">Cerrar Kardex</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
