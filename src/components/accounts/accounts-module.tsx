"use client";

import React, { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Download, ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PaymentModal from '../pos/payment-modal';

interface AccountsModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function AccountsModule({ state }: AccountsModuleProps) {
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: number; name: string; debt: number } | null>(null);

  // Agrupar cuentas por cliente
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
  }, {} as Record<number, {
    clientId: number;
    clientName: string;
    clientCedula: string;
    accounts: any[];
    totalDebt: number;
    totalOriginal: number;
    totalPaid: number;
  }>);

  const clientsList = Object.values(groupedAccounts);
  const totalGeneralDebt = clientsList.reduce((sum, c) => sum + c.totalDebt, 0);

  // Abrir calculadora para pagar deuda del cliente
  const handlePayDebt = (clientId: number, clientName: string, debtAmount: number) => {
    if (debtAmount <= 0) return;
    setSelectedClient({ id: clientId, name: clientName, debt: debtAmount });
    setShowPaymentModal(true);
  };

  // Procesar pago después de la calculadora
  const handlePaymentConfirm = (paymentData: any) => {
    if (selectedClient) {
      state.applyAbono(selectedClient.id, paymentData.totalPaid);
      setShowPaymentModal(false);
      setSelectedClient(null);
      alert(`Pago registrado correctamente. Monto: BS ${paymentData.totalPaid.toFixed(2)}`);
    }
  };

  // Exportar reporte
  const handleExport = () => {
    const reportData = clientsList.map(c => ({
      Cliente: c.clientName,
      Cédula: c.clientCedula,
      'Monto Original': c.totalOriginal,
      'Monto Pagado': c.totalPaid,
      'Saldo Pendiente': c.totalDebt
    }));
    
    const csvContent = ['Cliente,Cédula,Monto Original,Monto Pagado,Saldo Pendiente']
      .concat(reportData.map(r => Object.values(r).join(',')))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuentas_cobrar_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="p-6 h-full overflow-y-auto scrollbar-thin">
        {/* Header con total general */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-headline font-black text-black">Cuentas por Cobrar</h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="bg-[#1A2C4E] rounded-xl px-4 py-2">
                <span className="text-[10px] text-white/60 uppercase tracking-widest">Total General</span>
                <div className="text-2xl font-black text-white">BS {totalGeneralDebt.toFixed(2)}</div>
              </div>
              <div className="bg-[#D4A017]/10 rounded-xl px-4 py-2 border border-[#D4A017]/30">
                <span className="text-[10px] text-black/60 uppercase tracking-widest">Clientes con Deuda</span>
                <div className="text-2xl font-black text-black">{clientsList.filter(c => c.totalDebt > 0).length}</div>
              </div>
            </div>
          </div>
          <Button 
            onClick={handleExport}
            className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-black/20 font-black h-9 px-4"
          >
            <Download size={16} className="mr-2" /> EXPORTAR CSV
          </Button>
        </div>

        {/* Tabla de clientes agrupados */}
        <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow className="border-b border-[#9E9E9E]">
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest w-8"></TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Cliente</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Cédula</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Total Original</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Pagado</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Saldo Pendiente</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-black/50 italic">
                    No hay cuentas registradas
                  </TableCell>
                </TableRow>
              ) : (
                clientsList.map((client) => {
                  const isExpanded = expandedClient === client.clientId;
                  const hasDebt = client.totalDebt > 0;
                  
                  return (
                    <React.Fragment key={client.clientId}>
                      {/* Fila principal del cliente */}
                      <TableRow 
                        className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] cursor-pointer"
                        onClick={() => setExpandedClient(isExpanded ? null : client.clientId)}
                      >
                        <TableCell className="py-3">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-black/60" />
                          ) : (
                            <ChevronRight size={16} className="text-black/60" />
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-black">{client.clientName}</TableCell>
                        <TableCell className="text-black/60 text-sm">{client.clientCedula}</TableCell>
                        <TableCell className="text-right font-bold text-black">BS {client.totalOriginal.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold text-[#2ECC71]">BS {client.totalPaid.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "font-black",
                            hasDebt ? "text-[#E74C3C]" : "text-[#2ECC71]"
                          )}>
                            BS {client.totalDebt.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {hasDebt && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePayDebt(client.clientId, client.clientName, client.totalDebt);
                              }}
                              className="px-3 py-1.5 bg-[#D4A017] text-black text-[10px] font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-1 mx-auto"
                            >
                              <Wallet size={12} /> PAGAR
                            </button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Filas expandidas (historial de créditos) */}
                      {isExpanded && (
                        <TableRow className="bg-[#FAFAFA]">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-4 border-t border-[#9E9E9E]">
                              <div className="text-[11px] font-black text-black/60 uppercase tracking-widest mb-3">
                                Historial de Créditos
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-b border-[#9E9E9E] bg-[#F0F0F0]">
                                    <TableHead className="text-[9px] font-bold text-black/60">Fecha</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60">Productos</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-right">Monto</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-right">Pagado</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-right">Saldo</TableHead>
                                    <TableHead className="text-[9px] font-bold text-black/60 text-center">Estado</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {client.accounts.map((account) => {
                                    const remaining = account.amountBs - (account.paidAmount || 0);
                                    return (
                                      <TableRow key={account.id} className="border-b border-[#9E9E9E]/50">
                                        <TableCell className="text-[11px] text-black/60">
                                          {new Date(account.date).toLocaleDateString('es-VE')}
                                        </TableCell>
                                        <TableCell className="text-[11px] text-black/70 max-w-[250px] truncate">
                                          {account.products}
                                        </TableCell>
                                        <TableCell className="text-right text-[11px] font-bold text-black">
                                          BS {account.amountBs.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right text-[11px] text-[#2ECC71] font-bold">
                                          BS {(account.paidAmount || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right text-[11px] font-bold">
                                          <span className={remaining > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]"}>
                                            BS {remaining.toFixed(2)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-bold",
                                            account.status === 'pagada' ? "bg-[#2ECC71]/20 text-[#2ECC71]" :
                                            account.status === 'parcial' ? "bg-[#F39C12]/20 text-[#F39C12]" :
                                            "bg-[#E74C3C]/20 text-[#E74C3C]"
                                          )}>
                                            {account.status === 'pagada' ? 'PAGADA' : account.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                                          </span>
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

      {/* Modal de pago (calculadora) */}
      {showPaymentModal && selectedClient && (
        <PaymentModal 
          total={selectedClient.debt}
          exchangeRate={state.exchangeRate}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedClient(null);
          }}
          onConfirm={handlePaymentConfirm}
        />
      )}
    </>
  );
}