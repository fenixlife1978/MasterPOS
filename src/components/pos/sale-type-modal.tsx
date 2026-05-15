"use client";

import { Wallet, Handshake, X } from 'lucide-react';

interface SaleTypeModalProps {
  onClose: () => void;
  onSelect: (type: 'contado' | 'credito') => void;
}

export default function SaleTypeModal({ onClose, onSelect }: SaleTypeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-headline font-black flex items-center gap-2">
            <Wallet size={24} className="text-primary" /> Tipo de Venta
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => onSelect('contado')}
            className="group p-6 rounded-xl border-2 border-border bg-[#111111] hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-[#2ECC711A] text-[#2ECC71] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet size={32} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">Contado</span>
          </button>

          <button 
            onClick={() => onSelect('credito')}
            className="group p-6 rounded-xl border-2 border-border bg-[#111111] hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-[#F39C121A] text-[#F39C12] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Handshake size={32} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">Crédito</span>
          </button>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-2.5 rounded-lg border border-border text-muted font-bold text-xs hover:text-foreground transition-colors"
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
}
