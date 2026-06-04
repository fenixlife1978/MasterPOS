"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePOSState } from '@/hooks/use-pos-state';
import { useBarcode } from '@/hooks/use-barcode';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/sidebar';
import Topbar from '@/components/layout/topbar';
import POSModule from '@/components/pos/pos-module';
import ClientsModule from '@/components/customers/clients-module';
import AccountsModule from '@/components/accounts/accounts-module';
import CashModule from '@/components/register/cash-module';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import AccountingModule from '@/components/accounting/accounting-module';
import ReturnsModule from '@/components/returns/returns-module';
import RegisterPurchase from '@/components/inventory/RegisterPurchase';
import InventoryModule from '@/components/inventory/inventory-module';
import SuppliersModule from '@/components/suppliers/suppliers-module';
import { Toaster } from '@/components/ui/toaster';
import { syncService } from '@/services/syncService';
import { Lock } from 'lucide-react';

export default function LicoPOSApp() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const state = usePOSState();
  const { toast } = useToast();
  const [terminalBlocked, setTerminalBlocked] = useState(false);

  // ✅ Suscripción en TIEMPO REAL al bloqueo de terminal para cajeros
  useEffect(() => {
    if (authLoading || !user || user.role === 'admin') {
      setTerminalBlocked(false);
      return;
    }

    if (!user.terminalId) {
      setTerminalBlocked(false);
      return;
    }

    // Suscribirse al estado de la terminal en Firestore
    const unsubscribe = syncService.subscribeToTerminal(user.terminalId, (terminal) => {
      if (terminal) {
        setTerminalBlocked(terminal.isBlocked === true);
      } else {
        setTerminalBlocked(false);
      }
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  // Redirigir según rol y bloqueo
  useEffect(() => {
    if (user && state.isHydrated && !terminalBlocked) {
      const allowedPages = ['dashboard', 'pos', 'inventario', 'clientes', 'cuentas', 'proveedores', 'contabilidad', 'devoluciones', 'caja', 'registrar_compra'];
      if (!allowedPages.includes(state.currentPage)) {
        state.setCurrentPage(user.role === 'admin' ? 'dashboard' : 'pos');
      }
      if (user.role === 'admin' && (state.currentPage === 'pos' || state.currentPage === 'caja')) {
        state.setCurrentPage('dashboard');
      }
      const adminOnlyPages = ['dashboard', 'clientes', 'cuentas', 'contabilidad', 'inventario', 'registrar_compra', 'proveedores'];
      if (user.role === 'cashier' && adminOnlyPages.includes(state.currentPage)) {
        state.setCurrentPage('pos');
      }
    }
  }, [user, state.isHydrated, state.currentPage, terminalBlocked]);

  useBarcode((code) => {
    if (terminalBlocked) {
      toast({ title: "Terminal bloqueada", description: "No se pueden realizar ventas hasta que el administrador la desbloquee.", variant: "destructive" });
      return;
    }
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

  if (authLoading || !state.isHydrated || !user) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-primary font-headline text-lg">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  // Pantalla de bloqueo
  if (terminalBlocked) {
    return (
      <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center">
        <div className="text-center text-white p-6 max-w-md">
          <div className="bg-red-500/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <Lock size={48} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-black mb-2">TERMINAL BLOQUEADA</h1>
          <p className="text-lg mb-6 opacity-80">
            Esta estación de trabajo ha sido bloqueada por el administrador.
          </p>
          <p className="text-sm opacity-60 mb-8">
            Para desbloquear, comuníquese con su supervisor o administrador.
          </p>
        </div>
      </div>
    );
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
          {state.currentPage === 'dashboard' && <AdminDashboard state={state} />}
          {state.currentPage === 'pos' && <POSModule state={state} />}
          {state.currentPage === 'inventario' && <InventoryModule state={state} />}
          {state.currentPage === 'registrar_compra' && <RegisterPurchase />}
          {state.currentPage === 'proveedores' && <SuppliersModule />}
          {state.currentPage === 'clientes' && <ClientsModule state={state} />}
          {state.currentPage === 'cuentas' && <AccountsModule state={state} />}
          {state.currentPage === 'contabilidad' && <AccountingModule />}
          {state.currentPage === 'devoluciones' && <ReturnsModule />}
          {state.currentPage === 'caja' && <CashModule state={state} />}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
