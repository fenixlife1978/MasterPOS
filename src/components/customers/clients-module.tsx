"use client";

import { usePOSState } from '@/hooks/use-pos-state';
import { UserPlus, Search, Phone, MapPin } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ClientsModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function ClientsModule({ state }: ClientsModuleProps) {
  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-headline font-black text-foreground">Registro de Clientes</h2>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder="Buscar cliente..." className="pl-9 h-10 bg-card border-border" />
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-background font-black">
            <UserPlus size={18} className="mr-2" /> NUEVO CLIENTE
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-[#111111]">
            <TableRow className="border-border">
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Cédula</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Nombre</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Contacto</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest">Deuda</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted tracking-widest text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.clients.map((c) => (
              <TableRow key={c.id} className="border-border hover:bg-secondary/30">
                <TableCell className="font-mono text-[11px] text-muted-foreground">{c.cedula}</TableCell>
                <TableCell className="font-bold text-sm">{c.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone size={10} /> {c.phone}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted max-w-[200px] truncate"><MapPin size={10} /> {c.address}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    c.debt > 0 ? "bg-[#E74C3C1A] text-[#E74C3C] border-[#E74C3C33]" : "bg-[#2ECC711A] text-[#2ECC71] border-[#2ECC7133]"
                  )}>
                    BS {c.debt.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-xs text-primary font-bold hover:bg-primary/10">DETALLES</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
