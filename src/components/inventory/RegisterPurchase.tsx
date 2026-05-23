import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import { registerPurchase } from '@/services/purchaseService';
import { Search, Plus, Trash2, Package, Truck, Receipt, DollarSign, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Product, Supplier } from '@/lib/types';

interface PurchaseItemTemp {
  productId: number;
  name: string;
  qty: number;
  costUsd: number;
}

export default function RegisterPurchase() {
  const state = usePOSState();
  const { suppliers } = useSuppliers();
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [exchangeRate, setExchangeRate] = useState(state.exchangeRate.toString());
  
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemCostUsd, setItemCostUsd] = useState('');
  
  const [tempItems, setTempItems] = useState<PurchaseItemTemp[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtrado de productos para el buscador
  const productResults = useMemo(() => {
    if (!productQuery.trim()) return [];
    const q = productQuery.toLowerCase();
    return state.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.barcode.includes(q)
    ).slice(0, 5);
  }, [productQuery, state.products]);

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
        costUsd: cost
      }
    ]);

    // Reset campos de búsqueda
    setSelectedProduct(null);
    setProductQuery('');
    setItemQty('1');
    setItemCostUsd('');
  };

  const handleRemoveTempItem = (index: number) => {
    setTempItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalInvoiceUsd = tempItems.reduce((sum, item) => sum + (item.qty * item.costUsd), 0);
  const rateNum = parseFloat(exchangeRate) || state.exchangeRate;
  const totalInvoiceBs = totalInvoiceUsd * rateNum;

  const handleProcessPurchase = async () => {
    if (!selectedSupplierId) return alert('Seleccione un proveedor');
    if (!invoiceNumber) return alert('Ingrese el número de factura');
    if (tempItems.length === 0) return alert('No hay productos en la lista');

    setIsProcessing(true);
    const result = await registerPurchase({
      supplierId: parseInt(selectedSupplierId),
      invoiceNumber,
      exchangeRate: rateNum,
      items: tempItems.map(i => ({ productId: i.productId, qty: i.qty, costUsd: i.costUsd }))
    });

    if (result.success) {
      alert(result.message);
      // Limpiar pantalla
      setTempItems([]);
      setInvoiceNumber('');
      setSelectedSupplierId('');
    } else {
      alert(result.message);
    }
    setIsProcessing(false);
  };

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header compacto - SIN PADDING EXCESIVO */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-headline font-black text-black flex items-center gap-2">
              <Truck size={24} className="text-primary" /> Registrar Entrada por Compra
            </h2>
            <p className="text-xs text-black/50">Ingreso masivo de mercancía con recalculo de costo promedio</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* COLUMNA IZQUIERDA */}
            <div className="lg:col-span-1 space-y-4">
              
              {/* Datos de la Factura */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <Receipt size={13} /> Datos del Proveedor
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-black/40">Proveedor</label>
                    <select 
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full h-8 border border-[#9E9E9E] rounded-lg px-2 text-sm font-bold"
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
                    <label className="text-[9px] font-bold uppercase text-black/40">Tasa BCV (Bs/$)</label>
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
                  </div>
                </div>
              </div>

              {/* Buscador de Productos */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <Package size={13} /> Añadir Productos
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black/30" />
                    <Input 
                      placeholder="Nombre o código..."
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                    {productResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-[#9E9E9E] rounded-lg shadow-lg z-20 mt-1 overflow-hidden">
                        {productResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProduct(p);
                              setProductQuery(p.name);
                              setItemCostUsd(p.costUsd?.toString() || '');
                            }}
                            className="w-full text-left p-2 hover:bg-primary/10 transition-colors border-b border-gray-100 last:border-0 text-xs"
                          >
                            <p className="font-bold">{p.name}</p>
                            <p className="text-[9px] text-black/40">Stock: {p.stock} | Costo: ${p.costUsd?.toFixed(2)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedProduct && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[9px] font-black text-primary uppercase mb-1">Producto Seleccionado</p>
                      <p className="text-xs font-bold mb-2">{selectedProduct.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-bold text-black/50 uppercase">Cantidad</label>
                          <Input 
                            type="number" 
                            value={itemQty} 
                            onChange={(e) => setItemQty(e.target.value)}
                            className="h-7 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-black/50 uppercase">Costo USD</label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={itemCostUsd} 
                            onChange={(e) => setItemCostUsd(e.target.value)}
                            className="h-7 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <Button 
                        onClick={handleAddTempItem}
                        className="w-full mt-2 bg-primary text-black font-black h-7 text-xs"
                      >
                        <Plus size={12} className="mr-1" /> AÑADIR
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: TABLA DE REVISIÓN */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="bg-white border border-[#9E9E9E] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-[#1A2C4E] p-3 text-white flex justify-between items-center flex-shrink-0">
                  <h3 className="text-xs font-black uppercase tracking-wider">Ítems para Ingresar ({tempItems.length})</h3>
                  <div className="text-right">
                    <p className="text-[9px] text-white/60">Total Factura</p>
                    <p className="text-lg font-black text-primary">${totalInvoiceUsd.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-[#E8E8E8] sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase">Producto</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-center w-16">Cant.</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right w-20">Costo $</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right w-20">Costo Bs</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right w-20">Subtotal $</TableHead>
                        <TableHead className="text-center w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tempItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-black/30 italic text-xs">
                            No hay productos en la lista
                          </TableCell>
                        </TableRow>
                      ) : (
                        tempItems.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-[#F5F5F5]">
                            <TableCell className="font-bold text-xs">{item.name}</TableCell>
                            <TableCell className="text-center text-xs">{item.qty}</TableCell>
                            <TableCell className="text-right font-mono text-xs">${item.costUsd.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">Bs {(item.costUsd * rateNum).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-black text-xs">${(item.qty * item.costUsd).toFixed(2)}</TableCell>
                            <TableCell>
                              <button 
                                onClick={() => handleRemoveTempItem(idx)}
                                className="text-red-500 hover:text-red-700 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-[#F5F5F5] p-3 border-t flex justify-between items-center flex-shrink-0">
                  <div className="flex gap-3">
                    <div className="bg-white border border-gray-300 rounded px-2 py-1">
                      <span className="text-[8px] block text-gray-500 uppercase">Subtotal USD</span>
                      <span className="text-xs font-black text-black">${totalInvoiceUsd.toFixed(2)}</span>
                    </div>
                    <div className="bg-white border border-gray-300 rounded px-2 py-1">
                      <span className="text-[8px] block text-gray-500 uppercase">Total Bs</span>
                      <span className="text-xs font-black text-secondary">Bs {totalInvoiceBs.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button 
                    disabled={isProcessing || tempItems.length === 0}
                    onClick={handleProcessPurchase}
                    className="bg-primary hover:brightness-110 text-black font-black px-6 h-8 text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={14} className="mr-1 animate-spin" /> PROCESANDO...
                      </>
                    ) : (
                      <>
                        <Save size={14} className="mr-1" /> PROCESAR
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
