"use client";

import React, { useState } from 'react';
import { useSuppliers } from '@/hooks/use-suppliers';
import { Plus, Search, Edit, Trash2, User, X, Mail, Phone, MapPin } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SuppliersModule() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const [search, setSearch] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState({ 
    name: '', 
    rif: '', 
    phone: '', 
    email: '', 
    address: '', 
    contactPerson: '' 
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.rif.includes(search)
  );

  const handleSaveSupplier = async () => {
    if (!supplierForm.name || !supplierForm.rif) { 
      alert('Nombre y RIF son requeridos'); 
      return; 
    }
    
    try {
      if (editingSupplier) {
        await updateSupplier({ ...editingSupplier, ...supplierForm });
        alert('Proveedor actualizado correctamente');
      } else {
        await addSupplier(supplierForm);
        alert('Proveedor creado correctamente');
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', rif: '', phone: '', email: '', address: '', contactPerson: '' });
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
      alert('Error al guardar el proveedor');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Está seguro de eliminar este proveedor? Esta acción es permanente.')) {
      await deleteSupplier(id);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black">Directorio de Proveedores</h2>
          <p className="text-sm text-black/50">Crea los perfiles de proveedores para usarlos en el registro de compras</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/50" />
            <Input 
              placeholder="Buscar por nombre o RIF..." 
              className="pl-9 h-10 bg-white border-[#9E9E9E]" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <Button 
            onClick={() => { 
              setEditingSupplier(null); 
              setSupplierForm({ name: '', rif: '', phone: '', email: '', address: '', contactPerson: '' }); 
              setShowSupplierModal(true); 
            }} 
            className="bg-primary hover:brightness-110 text-black font-black"
          >
            <Plus size={18} className="mr-2" /> NUEVO PROVEEDOR
          </Button>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase">Nombre / Razón Social</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">RIF</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Contacto Directo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Ubicación</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-black/30 italic">
                  No hay proveedores registrados. Haz clic en "Nuevo Proveedor" para comenzar.
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((s) => (
                <TableRow key={s.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                  <TableCell className="font-bold text-black">{s.name}</TableCell>
                  <TableCell className="text-black/60 text-xs font-mono">{s.rif}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-black/60"><Phone size={10} /> {s.phone || 'N/A'}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-black/50"><Mail size={10} /> {s.email || 'N/A'}</div>
                      {s.contactPerson && <div className="text-[9px] font-bold text-primary uppercase">Atiende: {s.contactPerson}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-black/60 max-w-[200px] truncate">
                      <MapPin size={10} /> {s.address || 'Sin dirección registrada'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => { 
                          setEditingSupplier(s); 
                          setSupplierForm({ 
                            name: s.name, 
                            rif: s.rif, 
                            phone: s.phone || '', 
                            email: s.email || '', 
                            address: s.address || '', 
                            contactPerson: s.contactPerson || '' 
                          }); 
                          setShowSupplierModal(true); 
                        }} 
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                        title="Editar Perfil"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)} 
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="Eliminar Proveedor"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Proveedor */}
      <Dialog open={showSupplierModal} onOpenChange={setShowSupplierModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingSupplier ? 'Editar Perfil' : 'Nuevo Proveedor'}</DialogTitle>
          </DialogHeader>
          <div className="bg-[#1A2C4E] p-4 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User size={20} className="text-primary" />
                <h3 className="text-lg font-black">{editingSupplier ? 'Editar Perfil' : 'Nuevo Proveedor'}</h3>
              </div>
              <button onClick={() => setShowSupplierModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-black/40 mb-1 block">Nombre / Razón Social *</label>
              <Input placeholder="Ej: Distribuidora Polar C.A." value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-black/40 mb-1 block">RIF (Registro de Información Fiscal) *</label>
              <Input placeholder="J-12345678-0" value={supplierForm.rif} onChange={(e) => setSupplierForm({...supplierForm, rif: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-black/40 mb-1 block">Teléfono</label>
                <Input placeholder="0412-1234567" value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-black/40 mb-1 block">Persona de Contacto</label>
                <Input placeholder="Ej: Juan Pérez" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({...supplierForm, contactPerson: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-black/40 mb-1 block">Correo Electrónico</label>
              <Input placeholder="proveedor@empresa.com" value={supplierForm.email} onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-black/40 mb-1 block">Dirección Fiscal / Depósito</label>
              <Input placeholder="Ubicación de la empresa" value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})} />
            </div>
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSupplierModal(false)}>CANCELAR</Button>
            <Button onClick={handleSaveSupplier} className="bg-primary text-black font-black shadow-md">
              {editingSupplier ? 'ACTUALIZAR PROVEEDOR' : 'CREAR PROVEEDOR'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}