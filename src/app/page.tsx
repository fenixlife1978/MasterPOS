"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePOSState } from '@/hooks/use-pos-state';
import { useBarcode } from '@/hooks/use-barcode';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/sidebar';
import Topbar from '@/components/layout/topbar';
import POSModule from '@/components/pos/pos-module';
import InventoryModule from '@/components/inventory/inventory-module';
import ClientsModule from '@/components/customers/clients-module';
import AccountsModule from '@/components/accounts/accounts-module';
import CashModule from '@/components/register/cash-module';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import { Toaster } from '@/components/ui/toaster';

export default function LicoPOSApp() {
  const [user, setUser] = useState<{ name: string; role: string; email?: string } | null>(null);
  const router = useRouter();
  const state = usePOSState();
  const { toast } = useToast();

  // Verificar autenticación
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  useBarcode((code) => {
    const product = state.products.find(p => p.barcode === code);
    if (product) {
      if (state.currentPage === 'pos') {
        if (!state.register?.isOpen) {
          toast({ title: "Caja Cerrada", description: "Debe abrir la caja antes de vender.", variant: "destructive" });
          return;
        }
        const added = state.addToCart(product.id);
        if (added) {
          toast({ title: "Agregado", description: `${product.name} al carrito.` });
        }
      }
    } else {
      toast({ title: "Desconocido", description: `Código ${code} no encontrado.`, variant: "destructive" });
    }
  });

  if (!state.isHydrated || !user) return <div className="bg-background min-h-screen flex items-center justify-center text-primary font-headline text-2xl">Cargando...</div>;

  const isAdmin = user.role === 'admin';
  const isCashier = user.role === 'cashier';

  // Admin puede acceder a dashboard y todo, Cajero solo POS y Caja
  const allowedPages = isAdmin 
    ? ['dashboard', 'pos', 'inventario', 'clientes', 'cuentas', 'caja']
    : ['pos', 'caja'];

  if (!allowedPages.includes(state.currentPage)) {
    state.setCurrentPage('pos');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-background">
      <Sidebar 
        currentPage={state.currentPage} 
        onPageChange={state.setCurrentPage}
        userRole={user.role}
        userName={user.name}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Topbar 
          register={state.register} 
          rate={state.exchangeRate} 
          onRateChange={state.setExchangeRate}
        />
        
        <div className="flex-1 overflow-hidden relative">
          {state.currentPage === 'dashboard' && isAdmin && <AdminDashboard state={state} />}
          {state.currentPage === 'pos' && <POSModule state={state} />}
          {state.currentPage === 'inventario' && isAdmin && <InventoryModule state={state} />}
          {state.currentPage === 'clientes' && isAdmin && <ClientsModule state={state} />}
          {state.currentPage === 'cuentas' && isAdmin && <AccountsModule state={state} />}
          {state.currentPage === 'caja' && <CashModule state={state} />}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
