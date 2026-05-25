"use client";

import { useState } from 'react';
import { X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AuthorizationModalProps {
  onClose: () => void;
  onConfirm: (type: 'colaboracion' | 'consumo_propio', motivo: string, pin: string) => void;
  isVerifying: boolean;
}

export default function AuthorizationModal({ onClose, onConfirm, isVerifying }: AuthorizationModalProps) {
  const [operationType, setOperationType] = useState<'colaboracion' | 'consumo_propio'>('colaboracion');
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = () => {
    if (!motivo.trim()) {
      alert('Debe ingresar un motivo');
      return;
    }
    if (!pin.trim()) {
      alert('Debe ingresar el PIN de autorización');
      return;
    }
    onConfirm(operationType, motivo, pin);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
          <h3 className="text-base font-black flex items-center gap-2">
            <ShieldCheck size={18} /> Autorización Requerida
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-700 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>Esta operación restará stock sin generar ingreso financiero. Requiere autorización de supervisor.</span>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-black/60 block mb-1">Tipo de Operación</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOperationType('colaboracion')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-bold rounded-lg border transition-all",
                  operationType === 'colaboracion' ? "bg-primary text-black border-primary" : "bg-gray-100 text-black/60 border-gray-300"
                )}
              >
                Colaboración / Donación
              </button>
              <button
                type="button"
                onClick={() => setOperationType('consumo_propio')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-bold rounded-lg border transition-all",
                  operationType === 'consumo_propio' ? "bg-primary text-black border-primary" : "bg-gray-100 text-black/60 border-gray-300"
                )}
              >
                Consumo Propio
              </button>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-black/60 block mb-1">Motivo de la Salida</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ej: Apoyo a comando policial, Atención a proveedores VIP, Degustación interna..."
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-black/60 block mb-1">PIN de Autorización (Supervisor)</label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="font-mono text-center text-base"
              placeholder="••••••"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isVerifying} className="flex-1 bg-emerald-600 text-white font-black">
              {isVerifying ? 'Verificando...' : 'PROCESAR SALIDA'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}