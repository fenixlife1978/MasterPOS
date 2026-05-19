"use client";

import React, { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { UserPlus, Search, Phone, MapPin, ChevronDown, ChevronRight, Eye, X, CreditCard, Calendar, DollarSign, Receipt, Package, History } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ClientsModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function ClientsModule({ state }: ClientsModuleProps) {
  const [search, setSearch] = useState('');
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredClients = state.clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.cedula.toLowerCase().includes(search.toLowerCase())
  );

  // Obtener cuentas de crédito por cliente
  const getClientAccounts = (clientId: number) => {
    return state.accounts
      .filter(a => a.clientId === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Obtener transacciones de cobro de deuda (abonos) para un cliente específico y cuenta
  const getAbonosForAccount = (clientId: number, accountId: number) => {
    // Buscar transacciones de tipo 'cobro_deuda' para este cliente
    // y que estén dentro del rango de fechas de la cuenta
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return [];
    
    // En un sistema real, los abonos se relacionarían directamente con la cuenta
    // Por ahora, devolvemos las transacciones de cobro_deuda del cliente
    return state.transactions
      .filter(t => t.type === 'cobro_deuda' && t.clientId === clientId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Obtener items del carrito desde la transacción original
  const getTransactionItems = (txId: number) => {
    const transaction = state.transactions.find(t => t.id === txId);
    return transaction?.items || [];
  };

  const handleClientClick = (clientId: number) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  const handleAccountClick = (account: any) => {
    setSelectedAccount(account);
    setShowDetailModal(true);
  };

  // Formatear fecha para mostrar
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div className="p-6 h-full overflow-y-auto scrollbar-thin">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-headline font-black text-black">Registro de Clientes</h2>
          <div className="flex gap-3">
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" />
              <Input 
                placeholder="Buscar cliente..." 
                className="pl-9 h-10 bg-white border-[#9E9E9E] text-black"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-black font-black shadow-md">
              <UserPlus size={18} className="mr-2" /> NUEVO CLIENTE
            </Button>
          </div>
        </div>

        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow className="border-b border-[#9E9E9E]">
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest w-8"></TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Cédula</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Nombre</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Contacto</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Deuda</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((c) => {
                const clientAccounts = getClientAccounts(c.id);
                const hasDebt = c.debt > 0;
                const isExpanded = expandedClient === c.id;
                
                return (
                  <React.Fragment key={c.id}>
                    <TableRow 
                      className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] cursor-pointer transition-colors"
                      onClick={() => handleClientClick(c.id)}
                    >
                      <TableCell className="py-3">
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-black/60" />
                        ) : (
                          <ChevronRight size={16} className="text-black/60" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-black/60">{c.cedula}</TableCell>
                      <TableCell className="font-bold text-sm text-black">{c.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-black/60"><Phone size={10} /> {c.phone}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-black/50 max-w-[200px] truncate"><MapPin size={10} /> {c.address}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black border shadow-sm",
                          hasDebt 
                            ? "bg-red-100 text-red-700 border-red-300" 
                            : "bg-green-100 text-green-700 border-green-300"
                        )}>
                          BS {c.debt.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-[#D4A017] font-black hover:bg-[#D4A017]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClientClick(c.id);
                          }}
                        >
                          {isExpanded ? 'OCULTAR' : 'VER CRÉDITOS'}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Filas expandidas - Historial de cuentas de crédito */}
                    {isExpanded && (
                      <TableRow className="bg-[#FAFAFA]">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-4 border-t border-[#9E9E9E]">
                            <div className="text-[11px] font-black text-black/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <Receipt size={12} /> HISTORIAL DE CRÉDITOS
                            </div>
                            {clientAccounts.length === 0 ? (
                              <div className="text-center py-6 text-black/40 italic text-sm">
                                No hay créditos registrados para este cliente
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {clientAccounts.map((account) => {
                                  const paidAmount = account.paidAmount || 0;
                                  const remaining = account.amountBs - paidAmount;
                                  const isPaid = account.status === 'pagada';
                                  const isPartial = account.status === 'parcial';
                                  
                                  return (
                                    <div 
                                      key={account.id}
                                      onClick={() => handleAccountClick(account)}
                                      className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                                        isPaid 
                                          ? "bg-green-50 border-green-200 hover:border-green-300" 
                                          : isPartial
                                            ? "bg-yellow-50 border-yellow-200 hover:border-yellow-300"
                                            : "bg-red-50 border-red-200 hover:border-red-300"
                                      )}
                                    >
                                      <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 text-center">
                                          <Calendar size={14} className="text-black/40 mx-auto mb-1" />
                                          <span className="text-[9px] font-bold text-black/60">
                                            {new Date(account.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                                          </span>
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-xs text-black/70 line-clamp-1 max-w-md">
                                            {account.products}
                                          </div>
                                          <div className="flex items-center gap-3 mt-1">
                                            <span className={cn(
                                              "text-[9px] font-bold px-2 py-0.5 rounded-full",
                                              isPaid ? "bg-green-200 text-green-700" : isPartial ? "bg-yellow-200 text-yellow-700" : "bg-red-200 text-red-700"
                                            )}>
                                              {account.status === 'pagada' ? 'PAGADA' : account.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                                            </span>
                                            {paidAmount > 0 && (
                                              <span className="text-[9px] text-black/50">
                                                Abonado: BS {paidAmount.toFixed(2)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-bold text-black">
                                          BS {account.amountBs.toFixed(2)}
                                        </div>
                                        {!isPaid && (
                                          <div className="text-[11px] font-bold text-red-600">
                                            Saldo: BS {remaining.toFixed(2)}
                                          </div>
                                        )}
                                      </div>
                                      <Eye size={16} className="text-black/40 ml-3" />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-black/50 italic">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal de detalle de crédito - Estilo recibo */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del Crédito</DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="flex flex-col h-full max-h-[80vh] overflow-y-auto">
              {/* Header del modal */}
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
                <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 hover:opacity-70">
                  <X size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Receipt size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Detalle del Crédito</h3>
                    <p className="text-white/60 text-sm">#{selectedAccount.txId} • {selectedAccount.clientName}</p>
                  </div>
                </div>
              </div>

              {/* Cuerpo del modal */}
              <div className="p-6 space-y-6">
                {/* Información general */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Fecha</label>
                    <p className="text-sm font-bold text-black">{formatDate(selectedAccount.date)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Tipo</label>
                    <p className="text-sm font-bold text-black uppercase">CRÉDITO</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Monto Total</label>
                    <p className="text-lg font-black text-black">BS {selectedAccount.amountBs.toFixed(2)}</p>
                    <p className="text-xs text-black/50">≈ USD {(selectedAccount.amountBs / state.exchangeRate).toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Estado</label>
                    <p className={cn(
                      "inline-block px-3 py-1 rounded-full text-[10px] font-bold",
                      selectedAccount.status === 'pagada' ? "bg-green-100 text-green-700" :
                      selectedAccount.status === 'parcial' ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {selectedAccount.status === 'pagada' ? 'PAGADA' :
                       selectedAccount.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                    </p>
                  </div>
                </div>

                {/* Productos - Lista vertical uno por línea */}
                <div>
                  <label className="text-[10px] font-black text-black/60 uppercase tracking-widest flex items-center gap-2 mb-3">
                    <Package size={12} /> Productos
                  </label>
                  <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#E8E8E8]">
                        <tr className="border-b border-[#9E9E9E]">
                          <th className="text-left p-2 text-[10px] font-black text-black uppercase">Cant</th>
                          <th className="text-left p-2 text-[10px] font-black text-black uppercase">Producto</th>
                          <th className="text-right p-2 text-[10px] font-black text-black uppercase">Precio</th>
                          <th className="text-right p-2 text-[10px] font-black text-black uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Intentar obtener los items del carrito desde la transacción original
                          const transaction = state.transactions.find(t => t.id === selectedAccount.txId);
                          if (transaction && transaction.items && transaction.items.length > 0) {
                            return transaction.items.map((item: any, idx: number) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50">
                                <td className="p-2 text-xs text-black/80">{item.qty}</td>
                                <td className="p-2 text-xs text-black">{item.name}</td>
                                <td className="p-2 text-right text-xs text-black/80">BS {item.priceBs.toFixed(2)}</td>
                                <td className="p-2 text-right text-xs font-bold text-black">BS {(item.priceBs * item.qty).toFixed(2)}</td>
                              </tr>
                            ));
                          } else {
                            // Fallback: mostrar productos como texto simple
                            const productsList = selectedAccount.products.split(',').map((p: string) => p.trim());
                            return productsList.map((product: string, idx: number) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50">
                                <td className="p-2 text-xs text-black/80">1</td>
                                <td className="p-2 text-xs text-black" colSpan={3}>{product}</td>
                              </tr>
                            ));
                          }
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totales */}
                <div className="bg-[#F5F5F5] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Monto Total:</span>
                    <span className="font-bold text-black">BS {selectedAccount.amountBs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Monto Pagado:</span>
                    <span className="font-bold text-green-600">BS {(selectedAccount.paidAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#9E9E9E]">
                    <span className="text-black/60">Saldo Pendiente:</span>
                    <span className="font-bold text-red-600">BS {(selectedAccount.amountBs - (selectedAccount.paidAmount || 0)).toFixed(2)}</span>
                  </div>
                </div>

                {/* Historial de Abonos - Lista por fecha y monto */}
                {(selectedAccount.paidAmount || 0) > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <History size={12} /> Historial de Abonos
                    </label>
                    <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#E8E8E8]">
                          <tr className="border-b border-[#9E9E9E]">
                            <th className="text-left p-2 text-[10px] font-black text-black uppercase">Fecha</th>
                            <th className="text-right p-2 text-[10px] font-black text-black uppercase">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.transactions
                            .filter(t => t.type === 'cobro_deuda' && t.clientId === selectedAccount.clientId)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map((abono, idx) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50">
                                <td className="p-2 text-xs text-black/80">{formatDate(abono.date)}</td>
                                <td className="p-2 text-right text-xs font-bold text-green-600">BS {abono.total.toFixed(2)}</td>
                              </tr>
                            ))}
                          {/* Si no hay abonos específicos, mostrar el total pagado */}
                          {state.transactions.filter(t => t.type === 'cobro_deuda' && t.clientId === selectedAccount.clientId).length === 0 && (
                            <tr>
                              <td colSpan={2} className="p-3 text-center text-xs text-black/50 italic">
                                No hay registros de abonos individuales. Total abonado: BS {(selectedAccount.paidAmount || 0).toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end sticky bottom-0">
                <Button 
                  onClick={() => setShowDetailModal(false)} 
                  className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]"
                >
                  CERRAR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}