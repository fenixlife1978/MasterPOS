"use client";

import { Page } from '@/lib/types';
import { Store, Boxes, Users, ReceiptText, Vault, LayoutDashboard, Truck, BookOpen, ArrowLeftRight, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import LogoutButton from './LogoutButton';
import Image from 'next/image';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  userRole: string;
  userName: string;
}

export default function Sidebar({ currentPage, onPageChange, userRole }: SidebarProps) {
  const isAdmin = userRole === 'admin';
  const isCashier = userRole === 'cashier';
  
  // Todos los items disponibles
  const allItems = [
    { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'DASH', adminOnly: true },
    { id: 'pos' as Page, icon: Store, label: 'POS', adminOnly: false },
    { id: 'inventario' as Page, icon: Boxes, label: 'INV', adminOnly: true },
    { id: 'clientes' as Page, icon: Users, label: 'CLI', adminOnly: true },
    { id: 'cuentas' as Page, icon: ReceiptText, label: 'CTA', adminOnly: true },
    { id: 'proveedores' as Page, icon: Truck, label: 'PROV', adminOnly: true },
    { id: 'contabilidad' as Page, icon: BookOpen, label: 'CONT', adminOnly: true },
    { id: 'devoluciones' as Page, icon: ArrowLeftRight, label: 'DEV', adminOnly: false },
    { id: 'caja' as Page, icon: Vault, label: 'CAJA', adminOnly: false },
  ];

  // Filtrar según rol
  const items = allItems.filter(item => {
    if (isAdmin) return true;
    if (isCashier) return !item.adminOnly;
    return false;
  });

  return (
    <aside className="w-[60px] min-w-[60px] bg-primary border-r border-black/10 flex flex-col items-center py-3 z-50 h-full">
      {/* Logo cuadrado */}
      <div className="w-[44px] h-[44px] rounded-xl bg-white/10 flex items-center justify-center mb-4 shadow-md overflow-hidden">
        <Image 
          src="/logo-master.png"
          alt="MasterPOS"
          width={44}
          height={44}
          className="object-cover w-full h-full"
        />
      </div>
      
      <nav className="flex flex-col gap-1 w-full px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-full h-[40px] rounded-lg flex flex-col items-center justify-center transition-all relative group gap-0",
                isActive 
                  ? "bg-black/10 text-black" 
                  : "text-black/60 hover:bg-black/5 hover:text-black"
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-tighter",
                isActive ? "opacity-100" : "opacity-80"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-[2px] h-4 bg-black rounded-r-md" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-2 w-full px-1">
        <LogoutButton variant="sidebar" />
      </div>
    </aside>
  );
}
