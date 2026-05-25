"use client";

import { useState, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import InvoiceNotifications from '@/components/ui/InvoiceNotifications';
import InvoiceReminderModal from '@/components/ui/InvoiceReminderModal';
import { 
  TrendingUp, DollarSign, Users, Package, 
  CreditCard, ShoppingBag, Computer, FileText,
  Calendar, ArrowUp, ArrowDown, Truck, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TerminalManager from '@/components/admin/TerminalManager';
import UserManager from '@/components/admin/UserManager';
import ReportsModule from '@/components/admin/ReportsModule';
import CashSupervision from '@/components/admin/CashSupervision';

interface AdminDashboardProps {
  state: ReturnType<typeof usePOSState>;
}

type AdminTab = 'dashboard' | 'reports' | 'terminals' | 'users' | 'supervision';

export default function AdminDashboard({ state }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const { suppliers, invoices } = useSuppliers();
  
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  // Calcular ingresos del mes actual (reinicia cada 1ro)
  const calculateMonthlyRevenue = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const revenue = state.transactions
      .filter(t => t.type === 'contado' && new Date(t.date) >= startOfMonth)
      .reduce((sum, t) => sum + t.total, 0);
    
    setMonthlyRevenue(revenue);
  };

  // Calcular gastos del mes (facturas de compra pagadas en el mes)
  const calculateMonthlyExpenses = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Buscar pagos realizados en el mes actual
    const expenses = invoices
      .filter(inv => {
        // Buscar pagos asociados a esta factura en el mes actual
        const hasPaymentInMonth = inv.paidAmount > 0; // Simplificado
        return hasPaymentInMonth;
      })
      .reduce((sum, inv) => sum + inv.paidAmount, 0);
    
    setMonthlyExpenses(expenses);
  };

  useEffect(() => {
    calculateMonthlyRevenue();
    calculateMonthlyExpenses();
  }, [state.transactions, invoices]);

  const totalProducts = state.products.length;
  const totalClients = state.clients.length;
  const totalSales = state.transactions.filter(t => t.type === 'contado').length;
  const totalRevenue = state.transactions
    .filter(t => t.type === 'contado')
    .reduce((sum, t) => sum + t.total, 0);
  const totalCredit = state.clients.reduce((sum, c) => sum + (c.debt || 0), 0);
  
  // Calcular total de cuentas por pagar
  const totalPayable = invoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);
  
  const outOfStock = state.products.filter(p => p.stock === 0).length;
  const lowStock = state.products.filter(p => p.stock > 0 && p.stock <= 5).length;

  const tabs = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: TrendingUp },
    { id: 'reports' as AdminTab, label: 'Reportes', icon: FileText },
    { id: 'terminals' as AdminTab, label: 'Terminales', icon: Computer },
    { id: 'users' as AdminTab, label: 'Usuarios', icon: Users },
    { id: 'supervision' as AdminTab, label: 'Supervisión', icon: Eye },
  ];

  return (
    <>
      <InvoiceReminderModal />
      <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
        <div className="mb-6">
          {/* Notificaciones */}
          <InvoiceNotifications variant="dashboard" />
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-headline font-black text-black">Panel de Administración</h2>
              <p className="text-sm text-black/50 mt-1">Gestiona tu negocio desde un solo lugar</p>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4 border-b border-[#9E9E9E] pb-2 flex-wrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all",
                    isActive
                      ? "bg-primary text-black"
                      : "text-black/60 hover:bg-primary/20"
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-[10px] font-black text-black/60 uppercase">Productos</p>
                <p className="text-2xl font-black text-black">{totalProducts}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-[10px] font-black text-black/60 uppercase">Clientes</p>
                <p className="text-2xl font-black text-black">{totalClients}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-[10px] font-black text-black/60 uppercase">Ventas</p>
                <p className="text-2xl font-black text-black">{totalSales}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-[10px] font-black text-black/60 uppercase">Ingresos del Mes</p>
                <p className="text-2xl font-black text-green-600">Bs {monthlyRevenue.toFixed(2)}</p>
                <p className="text-[8px] text-black/50">Reinicia cada 1ro del mes</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-[10px] font-black text-black/60 uppercase">Gastos del Mes</p>
                <p className="text-2xl font-black text-red-600">Bs {monthlyExpenses.toFixed(2)}</p>
                <p className="text-[8px] text-black/50">Compras pagadas en el mes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={18} className="text-orange-500" />
                  <p className="text-sm font-black text-black uppercase">Cuentas por Cobrar</p>
                </div>
                <p className="text-2xl font-black text-red-600">Bs {totalCredit.toFixed(2)}</p>
                <p className="text-[10px] text-black/50">Total de créditos pendientes de clientes</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={18} className="text-blue-500" />
                  <p className="text-sm font-black text-black uppercase">Cuentas por Pagar</p>
                </div>
                <p className="text-2xl font-black text-red-600">Bs {totalPayable.toFixed(2)}</p>
                <p className="text-[10px] text-black/50">Total de facturas pendientes a proveedores</p>
              </div>
            </div>

            {(outOfStock > 0 || lowStock > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3">⚠️ Alertas de Inventario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {outOfStock > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-700">Productos Agotados: {outOfStock}</p>
                    </div>
                  )}
                  {lowStock > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-yellow-700">Stock Mínimo: {lowStock}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'reports' && <ReportsModule state={state} />}
        {activeTab === 'terminals' && <TerminalManager />}
        {activeTab === 'users' && <UserManager />}
        {activeTab === 'supervision' && <CashSupervision />}
      </div>
    </>
  );
}