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

  // ✅ LÓGICA CORREGIDA: USD como fuente de verdad fija, Bs dinámico
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
      
      // El monto USD es el valor ancla que no cambia
      const originalUsd = account.amountUsd || (account.amountBs / accountRate);
      // Calculamos cuánto de ese USD se ha pagado (usando la tasa a la que se registró la cuenta o la actual si no hay)
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

  const handleTransactionClick = (account: any) => {
    const transaction = state.transactions.find(t => String(t.id) === String(account.txId));
    setSelectedTransaction({ ...transaction, accountInfo: account });
    setShowDetailModal(true);
  };

  const handleExport = () => {
    const reportData = clientsList.map(c => ({
      Cliente: c.clientName,
      Cédula: c.clientCedula,
      'Monto Original (USD)': c.totalOriginalUsd,
      'Monto Pagado (USD)': c.totalPaidUsd,
      'Saldo Pendiente (USD)': c.totalDebtUsd,
      'Saldo Pendiente (Bs)': c.totalDebtUsd * state.exchangeRate
    }));
    const csvContent = ['Cliente,Cédula,Monto Original (USD),Monto Pagado (USD),Saldo Pendiente (USD),Saldo Pendiente (Bs)']
      .concat(reportData.map(r => Object.values(r).join(','))).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuentas_cobrar_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTransactionItems = (): ProductItem[] => {
    if (selectedTransaction?.items && selectedTransaction.items.length > 0) {
      return selectedTransaction.items.map((item: CartItem) => ({
        name: item.name, qty: item.qty, priceBs: item.priceBs, priceUsd: item.priceUsd
      }));
    }
    if (selectedTransaction?.accountInfo?.products) {
      const productsStr = selectedTransaction.accountInfo.products;
      return productsStr.split(',').map((item: string): ProductItem => {
        const match = item.trim().match(/(.+)\sx(\d+)$/);
        if (match) return { name: match[1], qty: parseInt(match[2]), priceBs: 0, priceUsd: 0 };
        return { name: item.trim(), qty: 1, priceBs: 0, priceUsd: 0 };
      });
    }
    return [];
  };

  const getAbonosForClient = () => {
    if (!selectedTransaction?.accountInfo) return [];
    return state.transactions
      .filter(t => t.type === 'cobro_deuda' && String(t.clientId) === String(selectedTransaction.accountInfo.clientId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const historicalRate = useMemo(() => {
    if (selectedTransaction?.accountInfo?.exchangeRate) return selectedTransaction.accountInfo.exchangeRate;
    if (selectedTransaction?.exchangeRate) return selectedTransaction.exchangeRate;
    return null;
  }, [selectedTransaction]);

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
      console.error("Error al eliminar cliente:", error);
      toast({ title: "Error", description: "No se pudo eliminar el cliente.", variant: "destructive" });
    }
  };

  const handleInitialDebtChange = (field: string, value: string) => {
    setInitialDebtForm(prev => ({ ...prev, [field]: value }));
    
    if (field === 'amountBs') {
      const bs = parseFloat(value) || 0;
      const usd = bs / state.exchangeRate;
      setInitialDebtForm(prev => ({ ...prev, amountUsd: usd.toFixed(2) }));
    }
    if (field === 'amountUsd') {
      const usd = parseFloat(value) || 0;
      const bs = usd * state.exchangeRate;
      setInitialDebtForm(prev => ({ ...prev, amountBs: bs.toFixed(2) }));
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
        if (!initialDebtForm.clientName.trim()) {
          toast({ title: "Error", description: "Ingrese el nombre del cliente", variant: "destructive" });
          setIsSubmittingInitial(false);
          return;
        }
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
        
        // Actualizar deuda del cliente existente
        await syncService.saveClient({
          ...client,
          debt: (client.debt || 0) + (amountUsd * state.exchangeRate)
        });
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

      // Crear transacción de respaldo
      const creditTransaction = {
        id: timestamp + 1,
        date: newAccount.date,
        type: 'credito',
        items: [],
        subtotal: amountBs,
        iva: 0,
        total: amountBs,
        totalUsd: amountUsd,
        payMethod: 'credito',
        clientId: targetClientId,
        clientName: targetClientName,
        exchangeRate: exchangeRateAtMoment,
        notes: newAccount.products,
      };
      
      await syncService.saveTransaction(creditTransaction);

      toast({ title: "Deuda registrada", description: "El crédito se ha guardado correctamente." });
      setShowInitialDebtModal(false);
      setInitialDebtForm({
        clientId: '', clientName: '', clientCedula: '', clientPhone: '',
        clientAddress: '', amountBs: '', amountUsd: '',
        date: new Date().toISOString().split('T')[0], reason: '',
      });
    } catch (error) {
      console.error("Error al registrar deuda inicial:", error);
      toast({ title: "Error", description: "No se pudo registrar la deuda.", variant: "destructive" });
    } finally {
      setIsSubmittingInitial(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-headline font-black text-black">Cuentas por Cobrar</h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="bg-[#1A2C4E] rounded-xl px-4 py-2">
              <span className="text-[10px] text-white/60 uppercase tracking-widest">Total General</span>
              <div className="text-2xl font-black text-white">{formatUsd(totalGeneralDebtUsd)}</div>
              <div className="text-[8px] text-white/40">≈ {formatBs(totalGeneralDebtBs)}</div>
            </div>
            <div className="bg-[#D4A017]/10 rounded-xl px-4 py-2 border border-[#D4A017]/30">
              <span className="text-[10px] text-black/60 uppercase tracking-widest">Clientes con Deuda</span>
              <div className="text-2xl font-black text-black">{clientsList.filter(c => c.totalDebtUsd > 0.001).length}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowInitialDebtModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-black h-9 px-4">
            <PlusCircle size={16} className="mr-2" /> REGISTRAR DEUDA INICIAL
          </Button>
          <Button onClick={handleExport} className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-black/20 font-black h-9 px-4">
            <Download size={16} className="mr-2" /> EXPORTAR CSV
          </Button>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black uppercase w-8"></TableHead>
              <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Cédula</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-right">Total Original</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-right">Pagado</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-right">Saldo Pendiente</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientsList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-black/50 italic">No hay cuentas registradas</TableCell></TableRow>
            ) : (
              clientsList.map((client) => {
                const isExpanded = expandedClient === client.clientId;
                const hasDebt = client.totalDebtUsd > 0.001;
                return (
                  <React.Fragment key={client.clientId}>
                    <TableRow className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] cursor-pointer" onClick={() => setExpandedClient(isExpanded ? null : client.clientId)}>
                      <TableCell className="py-3">{isExpanded ? <ChevronDown size={16} className="text-black/60" /> : <ChevronRight size={16} className="text-black/60" />}</TableCell>
                      <TableCell className="font-bold text-black">{client.clientName}</TableCell>
                      <TableCell className="text-black font-bold text-sm">{client.clientCedula}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-black">{formatUsd(client.totalOriginalUsd)}</div>
                        <div className="text-[8px] text-black/40">≈ {formatBs(client.totalOriginalUsd * state.exchangeRate)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-[#2ECC71]">{formatUsd(client.totalPaidUsd)}</div>
                        <div className="text-[8px] text-black/40">≈ {formatBs(client.totalPaidUsd * state.exchangeRate)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-black", hasDebt ? "text-[#E74C3C]" : "text-[#2ECC71]")}>
                          {formatUsd(client.totalDebtUsd)}
                        </span>
                        <div className="text-[8px] text-black/40">≈ {formatBs(client.totalDebtUsd * state.exchangeRate)}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.clientId, client.clientName); }}
                          className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-all flex items-center gap-1"
                        >
                          <Trash2 size={12} /> ELIMINAR
                        </button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-[#FAFAFA]">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4 border-t border-[#9E9E9E]">
                            <div className="text-[11px] font-black text-black/60 uppercase tracking-widest mb-3">Historial de Créditos</div>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-b border-[#9E9E9E] bg-[#F0F0F0]">
                                  <TableHead className="text-[9px] font-bold text-black">Fecha</TableHead>
                                  <TableHead className="text-[9px] font-bold text-black">Detalle</TableHead>
                                  <TableHead className="text-[9px] font-bold text-black text-right">Monto USD</TableHead>
                                  <TableHead className="text-[9px] font-bold text-black text-right">Saldo Bs Actual</TableHead>
                                  <TableHead className="text-[9px] font-bold text-black text-center">Estado</TableHead>
                                  <TableHead className="text-[9px] font-bold text-black text-center">Ver</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {client.accounts.map((account: any) => {
                                  const originalUsd = account.amountUsd || (account.amountBs / (account.exchangeRate || state.exchangeRate));
                                  const paidUsd = (account.paidAmount || 0) / (account.exchangeRate || state.exchangeRate);
                                  const remainingUsd = Math.max(0, originalUsd - paidUsd);
                                  const remainingBsAtCurrentRate = remainingUsd * state.exchangeRate;
                                  
                                  return (
                                    <TableRow key={account.id} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                      <TableCell className="text-[11px] text-black font-bold">{new Date(account.date).toLocaleDateString('es-VE')}</TableCell>
                                      <TableCell className="text-[11px] text-black font-bold max-w-[250px] truncate">{account.products}</TableCell>
                                      <TableCell className="text-right font-bold">{formatUsd(originalUsd)}</TableCell>
                                      <TableCell className="text-right font-bold text-[#E74C3C]">{formatBs(remainingBsAtCurrentRate)}</TableCell>
                                      <TableCell className="text-center">
                                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", 
                                          account.status === 'pagada' ? "bg-green-100 text-green-700" : 
                                          account.status === 'parcial' ? "bg-yellow-100 text-yellow-700" : 
                                          "bg-red-100 text-red-700")}>
                                          {account.status.toUpperCase()}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <button onClick={() => handleTransactionClick(account)} className="p-1.5 rounded-lg hover:bg-gray-200">
                                          <Eye size={14} className="text-black" />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
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

      {/* Modal Detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Crédito</DialogTitle></DialogHeader>
          {selectedTransaction?.accountInfo && (
            <div className="flex flex-col h-full">
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
                <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 hover:opacity-70"><X size={20} /></button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center"><HandCoins size={24} className="text-primary" /></div>
                  <div>
                    <h3 className="text-xl font-black">Detalle del Crédito</h3>
                    <p className="text-white/60 text-sm">#{selectedTransaction.accountInfo.txId} • {selectedTransaction.accountInfo.clientName}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
                  <div><label className="text-[10px] font-black text-black/60 uppercase">Fecha</label><p className="text-sm font-bold text-black">{formatDate(selectedTransaction.accountInfo.date)}</p></div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase">Monto Original (USD)</label>
                    <p className="text-lg font-black text-black">{formatUsd(selectedTransaction.accountInfo.amountUsd)}</p>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-amber-700" />
                      <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Tasa BCV del Crédito</label>
                    </div>
                    <div className="text-right">
                      {historicalRate ? (
                        <p className="text-lg font-black text-amber-800">1 USD = {formatBsNumber(historicalRate)}</p>
                      ) : (
                        <p className="text-sm font-bold text-red-600">No registrada</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-black/60 uppercase flex items-center gap-2 mb-3">📦 PRODUCTOS</label>
                  <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#E8E8E8]">
                        <tr>
                          <th className="text-left p-3 text-[10px] font-black uppercase">CANT</th>
                          <th className="text-left p-3 text-[10px] font-black uppercase">PRODUCTO</th>
                          <th className="text-right p-3 text-[10px] font-black uppercase">SUBTOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getTransactionItems().map((item, idx) => (
                          <tr key={idx} className="border-b border-[#9E9E9E]/50">
                            <td className="p-3 text-xs text-black font-bold">{item.qty}</td>
                            <td className="p-3 text-xs text-black font-bold">{item.name}</td>
                            <td className="p-3 text-right text-xs font-bold">
                              {item.priceUsd > 0 ? formatUsd(item.priceUsd * item.qty) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#F5F5F5] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Pagado en Bs:</span>
                    <span className="font-bold text-green-600">{formatBs(selectedTransaction.accountInfo.paidAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#9E9E9E]">
                    <span className="text-black font-bold">Saldo Pendiente (USD Fijo):</span>
                    <span className="font-black text-red-600">
                      {formatUsd(selectedTransaction.accountInfo.amountUsd - ((selectedTransaction.accountInfo.paidAmount || 0) / (selectedTransaction.accountInfo.exchangeRate || state.exchangeRate)))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-black font-bold">Equivalente Hoy (Bs Dinámico):</span>
                    <span className="font-black text-amber-700">
                      {formatBs((selectedTransaction.accountInfo.amountUsd - ((selectedTransaction.accountInfo.paidAmount || 0) / (selectedTransaction.accountInfo.exchangeRate || state.exchangeRate))) * state.exchangeRate)}
                    </span>
                  </div>
                </div>

                {getAbonosForClient().length > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase flex items-center gap-2 mb-3"><History size={12} /> HISTORIAL DE ABONOS</label>
                    <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#E8E8E8]">
                          <tr>
                            <th className="text-left p-3 text-[10px] font-black uppercase">FECHA</th>
                            <th className="text-right p-3 text-[10px] font-black uppercase">MONTO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getAbonosForClient().map((abono, idx) => (
                            <tr key={idx} className="border-b border-[#9E9E9E]/50">
                              <td className="p-3 text-xs text-black font-bold">{formatDateShort(abono.date)}</td>
                              <td className="p-3 text-right text-xs font-bold text-green-600">{formatBs(abono.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t flex justify-end">
                <Button onClick={() => setShowDetailModal(false)}>CERRAR</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Deuda Inicial */}
      <Dialog open={showInitialDebtModal} onOpenChange={setShowInitialDebtModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="p-4 bg-[#1A2C4E] text-white">
            <DialogTitle className="text-lg font-black">Registrar Deuda Inicial</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Cliente</label>
              <select 
                value={initialDebtForm.clientId} 
                onChange={(e) => handleInitialDebtChange('clientId', e.target.value)}
                className="w-full h-9 border border-[#9E9E9E] rounded-lg px-3 text-sm bg-white"
              >
                <option value="">Seleccionar cliente...</option>
                <option value="new">➕ Nuevo cliente</option>
                {state.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.cedula})</option>
                ))}
              </select>
            </div>
            {initialDebtForm.clientId === 'new' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <Input value={initialDebtForm.clientName} onChange={(e) => handleInitialDebtChange('clientName', e.target.value)} placeholder="Nombre completo *" />
                <Input value={initialDebtForm.clientCedula} onChange={(e) => handleInitialDebtChange('clientCedula', e.target.value)} placeholder="Cédula / RIF *" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Monto USD *</label>
                <Input type="number" step="0.01" value={initialDebtForm.amountUsd} onChange={(e) => handleInitialDebtChange('amountUsd', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Total Bs (Hoy)</label>
                <Input value={initialDebtForm.amountBs} disabled className="bg-gray-100 font-bold" />
              </div>
            </div>
            <Input value={initialDebtForm.reason} onChange={(e) => handleInitialDebtChange('reason', e.target.value)} placeholder="Motivo (ej: Saldo anterior)" />
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowInitialDebtModal(false)}>CANCELAR</Button>
            <Button onClick={handleSubmitInitialDebt} disabled={isSubmittingInitial} className="bg-primary text-black font-black">
              {isSubmittingInitial ? 'GUARDANDO...' : 'REGISTRAR DEUDA'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
