"use client";

import { Page } from '@/lib/types';
import { Store, Boxes, Users, ReceiptText, Vault, LayoutDashboard, Truck, BookOpen, ArrowLeftRight } from 'lucide-react';
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
  const isCashier = userRole === 'cashier';
  
  const allItems = [
    { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
    { id: 'pos' as Page, icon: Store, label: 'POS', adminOnly: false },
    { id: 'inventario' as Page, icon: Boxes, label: 'Inventario', adminOnly: true },
    { id: 'clientes' as Page, icon: Users, label: 'Clientes', adminOnly: true },
    { id: 'cuentas' as Page, icon: ReceiptText, label: 'Cuentas', adminOnly: true },
    { id: 'proveedores' as Page, icon: Truck, label: 'Proveedores', adminOnly: true },
    { id: 'contabilidad' as Page, icon: BookOpen, label: 'Contabilidad', adminOnly: true },
    { id: 'devoluciones' as Page, icon: ArrowLeftRight, label: 'Devoluciones', adminOnly: false },
    { id: 'caja' as Page, icon: Vault, label: 'Caja', adminOnly: false },
  ];

  // Filtrar según rol
  const items = allItems.filter(item => {
    if (isAdmin) return true;
    if (isCashier) return !item.adminOnly;
    return false;
  });

  return (
    <aside className="w-[56px] min-w-[56px] bg-primary border-r border-black/10 flex flex-col items-center py-2 z-50 h-full">
      <nav className="flex flex-col gap-1 flex-1 w-full px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-full h-[44px] rounded-xl flex flex-col items-center justify-center transition-all relative group gap-0.5",
                isActive 
                  ? "bg-black/10 text-black" 
                  : "text-black/60 hover:bg-black/5 hover:text-black"
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-tight",
                isActive ? "opacity-100" : "opacity-80"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-[2px] h-5 bg-black rounded-r-md" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-2 pb-2 w-full px-1">
        <LogoutButton variant="sidebar" />
      </div>
    </aside>
  );
}
