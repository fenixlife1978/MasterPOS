"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  CheckCircle2, XCircle, AlertTriangle, Printer, 
  RefreshCw, Ban, ArrowLeftRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { syncService } from '@/services/syncService';

interface CorteParcialFormProps {
  onClose: () => void;
  onCorteConfirmado: (nuevaTasa: number) => void;
  tasaActual: number;
  onTasaActualizada: (nuevaTasa: number) => void;
}

interface RowData {
  id: number;
  metodo: string;
  saldoInicial: number;
  saldoInicialDisplay: string;
  ventasPeriodo: number;
  teoricoTotal: number;
  teoricoDisplay: string;
  fisico: number;
  diferencia: number;
  estado: 'CUADRA' | 'FALTANTE' | 'SOBRANTE';
}

export default function CorteParcialForm({ onClose, onCorteConfirmado, tasaActual, onTasaActualizada }: CorteParcialFormProps) {
  const state = usePOSState();
  const reg = state.register;
  
  const [nuevaTasa, setNuevaTasa] = useState<string>('');
  const [tasaValidada, setTasaValidada] = useState<boolean>(false);
  const [isConciliado, setIsConciliado] = useState<boolean>(false);
  const [fisicos, setFisicos] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentMethods = [
    { id: 1, metodo: 'EFECTIVO BS', key: 'efectivo_bs', isUsd: false, hasInitialBalance: true },
    { id: 2, metodo: 'EFECTIVO USD', key: 'usd_efectivo', isUsd: true, hasInitialBalance: true },
    { id: 3, metodo: 'TARJETA', key: 'tarjeta', isUsd: false, hasInitialBalance: false },
    { id: 4, metodo: 'BIOPAGO', key: 'biopago', isUsd: false, hasInitialBalance: false },
    { id: 5, metodo: 'PAGO MÓVIL', key: 'pago_movil', isUsd: false, hasInitialBalance: false },
    { id: 6, metodo: 'ZELLE', key: 'zelle', isUsd: true, hasInitialBalance: false },
  ];

  const salesByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    paymentMethods.forEach(m => totals[m.key] = 0);
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

  const openAmount = reg?.openAmount || 0;
  const openAmountUSD = openAmount / tasaActual;

  const rows: RowData[] = paymentMethods.map((pm) => {
    const ventas = salesByMethod[pm.key] || 0;
    const ventasEnMoneda = pm.isUsd ? ventas / tasaActual : ventas;
    
    let saldoInicial = 0;
    if (pm.hasInitialBalance) {
      if (pm.key === 'efectivo_bs') saldoInicial = openAmount;
      if (pm.key === 'usd_efectivo') saldoInicial = openAmountUSD;
    }
    
    const teoricoTotal = saldoInicial + ventasEnMoneda;
    const fisico = fisicos[pm.key] || 0;
    const diferencia = fisico - teoricoTotal;
    
    let estado: RowData['estado'] = 'CUADRA';
    if (Math.abs(diferencia) > 0.01) {
      estado = diferencia < 0 ? 'FALTANTE' : 'SOBRANTE';
    }

    return {
      id: pm.id,
      metodo: pm.metodo,
      saldoInicial,
      saldoInicialDisplay: pm.isUsd ? `$ ${saldoInicial.toFixed(2)}` : `Bs ${saldoInicial.toFixed(2)}`,
      ventasPeriodo: ventasEnMoneda,
      teoricoTotal,
      teoricoDisplay: pm.isUsd ? `$ ${teoricoTotal.toFixed(2)}` : `Bs ${teoricoTotal.toFixed(2)}`,
      fisico,
      diferencia,
      estado
    };
  });

  const totalTeorico = rows.reduce((s, r) => s + r.teoricoTotal, 0);
  const totalFisico = rows.reduce((s, r) => s + r.fisico, 0);
  const totalDiferencia = totalFisico - totalTeorico;

  const handleFisicoChange = (key: string, valor: number) => {
    setFisicos(prev => ({ ...prev, [key]: valor }));
  };

  const handleConfirmarCorte = async () => {
    if (!tasaValidada || !isConciliado) return;
    setIsSubmitting(true);

    const nuevaTasaNum = parseFloat(nuevaTasa);
    
    // Calcular nuevo fondo para período 2
    const nuevoFondoBs = fisicos['efectivo_bs'] || 0;
    const nuevoFondoUsd = fisicos['usd_efectivo'] || 0;
    const nuevoFondoTotalBs = nuevoFondoBs + (nuevoFondoUsd * nuevaTasaNum);
    
    const closeReport = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      fechaCierre: new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
      tipoCorte: 'corte_tasa',
      tasaBCV: tasaActual,
      tasaNueva: nuevaTasaNum,
      apertura: { montoBs: openAmount, montoUsd: openAmountUSD, tasa: tasaActual },
      ventas: { totalContado: totalTeorico - (openAmount + openAmountUSD), porMetodo: salesByMethod },
      cuadre: rows.map(r => ({ metodo: r.metodo, sistema: r.teoricoTotal, real: r.fisico, diferencia: r.diferencia })),
      totales: { sistema: totalTeorico, real: totalFisico, diferencia: totalDiferencia, estado: Math.abs(totalDiferencia) < 0.01 ? "CONCILIADO" : (totalDiferencia > 0 ? "SOBRANTE" : "FALTANTE") },
      nuevoFondo: { bs: nuevoFondoBs, usd: nuevoFondoUsd, totalBs: nuevoFondoTotalBs }
    };

    await syncService.saveCashClosing(closeReport);
    
    // Guardar corte parcial en localStorage para el cierre final
    localStorage.setItem(`corte_parcial_${Date.now()}`, JSON.stringify(closeReport));
    
    // Actualizar tasa y nuevo fondo de caja
    onTasaActualizada(nuevaTasaNum);
    await syncService.saveRegister({ 
      isOpen: true, 
      openTime: reg?.openTime || new Date().toISOString(), 
      openAmount: nuevoFondoTotalBs,
      txs: reg?.txs || [] 
    });

    setIsSubmitting(false);
    onCorteConfirmado(nuevaTasaNum);
  };

  const handlePrintTicket = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const html = `
      <html><head><title>Corte Parcial - MasterPOS</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; font-size: 10px; width: 80mm; }
        .center { text-align: center; } .line { border-top: 1px dashed #000; margin: 5px 0; }
        h2 { font-size: 13px; margin: 3px 0; }
        table { width: 100%; font-size: 9px; } th { text-align: left; border-bottom: 1px solid #000; }
        td { padding: 2px 0; } .right { text-align: right; } .bold { font-weight: bold; }
      </style></head><body>
        <div class="center"><h2>MASTERPOS</h2><p>CORTE PARCIAL - CAMBIO DE TASA</p><p>${new Date().toLocaleString()}</p></div>
        <div class="line"></div>
        <p>Tasa Anterior: Bs ${tasaActual.toFixed(2)}</p>
        <p>Nueva Tasa: Bs ${parseFloat(nuevaTasa).toFixed(2)}</p>
        <div class="line"></div>
        <p class="bold">NUEVO FONDO PERÍODO 2:</p>
        <p>Efectivo BS: Bs ${(fisicos['efectivo_bs'] || 0).toFixed(2)}</p>
        <p>Efectivo USD: $ ${(fisicos['usd_efectivo'] || 0).toFixed(2)}</p>
        <div class="line"></div>
        <p class="center">¡Corte parcial registrado exitosamente!</p>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-[#F9F4E1] w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[98vh]">
        
        {/* HEADER - Sticky */}
        <div className="bg-[#1E3A8A] text-white p-3 relative border-b-4 border-[#0284C7] flex-shrink-0">
          <button onClick={onClose} className="absolute right-3 top-3 text-white/60 hover:text-white text-xl">&times;</button>
          <div className="absolute left-3 top-3 bg-amber-500 text-[9px] font-bold px-2 py-0.5 rounded text-slate-900">
            MODALIDAD HÍBRIDA
          </div>
          <div className="text-center pt-5">
            <h1 className="text-base md:text-lg font-black tracking-wider uppercase">
              INFORME DE CORTE PARCIAL Y TRANSICIÓN DE TASA (@ 6:00 PM)
            </h1>
          </div>
        </div>

        {/* METADATOS - Compacto */}
        <div className="bg-white p-3 grid grid-cols-3 gap-3 border-b border-slate-200 flex-shrink-0">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[8px] font-bold uppercase">Tasa Actual BCV:</span>
            <span className="text-sm font-mono font-bold text-slate-900">Bs {tasaActual.toFixed(2)} / $</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[8px] font-bold uppercase">Fondo Apertura BS:</span>
            <span className="text-sm font-mono font-bold text-blue-700">Bs {openAmount.toFixed(2)}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[8px] font-bold uppercase">Fondo Apertura USD:</span>
            <span className="text-sm font-mono font-bold text-emerald-700">$ {openAmountUSD.toFixed(2)}</span>
          </div>
        </div>

        {/* TABLA - Scrollable */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[900px] text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#2c3e50] text-white text-[9px] uppercase font-bold tracking-wider">
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2">MÉTODO DE PAGO</th>
                <th className="p-2 text-center w-32">SALDO INICIAL</th>
                <th className="p-2 text-center w-28">VENTAS PERÍODO</th>
                <th className="p-2 text-center w-28">TEÓRICO TOTAL</th>
                <th className="p-2 text-center w-28">FÍSICO CONTADO</th>
                <th className="p-2 text-center w-28">DIFERENCIA</th>
                <th className="p-2 text-center w-24">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                const isFaltante = row.estado === 'FALTANTE';
                const isSobrante = row.estado === 'SOBRANTE';
                
                let statusIcon = null;
                let statusClass = "";
                
                if (row.estado === 'CUADRA') {
                  statusIcon = <CheckCircle2 size={10} className="text-green-600" />;
                  statusClass = "bg-green-100 text-green-800";
                } else if (isFaltante) {
                  statusIcon = <XCircle size={10} className="text-red-600" />;
                  statusClass = "bg-red-100 text-red-800";
                } else {
                  statusIcon = <AlertTriangle size={10} className="text-amber-600" />;
                  statusClass = "bg-amber-100 text-amber-800";
                }

                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-center font-mono text-slate-400">{row.id}</td>
                    <td className="p-2 font-bold text-slate-700">{row.metodo}</td>
                    <td className="p-2 text-center font-mono font-bold bg-slate-50 text-slate-800">
                      {row.saldoInicialDisplay}
                    </td>
                    <td className="p-2 text-center font-mono text-slate-600">
                      {row.metodo.includes('USD') ? `$ ${row.ventasPeriodo.toFixed(2)}` : `Bs ${row.ventasPeriodo.toFixed(2)}`}
                    </td>
                    <td className="p-2 text-center font-mono font-bold text-blue-700">
                      {row.teoricoDisplay}
                    </td>
                    <td className="p-2 text-center">
                      <Input 
                        type="number" 
                        step="0.01"
                        value={fisicos[paymentMethods.find(p => p.id === row.id)?.key || ''] || ''} 
                        onChange={(e) => handleFisicoChange(paymentMethods.find(p => p.id === row.id)?.key || '', parseFloat(e.target.value) || 0)}
                        className="w-24 text-center font-mono font-bold h-7 text-[10px] mx-auto"
                        placeholder="0.00"
                      />
                    </td>
                    <td className={cn("p-2 text-center font-mono font-bold", isFaltante ? "text-red-600" : isSobrante ? "text-amber-600" : "text-slate-600")}>
                      {row.diferencia !== 0 ? `${row.diferencia > 0 ? '+' : ''}${row.diferencia.toFixed(2)}` : '0.00'}
                    </td>
                    <td className="p-2 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9px]", statusClass)}>
                        {statusIcon} {row.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* TOTAL ROW */}
              <tr className="bg-[#1E3A8A] text-white font-bold text-[10px] sticky bottom-0">
                <td colSpan={4} className="p-2 text-right">TOTALES (en Bs):</td>
                <td className="p-2 text-center font-mono">Bs {totalTeorico.toFixed(2)}</td>
                <td className="p-2 text-center font-mono">Bs {totalFisico.toFixed(2)}</td>
                <td className={cn("p-2 text-center font-mono", totalDiferencia < 0 ? "text-red-300" : totalDiferencia > 0 ? "text-yellow-300" : "text-green-300")}>
                  {totalDiferencia !== 0 ? `${totalDiferencia > 0 ? '+' : ''}${totalDiferencia.toFixed(2)}` : '0.00'}
                </td>
                <td className="p-2 text-center text-[9px]">
                  {Math.abs(totalDiferencia) < 0.01 ? 'CONCILIADO' : totalDiferencia > 0 ? 'SOBRANTE' : 'FALTANTE'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER - TRANSICIÓN DE TASA */}
        <div className="bg-white p-3 border-t border-slate-200 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            
            {/* DECLARAR NUEVA TASA */}
            <div className="md:col-span-5 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
              <div className="flex items-center gap-2 text-[#1E3A8A] font-bold text-[10px] mb-2">
                <ArrowLeftRight size={12} />
                <span>DECLARAR NUEVA TASA BCV (Período Tarde)</span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Bs</span>
                  <input 
                    type="number" 
                    step="0.01"
                    disabled={tasaValidada}
                    placeholder="Nueva tasa..."
                    value={nuevaTasa}
                    onChange={(e) => setNuevaTasa(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-7 pr-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-200"
                  />
                </div>
                <span className="text-slate-400 text-xs">/$</span>
                <Button 
                  onClick={() => nuevaTasa && setTasaValidada(!tasaValidada)}
                  disabled={!nuevaTasa}
                  size="sm"
                  className={cn(tasaValidada ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700', 'text-white font-bold text-[10px] px-3 h-7')}
                >
                  {tasaValidada ? <><RefreshCw size={10} className="mr-1" /> Modificar</> : 'Validar'}
                </Button>
              </div>
            </div>

            {/* BOTONES ACCIÓN */}
            <div className="md:col-span-7 flex gap-2 items-stretch">
              <Button 
                onClick={handlePrintTicket}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1 px-3 flex-1 h-auto"
              >
                <Printer size={12} className="mr-1" /> Ticket Corte
              </Button>
              <Button 
                disabled={!tasaValidada || !isConciliado || isSubmitting}
                onClick={handleConfirmarCorte}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-[10px] py-1 px-3 flex-1 h-auto"
              >
                <RefreshCw size={12} className={cn("mr-1", isSubmitting && "animate-spin")} /> 
                {isSubmitting ? 'PROCESANDO...' : 'Reaperturar Caja (Tarde)'}
              </Button>
            </div>
          </div>

          {/* CHECKBOX CONCILIACIÓN */}
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isConciliado}
                onChange={(e) => setIsConciliado(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-slate-700 uppercase tracking-wide text-[9px] font-bold">Declaro bajo firma el conteo físico parcial</span>
            </label>
            <Button onClick={onClose} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-[10px]">
              <Ban size={10} className="mr-1" /> Cancelar
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}