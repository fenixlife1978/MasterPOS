"use client";

import { Page } from '@/lib/types';
import { Store, Boxes, Users, ReceiptText, Vault, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import LogoutButton from './LogoutButton';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  userRole: string;
  userName: string;
}

export default function Sidebar({ currentPage, onPageChange, userRole }: SidebarProps) {
  const isAdmin = userRole === 'admin';
  
  // Todos los items disponibles
  const allItems = [
    { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
    { id: 'pos' as Page, icon: Store, label: 'POS', adminOnly: false },
    { id: 'inventario' as Page, icon: Boxes, label: 'Inventario', adminOnly: true },
    { id: 'clientes' as Page, icon: Users, label: 'Clientes', adminOnly: true },
    { id: 'cuentas' as Page, icon: ReceiptText, label: 'Cuentas', adminOnly: true },
    { id: 'caja' as Page, icon: Vault, label: 'Caja', adminOnly: false },
  ];

  // Filtrar según rol
  const items = allItems.filter(item => isAdmin ? true : !item.adminOnly);

  return (
    <aside className="w-[72px] min-w-[72px] bg-primary border-r border-black/10 flex flex-col items-center py-4 z-50 h-full">
      <div className="w-[44px] h-[44px] bg-primary-foreground/10 rounded-xl flex items-center justify-center font-headline font-black text-lg text-black mb-6 shrink-0 shadow-sm border border-black/20">
        MP
      </div>
      
      <nav className="flex flex-col gap-1.5 flex-1">
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
                  ? "bg-black/10 text-black" 
                  : "text-black/60 hover:bg-black/5 hover:text-black"
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
                <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[3px] h-6 bg-black rounded-r-md" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Botón de cerrar sesión al final del sidebar */}
      <div className="mt-auto pt-4">
        <LogoutButton variant="sidebar" />
      </div>
    </aside>
  );
}
