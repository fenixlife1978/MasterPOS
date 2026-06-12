"use client";

import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Computer, Users, MapPin, Power, 
  PowerOff, Search, Lock, Unlock, AlertTriangle
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import syncService from '@/services/syncService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface Terminal {
  id: string;
  name: string;
  description: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedTo: string | null;
  isBlocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  terminalId?: string | null;
}

export default function TerminalManager() {
  const { user } = useAuth();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [search, setSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [nameError, setNameError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    assignedTo: '',
  });

  useEffect(() => {
    if (!user) return;

    // Usar suscripción en tiempo real
    const unsub = syncService.subscribeToTerminalsRealtime((data: any[]) => {
      // Asegurar que cada terminal tenga propiedades básicas
      const terminalsWithDefaults = data.map(t => ({ 
        ...t, 
        id: t.id || t.name,
        name: t.name || 'Sin nombre',
        location: t.location || '',
        isBlocked: t.isBlocked ?? false 
      }));
      setTerminals(terminalsWithDefaults);
    });
    
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        // ✅ CAMBIO: Usar syncService en lugar de Firestore
        const usersList = await syncService.getAllUsers();
        setUsers(usersList as User[]);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
    return () => unsub();
  }, [user]);

  // Actualizar terminalId del usuario
  const updateUserTerminalAssignment = async (userId: string | null, terminalId: string | null) => {
    if (!userId) return;
    try {
      await syncService.updateUserTerminalId(userId, terminalId);
    } catch (error) {
      console.error('Error al actualizar terminalId del usuario:', error);
    }
  };

  const isNameUnique = (name: string, excludeId?: string) => {
    return !terminals.some(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== excludeId);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('El nombre de la terminal es requerido');
      return;
    }

    if (!editingTerminal && !isNameUnique(formData.name)) {
      setNameError('Ya existe una terminal con este nombre');
      return;
    }
    setNameError('');

    const oldAssignedTo = editingTerminal ? editingTerminal.assignedTo : null;
    const newAssignedTo = formData.assignedTo || null;
    const terminalId = formData.name;

    if (editingTerminal && editingTerminal.name !== formData.name) {
      alert('No se puede cambiar el nombre de la terminal. Cree una nueva terminal y elimine esta.');
      return;
    }

    const terminalData = {
      id: terminalId,
      name: formData.name,
      description: formData.description,
      location: formData.location,
      assignedTo: newAssignedTo,
      status: editingTerminal ? editingTerminal.status : 'active',
      isBlocked: editingTerminal ? (editingTerminal.isBlocked ?? false) : false,
      updatedAt: new Date().toISOString(),
      createdAt: editingTerminal ? editingTerminal.createdAt : new Date().toISOString(),
    };

    await syncService.saveTerminal(terminalData);

    if (oldAssignedTo !== newAssignedTo) {
      if (oldAssignedTo) {
        await updateUserTerminalAssignment(oldAssignedTo, null);
      }
      if (newAssignedTo) {
        await updateUserTerminalAssignment(newAssignedTo, terminalId);
      }
    }

    resetForm();
    setShowModal(false);
  };

  const handleDelete = async (terminal: Terminal) => {
    if (confirm(`¿Eliminar la terminal "${terminal.name}"? Esta acción también desasignará a cualquier usuario.`)) {
      if (terminal.assignedTo) {
        await updateUserTerminalAssignment(terminal.assignedTo, null);
      }
      await syncService.deleteTerminal(terminal.id);
    }
  };

  const handleStatusToggle = async (terminal: Terminal) => {
    const updated = {
      ...terminal,
      status: terminal.status === 'active' ? 'inactive' : 'active' as any,
      updatedAt: new Date().toISOString()
    };
    await syncService.saveTerminal(updated);
  };

  const handleToggleBlock = async (terminal: Terminal) => {
    setIsUpdating(true);
    try {
      const newBlocked = !terminal.isBlocked;
      await syncService.updateTerminalBlockStatus(terminal.id, newBlocked);
      setTerminals(prev => prev.map(t => 
        t.id === terminal.id ? { ...t, isBlocked: newBlocked, updatedAt: new Date().toISOString() } : t
      ));
    } catch (error) {
      console.error('Error al cambiar estado de bloqueo:', error);
      alert('No se pudo cambiar el estado de bloqueo');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEdit = (terminal: Terminal) => {
    setEditingTerminal(terminal);
    setFormData({
      name: terminal.name,
      description: terminal.description || '',
      location: terminal.location || '',
      assignedTo: terminal.assignedTo || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingTerminal(null);
    setFormData({ name: '', description: '', location: '', assignedTo: '' });
    setNameError('');
  };

  const getAssignedUserName = (userId: string | null) => {
    if (!userId) return 'Sin asignar';
    const found = users.find(u => u.id === userId);
    return found ? found.name : 'Usuario no encontrado';
  };

  // ✅ Filtrado seguro (con validación para evitar undefined)
  const filteredTerminals = terminals.filter(t => 
    (t.name && t.name.toLowerCase().includes(search.toLowerCase())) ||
    (t.location && t.location.toLowerCase().includes(search.toLowerCase()))
  );

  const cashiers = users.filter(u => u.role === 'cashier');

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Computer size={20} className="text-primary" />
          <h3 className="text-lg font-black text-black">Gestión de Terminales / Cajas</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
            <Input 
              placeholder="Buscar terminal..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm w-48"
            />
          </div>
          <Button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-primary hover:brightness-110 text-black font-black h-8 px-3 text-xs"
          >
            <Plus size={14} className="mr-1" /> NUEVA TERMINAL
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase">Nombre</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Descripción</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Ubicación</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Asignado a</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Estado</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Bloqueo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTerminals.map((terminal) => (
              <TableRow key={terminal.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                <TableCell className="font-bold text-black text-sm">{terminal.name}</TableCell>
                <TableCell className="text-black/60 text-xs">{terminal.description || '—'}</TableCell>
                <TableCell className="text-black/60 text-xs">
                  <div className="flex items-center gap-1">
                    <MapPin size={10} className="flex-shrink-0" />
                    {terminal.location || '—'}
                  </div>
                </TableCell>
                <TableCell className="text-black/60 text-xs">
                  <div className="flex items-center gap-1">
                    <Users size={10} className="flex-shrink-0" />
                    {isLoadingUsers ? '...' : getAssignedUserName(terminal.assignedTo)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                    terminal.status === 'active' ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      terminal.status === 'active' ? "bg-green-600" : "bg-red-600"
                    )} />
                    {terminal.status === 'active' ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleBlock(terminal)}
                    disabled={isUpdating}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all",
                      terminal.isBlocked 
                        ? "bg-red-100 text-red-700 hover:bg-red-200" 
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    )}
                  >
                    {terminal.isBlocked ? <Lock size={10} /> : <Unlock size={10} />}
                    {terminal.isBlocked ? 'BLOQUEADA' : 'DESBLOQUEADA'}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => handleStatusToggle(terminal)} className="p-1.5 rounded-lg hover:bg-gray-100" title={terminal.status === 'active' ? 'Desactivar' : 'Activar'}>
                      {terminal.status === 'active' ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-green-500" />}
                    </button>
                    <button onClick={() => handleEdit(terminal)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar">
                      <Edit size={14} className="text-blue-500" />
                    </button>
                    <button onClick={() => handleDelete(terminal)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Eliminar">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => {
        if (!open) {
          setShowModal(false);
          resetForm();
        } else {
          setShowModal(true);
        }
      }}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 bg-[#1A2C4E] text-white">
            <DialogTitle className="text-lg font-black">{editingTerminal ? 'Editar Terminal' : 'Nueva Terminal'}</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Nombre de la Terminal *</label>
              <Input 
                value={formData.name} 
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setNameError('');
                }}
                placeholder="Ej: Caja Principal"
                disabled={!!editingTerminal}
                className={editingTerminal ? "bg-gray-100" : ""}
              />
              {nameError && (
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> {nameError}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Descripción</label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Ej: Terminal de entrada principal" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Ubicación</label>
              <Input 
                value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                placeholder="Ej: Pasillo Central" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Asignar a Cajero</label>
              <select 
                value={formData.assignedTo} 
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })} 
                className="w-full h-10 border border-[#9E9E9E] rounded-lg px-3 text-sm"
              >
                <option value="">Sin asignar</option>
                {cashiers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowModal(false)}>CANCELAR</Button>
            <Button onClick={handleSubmit} className="bg-primary text-black font-black">GUARDAR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}