"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import syncService from '@/services/syncService';
import { getLocalDateString, formatLocalDate } from '@/lib/date-utils';
import { 
  Computer, DollarSign, CreditCard, Smartphone, Fingerprint, 
  Plane, Receipt, TrendingUp, TrendingDown, Eye, Loader2,
  Banknote, Clock, AlertCircle, CloudUpload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface Terminal {
  id: string;
  name: string;
  description: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedTo: string | null;
}

interface CashRegisterData {
  isOpen: boolean;
  openTime: string;
  openAmount: number;
  openAmountBs: number;
  openAmountUsd: number;
  txs: any[];
  exchangeRate: number;
}

interface TotalsByMethod {
  efectivo_bs: number;
  usd_efectivo: number;
  tarjeta: number;
  biopago: number;
  pago_movil: number;
  zelle: number;
  credito: number;
  colaboracion: number;
}

function isTodayVenezuela(dateStr: string): boolean {
  const today = getLocalDateString();
  const d = new Date(dateStr);
  const datePart = getLocalDateString(d);
  return datePart === today;
}

export default function CashSupervision() {
  const { user } = useAuth();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [registers, setRegisters] = useState<Record<string, CashRegisterData | null>>({});
  const [loadingTerminals, setLoadingTerminals] = useState(true);
  const [registersLoaded, setRegistersLoaded] = useState<Record<string, boolean>>({});
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [selectedRegister, setSelectedRegister] = useState<CashRegisterData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [totals, setTotals] = useState<TotalsByMethod | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Cargar terminales desde Firebase Realtime Database
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setLoadingTerminals(false);
      return;
    }

    const loadTerminals = async () => {
      try {
        const data = await syncService.getAllTerminals();
        // Asegurar que los datos tengan la estructura correcta
        const terminalsWithDefaults = data.map((t: any) => ({
          ...t,
          id: t.id || t.name || '',
          name: t.name || 'Sin nombre',
          location: t.location || '',
          status: t.status || 'active'
        }));
        setTerminals(terminalsWithDefaults);
      } catch (error) {
        console.error('Error loading terminals:', error);
      } finally {
        setLoadingTerminals(false);
      }
    };
    
    loadTerminals();
    
    // Polling cada 5 segundos para simular tiempo real
    const interval = setInterval(loadTerminals, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

  // Cargar registros de caja de cada terminal
  useEffect(() => {
    if (terminals.length === 0) return;

    const loadRegisters = async () => {
      for (const terminal of terminals) {
        const terminalId = terminal.id.toString();
        try {
          const register = await syncService.getRegisterByTerminal(terminalId);
          // ✅ CORREGIDO: Asegurar que openAmount esté presente
          const registerWithOpenAmount = register ? {
            ...register,
            openAmount: register.openAmountBs || 0
          } : null;
          setRegisters(prev => ({ ...prev, [terminalId]: registerWithOpenAmount }));
        } catch (error) {
          console.error(`Error loading register for terminal ${terminalId}:`, error);
          setRegisters(prev => ({ ...prev, [terminalId]: null }));
        } finally {
          setRegistersLoaded(prev => ({ ...prev, [terminalId]: true }));
        }
      }
    };
    
    loadRegisters();
    
    // Polling cada 5 segundos
    const interval = setInterval(loadRegisters, 5000);
    return () => clearInterval(interval);
  }, [terminals]);

  // Verificar si los registros de todas las terminales están cargados
  const allRegistersLoaded = useCallback(() => {
    if (terminals.length === 0) return true;
    return terminals.every(terminal => registersLoaded[terminal.id.toString()] === true);
  }, [terminals, registersLoaded]);

  const calculateTotals = useCallback((terminalId: string) => {
    const register = registers[terminalId];
    if (!register || !register.isOpen) return null;

    const todayTxs = (register.txs || []).filter((tx: any) => isTodayVenezuela(tx.date));
    
    const totals: TotalsByMethod = {
      efectivo_bs: 0,
      usd_efectivo: 0,
      tarjeta: 0,
      biopago: 0,
      pago_movil: 0,
      zelle: 0,
      credito: 0,
      colaboracion: 0,
    };

    todayTxs.forEach((tx: any) => {
      const method = tx.payMethod || 'efectivo_bs';
      
      if (tx.type === 'credito') {
        totals.credito += tx.total;
      } else if (tx.type === 'colaboracion' || tx.type === 'consumo_propio') {
        totals.colaboracion += tx.costoTotalOperacion || 0;
      } else if (method === 'usd_efectivo' || method === 'zelle') {
        totals[method as keyof Omit<TotalsByMethod, 'credito' | 'colaboracion'>] += tx.total;
      } else {
        if (totals.hasOwnProperty(method)) {
          totals[method as keyof Omit<TotalsByMethod, 'credito' | 'colaboracion'>] += tx.total;
        }
      }
    });

    return totals;
  }, [registers]);

  const handleViewDetail = (terminal: Terminal) => {
    const terminalId = terminal.id.toString();
    const register = registers[terminalId];
    if (!register || !register.isOpen) {
      alert('Esta caja no está abierta actualmente');
      return;
    }
    
    setSelectedTerminal(terminal);
    setSelectedRegister(register);
    const calculatedTotals = calculateTotals(terminalId);
    setTotals(calculatedTotals);
    setShowDetailModal(true);
  };

  const getRegisterStatus = (terminalId: string) => {
    const reg = registers[terminalId];
    if (!reg || !reg.isOpen) {
      return { status: 'Cerrada', color: 'text-red-600 bg-red-100' };
    }
    return { status: 'Abierta', color: 'text-green-600 bg-green-100' };
  };

  const getOpenTime = (terminalId: string) => {
    const reg = registers[terminalId];
    if (!reg || !reg.isOpen) return '—';
    return formatLocalDate(reg.openTime);
  };

  const getOpenAmount = (terminalId: string) => {
    const reg = registers[terminalId];
    if (!reg || !reg.isOpen) return null;
    return { bs: reg.openAmountBs, usd: reg.openAmountUsd };
  };

  // Sincronizar todas las cajas remotamente
  const handleSyncAllTerminals = async () => {
    if (isSyncingAll) return;
    
    if (!confirm('¿Enviar comando de sincronización a TODAS las cajas abiertas? Las cajas ejecutarán la sincronización en segundo plano.')) {
      return;
    }
    
    setIsSyncingAll(true);
    try {
      await syncService.sendSyncCommandToAllTerminals();
      alert('✅ Comando enviado a todas las terminales. Las cajas sincronizarán sus operaciones pendientes.');
    } catch (error) {
      console.error('Error al enviar comandos de sincronización:', error);
      alert('❌ Error al enviar comandos. Verifique la conexión a internet.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (loadingTerminals) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (terminals.length === 0) {
    return (
      <div className="bg-white border border-[#9E9E9E] rounded-xl p-8 text-center">
        <Computer size={48} className="mx-auto text-gray-400 mb-3" />
        <p className="text-black/60">No hay terminales registradas en el sistema.</p>
        <p className="text-xs text-black/40 mt-1">Cree una terminal desde la pestaña "Terminales" para comenzar.</p>
      </div>
    );
  }

  // Mientras se cargan los registros, mostrar loader
  if (!allRegistersLoaded()) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary" />
        <span className="ml-2 text-sm text-black/60">Cargando estado de cajas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Computer size={20} className="text-primary" />
            <h3 className="text-lg font-black text-black">Supervisión de Cajas en Tiempo Real</h3>
          </div>
          <Button
            onClick={handleSyncAllTerminals}
            disabled={isSyncingAll}
            className="bg-[#1A2C4E] hover:bg-[#2c3e66] text-white font-black h-9 px-4 text-xs"
          >
            {isSyncingAll ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                ENVIANDO...
              </>
            ) : (
              <>
                <CloudUpload size={14} className="mr-2" />
                SINCRONIZAR TODAS LAS CAJAS
              </>
            )}
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#E8E8E8]">
              <tr className="border-b border-[#9E9E9E]">
                <th className="p-3 text-left text-[10px] font-black uppercase">Terminal</th>
                <th className="p-3 text-left text-[10px] font-black uppercase">Ubicación</th>
                <th className="p-3 text-center text-[10px] font-black uppercase">Estado</th>
                <th className="p-3 text-center text-[10px] font-black uppercase">Hora Apertura</th>
                <th className="p-3 text-center text-[10px] font-black uppercase">Fondo Apertura</th>
                <th className="p-3 text-center text-[10px] font-black uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {terminals.map((terminal) => {
                const { status, color } = getRegisterStatus(terminal.id.toString());
                const openAmount = getOpenAmount(terminal.id.toString());
                const isOpen = status === 'Abierta';
                
                return (
                  <tr key={terminal.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold">{terminal.name}</td>
                    <td className="p-3 text-gray-600 text-xs">{terminal.location || '—'}</td>
                    <td className="p-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", color)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", isOpen ? "bg-green-600" : "bg-red-600")} />
                        {status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-xs font-mono">{getOpenTime(terminal.id.toString())}</td>
                    <td className="p-3 text-center text-xs">
                      {openAmount ? (
                        <div className="flex flex-col items-center">
                          <span className="font-bold">{formatBs(openAmount.bs)}</span>
                          <span className="text-gray-500">+ {formatUsd(openAmount.usd)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        onClick={() => handleViewDetail(terminal)}
                        disabled={!isOpen}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-7 text-[10px] font-bold",
                          isOpen ? "border-primary text-primary hover:bg-primary/10" : "border-gray-300 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        <Eye size={12} className="mr-1" />
                        Ver Detalle
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-3xl p-0 overflow-hidden rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-4 bg-[#1A2C4E] text-white sticky top-0">
            <DialogTitle className="text-lg font-black">
              Detalle de Caja - {selectedTerminal?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-500">Hora de Apertura</p>
                <p className="text-sm font-bold">{selectedRegister?.openTime ? formatLocalDate(selectedRegister.openTime) : '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-500">Fondo de Apertura</p>
                <p className="text-sm font-bold">{formatBs(selectedRegister?.openAmountBs || 0)} + {formatUsd(selectedRegister?.openAmountUsd || 0)}</p>
              </div>
            </div>

            {totals && (
              <>
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                  <h4 className="text-xs font-black uppercase mb-3 flex items-center gap-2">
                    <TrendingUp size={14} className="text-primary" /> 
                    Totales de Ventas del Día (Caja Actual)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Banknote size={12} className="text-green-600" />
                        <span className="text-[8px] font-bold uppercase text-gray-500">Efectivo BS</span>
                      </div>
                      <p className="text-lg font-black text-black">{formatBs(totals.efectivo_bs)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={12} className="text-emerald-600" />
                        <span className="text-[8px] font-bold uppercase text-gray-500">Efectivo USD</span>
                      </div>
                      <p className="text-lg font-black text-black">{formatBs(totals.usd_efectivo)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard size={12} className="text-blue-600" />
                        <span className="text-[8px] font-bold uppercase text-gray-500">Tarjeta</span>
                      </div>
                      <p className="text-lg font-black text-black">{formatBs(totals.tarjeta)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Fingerprint size={12} className="text-purple-600" />
                        <span className="text-[8px] font-bold uppercase text-gray-500">Biopago</span>
                      </div>
                      <p className="text-lg font-black text-black">{formatBs(totals.biopago)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Smartphone size={12} className="text-orange-600" />
                        <span className="text-[8px] font-bold uppercase text-gray-500">Pago Móvil</span>
                      </div>
                      <p className="text-lg font-black text-black">{formatBs(totals.pago_movil)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Plane size={12} className="text-red-600" />
                        <span className="text-[8px] font-bold uppercase text-gray-500">Zelle</span>
                      </div>
                      <p className="text-lg font-black text-black">{formatBs(totals.zelle)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt size={12} className="text-amber-600" />
                      <span className="text-[8px] font-bold uppercase text-amber-700">Ventas a Crédito</span>
                    </div>
                    <p className="text-xl font-black text-amber-700">{formatBs(totals.credito)}</p>
                    <p className="text-[8px] text-amber-500 mt-1">Cuentas por cobrar</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown size={12} className="text-red-600" />
                      <span className="text-[8px] font-bold uppercase text-red-700">Colaboraciones / Consumo</span>
                    </div>
                    <p className="text-xl font-black text-red-700">{formatBs(totals.colaboracion)}</p>
                    <p className="text-[8px] text-red-500 mt-1">Costo de salidas</p>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setShowDetailModal(false)} className="bg-primary text-black font-black">
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}