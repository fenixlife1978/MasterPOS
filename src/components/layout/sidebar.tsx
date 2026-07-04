"use client";

import { useState } from 'react';
import { Page } from '@/lib/types';
import { Store, Boxes, Receipt, Vault, LayoutDashboard, Truck, BookOpen, ArrowLeftRight, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
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
    { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'DASHBOARD', adminOnly: true },
    { id: 'pos' as Page, icon: Store, label: 'VENTA (POS)', adminOnly: false },
    { id: 'inventario' as Page, icon: Boxes, label: 'INVENTARIO', adminOnly: true },
    { id: 'registrar_compra' as Page, icon: ShoppingBag, label: 'ENTRADA COMPRA', adminOnly: true },
    { id: 'cuentas' as Page, icon: Receipt, label: 'CUENTAS', adminOnly: true },
    { id: 'proveedores' as Page, icon: Truck, label: 'PROVEEDORES', adminOnly: true },
    { id: 'contabilidad' as Page, icon: BookOpen, label: 'CONTABILIDAD', adminOnly: true },
    { id: 'devoluciones' as Page, icon: ArrowLeftRight, label: 'DEVOLUCIONES', adminOnly: false },
    { id: 'caja' as Page, icon: Vault, label: 'CAJA', adminOnly: false },
  ];

  const items = allItems.filter(item => {
    if (isAdmin) {
      if (item.id === 'pos' || item.id === 'caja') return false;
      return true;
    }
    if (isCashier) {
      const cashierAllowed = ['pos', 'devoluciones', 'caja'];
      return cashierAllowed.includes(item.id);
    }
    return false;
  });

  return (
    <aside className={cn(
      "bg-primary border-r-4 border-black flex flex-col h-full transition-all duration-200 shadow-2xl",
      collapsed ? "w-[70px] min-w-[70px]" : "w-[240px] min-w-[240px]",
      "overflow-y-auto"
    )}>
      {/* Logo y botón colapsar - sticky para que siempre esté visible */}
      <div className={cn(
        "sticky top-0 bg-primary z-10 pt-4 pb-4 border-b-2 border-black/10",
        collapsed ? "flex justify-center" : "flex justify-between items-center px-4"
      )}>
        <div className={cn("flex items-center", collapsed && "justify-center")}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-[40px] h-[40px] rounded-xl bg-black flex items-center justify-center shadow-lg overflow-hidden shrink-0 border-2 border-white/20">
                <Image src="/logo-master.png" alt="MasterPOS" width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <span className="text-black font-headline font-black text-xl leading-tight tracking-tighter">Master<span className="text-white">POS</span></span>
            </div>
          )}
          {collapsed && (
            <div className="w-[44px] h-[44px] rounded-xl bg-black flex items-center justify-center shadow-lg overflow-hidden border-2 border-white/20">
              <Image src="/logo-master.png" alt="MasterPOS" width={44} height={44} className="object-cover w-full h-full" />
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-black hover:bg-black hover:text-white p-2 rounded-xl transition-all shrink-0 border border-black/20 shadow-sm"
        >
          {collapsed ? <ChevronRight size={20} className="font-black" /> : <ChevronLeft size={20} className="font-black" />}
        </button>
      </div>
      
      <nav className="flex flex-col gap-1.5 flex-1 px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full rounded-xl flex items-center gap-3.5 transition-all text-left group",
                collapsed ? "justify-center px-0 h-[50px]" : "px-4 h-[50px]",
                isActive 
                  ? "bg-black text-primary shadow-xl scale-[1.02]" 
                  : "text-black font-black hover:bg-black/10"
              )}
            >
              <Icon size={isActive ? 24 : 20} className={cn("shrink-0", isActive ? "text-primary" : "text-black")} />
              {!collapsed && <span className="text-[13px] font-black tracking-widest">{item.label}</span>}
            </button>
          );
        })}
      </nav>
      
      {/* Botón de cierre de sesión - siempre visible al final del scroll */}
      <div className="px-3 py-6 mt-auto border-t-2 border-black/10 sticky bottom-0 bg-primary">
        {collapsed ? (
          <div className="flex justify-center">
            <LogoutButton collapsed={true} />
          </div>
        ) : (
          <div className="bg-black/5 p-2 rounded-2xl border border-black/10">
            <LogoutButton collapsed={false} />
          </div>
        )}
      </div>
    </aside>
  );
}
