"use client";

import { useState, useEffect } from 'react';
import { Mail, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase';
import { updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

interface AdminSettingsProps {
  onClose?: () => void;
}

export default function AdminSettings({ onClose }: AdminSettingsProps) {
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user && user.email) {
      setCurrentEmail(user.email);
      setNewEmail(user.email);
    } else {
      // Fallback para demo (cuando no hay autenticación real)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setCurrentEmail(userData.email || 'admin@masterpos.com');
          setNewEmail(userData.email || 'admin@masterpos.com');
        } catch (e) {}
      }
    }
  }, []);

  const handleSave = async () => {
    setMessage(null);
    
    if (!newEmail) {
      setMessage({ type: 'error', text: 'El correo electrónico es requerido' });
      return;
    }
    
    if (newEmail !== confirmEmail) {
      setMessage({ type: 'error', text: 'Los correos electrónicos no coinciden' });
      return;
    }
    
    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      setMessage({ type: 'error', text: 'Ingrese un correo electrónico válido' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const user = auth.currentUser;
      
      if (user && user.email) {
        // Reautenticar antes de cambiar email (requiere contraseña)
        if (!password) {
          setMessage({ type: 'error', text: 'Ingrese su contraseña para confirmar el cambio' });
          setIsLoading(false);
          return;
        }
        
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        
        // Cambiar email
        await updateEmail(user, newEmail);
        
        // Actualizar localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.email = newEmail;
          localStorage.setItem('user', JSON.stringify(userData));
        }
        
        setCurrentEmail(newEmail);
        setMessage({ type: 'success', text: 'Correo electrónico actualizado correctamente' });
        setPassword('');
        
        setTimeout(() => {
          if (onClose) onClose();
        }, 2000);
      } else {
        // Modo demo (sin Firebase Auth real)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.email = newEmail;
          localStorage.setItem('user', JSON.stringify(userData));
        }
        setCurrentEmail(newEmail);
        setMessage({ type: 'success', text: 'Correo electrónico actualizado correctamente (Demo)' });
        
        setTimeout(() => {
          setMessage(null);
          if (onClose) onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error updating email:', error);
      
      if (error.code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Contraseña incorrecta' });
      } else if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Por favor, cierre sesión y vuelva a iniciar para cambiar el correo' });
      } else if (error.code === 'auth/email-already-in-use') {
        setMessage({ type: 'error', text: 'El correo ya está en uso por otra cuenta' });
      } else if (error.code === 'auth/invalid-email') {
        setMessage({ type: 'error', text: 'Correo electrónico inválido' });
      } else {
        setMessage({ type: 'error', text: error.message || 'Error al actualizar el correo' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#9E9E9E] rounded-xl p-5 shadow-md">
      <h3 className="text-base font-black text-black mb-4 flex items-center gap-2">
        <Mail size={18} className="text-primary" />
        Configuración de Administrador
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
            Correo actual
          </label>
          <Input 
            value={currentEmail}
            disabled
            className="bg-[#F5F5F5] border-[#9E9E9E] text-black/60"
          />
        </div>
        
        <div>
          <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
            Nuevo correo
          </label>
          <Input 
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nuevo@masterpos.com"
            className="bg-white border-[#9E9E9E] text-black"
          />
        </div>
        
        <div>
          <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
            Confirmar nuevo correo
          </label>
          <Input 
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="nuevo@masterpos.com"
            className="bg-white border-[#9E9E9E] text-black"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">
            Contraseña actual *
          </label>
          <Input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingrese su contraseña actual"
            className="bg-white border-[#9E9E9E] text-black"
          />
          <p className="text-[8px] text-black/40 mt-1">* Requerido para confirmar el cambio</p>
        </div>
        
        {message && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg text-xs",
            message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}>
            {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </div>
        )}
        
        <Button 
          onClick={handleSave}
          disabled={isLoading}
          className="w-full bg-primary hover:brightness-110 text-black font-black"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="mr-2 animate-spin" />
              Actualizando...
            </>
          ) : (
            <>
              <Save size={14} className="mr-2" />
              Guardar cambios
            </>
          )}
        </Button>
        
        <p className="text-[8px] text-black/40 text-center">
          El cambio de correo es inmediato. Deberá usar el nuevo correo para futuros inicios de sesión.
        </p>
      </div>
    </div>
  );
}
