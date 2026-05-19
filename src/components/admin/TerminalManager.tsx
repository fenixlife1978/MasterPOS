"use client";

import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, X, Check, 
  Computer, Users, MapPin, Power, 
  PowerOff, AlertTriangle, Search 
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Terminal, SystemUser } from '@/lib/types';

interface TerminalManagerProps {
  onClose?: () => void;
}

// Usuarios de prueba eliminados
const AVAILABLE_CASHIERS: SystemUser[] = [];

export default function TerminalManager({ onClose }: TerminalManagerProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [search, setSearch] = useState('');
  
  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    assignedTo: '' as string,
  });

  // Cargar terminales desde localStorage
  useEffect(() => {
    const stored = localStorage.getItem('masterpos_terminals');
    if (stored) {
      setTerminals(JSON.parse(stored));
    } else {
      setTerminals([]);
      localStorage.setItem('masterpos_terminals', JSON.stringify([]));
    }
  }, []);

  // Guardar terminales
  const saveTerminals = (newTerminals: Terminal[]) => {
    setTerminals(newTerminals);
    localStorage.setItem('masterpos_terminals', JSON.stringify(newTerminals));
  };

  const handleSubmit = () => {
    if (!formData.name) {
      alert('El nombre de la terminal es requerido');
      return;
    }

    if (editingTerminal) {
      // Editar
      const updated = terminals.map(t => 
        t.id === editingTerminal.id 
          ? {
              ...t,
              name: formData.name,
              description: formData.description,
              location: formData.location,
              assignedTo: formData.assignedTo ? parseInt(formData.assignedTo) : null,
              updatedAt: new Date().toISOString(),
            }
          : t
      );
      saveTerminals(updated);
    } else {
      // Crear
      const newTerminal: Terminal = {
        id: Date.now(),
        name: formData.name,
        description: formData.description,
        location: formData.location,
        status: 'active',
        assignedTo: formData.assignedTo ? parseInt(formData.assignedTo) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveTerminals([...terminals, newTerminal]);
    }

    resetForm();
    setShowModal(false);
  };

  const handleEdit = (terminal: Terminal) => {
    setEditingTerminal(terminal);
    setFormData({
      name: terminal.name,
      description: terminal.description || '',
      location: terminal.location || '',
      assignedTo: terminal.assignedTo?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Está seguro de eliminar esta terminal?')) {
      const filtered = terminals.filter(t => t.id !== id);
      saveTerminals(filtered);
    }
  };

  const handleStatusToggle = (id: number, currentStatus: string) => {
    const updated = terminals.map(t => 
      t.id === id 
        ? { ...t, status: currentStatus === 'active' ? 'inactive' : 'active' as any, updatedAt: new Date().toISOString() }
        : t
    );
    saveTerminals(updated);
  };

  const resetForm = () => {
    setEditingTerminal(null);
    setFormData({
      name: '',
      description: '',
      location: '',
      assignedTo: '',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-[10px] font-bold"><Power size={10} /> ACTIVA</span>;
      case 'inactive':
        return <span className="flex items-center gap-1 text-red-600 bg-red-100 px-2 py-0.5 rounded-full text-[10px] font-bold"><PowerOff size={10} /> INACTIVA</span>;
      case 'maintenance':
        return <span className="flex items-center gap-1 text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full text-[10px] font-bold"><AlertTriangle size={10} /> MANTENIMIENTO</span>;
      default:
        return null;
    }
  };

  const getAssignedUserName = (userId: number | null) => {
    if (!userId) return '—';
    const user = AVAILABLE_CASHIERS.find(u => u.id === userId);
    return user ? user.name : '—';
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
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
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
                <TableCell className="text-black/60 text-xs flex items-center gap-1"><Users size={10} /> {getAssignedUserName(terminal.assignedTo)}</TableCell>
                <TableCell>{getStatusBadge(terminal.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleStatusToggle(terminal.id, terminal.status)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                      title={terminal.status === 'active' ? 'Desactivar' : 'Activar'}
                    >
                      {terminal.status === 'active' ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-green-500" />}
                    </button>
                    <button
                      onClick={() => handleEdit(terminal)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                    >
                      <Edit size={14} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(terminal.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredTerminals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-black/50 italic">
                  No hay terminales registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de creación/edición */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingTerminal ? 'Editar Terminal' : 'Nueva Terminal'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Computer size={20} className="text-primary" />
                  <h3 className="text-lg font-headline font-black">{editingTerminal ? 'Editar Terminal' : 'Nueva Terminal'}</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Nombre de la Terminal *
                </label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Caja Principal"
                  className="bg-white border-[#9E9E9E]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Descripción
                </label>
                <Input 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Caja principal del local"
                  className="bg-white border-[#9E9E9E]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Ubicación
                </label>
                <Input 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ej: Primer piso - Mostrador central"
                  className="bg-white border-[#9E9E9E]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Asignar a Cajero
                </label>
                <select 
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {AVAILABLE_CASHIERS.map(cashier => (
                    <option key={cashier.id} value={cashier.id}>{cashier.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)} className="px-4 text-black">CANCELAR</Button>
              <Button onClick={handleSubmit} className="px-4 bg-primary text-black font-black">GUARDAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
