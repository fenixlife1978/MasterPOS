"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Search, X, CheckCircle, AlertCircle, Receipt, Hash, User, Calendar, Banknote, Minus, Plus, RefreshCw, DollarSign, Smartphone, CreditCard } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Transaction, CartItem } from '@/lib/types';
import { registerReturnEntry } from '@/services/accountingService';
import { syncService } from '@/services/syncService';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface ReturnItem {
  productId: number;
  name: string;
  priceBs: number;
  originalQty: number;
  returnQty: number;
  amount: number;
}

type ReturnMethod = 'efectivo' | 'pago_movil' | 'nota_credito';

const returnMethods = [
  { id: 'efectivo' as ReturnMethod, label: 'EFECTIVO', icon: Banknote, description: 'Resta dinero de la caja física' },
  { id: 'pago_movil' as ReturnMethod, label: 'PAGO MÓVIL', icon: Smartphone, description: 'Egreso bancario (no afecta efectivo)' },
  { id: 'nota_credito' as ReturnMethod, label: 'NOTA DE CRÉDITO', icon: CreditCard, description: 'Saldo a favor para futuras compras' },
];

export default function ReturnsModule() {
  const { transactions, products, register, exchangeRate, registerCashEgress } = usePOSState();
  const [search, setSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<ReturnMethod>('efectivo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const salesTransactions = transactions.filter(t => t.type === 'contado').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredSales = salesTransactions.filter(t =>
    t.id.toString().includes(search) ||
    t.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const isTransactionReturned = (saleId: number) => {
    return transactions.some(t => t.type === 'devolucion' && (t as any).originalSaleId === saleId);
  };

  const openReturnModal = (transaction: Transaction, type: 'total' | 'partial') => {
    if (isTransactionReturned(transaction.id)) {
      alert('Esta venta ya tiene una devolución procesada.');
      return;
    }
    setSelectedTransaction(transaction);
    setSelectedMethod('efectivo');
    const items: ReturnItem[] = transaction.items.map(item => ({
      productId: item.productId,
      name: item.name,
      priceBs: item.priceBs,
      originalQty: item.qty,
      returnQty: type === 'total' ? item.qty : 0,
      amount: type === 'total' ? item.priceBs * item.qty : 0
    }));
    setReturnItems(items);
    if (type === 'total') setShowConfirmModal(true);
    else setShowReturnModal(true);
  };

  const updateReturnQty = (index: number, newQty: number) => {
    const updated = [...returnItems];
    const item = updated[index];
    const validQty = Math.min(Math.max(0, newQty), item.originalQty);
    updated[index] = { ...item, returnQty: validQty, amount: item.priceBs * validQty };
    setReturnItems(updated);
  };

  const totalReturnAmount = returnItems.reduce((s, i) => s + i.amount, 0);
  const hasItemsToReturn = returnItems.some(i => i.returnQty > 0);

  const processReturn = async () => {
    if (!selectedTransaction || !register?.isOpen) {
      setMessage({ type: 'error', text: 'La caja debe estar abierta' });
      return;
    }

    if (totalReturnAmount <= 0) {
      setMessage({ type: 'error', text: 'Seleccione al menos un producto para devolver' });
      return;
    }

    setIsProcessing(true);

    try {
      const returnItemsList: CartItem[] = returnItems.filter(i => i.returnQty > 0).map(i => ({
        productId: i.productId, name: i.name, priceBs: i.priceBs, priceUsd: i.priceBs / exchangeRate, qty: i.returnQty, category: 'Otro' as any
      }));

      const returnTransaction = {
        id: Date.now(),
        date: new Date().toISOString(),
        type: 'devolucion',
        items: returnItemsList,
        subtotal: totalReturnAmount,
        iva: 0,
        total: totalReturnAmount,
        totalUsd: totalReturnAmount / exchangeRate,
        payMethod: selectedTransaction.payMethod,
        paidBs: totalReturnAmount,
        change: 0,
        clientId: selectedTransaction.clientId,
        clientName: selectedTransaction.clientName,
        originalSaleId: selectedTransaction.id,
        returnMethod: selectedMethod,
      };

      // ✅ 1. Guardar la devolución en la colección dedicada (ID como string)
      const returnDocument = {
        id: `devolucion_${returnTransaction.id}`,
        id_devolucion: returnTransaction.id,
        id_venta_original: selectedTransaction.id,
        id_sesion_caja: register?.openTime,
        productos: returnItemsList.map(i => ({
          id_producto: i.productId,
          cantidad: i.qty,
          precio_unitario: i.priceBs,
          subtotal: i.priceBs * i.qty
        })),
        monto_total_devuelto: totalReturnAmount,
        metodo_retorno: selectedMethod,
        fecha: returnTransaction.date,
        creado_en: Date.now()
      };

      await syncService.saveKardexEntry(returnDocument as any);

      // ✅ 2. Actualizar stock de productos
      const updates = [];
      const kardexEntries: any[] = [];

      for (const ret of returnItems.filter(i => i.returnQty > 0)) {
        const product = products.find(p => p.id === ret.productId);
        if (!product) continue;

        const previousStock = product.stock;
        const newStock = previousStock + ret.returnQty;

        updates.push({ ...product, stock: newStock });

        kardexEntries.push({
          id: `${Date.now()}_${ret.productId}_${Math.random()}`,
          productId: ret.productId,
          date: new Date().toLocaleString('es-VE'),
          type: 'devolucion',
          quantity: ret.returnQty,
          previousStock: previousStock,
          newStock: newStock,
          reference: `Devolución - Venta #${selectedTransaction.id}`,
          note: `Devolución de ${ret.returnQty} unidades de ${ret.name}. Método: ${selectedMethod}`,
          costUsd: product.costUsd,
        });
      }

      await syncService.saveTransaction(returnTransaction);
      
      if (updates.length > 0) {
        await syncService.saveProducts(updates as any[]);
      }

      for (const entry of kardexEntries) {
        await syncService.saveKardexEntry(entry);
      }

      // ✅ 3. Registrar egreso de caja según el método (ahora ambos métodos usan registerCashEgress)
      if (selectedMethod === 'efectivo') {
        // Restar dinero de la caja física con método 'efectivo_bs'
        await registerCashEgress(totalReturnAmount, `Devolución - Venta #${selectedTransaction.id}`, selectedTransaction.id, 'efectivo_bs');
      } else if (selectedMethod === 'pago_movil') {
        // Registrar egreso bancario con método 'pago_movil' (aparecerá en DEVOLUCIONES del cierre)
        await registerCashEgress(totalReturnAmount, `Devolución - Venta #${selectedTransaction.id}`, selectedTransaction.id, 'pago_movil');
      } else if (selectedMethod === 'nota_credito') {
        // Nota de crédito: solo asiento contable, no afecta caja
        await registerReturnEntry(returnTransaction as any, selectedTransaction.id);
      }

      setMessage({ type: 'success', text: `Devolución procesada. Método: ${selectedMethod === 'efectivo' ? 'Efectivo' : selectedMethod === 'pago_movil' ? 'Pago Móvil' : 'Nota de Crédito'}` });
      
      setTimeout(() => {
        setMessage(null);
        setShowReturnModal(false);
        setShowConfirmModal(false);
        setSelectedTransaction(null);
      }, 2000);
      
    } catch (error) {
      console.error('Error en devolución:', error);
      setMessage({ type: 'error', text: 'Error al procesar la devolución' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div><h2 className="text-2xl font-headline font-black text-black">Devoluciones</h2><p className="text-sm text-black/50">Seleccione el método de retorno de dinero</p></div>
        <div className="relative w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" /><Input placeholder="Buscar venta..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      {message && <div className={cn("mb-4 p-3 rounded-lg flex items-center gap-2", message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />} {message.text}</div>}

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]"><TableRow><TableHead className="text-[10px] font-black"># VENTA</TableHead><TableHead className="text-[10px] font-black">CLIENTE</TableHead><TableHead className="text-[10px] font-black">FECHA</TableHead><TableHead className="text-[10px] font-black text-right">TOTAL</TableHead><TableHead className="text-[10px] font-black text-center">ACCIONES</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredSales.map((t) => {
              const returned = isTransactionReturned(t.id);
              return (
                <TableRow key={t.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                  <TableCell className="font-bold text-sm">#{t.id}</TableCell>
                  <TableCell className="text-sm">{t.clientName || 'Cliente Final'}</TableCell>
                  <TableCell className="text-xs text-black/60">{new Date(t.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-bold">{formatBs(t.total)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <button disabled={returned} onClick={() => openReturnModal(t, 'total')} className={cn("px-3 py-1 text-white text-[10px] font-bold rounded-lg", returned ? "bg-gray-400" : "bg-red-600 hover:bg-red-700")}>{returned ? 'PROCESADA' : 'DEV. TOTAL'}</button>
                      <button disabled={returned} onClick={() => openReturnModal(t, 'partial')} className={cn("px-3 py-1 text-white text-[10px] font-bold rounded-lg", returned ? "bg-gray-400" : "bg-yellow-600 hover:bg-yellow-700")}>{returned ? 'DEVUELTO' : 'DEV. PARCIAL'}</button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Devolución Parcial con selección de método */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <RefreshCw size={20} className="text-primary" /> Devolución Parcial
              </DialogTitle>
              <button onClick={() => setShowReturnModal(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {selectedTransaction && (
              <div className="bg-[#F5F5F5] rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Hash size={14} className="text-primary" /><span className="font-bold">Venta #{selectedTransaction.id}</span></div>
                <div className="flex items-center gap-2"><User size={14} className="text-primary" /><span>{selectedTransaction.clientName || 'Cliente Final'}</span></div>
                <div className="flex items-center gap-2"><Calendar size={14} className="text-primary" /><span className="text-xs">{new Date(selectedTransaction.date).toLocaleString()}</span></div>
                <div className="flex items-center gap-2"><Banknote size={14} className="text-primary" /><span className="font-bold">Total venta: {formatBs(selectedTransaction.total)}</span></div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-black text-black/50 uppercase mb-3">Método de retorno del dinero</p>
              <div className="grid grid-cols-3 gap-2">
                {returnMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all",
                      selectedMethod === method.id
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-primary/50 bg-white"
                    )}
                  >
                    <method.icon size={20} className={cn("mx-auto mb-1", selectedMethod === method.id ? "text-primary" : "text-gray-500")} />
                    <p className="text-[10px] font-bold">{method.label}</p>
                    <p className="text-[7px] text-gray-500 mt-0.5">{method.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-black/50 uppercase mb-3">Productos a devolver - Ajuste las cantidades</p>
              <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8E8E8]">
                    <tr>
                      <th className="text-left p-2.5 text-[9px] font-black uppercase">Producto</th>
                      <th className="text-center p-2.5 text-[9px] font-black uppercase w-20">Precio Unit.</th>
                      <th className="text-center p-2.5 text-[9px] font-black uppercase w-16">Vendido</th>
                      <th className="text-center p-2.5 text-[9px] font-black uppercase w-28">A Devolver</th>
                      <th className="text-right p-2.5 text-[9px] font-black uppercase w-24">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((item, idx) => (
                      <tr key={item.productId} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                        <td className="p-2.5"><p className="font-bold text-xs">{item.name}</p></td>
                        <td className="p-2.5 text-center text-xs font-mono">{formatBs(item.priceBs)}</td>
                        <td className="p-2.5 text-center text-xs text-black/60">{item.originalQty} und</td>
                        <td className="p-2.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => updateReturnQty(idx, item.returnQty - 1)} disabled={item.returnQty <= 0} className="w-6 h-6 bg-white rounded-md border border-[#9E9E9E] font-bold text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"><Minus size={10} /></button>
                            <span className={cn("w-8 text-center font-bold text-sm", item.returnQty > 0 ? "text-red-600" : "text-black/40")}>{item.returnQty}</span>
                            <button onClick={() => updateReturnQty(idx, item.returnQty + 1)} disabled={item.returnQty >= item.originalQty} className="w-6 h-6 bg-white rounded-md border border-[#9E9E9E] font-bold text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"><Plus size={10} /></button>
                          </div>
                          {item.returnQty > 0 && <p className="text-[9px] text-red-500 text-center mt-0.5">{item.returnQty} de {item.originalQty}</p>}
                        </td>
                        <td className={cn("p-2.5 text-right font-bold text-xs", item.amount > 0 ? "text-red-600" : "text-black/30")}>{formatBs(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={cn("rounded-xl p-4 flex justify-between items-center transition-all", totalReturnAmount > 0 ? "bg-red-50 border-2 border-red-200" : "bg-[#F5F5F5] border border-[#9E9E9E]")}>
              <div><span className="text-xs font-black uppercase">MONTO A DEVOLVER</span><p className="text-[10px] text-black/50">{formatUsd(totalReturnAmount / exchangeRate)}</p></div>
              <span className={cn("text-2xl font-black", totalReturnAmount > 0 ? "text-red-600" : "text-black/30")}>{formatBs(totalReturnAmount)}</span>
            </div>

            <Button onClick={processReturn} disabled={!hasItemsToReturn || isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-11 disabled:opacity-50">
              {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <Receipt size={16} className="mr-2" />} 
              {isProcessing ? 'PROCESANDO...' : 'PROCESAR DEVOLUCIÓN'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmación Devolución Total con selección de método */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-xl p-0 rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="bg-red-600 p-5 text-white sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg font-black flex items-center gap-2"><Receipt size={20} /> Confirmar Devolución Total</DialogTitle>
              <button onClick={() => setShowConfirmModal(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4">
            {selectedTransaction && (
              <div className="bg-[#F5F5F5] rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Hash size={14} className="text-primary" /><span className="font-bold">Venta #{selectedTransaction.id}</span></div>
                <div className="flex items-center gap-2"><User size={14} className="text-primary" /><span>{selectedTransaction.clientName || 'Cliente Final'}</span></div>
                <div className="flex items-center gap-2"><Calendar size={14} className="text-primary" /><span className="text-xs">{new Date(selectedTransaction.date).toLocaleString()}</span></div>
                <div className="flex items-center gap-2"><Banknote size={14} className="text-primary" /><span className="font-bold">Total: {formatBs(selectedTransaction.total)}</span></div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-black text-black/50 uppercase mb-3">Método de retorno del dinero</p>
              <div className="grid grid-cols-3 gap-2">
                {returnMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all",
                      selectedMethod === method.id
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-primary/50 bg-white"
                    )}
                  >
                    <method.icon size={20} className={cn("mx-auto mb-1", selectedMethod === method.id ? "text-primary" : "text-gray-500")} />
                    <p className="text-[10px] font-bold">{method.label}</p>
                    <p className="text-[7px] text-gray-500 mt-0.5">{method.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex justify-between items-center">
              <div><span className="text-xs font-black text-red-700 uppercase">TOTAL A DEVOLVER</span><p className="text-[10px] text-red-500">{formatUsd(totalReturnAmount / exchangeRate)}</p></div>
              <span className="text-2xl font-black text-red-700">{formatBs(totalReturnAmount)}</span>
            </div>

            <p className="text-xs text-black/50 text-center">Esta acción repondrá el inventario y registrará el egreso según el método seleccionado.</p>
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="flex-1">CANCELAR</Button>
              <Button onClick={processReturn} disabled={isProcessing} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black">
                {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} className="mr-2" />} 
                {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR DEVOLUCIÓN'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}