"use client";

import { Page } from '@/lib/types';
import { Store, Boxes, Users, ReceiptText, Vault } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const items = [
    { id: 'pos' as Page, icon: Store, label: 'POS' },
    { id: 'inventario' as Page, icon: Boxes, label: 'Inventario' },
    { id: 'clientes' as Page, icon: Users, label: 'Clientes' },
    { id: 'cuentas' as Page, icon: ReceiptText, label: 'Cuentas' },
    { id: 'caja' as Page, icon: Vault, label: 'Caja' },
  ];

  return (
    <aside className="w-[72px] min-w-[72px] bg-card border-r border-border flex flex-col items-center py-4 z-50">
      <div className="w-[44px] h-[44px] orange-gradient rounded-xl flex items-center justify-center font-headline font-black text-lg text-black mb-6 shrink-0 shadow-lg">
        LP
      </div>
      
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center transition-all relative group gap-0.5",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-tight",
                isActive ? "opacity-100" : "opacity-80"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-md" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}