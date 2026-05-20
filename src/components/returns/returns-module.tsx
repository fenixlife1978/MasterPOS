"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Search, ArrowLeftRight, RefreshCw, X, DollarSign, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Transaction, CartItem } from '@/lib/types';

interface ReturnItem {
  productId: number;
  name: string;
  priceBs: number;
  originalQty: number;
  returnQty: number;
  amount: number;
}

export default function ReturnsModule() {
  const { transactions, products, setTransactions, setProducts, register, setRegister, exchangeRate } = usePOSState();
  const [search, setSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [returnType, setReturnType] = useState<'total' | 'partial'>('total');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtrar transacciones de tipo 'contado' (solo ventas en efectivo/contado)
  const salesTransactions = transactions.filter(t => t.type === 'contado').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredSales = salesTransactions.filter(t =>
    t.id.toString().includes(search) ||
    t.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    new Date(t.date).toLocaleDateString().includes(search)
  );

  const openReturnModal = (transaction: Transaction, type: 'total' | 'partial') => {
    setSelectedTransaction(transaction);
    setReturnType(type);
    
    if (type === 'total') {
      // Devolución total: marcar todos los items
      const items: ReturnItem[] = transaction.items.map(item => ({
        productId: item.productId,
        name: item.name,
        priceBs: item.priceBs,
        originalQty: item.qty,
        returnQty: item.qty,
        amount: item.priceBs * item.qty
      }));
      setReturnItems(items);
      setShowConfirmModal(true);
    } else {
      // Devolución parcial: mostrar modal para seleccionar cantidades
      const items: ReturnItem[] = transaction.items.map(item => ({
        productId: item.productId,
        name: item.name,
        priceBs: item.priceBs,
        originalQty: item.qty,
        returnQty: 0,
        amount: 0
      }));
      setReturnItems(items);
      setShowReturnModal(true);
    }
  };

  const updateReturnQty = (index: number, newQty: number) => {
    const updated = [...returnItems];
    const item = updated[index];
    const validQty = Math.min(Math.max(0, newQty), item.originalQty);
    updated[index] = {
      ...item,
      returnQty: validQty,
      amount: item.priceBs * validQty
    };
    setReturnItems(updated);
  };

  const calculateTotalReturn = () => {
    return returnItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const processReturn = () => {
    if (!selectedTransaction || !register?.isOpen) {
      setMessage({ type: 'error', text: 'La caja debe estar abierta para procesar devoluciones' });
      return;
    }

    const totalReturn = calculateTotalReturn();
    if (totalReturn <= 0) {
      setMessage({ type: 'error', text: 'No hay productos seleccionados para devolver' });
      return;
    }

    // 1. Crear transacción de devolución
    const returnItemsList: CartItem[] = returnItems
      .filter(item => item.returnQty > 0)
      .map(item => ({
        productId: item.productId,
        name: item.name,
        priceBs: item.priceBs,
        priceUsd: item.priceBs / exchangeRate,
        qty: item.returnQty,
        category: 'Otro' as any
      }));

    const returnTransaction: Transaction = {
      id: transactions.length + 1,
      date: new Date().toISOString(),
      type: 'devolucion',
      items: returnItemsList,
      subtotal: totalReturn,
      iva: 0,
      total: totalReturn,
      totalUsd: totalReturn / exchangeRate,
      payMethod: selectedTransaction.payMethod,
      paidBs: totalReturn,
      change: 0,
      clientId: selectedTransaction.clientId,
      clientName: selectedTransaction.clientName
    };

    // 2. Actualizar stock (sumar lo devuelto)
    const updatedProducts = products.map(product => {
      const returnedItem = returnItems.find(item => item.productId === product.id);
      if (returnedItem && returnedItem.returnQty > 0) {
        return { ...product, stock: product.stock + returnedItem.returnQty };
      }
      return product;
    });

    // 3. Actualizar caja (restar el monto devuelto del efectivo)
    const updatedTxs = register.txs ? [...register.txs, returnTransaction] : [returnTransaction];
    const updatedRegister = { ...register, txs: updatedTxs };

    // 4. Actualizar estados
    setTransactions([...transactions, returnTransaction]);
    setProducts(updatedProducts);
    setRegister(updatedRegister);

    // 5. Guardar en localStorage
    localStorage.setItem('licopos_transactions', JSON.stringify([...transactions, returnTransaction]));
    localStorage.setItem('licopos_products', JSON.stringify(updatedProducts));
    localStorage.setItem('licopos_register', JSON.stringify(updatedRegister));

    setMessage({ type: 'success', text: `Devolución procesada correctamente. Monto: Bs ${totalReturn.toFixed(2)}` });
    
    setTimeout(() => {
      setMessage(null);
      setShowReturnModal(false);
      setShowConfirmModal(false);
      setSelectedTransaction(null);
      setReturnItems([]);
    }, 2000);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black">Devoluciones</h2>
          <p className="text-sm text-black/50 mt-1">Gestión de devoluciones de productos (Total o Parcial)</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" />
            <Input 
              placeholder="Buscar por #, cliente o fecha..." 
              className="pl-9 h-10 bg-white border-[#9E9E9E]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {message && (
        <div className={cn(
          "mb-4 flex items-center gap-2 p-3 rounded-lg text-sm",
          message.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        )}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase">#</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Fecha</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Cliente</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Productos</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase text-right">Total</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.map((t) => (
              <TableRow key={t.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                <TableCell className="font-bold text-black">#{t.id}</TableCell>
                <TableCell className="text-xs text-black/60">{formatDate(t.date)}</TableCell>
                <TableCell className="text-sm text-black">{t.clientName || 'Cliente Final'}</TableCell>
                <TableCell className="text-xs text-black/70">
                  {t.items.map(i => `${i.name} x${i.qty}`).join(', ')}
                </TableCell>
                <TableCell className="text-right font-bold text-black">Bs {t.total.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => openReturnModal(t, 'total')}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-lg transition-all"
                      title="Devolución total"
                    >
                      DEV. TOTAL
                    </button>
                    <button
                      onClick={() => openReturnModal(t, 'partial')}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] font-bold rounded-lg transition-all"
                      title="Devolución parcial"
                    >
                      DEV. PARCIAL
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredSales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-black/50 italic">
                  No hay ventas registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de devolución parcial */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-lg p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only"><DialogTitle>Devolución Parcial</DialogTitle></DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Package size={20} className="text-primary" /><h3 className="text-lg font-headline font-black">Devolución Parcial</h3></div>
                <button onClick={() => setShowReturnModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
              <p className="text-white/60 text-xs mt-1">Venta #{selectedTransaction?.id} - {selectedTransaction?.clientName || 'Cliente Final'}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                {returnItems.map((item, idx) => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-[#F5F5F5] rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-black">{item.name}</p>
                      <p className="text-[10px] text-black/50">Precio: Bs {item.priceBs.toFixed(2)} | Disponible: {item.originalQty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateReturnQty(idx, item.returnQty - 1)}
                        className="w-7 h-7 rounded-md bg-white border border-black/20 text-black font-bold hover:bg-primary hover:text-black"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-black">{item.returnQty}</span>
                      <button
                        onClick={() => updateReturnQty(idx, item.returnQty + 1)}
                        className="w-7 h-7 rounded-md bg-white border border-black/20 text-black font-bold hover:bg-primary hover:text-black"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-[#1A2C4E] rounded-lg p-3 text-white text-center">
                <p className="text-[10px] text-white/60">Total a devolver</p>
                <p className="text-2xl font-black">Bs {calculateTotalReturn().toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowReturnModal(false)} className="px-4 text-black">CANCELAR</Button>
              <Button onClick={processReturn} className="px-4 bg-primary text-black font-black">PROCESAR DEVOLUCIÓN</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de devolución total */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only"><DialogTitle>Confirmar Devolución Total</DialogTitle></DialogHeader>
          <div className="flex flex-col">
            <div className="bg-red-600 p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><AlertCircle size={20} className="text-white" /><h3 className="text-lg font-headline font-black">Confirmar Devolución Total</h3></div>
                <button onClick={() => setShowConfirmModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-black">¿Está seguro de procesar la devolución TOTAL de la venta #{selectedTransaction?.id}?</p>
              <div className="bg-[#F5F5F5] rounded-lg p-3">
                <div className="flex justify-between text-sm mb-1"><span>Total venta original:</span><span className="font-bold">Bs {selectedTransaction?.total.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Monto a devolver:</span><span className="font-bold text-red-600">Bs {calculateTotalReturn().toFixed(2)}</span></div>
              </div>
              <p className="text-[10px] text-black/50">Esta acción:</p>
              <ul className="text-[10px] text-black/50 list-disc pl-4 space-y-0.5">
                <li>Repondrá el stock de los productos devueltos</li>
                <li>Restará el monto de la caja (mismo método de pago)</li>
                <li>Creará un registro de devolución en el historial</li>
                <li>Generará el asiento contable correspondiente</li>
              </ul>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="px-4 text-black">CANCELAR</Button>
              <Button onClick={processReturn} className="px-4 bg-red-600 text-white font-black">CONFIRMAR DEVOLUCIÓN</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
