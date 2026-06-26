"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Search, X, CheckCircle, AlertCircle, Receipt, User, Calendar, Banknote, Minus, Plus, RefreshCw, Smartphone, CreditCard, Monitor, Loader2, Terminal } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Transaction, CartItem } from '@/lib/types';
import syncService from '@/services/syncService';
import { formatBs } from '@/lib/currency-formatter';
import { useAuth } from '@/context/AuthContext';
import { getDatabase, ref, get, update } from 'firebase/database';
import app from '@/lib/firebase';

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

function formatReceipt(num?: number): string {
  return (num || 0).toString().padStart(8, '0');
}

interface ReturnsModuleProps {
  userRole?: 'admin' | 'cashier';
}

export default function ReturnsModule({ userRole = 'cashier' }: ReturnsModuleProps) {
  const { user } = useAuth();
  const currentTerminalId = user?.terminalId || 'default';
  const isAdmin = userRole === 'admin' || user?.role === 'admin';

  const { products, register, exchangeRate, registerCashEgress } = usePOSState();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<ReturnMethod>('efectivo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ✅ Filtros de fecha
  const [startDate, setStartDate] = useState(getTodayYMD());
  const [endDate, setEndDate] = useState(getTodayYMD());
  const [searchReceipt, setSearchReceipt] = useState('');

  // ✅ SELECTOR DE TERMINAL (SOLO PARA ADMIN)
  const [selectedTerminal, setSelectedTerminal] = useState<string>('all');
  const [availableTerminals, setAvailableTerminals] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);

  // ✅ Paginación
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // ✅ Cargar terminales disponibles (solo admin)
  useEffect(() => {
    if (isAdmin) {
      const loadTerminals = async () => {
        setIsLoadingTerminals(true);
        try {
          const terms = await syncService.getAllTerminals();
          setAvailableTerminals(terms.map(t => ({ id: t.id, name: t.name || t.id })));
        } catch (error) {
          console.error('Error cargando terminales:', error);
        } finally {
          setIsLoadingTerminals(false);
        }
      };
      loadTerminals();
    }
  }, [isAdmin]);

  // ✅ Obtener terminal a consultar
  const getTargetTerminal = useCallback(() => {
    if (isAdmin) {
      return selectedTerminal === 'all' ? null : selectedTerminal;
    }
    return currentTerminalId;
  }, [isAdmin, selectedTerminal, currentTerminalId]);

  // ✅ Cargar transacciones
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const targetTerminal = getTargetTerminal();
      const db = getDatabase(app);
      const snapshot = await get(ref(db, 'transactions'));
      
      let transactions: any[] = [];
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        transactions = Object.entries(data).map(([id, tx]) => ({ 
          id: id, 
          ...(tx as any) 
        }));
        
        // ✅ Filtrar por terminal (si no es 'all')
        transactions = transactions.filter(tx => {
          const txTerminal = extractTerminalIdFromSession(tx.session_id);
          if (targetTerminal) {
            return txTerminal === targetTerminal;
          }
          return true; // 'all' muestra todas las terminales
        });
        
        // ✅ Filtrar por fecha
        transactions = transactions.filter(tx => {
          if (!tx.date) return false;
          const txDate = getLocalDateStr(tx.date);
          return txDate >= startDate && txDate <= endDate;
        });
        
        // ✅ Ordenar por fecha descendente
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      
      setAllTransactions(transactions);
      
      const start = 0;
      const end = itemsPerPage;
      setFilteredTransactions(transactions.slice(start, end));
      setCurrentPage(1);
      
    } catch (error) {
      console.error('Error cargando transacciones:', error);
      setMessage({ type: 'error', text: 'Error cargando transacciones' });
    } finally {
      setIsLoading(false);
    }
  }, [getTargetTerminal, startDate, endDate]);

  // ✅ Recargar cuando cambia terminal seleccionada
  useEffect(() => {
    if (isAdmin) {
      loadTransactions();
    }
  }, [selectedTerminal, loadTransactions, isAdmin]);

  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    const start = (nextPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const more = allTransactions.slice(start, end);
    
    if (more.length > 0) {
      setFilteredTransactions(prev => [...prev, ...more]);
      setCurrentPage(nextPage);
    }
  }, [currentPage, allTransactions]);

  const handleSearchByReceipt = useCallback(async () => {
    const receipt = searchReceipt.trim();
    if (!receipt) {
      loadTransactions();
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const targetTerminal = getTargetTerminal();
      const num = parseInt(receipt);
      if (isNaN(num)) {
        setMessage({ type: 'error', text: 'Ingrese un número de recibo válido' });
        setIsLoading(false);
        return;
      }
      
      // ✅ Buscar en todas las transacciones filtradas por terminal
      const found = allTransactions.find(tx => {
        const txTerminal = extractTerminalIdFromSession(tx.session_id);
        if (targetTerminal && txTerminal !== targetTerminal) return false;
        return (tx.receipt_number || tx.receiptNumber) === num;
      });
      
      if (found) {
        setFilteredTransactions([found]);
        setCurrentPage(1);
        if (found.return_status === 'total' || found.return_status === 'partial') {
          setMessage({ type: 'error', text: 'Esta venta ya fue devuelta (total o parcialmente)' });
        }
      } else {
        setFilteredTransactions([]);
        setMessage({ type: 'error', text: 'No se encontró una venta con ese número de recibo' });
      }
    } catch (error) {
      console.error('Error buscando transacción:', error);
      setMessage({ type: 'error', text: 'Error al buscar la transacción' });
    } finally {
      setIsLoading(false);
    }
  }, [allTransactions, searchReceipt, loadTransactions, getTargetTerminal]);

  const clearSearch = useCallback(() => {
    setSearchReceipt('');
    setMessage(null);
    const start = 0;
    const end = itemsPerPage;
    setFilteredTransactions(allTransactions.slice(start, end));
    setCurrentPage(1);
  }, [allTransactions]);

  useEffect(() => {
    if (!searchReceipt.trim()) {
      loadTransactions();
    }
  }, [loadTransactions, searchReceipt]);

  const isTransactionReturned = useCallback((tx: any) => {
    return tx.return_status === 'total' || tx.return_status === 'partial';
  }, []);

  const salesTransactions = useMemo(() => {
    return filteredTransactions.filter(t => {
      if (t.type !== 'contado' && t.type !== 'credito') return false;
      if (t.type === 'devolucion') return false;
      return true;
    });
  }, [filteredTransactions]);

  const openReturnModal = (tx: any, type: 'total' | 'partial') => {
    if (isTransactionReturned(tx)) {
      alert('Esta venta ya fue devuelta (total o parcialmente). No se puede procesar otra devolución.');
      return;
    }
    
    if (!isAdmin && !register?.isOpen) {
      alert('La caja debe estar abierta para hacer devoluciones');
      return;
    }
    
    setSelectedTransaction(tx);
    setSelectedMethod('efectivo');
    
    let items: any[] = [];
    if (typeof tx.items === 'string') {
      try {
        items = JSON.parse(tx.items);
      } catch (e) {
        items = [];
      }
    } else if (Array.isArray(tx.items)) {
      items = tx.items;
    }
    
    const returnItemsList: ReturnItem[] = items.map((item: any) => ({
      productId: item.productId || 0,
      name: item.name || 'Producto',
      priceBs: item.priceBs || item.price_bs || 0,
      originalQty: item.qty || 1,
      returnQty: type === 'total' ? (item.qty || 1) : 0,
      amount: type === 'total' ? ((item.priceBs || item.price_bs || 0) * (item.qty || 1)) : 0
    }));
    
    setReturnItems(returnItemsList);
    if (type === 'total') setShowConfirmModal(true);
    else setShowReturnModal(true);
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

  const totalReturnAmount = useMemo(() => returnItems.reduce((s, i) => s + i.amount, 0), [returnItems]);
  const hasItemsToReturn = useMemo(() => returnItems.some(i => i.returnQty > 0), [returnItems]);

  const processReturn = async () => {
    if (isAdmin) {
      setMessage({ type: 'error', text: 'Los administradores no pueden procesar devoluciones' });
      return;
    }
    
    if (!register?.isOpen) {
      setMessage({ type: 'error', text: 'La caja debe estar abierta para hacer devoluciones' });
      return;
    }
    
    if (!selectedTransaction) {
      setMessage({ type: 'error', text: 'No hay transacción seleccionada' });
      return;
    }
    
    if (totalReturnAmount <= 0) {
      setMessage({ type: 'error', text: 'Seleccione productos para devolver' });
      return;
    }
    
    if (isTransactionReturned(selectedTransaction)) {
      setMessage({ type: 'error', text: 'Esta venta ya fue devuelta. No se puede procesar otra devolución.' });
      return;
    }
    
    setIsProcessing(true);
    setMessage(null);
    
    const saleId = selectedTransaction.id;
    const returnType = returnItems.every(i => i.returnQty === i.originalQty) ? 'total' : 'partial';
    
    // ✅ Bloquear UI inmediatamente
    setFilteredTransactions(prev => 
      prev.map(tx => 
        tx.id === saleId ? { ...tx, return_status: returnType } : tx
      )
    );
    setAllTransactions(prev => 
      prev.map(tx => 
        tx.id === saleId ? { ...tx, return_status: returnType } : tx
      )
    );
    
    try {
      // ✅ CORREGIDO: Crear CartItem con todas las propiedades requeridas
      const returnItemsList: CartItem[] = returnItems.filter(i => i.returnQty > 0).map(i => ({
        productId: i.productId,
        name: i.name,
        priceBs: i.priceBs,
        priceUsd: i.priceBs / exchangeRate,
        qty: i.returnQty,
        category: 'Otro',
        ivaType: 'sin_iva',
        ivaPercentage: 0,
        isKit: false
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
        payMethod: selectedTransaction.pay_method || selectedTransaction.payMethod || 'efectivo_bs',
        paidBs: totalReturnAmount,
        change: 0,
        clientId: selectedTransaction.client_id || selectedTransaction.clientId || null,
        clientName: selectedTransaction.client_name || selectedTransaction.clientName || null,
        original_sale_id: saleId,
        originalSaleId: saleId,
        original_receipt_number: selectedTransaction.receipt_number || selectedTransaction.receiptNumber,
        originalReceiptNumber: selectedTransaction.receipt_number || selectedTransaction.receiptNumber,
        returnMethod: selectedMethod,
        terminalId: currentTerminalId,
        session_id: selectedTransaction.session_id,
      };
      
      const db = getDatabase(app);
      await Promise.all([
        syncService.saveTransaction(returnTransaction),
        update(ref(db, `transactions/${saleId}`), {
          return_status: returnType,
          updatedAt: new Date().toISOString()
        })
      ]);
      
      // ✅ Actualizar stock y crear kardex entries
      for (const ret of returnItems.filter(i => i.returnQty > 0)) {
        const prod = products.find(p => p.id === ret.productId);
        if (prod) {
          const newStock = prod.stock + ret.returnQty;
          await syncService.saveProduct({ ...prod, stock: newStock });
          await syncService.saveKardexEntry({
            productId: ret.productId,
            date: new Date().toISOString(),
            type: 'devolucion',
            quantity: ret.returnQty,
            previousStock: prod.stock,
            newStock: newStock,
            reference: `Devolución #${selectedTransaction.receipt_number || selectedTransaction.receiptNumber}`,
            note: `Dev. ${returnType} - Recibo #${formatReceipt(selectedTransaction.receipt_number || selectedTransaction.receiptNumber)}`,
            costUsd: prod.costUsd,
          });
        }
      }
      
      if (selectedMethod === 'efectivo') {
        await registerCashEgress(totalReturnAmount, `Devolución #${selectedTransaction.receipt_number || selectedTransaction.receiptNumber}`, selectedTransaction.id, 'efectivo_bs');
      } else if (selectedMethod === 'pago_movil') {
        await registerCashEgress(totalReturnAmount, `Devolución #${selectedTransaction.receipt_number || selectedTransaction.receiptNumber}`, selectedTransaction.id, 'pago_movil');
      } else {
        await syncService.saveAccountingEntry({
          id: Date.now(),
          date: new Date().toISOString(),
          type: 'egreso',
          category: 'devolucion',
          subcategory: 'nota_credito',
          concept: `Nota de crédito - Devolución #${selectedTransaction.id}`,
          description: `Devolución a ${selectedTransaction.client_name || selectedTransaction.clientName || 'Cliente'}`,
          amount: totalReturnAmount,
          referenceId: selectedTransaction.id,
          referenceType: 'return',
          createdAt: new Date().toISOString()
        });
      }
      
      setMessage({ type: 'success', text: '✅ Devolución exitosa - Venta bloqueada permanentemente' });
      
      setTimeout(() => { 
        setMessage(null); 
        setShowReturnModal(false); 
        setShowConfirmModal(false); 
        setSelectedTransaction(null);
      }, 1500);
      
    } catch (err) {
      console.error('Error en devolución:', err);
      // ✅ Revertir UI si falla
      setFilteredTransactions(prev => 
        prev.map(tx => 
          tx.id === saleId ? { ...tx, return_status: undefined } : tx
        )
      );
      setAllTransactions(prev => 
        prev.map(tx => 
          tx.id === saleId ? { ...tx, return_status: undefined } : tx
        )
      );
      setMessage({ type: 'error', text: '❌ Error en devolución: ' + (err instanceof Error ? err.message : 'Intente nuevamente') });
    } finally { 
      setIsProcessing(false); 
    }
  };

  const hasMore = useMemo(() => {
    const totalDisplayed = filteredTransactions.length;
    const totalAvailable = allTransactions.length;
    return totalDisplayed < totalAvailable;
  }, [filteredTransactions, allTransactions]);

  // ✅ CORRECCIÓN QUIRÚRGICA: Mostrar el Nombre de la Terminal asignado al usuario
  const getTerminalDisplayText = useCallback(() => {
    if (!isAdmin) return user?.terminalName || `Terminal ${currentTerminalId}`;
    if (selectedTerminal === 'all') return 'Todas las terminales';
    const term = availableTerminals.find(t => t.id === selectedTerminal);
    return term ? term.name : `Terminal ${selectedTerminal}`;
  }, [isAdmin, selectedTerminal, availableTerminals, currentTerminalId, user?.terminalName]);

  if (isLoading && allTransactions.length === 0) {
    return (
      <div className="p-6 h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-black/50">Cargando transacciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto bg-background">
      <div className="flex justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black">Devoluciones</h2>
          <p className="text-sm text-black/50">
            Gestión de devoluciones - {getTerminalDisplayText()}
          </p>
          {!searchReceipt.trim() && (
            <p className="text-xs text-black/30 mt-1">
              {allTransactions.length} transacciones en el período · Mostrando {filteredTransactions.length}
            </p>
          )}
          {isAdmin && (
            <p className="text-xs text-amber-600 mt-1">⚠️ Modo administrador: Solo visualización</p>
          )}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <div className="flex items-center gap-2 bg-white border border-[#9E9E9E] rounded-lg px-3 py-1">
              <Terminal size={14} className="text-black/50" />
              <select
                value={selectedTerminal}
                onChange={(e) => setSelectedTerminal(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-black focus:outline-none py-1"
                disabled={isLoadingTerminals}
              >
                <option value="all">📡 Todas las terminales</option>
                {availableTerminals.map((term) => (
                  <option key={term.id} value={term.id}>
                    🖥️ {term.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button 
            onClick={loadTransactions} 
            variant="outline" 
            className="h-8 text-[10px] font-black border-[#9E9E9E]"
          >
            <RefreshCw size={12} className="mr-1" /> RECARGAR
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-black text-black/60 uppercase block mb-1">Fecha Desde</label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-sm"
              disabled={!!searchReceipt.trim()}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-black/60 uppercase block mb-1">Fecha Hasta</label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-sm"
              disabled={!!searchReceipt.trim()}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-black text-black/60 uppercase block mb-1">Buscar por Recibo</label>
              <Input 
                type="text" 
                value={searchReceipt}
                onChange={(e) => setSearchReceipt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchByReceipt();
                  }
                }}
                className="h-9 text-sm font-mono"
                placeholder="Ej: 00000001"
              />
            </div>
            <Button 
              onClick={handleSearchByReceipt} 
              disabled={isLoading}
              className="bg-primary text-black font-black h-9 text-xs px-3"
            >
              <Search size={14} />
            </Button>
            {searchReceipt.trim() && (
              <Button 
                variant="ghost" 
                onClick={clearSearch}
                className="h-9 text-xs px-3"
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </div>
        {!searchReceipt.trim() && (
          <div className="flex justify-between mt-3">
            <span className="text-[9px] text-black/40">
              Mostrando transacciones del {startDate} al {endDate}
            </span>
            <Button 
              onClick={loadTransactions}
              className="bg-primary text-black font-black h-7 text-[9px] px-3"
            >
              APLICAR FILTROS
            </Button>
          </div>
        )}
      </div>

      {message && (
        <div className={cn("mb-4 p-3 rounded-lg flex items-center gap-2", message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)}><X size={14} /></button>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow>
              <TableHead className="text-[10px] font-black"># RECIBO</TableHead>
              <TableHead className="text-[10px] font-black">TERMINAL</TableHead>
              <TableHead className="text-[10px] font-black">CLIENTE</TableHead>
              <TableHead className="text-[10px] font-black">FECHA</TableHead>
              <TableHead className="text-[10px] font-black text-right">TOTAL</TableHead>
              <TableHead className="text-[10px] font-black text-center">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 italic text-black/50">
                  {searchReceipt.trim() ? 'No se encontró la venta' : 'No hay ventas en el período seleccionado'}
                </TableCell>
              </TableRow>
            ) : (
              salesTransactions.map((tx: any) => {
                const returned = tx.return_status === 'total' || tx.return_status === 'partial';
                return (
                  <TableRow key={tx.id} className={cn("border-b hover:bg-gray-50", returned && "bg-red-50")}>
                    <TableCell className="font-mono font-bold">
                      #{formatReceipt(tx.receipt_number || tx.receiptNumber || tx.id)}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-green-600">
                      <Monitor size={12} className="inline mr-1" />
                      {extractTerminalIdFromSession(tx.session_id || tx.sessionId)}
                    </TableCell>
                    <TableCell className="text-sm font-bold">
                      {tx.client_name || tx.clientName || 'Cliente Final'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(tx.date).toLocaleString('es-VE', {
                        timeZone: 'America/Caracas',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatBs(tx.total)}</TableCell>
                    <TableCell className="text-center space-x-2">
                      <button 
                        disabled={returned || isAdmin || isProcessing} 
                        onClick={() => openReturnModal(tx, 'total')} 
                        className={cn(
                          "px-3 py-1 text-white text-[10px] font-bold rounded transition-all",
                          returned || isAdmin || isProcessing
                            ? "bg-gray-400 cursor-not-allowed opacity-60" 
                            : "bg-red-600 hover:bg-red-700 cursor-pointer"
                        )}
                        title={returned ? "Esta venta fue devuelta - No se puede procesar otra devolución" : "Devolver total"}
                      >
                        {returned ? '✓ DEVUELTA' : 'DEV. TOTAL'}
                      </button>
                      <button 
                        disabled={returned || isAdmin || isProcessing} 
                        onClick={() => openReturnModal(tx, 'partial')} 
                        className={cn(
                          "px-3 py-1 text-white text-[10px] font-bold rounded transition-all",
                          returned || isAdmin || isProcessing
                            ? "bg-gray-400 cursor-not-allowed opacity-60" 
                            : "bg-yellow-600 hover:bg-yellow-700 cursor-pointer"
                        )}
                        title={returned ? "Esta venta fue devuelta - No se puede procesar otra devolución" : "Devolver parcialmente"}
                      >
                        {returned ? '✓ DEVUELTA' : 'DEV. PARCIAL'}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        {!searchReceipt.trim() && hasMore && (
          <div className="p-4 border-t bg-gray-50 flex justify-center">
            <Button
              onClick={loadMore}
              disabled={isLoading}
              variant="outline"
              className="text-xs font-black"
            >
              CARGAR MÁS (5)
            </Button>
          </div>
        )}
      </div>

      {/* Modal Devolución Parcial */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="bg-[#1A2C4E] p-5 text-white sticky top-0">
            <DialogTitle>Devolución Parcial</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            {selectedTransaction && (
              <div className="bg-gray-100 p-4 rounded grid grid-cols-2 gap-3 text-sm">
                <div><Receipt size={14} className="inline mr-1" /> Recibo #{formatReceipt(selectedTransaction.receipt_number || selectedTransaction.receiptNumber || selectedTransaction.id)}</div>
                <div><Monitor size={14} className="inline mr-1" /> Terminal: {extractTerminalIdFromSession(selectedTransaction.session_id || selectedTransaction.sessionId)}</div>
                <div><User size={14} className="inline mr-1" /> {selectedTransaction.client_name || selectedTransaction.clientName || 'Cliente Final'}</div>
                <div><Calendar size={14} className="inline mr-1" /> {new Date(selectedTransaction.date).toLocaleString('es-VE')}</div>
                <div><Banknote size={14} className="inline mr-1" /> Total: {formatBs(selectedTransaction.total)}</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {returnMethods.map(m => (
                <button key={m.id} onClick={() => setSelectedMethod(m.id)} className={cn("p-3 border-2 rounded-xl text-center", selectedMethod === m.id ? "border-primary bg-primary/10" : "border-gray-200")}>
                  <m.icon size={20} className="mx-auto" /><p className="text-[10px] font-bold">{m.label}</p>
                </button>
              ))}
            </div>
            <div className="border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr><th className="p-2 text-left">Producto</th><th className="p-2 text-center">Precio</th><th className="p-2 text-center">Vendido</th><th className="p-2 text-center">A devolver</th><th className="p-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>
                  {returnItems.map((item, idx) => (
                    <tr key={item.productId} className="border-b">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-center">{formatBs(item.priceBs)}</td>
                      <td className="p-2 text-center">{item.originalQty}</td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => updateReturnQty(idx, item.returnQty-1)} disabled={item.returnQty<=0} className="w-6 h-6 border rounded hover:bg-gray-100"><Minus size={12} /></button>
                          <span className="w-8 text-center font-bold">{item.returnQty}</span>
                          <button onClick={() => updateReturnQty(idx, item.returnQty+1)} disabled={item.returnQty>=item.originalQty} className="w-6 h-6 border rounded hover:bg-gray-100"><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="p-2 text-right font-bold">{formatBs(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-red-50 p-4 rounded flex justify-between">
              <span className="font-bold">MONTO A DEVOLVER</span>
              <span className="text-2xl font-black text-red-600">{formatBs(totalReturnAmount)}</span>
            </div>
            <Button onClick={processReturn} disabled={!hasItemsToReturn || isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-black">
              {isProcessing ? 'PROCESANDO...' : 'PROCESAR DEVOLUCIÓN'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmación Devolución Total */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="bg-red-600 p-5 text-white">
            <DialogTitle>Confirmar Devolución Total</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            {selectedTransaction && (
              <div className="bg-gray-100 p-4 rounded">
                Recibo #{formatReceipt(selectedTransaction.receipt_number || selectedTransaction.receiptNumber || selectedTransaction.id)} - Total: {formatBs(selectedTransaction.total)}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {returnMethods.map(m => (
                <button key={m.id} onClick={() => setSelectedMethod(m.id)} className={cn("p-3 border-2 rounded-xl text-center", selectedMethod === m.id ? "border-primary bg-primary/10" : "border-gray-200")}>
                  <m.icon size={20} className="mx-auto" /><p className="text-[10px] font-bold">{m.label}</p>
                </button>
              ))}
            </div>
            <div className="bg-red-50 p-4 rounded flex justify-between">
              <span className="font-bold">TOTAL A DEVOLVER</span>
              <span className="text-2xl font-black text-red-600">{formatBs(totalReturnAmount)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="flex-1">Cancelar</Button>
              <Button onClick={processReturn} disabled={isProcessing} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black">
                {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
