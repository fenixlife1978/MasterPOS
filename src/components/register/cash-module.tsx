"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Vault, Lock, Unlock, FileText, Banknote, Smartphone, Fingerprint, Plane, DollarSign, History, Download, CheckCircle, Calculator, X, Archive, CreditCard, Printer } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { syncService } from '@/services/syncService';

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

export default function CashModule({ state }: CashModuleProps) {
  const [openAmountBs, setOpenAmountBs] = useState('0.00');
  const [openAmountUsd, setOpenAmountUsd] = useState('0.00');
  const [openRate, setOpenRate] = useState(state.exchangeRate.toString());
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [cashCounts, setCashCounts] = useState<CashCount[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [closeHistory, setCloseHistory] = useState<any[]>([]);

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  useEffect(() => {
    // Suscripción real a cierres de caja en Firestore
    const unsub = syncService.subscribeToCashClosings(setCloseHistory);
    return () => unsub();
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
    if (reg?.txs && Array.isArray(reg.txs)) {
      reg.txs.forEach(t => {
        if (t.type === 'contado' || t.type === 'cobro_deuda') {
          const method = t.payMethod || 'efectivo_bs';
          totals[method] = (totals[method] || 0) + (t.total || 0);
        }
      });
    }
    return totals;
  }, [reg]);

  const totalContado = (reg?.txs || [])
    .filter(t => t.type === 'contado' || t.type === 'cobro_deuda')
    .reduce((s, t) => s + (t.total || 0), 0);
    
  const totalEnCaja = (reg?.openAmount || 0) + totalContado;

  const handleOpenCash = () => {
    const bsAmount = parseFloat(openAmountBs) || 0;
    const usdAmount = parseFloat(openAmountUsd) || 0;
    const rate = parseFloat(openRate) || state.exchangeRate;
    const totalOpenAmount = bsAmount + (usdAmount * rate);
    state.openCashRegister(totalOpenAmount);
  };

  const handleConfirmClose = async () => {
    const totalSystemAmount = cashCounts.reduce((sum, c) => sum + c.systemAmount, 0);
    const totalActualAmount = cashCounts.reduce((sum, c) => sum + c.actualAmount, 0);
    const diff = totalActualAmount - totalSystemAmount;

    const closeReport = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      apertura: {
        totalBs: reg?.openAmount || 0,
        tasa: state.exchangeRate
      },
      ventas: {
        total: totalContado,
        porMetodo: salesByMethod
      },
      cuadre: {
        sistema: totalSystemAmount,
        real: totalActualAmount,
        diferencia: diff,
        estado: Math.abs(diff) < 0.01 ? "CONCILIADO" : (diff > 0 ? "SOBRANTE" : "FALTANTE")
      }
    };

    await syncService.saveCashClosing(closeReport);
    state.closeCashRegister();
    setShowCloseDialog(false);
    setCashCounts([]);
  };

  useEffect(() => {
    if (showCloseDialog && cashCounts.length === 0) {
      const initialCounts: CashCount[] = paymentMethods.map(method => ({
        method: method.id,
        label: method.label,
        icon: method.icon,
        systemAmount: salesByMethod[method.id] || 0,
        actualAmount: 0,
        difference: 0
      }));
      setCashCounts(initialCounts);
    }
  }, [showCloseDialog, salesByMethod]);

  const handleActualAmountChange = (methodId: string, value: number) => {
    setCashCounts(prev => prev.map(c => 
      c.method === methodId ? { ...c, actualAmount: value, difference: value - c.systemAmount } : c
    ));
  };

  const totalSystemAmount = cashCounts.reduce((sum, c) => sum + c.systemAmount, 0);
  const totalActualAmount = cashCounts.reduce((sum, c) => sum + c.actualAmount, 0);
  const totalDifference = totalActualAmount - totalSystemAmount;

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <h2 className="text-2xl font-headline font-black text-black mb-6">Gestión de Bóveda (Tiempo Real)</h2>

      {isClosed ? (
        <div className="bg-white border border-[#9E9E9E] rounded-xl p-6 shadow-md max-w-2xl mx-auto">
          <div className="text-center mb-6"><Vault size={48} className="mx-auto text-black/20 mb-2" /><h3 className="text-xl font-black">La caja está cerrada</h3><p className="text-sm text-black/50">Ingrese el monto inicial para comenzar a vender</p></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="text-[10px] font-bold uppercase block mb-1">Monto en BS</label><Input type="number" value={openAmountBs} onChange={(e) => setOpenAmountBs(e.target.value)} className="font-bold" /></div>
            <div><label className="text-[10px] font-bold uppercase block mb-1">Monto en USD</label><Input type="number" value={openAmountUsd} onChange={(e) => setOpenAmountUsd(e.target.value)} className="font-bold" /></div>
          </div>
          <Button onClick={handleOpenCash} className="w-full bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-12"><Unlock size={18} className="mr-2" /> ABRIR CAJA</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#9E9E9E] p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-black text-black/50 uppercase">Apertura</p>
              <p className="text-xl font-black">Bs {reg?.openAmount.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-[#9E9E9E] p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-black text-black/50 uppercase">Ventas (Hoy)</p>
              <p className="text-xl font-black text-green-600">Bs {totalContado.toFixed(2)}</p>
            </div>
            <div className="bg-[#1A2C4E] p-4 rounded-xl shadow-sm text-white">
              <p className="text-[10px] font-black text-white/50 uppercase">Total Estimado en Caja</p>
              <p className="text-xl font-black">Bs {totalEnCaja.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowCloseDialog(true)} variant="destructive" className="font-black"><Lock size={16} className="mr-2" /> CERRAR CAJA</Button>
            <Button onClick={() => setShowHistoryModal(true)} variant="outline" className="border-[#9E9E9E] font-black"><Archive size={16} className="mr-2" /> HISTORIAL</Button>
          </div>

          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
            <Table>
              <TableHeader className="bg-[#E8E8E8]"><TableRow><TableHead className="text-[10px] font-black">METODO</TableHead><TableHead className="text-[10px] font-black text-right">TOTAL BS</TableHead></TableRow></TableHeader>
              <TableBody>
                {paymentMethods.map(m => (
                  <TableRow key={m.id} className="border-b border-[#9E9E9E]"><TableCell className="py-3 font-bold text-xs"><div className="flex items-center gap-2"><m.icon size={14} className="text-primary" /> {m.label}</div></TableCell><TableCell className="text-right font-black">Bs {(salesByMethod[m.id] || 0).toFixed(2)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <div className="bg-[#1A2C4E] p-4 text-white"><h3 className="text-lg font-black">Cuadre de Caja</h3></div>
          <div className="p-6">
            <Table>
              <TableHeader><TableRow><TableHead className="text-[10px] font-black">METODO</TableHead><TableHead className="text-[10px] font-black text-right">SISTEMA</TableHead><TableHead className="text-[10px] font-black text-right">CONTADO REAL</TableHead><TableHead className="text-[10px] font-black text-right">DIFERENCIA</TableHead></TableRow></TableHeader>
              <TableBody>
                {cashCounts.map(c => (
                  <TableRow key={c.method} className="border-b"><TableCell className="font-bold text-xs">{c.label}</TableCell><TableCell className="text-right">Bs {c.systemAmount.toFixed(2)}</TableCell><TableCell className="text-right"><Input type="number" value={c.actualAmount} onChange={(e) => handleActualAmountChange(c.method, parseFloat(e.target.value) || 0)} className="w-32 ml-auto text-right font-bold" /></TableCell><TableCell className={cn("text-right font-bold", c.difference < 0 ? "text-red-600" : "text-green-600")}>{c.difference.toFixed(2)}</TableCell></TableRow>
                ))}
                <TableRow className="bg-[#F5F5F5] font-black"><TableCell>TOTALES</TableCell><TableCell className="text-right">Bs {totalSystemAmount.toFixed(2)}</TableCell><TableCell className="text-right">Bs {totalActualAmount.toFixed(2)}</TableCell><TableCell className={cn("text-right", totalDifference < 0 ? "text-red-600" : "text-green-600")}>{totalDifference.toFixed(2)}</TableCell></TableRow>
              </TableBody>
            </Table>
            <Button onClick={handleConfirmClose} className="w-full mt-6 bg-[#2ECC71] text-white font-black h-12">CONFIRMAR CIERRE</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[80vh] overflow-y-auto">
          <div className="bg-[#1A2C4E] p-4 text-white"><h3 className="text-lg font-black">Historial de Cierres (Sincronizado)</h3></div>
          <div className="p-6">
            {closeHistory.length === 0 ? <p className="text-center text-black/40 italic">No hay cierres registrados</p> : (
              <div className="space-y-3">
                {closeHistory.map(h => (
                  <div key={h.id} className="border border-[#9E9E9E] p-4 rounded-xl flex justify-between items-center hover:bg-[#F5F5F5]">
                    <div>
                      <p className="font-bold">{new Date(h.fecha).toLocaleString()}</p>
                      <p className="text-xs text-black/50">Ventas: Bs {h.ventas.total.toFixed(2)} | Estado: <span className="font-bold">{h.cuadre.estado}</span></p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-black", h.cuadre.diferencia < 0 ? "text-red-600" : "text-green-600")}>Dif: {h.cuadre.diferencia.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}