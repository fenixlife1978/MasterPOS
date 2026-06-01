"use client";

import React, { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Download, ChevronDown, ChevronRight, Wallet, Eye, X, HandCoins, History, DollarSign } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FloatingPaymentModal from '../pos/FloatingPaymentModal';
import { CartItem } from '@/lib/types';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

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
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: number; name: string; debt: number } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const groupedAccounts = state.accounts.reduce((acc, account) => {
    if (!acc[account.clientId]) {
      acc[account.clientId] = {
        clientId: account.clientId,
        clientName: account.clientName,
        clientCedula: account.clientCedula,
        accounts: [],
        totalDebt: 0,
        totalOriginal: 0,
        totalPaid: 0
      };
    }
    const remaining = account.amountBs - (account.paidAmount || 0);
    acc[account.clientId].accounts.push(account);
    acc[account.clientId].totalOriginal += account.amountBs;
    acc[account.clientId].totalPaid += (account.paidAmount || 0);
    acc[account.clientId].totalDebt += remaining;
    return acc;
  }, {} as Record<number, { clientId: number; clientName: string; clientCedula: string; accounts: any[]; totalDebt: number; totalOriginal: number; totalPaid: number }>);

  const clientsList = Object.values(groupedAccounts);
  const totalGeneralDebt = clientsList.reduce((sum, c) => sum + c.totalDebt, 0);

  const handlePayDebt = (clientId: number, clientName: string, debtAmount: number) => {
    if (debtAmount <= 0) return;
    setSelectedClient({ id: clientId, name: clientName, debt: debtAmount });
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = (paymentData: any) => {
    if (selectedClient) {
      state.applyAbono(selectedClient.id, paymentData.totalPaid);
      setShowPaymentModal(false);
      setSelectedClient(null);
    }
  };

  const handleTransactionClick = (account: any) => {
    const transaction = state.transactions.find(t => t.id === account.txId);
    setSelectedTransaction({ ...transaction, accountInfo: account });
    setShowDetailModal(true);
  };

  const handleExport = () => {
    const reportData = clientsList.map(c => ({
      Cliente: c.clientName,
      Cédula: c.clientCedula,
      'Monto Original': c.totalOriginal,
      'Monto Pagado': c.totalPaid,
      'Saldo Pendiente': c.totalDebt
    }));
    const csvContent = ['Cliente,Cédula,Monto Original,Monto Pagado,Saldo Pendiente']
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
      .filter(t => t.type === 'cobro_deuda' && t.clientId === selectedTransaction.accountInfo.clientId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getHistoricalExchangeRate = () => {
    if (selectedTransaction?.accountInfo?.exchangeRate) {
      return selectedTransaction.accountInfo.exchangeRate;
    }
    if (selectedTransaction?.exchangeRate) {
      return selectedTransaction.exchangeRate;
    }
    return null;
  };

  const historicalRate = getHistoricalExchangeRate();

  return (
    <>
      <div className="p-6 h-full overflow-y-auto scrollbar-thin">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-headline font-black text-black">Cuentas por Cobrar</h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="bg-[#1A2C4E] rounded-xl px-4 py-2">
                <span className="text-[10px] text-white/60 uppercase tracking-widest">Total General</span>
                <div className="text-2xl font-black text-white">{formatBs(totalGeneralDebt)}</div>
              </div>
              <div className="bg-[#D4A017]/10 rounded-xl px-4 py-2 border border-[#D4A017]/30">
                <span className="text-[10px] text-black/60 uppercase tracking-widest">Clientes con Deuda</span>
                <div className="text-2xl font-black text-black">{clientsList.filter(c => c.totalDebt > 0).length}</div>
              </div>
            </div>
          </div>
          <Button onClick={handleExport} className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-black/20 font-black h-9 px-4">
            <Download size={16} className="mr-2" /> EXPORTAR CSV
          </Button>
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
                <TableHead className="text-[10px] font-black uppercase text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsList.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-black/50 italic">No hay cuentas registradas</TableCell></TableRow>
              ) : (
                clientsList.map((client) => {
                  const isExpanded = expandedClient === client.clientId;
                  const hasDebt = client.totalDebt > 0;
                  return (
                    <React.Fragment key={client.clientId}>
                      <TableRow className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] cursor-pointer" onClick={() => setExpandedClient(isExpanded ? null : client.clientId)}>
                        <TableCell className="py-3">{isExpanded ? <ChevronDown size={16} className="text-black/60" /> : <ChevronRight size={16} className="text-black/60" />}</TableCell>
                        <TableCell className="font-bold text-black">{client.clientName}</TableCell>
                        <TableCell className="text-black/60 text-sm">{client.clientCedula}</TableCell>
                        <TableCell className="text-right font-bold text-black">{formatBs(client.totalOriginal)}</TableCell>
                        <TableCell className="text-right font-bold text-[#2ECC71]">{formatBs(client.totalPaid)}</TableCell>
                        <TableCell className="text-right"><span className={cn("font-black", hasDebt ? "text-[#E74C3C]" : "text-[#2ECC71]")}>{formatBs(client.totalDebt)}</span></TableCell>
                        <TableCell className="text-center">
                          {hasDebt && (
                            <button onClick={(e) => { e.stopPropagation(); handlePayDebt(client.clientId, client.clientName, client.totalDebt); }} className="px-3 py-1.5 bg-[#D4A017] text-black text-[10px] font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-1 mx-auto">
                              <Wallet size={12} /> PAGAR
                            </button>
                          )}
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
                                    <TableHead className="text-[9px] font-bold text-black/60">Fecha</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60">Productos</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-right">Monto</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-right">Pagado</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-right">Saldo</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-center">Estado</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-center">Ver</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {client.accounts.map((account) => {
                                    const remaining = account.amountBs - (account.paidAmount || 0);
                                    return (
                                      <TableRow key={account.id} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                        <TableCell className="text-[11px] text-black/60">{new Date(account.date).toLocaleDateString('es-VE')}</TableCell>
                                        <TableCell className="text-[11px] text-black/70 max-w-[250px] truncate">{account.products}</TableCell>
                                        <TableCell className="text-right text-[11px] font-bold text-black">{formatBs(account.amountBs)}</TableCell>
                                        <TableCell className="text-right text-[11px] text-[#2ECC71] font-bold">{formatBs(account.paidAmount || 0)}</TableCell>
                                        <TableCell className="text-right text-[11px] font-bold"><span className={remaining > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]"}>{formatBs(remaining)}</span></TableCell>
                                        <TableCell className="text-center"><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", account.status === 'pagada' ? "bg-[#2ECC71]/20 text-[#2ECC71]" : account.status === 'parcial' ? "bg-[#F39C12]/20 text-[#F39C12]" : "bg-[#E74C3C]/20 text-[#E74C3C]")}>{account.status === 'pagada' ? 'PAGADA' : account.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}</span></TableCell>
                                        <TableCell className="text-center">
                                          <button onClick={() => handleTransactionClick(account)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                                            <Eye size={14} className="text-black/50 hover:text-black" />
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
      </div>

      {showPaymentModal && selectedClient && (
        <FloatingPaymentModal
          total={selectedClient.debt}
          exchangeRate={state.exchangeRate}
          onClose={() => { setShowPaymentModal(false); setSelectedClient(null); }}
          onConfirm={handlePaymentConfirm}
        />
      )}

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
                  <div><label className="text-[10px] font-black text-black/60 uppercase">Tipo</label><p className="text-sm font-bold text-black uppercase">CRÉDITO</p></div>
                  <div><label className="text-[10px] font-black text-black/60 uppercase">Monto Total</label><p className="text-lg font-black text-black">{formatBs(selectedTransaction.accountInfo.amountBs)}</p>
                    {historicalRate && <p className="text-xs text-black/50">≈ {formatUsd(selectedTransaction.accountInfo.amountBs / historicalRate)} <span className="text-amber-600">(al momento del crédito)</span></p>}
                  </div>
                  <div><label className="text-[10px] font-black text-black/60 uppercase">Estado</label><p className={cn("inline-block px-3 py-1 rounded-full text-[10px] font-bold", selectedTransaction.accountInfo.status === 'pagada' ? "bg-green-100 text-green-700" : selectedTransaction.accountInfo.status === 'parcial' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{selectedTransaction.accountInfo.status === 'pagada' ? 'PAGADA' : selectedTransaction.accountInfo.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}</p></div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-amber-700" />
                      <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Tasa BCV al Momento del Crédito</label>
                    </div>
                    <div className="text-right">
                      {historicalRate ? (
                        <>
                          <p className="text-lg font-black text-amber-800">1 USD = {formatBsNumber(historicalRate)}</p>
                          <p className="text-[8px] text-amber-600">Valor fijo aplicado el {new Date(selectedTransaction.accountInfo.date).toLocaleDateString('es-VE')}</p>
                        </>
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
                          <th className="text-right p-3 text-[10px] font-black uppercase">PRECIO</th>
                          <th className="text-right p-3 text-[10px] font-black uppercase">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const items = getTransactionItems();
                          if (items.length > 0) {
                            return items.map((item, idx) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                <td className="p-3 text-xs text-black/80">{item.qty}</td>
                                <td className="p-3 text-xs text-black font-medium">{item.name}</td>
                                <td className="p-3 text-right text-xs text-black/80">
                                  {item.priceBs > 0 ? formatBs(item.priceBs) : 
                                   item.priceUsd > 0 ? formatUsd(item.priceUsd) : '—'}
                                </td>
                                <td className="p-3 text-right text-xs font-bold text-black">
                                  {item.priceBs > 0 ? formatBs(item.priceBs * item.qty) : 
                                   item.priceUsd > 0 ? formatUsd(item.priceUsd * item.qty) : '—'}
                                </td>
                              </tr>
                            ));
                          }
                          return (
                            <tr>
                              <td colSpan={4} className="text-center p-4 text-black/50 italic">No se pudieron cargar los productos</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#F5F5F5] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Monto Total (Bs):</span>
                    <div className="text-right">
                      <span className="font-bold text-black">{formatBs(selectedTransaction.accountInfo.amountBs)}</span>
                      {historicalRate && <span className="text-xs text-black/50 ml-2">({formatUsd(selectedTransaction.accountInfo.amountBs / historicalRate)})</span>}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Monto Pagado (Bs):</span>
                    <div className="text-right">
                      <span className="font-bold text-green-600">{formatBs(selectedTransaction.accountInfo.paidAmount || 0)}</span>
                      {historicalRate && <span className="text-xs text-black/50 ml-2">({formatUsd((selectedTransaction.accountInfo.paidAmount || 0) / historicalRate)})</span>}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#9E9E9E]">
                    <span className="text-black/60">Saldo Pendiente (Bs):</span>
                    <div className="text-right">
                      <span className="font-bold text-red-600">{formatBs(selectedTransaction.accountInfo.amountBs - (selectedTransaction.accountInfo.paidAmount || 0))}</span>
                      {historicalRate && <span className="text-xs text-black/50 ml-2">({formatUsd((selectedTransaction.accountInfo.amountBs - (selectedTransaction.accountInfo.paidAmount || 0)) / historicalRate)})</span>}
                    </div>
                  </div>
                  <div className="text-[8px] text-amber-600 text-center pt-2 border-t border-dashed border-[#9E9E9E]">
                    ⚠️ Los valores en USD se calculan con la tasa fija aplicada al momento del crédito
                  </div>
                </div>

                {(selectedTransaction.accountInfo.paidAmount || 0) > 0 && (
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
                          {(() => {
                            const abonos = getAbonosForClient();
                            if (abonos.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={2} className="text-center p-4 text-black/50 italic">No hay registros de abonos individuales</td>
                                </tr>
                              );
                            }
                            return abonos.map((abono, idx) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                <td className="p-3 text-xs text-black/80">{formatDateShort(abono.date)}</td>
                                <td className="p-3 text-right text-xs font-bold text-green-600">{formatBs(abono.total)}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                        <tfoot className="bg-[#F0F0F0]">
                          <tr>
                            <td className="p-3 text-xs font-bold text-black">TOTAL ABONADO</td>
                            <td className="p-3 text-right text-sm font-black text-green-700">{formatBs(selectedTransaction.accountInfo.paidAmount || 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end">
                <Button onClick={() => setShowDetailModal(false)} className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]">CERRAR</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}