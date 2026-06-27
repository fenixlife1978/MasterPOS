"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Search, X, CheckCircle, AlertCircle, Receipt, User, 
  Calendar, Banknote, Minus, Plus, RefreshCw, Smartphone, 
  CreditCard, Monitor, Loader2, Terminal, ShieldCheck, 
  AlertTriangle, ArrowLeftRight, Info, Package, History,
  Eye, FileText, DollarSign
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

type ReturnMethod = 'efectivo' | 'efectivo_usd' | 'pago_movil' | 'nota_credito' | 'zelle' | 'tarjeta';

const RETURN_REASONS = [
  { id: 'defectuoso', label: 'Producto Defectuoso', type: 'merma' },
  { id: 'arrepentido', label: 'Cliente Arrepentido', type: 'reventa' },
  { id: 'error_cobro', label: 'Error en Cobro/Facturación', type: 'reventa' },
  { id: 'vencido', label: 'Producto Vencido', type: 'merma' },
  { id: 'otro', label: 'Otro Motivo', type: 'reventa' },
];

const returnMethodsList = [
  { id: 'efectivo' as ReturnMethod, label: 'EFECTIVO BS', icon: Banknote, description: 'Resta del efectivo en caja' },
  { id: 'efectivo_usd' as ReturnMethod, label: 'EFECTIVO USD', icon: DollarSign, description: 'Reembolso en divisas' },
  { id: 'pago_movil' as ReturnMethod, label: 'PAGO MÓVIL', icon: Smartphone, description: 'Reversión bancaria' },
  { id: 'zelle' as ReturnMethod, label: 'ZELLE', icon: RefreshCw, description: 'Reversión de divisas' },
  { id: 'nota_credito' as ReturnMethod, label: 'NOTA CRÉDITO', icon: CreditCard, description: 'Saldo para cliente' },
];

