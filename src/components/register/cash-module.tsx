"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Vault, Banknote, Smartphone, Fingerprint, 
  Plane, DollarSign, CreditCard, Receipt, 
  BarChart3, Clock, Percent, Eye, X,
  RefreshCw, Search, Package, Hash, ShoppingBasket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import CierreFinalForm from '@/components/register/CierreFinalForm';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { getDatabase, ref, get } from 'firebase/database';
import app from '@/lib/firebase';
import syncService from '@/services/syncService';

interface CashModuleProps {
  state: ReturnType<typeof usePOSState>;
}

function getVenezuelaDateString(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const formatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch (e) {
    return "";
  }
}

function getTodayYMD(): string {
  return getVenezuelaDateString(new Date());
}

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

function extractTerminalIdFromSession(sessionId: string | null | undefined): string {
  if (!sessionId) return 'default';
  const parts = sessionId.split('_');
  if (parts.length > 0 && parts[0]) {
    return parts[0];
  }
  return 'default';
}

export default function CashModule({ state }: CashModuleProps) {
  const { user } = useAuth();
  // ✅ Usar el NOMBRE legible de la terminal para los filtros de transacciones (ej: "0001")
  const terminalId = user?.terminalName || user?.terminalId || 'default';
  const terminalName = user?.terminalName ? `Terminal ${user.terminalName}` : 'Terminal Principal';

  const [openAmountBs, setOpenAmountBs] = useState('0.00');
  const [openAmountUsd, setOpenAmountUsd] = useState('0.00');
  const [showCierreFinal, setShowCierreFinal] = useState(false);
  const [showCambioTasaModal, setShowCambioTasaModal] = useState(false);
  const [nuevaTasaInput, setNuevaTasaInput] = useState(state.exchangeRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [isOpeningCash, setIsOpeningCash] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [todaysTransactions, setTodaysTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  const loadTodaysTransactions = useCallback(async () => {
    if (isClosed) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const today = getTodayYMD();
      const db = getDatabase(app);
      const snapshot = await get(ref(db, 'transactions'));
      
      let todayTx: any[] = [];
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const allTx = Object.entries(data).map(([id, tx]) => ({ 
          id: id, 
          ...(tx as any) 
        }));

        todayTx = allTx.filter(tx => {
          // ✅ Priorizar el campo terminalId (que ahora guarda el nombre legible)
          // ✅ Fallback al ID de sesión (que usa el ID técnico) solo si no hay terminalId guardado
          const txTerminal = tx.terminalId || tx.terminal_id || extractTerminalIdFromSession(tx.sessionId || tx.session_id);
          
          // ✅ Comparación bivalente para asegurar compatibilidad con registros antiguos (ID técnico) y nuevos (Nombre)
          const matchesTerminal = txTerminal === terminalId || txTerminal === user?.terminalId;
          
          if (!matchesTerminal) return false;
          
          const txDate = getLocalDateStr(tx.date);
          return txDate === today;
        });

        todayTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      setTodaysTransactions(todayTx);
    } catch (error) {
      console.error('Error cargando transacciones del día:', error);
    } finally {
      setIsLoading(false);
    }
  }, [terminalId, user?.terminalId, isClosed]);

  useEffect(() => {
    loadTodaysTransactions();
  }, [terminalId, isClosed, loadTodaysTransactions]);

  const paymentMethods = [
    { id: 'efectivo_bs', label: 'EFECTIVO BS', icon: Banknote, isUsd: false },
    { id: 'usd_efectivo', label: 'EFECTIVO USD', icon: DollarSign, isUsd: true },
    { id: 'tarjeta', label: 'TARJETA', icon: CreditCard, isUsd: false },
    { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, isUsd: false },
    { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, isUsd: false },
    { id: 'zelle', label: 'ZELLE', icon: Plane, isUsd: true },
  ];

  // ✅ Calcular rango de recibos de la jornada
  const receiptRange = useMemo(() => {
    const saleTxs = todaysTransactions.filter(t => t.type === 'contado' || t.type === 'credito');
    if (saleTxs.length === 0) return { first: '—', last: '—' };
    
    const nums = saleTxs.map(t => t.receiptNumber || t.receipt_number).filter(n => typeof n === 'number');
    if (nums.length === 0) return { first: '—', last: '—' };
    
    return {
      first: Math.min(...nums).toString().padStart(8, '0'),
      last: Math.max(...nums).toString().padStart(8, '0')
    };
  }, [todaysTransactions]);

  const salesBreakdown = useMemo(() => {
    const totalsBs: Record<string, number> = {};
    const totalsUsd: Record<string, number> = {};
    paymentMethods.forEach(m => {
      totalsBs[m.id] = 0;
      totalsUsd[m.id] = 0;
    });
    
    if (todaysTransactions.length === 0) return { totalsBs, totalsUsd };
    
    for (const tx of todaysTransactions) {
      if (tx.type !== 'contado' && tx.type !== 'cobro_deuda') continue;
      
      let payments = tx.payments || [];
      if (typeof payments === 'string') {
        try { payments = JSON.parse(payments); } catch(e) { payments = []; }
      }
      
      const currentRate = tx.exchangeRate || state.exchangeRate;

      if (Array.isArray(payments) && payments.length > 0) {
        for (const p of payments) {
          const method = p.method || 'efectivo_bs';
          const isUsdMethod = method === 'usd_efectivo' || method === 'zelle';
          if (isUsdMethod) {
            const usdAmount = p.usdAmount !== undefined ? p.usdAmount : (p.amount / currentRate) || 0;
            totalsUsd[method] = (totalsUsd[method] || 0) + usdAmount;
          } else {
            const bsAmount = p.amount || 0;
            totalsBs[method] = (totalsBs[method] || 0) + bsAmount;
          }
        }
      } else {
        const method = tx.pay_method || tx.payMethod || 'efectivo_bs';
        const isUsdMethod = method === 'usd_efectivo' || method === 'zelle';
        if (isUsdMethod) {
          const usdAmount = tx.total_usd || tx.totalUsd || 0;
          totalsUsd[method] = (totalsUsd[method] || 0) + usdAmount;
        } else {
          const bsAmount = tx.type === 'cobro_deuda' ? (tx.paidBs || tx.total || 0) : (tx.total || 0);
          totalsBs[method] = (totalsBs[method] || 0) + bsAmount;
        }
      }
    }
    
    return { totalsBs, totalsUsd };
  }, [todaysTransactions, state.exchangeRate]);

  const totalCreditoBs = useMemo(() => {
    return todaysTransactions
      .filter(t => t.type === 'credito')
      .reduce((sum, t) => sum + (t.total || 0), 0);
  }, [todaysTransactions]);

  const totalDevolucionesBs = useMemo(() => 
    todaysTransactions
      .filter(t => t.type === 'devolucion')
      .reduce((sum, t) => sum + (t.total || 0), 0)
  , [todaysTransactions]);

  const totalDevolucionesUsd = useMemo(() => 
    todaysTransactions
      .filter(t => t.type === 'devolucion')
      .reduce((sum, t) => sum + (t.totalUsd || 0), 0)
  , [todaysTransactions]);

  const totalContadoBs = useMemo(() => {
    let total = 0;
    for (const m of paymentMethods.filter(p => !p.isUsd)) {
      total += salesBreakdown.totalsBs[m.id] || 0;
    }
    return total;
  }, [salesBreakdown]);

  const totalContadoUsd = useMemo(() => {
    let total = 0;
    for (const m of paymentMethods.filter(p => p.isUsd)) {
      total += salesBreakdown.totalsUsd[m.id] || 0;
    }
    return total;
  }, [salesBreakdown]);

  // ✅ CORREGIDO: El total en caja debe restar las devoluciones del periodo
  const totalEnCaja = (reg?.openAmountBs || 0) + totalContadoBs - totalDevolucionesBs;
  const totalEnCajaUSD = (reg?.openAmountUsd || 0) + totalContadoUsd - totalDevolucionesUsd;

  const handleOpenCash = async () => {
    const bsAmount = parseFloat(openAmountBs) || 0;
    const usdAmount = parseFloat(openAmountUsd) || 0;
    if (bsAmount <= 0 && usdAmount <= 0) {
      alert("Debe ingresar al menos un monto de apertura (Bs o USD)");
      return;
    }
    setIsOpeningCash(true);
    try {
      await state.openCashRegister(bsAmount, usdAmount, state.exchangeRate);
      await loadTodaysTransactions();
    } catch (error) {
      console.error('Error al abrir caja:', error);
      alert('Error al abrir la caja. Intente de nuevo.');
    } finally {
      setIsOpeningCash(false);
    }
  };

  const handleCambioTasa = async () => {
    const newRate = parseFloat(nuevaTasaInput);
    if (isNaN(newRate) || newRate <= 0) {
      alert("Ingrese una tasa válida");
      return;
    }
    setIsUpdatingRate(true);
    try {
      await state.setExchangeRate(newRate);
      setShowCambioTasaModal(false);
      alert('Tasa actualizada correctamente');
    } catch (error) {
      console.error("Error al cambiar tasa:", error);
      alert("No se pudo actualizar la tasa");
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTodaysTransactions();
    setIsRefreshing(false);
  };

  const getTransactionTypeLabel = (type: string): string => {
    switch (type) {
      case 'contado': return 'CONTADO';
      case 'credito': return 'CRÉDITO';
      case 'cobro_deuda': return 'COBRO DEUDA';
      case 'devolucion': return 'DEVOLUCIÓN';
      case 'colaboracion': return 'COLABORACIÓN';
      case 'consumo_propio': return 'CONSUMO';
      default: return type.toUpperCase();
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'contado': return 'bg-green-100 text-green-700';
      case 'credito': return 'bg-yellow-100 text-yellow-700';
      case 'cobro_deuda': return 'bg-blue-100 text-blue-700';
      case 'devolucion': return 'bg-red-100 text-red-700';
      case 'colaboracion': return 'bg-purple-100 text-purple-700';
      case 'consumo_propio': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPaymentMethodLabel = (tx: any): string => {
    let hasBs = false, hasUsd = false;
    let payments = tx.payments || [];
    if (typeof payments === 'string') {
      try { payments = JSON.parse(payments); } catch(e) { payments = []; }
    }
    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        if (p.method === 'usd_efectivo' || p.method === 'zelle') hasUsd = true;
        else hasBs = true;
      }
    } else {
      const method = tx.pay_method || tx.payMethod || '';
      if (method === 'usd_efectivo' || method === 'zelle') hasUsd = true;
      else hasBs = true;
    }
    if (hasBs && hasUsd) return 'MIXTO';
    if (hasUsd) return (tx.pay_method || tx.payMethod) === 'zelle' ? 'ZELLE' : 'EFECTIVO USD';
    const method = tx.pay_method || tx.payMethod || 'efectivo_bs';
    switch (method) {
      case 'efectivo_bs': return 'EFECTIVO BS';
      case 'tarjeta': return 'TARJETA';
      case 'biopago': return 'BIOPAGO';
      case 'pago_movil': return 'PAGO MÓVIL';
      default: return method.toUpperCase() || '—';
    }
  };

  const getUsdPaid = (tx: any): number => {
    let payments = tx.payments || [];
    if (typeof payments === 'string') {
      try { payments = JSON.parse(payments); } catch(e) { payments = []; }
    }
    
    if (Array.isArray(payments) && payments.length > 0) {
      let totalUsdReceived = 0;
      let hasUsdMethod = false;
      for (const p of payments) {
        if (p.method === 'usd_efectivo' || p.method === 'zelle') {
          hasUsdMethod = true;
          totalUsdReceived += p.usdAmount !== undefined ? p.usdAmount : (p.amount / (tx.exchangeRate || state.exchangeRate)) || 0;
        }
      }
      return hasUsdMethod ? totalUsdReceived : 0;
    }
    
    const method = tx.pay_method || tx.payMethod || '';
    if (method === 'usd_efectivo' || method === 'zelle') {
      return tx.total_usd || tx.totalUsd || 0;
    }
    
    return 0;
  };

  const getBsPaid = (tx: any): number => {
    let payments = tx.payments || [];
    if (typeof payments === 'string') {
      try { payments = JSON.parse(payments); } catch(e) { payments = []; }
    }
    if (Array.isArray(payments) && payments.length > 0) {
      let totalBs = 0;
      for (const p of payments) if (p.method !== 'usd_efectivo' && p.method !== 'zelle') totalBs += p.amount || 0;
      return totalBs;
    }
    const method = tx.pay_method || tx.payMethod || '';
    if (method !== 'usd_efectivo' && method !== 'zelle') return tx.total || 0;
    return 0;
  };

  const getDisplayReceipt = (tx: any): string => {
    const receipt = tx.receiptNumber || tx.receipt_number || 0;
    if (tx.type === 'devolucion') {
      return `DEV-${receipt.toString().padStart(6, '0')}`;
    }
    return receipt.toString().padStart(8, '0');
  };

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return todaysTransactions;
    const s = searchTerm.toLowerCase();
    return todaysTransactions.filter(tx => {
      const displayReceipt = getDisplayReceipt(tx);
      return displayReceipt.toLowerCase().includes(s) || (tx.client_name?.toLowerCase().includes(s)) || (tx.clientName?.toLowerCase().includes(s)) || String(tx.id).includes(s);
    });
  }, [todaysTransactions, searchTerm]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const goToPage = (page: number) => setCurrentPage(Math.min(totalPages, Math.max(1, page)));

  const txItems = useMemo(() => {
    if (!selectedTransaction?.items) return [];
    if (typeof selectedTransaction.items === 'string') {
      try { return JSON.parse(selectedTransaction.items); } catch(e) { return []; }
    }
    return selectedTransaction.items;
  }, [selectedTransaction]);

  if (showCierreFinal) return <CierreFinalForm onClose={() => setShowCierreFinal(false)} tasaActual={state.exchangeRate} />;

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-[#F9F4E1]">
      <div className="min-h-full p-4 pb-8">
        <header className="bg-[#1E3A8A] text-white p-4 rounded-t-xl shadow-md text-center relative border-b-4 border-[#0284C7]">
          <div className="absolute left-4 top-4 bg-amber-500 text-[10px] font-bold px-2 py-1 rounded text-slate-900">{terminalName}</div>
          <h1 className="text-lg md:text-xl font-black tracking-wider uppercase">MasterPOS - Control de Caja</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <p className="text-[10px] text-blue-200 font-mono flex items-center gap-1"><Clock size={10} /> {new Date().toLocaleDateString('es-VE')} • {new Date().toLocaleTimeString('es-VE')}</p>
          </div>
        </header>

        <section className="bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-x border-slate-200 shadow-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Tasa BCV Actual:</span>
            <span className="text-base font-mono font-bold text-slate-900">{formatBsNumber(state.exchangeRate)} / $</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Estado Actual:</span>
            <span className={cn("text-sm font-mono font-bold px-3 py-1 rounded-full inline-block", isClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{isClosed ? 'CAJA CERRADA' : 'CAJA ABIERTA'}</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Total en Caja (Sistema):</span>
            <span className="text-base font-mono font-bold text-blue-700">{!isClosed ? formatBs(totalEnCaja) : '—'}</span>
            {!isClosed && <p className="text-[10px] text-slate-500">≈ {formatUsd(totalEnCajaUSD)}</p>}
          </div>
        </section>

        {!isClosed && (
          <div className="bg-white border-x border-slate-200 px-6 py-2 flex justify-between items-center gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <Receipt size={14} className="text-blue-600" />
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase">Recibo Inicial</p>
                  <p className="text-xs font-mono font-bold text-slate-900">#{receiptRange.first}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <Hash size={14} className="text-emerald-600" />
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase">Último Recibo</p>
                  <p className="text-xs font-mono font-bold text-slate-900">#{receiptRange.last}</p>
                </div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 italic">
              * Correlativos aislados por terminal
            </div>
          </div>
        )}

        {isClosed ? (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md">
            <h2 className="text-sm font-black uppercase mb-4 text-[#1E3A8A] flex items-center gap-2"><Banknote size={14} /> APERTURA DE CAJA</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="text-[9px] font-bold uppercase block mb-1 text-slate-500">Apertura BS</label><Input type="number" step="0.01" value={openAmountBs} onChange={(e) => setOpenAmountBs(e.target.value)} className="font-bold h-8 text-sm" placeholder="0.00" /></div>
              <div><label className="text-[9px] font-bold uppercase block mb-1 text-slate-500">Apertura USD</label><Input type="number" step="0.01" value={openAmountUsd} onChange={(e) => setOpenAmountUsd(e.target.value)} className="font-bold h-8 text-sm" placeholder="0.00" /></div>
              <div className="flex items-end"><Button onClick={handleOpenCash} disabled={isOpeningCash} className="w-full bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-8 text-xs">{isOpeningCash ? 'ABRIENDO...' : 'ABRIR CAJA'}</Button></div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md flex gap-3 flex-wrap justify-center">
            <Button onClick={() => setShowCierreFinal(true)} className="bg-[#1E3A8A] hover:bg-[#2c3e50] text-white font-black py-4 px-6 text-sm"><BarChart3 size={16} className="mr-2" /> CIERRE FINAL</Button>
            <Button onClick={() => setShowCambioTasaModal(true)} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm"><Percent size={16} className="mr-2" /> CAMBIAR TASA</Button>
            <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm"><RefreshCw size={16} className={cn("mr-2", isRefreshing && "animate-spin")} /> {isRefreshing ? 'ACTUALIZANDO...' : 'REFRESCAR'}</Button>
          </div>
        )}

        {!isClosed && (
          <>
            <div className="mt-6">
              <h3 className="text-xs font-black uppercase mb-3 flex items-center gap-2 text-[#1E3A8A]"><Vault size={12} /> Ventas del Período Actual</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead><tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider"><th className="p-2">MÉTODO DE PAGO</th><th className="p-2 text-right">TOTAL (Bs)</th><th className="p-2 text-right">TOTAL (USD)</th></tr></thead>
                  <tbody className="divide-y divide-slate-200">
                    {paymentMethods.map(({ id, label, icon: Icon, isUsd }) => (
                      <tr key={id} className="hover:bg-slate-50"><td className="p-2"><div className="flex items-center gap-2"><Icon size={12} className="text-[#1E3A8A]" /><span className="font-bold">{label}</span></div></td><td className="p-2 text-right font-mono font-bold">{!isUsd ? formatBs(salesBreakdown.totalsBs[id] || 0) : '—'}</td><td className="p-2 text-right font-mono font-bold">{isUsd ? formatUsd(salesBreakdown.totalsUsd[id] || 0) : '—'}</td></tr>
                    ))}
                    <tr className="bg-blue-50/30 font-bold"><td className="p-2">VENTAS A CRÉDITO</td><td className="p-2 text-right font-mono text-blue-700">{formatBs(totalCreditoBs)}</td><td className="p-2 text-right">—</td></tr>
                    <tr className="bg-red-50 text-red-700 font-bold"><td className="p-2">TOTAL DEVOLUCIONES</td><td className="p-2 text-right font-mono">{totalDevolucionesBs > 0 ? `-${formatBs(totalDevolucionesBs)}` : 'Bs. 0,00'}</td><td className="p-2 text-right">—</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-black uppercase flex items-center gap-2 text-[#1E3A8A]"><Receipt size={12} /> Transacciones del Día</h3><Input placeholder="Buscar recibo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-7 text-[10px] w-40 border-slate-200" /></div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider">
                      <th className="p-2"># RECIBO</th>
                      <th className="p-2">HORA</th>
                      <th className="p-2">CLIENTE</th>
                      <th className="p-2 text-center">TIPO</th>
                      <th className="p-2 text-center">MÉTODO</th>
                      <th className="p-2 text-right">TOTAL (Bs)</th>
                      <th className="p-2 text-right">TOTAL (USD)</th>
                      <th className="p-2 text-center">VER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedTransactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className={cn("p-2 font-mono font-bold", t.type === 'devolucion' ? "text-red-600" : "text-slate-700")}>
                          {getDisplayReceipt(t)}
                        </td>
                        <td className="p-2 font-mono">{new Date(t.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-2 truncate max-w-[150px]">{t.client_name || t.clientName || 'Cliente Final'}</td>
                        <td className="p-2 text-center"><span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full", getTransactionColor(t.type))}>{getTransactionTypeLabel(t.type)}</span></td>
                        <td className="p-2 text-center font-bold">{getPaymentMethodLabel(t)}</td>
                        <td className="p-2 text-right font-bold">{formatBs(getBsPaid(t))}</td>
                        <td className="p-2 text-right font-bold text-cyan-700">
                          {getUsdPaid(t) > 0 ? formatUsd(getUsdPaid(t)) : '—'}
                        </td>
                        <td className="p-2 text-center"><button onClick={() => { setSelectedTransaction(t); setShowDetailModal(true); }} className="p-1 hover:bg-primary/20 rounded-lg"><Eye size={14} className="text-[#1E3A8A]" /></button></td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-black/40 italic">No hay transacciones registradas</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {totalPages > 1 && <div className="p-3 border-t flex justify-between"><Button variant="outline" size="sm" onClick={() => goToPage(currentPage-1)} disabled={currentPage===1} className="h-6 text-[9px]">Anterior</Button><Button variant="outline" size="sm" onClick={() => goToPage(currentPage+1)} disabled={currentPage===totalPages} className="h-6 text-[9px]">Siguiente</Button></div>}
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle de Transacción {selectedTransaction ? getDisplayReceipt(selectedTransaction) : ''}</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white sticky top-0 z-10 flex justify-between items-center"><h3 className="text-lg font-black">Detalle de Transacción #{getDisplayReceipt(selectedTransaction)}</h3><button onClick={() => setShowDetailModal(false)}><X size={18} /></button></div>
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Fecha</label><p className="font-bold">{new Date(selectedTransaction.date).toLocaleString('es-VE')}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Tipo</label><p className={cn("font-bold", getTransactionColor(selectedTransaction.type))}>{getTransactionTypeLabel(selectedTransaction.type)}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Cliente</label><p className="font-bold">{selectedTransaction.client_name || selectedTransaction.clientName || 'Cliente Final'}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Método</label><p className="font-bold">{getPaymentMethodLabel(selectedTransaction)}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Total Bs</label><p className="text-lg font-black text-primary">{formatBs(getBsPaid(selectedTransaction))}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Total USD</label><p className="text-lg font-black text-cyan-700">{getUsdPaid(selectedTransaction) > 0 ? formatUsd(getUsdPaid(selectedTransaction)) : '—'}</p></div>
                </div>

                {txItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black uppercase text-black/60 flex items-center gap-2 mb-3">
                      <Package size={14} className="text-primary" /> 
                      {selectedTransaction.type === 'devolucion' ? 'Productos Devueltos' : 'Productos Vendidos'}
                    </h4>
                    <div className="border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-[#E8E8E8]"><tr className="text-[10px] font-black uppercase"><th className="text-left p-3">Producto</th><th className="text-center p-3">Cant.</th><th className="text-center p-3">U.M.</th><th className="text-right p-3">Total Bs</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {txItems.map((item: any, idx: number) => (
                            <tr key={idx} className="text-xs">
                              <td className="p-3 font-bold">{item.name}</td>
                              <td className="p-3 text-center">{item.qty}</td>
                              <td className="p-3 text-center text-[10px] text-black/60">{item.unitMeasure || 'UNID'}</td>
                              <td className="p-3 text-right font-black">{formatBs(item.priceBs * item.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-[#F5F5F5] p-3 border-t flex justify-end"><Button onClick={() => setShowDetailModal(false)} className="bg-primary text-black font-black h-8 text-xs">CERRAR</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showCambioTasaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"><h2 className="text-lg font-black mb-4">Cambiar Tasa BCV</h2><Input type="number" step="0.01" value={nuevaTasaInput} onChange={(e) => setNuevaTasaInput(e.target.value)} className="font-mono text-right" /><div className="flex gap-3 justify-end mt-4"><Button variant="ghost" onClick={() => setShowCambioTasaModal(false)}>Cancelar</Button><Button onClick={handleCambioTasa} disabled={isUpdatingRate} className="bg-primary text-black font-black">Actualizar</Button></div></div></div>
      )}
    </div>
  );
}
