"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Vault, Lock, Unlock, FileText, Share2, Printer, CreditCard, Banknote, Smartphone, Fingerprint, Plane, DollarSign } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CashModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function CashModule({ state }: CashModuleProps) {
  const [openAmount, setOpenAmount] = useState('0.00');

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  const totalContado = reg?.txs.filter(t => t.type === 'contado' || t.type === 'cobro_deuda').reduce((s,t) => s + t.total, 0) || 0;
  const totalCredito = reg?.txs.filter(t => t.type === 'credito').reduce((s,t) => s + t.total, 0) || 0;

  // Distribución por método de pago (asegurando que todos los métodos clave aparezcan)
  const paymentDistribution = useMemo(() => {
    const methods = ['efectivo_bs', 'tarjeta', 'usd_efectivo', 'biopago', 'pago_movil', 'zelle'];
    const dist: Record<string, number> = {};
    
    // Inicializar todos con 0
    methods.forEach(m => dist[m] = 0);
    
    if (reg) {
      reg.txs.forEach(t => {
        if (t.type === 'contado' || t.type === 'cobro_deuda') {
          // Sumar si el método está en nuestra lista predefinida
          if (dist[t.payMethod] !== undefined) {
            dist[t.payMethod] += t.total;
          } else {
            // Para métodos no predefinidos (como créditos antiguos)
            dist[t.payMethod] = (dist[t.payMethod] || 0) + t.total;
          }
        }
      });
    }
    return Object.entries(dist).map(([method, total]) => ({ method, total }));
  }, [reg]);

  const methodIcons: Record<string, any> = {
    efectivo_bs: Banknote,
    tarjeta: CreditCard,
    usd_efectivo: DollarSign,
    biopago: Fingerprint,
    pago_movil: Smartphone,
    zelle: Plane,
  };

  const methodLabels: Record<string, string> = {
    efectivo_bs: 'Efectivo BS',
    tarjeta: 'Tarjeta',
    usd_efectivo: 'USD Efectivo',
    biopago: 'Biopago',
    pago_movil: 'Pago Móvil',
    zelle: 'Zelle',
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <h2 className="text-2xl font-headline font-black text-foreground mb-6">Gestión de Bóveda</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <div className="text-2xl font-black text-foreground">BS {reg.openAmount.toFixed(2)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
              <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 text-[#2ECC71]">Total en Caja</div>
              <div className="text-2xl font-black text-[#2ECC71]">BS {(reg.openAmount + totalContado).toFixed(2)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
              <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 text-[#F39C12]">Ventas Crédito</div>
              <div className="text-2xl font-black text-[#F39C12]">BS {totalCredito.toFixed(2)}</div>
            </div>
          </>
        )}
      </div>

      {!isClosed && (
        <div className="mb-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
            <Vault size={14} className="text-primary" /> Distribución por Método
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {paymentDistribution.map(({ method, total }) => {
              const Icon = methodIcons[method] || DollarSign;
              return (
                <div key={method} className="bg-card/50 border border-border rounded-xl p-3 flex flex-col items-center justify-center text-center group hover:border-primary/40 transition-all">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Icon size={16} />
                  </div>
                  <div className="text-[9px] font-black uppercase text-muted tracking-tighter">{methodLabels[method] || method}</div>
                  <div className="text-sm font-bold text-foreground">BS {total.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              className="bg-primary hover:bg-primary/90 text-black font-black h-11 px-8"
            >
              <Unlock size={18} className="mr-2" /> ABRIR CAJA
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <Button variant="destructive" className="font-black h-11 px-8" onClick={() => state.closeCashRegister()}>
              <Lock size={18} className="mr-2" /> CERRAR CAJA
            </Button>
            <Button variant="secondary" className="border-border text-xs font-bold h-11 text-foreground"><FileText size={16} className="mr-2" /> EXPORTAR PDF</Button>
            <Button variant="secondary" className="border-border text-xs font-bold h-11 text-foreground"><Printer size={16} className="mr-2" /> IMPRIMIR</Button>
            <Button variant="secondary" className="border-border text-xs font-bold h-11 text-foreground"><Share2 size={16} className="mr-2" /> COMPARTIR</Button>
          </div>
        )}
      </div>

      <h3 className="text-sm font-black uppercase tracking-widest text-muted mb-4">Historial de Transacciones</h3>
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
