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
    <aside className="w-[84px] min-w-[84px] bg-primary border-r border-border/10 flex flex-col items-center py-6 z-50">
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-headline font-black text-xl text-secondary mb-10 shrink-0 shadow-lg">
        LP
      </div>
      
      <nav className="flex flex-col gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-[64px] h-[64px] rounded-xl flex flex-col items-center justify-center transition-all relative group",
                isActive 
                  ? "bg-black/10 text-black" 
                  : "text-black/60 hover:bg-black/5 hover:text-black"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[10px] mt-1 font-bold uppercase tracking-tight",
                isActive ? "opacity-100" : "opacity-60"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[4px] h-8 bg-black rounded-r-md shadow-sm" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
