"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Vault, Lock, Unlock, FileText, Share2, Printer, CreditCard, Banknote, Smartphone, Fingerprint, Plane, DollarSign, History, Download, CheckCircle, AlertCircle, Calculator, X, Archive } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import InvoiceReminderModal from '@/components/ui/InvoiceReminderModal';

interface CashModuleProps {
  state: ReturnType<typeof usePOSState>;
}

interface CashCount {
  method: string;
  label: string;
  icon: any;
  systemAmount: number;
  actualAmount: number;
  actualUsdAmount?: number;
  difference: number;
}

interface CloseHistory {
  id: string;
  fecha: string;
  fechaCierre: string;
  apertura: {
    montoBs: number;
    montoUsd: number;
    tasaUsd: number;
    totalAperturaBs: number;
  };
  ventas: {
    totalContado: number;
    totalCredito: number;
    totalEnCaja: number;
    porMetodo: Record<string, number>;
  };
  cuadre: Array<{
    metodo: string;
    sistema: number;
    real: number;
    diferencia: number;
    usdReal: number;
  }>;
  totales: {
    sistema: number;
    real: number;
    diferencia: number;
    estado: string;
  };
}

export default function CashModule({ state }: CashModuleProps) {
  const [openAmountBs, setOpenAmountBs] = useState('0.00');
  const [openAmountUsd, setOpenAmountUsd] = useState('0.00');
  const [openRate, setOpenRate] = useState(state.exchangeRate.toString());
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [cashCounts, setCashCounts] = useState<CashCount[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [closeHistory, setCloseHistory] = useState<CloseHistory[]>([]);
  const [userRole, setUserRole] = useState<string>('cashier');

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;
  
  const [savedOpenAmountBs, setSavedOpenAmountBs] = useState('0.00');
  const [savedOpenAmountUsd, setSavedOpenAmountUsd] = useState('0.00');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRole(user.role || 'cashier');
      } catch (e) {}
    }
  }, []);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const savedBs = localStorage.getItem('last_open_amount_bs');
    const savedUsd = localStorage.getItem('last_open_amount_usd');
    if (savedBs) setSavedOpenAmountBs(savedBs);
    if (savedUsd) setSavedOpenAmountUsd(savedUsd);
  }, []);

  const paymentMethods = [
    { id: 'efectivo_bs', label: 'Efectivo BS', icon: Banknote, order: 1, isUsd: false },
    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard, order: 2, isUsd: false },
    { id: 'usd_efectivo', label: 'USD Efectivo', icon: DollarSign, order: 3, isUsd: true },
    { id: 'biopago', label: 'Biopago', icon: Fingerprint, order: 4, isUsd: false },
    { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone, order: 5, isUsd: false },
    { id: 'zelle', label: 'Zelle', icon: Plane, order: 6, isUsd: false },
  ];

  const salesByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.id] = 0);
    
    if (reg && reg.txs) {
      reg.txs.forEach(t => {
        if (t.type === 'contado' || t.type === 'cobro_deuda') {
          const method = t.payMethod || 'efectivo_bs';
          if (totals[method] !== undefined) {
            totals[method] += t.total;
          } else {
            totals[method] = (totals[method] || 0) + t.total;
          }
        }
      });
    }
    return totals;
  }, [reg]);

  const totalContado = reg?.txs?.filter(t => t.type === 'contado' || t.type === 'cobro_deuda').reduce((s,t) => s + t.total, 0) || 0;
  const totalCredito = reg?.txs?.filter(t => t.type === 'credito').reduce((s,t) => s + t.total, 0) || 0;
  
  const openBsNum = parseFloat(savedOpenAmountBs) || 0;
  const openUsdNum = parseFloat(savedOpenAmountUsd) || 0;
  const openUsdConverted = openUsdNum * state.exchangeRate;
  const totalEnCaja = openBsNum + openUsdConverted + totalContado;
  const totalEnCajaUSD = totalEnCaja / state.exchangeRate;

  useEffect(() => {
    if (showHistoryModal) {
      const history: CloseHistory[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cierre_caja_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            history.push({ ...data, id: key });
          } catch (e) {}
        }
      }
      setCloseHistory(history.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
    }
  }, [showHistoryModal]);

  useEffect(() => {
    if (showCloseDialog && cashCounts.length === 0) {
      const initialCounts: CashCount[] = paymentMethods.map(method => ({
        method: method.id,
        label: method.label,
        icon: method.icon,
        systemAmount: salesByMethod[method.id] || 0,
        actualAmount: 0,
        actualUsdAmount: method.isUsd ? 0 : undefined,
        difference: 0
      }));
      setCashCounts(initialCounts);
    }
  }, [showCloseDialog, salesByMethod]);

  useEffect(() => {
    const updatedCounts = cashCounts.map(count => ({
      ...count,
      difference: count.actualAmount - count.systemAmount
    }));
    setCashCounts(updatedCounts);
  }, [cashCounts.map(c => c.actualAmount).join(',')]);

  const handleUsdAmountChange = (methodId: string, usdValue: number) => {
    setCashCounts(prev => prev.map(c => {
      if (c.method === methodId) {
        const actualAmount = usdValue * state.exchangeRate;
        return { ...c, actualUsdAmount: usdValue, actualAmount };
      }
      return c;
    }));
  };

  const handleActualAmountChange = (methodId: string, value: number) => {
    setCashCounts(prev => prev.map(c => 
      c.method === methodId ? { ...c, actualAmount: value } : c
    ));
  };

  const totalSystemAmount = cashCounts.reduce((sum, c) => sum + c.systemAmount, 0);
  const totalActualAmount = cashCounts.reduce((sum, c) => sum + c.actualAmount, 0);
  const totalDifference = totalActualAmount - totalSystemAmount;
  const isBalanced = Math.abs(totalDifference) < 0.01;
  const hasSurplus = totalDifference > 0;

  const handleOpenCash = () => {
    const bsAmount = parseFloat(openAmountBs) || 0;
    const usdAmount = parseFloat(openAmountUsd) || 0;
    const rate = parseFloat(openRate) || state.exchangeRate;
    const totalOpenAmount = bsAmount + (usdAmount * rate);
    
    localStorage.setItem('last_open_amount_bs', bsAmount.toString());
    localStorage.setItem('last_open_amount_usd', usdAmount.toString());
    setSavedOpenAmountBs(bsAmount.toString());
    setSavedOpenAmountUsd(usdAmount.toString());
    
    if (rate !== state.exchangeRate) {
      state.setExchangeRate(rate);
    }
    state.openCashRegister(totalOpenAmount);
  };

  const handleCloseCash = () => {
    setShowCloseDialog(true);
  };

  const handleConfirmClose = () => {
    const openBs = parseFloat(savedOpenAmountBs) || 0;
    const openUsd = parseFloat(savedOpenAmountUsd) || 0;
    const closeReport = {
      id: `cierre_${Date.now()}`,
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString(),
      apertura: {
        montoBs: openBs,
        montoUsd: openUsd,
        tasaUsd: state.exchangeRate,
        totalAperturaBs: openBs + (openUsd * state.exchangeRate)
      },
      ventas: {
        totalContado: totalContado,
        totalCredito: totalCredito,
        totalEnCaja: totalEnCaja,
        porMetodo: salesByMethod
      },
      cuadre: cashCounts.map(c => ({
        metodo: c.label,
        sistema: c.systemAmount,
        real: c.actualAmount,
        diferencia: c.difference,
        usdReal: c.actualUsdAmount || 0
      })),
      totales: {
        sistema: totalSystemAmount,
        real: totalActualAmount,
        diferencia: totalDifference,
        estado: isBalanced ? "CONCILIADO" : (hasSurplus ? "SOBRANTE" : "FALTANTE")
      }
    };
    localStorage.setItem(`cierre_caja_${Date.now()}`, JSON.stringify(closeReport));
    state.closeCashRegister();
    setShowCloseDialog(false);
    setCashCounts([]);
  };

  const exportHistoryToPDF = (history: CloseHistory) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html><head><title>Reporte de Cierre - MasterPOS</title><style>
        body{font-family:Arial;margin:40px}h1{color:#D4A017;text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background-color:#D4A017;color:black}
        .footer{margin-top:30px;text-align:center;font-size:12px;color:#666}
      </style></head><body>
        <h1>MasterPOS - Reporte de Cierre</h1>
        <p><strong>Fecha:</strong> ${new Date(history.fecha).toLocaleString()}</p>
        <p><strong>Apertura BS:</strong> Bs ${history.apertura.montoBs.toFixed(2)}</p>
        <p><strong>Apertura USD:</strong> $${history.apertura.montoUsd.toFixed(2)}</p>
        <p><strong>Tasa BCV:</strong> Bs ${history.apertura.tasaUsd.toFixed(2)}</p>
        <p><strong>Total Ventas:</strong> Bs ${history.ventas.totalContado.toFixed(2)}</p>
        <div class="footer">Reporte generado por MasterPOS</div>
      </body></html>
    `;
    printWindow?.document.write(content);
    printWindow?.document.close();
    printWindow?.print();
  };

  const handleExport = () => {
    if (!reg) return;
    const csvContent = ['Tipo,Monto BS']
      .concat(Object.entries(salesByMethod).map(([method, amount]) => `${method},${amount}`))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_caja_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html><head><title>Reporte de Caja - MasterPOS</title><style>
        body{font-family:Arial;margin:40px}h1{color:#D4A017;text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background-color:#D4A017;color:black}
        .footer{margin-top:30px;text-align:center;font-size:12px;color:#666}
      </style></head><body>
        <h1>MasterPOS - Reporte de Caja</h1>
        <p>Fecha: ${new Date().toLocaleString()}</p>
        <div class="footer">Reporte generado por MasterPOS</div>
      </body></html>
    `;
    printWindow?.document.write(content);
    printWindow?.document.close();
    printWindow?.print();
  };

  return (
    <>
      <InvoiceReminderModal />
      <div className="p-6 h-full overflow-y-auto scrollbar-thin">
        <h2 className="text-2xl font-headline font-black text-black mb-6">Gestión de Bóveda</h2>

        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md mb-6">
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow className="border-b border-[#9E9E9E]">
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Apertura (BS)</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Apertura (USD)</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Total en Caja</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Ventas Crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-b border-[#9E9E9E]">
                <TableCell className="py-4">
                  <span className={cn("px-3 py-1 rounded-full text-[11px] font-bold", isClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                    {isClosed ? 'CERRADA' : 'ABIERTA'}
                  </span>
                </TableCell>
                <TableCell className="font-bold text-black">{!isClosed ? `BS ${parseFloat(savedOpenAmountBs).toFixed(2)}` : '—'}</TableCell>
                <TableCell className="font-bold text-black">{!isClosed ? `$${parseFloat(savedOpenAmountUsd).toFixed(2)}` : '—'}</TableCell>
                <TableCell className="font-bold text-black">{!isClosed ? `BS ${totalEnCaja.toFixed(2)} (≈ $${totalEnCajaUSD.toFixed(2)})` : '—'}</TableCell>
                <TableCell className="font-bold text-black">{!isClosed ? `BS ${totalCredito.toFixed(2)}` : '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {isClosed ? (
          <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-1">Apertura en BS</label><Input type="number" step="0.01" value={openAmountBs} onChange={(e) => setOpenAmountBs(e.target.value)} className="bg-white border-[#9E9E9E] text-black font-bold" placeholder="0.00" /></div>
              <div><label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-1">Apertura en USD</label><Input type="number" step="0.01" value={openAmountUsd} onChange={(e) => setOpenAmountUsd(e.target.value)} className="bg-white border-[#9E9E9E] text-black font-bold" placeholder="0.00" /></div>
              <div><label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-1">Tasa BCV (BS/USD)</label><Input type="number" step="0.01" value={openRate} onChange={(e) => setOpenRate(e.target.value)} className="bg-white border-[#9E9E9E] text-black font-bold" /></div>
              <div className="flex items-end"><Button onClick={handleOpenCash} className="bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-10 px-6 w-full"><Unlock size={16} className="mr-2" /> ABRIR CAJA</Button></div>
            </div>
            <div className="mt-3 text-center"><p className="text-[11px] text-black/60">Total apertura en Bs: <span className="font-bold text-black">BS {(parseFloat(openAmountBs) + (parseFloat(openAmountUsd) * parseFloat(openRate))).toFixed(2)}</span></p></div>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap mb-6">
            <Button variant="destructive" className="font-black h-9 px-6" onClick={handleCloseCash}><Lock size={16} className="mr-2" /> CERRAR CAJA</Button>
            <Button className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-[#9E9E9E] font-black h-9 px-4" onClick={handleExport}><Download size={16} className="mr-2" /> EXPORTAR</Button>
            <Button className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-[#9E9E9E] font-black h-9 px-4" onClick={handlePrint}><Printer size={16} className="mr-2" /> IMPRIMIR</Button>
            <Button onClick={() => setShowHistoryModal(true)} className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-[#9E9E9E] font-black h-9 px-4"><Archive size={16} className="mr-2" /> HISTORIAL DE CIERRES</Button>
          </div>
        )}

        {!isClosed && (
          <div className="mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 flex items-center gap-2"><Vault size={14} className="text-[#D4A017]" /> Ventas por Método de Pago</h3>
            <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
              <Table>
                <TableHeader className="bg-[#E8E8E8]"><TableRow className="border-b border-[#9E9E9E]"><TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Método</TableHead><TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Total (BS)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paymentMethods.map(({ id, label, icon: Icon }) => {
                    const total = salesByMethod[id] || 0;
                    return (<TableRow key={id} className="border-b border-[#9E9E9E]"><TableCell className="py-3"><div className="flex items-center gap-2"><Icon size={12} className="text-[#D4A017]" /><span className="text-xs font-bold text-black">{label}</span></div></TableCell><TableCell className="text-right font-bold text-black">BS {total.toFixed(2)}</TableCell></TableRow>);
                  })}
                  <TableRow className="bg-[#F0F0F0]"><TableCell className="font-bold text-black">TOTAL VENTAS</TableCell><TableCell className="text-right font-black text-black">BS {totalContado.toFixed(2)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 flex items-center gap-2 mt-6"><History size={14} className="text-[#D4A017]" /> Historial de Transacciones</h3>
        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#E8E8E8]">
                <TableRow className="border-b border-[#9E9E9E]">
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Hora</TableHead>
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Tipo</TableHead>
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Método</TableHead>
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Monto BS</TableHead>
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Cliente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reg?.txs?.map((t) => (
                  <TableRow key={t.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                    <TableCell className="text-xs text-black/60">{new Date(t.date).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", t.type === "contado" ? "bg-green-100 text-green-700" : t.type === "credito" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}>{t.type === "contado" ? "CONTADO" : t.type === "credito" ? "CRÉDITO" : "COBRO"}</span></TableCell>
                    <TableCell className="text-xs font-bold uppercase text-black/60">{paymentMethods.find(m => m.id === t.payMethod)?.label || t.payMethod || "EFECTIVO"}</TableCell>
                    <TableCell className="font-bold text-sm text-black">BS {t.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium text-xs text-black/60">{t.clientName || "CLIENTE FINAL"}</TableCell>
                  </TableRow>
                ))}
                {(!reg || reg.txs?.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-black/50 italic">Sin movimientos registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-5xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only"><DialogTitle>Cierre de Caja - Cuadre</DialogTitle></DialogHeader>
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Calculator size={24} className="text-primary" /><h3 className="text-xl font-headline font-black">Cierre de Caja - Cuadre</h3></div><button onClick={() => setShowCloseDialog(false)} className="text-white/60 hover:text-white"><X size={20} /></button></div>
                <p className="text-white/60 text-sm mt-1">Complete los montos reales contados en cada método de pago</p>
              </div>
              <div className="p-6">
                <div className="bg-[#F5F5F5] rounded-lg p-4 mb-6"><h4 className="text-xs font-black text-black uppercase tracking-widest mb-3">Información de Apertura</h4><div className="grid grid-cols-3 gap-4"><div><p className="text-[10px] text-black/60">Apertura (BS)</p><p className="text-lg font-black text-black">BS {parseFloat(savedOpenAmountBs).toFixed(2)}</p></div><div><p className="text-[10px] text-black/60">Apertura (USD)</p><p className="text-lg font-black text-black">${parseFloat(savedOpenAmountUsd).toFixed(2)}</p></div><div><p className="text-[10px] text-black/60">Tasa BCV</p><p className="text-lg font-black text-black">BS {state.exchangeRate.toFixed(2)} / USD</p></div></div></div>
                <div className="mb-6"><h4 className="text-xs font-black text-black uppercase tracking-widest mb-3">Cuadre por Método de Pago</h4>
                  <Table><TableHeader className="bg-[#E8E8E8]"><TableRow className="border-b border-[#9E9E9E]"><TableHead className="text-[10px] font-black text-black uppercase">Método</TableHead><TableHead className="text-[10px] font-black text-black uppercase text-right">Sistema (BS)</TableHead><TableHead className="text-[10px] font-black text-black uppercase text-right">Real Contado</TableHead><TableHead className="text-[10px] font-black text-black uppercase text-right">Diferencia</TableHead></TableRow></TableHeader>
                  <TableBody>{cashCounts.map((count) => { const Icon = count.icon; const isUsdMethod = count.method === 'usd_efectivo'; return (<TableRow key={count.method} className="border-b border-[#9E9E9E]"><TableCell className="py-3"><div className="flex items-center gap-2"><Icon size={12} className="text-[#D4A017]" /><span className="text-xs font-bold text-black">{count.label}</span></div></TableCell><TableCell className="text-right font-bold text-black">BS {count.systemAmount.toFixed(2)}</TableCell><TableCell className="text-right">{isUsdMethod ? (<div className="flex items-center justify-end gap-2"><Input type="number" step="0.01" value={count.actualUsdAmount || 0} onChange={(e) => handleUsdAmountChange(count.method, parseFloat(e.target.value) || 0)} className="w-24 text-right bg-white border-[#9E9E9E] text-black font-bold" placeholder="USD" /><span className="text-xs text-black/60">× {state.exchangeRate.toFixed(2)}</span><span className="text-sm font-bold text-black">= BS {count.actualAmount.toFixed(2)}</span></div>) : (<Input type="number" step="0.01" value={count.actualAmount} onChange={(e) => handleActualAmountChange(count.method, parseFloat(e.target.value) || 0)} className="w-32 text-right bg-white border-[#9E9E9E] text-black font-bold ml-auto" />)}</TableCell><TableCell className="text-right"><span className={cn("font-bold px-2 py-1 rounded", count.difference > 0 ? "text-green-600" : count.difference < 0 ? "text-red-600" : "text-black/50")}>{count.difference !== 0 && (count.difference > 0 ? "+" : "")}{count.difference.toFixed(2)}</span></TableCell></TableRow>);})}</TableBody>
                  <TableBody><TableRow className="bg-[#F0F0F0] border-t-2 border-[#9E9E9E]"><TableCell className="font-black text-black">TOTALES</TableCell><TableCell className="text-right font-black text-black">BS {totalSystemAmount.toFixed(2)}</TableCell><TableCell className="text-right font-black text-black">BS {totalActualAmount.toFixed(2)}</TableCell><TableCell className="text-right"><span className={cn("font-black px-3 py-1 rounded-full text-sm", isBalanced ? "bg-green-100 text-green-700" : hasSurplus ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{isBalanced ? "CONCILIADO" : hasSurplus ? `SOBRANTE +${totalDifference.toFixed(2)}` : `FALTANTE ${totalDifference.toFixed(2)}`}</span></TableCell></TableRow></TableBody>
                  </Table>
                </div>
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end gap-3"><Button variant="ghost" onClick={() => setShowCloseDialog(false)} className="px-6 text-black">CANCELAR</Button><Button onClick={handleConfirmClose} className="px-6 bg-[#2ECC71] text-white font-black hover:brightness-110"><CheckCircle size={16} className="mr-2" /> CONFIRMAR CIERRE</Button></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader className="sr-only"><DialogTitle>Historial de Cierres</DialogTitle></DialogHeader>
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><Archive size={24} className="text-primary" /><h3 className="text-xl font-headline font-black">Historial de Cierres</h3></div><button onClick={() => setShowHistoryModal(false)} className="text-white/60 hover:text-white"><X size={20} /></button></div></div>
              <div className="p-6">{closeHistory.length === 0 ? <div className="text-center py-10 text-black/50 italic">No hay cierres registrados</div> : (<div className="space-y-3">{closeHistory.map((history) => (<div key={history.id} className="bg-white border border-[#9E9E9E] rounded-xl p-4 hover:shadow-md transition-all"><div className="flex justify-between items-center flex-wrap gap-3"><div><p className="text-sm font-bold text-black">{new Date(history.fecha).toLocaleString()}</p><p className="text-[10px] text-black/50">Apertura BS: Bs {history.apertura.montoBs.toFixed(2)} | USD: ${history.apertura.montoUsd.toFixed(2)}</p><p className={cn("text-[10px] font-bold mt-1", history.totales.estado === 'CONCILIADO' ? "text-green-600" : history.totales.estado === 'SOBRANTE' ? "text-yellow-600" : "text-red-600")}>{history.totales.estado}</p></div><Button onClick={() => exportHistoryToPDF(history)} className="bg-[#D4A017] hover:brightness-110 text-black font-black"><FileText size={14} className="mr-2" /> EXPORTAR PDF</Button></div></div>))}</div>)}</div>
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end"><Button onClick={() => setShowHistoryModal(false)} className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]">CERRAR</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
