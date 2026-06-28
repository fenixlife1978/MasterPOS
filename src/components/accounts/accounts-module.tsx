"use client";

import React, { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Download, ChevronDown, ChevronRight, Wallet, Eye, X, HandCoins, History, DollarSign, Trash2, PlusCircle, AlertCircle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CartItem } from '@/lib/types';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import syncService from '@/services/syncService';
import { useToast } from '@/hooks/use-toast';
import { ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

interface AccountsModuleProps {
  state: ReturnType<typeof usePOSState>;
}

interface ProductItem {
  name: string;
  qty: number;
  priceBs: number;
  priceUsd: number;
}

export default function AccountsModule({ state }: AccountsModuleProps) {
  const { toast } = useToast();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ========== Modal para registrar deuda inicial ==========
  const [showInitialDebtModal, setShowInitialDebtModal] = useState(false);
  const [initialDebtForm, setInitialDebtForm] = useState({
    clientId: '',
    clientName: '',
    clientCedula: '',
    clientPhone: '',
    clientAddress: '',
    amountBs: '',
    amountUsd: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
  });
  const [isSubmittingInitial, setIsSubmittingInitial] = useState(false);

  const groupedAccounts = useMemo(() => {
    return state.accounts.reduce((acc, account) => {
      const clientIdKey = String(account.clientId);
      if (!acc[clientIdKey]) {
        acc[clientIdKey] = {
          clientId: clientIdKey,
          clientName: account.clientName || 'Cliente Desconocido',
          clientCedula: account.clientCedula || 'S/N',
          accounts: [],
          totalDebtUsd: 0,
          totalOriginalUsd: 0,
          totalPaidUsd: 0
        };
      }
      
      const currentRate = state.exchangeRate || 36.50;
      const accountRate = account.exchangeRate || currentRate;
      const originalUsd = account.amountUsd || (account.amountBs / accountRate);
      const paidUsd = (account.paidAmount || 0) / accountRate;
      const remainingUsd = Math.max(0, originalUsd - paidUsd);
      
      acc[clientIdKey].accounts.push(account);
      acc[clientIdKey].totalOriginalUsd += originalUsd;
      acc[clientIdKey].totalPaidUsd += paidUsd;
      acc[clientIdKey].totalDebtUsd += remainingUsd;
      
      return acc;
    }, {} as Record<string, any>);
  }, [state.accounts, state.exchangeRate]);

  const clientsList = Object.values(groupedAccounts);
  const totalGeneralDebtUsd = clientsList.reduce((sum, c) => sum + c.totalDebtUsd, 0);
  const totalGeneralDebtBs = totalGeneralDebtUsd * state.exchangeRate;

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`¿Eliminar al cliente "${clientName}" y todas sus cuentas pendientes? Esta acción es irreversible.`)) return;
    try {
      const clientAccounts = state.accounts.filter(acc => String(acc.clientId) === clientId);
      for (const account of clientAccounts) {
        await syncService.deleteAccount?.(String(account.id));
      }
      await syncService.deleteClient(Number(clientId));
      toast({ title: "Cliente eliminado", description: `${clientName} eliminado correctamente.` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el cliente.", variant: "destructive" });
    }
  };

  const handleSubmitInitialDebt = async () => {
    const amountUsd = parseFloat(initialDebtForm.amountUsd);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      toast({ title: "Error", description: "Ingrese un monto válido", variant: "destructive" });
      return;
    }
    
    setIsSubmittingInitial(true);
    try {
      let targetClientId: number;
      let targetClientName: string;
      let targetClientCedula: string;

      if (initialDebtForm.clientId === 'new') {
        const timestamp = Date.now();
        const newClient = {
          id: timestamp,
          name: initialDebtForm.clientName,
          cedula: initialDebtForm.clientCedula,
          phone: initialDebtForm.clientPhone,
          address: initialDebtForm.clientAddress,
          debt: amountUsd * state.exchangeRate,
        };
        await syncService.saveClient(newClient);
        targetClientId = timestamp;
        targetClientName = newClient.name;
        targetClientCedula = newClient.cedula;
      } else {
        const client = state.clients.find(c => String(c.id) === String(initialDebtForm.clientId));
        if (!client) throw new Error("Cliente no encontrado");
        targetClientId = Number(client.id);
        targetClientName = client.name;
        targetClientCedula = client.cedula;
        await syncService.saveClient({ ...client, debt: (client.debt || 0) + (amountUsd * state.exchangeRate) });
      }

      const exchangeRateAtMoment = state.exchangeRate;
      const amountBs = amountUsd * exchangeRateAtMoment;
      const timestamp = Date.now();
      
      const newAccount = {
        id: timestamp,
        txId: timestamp + 1,
        clientId: targetClientId,
        clientName: targetClientName,
        clientCedula: targetClientCedula,
        amountBs: amountBs,
        amountUsd: amountUsd,
        paidAmount: 0,
        status: 'pendiente',
        date: initialDebtForm.date || new Date().toISOString(),
        products: `DEUDA INICIAL: ${initialDebtForm.reason || 'Saldo anterior'}`,
        exchangeRate: exchangeRateAtMoment,
      };

      await syncService.saveAccount(newAccount);
      toast({ title: "Deuda registrada", description: "El crédito se ha guardado correctamente." });
      setShowInitialDebtModal(false);
      setInitialDebtForm({ clientId: '', clientName: '', clientCedula: '', clientPhone: '', clientAddress: '', amountBs: '', amountUsd: '', date: new Date().toISOString().split('T')[0], reason: '', });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo registrar la deuda.", variant: "destructive" });
    } finally {
      setIsSubmittingInitial(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-6">
        <div>
          <h2 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Cuentas por Cobrar</h2>
          <div className="flex items-center gap-6 mt-4">
            <div className="bg-[#1A2C4E] rounded-2xl px-6 py-4 border-4 border-black shadow-2xl">
              <span className="text-[12px] font-black text-white uppercase tracking-[0.2em]">Total General Pendiente</span>
              <div className="text-4xl font-black text-primary mt-1">{formatUsd(totalGeneralDebtUsd)}</div>
              <div className="text-[13px] font-black text-white mt-1 font-mono">≈ {formatBs(totalGeneralDebtBs)}</div>
            </div>
            <div className="bg-[#D4A017] rounded-2xl px-6 py-4 border-4 border-black shadow-xl">
              <span className="text-[12px] font-black text-black uppercase tracking-[0.15em]">Clientes Deudores</span>
              <div className="text-4xl font-black text-black mt-1">{clientsList.filter(c => c.totalDebtUsd > 0.001).length}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setShowInitialDebtModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-black h-14 px-8 border-4 border-black shadow-xl text-sm uppercase tracking-widest">
            <PlusCircle size={20} className="mr-2" /> REGISTRAR DEUDA
          </Button>
          <Button onClick={() => {}} className="bg-white hover:bg-primary text-black border-4 border-black font-black h-14 px-8 shadow-xl text-sm uppercase tracking-widest">
            <Download size={20} className="mr-2" /> EXPORTAR CSV
          </Button>
        </div>
      </div>

      <div className="bg-white border-4 border-black rounded-3xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-[#E8E8E8] border-b-4 border-black">
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="text-sm font-black text-black uppercase tracking-widest p-5">Cliente / Cédula</TableHead>
              <TableHead className="text-sm font-black text-black uppercase tracking-widest text-right p-5">Total Deuda USD</TableHead>
              <TableHead className="text-sm font-black text-black uppercase tracking-widest text-right p-5">Total Deuda Bs</TableHead>
              <TableHead className="text-sm font-black text-black uppercase tracking-widest text-center p-5">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientsList.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-24 text-black font-black italic text-xl uppercase opacity-20 tracking-tighter">No hay cuentas pendientes</TableCell></TableRow>
            ) : (
              clientsList.map((client) => {
                const isExpanded = expandedClient === client.clientId;
                return (
                  <React.Fragment key={client.clientId}>
                    <TableRow className="border-b-2 border-black/10 hover:bg-primary/5 cursor-pointer transition-colors" onClick={() => setExpandedClient(isExpanded ? null : client.clientId)}>
                      <TableCell className="p-5">{isExpanded ? <ChevronDown size={24} className="text-black font-black" /> : <ChevronRight size={24} className="text-black font-black" />}</TableCell>
                      <TableCell className="p-5">
                        <div className="font-black text-lg text-black uppercase">{client.clientName}</div>
                        <div className="text-sm font-black text-black/60 font-mono mt-1">{client.clientCedula}</div>
                      </TableCell>
                      <TableCell className="text-right p-5">
                        <div className="font-black text-2xl text-red-700">{formatUsd(client.totalDebtUsd)}</div>
                        <div className="text-[11px] font-black text-black/40 uppercase">Monto Fijo Divisas</div>
                      </TableCell>
                      <TableCell className="text-right p-5">
                        <div className="font-black text-xl text-black font-mono">{formatBs(client.totalDebtUsd * state.exchangeRate)}</div>
                        <div className="text-[11px] font-black text-black/40 uppercase">Cálculo a Tasa Hoy</div>
                      </TableCell>
                      <TableCell className="text-center p-5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.clientId, client.clientName); }}
                          className="px-6 py-2 bg-red-600 text-white text-xs font-black rounded-xl border-4 border-black hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg mx-auto uppercase"
                        >
                          <Trash2 size={16} /> ELIMINAR
                        </button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={5} className="p-0 border-b-4 border-black/20">
                          <div className="p-8 space-y-6">
                            <div className="text-xs font-black text-black uppercase tracking-[0.2em] mb-4 border-b-2 border-black/5 pb-2">Historial Detallado de Créditos</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {client.accounts.map((account: any) => {
                                const remainingUsd = (account.amountUsd || 0) - ((account.paidAmount || 0) / (account.exchangeRate || state.exchangeRate));
                                return (
                                  <div key={account.id} className="bg-white border-2 border-black rounded-2xl p-5 shadow-md flex justify-between items-center hover:border-primary transition-all">
                                    <div className="flex-1">
                                      <p className="text-[11px] font-black text-black/40 uppercase">{new Date(account.date).toLocaleDateString('es-VE')}</p>
                                      <p className="text-sm font-black text-black uppercase mt-1 truncate max-w-[200px]">{account.products}</p>
                                      <span className={cn("inline-block mt-2 px-3 py-0.5 rounded-full text-[9px] font-black border-2", account.status === 'pagada' ? "bg-green-50 text-green-700 border-green-600" : "bg-red-50 text-red-700 border-red-600")}>
                                        {account.status.toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-black text-red-700">{formatUsd(remainingUsd)}</p>
                                      <p className="text-[10px] font-black text-black/60 font-mono mt-1">{formatBs(remainingUsd * state.exchangeRate)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
