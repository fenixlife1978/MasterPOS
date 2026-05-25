"use client";

import React, { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { UserPlus, Search, Phone, MapPin, X, Edit, Trash2 } from 'lucide-react';
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
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Cédula</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Nombre</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Contacto</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Deuda</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((c) => {
                const hasDebt = c.debt > 0;
                
                return (
                  <TableRow key={c.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
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
                          onClick={() => {
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
                          onClick={() => handleDeleteClient(c)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-black/50 italic">No se encontraron clientes</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal Nuevo Cliente */}
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

      {/* Modal Editar Cliente */}
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
    </>
  );
}