"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Search, Package, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Transaction, CartItem } from '@/lib/types';
import { registerReturnEntry } from '@/services/accountingService';
import { syncService } from '@/services/syncService';

interface ReturnItem {
  productId: number;
  name: string;
  priceBs: number;
  originalQty: number;
  returnQty: number;
  amount: number;
}

export default function ReturnsModule() {
  const { transactions, products, register, exchangeRate } = usePOSState();
  const [search, setSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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

  const processReturn = async () => {
    if (!selectedTransaction || !register?.isOpen) {
      setMessage({ type: 'error', text: 'La caja debe estar abierta' });
      return;
    }

    const totalReturn = returnItems.reduce((s, i) => s + i.amount, 0);
    if (totalReturn <= 0) return;

    const returnItemsList: CartItem[] = returnItems.filter(i => i.returnQty > 0).map(i => ({
      productId: i.productId, name: i.name, priceBs: i.priceBs, priceUsd: i.priceBs / exchangeRate, qty: i.returnQty, category: 'Otro' as any
    }));

    const returnTransaction = {
      id: Date.now(),
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
      clientName: selectedTransaction.clientName,
      originalSaleId: selectedTransaction.id
    };

    // Actualizar stock atómicamente
    const updates = products.map(p => {
      const ret = returnItems.find(i => i.productId === p.id);
      return ret && ret.returnQty > 0 ? { ...p, stock: p.stock + ret.returnQty } : null;
    }).filter(Boolean);

    await syncService.saveTransaction(returnTransaction);
    if (updates.length > 0) await syncService.saveProducts(updates as any[]);
    await registerReturnEntry(returnTransaction as any, selectedTransaction.id);

    setMessage({ type: 'success', text: 'Devolución sincronizada en tiempo real' });
    setTimeout(() => {
      setMessage(null);
      setShowReturnModal(false);
      setShowConfirmModal(false);
      setSelectedTransaction(null);
    }, 2000);
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div><h2 className="text-2xl font-headline font-black text-black">Devoluciones</h2><p className="text-sm text-black/50">Sincronización centralizada en tiempo real</p></div>
        <div className="relative w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" /><Input placeholder="Buscar venta..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      {message && <div className={cn("mb-4 p-3 rounded-lg flex items-center gap-2", message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />} {message.text}</div>}

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]"><TableRow><TableHead className="text-[10px] font-black"># VENTA</TableHead><TableHead className="text-[10px] font-black">CLIENTE</TableHead><TableHead className="text-[10px] font-black text-right">TOTAL</TableHead><TableHead className="text-[10px] font-black text-center">ACCIONES</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredSales.map((t) => {
              const returned = isTransactionReturned(t.id);
              return (
                <TableRow key={t.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                  <TableCell className="font-bold">#{t.id}</TableCell>
                  <TableCell className="text-sm">{t.clientName || 'Cliente Final'}</TableCell>
                  <TableCell className="text-right font-bold">Bs {t.total.toFixed(2)}</TableCell>
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

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-lg p-0 rounded-2xl shadow-xl">
          <div className="bg-[#1A2C4E] p-4 text-white"><h3 className="text-lg font-black">Devolución Sincronizada</h3></div>
          <div className="p-5 space-y-4">
            {returnItems.map((item, idx) => (
              <div key={item.productId} className="flex items-center justify-between p-3 bg-[#F5F5F5] rounded-lg">
                <p className="font-bold text-sm">{item.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateReturnQty(idx, item.returnQty - 1)} className="w-7 h-7 bg-white rounded-md border font-bold">-</button>
                  <span className="w-8 text-center font-bold">{item.returnQty}</span>
                  <button onClick={() => updateReturnQty(idx, item.returnQty + 1)} className="w-7 h-7 bg-white rounded-md border font-bold">+</button>
                </div>
              </div>
            ))}
            <Button onClick={processReturn} className="w-full bg-primary text-black font-black">PROCESAR Y SINCRONIZAR</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-2xl shadow-xl">
          <div className="bg-red-600 p-4 text-white font-black">Confirmar Devolución de Stock</div>
          <div className="p-5">
            <p className="text-sm mb-4">Esta acción repondrá el inventario y registrará el egreso contable en tiempo real para todos los usuarios.</p>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="flex-1">CANCELAR</Button><Button onClick={processReturn} className="flex-1 bg-red-600 text-white font-black">CONFIRMAR</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