function getLocalDateStr(isoString: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

function getTodayYMD(): string {
  return getLocalDateStr(new Date().toISOString());
}

function extractTerminalIdFromSession(sessionId: string | null | undefined): string {
  if (!sessionId) return 'default';
  const parts = sessionId.split('_');
  if (parts.length > 0 && parts[0]) {
    return parts[0];
  }
  return 'default';
}

function formatReceipt(num?: number | string): string {
  if (!num) return '00000000';
  return num.toString().padStart(8, '0');
}

function formatReturnReceipt(num?: number | string): string {
  if (!num) return 'DEV-000000';
  return `DEV-${num.toString().padStart(6, '0')}`;
}

export default function ReturnsModule() {
  const { user } = useAuth();
  const currentTerminalName = user?.terminalName || user?.terminalId || 'Principal';
  const isAdmin = user?.role === 'admin';

  const { products, register, exchangeRate } = usePOSState();
  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [viewingReturnDetail, setViewingReturnDetail] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  
  const [selectedMethod, setSelectedMethod] = useState<ReturnMethod>('efectivo');
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[1].id);
  const [authPin, setAuthPin] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [startDate, setStartDate] = useState(getTodayYMD());
  const [endDate, setEndDate] = useState(getTodayYMD());
  const [searchReceipt, setSearchReceipt] = useState('');

  const [selectedTerminal, setSelectedTerminal] = useState<string>('all');
  const [availableTerminals, setAvailableTerminals] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);

  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Contador de devoluciones
  const getReturnStorageKey = () => `last_return_number_${currentTerminalName}`;
  const [nextReturnNumber, setNextReturnNumber] = useState(1);

  useEffect(() => {
    const last = localStorage.getItem(getReturnStorageKey());
    if (last) {
      setNextReturnNumber(parseInt(last) + 1);
    } else {
      setNextReturnNumber(1);
    }
  }, [currentTerminalName]);

  useEffect(() => {
    if (isAdmin) {
      const loadTerminals = async () => {
        setIsLoadingTerminals(true);
        try {
          const terms = await syncService.getAllTerminals();
          setAvailableTerminals(terms.map(t => ({ id: t.name || t.id, name: t.name || t.id })));
        } catch (error) {
          console.error('Error cargando terminales:', error);
        } finally {
          setIsLoadingTerminals(false);
        }
      };
      loadTerminals();
    }
  }, [isAdmin]);

  const getTargetTerminalName = useCallback(() => {
    if (isAdmin) {
      return selectedTerminal === 'all' ? null : selectedTerminal;
    }
    return currentTerminalName;
  }, [isAdmin, selectedTerminal, currentTerminalName]);

  useEffect(() => {
    setIsLoading(true);
    const targetTerminalName = getTargetTerminalName();
    
    const unsubscribe = syncService.subscribeToTransactions((data: any[]) => {
      const filtered = data.filter(tx => {
        const tid = tx.terminalId || tx.terminal_id || extractTerminalIdFromSession(tx.sessionId || tx.session_id);
        const matchesTerminal = !targetTerminalName || tid === targetTerminalName || tid === user?.terminalId;
        const txDate = getLocalDateStr(tx.date);
        const matchesDate = txDate >= startDate && txDate <= endDate;
        
        const receiptQuery = searchReceipt.trim();
        if (receiptQuery) {
          const num = parseInt(receiptQuery);
          const txReceipt = tx.receiptNumber || tx.receipt_number;
          if (txReceipt !== num) return false;
        }

        return matchesTerminal && matchesDate;
      });
      
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllTransactions(filtered);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [getTargetTerminalName, startDate, endDate, user?.terminalId, searchReceipt]);

  const salesTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      if (tx.type === 'devolucion') return false;
      if ((tx.notes || '').includes('DEUDA INICIAL')) return false;
      return true;
    });
  }, [allTransactions]);

  const processedReturns = useMemo(() => {
    return allTransactions.filter(tx => tx.type === 'devolucion');
  }, [allTransactions]);

  const handleSearchByReceipt = useCallback(() => {
    setMessage(null);
    if (searchReceipt.trim() && allTransactions.length === 0) {
      setMessage({ type: 'error', text: `No se encontró el registro #${formatReceipt(searchReceipt)} en los filtros actuales.` });
    }
  }, [allTransactions.length, searchReceipt]);

  const openReturnModal = (tx: any) => {
    if (tx.return_status === 'total') {
      alert('Esta venta ya fue devuelta en su totalidad.');
      return;
    }
    
    if (!isAdmin && !register?.isOpen) {
      alert('Debe abrir la caja antes de procesar una devolución.');
      return;
    }
    
    setSelectedTransaction(tx);
    
    const originalMethod = tx.pay_method || tx.payMethod || 'efectivo_bs';
    if (originalMethod === 'usd_efectivo' || originalMethod === 'efectivo_usd') setSelectedMethod('efectivo_usd');
    else if (originalMethod === 'zelle') setSelectedMethod('zelle');
    else if (originalMethod === 'pago_movil') setSelectedMethod('pago_movil');
    else setSelectedMethod('efectivo');

    let items: any[] = [];
    if (typeof tx.items === 'string') {
      try { items = JSON.parse(tx.items); } catch (e) { items = []; }
    } else if (Array.isArray(tx.items)) {
      items = tx.items;
    }
    
    const returnItemsList: ReturnItem[] = items.map((item: any) => ({
      productId: item.productId || 0,
      name: item.name || 'Producto',
      priceBs: item.priceBs || item.price_bs || 0,
      originalQty: item.qty || 1,
      returnQty: 0,
      amount: 0
    }));
    
    setReturnItems(returnItemsList);
    setAuthPin('');
    setSelectedReason(RETURN_REASONS[1].id);
    setShowReturnModal(true);
  };

  const updateReturnQty = (idx: number, newQty: number) => {
    setReturnItems(prev => {
      const upd = [...prev];
      const item = upd[idx];
      const q = Math.min(item.originalQty, Math.max(0, newQty));
      upd[idx] = { ...item, returnQty: q, amount: item.priceBs * q };
      return upd;
    });
  };

  const selectAllItems = () => {
    setReturnItems(prev => prev.map(item => ({
      ...item,
      returnQty: item.originalQty,
      amount: item.priceBs * item.originalQty
    })));
  };

  const totalReturnAmount = useMemo(() => returnItems.reduce((s, i) => s + i.amount, 0), [returnItems]);
  const hasItemsToReturn = useMemo(() => returnItems.some(i => i.returnQty > 0), [returnItems]);

  const processReturn = async () => {
    if (!hasItemsToReturn) {
      alert('Debe seleccionar al menos un producto para devolver');
      return;
    }

    if (!selectedReason) {
      alert('Debe seleccionar un motivo de devolución');
      return;
    }

    if (!authPin) {
      alert('Se requiere el PIN de autorización del supervisor');
      return;
    }

    setIsProcessing(true);
    
    try {
      const adminCodeData = await syncService.getAdminCode();
      if (!adminCodeData || String(adminCodeData.code) !== String(authPin)) {
        alert('PIN de autorización incorrecto');
        setIsProcessing(false);
        return;
      }

      const saleId = selectedTransaction.id;
      const isTotal = returnItems.every(i => i.returnQty === i.originalQty);
      const returnStatus = isTotal ? 'total' : 'partial';
      const reasonLabel = RETURN_REASONS.find(r => r.id === selectedReason)?.label || 'Sin motivo';
      const returnReceiptNumber = nextReturnNumber;

      const rate = selectedTransaction.exchangeRate || exchangeRate;
      const totalUsdReturn = totalReturnAmount / rate;

      const returnItemsList: CartItem[] = returnItems.filter(i => i.returnQty > 0).map(i => ({
        productId: i.productId,
        name: i.name,
        priceBs: i.priceBs,
        priceUsd: i.priceBs / rate,
        qty: i.returnQty,
        category: getCategoryById('otros'),
        ivaType: 'sin_iva',
        ivaPercentage: 0,
        isKit: false
      }));

      const finalReturnMethod = selectedMethod === 'efectivo' ? 'efectivo_bs' : selectedMethod;

      const returnTransaction = {
        id: Date.now(),
        date: new Date().toISOString(),
        type: 'devolucion',
        items: returnItemsList,
        subtotal: totalReturnAmount,
        iva: 0,
        total: totalReturnAmount,
        totalUsd: totalUsdReturn,
        payMethod: finalReturnMethod,
        paidBs: totalReturnAmount,
        change: 0,
        clientId: selectedTransaction.clientId || null,
        clientName: selectedTransaction.clientName || 'CLIENTE FINAL',
        originalSaleId: saleId,
        originalReceiptNumber: selectedTransaction.receiptNumber || selectedTransaction.receipt_number,
        receiptNumber: returnReceiptNumber,
        returnMethod: finalReturnMethod,
        notes: `Motivo: ${reasonLabel}. Autorizado por supervisor.`,
        authorizedBy: 'Supervisor (PIN)',
        terminalId: currentTerminalName,
        sessionId: selectedTransaction.sessionId || selectedTransaction.session_id,
        exchangeRate: rate
      };

      // Preparar actualizaciones para la operación atómica
      const stockUpdates = new Map();
      const kardexEntries: any[] = [];
      for (const ret of returnItems.filter(i => i.returnQty > 0)) {
        const prod = products.find(p => p.id === ret.productId);
        if (prod) {
          const newStock = prod.stock + ret.returnQty;
          stockUpdates.set(prod.id, { newStock });
          kardexEntries.push({
            id: `${Date.now()}_${ret.productId}`,
            productId: ret.productId,
            date: returnTransaction.date,
            type: 'devolucion',
            quantity: ret.returnQty,
            previousStock: prod.stock,
            newStock: newStock,
            reference: `Dev. Recibo #${formatReceipt(selectedTransaction.receiptNumber || selectedTransaction.receipt_number)}`,
            note: `Motivo: ${reasonLabel}`,
            costUsd: prod.costUsd,
          });
        }
      }

      const accountingEntry = {
        id: Date.now() + 1,
        date: returnTransaction.date,
        type: 'egreso',
        category: 'devolucion',
        subcategory: selectedMethod === 'nota_credito' ? 'nota_credito' : 'reembolso',
        concept: `Devolución Recibo #${formatReceipt(selectedTransaction.receiptNumber || selectedTransaction.receipt_number)}`,
        description: `Cliente: ${selectedTransaction.clientName || 'Final'} - Motivo: ${reasonLabel}`,
        amount: totalReturnAmount,
        totalUsd: totalUsdReturn,
        exchangeRate: rate,
        referenceId: returnTransaction.id,
        referenceType: 'return',
        createdAt: new Date().toISOString()
      };

      // Nuevas transacciones para el registro (balancín de caja)
      const currentTxs = register?.txs || [];
      const updatedTxs = [...currentTxs, returnTransaction];

      // Ejecutar todo en un solo bloque atómico
      await syncService.runAtomicSale(currentTerminalName, returnTransaction, {
        products: stockUpdates,
        kardexEntries: kardexEntries,
        accountingEntry: accountingEntry,
        registerUpdate: { txs: updatedTxs }
      });

      // Actualizar el estado de la venta original
      const db = getDatabase(app);
      await update(ref(db, `transactions/${saleId}`), {
        return_status: returnStatus,
        updatedAt: new Date().toISOString()
      });

      localStorage.setItem(getReturnStorageKey(), returnReceiptNumber.toString());
      setNextReturnNumber(returnReceiptNumber + 1);

      setMessage({ type: 'success', text: `✅ Devolución DEV-${returnReceiptNumber.toString().padStart(6, '0')} procesada correctamente.` });
      setSearchReceipt('');
      setTimeout(() => {
        setShowReturnModal(false);
        setSelectedTransaction(null);
      }, 2000);

    } catch (err) {
      console.error('Error procesando devolución:', err);
      alert('Error crítico al procesar la devolución.');
    } finally {
      setIsProcessing(false);
    }
  };

  const txDetailItems = useMemo(() => {
    if (!viewingReturnDetail?.items) return [];
    if (typeof viewingReturnDetail.items === 'string') {
      try { return JSON.parse(viewingReturnDetail.items); } catch(e) { return []; }
    }
    return viewingReturnDetail.items;
  }, [viewingReturnDetail]);

  const salesTransactionsList = useMemo(() => salesTransactions, [salesTransactions]);

  return (
    <div className="p-6 h-full overflow-auto bg-background flex flex-col">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4 flex-shrink-0">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex-1 min-w-[300px]">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <ArrowLeftRight size={24} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-red-900 tracking-tight uppercase">Módulo de Devoluciones</h2>
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-widest">
                Terminal: {currentTerminalName} • {activeTab === 'process' ? 'Paso 1: Localizar Venta' : 'Historial de Operaciones'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <div className="flex items-center gap-2 bg-white border border-[#9E9E9E] rounded-lg px-3 py-1 shadow-sm">
              <Terminal size={14} className="text-black/50" />
              <select
                value={selectedTerminal}
                onChange={(e) => setSelectedTerminal(e.target.value)}
                className="bg-transparent border-none text-xs font-black text-black focus:outline-none"
              >
                <option value="all">TODAS LAS TERMINALES</option>
                {availableTerminals.map((term) => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-[#9E9E9E] flex-shrink-0">
        <button
          onClick={() => { setActiveTab('process'); setMessage(null); }}
          className={cn(
            "px-6 py-2.5 font-black text-sm transition-all rounded-t-xl",
            activeTab === 'process' ? "bg-white border-t border-l border-r border-[#9E9E9E] text-red-600" : "text-black/50 hover:bg-white/50"
          )}
        >
          Procesar Devolución
        </button>
        <button
          onClick={() => { setActiveTab('history'); setMessage(null); }}
          className={cn(
            "px-6 py-2.5 font-black text-sm transition-all rounded-t-xl",
            activeTab === 'history' ? "bg-white border-t border-l border-r border-[#9E9E9E] text-red-600" : "text-black/50 hover:bg-white/50"
          )}
        >
          Devoluciones Procesadas
        </button>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-2xl p-5 mb-6 shadow-md flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <Search size={18} className="text-slate-400" />
          <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider">
            {activeTab === 'process' ? 'Paso 1: Localizar Venta Original' : 'Filtrar Devoluciones Procesadas'}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[9px] font-black text-black/40 uppercase block mb-1">
              Buscar por {activeTab === 'process' ? 'Número de Recibo' : 'Folio DEV-'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  value={searchReceipt}
                  onChange={(e) => setSearchReceipt(e.target.value)}
                  placeholder={activeTab === 'process' ? "Ej: 00000019" : "Ej: 000001"}
                  className="pl-10 h-11 text-base font-mono font-bold border-slate-300 focus:border-red-500 focus:ring-red-500/20"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchByReceipt()}
                  autoComplete="off"
                />
              </div>
              <Button onClick={handleSearchByReceipt} className="h-11 px-6 bg-slate-900 text-white font-black hover:bg-black">
                BUSCAR
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-black/40 uppercase block mb-1">Desde Fecha</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 font-bold" />
          </div>
          <div>
            <label className="text-[9px] font-black text-black/40 uppercase block mb-1">Hasta Fecha</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 font-bold" />
          </div>
        </div>
      </div>

      {message && (
        <div className={cn(
          "mb-6 p-4 rounded-xl flex items-center gap-3 border-2 animate-in slide-in-from-top-2", 
          message.type === 'success' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        )}>
          {message.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
          <span className="flex-1 font-bold">{message.text}</span>
          <button onClick={() => setMessage(null)} className="hover:opacity-70"><X size={18} /></button>
        </div>
      )}

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-red-600" size={32} />
              <p className="text-sm font-bold text-slate-500">Actualizando datos en tiempo real...</p>
            </div>
          ) : activeTab === 'process' ? (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Recibo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Terminal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha y Hora</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total Bs</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesTransactionsList.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-16 opacity-30 italic">No hay ventas registradas en el período</TableCell></TableRow>
                ) : (
                  salesTransactionsList.map((tx) => {
                    const returned = tx.return_status === 'total' || tx.return_status === 'partial';
                    return (
                      <TableRow key={tx.id} className={cn("group hover:bg-slate-50 transition-colors", returned && "bg-red-50/30")}>
                        <TableCell className="font-mono font-black text-slate-700">#{formatReceipt(tx.receiptNumber || tx.receipt_number)}</TableCell>
                        <TableCell><span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{tx.terminalId}</span></TableCell>
                        <TableCell className="font-bold">{tx.clientName || 'CONSUMIDOR FINAL'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{new Date(tx.date).toLocaleString('es-VE')}</TableCell>
                        <TableCell className="text-right font-black">{formatBs(tx.total)}</TableCell>
                        <TableCell className="text-center">
                          {returned ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-red-600 bg-red-100 px-3 py-1 rounded-full uppercase">
                              <CheckCircle size={12} /> Procesada
                            </span>
                          ) : (
                            <Button onClick={() => openReturnModal(tx)} className="bg-red-600 text-white font-black text-[10px] h-8 px-4 hover:bg-red-700 transition-all">PROCESAR DEVOLUCIÓN</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Folio</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Origen (Recibo)</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Terminal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Reembolso Bs</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedReturns.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-16 opacity-30 italic">No hay devoluciones registradas en el período</TableCell></TableRow>
                ) : (
                  processedReturns.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-mono font-black text-red-600">{formatReturnReceipt(tx.receiptNumber)}</TableCell>
                      <TableCell className="font-mono text-slate-500">#{formatReceipt(tx.originalReceiptNumber)}</TableCell>
                      <TableCell><span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{tx.terminalId}</span></TableCell>
                      <TableCell className="font-bold">{tx.clientName || 'CONSUMIDOR FINAL'}</TableCell>
                      <TableCell className="text-xs text-slate-500">{new Date(tx.date).toLocaleString('es-VE')}</TableCell>
                      <TableCell className="text-right font-black text-red-600">-{formatBs(tx.total)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => setViewingReturnDetail(tx)} className="text-primary hover:bg-primary/10">
                          <Eye size={16} className="mr-1" /> VER DETALLE
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={!!viewingReturnDetail} onOpenChange={() => setViewingReturnDetail(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <History size={20} className="text-red-400" />
                <div>
                  <DialogTitle className="text-base font-black">Detalle de Devolución</DialogTitle>
                  <p className="text-[10px] opacity-60 font-mono">{viewingReturnDetail ? formatReturnReceipt(viewingReturnDetail.receiptNumber) : ''}</p>
                </div>
              </div>
              <button onClick={() => setViewingReturnDetail(null)}><X size={20} /></button>
            </div>
            
            {viewingReturnDetail && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm pb-4 border-b border-gray-100">
                  <div>
                    <label className="text-[9px] font-black text-black/40 uppercase">Fecha y Hora</label>
                    <p className="font-bold">{new Date(viewingReturnDetail.date).toLocaleString('es-VE')}</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-black/40 uppercase">Concepto</label>
                    <p className="font-bold">Devolución Recibo #{formatReceipt(viewingReturnDetail.originalReceiptNumber)}</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-black/40 uppercase">Método de Reembolso</label>
                    <p className="font-bold uppercase text-red-600">{viewingReturnDetail.returnMethod || viewingReturnDetail.payMethod || 'EFECTIVO'}</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-black/40 uppercase">Cliente</label>
                    <p className="font-bold">{viewingReturnDetail.clientName || 'Cliente Final'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center gap-2"><Package size={14} /> Productos Devueltos</h4>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="p-2 text-left">Producto</th>
                          <th className="p-2 text-center">Cant.</th>
                          <th className="p-2 text-right">Monto (Bs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {txDetailItems.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold">{item.name}</td>
                            <td className="p-2 text-center font-black">{item.qty}</td>
                            <td className="p-2 text-right font-bold">{formatBs(item.priceBs * item.qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-red-600 uppercase">Total Reembolsado</span>
                    <span className="text-xl font-black text-red-600">{formatBs(viewingReturnDetail.total)}</span>
                  </div>
                  <p className="text-[10px] text-red-500 italic mt-2">"{viewingReturnDetail.notes || 'Sin observaciones adicionales'}"</p>
                </div>
              </div>
            )}
            <div className="bg-gray-50 p-4 border-t flex justify-end">
              <Button onClick={() => setViewingReturnDetail(null)} className="bg-slate-800 text-white font-bold h-9">CERRAR DETALLE</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <div className="flex flex-col h-[90vh]">
            <div className="bg-[#1A2C4E] p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-red-500 p-2 rounded-xl">
                  <ArrowLeftRight size={24} className="text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase">Nueva Devolución</DialogTitle>
                  <p className="text-xs text-white/60 font-bold uppercase tracking-widest">
                    Asociada al Recibo: #{selectedTransaction ? formatReceipt(selectedTransaction.receiptNumber || selectedTransaction.receipt_number) : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="hover:rotate-90 transition-all duration-300 text-white/50 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                        <Package size={14} /> Paso 2: Seleccionar Productos
                      </h4>
                      <Button variant="ghost" onClick={selectAllItems} className="text-[10px] font-black text-red-600 hover:bg-red-50 px-2 h-7">
                        SELECCIONAR TODO EL TICKET
                      </Button>
                    </div>

                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="p-3 text-left">Producto</th>
                            <th className="p-3 text-center">Precio</th>
                            <th className="p-3 text-center">Vendido</th>
                            <th className="p-3 text-center">Devolver</th>
                            <th className="p-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {returnItems.map((item, idx) => (
                            <tr key={idx} className={cn("hover:bg-slate-50 transition-colors", item.returnQty > 0 && "bg-red-50/50")}>
                              <td className="p-3">
                                <p className="font-bold text-slate-800">{item.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono">ID: {item.productId}</p>
                              </td>
                              <td className="p-3 text-center font-mono">{formatBs(item.priceBs)}</td>
                              <td className="p-3 text-center">
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black">{item.originalQty}</span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center items-center gap-2">
                                  <button onClick={() => updateReturnQty(idx, item.returnQty - 1)} className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-white active:scale-90 transition-all text-slate-500" disabled={item.returnQty <= 0}><Minus size={14} /></button>
                                  <span className={cn("w-10 text-center text-base font-black", item.returnQty > 0 ? "text-red-600" : "text-slate-400")}>{item.returnQty}</span>
                                  <button onClick={() => updateReturnQty(idx, item.returnQty + 1)} className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-white active:scale-90 transition-all text-slate-500" disabled={item.returnQty >= item.originalQty}><Plus size={14} /></button>
                                </div>
                              </td>
                              <td className="p-3 text-right font-black text-slate-900">{formatBs(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-200">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Total a Reembolsar</p>
                    <p className="text-4xl font-black mt-1 leading-none">{formatBs(totalReturnAmount)}</p>
                  </div>

                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3">Paso 3: Motivo de la Devolución</h4>
                    <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20">
                      {RETURN_REASONS.map(r => (<option key={r.id} value={r.id}>{r.label}</option>))}
                    </select>
                  </div>

                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3">Paso 4: Método de Reembolso</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {returnMethodsList.map(m => (
                        <button key={m.id} onClick={() => setSelectedMethod(m.id)} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all group", selectedMethod === m.id ? "bg-red-50 border-red-500" : "bg-slate-50 border-transparent hover:border-slate-300")}>
                          <m.icon size={20} className={cn("transition-colors", selectedMethod === m.id ? "text-red-600" : "text-slate-400")} />
                          <span className={cn("text-[9px] font-black tracking-tight", selectedMethod === m.id ? "text-red-700" : "text-slate-500")}>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck size={18} className="text-amber-600" />
                      <h4 className="text-[10px] font-black uppercase text-amber-700">Paso 5: Autorización de Supervisor</h4>
                    </div>
                    <Input type="password" maxLength={6} value={authPin} onChange={e => setAuthPin(e.target.value.replace(/\D/g, ''))} className="h-12 text-center text-2xl font-mono font-black border-amber-300 bg-white tracking-[0.5em] focus:ring-amber-500/20" placeholder="••••••" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border-t p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <AlertCircle size={14} />
                <span>Esta acción es irreversible y afecta inventario/caja</span>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setShowReturnModal(false)} className="px-6 font-bold text-slate-500">CANCELAR</Button>
                <Button onClick={processReturn} disabled={!hasItemsToReturn || !authPin || isProcessing} className="bg-red-600 text-white font-black px-10 h-12 rounded-xl hover:bg-red-700 shadow-lg disabled:opacity-50">
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : 'CONFIRMAR Y FINALIZAR'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
