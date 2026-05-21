"use client";

import React, { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { UserPlus, Search, Phone, MapPin, ChevronDown, ChevronRight, Eye, X, Calendar, Receipt, Package, History, Edit, Trash2 } from 'lucide-react';
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
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [newClientData, setNewClientData] = useState({
    name: '',
    cedula: '',
    phone: '',
    address: '',
    debt: 0
  });

  const filteredClients = state.clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.cedula.toLowerCase().includes(search.toLowerCase())
  );

  const getClientAccounts = (clientId: number) => {
    return state.accounts
      .filter(a => a.clientId === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getAbonosForClient = (clientId: number) => {
    return state.transactions
      .filter(t => t.type === 'cobro_deuda' && t.clientId === clientId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const handleClientClick = (clientId: number) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  const handleAccountClick = (account: any) => {
    setSelectedAccount(account);
    setShowDetailModal(true);
  };

  const handleNewClient = async () => {
    if (!newClientData.name || !newClientData.cedula) {
      alert('El nombre y cédula son requeridos');
      return;
    }

    const nextId = Date.now();
    const newClient = {
      id: nextId,
      ...newClientData,
      debt: 0
    };

    await state.saveClient(newClient);
    setNewClientData({ name: '', cedula: '', phone: '', address: '', debt: 0 });
    setShowNewClientModal(false);
    alert('Cliente creado correctamente en el servidor');
  };

  const handleEditClient = async () => {
    if (!editingClient) return;
    
    await state.saveClient(editingClient);
    setShowEditClientModal(false);
    setEditingClient(null);
    alert('Cliente actualizado correctamente');
  };

  const handleDeleteClient = async (client: any) => {
    if (confirm(`¿Está seguro de eliminar a ${client.name} PERMANENTEMENTE del sistema? Esta acción no se puede deshacer.`)) {
      await state.deleteClient(client.id);
      alert('Cliente eliminado correctamente de la base de datos central');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
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
            <Button 
              onClick={() => setShowNewClientModal(true)}
              className="bg-primary hover:bg-primary/90 text-black font-black shadow-md"
            >
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
                        {isExpanded ? <ChevronDown size={16} className="text-black/60" /> : <ChevronRight size={16} className="text-black/60" />}
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
                          hasDebt ? "bg-red-100 text-red-700 border-red-300" : "bg-green-100 text-green-700 border-green-300"
                        )}>
                          BS {c.debt.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-blue-500 hover:bg-blue-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingClient(c);
                              setShowEditClientModal(true);
                            }}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-red-500 hover:bg-red-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClient(c);
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-[#FAFAFA]">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-4 border-t border-[#9E9E9E]">
                            <div className="text-[11px] font-black text-black/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <Receipt size={12} /> HISTORIAL DE CRÉDITOS
                            </div>
                            {clientAccounts.length === 0 ? (
                              <div className="text-center py-6 text-black/40 italic text-sm">No hay créditos registrados</div>
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
                                        isPaid ? "bg-green-50 border-green-200" : isPartial ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
                                      )}
                                    >
                                      <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 text-center">
                                          <Calendar size={14} className="text-black/40 mx-auto mb-1" />
                                          <span className="text-[9px] font-bold text-black/60">{formatDateShort(account.date)}</span>
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-xs text-black/70 line-clamp-1 max-w-md">{account.products}</div>
                                          <div className="flex items-center gap-3 mt-1">
                                            <span className={cn(
                                              "text-[9px] font-bold px-2 py-0.5 rounded-full",
                                              isPaid ? "bg-green-200 text-green-700" : isPartial ? "bg-yellow-200 text-yellow-700" : "bg-red-200 text-red-700"
                                            )}>
                                              {account.status === 'pagada' ? 'PAGADA' : account.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-bold text-black">BS {account.amountBs.toFixed(2)}</div>
                                        {!isPaid && <div className="text-[11px] font-bold text-red-600">Saldo: BS {remaining.toFixed(2)}</div>}
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
                  <TableCell colSpan={6} className="text-center py-10 text-black/50 italic">No se encontraron clientes</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modales se mantienen iguales pero llamando a las funciones actualizadas */}
      <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only"><DialogTitle>Nuevo Cliente</DialogTitle></DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><UserPlus size={20} className="text-primary" /><h3 className="text-lg font-headline font-black">Nuevo Cliente</h3></div>
                <button onClick={() => setShowNewClientModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Nombre completo *</label>
              <Input value={newClientData.name} onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })} placeholder="Ej: Juan Pérez" className="bg-white border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Cédula / RIF *</label>
              <Input value={newClientData.cedula} onChange={(e) => setNewClientData({ ...newClientData, cedula: e.target.value })} placeholder="V-12345678" className="bg-white border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Teléfono</label>
              <Input value={newClientData.phone} onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })} placeholder="0412-1234567" className="bg-white border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Dirección</label>
              <Input value={newClientData.address} onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })} placeholder="Dirección del cliente" className="bg-white border-[#9E9E9E]" /></div>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowNewClientModal(false)} className="px-4 text-black">CANCELAR</Button>
              <Button onClick={handleNewClient} className="px-4 bg-primary text-black font-black">CREAR CLIENTE</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditClientModal} onOpenChange={setShowEditClientModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only"><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Edit size={20} className="text-primary" /><h3 className="text-lg font-headline font-black">Editar Cliente</h3></div>
                <button onClick={() => setShowEditClientModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Nombre completo *</label>
              <Input value={editingClient?.name || ''} onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })} className="bg-white border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Cédula / RIF *</label>
              <Input value={editingClient?.cedula || ''} onChange={(e) => setEditingClient({ ...editingClient, cedula: e.target.value })} className="bg-white border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Teléfono</label>
              <Input value={editingClient?.phone || ''} onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })} className="bg-white border-[#9E9E9E]" /></div>
              <div><label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Dirección</label>
              <Input value={editingClient?.address || ''} onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })} className="bg-white border-[#9E9E9E]" /></div>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowEditClientModal(false)} className="px-4 text-black">CANCELAR</Button>
              <Button onClick={handleEditClient} className="px-4 bg-primary text-black font-black">GUARDAR CAMBIOS</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Crédito</DialogTitle></DialogHeader>
          {selectedAccount && (
            <div className="flex flex-col h-full">
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
                <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 hover:opacity-70"><X size={20} /></button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center"><Receipt size={24} className="text-primary" /></div>
                  <div><h3 className="text-xl font-black">Detalle del Crédito</h3><p className="text-white/60 text-sm">#{selectedAccount.txId} • {selectedAccount.clientName}</p></div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
                  <div><label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Fecha</label><p className="text-sm font-bold text-black">{formatDate(selectedAccount.date)}</p></div>
                  <div><label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Tipo</label><p className="text-sm font-bold text-black uppercase">CRÉDITO</p></div>
                  <div><label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Monto Total</label><p className="text-lg font-black text-black">BS {selectedAccount.amountBs.toFixed(2)}</p></div>
                  <div><label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Estado</label><p className={cn("inline-block px-3 py-1 rounded-full text-[10px] font-bold", selectedAccount.status === 'pagada' ? "bg-green-100 text-green-700" : selectedAccount.status === 'parcial' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{selectedAccount.status === 'pagada' ? 'PAGADA' : selectedAccount.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}</p></div>
                </div>
                <div className="bg-[#F5F5F5] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-black/60">Monto Total:</span><span className="font-bold text-black">BS {selectedAccount.amountBs.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-black/60">Monto Pagado:</span><span className="font-bold text-green-600">BS {(selectedAccount.paidAmount || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#9E9E9E]"><span className="text-black/60">Saldo Pendiente:</span><span className="font-bold text-red-600">BS {(selectedAccount.amountBs - (selectedAccount.paidAmount || 0)).toFixed(2)}</span></div>
                </div>
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end sticky bottom-0">
                <Button onClick={() => setShowDetailModal(false)} className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]">CERRAR</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}