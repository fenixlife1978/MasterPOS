"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Search, X, CheckCircle, AlertCircle, Receipt, 
  ArrowLeftRight, Package, History, Eye, Loader2,
  ShieldCheck, Banknote, DollarSign, Smartphone,
  RefreshCw, CreditCard, Minus, Plus
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Transaction, CartItem, getCategoryById } from '@/lib/types';
import syncService from '@/services/syncService';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { useAuth } from '@/context/AuthContext';
import { getDatabase, ref, update } from 'firebase/database';
import app from '@/lib/firebase';

interface ReturnItem {
  productId: number;
  name: string;
  priceBs: number;
  originalQty: number;
  returnQty: number;
  amount: number;
}

type ReturnMethod = 'efectivo' | 'efectivo_usd' | 'pago_movil' | 'nota_credito' | 'zelle';

const RETURN_REASONS = [
  { id: 'defectuoso', label: 'Producto Defectuoso' },
  { id: 'arrepentido', label: 'Cliente Arrepentido' },
  { id: 'error_cobro', label: 'Error en Cobro' },
  { id: 'vencido', label: 'Producto Vencido' },
  { id: 'otro', label: 'Otro Motivo' },
];

function getVenezuelaISOString(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}.${partMap.fractionalSecond}-04:00`;
}

export default function ReturnsModule() {
  const { user } = useAuth();
  const currentTerminalName = user?.terminalName || 'Principal';
  const isAdmin = user?.role === 'admin';
  const { products, register, exchangeRate } = usePOSState();

  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchReceipt, setSearchReceipt] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<ReturnMethod>('efectivo');
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[1].id);
  const [authPin, setAuthPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = syncService.subscribeToTransactions((data: any[]) => {
      let filtered = data.filter(tx => {
        const txDate = tx.date.split('T')[0];
        const matchesDate = txDate >= startDate && txDate <= endDate;
        if (searchReceipt.trim()) {
          const txNum = tx.receiptNumber || tx.receipt_number;
          return String(txNum) === searchReceipt.trim();
        }
        return matchesDate;
      });
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllTransactions(filtered);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [startDate, endDate, searchReceipt]);

  const salesTransactions = useMemo(() => allTransactions.filter(tx => tx.type !== 'devolucion'), [allTransactions]);
  const processedReturns = useMemo(() => allTransactions.filter(tx => tx.type === 'devolucion'), [allTransactions]);

  const openReturnModal = (tx: any) => {
    if (tx.return_status === 'total') { alert('Esta venta ya fue devuelta.'); return; }
    setSelectedTransaction(tx);
    let items = Array.isArray(tx.items) ? tx.items : (typeof tx.items === 'string' ? JSON.parse(tx.items) : []);
    setReturnItems(items.map((it: any) => ({
      productId: it.productId, name: it.name, priceBs: it.priceBs || it.price_bs || 0,
      originalQty: it.qty, returnQty: 0, amount: 0
    })));
    setShowReturnModal(true);
  };

  return (
    <div className="p-6 h-full overflow-auto bg-background flex flex-col">
      <div className="bg-red-100 border-4 border-red-600 p-6 rounded-3xl shadow-xl mb-8 flex-shrink-0 flex items-center gap-6">
        <div className="bg-red-600 p-4 rounded-2xl border-4 border-black text-white shadow-lg"><ArrowLeftRight size={40} /></div>
        <div>
          <h2 className="text-3xl font-black text-black uppercase tracking-tight">Módulo de Devoluciones</h2>
          <p className="text-base font-black text-red-700 uppercase tracking-[0.2em] mt-1">Terminal: {currentTerminalName}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b-4 border-black flex-shrink-0">
        <button onClick={() => setActiveTab('process')} className={cn("px-10 py-4 font-black text-base uppercase transition-all rounded-t-2xl border-4 border-b-0", activeTab === 'process' ? "bg-white border-black text-red-700" : "bg-slate-200 border-black/20 text-black/40 hover:bg-white")}>Procesar Devolución</button>
        <button onClick={() => setActiveTab('history')} className={cn("px-10 py-4 font-black text-base uppercase transition-all rounded-t-2xl border-4 border-b-0", activeTab === 'history' ? "bg-white border-black text-red-700" : "bg-slate-200 border-black/20 text-black/40 hover:bg-white")}>Historial Devoluciones</button>
      </div>

      <div className="bg-white border-4 border-black rounded-3xl p-6 mb-8 shadow-2xl flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="text-[12px] font-black text-black uppercase tracking-widest block mb-2">Buscar por Número de Recibo</label>
            <div className="relative">
              <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black" />
              <Input 
                value={searchReceipt} 
                onChange={e => setSearchReceipt(e.target.value)} 
                placeholder="Ej: 00000008" 
                className="pl-12 h-14 text-lg font-mono font-black border-4 border-black rounded-2xl focus:ring-4 focus:ring-red-500/20"
                autoComplete="off"
              />
            </div>
          </div>
          <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-2">Desde</label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-14 font-black border-4 border-black rounded-2xl" /></div>
          <div><label className="text-[12px] font-black text-black uppercase tracking-widest block mb-2">Hasta</label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-14 font-black border-4 border-black rounded-2xl" /></div>
        </div>
      </div>

      <div className="flex-1 bg-white border-4 border-black rounded-3xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-[#1A2C4E] border-b-4 border-black">
            <TableRow>
              <TableHead className="text-sm font-black uppercase text-white tracking-widest p-5">Recibo</TableHead>
              <TableHead className="text-sm font-black uppercase text-white tracking-widest p-5">Cliente</TableHead>
              <TableHead className="text-sm font-black uppercase text-white tracking-widest p-5">Fecha y Hora</TableHead>
              <TableHead className="text-sm font-black uppercase text-white tracking-widest text-right p-5">Total Bs</TableHead>
              <TableHead className="text-sm font-black uppercase text-white tracking-widest text-center p-5">Estado / Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(activeTab === 'process' ? salesTransactions : processedReturns).map((tx) => {
               const returned = tx.return_status === 'total';
               return (
                <TableRow key={tx.id} className="hover:bg-primary/5 transition-colors border-b-2 border-black/5">
                  <TableCell className="font-mono font-black text-black text-base p-5">#{tx.receiptNumber || tx.receipt_number}</TableCell>
                  <TableCell className="font-black text-black uppercase p-5">{tx.clientName || 'Consumidor Final'}</TableCell>
                  <TableCell className="text-sm font-black text-black p-5">{new Date(tx.date).toLocaleString('es-VE')}</TableCell>
                  <TableCell className="text-right font-black text-lg text-black p-5">{formatBs(tx.total)}</TableCell>
                  <TableCell className="text-center p-5">
                    {activeTab === 'process' ? (
                      returned ? <span className="bg-red-50 text-red-700 px-4 py-1.5 rounded-full border-2 border-red-600 font-black text-xs">DEVUELTO</span> :
                      <Button onClick={() => openReturnModal(tx)} className="bg-red-600 text-white font-black h-11 px-8 hover:bg-red-700 border-4 border-black shadow-lg">DEVOLVER</Button>
                    ) : <Button onClick={() => {}} className="bg-white text-black border-4 border-black font-black h-11 px-6 shadow-lg"><Eye size={20} /></Button>}
                  </TableCell>
                </TableRow>
               );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-3xl border-4 border-black shadow-2xl h-[90vh]">
          <div className="bg-[#1A2C4E] p-6 text-white border-b-4 border-black flex justify-between items-center">
            <h3 className="text-2xl font-black uppercase tracking-widest">Procesar Devolución</h3>
            <button onClick={() => setShowReturnModal(false)}><X size={32} className="font-black" /></button>
          </div>
          <div className="p-8 overflow-y-auto space-y-8 flex-1 bg-slate-50">
            <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-lg">
              <h4 className="text-sm font-black uppercase text-black mb-4 border-b-2 border-black/5 pb-2">Selección de productos a devolver</h4>
              <Table>
                <TableHeader className="bg-slate-100"><TableRow><TableHead className="p-4 font-black text-black">PRODUCTO</TableHead><TableHead className="text-center font-black text-black">P. UNIT (BS)</TableHead><TableHead className="text-center font-black text-black">VENDIDAS</TableHead><TableHead className="text-center font-black text-black">A DEVOLVER</TableHead><TableHead className="text-right font-black text-black">SUBTOTAL</TableHead></TableRow></TableHeader>
                <TableBody>
                  {returnItems.map((item, idx) => (
                    <tr key={idx} className="border-b-2 border-black/5">
                      <td className="p-4 font-black text-black uppercase">{item.name}</td>
                      <td className="text-center font-black text-black font-mono">{formatBs(item.priceBs)}</td>
                      <td className="text-center font-black text-black"><span className="bg-slate-200 px-3 py-1 rounded-lg border-2 border-black/10">{item.originalQty}</span></td>
                      <td className="text-center">
                         <div className="flex justify-center items-center gap-4">
                           <button onClick={() => updateReturnQty(idx, item.returnQty - 1)} className="w-10 h-10 border-2 border-black rounded-full hover:bg-red-100 transition-all"><Minus size={18} /></button>
                           <span className="w-8 text-center text-xl font-black">{item.returnQty}</span>
                           <button onClick={() => updateReturnQty(idx, item.returnQty + 1)} className="w-10 h-10 border-2 border-black rounded-full hover:bg-green-100 transition-all"><Plus size={18} /></button>
                         </div>
                      </td>
                      <td className="text-right p-4 font-black text-lg">{formatBs(item.amount)}</td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="bg-white border-4 border-black rounded-2xl p-5 shadow-lg">
                  <label className="text-[11px] font-black uppercase text-black tracking-widest block mb-2">Motivo de la Devolución</label>
                  <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)} className="w-full h-12 bg-white border-2 border-black rounded-xl px-4 text-base font-black">
                    {RETURN_REASONS.map(r => <option key={r.id} value={r.id}>{r.label.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="bg-amber-100 border-4 border-black rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center gap-3 mb-2 text-amber-900"><ShieldCheck size={24} /><label className="text-[11px] font-black uppercase tracking-widest">PIN de Autorización Supervisor</label></div>
                  <Input type="password" maxLength={6} value={authPin} onChange={e => setAuthPin(e.target.value.replace(/\D/g, ''))} className="h-14 text-center text-3xl font-mono font-black border-4 border-black bg-white tracking-widest" placeholder="••••••" />
                </div>
              </div>
              <div className="bg-red-700 text-white border-4 border-black rounded-2xl p-8 shadow-2xl flex flex-col justify-center text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.3em] opacity-80">Monto Total a Reembolsar</p>
                <p className="text-5xl font-black mt-2 leading-none">{formatBs(totalReturnAmount)}</p>
                <div className="mt-4 pt-4 border-t-2 border-white/20">
                   <p className="text-sm font-black uppercase tracking-widest">Método: {selectedMethod.replace('_',' ').toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white border-t-4 border-black p-6 flex justify-end gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
             <Button onClick={() => setShowReturnModal(false)} variant="ghost" className="px-10 h-14 font-black text-black uppercase border-4 border-black text-base">Cancelar</Button>
             <Button onClick={processReturn} disabled={isProcessing || totalReturnAmount <= 0} className="bg-red-600 text-white font-black px-16 h-14 border-4 border-black shadow-2xl hover:scale-105 transition-all text-base uppercase tracking-widest">FINALIZAR DEVOLUCIÓN</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
