"use client";

import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, X, 
  Computer, Users, MapPin, Power, 
  PowerOff, AlertTriangle, Search, Loader2 
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { syncService } from '@/services/syncService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface Terminal {
  id: number;
  name: string;
  description: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Cashier {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TerminalManager() {
  const { user } = useAuth();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [search, setSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    assignedTo: '',
  });

  useEffect(() => {
    if (!user) return;

    const unsub = syncService.subscribeToTerminals(setTerminals as any);
    
    const loadCashiers = async () => {
      setIsLoadingUsers(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'cashier'));
        const querySnapshot = await getDocs(q);
        const cashiersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          email: doc.data().email,
          role: doc.data().role
        })) as Cashier[];
        setCashiers(cashiersList);
      } catch (error) {
        console.error('Error loading cashiers:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadCashiers();
    return () => unsub();
  }, [user]);

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('El nombre de la terminal es requerido');
      return;
    }

    const terminalData = {
      id: editingTerminal ? editingTerminal.id : Date.now(),
      name: formData.name,
      description: formData.description,
      location: formData.location,
      assignedTo: formData.assignedTo || null,
      status: editingTerminal ? editingTerminal.status : 'active',
      updatedAt: new Date().toISOString(),
      createdAt: editingTerminal ? editingTerminal.createdAt : new Date().toISOString(),
    };

    await syncService.saveTerminal(terminalData);
    resetForm();
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Está seguro de eliminar esta terminal?')) {
      await syncService.deleteTerminal(id);
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
  };

  const getAssignedUserName = (userId: string | null) => {
    if (!userId) return 'Sin asignar';
    const cashier = cashiers.find(c => c.id === userId);
    return cashier ? cashier.name : 'Usuario no encontrado';
  };

  const filteredTerminals = terminals.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.location.toLowerCase().includes(search.toLowerCase())
  );

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
              <TableHead className="text-[10px] font-black text-black uppercase text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTerminals.map((terminal) => (
              <TableRow key={terminal.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                <TableCell className="font-bold text-black text-sm">{terminal.name}</TableCell>
                <TableCell className="text-black/60 text-xs">{terminal.description || '—'}</TableCell>
                <TableCell className="text-black/60 text-xs flex items-center gap-1"><MapPin size={10} /> {terminal.location || '—'}</TableCell>
                <TableCell className="text-black/60 text-xs flex items-center gap-1">
                  <Users size={10} /> 
                  {isLoadingUsers ? '...' : getAssignedUserName(terminal.assignedTo)}
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                    terminal.status === 'active' ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"
                  )}>
                    {terminal.status === 'active' ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => handleStatusToggle(terminal)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      {terminal.status === 'active' ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-green-500" />}
                    </button>
                    <button onClick={() => handleEdit(terminal)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <Edit size={14} className="text-blue-500" />
                    </button>
                    <button onClick={() => handleDelete(terminal.id)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal corregido */}
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                placeholder="Ej: Caja Principal" 
                autoFocus
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