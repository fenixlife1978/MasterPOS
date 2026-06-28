"use client";

import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Computer, Users, MapPin, Power, 
  PowerOff, Search, Lock, Unlock, AlertTriangle, CheckCircle
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import syncService from '@/services/syncService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Terminal {
  id: string;
  name: string;
  description: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedTo: string | null;
  assignedToName?: string | null;
  isBlocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: string;
  terminalId?: string | null;
  terminalName?: string | null;
}

export default function TerminalManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [search, setSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    assignedTo: '',
  });

  // ✅ Cargar datos iniciales y suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        // ✅ Cargar terminales
        const terminalsData = await syncService.getAllTerminals();
        if (isMounted) {
          const terminalsWithDefaults = terminalsData.map((t: any) => ({ 
            ...t, 
            id: t.id || t.name,
            name: t.name || 'Sin nombre',
            location: t.location || '',
            isBlocked: t.isBlocked ?? false,
            assignedToName: t.assignedToName || null,
          }));
          setTerminals(terminalsWithDefaults);
        }

        // ✅ Cargar usuarios
        setIsLoadingUsers(true);
        const usersList = await syncService.getAllUsers();
        if (isMounted) {
          setUsers(usersList as User[]);
        }
        setIsLoadingUsers(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoadingUsers(false);
      }
    };

    loadData();

    // ✅ Suscripción en tiempo real a usuarios (Firestore)
    const unsubscribeUsers = syncService.subscribeToUsers((usersData) => {
      if (isMounted) {
        setUsers(usersData as User[]);
        console.log('🔄 Usuarios actualizados en tiempo real:', usersData.length);
      }
    });

    // ✅ Polling para terminales cada 3 segundos
    const interval = setInterval(async () => {
      try {
        const terminalsData = await syncService.getAllTerminals();
        if (isMounted) {
          const terminalsWithDefaults = terminalsData.map((t: any) => ({ 
            ...t, 
            id: t.id || t.name,
            name: t.name || 'Sin nombre',
            location: t.location || '',
            isBlocked: t.isBlocked ?? false,
            assignedToName: t.assignedToName || null,
          }));
          setTerminals(terminalsWithDefaults);
        }
      } catch (error) {
        console.error('Error polling terminals:', error);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [user]);

  // ✅ Función para recargar todos los datos
  const refreshData = async () => {
    try {
      const terminalsData = await syncService.getAllTerminals();
      const terminalsWithDefaults = terminalsData.map((t: any) => ({ 
        ...t, 
        id: t.id || t.name,
        name: t.name || 'Sin nombre',
        location: t.location || '',
        isBlocked: t.isBlocked ?? false,
        assignedToName: t.assignedToName || null,
      }));
      setTerminals(terminalsWithDefaults);

      const usersList = await syncService.getAllUsers();
      setUsers(usersList as User[]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // ✅ Actualizar terminalId del usuario con nombre
  const updateUserTerminalAssignment = async (userId: string | null, terminalId: string | null, terminalName: string | null = null) => {
    if (!userId) return false;
    try {
      console.log(`📡 Asignando usuario ${userId} a terminal ${terminalName || 'Ninguna'}...`);
      await syncService.updateUserTerminalId(userId, terminalId, terminalName);
      console.log(`✅ Usuario ${userId} asignado a terminal ${terminalName || 'Ninguna'}`);
      
      // ✅ Esperar un momento para que Firestore se actualice
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ✅ Recargar usuarios para obtener los datos actualizados
      const usersList = await syncService.getAllUsers();
      setUsers(usersList as User[]);
      
      return true;
    } catch (error) {
      console.error('Error al actualizar terminalId del usuario:', error);
      return false;
    }
  };

  const isNameUnique = (name: string, excludeId?: string) => {
    return !terminals.some(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== excludeId);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'El nombre de la terminal es requerido', variant: 'destructive' });
      return;
    }

    if (!editingTerminal && !isNameUnique(formData.name)) {
      setNameError('Ya existe una terminal con este nombre');
      toast({ title: 'Error', description: 'Ya existe una terminal con este nombre', variant: 'destructive' });
      return;
    }
    setNameError('');

    setIsSaving(true);

    try {
      const oldAssignedTo = editingTerminal ? editingTerminal.assignedTo : null;
      const newAssignedTo = formData.assignedTo || null;
      
      // ✅ Generar un ID único para la terminal
      const terminalId = editingTerminal ? editingTerminal.id : `term_${Date.now()}`;
      const terminalName = formData.name.trim();

      // ✅ Obtener el usuario seleccionado y su uid
      const selectedUser = users.find(u => u.id === newAssignedTo || u.uid === newAssignedTo);
      const userUid = selectedUser?.uid || selectedUser?.id || newAssignedTo;
      const assignedUserName = selectedUser ? selectedUser.name : null;

      console.log(`📡 Usuario seleccionado:`, { newAssignedTo, userUid, assignedUserName });

      if (editingTerminal && editingTerminal.name !== formData.name) {
        toast({ 
          title: 'Error', 
          description: 'No se puede cambiar el nombre de la terminal. Cree una nueva terminal y elimine esta.', 
          variant: 'destructive' 
        });
        setIsSaving(false);
        return;
      }

      const terminalData = {
        id: terminalId,
        name: terminalName,
        description: formData.description || '',
        location: formData.location || '',
        assignedTo: newAssignedTo,
        assignedToName: assignedUserName,
        status: editingTerminal ? editingTerminal.status : 'active',
        isBlocked: editingTerminal ? (editingTerminal.isBlocked ?? false) : false,
        updatedAt: new Date().toISOString(),
        createdAt: editingTerminal ? editingTerminal.createdAt : new Date().toISOString(),
      };

      // ✅ Guardar terminal en RTDB
      await syncService.saveTerminal(terminalData);
      console.log('✅ Terminal guardada:', terminalData);

      // ✅ Actualizar asignación del usuario
      if (oldAssignedTo !== newAssignedTo) {
        // Desasignar usuario anterior
        if (oldAssignedTo) {
          console.log(`📡 Desasignando usuario anterior: ${oldAssignedTo}`);
          await updateUserTerminalAssignment(oldAssignedTo, null, null);
        }
        
        // Asignar nuevo usuario (usando el uid correcto)
        if (newAssignedTo && userUid) {
          console.log(`📡 Asignando nuevo usuario: ${userUid} -> terminal ${terminalName}`);
          await updateUserTerminalAssignment(userUid, terminalId, terminalName);
        }
      }

      // ✅ Esperar a que Firestore se actualice
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ✅ Recargar todos los datos
      await refreshData();

      toast({ 
        title: '✅ Éxito', 
        description: editingTerminal 
          ? `Terminal "${terminalName}" actualizada correctamente` 
          : `Terminal "${terminalName}" creada correctamente`,
        variant: 'default'
      });

      resetForm();
      setShowModal(false);

    } catch (error) {
      console.error('Error al guardar terminal:', error);
      toast({ 
        title: '❌ Error', 
        description: 'No se pudo guardar la terminal. Intente de nuevo.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (terminal: Terminal) => {
    if (confirm(`¿Eliminar la terminal "${terminal.name}"? Esta acción también desasignará a cualquier usuario.`)) {
      try {
        if (terminal.assignedTo) {
          const userToUnassign = users.find(u => u.id === terminal.assignedTo || u.uid === terminal.assignedTo);
          await updateUserTerminalAssignment(userToUnassign?.uid || terminal.assignedTo, null, null);
        }
        await syncService.deleteTerminal(terminal.id);
        
        await refreshData();
        
        toast({ title: '✅ Eliminada', description: `Terminal "${terminal.name}" eliminada correctamente` });
      } catch (error) {
        console.error('Error al eliminar terminal:', error);
        toast({ title: '❌ Error', description: 'No se pudo eliminar la terminal', variant: 'destructive' });
      }
    }
  };

  const handleStatusToggle = async (terminal: Terminal) => {
    try {
      const updated = {
        ...terminal,
        status: terminal.status === 'active' ? 'inactive' : 'active' as any,
        updatedAt: new Date().toISOString()
      };
      await syncService.saveTerminal(updated);
      
      await refreshData();
      
      toast({ 
        title: '✅ Estado actualizado', 
        description: `Terminal "${terminal.name}" ${updated.status === 'active' ? 'activada' : 'desactivada'}` 
      });
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      toast({ title: '❌ Error', description: 'No se pudo cambiar el estado', variant: 'destructive' });
    }
  };

  const handleToggleBlock = async (terminal: Terminal) => {
    setIsUpdating(true);
    try {
      const newBlocked = !terminal.isBlocked;
      await syncService.updateTerminalBlockStatus(terminal.id, newBlocked);
      
      await refreshData();
      
      toast({ 
        title: '✅ Bloqueo actualizado', 
        description: `Terminal "${terminal.name}" ${newBlocked ? 'bloqueada' : 'desbloqueada'}` 
      });
    } catch (error) {
      console.error('Error al cambiar estado de bloqueo:', error);
      toast({ title: '❌ Error', description: 'No se pudo cambiar el estado de bloqueo', variant: 'destructive' });
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

  // ✅ Obtener nombre del usuario asignado
  const getAssignedUserName = (terminal: Terminal) => {
    if (!terminal.assignedTo) return 'Sin asignar';
    
    // Primero intentar usar el nombre guardado en la terminal
    if (terminal.assignedToName) return terminal.assignedToName;
    
    // Buscar en la lista de usuarios por id o uid
    const found = users.find(u => u.id === terminal.assignedTo || u.uid === terminal.assignedTo);
    if (found) return found.name;
    
    // Buscar por terminalId en los usuarios
    const userWithTerminal = users.find(u => u.terminalId === terminal.id);
    if (userWithTerminal) return userWithTerminal.name;
    
    return 'Usuario no encontrado';
  };

  // Filtrado seguro
  const filteredTerminals = terminals.filter(t => 
    (t.name && t.name.toLowerCase().includes(search.toLowerCase())) ||
    (t.location && t.location.toLowerCase().includes(search.toLowerCase()))
  );

  // ✅ Obtener todos los usuarios disponibles para asignar
  const availableUsers = users.filter(u => u.role === 'user' || u.role === 'cashier' || u.role === 'admin' || u.role === 'supervisor');

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Computer size={20} className="text-primary" />
          <h3 className="text-lg font-black text-black uppercase">Gestión de Terminales / Cajas</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black font-black" />
            <Input 
              placeholder="Buscar terminal..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm w-48 font-black text-black"
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
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Descripción</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Ubicación</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Asignado a</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Estado</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Bloqueo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTerminals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-black font-black text-sm uppercase">
                  No hay terminales registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredTerminals.map((terminal) => (
                <TableRow key={terminal.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                  <TableCell className="font-black text-black text-sm uppercase">{terminal.name}</TableCell>
                  <TableCell className="text-black font-black text-xs uppercase">{terminal.description || '—'}</TableCell>
                  <TableCell className="text-black font-black text-xs uppercase">
                    <div className="flex items-center gap-1">
                      <MapPin size={10} className="flex-shrink-0" />
                      {terminal.location || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-black font-black text-xs uppercase">
                    <div className="flex items-center gap-1">
                      <Users size={10} className="flex-shrink-0" />
                      {isLoadingUsers ? '...' : getAssignedUserName(terminal)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border",
                      terminal.status === 'active' ? "text-green-600 bg-green-100 border-green-200" : "text-red-600 bg-red-100 border-red-200"
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
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black border transition-all",
                        terminal.isBlocked 
                          ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" 
                          : "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
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
              ))
            )}
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
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="p-4 bg-[#1A2C4E] text-white">
            <DialogTitle className="text-lg font-black uppercase">
              {editingTerminal ? 'Editar Terminal' : 'Nueva Terminal'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Nombre de la Terminal *</label>
              <Input 
                value={formData.name} 
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setNameError('');
                }}
                placeholder="Ej: 0001"
                disabled={!!editingTerminal}
                className={cn("h-10 font-black text-black", editingTerminal ? "bg-gray-100" : "")}
              />
              {nameError && (
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1 font-black uppercase">
                  <AlertTriangle size={10} /> {nameError}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Descripción</label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Ej: Terminal principal" 
                className="h-10 font-black text-black"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Ubicación</label>
              <Input 
                value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                placeholder="Ej: Pasillo Central" 
                className="h-10 font-black text-black"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Asignar a Usuario</label>
              <select 
                value={formData.assignedTo} 
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })} 
                className="w-full h-10 border border-[#9E9E9E] rounded-lg px-3 text-sm font-black text-black bg-white"
              >
                <option value="">SIN ASIGNAR</option>
                {availableUsers.map(c => (
                  <option key={c.id} value={c.id || c.uid}>
                    {c.name.toUpperCase()} {c.role ? `(${c.role.toUpperCase()})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[8px] text-black font-black uppercase mt-2">
                {formData.assignedTo 
                  ? `Usuario asignado: ${availableUsers.find(u => u.id === formData.assignedTo || u.uid === formData.assignedTo)?.name || 'Usuario'}` 
                  : 'Ningún usuario asignado a esta terminal'}
              </p>
            </div>
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button 
              variant="ghost" 
              onClick={() => {
                resetForm();
                setShowModal(false);
              }}
              className="font-black text-black"
            >
              CANCELAR
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="bg-primary text-black font-black shadow-md hover:brightness-110"
              disabled={isSaving}
            >
              {isSaving ? 'GUARDANDO...' : 'GUARDAR TERMINAL'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
