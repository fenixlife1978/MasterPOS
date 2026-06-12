"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Key, User, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { auth, firebaseConfig } from '@/lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut } from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import syncService from '@/services/syncService';

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'cashier';
  status: 'active' | 'inactive';
  createdAt: string;
}

export default function UserManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'cashier' as 'admin' | 'cashier',
  });

  // ✅ Cargar usuarios desde TURSO (ya no desde Firestore)
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const usersList = await syncService.getAllUsers();
      setUsers(usersList as AppUser[]);
      setMessage(null);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: error.message || 'Error al cargar usuarios' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // ✅ Guardar usuario en TURSO (ya no en Firestore)
  const saveUserToTurso = async (uid: string, name: string, email: string, role: string) => {
    const userData = {
      uid: uid,
      name: name,
      email: email,
      role: role,
      status: 'active',
    };
    await syncService.saveUser(userData);
  };

  const handleSubmit = async () => {
    setMessage(null);
    
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Solo los administradores pueden realizar esta acción.' });
      return;
    }

    if (!formData.email || !formData.name || (!editingUser && !formData.password)) {
      setMessage({ type: 'error', text: 'Todos los campos son requeridos' });
      return;
    }
    
    if (!editingUser && formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    
    setActionLoading(editingUser ? 'edit' : 'create');
    
    try {
      if (editingUser) {
        // ✅ Actualizar usuario en TURSO
        await syncService.saveUser({
          uid: editingUser.id,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: 'active',
        });
        setMessage({ type: 'success', text: 'Usuario actualizado correctamente' });
        await loadUsers();
        setShowModal(false);
        resetForm();
      } else {
        // ✅ Crear usuario en Firebase Auth usando instancia secundaria
        const secondaryApp = getApps().find(a => a.name === 'SecondaryAuth') || initializeApp(firebaseConfig, 'SecondaryAuth');
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const firebaseUser = userCredential.user;
        
        await updateProfile(firebaseUser, { displayName: formData.name });
        
        // ✅ Guardar en TURSO (NO en Firestore)
        await saveUserToTurso(firebaseUser.uid, formData.name, formData.email, formData.role);
        
        // Cerrar sesión en la instancia secundaria
        await signOut(secondaryAuth);
        
        setMessage({ type: 'success', text: `Usuario ${formData.name} creado correctamente.` });
        await loadUsers();
        setShowModal(false);
        resetForm();
      }
    } catch (error: any) {
      console.error('Error en gestión de usuario:', error);
      let errorText = error.message;
      if (error.code === 'auth/email-already-in-use') errorText = 'El correo ya está registrado';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setActionLoading(null);
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
    if (user.id === currentUser?.uid) {
      setMessage({ type: 'error', text: 'No puedes eliminar tu propio usuario.' });
      return;
    }
    if (confirm(`¿Está seguro de eliminar a ${user.name}?`)) {
      setActionLoading(`delete-${user.id}`);
      try {
        // ✅ Eliminar de TURSO
        await syncService.deleteUser(user.id);
        setMessage({ type: 'success', text: `Usuario ${user.name} eliminado.` });
        await loadUsers();
      } catch (error: any) {
        setMessage({ type: 'error', text: 'No se pudo eliminar el usuario: ' + error.message });
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleResetPassword = async (email: string) => {
    setActionLoading(`reset-${email}`);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage({ type: 'success', text: `Correo de recuperación enviado a ${email}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ email: '', name: '', password: '', confirmPassword: '', role: 'cashier' });
  };

  if (!isAdmin && !isLoading) {
    return (
      <div className="bg-white border border-[#9E9E9E] rounded-xl p-8 text-center shadow-md">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-red-600">ACCESO RESTRINGIDO</h3>
        <p className="text-sm text-gray-600 mt-2">Solo los administradores pueden gestionar usuarios del sistema.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <User size={20} className="text-primary" />
          <h3 className="text-lg font-black text-black">Gestión de Usuarios</h3>
        </div>
        <Button 
          onClick={() => { resetForm(); setShowModal(true); }}
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
          {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow className="border-b border-[#9E9E9E]">
                <TableHead className="text-[10px] font-black text-black uppercase">Nombre</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase">Correo</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase">Rol</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                  <TableCell className="font-bold text-black text-sm">{u.name}</TableCell>
                  <TableCell className="text-black/60 text-xs">{u.email}</TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", u.role === 'admin' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
                      {u.role === 'admin' ? 'Administrador' : 'Cajero'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleResetPassword(u.email)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Enviar reset de clave"><Key size={14} className="text-orange-500" /></button>
                      <button onClick={() => handleEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit size={14} className="text-blue-500" /></button>
                      <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg hover:bg-gray-100"><Trash2 size={14} className="text-red-500" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>{editingUser ? 'Editar' : 'Nuevo'} Usuario</DialogTitle></DialogHeader>
          <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
            <h3 className="text-lg font-black">{editingUser ? 'Editar' : 'Nuevo'} Usuario</h3>
            <button onClick={() => setShowModal(false)}><X size={18} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Nombre Completo *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Ana López" /></div>
            <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Correo Electrónico *</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="usuario@masterpos.com" disabled={!!editingUser} /></div>
            {!editingUser && (
              <>
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Contraseña *</label><Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
                <div><label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Confirmar Contraseña *</label><Input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="Repita la clave" /></div>
              </>
            )}
            <div>
              <label className="text-[10px] font-bold text-black/60 uppercase block mb-1">Rol del Sistema</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })} className="w-full h-10 border border-[#9E9E9E] rounded-lg px-3 text-sm">
                <option value="cashier">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowModal(false)}>CANCELAR</Button>
            <Button onClick={handleSubmit} disabled={!!actionLoading} className="bg-primary text-black font-black">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : (editingUser ? 'ACTUALIZAR' : 'CREAR')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}