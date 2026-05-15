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
    { id: 'inventario' as Page, icon: Boxes, label: 'Stock' },
    { id: 'clientes' as Page, icon: Users, label: 'Clientes' },
    { id: 'cuentas' as Page, icon: ReceiptText, label: 'Cuentas' },
    { id: 'caja' as Page, icon: Vault, label: 'Caja' },
  ];

  return (
    <aside className="w-[72px] min-w-[72px] bg-[#111111] border-r border-border flex flex-col items-center py-4 z-50">
      <div className="w-11 h-11 bg-gradient-to-br from-primary to-[#A67C00] rounded-lg flex items-center justify-center font-headline font-black text-lg text-background mb-6 shrink-0">
        LP
      </div>
      
      <nav className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center transition-all relative group",
                isActive 
                  ? "bg-[#D4A01726] text-primary" 
                  : "text-muted hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon size={18} />
              <span className="text-[9px] mt-1 font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-sm" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
