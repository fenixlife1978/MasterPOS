"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  Vault, Banknote, Smartphone, Fingerprint, 
  Plane, DollarSign, CreditCard, Receipt, 
  BarChart3, Clock, Percent, Eye, Wifi, WifiOff, X,
  RefreshCw, Search, ChevronLeft, ChevronRight,
  ArrowLeftRight
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

// ✅ CORREGIDO: Manejar terminalId con guiones bajos correctamente
function extractTerminalIdFromSession(sessionId: string | null | undefined): string {
  if (!sessionId) return 'default';
  const lastIndex = sessionId.lastIndexOf('_');
  if (lastIndex !== -1) {
    return sessionId.substring(0, lastIndex);
  }
  return sessionId;
}

function formatReceipt(num?: number): string {
  return (num || 0).toString().padStart(8, '0');
}

export default function CashModule({ state }: CashModuleProps) {
  const { user } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const terminalName = user?.terminalId ? `Terminal ${user.terminalId}` : 'Terminal Principal';

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
          // ✅ CORREGIDO: Buscar en ambas propiedades posibles (camelCase y snake_case)
          const sid = tx.sessionId || tx.session_id;
          const txTerminal = extractTerminalIdFromSession(sid);
          if (txTerminal !== terminalId) return false;
          
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
  }, [terminalId, isClosed]);

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

  // Desglose EXACTO por método de pago
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
      
      if (Array.isArray(payments) && payments.length > 0) {
        for (const p of payments) {
          const method = p.method || 'efectivo_bs';
          const isUsd = method === 'usd_efectivo' || method === 'zelle';
          
          if (isUsd) {
            const usdAmount = p.usdAmount || p.amount || 0;
            totalsUsd[method] = (totalsUsd[method] || 0) + usdAmount;
          } else {
            const bsAmount = p.amount || 0;
            totalsBs[method] = (totalsBs[method] || 0) + bsAmount;
          }
        }
      } else {
        const method = tx.pay_method || tx.payMethod || 'efectivo_bs';
        const isUsd = method === 'usd_efectivo' || method === 'zelle';
        
        if (isUsd) {
          const usdAmount = tx.total_usd || tx.totalUsd || 0;
          totalsUsd[method] = (totalsUsd[method] || 0) + usdAmount;
        } else {
          const bsAmount = tx.total || 0;
          totalsBs[method] = (totalsBs[method] || 0) + bsAmount;
        }
      }
    }
    
    return { totalsBs, totalsUsd };
  }, [todaysTransactions]);

  const totalCreditoBs = useMemo(() => {
    return todaysTransactions
      .filter(t => t.type === 'credito')
      .reduce((sum, t) => sum + (t.total || 0), 0);
  }, [todaysTransactions]);

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

  const totalEnCaja = (reg?.openAmountBs || 0) + totalContadoBs;
  const totalEnCajaUSD = (reg?.openAmountUsd || 0) + totalContadoUsd;

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
    let hasBs = false;
    let hasUsd = false;
    
    let payments = tx.payments || [];
    if (typeof payments === 'string') {
      try { payments = JSON.parse(payments); } catch(e) { payments = []; }
    }
    
    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        if (p.method === 'usd_efectivo' || p.method === 'zelle') {
          hasUsd = true;
        } else {
          hasBs = true;
        }
      }
    } else {
      const method = tx.pay_method || tx.payMethod || '';
      if (method === 'usd_efectivo' || method === 'zelle') {
        hasUsd = true;
      } else {
        hasBs = true;
      }
    }
    
    if (hasBs && hasUsd) return 'MIXTO';
    if (hasUsd) {
      const method = tx.pay_method || tx.payMethod || '';
      return method === 'zelle' ? 'ZELLE' : 'EFECTIVO USD';
    }
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
      let totalUsd = 0;
      for (const p of payments) {
        if (p.method === 'usd_efectivo' || p.method === 'zelle') {
          totalUsd += p.usdAmount || p.amount || 0;
        }
      }
      return totalUsd;
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
      for (const p of payments) {
        if (p.method !== 'usd_efectivo' && p.method !== 'zelle') {
          totalBs += p.amount || 0;
        }
      }
      return totalBs;
    }
    const method = tx.pay_method || tx.payMethod || '';
    if (method !== 'usd_efectivo' && method !== 'zelle') {
      return tx.total || 0;
    }
    return 0;
  };

  const getDisplayReceipt = (tx: any): string => {
    if (tx.type === 'devolucion') {
      const directOriginalReceipt = tx.original_receipt_number || tx.originalReceiptNumber;
      if (directOriginalReceipt) return formatReceipt(directOriginalReceipt);
      const originalSaleId = tx.original_sale_id || tx.originalSaleId;
      if (originalSaleId) {
        const originalSale = todaysTransactions.find(t => t.id === originalSaleId);
        if (originalSale) return formatReceipt(originalSale.receipt_number || originalSale.receiptNumber);
      }
      const ownReceipt = tx.receipt_number || tx.receiptNumber;
      if (ownReceipt) return formatReceipt(ownReceipt);
      return `#${String(tx.id).slice(0, 8)}`;
    }
    const receipt = tx.receipt_number || tx.receiptNumber;
    return formatReceipt(receipt || parseInt(tx.id));
  };

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return todaysTransactions;
    const s = searchTerm.toLowerCase();
    return todaysTransactions.filter(tx => {
      const displayReceipt = getDisplayReceipt(tx);
      return displayReceipt.includes(s) || 
             (tx.client_name?.toLowerCase().includes(s)) || 
             (tx.clientName?.toLowerCase().includes(s)) ||
             String(tx.id).includes(s);
    });
  }, [todaysTransactions, searchTerm]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const goToPage = (page: number) => setCurrentPage(Math.min(totalPages, Math.max(1, page)));

  // ✅ Total de devoluciones del día
  const totalDevolucionesBs = useMemo(() => {
    return todaysTransactions
      .filter(t => t.type === 'devolucion')
      .reduce((sum, t) => sum + (t.total || 0), 0);
  }, [todaysTransactions]);

  if (showCierreFinal) {
    return <CierreFinalForm onClose={() => setShowCierreFinal(false)} tasaActual={state.exchangeRate} />;
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-[#F9F4E1]">
      <div className="min-h-full p-4 pb-8">
        <header className="bg-[#1E3A8A] text-white p-4 rounded-t-xl shadow-md text-center relative border-b-4 border-[#0284C7]">
          <div className="absolute left-4 top-4 bg-amber-500 text-[10px] font-bold px-2 py-1 rounded text-slate-900">
            {terminalName}
          </div>
          <h1 className="text-lg md:text-xl font-black tracking-wider uppercase">MasterPOS - Control de Caja</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <p className="text-[10px] text-blue-200 font-mono flex items-center gap-1">
              <Clock size={10} /> {new Date().toLocaleDateString('es-VE')} • {new Date().toLocaleTimeString('es-VE')}
            </p>
            {todaysTransactions.length > 0 && (
              <span className="flex items-center gap-1 text-[8px] bg-green-500/20 px-2 py-0.5 rounded-full text-green-300">
                <Wifi size={8} /> {todaysTransactions.length} TX
              </span>
            )}
          </div>
        </header>

        <section className="bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-x border-slate-200 shadow-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Tasa BCV Actual:</span>
            <span className="text-base font-mono font-bold text-slate-900">{formatBsNumber(state.exchangeRate)} / $</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Estado Actual:</span>
            <span className={cn("text-sm font-mono font-bold px-3 py-1 rounded-full inline-block", isClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
              {isClosed ? 'CAJA CERRADA' : 'CAJA ABIERTA'}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Total en Caja (Sistema):</span>
            <span className="text-base font-mono font-bold text-blue-700">{!isClosed ? formatBs(totalEnCaja) : '—'}</span>
            {!isClosed && (
              <>
                <p className="text-[10px] text-slate-500">≈ {formatUsd(totalEnCajaUSD)}</p>
                <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex flex-col gap-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Fondo de Apertura:</p>
                  <p className="text-[9px] font-bold text-slate-600">
                    {formatBs(reg?.openAmountBs || 0)} + {formatUsd(reg?.openAmountUsd || 0)}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {isClosed ? (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md">
            <h2 className="text-sm font-black uppercase mb-4 text-[#1E3A8A] flex items-center gap-2"><Banknote size={14} /> APERTURA DE CAJA</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] font-bold uppercase block mb-1 text-slate-500">Apertura BS (Efectivo)</label>
                <Input type="number" step="0.01" value={openAmountBs} onChange={(e) => setOpenAmountBs(e.target.value)} className="font-bold h-8 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase block mb-1 text-slate-500">Apertura USD (Efectivo)</label>
                <Input type="number" step="0.01" value={openAmountUsd} onChange={(e) => setOpenAmountUsd(e.target.value)} className="font-bold h-8 text-sm" placeholder="0.00" />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleOpenCash} disabled={isOpeningCash} className="w-full bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-8 text-xs">
                  <Banknote size={12} className="mr-1" /> {isOpeningCash ? 'ABRIENDO...' : 'ABRIR CAJA'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-6 shadow-md">
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => setShowCierreFinal(true)} className="bg-[#1E3A8A] hover:bg-[#2c3e50] text-white font-black py-4 px-6 text-sm">
                <BarChart3 size={16} className="mr-2" /> CIERRE FINAL
              </Button>
              <Button onClick={() => setShowCambioTasaModal(true)} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm">
                <Percent size={16} className="mr-2" /> CAMBIAR TASA
              </Button>
              <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" className="border-[#9E9E9E] font-black py-4 px-6 text-sm">
                <RefreshCw size={16} className={cn("mr-2", isRefreshing && "animate-spin")} />
                {isRefreshing ? 'ACTUALIZANDO...' : 'REFRESCAR'}
              </Button>
            </div>
          </div>
        )}

        {!isClosed && (
          <>
            <div className="mt-6">
              <h3 className="text-xs font-black uppercase mb-3 flex items-center gap-2 text-[#1E3A8A]">
                <Vault size={12} /> Ventas del Período Actual
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider">
                      <th className="p-2">MÉTODO DE PAGO</th>
                      <th className="p-2 text-right">TOTAL RECIBIDO (Bs)</th>
                      <th className="p-2 text-right">TOTAL RECIBIDO (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[10px]">
                    {paymentMethods.map(({ id, label, icon: Icon, isUsd }) => (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="p-2"><div className="flex items-center gap-2"><Icon size={12} className="text-[#1E3A8A]" /><span className="font-bold">{label}</span></div></td>
                        <td className="p-2 text-right font-mono font-bold">{!isUsd ? formatBs(salesBreakdown.totalsBs[id] || 0) : '—'}</td>
                        <td className="p-2 text-right font-mono font-bold">{isUsd ? formatUsd(salesBreakdown.totalsUsd[id] || 0) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-blue-50/30">
                      <td className="p-2 font-bold text-blue-700"><div className="flex items-center gap-2"><CreditCard size={12} className="text-blue-700" /> VENTAS A CRÉDITO</div></td>
                      <td className="p-2 text-right font-mono font-bold text-blue-700">{formatBs(totalCreditoBs)}</td>
                      <td className="p-2 text-right font-mono font-bold text-blue-700">—</td>
                    </tr>
                    <tr className="bg-[#F0F0F0] font-black">
                      <td className="p-2">TOTAL VENTAS CONTADO / INGRESOS</td>
                      <td className="p-2 text-right font-mono">{formatBs(totalContadoBs)}</td>
                      <td className="p-2 text-right font-mono">—</td>
                    </tr>
                    {/* ✅ LÍNEA DE DEVOLUCIONES SOLICITADA */}
                    {totalDevolucionesBs > 0 && (
                      <tr className="bg-red-50 font-black text-red-700">
                        <td className="p-2"><div className="flex items-center gap-2"><ArrowLeftRight size={12} /> TOTAL DEVOLUCIONES (Bs)</div></td>
                        <td className="p-2 text-right font-mono">-{formatBs(totalDevolucionesBs)}</td>
                        <td className="p-2 text-right font-mono">—</td>
                      </tr>
                    )}
                    {totalContadoUsd > 0 && (
                      <tr className="bg-[#F0F0F0] font-black text-cyan-700">
                        <td className="p-2">TOTAL VENTAS EFECTIVO USD</td>
                        <td className="p-2 text-right font-mono">—</td>
                        <td className="p-2 text-right font-mono">{formatUsd(totalContadoUsd)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase flex items-center gap-2 text-[#1E3A8A]">
                  <Receipt size={12} /> Transacciones del Día
                  <span className="bg-[#1E3A8A]/10 text-[#1E3A8A] px-2 py-0.5 rounded text-[9px] font-black">
                    {todaysTransactions.length} transacciones
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Buscar recibo o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-7 pl-7 pr-2 text-[10px] w-40 border-slate-200" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider">
                        <th className="p-2"># RECIBO</th>
                        <th className="p-2">HORA</th>
                        <th className="p-2">CLIENTE</th>
                        <th className="p-2 text-center">TIPO</th>
                        <th className="p-2 text-center">MÉTODO</th>
                        <th className="p-2 text-right">TOTAL (Bs)</th>
                        <th className="p-2 text-right">USD</th>
                        <th className="p-2 text-center">VER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[10px]">
                      {isLoading ? (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-400 italic">Cargando transacciones...</td></tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-400 italic">No hay transacciones registradas hoy</td></tr>
                      ) : (
                        paginatedTransactions.map((t: any) => {
                          const isReturn = t.type === 'devolucion';
                          const displayReceipt = getDisplayReceipt(t);
                          const bsPaid = getBsPaid(t);
                          const usdPaid = getUsdPaid(t);
                          const methodLabel = getPaymentMethodLabel(t);
                          return (
                            <tr key={t.id} className={cn("hover:bg-slate-50", isReturn && "bg-red-50/30")}>
                              <td className={cn("p-2 font-mono font-bold", isReturn ? "text-red-600" : "text-slate-700")}>
                                {displayReceipt}
                                {isReturn && <span className="text-[8px] text-red-500 ml-1">(DEV)</span>}
                              </td>
                              <td className="p-2 text-xs font-mono text-slate-600">{new Date(t.date).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="p-2 text-xs font-medium text-slate-700 max-w-[150px] truncate">{t.client_name || t.clientName || 'Cliente Final'}</td>
                              <td className="p-2 text-center"><span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", getTransactionColor(t.type))}>{getTransactionTypeLabel(t.type)}</span></td>
                              <td className="p-2 text-center text-[10px] font-medium text-slate-600">{methodLabel}</td>
                              <td className={cn("p-2 text-right font-mono font-bold", isReturn ? "text-red-600" : "text-slate-900")}>{isReturn ? '-' : ''}{formatBs(bsPaid)}</td>
                              <td className="p-2 text-right font-mono font-bold text-cyan-700">{usdPaid > 0 ? formatUsd(usdPaid) : '—'}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => { setSelectedTransaction(t); setShowDetailModal(true); }} className="p-1 hover:bg-primary/20 rounded-lg transition-colors"><Eye size={14} className="text-[#1E3A8A]" /></button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-[#F0F0F0] font-black">
                      <tr>
                        <td colSpan={5} className="p-2 text-right">TOTALES</td>
                        <td className="p-2 text-right font-mono">{formatBs(filteredTransactions.reduce((sum, t) => sum + (t.type === 'devolucion' ? -getBsPaid(t) : getBsPaid(t)), 0))}</td>
                        <td className="p-2 text-right font-mono text-cyan-700">{formatUsd(filteredTransactions.reduce((sum, t) => sum + getUsdPaid(t), 0))}</td>
                        <td className="p-2 text-center">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-between items-center p-3 border-t bg-gray-50">
                    <span className="text-[9px] text-slate-500">Página {currentPage} de {totalPages}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => goToPage(currentPage-1)} disabled={currentPage===1} className="h-6 px-2 text-[9px]">Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => goToPage(currentPage+1)} disabled={currentPage===totalPages} className="h-6 px-2 text-[9px]">Siguiente</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {showCambioTasaModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-lg font-black mb-4">Cambiar Tasa BCV</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold block mb-1">Nueva Tasa (Bs/USD)</label>
                  <Input type="number" step="0.01" value={nuevaTasaInput} onChange={(e) => setNuevaTasaInput(e.target.value)} className="font-mono text-right" />
                  <p className="text-xs text-gray-500 mt-1">Tasa actual: {formatBsNumber(state.exchangeRate)}</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setShowCambioTasaModal(false)} className="text-sm">Cancelar</Button>
                  <Button onClick={handleCambioTasa} disabled={isUpdatingRate} className="bg-primary text-black font-black">{isUpdatingRate ? "Actualizando..." : "Cambiar Tasa"}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>Detalle de la Transacción</DialogTitle></DialogHeader>
          {selectedTransaction && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white sticky top-0 z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Receipt size={18} className="text-primary" /><h3 className="text-lg font-black">Detalle de Transacción</h3></div>
                  <button onClick={() => setShowDetailModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
                <p className="text-xs text-white/60 mt-1">Recibo {getDisplayReceipt(selectedTransaction)}</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Fecha</label><p className="font-bold text-black">{new Date(selectedTransaction.date).toLocaleString('es-VE')}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Tipo</label><p className={cn("font-bold", getTransactionColor(selectedTransaction.type))}>{getTransactionTypeLabel(selectedTransaction.type)}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Cliente</label><p className="font-bold text-black">{selectedTransaction.client_name || selectedTransaction.clientName || 'Cliente Final'}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Método</label><p className="font-bold text-black">{getPaymentMethodLabel(selectedTransaction)}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Total Bs</label><p className="text-lg font-black text-primary">{formatBs(getBsPaid(selectedTransaction))}</p></div>
                  <div><label className="text-[9px] font-black text-black/60 uppercase">Total USD</label><p className="text-lg font-black text-cyan-700">{getUsdPaid(selectedTransaction) > 0 ? formatUsd(getUsdPaid(selectedTransaction)) : '—'}</p></div>
                </div>
              </div>
              <div className="bg-[#F5F5F5] p-3 border-t flex justify-end">
                <Button onClick={() => setShowDetailModal(false)} className="bg-primary text-black font-black h-8 text-xs">CERRAR</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
