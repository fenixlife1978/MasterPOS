"use client";

import { usePOSState } from '@/hooks/use-pos-state';
import { Download } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccountsModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function AccountsModule({ state }: AccountsModuleProps) {
  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-headline font-black text-foreground">Cuentas por Cobrar</h2>
        <Button variant="secondary" className="border-border text-xs font-bold hover:border-primary">
          <Download size={16} className="mr-2" /> EXPORTAR PDF
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-[#111111]">
            <TableRow className="border-border">
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Fecha</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Cliente</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Productos</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Monto BS</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Saldo</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.accounts.map((a) => (
              <TableRow key={a.id} className="border-border hover:bg-secondary/30">
                <TableCell className="text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString('es-VE')}</TableCell>
                <TableCell>
                   <div className="font-bold text-sm">{a.clientName}</div>
                   <div className="text-[10px] text-muted">{a.clientCedula}</div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{a.products}</TableCell>
                <TableCell className="font-bold text-sm">BS {a.amountBs.toFixed(2)}</TableCell>
                <TableCell className={cn(
                  "font-black text-sm",
                  (a.amountBs - a.paidAmount) > 0 ? "text-[#FF0000]" : "text-[#00FF00]"
                )}>
                  BS {(a.amountBs - a.paidAmount).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black border uppercase shadow-sm",
                    a.status === 'pagada' ? "bg-[#00FF00] text-black border-green-700" :
                    a.status === 'parcial' ? "bg-[#F39C12] text-black border-yellow-700" :
                    "bg-[#FF0000] text-black border-red-700"
                  )}>
                    {a.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {state.accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20 text-muted italic">No hay cuentas pendientes</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
