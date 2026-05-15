"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Vault, Lock, Unlock, FileText, Share2, Printer } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CashModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function CashModule({ state }: CashModuleProps) {
  const [openAmount, setOpenAmount] = useState('0.00');

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  const totalContado = reg?.txs.filter(t => t.type === 'contado' || t.type === 'cobro_deuda').reduce((s,t) => s + t.total, 0) || 0;
  const totalCredito = reg?.txs.filter(t => t.type === 'credito').reduce((s,t) => s + t.total, 0) || 0;

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <h2 className="text-2xl font-headline font-black text-foreground mb-6">Gestión de Bóveda</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-xl relative overflow-hidden">
           <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Estado Actual</div>
           <div className={cn("text-2xl font-black", isClosed ? "text-destructive" : "text-[#2ECC71]")}>
             {isClosed ? 'CERRADA' : 'ABIERTA'}
           </div>
           <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rounded-bl-full" />
        </div>

        {!isClosed && (
          <>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
              <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 text-primary">Apertura</div>
              <div className="text-2xl font-black">BS {reg.openAmount.toFixed(2)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
              <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 text-[#2ECC71]">Ventas Contado</div>
              <div className="text-2xl font-black text-[#2ECC71]">BS {totalContado.toFixed(2)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
              <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 text-[#F39C12]">Ventas Crédito</div>
              <div className="text-2xl font-black text-[#F39C12]">BS {totalCredito.toFixed(2)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
              <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 text-primary">Total Caja</div>
              <div className="text-2xl font-black text-primary">BS {(reg.openAmount + totalContado).toFixed(2)}</div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mb-8">
        {isClosed ? (
          <div className="flex items-end gap-3 bg-card p-6 rounded-2xl border border-border shadow-2xl">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">Monto Inicial (BS)</label>
              <Input 
                type="number" 
                value={openAmount} 
                onChange={(e) => setOpenAmount(e.target.value)}
                className="w-48 bg-background border-border text-lg font-black text-center"
              />
            </div>
            <Button 
              onClick={() => state.openCashRegister(parseFloat(openAmount) || 0)}
              className="bg-primary hover:bg-primary/90 text-background font-black h-11 px-8"
            >
              <Unlock size={18} className="mr-2" /> ABRIR CAJA
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <Button variant="destructive" className="font-black h-11 px-8" onClick={() => state.closeCashRegister()}>
              <Lock size={18} className="mr-2" /> CERRAR CAJA
            </Button>
            <Button variant="secondary" className="border-border text-xs font-bold h-11"><FileText size={16} className="mr-2" /> EXPORTAR PDF</Button>
            <Button variant="secondary" className="border-border text-xs font-bold h-11"><Printer size={16} className="mr-2" /> IMPRIMIR</Button>
            <Button variant="secondary" className="border-border text-xs font-bold h-11"><Share2 size={16} className="mr-2" /> COMPARTIR</Button>
          </div>
        )}
      </div>

      <h3 className="text-base font-headline font-black mb-4">Historial de Transacciones de hoy</h3>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-[#111111]">
            <TableRow className="border-border">
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Hora</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Tipo</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Método</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Monto BS</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest text-right">Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reg?.txs.map((t) => (
              <TableRow key={t.id} className="border-border hover:bg-secondary/30">
                <TableCell className="text-xs text-muted-foreground">{new Date(t.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    t.type === 'contado' ? "bg-[#2ECC711A] text-[#2ECC71] border-[#2ECC7133]" :
                    t.type === 'credito' ? "bg-[#F39C121A] text-[#F39C12] border-[#F39C1233]" :
                    "bg-[#3498DB1A] text-[#3498DB] border-[#3498DB33]"
                  )}>
                    {t.type.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-bold uppercase text-muted-foreground">{t.payMethod.replace('_', ' ')}</TableCell>
                <TableCell className="font-bold text-sm">BS {t.total.toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium text-xs text-muted-foreground">{t.clientName || 'CLIENTE FINAL'}</TableCell>
              </TableRow>
            ))}
            {(!reg || reg.txs.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted italic">Sin movimientos registrados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
