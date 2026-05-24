"use client";

import { useState } from 'react';
import { Page } from '@/lib/types';
import { Store, Boxes, Users, ReceiptText, Vault, LayoutDashboard, Truck, BookOpen, ArrowLeftRight, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
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
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = userRole === 'admin';
  const isCashier = userRole === 'cashier';
  
  const allItems = [
    { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
    { id: 'pos' as Page, icon: Store, label: 'Punto de Venta', adminOnly: false },
    { id: 'inventario' as Page, icon: Boxes, label: 'Inventario', adminOnly: false },
    { id: 'registrar_compra' as Page, icon: ShoppingBag, label: 'Entrada x Compra', adminOnly: false },
    { id: 'clientes' as Page, icon: Users, label: 'Clientes', adminOnly: true },
    { id: 'cuentas' as Page, icon: ReceiptText, label: 'Cuentas', adminOnly: true },
    { id: 'proveedores' as Page, icon: Truck, label: 'Proveedores', adminOnly: false },
    { id: 'contabilidad' as Page, icon: BookOpen, label: 'Contabilidad', adminOnly: true },
    { id: 'devoluciones' as Page, icon: ArrowLeftRight, label: 'Devoluciones', adminOnly: false },
    { id: 'caja' as Page, icon: Vault, label: 'Caja', adminOnly: false },
  ];

  const items = allItems.filter(item => {
    if (isAdmin) {
      // Excluir Punto de Venta y Caja para administradores según solicitud
      if (item.id === 'pos' || item.id === 'caja') return false;
      return true;
    }
    if (isCashier) {
      // Los cajeros no ven módulos marcados como adminOnly
      return !item.adminOnly;
    }
    return false;
  });

  return (
    <aside className={cn(
      "bg-primary border-r border-black/10 flex flex-col py-3 z-50 h-full transition-all duration-200",
      collapsed ? "w-[56px] min-w-[56px]" : "w-[180px] min-w-[180px]"
    )}>
      {/* Logo y botón colapsar */}
      <div className={cn("flex items-center px-2 mb-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-[32px] h-[32px] rounded-lg bg-white/10 flex items-center justify-center shadow-md overflow-hidden shrink-0">
              <Image src="/logo-master.png" alt="MasterPOS" width={32} height={32} className="object-cover w-full h-full" />
            </div>
            <span className="text-black font-headline font-black text-xs leading-tight">Master<span className="text-white/60">POS</span></span>
          </div>
        )}
        {collapsed && (
          <div className="w-[36px] h-[36px] rounded-lg bg-white/10 flex items-center justify-center shadow-md overflow-hidden">
            <Image src="/logo-master.png" alt="MasterPOS" width={36} height={36} className="object-cover w-full h-full" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-black/50 hover:text-black p-1 rounded-md hover:bg-black/5 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      
      <nav className="flex flex-col gap-0.5 flex-1 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full h-[38px] rounded-lg flex items-center gap-2.5 transition-all text-left",
                collapsed ? "justify-center px-0" : "px-3",
                isActive 
                  ? "bg-black/10 text-black font-bold" 
                  : "text-black/60 hover:bg-black/5 hover:text-black"
              )}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="text-xs font-medium truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={cn("mt-auto", collapsed ? "px-1" : "px-2")}>
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  );
}
