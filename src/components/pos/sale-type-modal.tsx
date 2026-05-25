"use client";

import { Wallet, Handshake, X, Gift } from 'lucide-react';

interface SaleTypeModalProps {
  onClose: () => void;
  onSelect: (type: 'contado' | 'credito' | 'colaboracion' | 'consumo_propio') => void;
}

export default function SaleTypeModal({ onClose, onSelect }: SaleTypeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1A2C4E] border border-white/20 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-headline font-black flex items-center gap-2 text-white">
            <Wallet size={24} className="text-primary" /> Tipo de Venta
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => onSelect('contado')}
            className="group p-6 rounded-xl border-2 border-white/20 bg-[#D5E8D4] hover:bg-[#C5E0C4] hover:border-white/40 transition-all flex flex-col items-center gap-3 shadow-md hover:shadow-lg"
          >
            <div className="w-16 h-16 rounded-full bg-[#2ECC71] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Wallet size={32} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-black">Contado</span>
          </button>

          <button 
            onClick={() => onSelect('credito')}
            className="group p-6 rounded-xl border-2 border-white/20 bg-[#FFE4C4] hover:bg-[#FFD8B0] hover:border-white/40 transition-all flex flex-col items-center gap-3 shadow-md hover:shadow-lg"
          >
            <div className="w-16 h-16 rounded-full bg-[#F39C12] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Handshake size={32} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-black">Crédito</span>
          </button>

          <button 
            onClick={() => onSelect('colaboracion')}
            className="col-span-2 group p-6 rounded-xl border-2 border-white/20 bg-[#E8D5B7] hover:bg-[#DECEAB] hover:border-white/40 transition-all flex flex-col items-center gap-3 shadow-md hover:shadow-lg"
          >
            <div className="w-16 h-16 rounded-full bg-[#9B59B6] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Gift size={32} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-black">Colaboraciones / Consumo</span>
          </button>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow-md"
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
}