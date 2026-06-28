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
        <h3 className="text-lg font-black text-red-600 uppercase">ACCESO RESTRINGIDO</h3>
        <p className="text-sm text-black font-black mt-2 uppercase tracking-widest">Solo los administradores pueden gestionar usuarios del sistema.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <User size={20} className="text-primary" />
          <h3 className="text-lg font-black text-black uppercase">Gestión de Usuarios</h3>
        </div>
        <Button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-primary hover:brightness-110 text-black font-black h-8 px-3 text-xs shadow-md"
        >
          <Plus size={14} className="mr-1" /> NUEVO USUARIO
        </Button>
      </div>

      {message && (
        <div className={cn(
          "mb-4 flex items-center gap-2 p-3 rounded-xl text-xs font-black uppercase border-2 animate-in slide-in-from-top-2",
          message.type === 'success' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        )}>
          {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : (
        <div className="overflow-x-auto border border-[#9E9E9E] rounded-xl">
          <Table>
            <TableHeader className="bg-[#E8E8E8]">
              <TableRow className="border-b border-[#9E9E9E]">
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Nombre completo</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Correo electrónico</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Rol del sistema</TableHead>
                <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5] transition-colors">
                  <TableCell className="font-black text-black text-sm uppercase">{u.name}</TableCell>
                  <TableCell className="text-black font-black text-xs lowercase">{u.email}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black border uppercase shadow-sm", 
                      u.role === 'admin' ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      {u.role === 'admin' ? 'Administrador' : 'Cajero'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => handleResetPassword(u.email)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600 transition-all" title="Enviar reset de clave"><Key size={14} /></button>
                      <button onClick={() => handleEdit(u)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-all"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-all"><Trash2 size={14} /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-black font-black italic uppercase">No hay usuarios registrados</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>{editingUser ? 'Editar' : 'Nuevo'} Usuario</DialogTitle></DialogHeader>
          <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
            <h3 className="text-lg font-black uppercase tracking-wider">{editingUser ? 'Editar' : 'Nuevo'} Usuario</h3>
            <button onClick={() => setShowModal(false)} className="hover:rotate-90 transition-all"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Nombre Completo *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Ana López" className="font-black text-black" /></div>
            <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Correo Electrónico *</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="usuario@masterpos.com" disabled={!!editingUser} className="font-black text-black" /></div>
            {!editingUser && (
              <>
                <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Contraseña *</label><Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="font-black text-black" /></div>
                <div><label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Confirmar Contraseña *</label><Input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="Repita la clave" className="font-black text-black" /></div>
              </>
            )}
            <div>
              <label className="text-[10px] font-black text-black uppercase tracking-widest block mb-1">Rol del Sistema</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })} className="w-full h-10 border border-[#9E9E9E] rounded-lg px-3 text-sm font-black text-black bg-white">
                <option value="cashier">CAJERO</option>
                <option value="admin">ADMINISTRADOR</option>
              </select>
            </div>
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowModal(false)} className="font-black text-black">CANCELAR</Button>
            <Button onClick={handleSubmit} disabled={!!actionLoading} className="bg-primary text-black font-black px-6 shadow-md">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : (editingUser ? 'ACTUALIZAR' : 'CREAR USUARIO')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
