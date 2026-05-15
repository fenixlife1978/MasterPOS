"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Plus, Search, BrainCircuit } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { intelligentInventoryForecast, IntelligentInventoryForecastOutput } from '@/ai/flows/intelligent-inventory-forecast';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InventoryModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function InventoryModule({ state }: InventoryModuleProps) {
  const [search, setSearch] = useState('');
  const [loadingForecast, setLoadingForecast] = useState<number | null>(null);
  const [forecasts, setForecasts] = useState<Record<number, IntelligentInventoryForecastOutput>>({});
  const { toast } = useToast();

  const filtered = state.products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  const getForecast = async (productId: number) => {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    setLoadingForecast(productId);
    try {
      const history = state.transactions
        .filter(t => t.items.some(i => i.productId === productId))
        .map(t => ({
          date: t.date,
          quantity: t.items.find(i => i.productId === productId)?.qty || 0
        }));

      const result = await intelligentInventoryForecast({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        salesHistory: history,
        daysForForecast: 30,
        reorderBufferDays: 7
      });
      
      setForecasts(prev => ({ ...prev, [productId]: result }));
    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el pronóstico.", variant: "destructive" });
    } finally {
      setLoadingForecast(null);
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
          <Button className="bg-primary hover:bg-primary/90 text-accent font-black">
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
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest text-right">Inteligencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="border-border hover:bg-secondary/30 transition-colors">
                <TableCell className="font-mono text-[11px] text-muted-foreground">{p.barcode}</TableCell>
                <TableCell className="font-bold text-sm text-foreground">{p.name}</TableCell>
                <TableCell>
                  <span className="bg-primary text-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                    {p.category}
                  </span>
                </TableCell>
                <TableCell className="font-bold text-sm">{p.priceBs.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <span className="bg-[#00FF00] text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border border-green-700">
                    {p.stock} UDS
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    {forecasts[p.id] ? (
                      <div className="text-[10px] text-left max-w-[200px] bg-[#111111] p-2 rounded border border-primary/10">
                        <div className="text-primary font-bold mb-1 flex items-center gap-1">
                          <BrainCircuit size={10} /> Pronóstico AI
                        </div>
                        <p className="text-muted-foreground italic leading-tight">{forecasts[p.id].reasoning.substring(0, 100)}...</p>
                        <div className="mt-2 flex justify-between font-bold">
                          <span>Agotamiento:</span>
                          <span className="text-[#FF0000]">{forecasts[p.id].predictedStockoutDays} días</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Sugerido:</span>
                          <span className="text-[#00FF00]">{forecasts[p.id].suggestedReorderQuantity} uds</span>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] font-black text-accent hover:text-accent hover:bg-accent/10"
                        onClick={() => getForecast(p.id)}
                        disabled={loadingForecast === p.id}
                      >
                        <BrainCircuit size={14} className={cn("mr-1.5", loadingForecast === p.id && "animate-spin")} />
                        {loadingForecast === p.id ? 'ANALIZANDO...' : 'PROYECTAR'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
