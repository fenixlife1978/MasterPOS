"use client";

import { Client, Account } from '@/lib/types';
import { User, X, Landmark, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientPanelProps {
  clients: Client[];
  accounts: Account[];
  onClose: () => void;
}

export default function ClientPanel({ clients, accounts, onClose }: ClientPanelProps) {
  // Logic for abono payment would go here. Replicating the design for now.
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">
          <User size={18} className="text-primary" /> Detalles de Cliente
        </h2>
        <button onClick={onClose} className="text-muted hover:text-foreground"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <User size={28} />
          </div>
          <div>
            <div className="text-lg font-headline font-black tracking-tight">Seleccione un cliente</div>
            <div className="text-xs text-muted">Inicie una búsqueda para visualizar detalles</div>
          </div>
        </div>
      </div>
    </div>
  );
}
