"use client";

import { useState, useEffect } from 'react';
import { Mail, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AdminSettingsProps {
  onClose?: () => void;
}

export default function AdminSettings({ onClose }: AdminSettingsProps) {
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setCurrentEmail(userData.email || 'admin@masterpos.com');
        setNewEmail(userData.email || 'admin@masterpos.com');
      } catch (e) {}
    } else {
      setCurrentEmail('admin@masterpos.com');
      setNewEmail('admin@masterpos.com');
    }
  }, []);

  const handleSave = () => {
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
    
    // Actualizar en localStorage
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        userData.email = newEmail;
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (e) {}
    }
    
    // También actualizar la credencial en memoria (demo)
    setCurrentEmail(newEmail);
    setMessage({ type: 'success', text: 'Correo electrónico actualizado correctamente' });
    setIsLoading(false);
    
    setTimeout(() => {
      setMessage(null);
      if (onClose) onClose();
    }, 2000);
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
          <Save size={14} className="mr-2" />
          {isLoading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        
        <p className="text-[8px] text-black/40 text-center">
          Nota: En producción, los cambios se sincronizarían con la base de datos
        </p>
      </div>
    </div>
  );
}
