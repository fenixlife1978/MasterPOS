"use client";

import { useState, useMemo } from 'react';
import { Client, CartItem } from '@/lib/types';
import { Handshake, X, Search, UserPlus, UserCheck, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface CreditModalProps {
  cart: CartItem[];
  clients: Client[];
  exchangeRate: number; // Tasa actual del POS
  total: number; // ✅ RECIBIR EL TOTAL YA CALCULADO (con o sin IVA según el estado del POS)
  onClose: () => void;
  onConfirm: (data: any) => void;
}

export default function CreditModal({ cart, clients, exchangeRate, total, onClose, onConfirm }: CreditModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [isNewMode, setIsNewMode] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', cedula: '', phone: '', address: '' });

  // ✅ Usar el total recibido como prop, NO recalcular
  const totalUsd = total / exchangeRate;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.cedula.toLowerCase().includes(q));
  }, [query, clients]);

  const handleConfirm = () => {
    if (isNewMode) {
      if (!newClient.name || !newClient.cedula) return;
      onConfirm({
        method: 'credito',
        isNewClient: true,
        clientName: newClient.name,
        clientCedula: newClient.cedula,
        clientPhone: newClient.phone,
        clientAddress: newClient.address,
        exchangeRate: exchangeRate,
        totalBs: total,
        totalUsd: totalUsd
      });
    } else if (selected) {
      onConfirm({ 
        method: 'credito', 
        clientId: selected.id, 
        clientName: selected.name, 
        clientCedula: selected.cedula,
        exchangeRate: exchangeRate,
        totalBs: total,
        totalUsd: totalUsd
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1A2C4E] border border-white/20 rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-headline font-black flex items-center gap-2 text-white">
            <Handshake size={24} className="text-primary" /> Venta a Crédito
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Mostrar Tasa BCV actual que se guardará */}
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Tasa BCV al momento</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-white">1 USD = {formatBsNumber(exchangeRate)}</p>
              <p className="text-[8px] text-amber-400/70">Esta tasa quedará registrada permanentemente</p>
            </div>
          </div>
        </div>

        {!isNewMode ? (
          <>
            <div className="flex items-center bg-[#0F1E3A] border border-white/20 rounded-lg px-3 mb-4">
              <Search size={14} className="text-white/60" />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente por nombre o cédula..."
                className="flex-1 bg-transparent border-none text-sm px-3 py-2.5 focus:outline-none text-white placeholder:text-white/40"
              />
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 mb-4 scrollbar-thin">
              {results.length === 0 && query && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-white/60">No se encontraron resultados</p>
                  <button 
                    onClick={() => setIsNewMode(true)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    + REGISTRAR COMO NUEVO CLIENTE
                  </button>
                </div>
              )}
              {results.map(c => (
                <button 
                  key={c.id} 
                  onClick={() => setSelected(c)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                    selected?.id === c.id ? "bg-primary/20 border border-primary" : "bg-[#0F1E3A] border border-white/10 hover:border-white/30"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <UserCheck size={14} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{c.name}</div>
                    <div className="text-[10px] text-white/50">{c.cedula}</div>
                  </div>
                  {c.debt > 0 && <div className="text-xs text-[#FF6B6B] font-bold">Deuda: {formatBs(c.debt)}</div>}
                </button>
              ))}
            </div>
            
            {!query && (
              <button 
                onClick={() => setIsNewMode(true)}
                className="w-full py-3 mb-4 border border-dashed border-white/30 rounded-xl text-xs font-bold text-white/70 hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={14} /> REGISTRAR NUEVO CLIENTE
              </button>
            )}
          </>
        ) : (
          <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-primary tracking-widest uppercase">Datos del Nuevo Cliente</span>
              <button onClick={() => setIsNewMode(false)} className="text-[10px] text-white/50 font-bold hover:text-white">VOLVER A BUSCAR</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="Nombre Completo" 
                value={newClient.name}
                onChange={e => setNewClient({...newClient, name: e.target.value})}
                className="bg-[#0F1E3A] border border-white/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary text-white placeholder:text-white/40"
              />
              <input 
                type="text" 
                placeholder="Cédula / RIF" 
                value={newClient.cedula}
                onChange={e => setNewClient({...newClient, cedula: e.target.value})}
                className="bg-[#0F1E3A] border border-white/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary text-white placeholder:text-white/40"
              />
              <input 
                type="text" 
                placeholder="Teléfono" 
                value={newClient.phone}
                onChange={e => setNewClient({...newClient, phone: e.target.value})}
                className="bg-[#0F1E3A] border border-white/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary text-white placeholder:text-white/40"
              />
              <input 
                type="text" 
                placeholder="Dirección" 
                value={newClient.address}
                onChange={e => setNewClient({...newClient, address: e.target.value})}
                className="bg-[#0F1E3A] border border-white/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary text-white placeholder:text-white/40"
              />
            </div>
          </div>
        )}

        <div className="bg-[#0F1E3A] border border-white/20 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/60">Cliente:</span>
            <span className="font-bold text-white">
              {isNewMode ? (newClient.name || 'Nuevo Cliente...') : (selected ? selected.name : 'No seleccionado')}
            </span>
          </div>
          {!isNewMode && selected && (
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/60">Deuda actual:</span>
              <span className="font-bold text-[#FF6B6B]">{formatBs(selected?.debt || 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs pt-2 mt-2 border-t border-white/20">
            <span className="text-white/60">Nuevo crédito (Bs):</span>
            <span className="font-black text-primary">{formatBs(total)}</span>
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-white/60">Equivalente en USD:</span>
            <span className="font-black text-amber-400">{formatUsd(totalUsd)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 py-3 rounded-lg border border-white/30 bg-[#0F1E3A] text-white font-bold text-sm hover:bg-[#1A2C4E] hover:border-white/50 transition-all"
          >
            CANCELAR
          </button>
          <button 
            disabled={isNewMode ? (!newClient.name || !newClient.cedula) : !selected}
            onClick={handleConfirm}
            className="flex-1 py-3 bg-primary rounded-lg text-black font-black text-sm hover:brightness-110 disabled:opacity-30 transition-all"
          >
            CONFIRMAR CRÉDITO
          </button>
        </div>
      </div>
    </div>
  );
}