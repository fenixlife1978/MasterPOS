import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import { Search, Plus, Trash2, Package, Truck, Receipt, DollarSign, Loader2, Save, CalendarDays, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Product, SupplierInvoice, PurchaseInvoiceItem } from '@/lib/types';
import { syncService } from '@/services/syncService';

interface PurchaseItemTemp {
  productId: number;
  name: string;
  qty: number;
  costUsd: number;
}

type PaymentType = 'contado' | 'credito' | 'mixto';

export default function RegisterPurchase() {
  const state = usePOSState();
  const { suppliers } = useSuppliers();
  
  // Datos de la factura
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [exchangeRate, setExchangeRate] = useState(state.exchangeRate.toFixed(2));
  
  // Items temporales
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemCostUsd, setItemCostUsd] = useState('');
  const [tempItems, setTempItems] = useState<PurchaseItemTemp[]>([]);
  
  // Estados para el tipo de pago
  const [paymentType, setPaymentType] = useState<PaymentType>('contado');
  const [paidUsd, setPaidUsd] = useState<number>(0);
  const [paidBs, setPaidBs] = useState<number>(0);
  const [creditTermDays, setCreditTermDays] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState(false);

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
        costUsd: parseFloat(cost.toFixed(2))
      }
    ]);

    setSelectedProduct(null);
    setProductQuery('');
    setItemQty('1');
    setItemCostUsd('');
  };

  const handleRemoveTempItem = (index: number) => {
    setTempItems(prev => prev.filter((_, i) => i !== index));
  };

  // Totales con 2 decimales
  const totalInvoiceUsd = parseFloat(tempItems.reduce((sum, item) => sum + (item.qty * item.costUsd), 0).toFixed(2));
  const rateNum = parseFloat(parseFloat(exchangeRate).toFixed(2)) || state.exchangeRate;
  const totalInvoiceBs = parseFloat((totalInvoiceUsd * rateNum).toFixed(2));

  // Manejo de la conversión automática con 2 decimales
  const handlePaidUsdChange = (value: number) => {
    const roundedUsd = parseFloat(value.toFixed(2));
    setPaidUsd(roundedUsd);
    if (paymentType === 'mixto') {
      const roundedBs = parseFloat((roundedUsd * rateNum).toFixed(2));
      setPaidBs(roundedBs);
    }
  };

  const handlePaidBsChange = (value: number) => {
    const roundedBs = parseFloat(value.toFixed(2));
    setPaidBs(roundedBs);
    if (paymentType === 'mixto') {
      const roundedUsd = parseFloat((roundedBs / rateNum).toFixed(2));
      setPaidUsd(roundedUsd);
    }
  };

  // Calcular montos pagados y saldo
  const totalPaidUsd = paymentType === 'contado' ? totalInvoiceUsd : (paymentType === 'credito' ? 0 : paidUsd);
  const totalPaidBs = parseFloat((totalPaidUsd * rateNum).toFixed(2));
  const remainingUsd = parseFloat(Math.max(0, totalInvoiceUsd - totalPaidUsd).toFixed(2));
  const remainingBs = parseFloat((remainingUsd * rateNum).toFixed(2));

  const invoiceStatus = () => {
    if (paymentType === 'contado') return 'pagada';
    if (paymentType === 'credito') return 'pendiente';
    if (remainingUsd <= 0) return 'pagada';
    if (totalPaidUsd > 0 && remainingUsd > 0) return 'parcial';
    return 'pendiente';
  };

  const handleProcessPurchase = async () => {
    if (!selectedSupplierId) return alert('Seleccione un proveedor');
    if (!invoiceNumber) return alert('Ingrese el número de factura');
    if (tempItems.length === 0) return alert('No hay productos en la lista');

    setIsProcessing(true);
    
    try {
      const subtotal = totalInvoiceUsd / 1.16;
      const iva = totalInvoiceUsd - subtotal;
      const timestamp = new Date().toISOString();
      const invoiceId = Date.now();
      
      // Construir notas con la información del pago (para no modificar la interfaz)
      const paymentNotes = `Tipo de pago: ${paymentType === 'contado' ? 'Contado' : paymentType === 'credito' ? `Crédito a ${creditTermDays} días` : `Mixto (USD: ${paidUsd.toFixed(2)} / Bs: ${paidBs.toFixed(2)})`}. Saldo pendiente: $${remainingUsd.toFixed(2)}`;
      
      const newInvoice: SupplierInvoice = {
        id: invoiceId,
        supplierId: parseInt(selectedSupplierId),
        invoiceNumber: invoiceNumber,
        date: timestamp,
        dueDate: paymentType === 'credito' 
          ? new Date(Date.now() + creditTermDays * 24 * 60 * 60 * 1000).toISOString()
          : timestamp,
        subtotal: parseFloat(subtotal.toFixed(4)),
        iva: parseFloat(iva.toFixed(4)),
        total: totalInvoiceUsd,
        paidAmount: totalPaidUsd,
        status: invoiceStatus(),
        notes: paymentNotes,
        exchangeRate: rateNum,
        itemsCount: tempItems.length,
        createdAt: timestamp,
      };
      
      await syncService.savePurchaseInvoice(newInvoice);
      
      const items: PurchaseInvoiceItem[] = tempItems.map((item, idx) => ({
        id: `${invoiceId}_${idx}`,
        invoiceId: invoiceId,
        productId: item.productId,
        productName: item.name,
        qty: item.qty,
        costUsd: item.costUsd,
        totalUsd: parseFloat((item.qty * item.costUsd).toFixed(4)),
        createdAt: timestamp
      }));
      
      await syncService.savePurchaseInvoiceItems(invoiceId, items);
      
      // Actualizar stock y costos promedio
      for (const item of tempItems) {
        const product = state.products.find(p => p.id === item.productId);
        if (product) {
          const currentStock = product.stock;
          const currentCost = product.costUsd || 0;
          const newStock = currentStock + item.qty;
          
          // ✅ CORREGIDO: Calcular y redondear correctamente sin usar toFixed directamente en números
          const newAverageCostRaw = ((currentStock * currentCost) + (item.qty * item.costUsd)) / newStock;
          const newAverageCost = parseFloat(newAverageCostRaw.toFixed(4));
          
          const profitPercent = product.profitPercent || 30;
          const newPriceUsdRaw = newAverageCost * (1 + profitPercent / 100);
          const newPriceUsd = parseFloat(newPriceUsdRaw.toFixed(4));
          
          const updatedProduct = {
            ...product,
            stock: newStock,
            costUsd: newAverageCost,
            costBs: newAverageCost * rateNum,
            priceUsd: newPriceUsd,
            priceBs: newPriceUsd * rateNum
          };
          await state.updateProduct(updatedProduct);
        }
      }
      
      // Actualizar deuda del proveedor (solo si hay saldo pendiente)
      const supplier = suppliers.find(s => s.id === parseInt(selectedSupplierId));
      if (supplier && remainingUsd > 0) {
        await syncService.saveSupplier({
          ...supplier,
          totalDebt: parseFloat(((supplier.totalDebt || 0) + remainingUsd).toFixed(2))
        });
      }
      
      alert(`✅ Compra registrada exitosamente\nEstado: ${invoiceStatus()}\nTotal: $${totalInvoiceUsd.toFixed(2)}\nPagado: $${totalPaidUsd.toFixed(2)}\nSaldo: $${remainingUsd.toFixed(2)}`);
      setTempItems([]);
      setInvoiceNumber('');
      setSelectedSupplierId('');
      setPaidUsd(0);
      setPaidBs(0);
      setPaymentType('contado');
      
    } catch (error) {
      console.error('Error al registrar compra:', error);
      alert('❌ Error al registrar la compra');
    }
    
    setIsProcessing(false);
  };

  return (
    <div className="h-full w-full overflow-hidden p-6 bg-background">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-headline font-black text-black flex items-center gap-2">
              <Truck size={24} className="text-primary" /> Registrar Entrada por Compra
            </h2>
            <p className="text-xs text-black/50">Módulo de gestión de ingresos masivos</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Columna izquierda */}
            <div className="lg:col-span-1 space-y-4">
              {/* Datos de la factura */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <Receipt size={13} /> Datos de la Factura
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-black/40">Proveedor</label>
                    <select 
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full h-8 border border-[#9E9E9E] rounded-lg px-2 text-sm font-bold bg-white"
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
                    <label className="text-[9px] font-bold uppercase text-black/40">Tasa BCV Aplicada (Bs/$)</label>
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

              {/* Condiciones de pago */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <HandCoins size={13} /> Condiciones de Pago
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('contado');
                        setPaidUsd(totalInvoiceUsd);
                        setPaidBs(parseFloat((totalInvoiceUsd * rateNum).toFixed(2)));
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded border transition-all",
                        paymentType === 'contado' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      CONTADO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('credito');
                        setPaidUsd(0);
                        setPaidBs(0);
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded border transition-all",
                        paymentType === 'credito' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      CRÉDITO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('mixto');
                        setPaidUsd(0);
                        setPaidBs(0);
                      }}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold rounded border transition-all",
                        paymentType === 'mixto' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      MIXTO
                    </button>
                  </div>

                  {paymentType === 'credito' && (
                    <div className="flex items-center gap-2">
                      <CalendarDays size={12} className="text-black/40" />
                      <Input
                        type="number"
                        value={creditTermDays}
                        onChange={(e) => setCreditTermDays(Number(e.target.value))}
                        className="h-7 text-xs w-20 text-center"
                      />
                      <span className="text-[9px] text-black/60">días de plazo</span>
                    </div>
                  )}

                  {paymentType === 'mixto' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[8px] font-bold uppercase text-black/40">Pago en USD</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paidUsd}
                          onChange={(e) => handlePaidUsdChange(Number(e.target.value))}
                          className="h-7 text-xs"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold uppercase text-black/40">Pago en Bs</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paidBs}
                          onChange={(e) => handlePaidBsChange(Number(e.target.value))}
                          className="h-7 text-xs"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}

                  {/* Resumen de pagos con 2 decimales */}
                  <div className="bg-gray-50 p-2 rounded-md mt-2">
                    <div className="flex justify-between text-[9px]">
                      <span>Total factura USD:</span>
                      <span className="font-bold">${totalInvoiceUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span>Total pagado USD:</span>
                      <span className="font-bold text-green-600">${totalPaidUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold">
                      <span>Saldo pendiente USD:</span>
                      <span className={remainingUsd > 0 ? "text-red-600" : "text-green-600"}>${remainingUsd.toFixed(2)}</span>
                    </div>
                    {paymentType === 'credito' && (
                      <div className="text-[8px] text-amber-600 mt-1 text-center">
                        Plazo de crédito: {creditTermDays} días
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Añadir productos */}
              <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 shadow-sm">
                <h3 className="text-[11px] font-black uppercase text-black/60 mb-3 flex items-center gap-2">
                  <Package size={13} /> Añadir Productos al Lote
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black/30" />
                    <Input 
                      placeholder="Buscar producto..."
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
                              setItemCostUsd(p.costUsd?.toFixed(2) || '');
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
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-[9px] font-black text-primary uppercase mb-1">Producto: {selectedProduct.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-bold text-black/50 uppercase">Cant. Entrante</label>
                          <Input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="h-7 text-sm" />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-black/50 uppercase">Costo USD (Unit)</label>
                          <Input type="number" step="0.01" value={itemCostUsd} onChange={(e) => setItemCostUsd(e.target.value)} className="h-7 text-sm font-mono" />
                        </div>
                      </div>
                      <Button onClick={handleAddTempItem} className="w-full mt-2 bg-primary text-black font-black h-7 text-xs">
                        <Plus size={12} className="mr-1" /> AGREGAR A LISTA
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha: tabla de items */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="bg-white border border-[#9E9E9E] rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-[#1A2C4E] p-3 text-white flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider">Detalle del Ingreso ({tempItems.length} items)</h3>
                  <div className="text-right">
                    <p className="text-[9px] text-white/60">Total Factura USD</p>
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
                        <TableHead className="text-[9px] font-black uppercase text-right w-24">Subtotal $</TableHead>
                        <TableHead className="text-center w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tempItems.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-black/30 italic text-xs">Añada productos para comenzar</TableCell></TableRow>
                      ) : (
                        tempItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold text-xs">{item.name}</TableCell>
                            <TableCell className="text-center text-xs">{item.qty}</TableCell>
                            <TableCell className="text-right font-mono text-xs">${item.costUsd.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-black text-xs">${(item.qty * item.costUsd).toFixed(2)}</TableCell>
                            <TableCell><button onClick={() => handleRemoveTempItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-[#F5F5F5] p-3 border-t flex justify-between items-center">
                  <div className="flex gap-3">
                    <div className="bg-white border border-gray-300 rounded px-2 py-1">
                      <span className="text-[8px] block text-gray-500 uppercase">Total en Bolívares</span>
                      <span className="text-xs font-black text-secondary">Bs {totalInvoiceBs.toFixed(2)}</span>
                    </div>
                    {paymentType !== 'contado' && remainingUsd > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                        <span className="text-[8px] block text-yellow-700 uppercase">Crédito pendiente</span>
                        <span className="text-xs font-black text-yellow-800">${remainingUsd.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    disabled={isProcessing || tempItems.length === 0}
                    onClick={handleProcessPurchase}
                    className="bg-primary hover:brightness-110 text-black font-black px-6 h-8 text-xs"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} className="mr-1" /> PROCESAR COMPRA</>}
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