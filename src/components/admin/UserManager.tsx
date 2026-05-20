"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Key, Mail, User, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, deleteDoc, updateDoc } from 'firebase/firestore';

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'cashier';
  status: 'active' | 'inactive';
  createdAt: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'cashier' as 'admin' | 'cashier',
  });

  // Cargar usuarios desde Firestore
  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => doc.data() as AppUser);
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async () => {
    setMessage(null);
    
    if (!formData.email || !formData.name || !formData.password) {
      setMessage({ type: 'error', text: 'Todos los campos son requeridos' });
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    
    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (editingUser) {
        // Actualizar solo en Firestore (el email no se puede cambiar fácilmente en Auth)
        const userRef = doc(db, 'users', editingUser.id);
        await updateDoc(userRef, {
          name: formData.name,
          role: formData.role,
        });
        setMessage({ type: 'success', text: 'Usuario actualizado correctamente' });
        await loadUsers();
      } else {
        // 1. Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const firebaseUser = userCredential.user;
        
        // 2. Actualizar el perfil con el nombre
        await updateProfile(firebaseUser, { displayName: formData.name });
        
        // 3. Crear documento en Firestore
        const newUser: AppUser = {
          id: firebaseUser.uid,
          email: formData.email,
          name: formData.name,
          role: formData.role,
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        
        const userRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(userRef, newUser);
        
        setMessage({ type: 'success', text: `Usuario ${formData.name} (${formData.role === 'admin' ? 'Administrador' : 'Cajero'}) creado correctamente` });
        await loadUsers();
      }
      
      resetForm();
      setShowModal(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (firebaseError: any) {
      console.error('Error:', firebaseError);
      if (firebaseError.code === 'auth/email-already-in-use') {
        setMessage({ type: 'error', text: 'El correo ya está registrado' });
      } else {
        setMessage({ type: 'error', text: firebaseError.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      confirmPassword: '',
      role: user.role,
    });
    setShowModal(true);
  };

  const handleDelete = async (user: AppUser) => {
    if (confirm(`¿Está seguro de eliminar a ${user.name}?`)) {
      try {
        // Eliminar documento de Firestore
        const userRef = doc(db, 'users', user.id);
        await deleteDoc(userRef);
        
        setMessage({ type: 'success', text: `Usuario ${user.name} eliminado de Firestore` });
        await loadUsers();
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Error deleting user:', error);
        setMessage({ type: 'error', text: 'Error al eliminar usuario' });
      }
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage({ type: 'success', text: `Correo de recuperación enviado a ${email}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
      role: 'cashier',
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Administrador</span>;
      case 'cashier':
        return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Cajero</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <User size={20} className="text-primary" />
          <h3 className="text-lg font-black text-black">Gestión de Usuarios</h3>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-primary hover:brightness-110 text-black font-black h-8 px-3 text-xs"
        >
          <Plus size={14} className="mr-1" /> NUEVO USUARIO
        </Button>
      </div>

      {message && (
        <div className={cn(
          "mb-4 flex items-center gap-2 p-2 rounded-lg text-xs",
          message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {message.type === 'success' ? <CheckIcon size={14} /> : <AlertIcon size={14} />}
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase">Nombre</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Correo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Rol</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase">Estado</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                <TableCell className="font-bold text-black text-sm">{user.name}</TableCell>
                <TableCell className="text-black/60 text-xs">{user.email}</TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    ACTIVO
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleResetPassword(user.email)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                      title="Enviar correo de recuperación"
                    >
                      <Key size={14} className="text-orange-500" />
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                    >
                      <Edit size={14} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                    >
                      <TrashIcon size={14} className="text-red-500" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-black/50 italic">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <User size={20} className="text-primary" />
                  <h3 className="text-lg font-headline font-black">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Nombre completo *
                </label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Ana López"
                  className="bg-white border-[#9E9E9E]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Correo electrónico *
                </label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@masterpos.com"
                  className="bg-white border-[#9E9E9E]"
                  disabled={!!editingUser}
                />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                      Contraseña *
                    </label>
                    <Input 
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="bg-white border-[#9E9E9E]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                      Confirmar contraseña *
                    </label>
                    <Input 
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="bg-white border-[#9E9E9E]"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
                  Rol
                </label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'cashier' })}
                  className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm"
                >
                  <option value="admin">Administrador</option>
                  <option value="cashier">Cajero</option>
                </select>
              </div>
            </div>
            <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)} className="px-4 text-black">CANCELAR</Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="px-4 bg-primary text-black font-black">
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : (editingUser ? 'ACTUALIZAR' : 'CREAR')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Iconos helper
const CheckIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const TrashIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 6h18"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
