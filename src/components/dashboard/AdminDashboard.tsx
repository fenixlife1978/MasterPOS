"use client";

import { useState } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { 
  TrendingUp, DollarSign, Users, Package, 
  CreditCard, ShoppingBag, Settings, Shield,
  Calendar, ArrowUp, ArrowDown, Computer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminSettings from '@/components/admin/AdminSettings';
import TerminalManager from '@/components/admin/TerminalManager';

interface AdminDashboardProps {
  state: ReturnType<typeof usePOSState>;
}

type AdminTab = 'dashboard' | 'settings' | 'terminals';

export default function AdminDashboard({ state }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Estadísticas
  const totalProducts = state.products.length;
  const totalClients = state.clients.length;
  const totalSales = state.transactions.filter(t => t.type === 'contado').length;
  const totalCreditSales = state.transactions.filter(t => t.type === 'credito').length;
  const totalRevenue = state.transactions
    .filter(t => t.type === 'contado')
    .reduce((sum, t) => sum + t.total, 0);
  const totalCredit = state.clients.reduce((sum, c) => sum + (c.debt || 0), 0);
  
  const outOfStock = state.products.filter(p => p.stock === 0).length;
  const lowStock = state.products.filter(p => p.stock > 0 && p.stock <= 5).length;

  const statsCards = [
    { title: 'Ventas Totales', value: totalSales, icon: ShoppingBag, color: 'bg-blue-500', change: '+12%' },
    { title: 'Ingresos', value: `Bs ${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'bg-green-500', change: '+8%' },
    { title: 'Créditos Pendientes', value: `Bs ${totalCredit.toFixed(2)}`, icon: CreditCard, color: 'bg-orange-500', change: '+5%' },
    { title: 'Clientes', value: totalClients, icon: Users, color: 'bg-purple-500', change: '+3%' },
    { title: 'Productos', value: totalProducts, icon: Package, color: 'bg-cyan-500', change: '-2%' },
    { title: 'Ventas Crédito', value: totalCreditSales, icon: TrendingUp, color: 'bg-yellow-500', change: '+15%' },
  ];

  const tabs = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: TrendingUp },
    { id: 'terminals' as AdminTab, label: 'Terminales', icon: Computer },
    { id: 'settings' as AdminTab, label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      {/* Header con tabs */}
      <div className="mb-6">
        <h2 className="text-2xl font-headline font-black text-black">Panel de Administración</h2>
        <p className="text-sm text-black/50 mt-1">Gestiona tu negocio desde un solo lugar</p>
        
        {/* Tabs de navegación */}
        <div className="flex gap-2 mt-4 border-b border-[#9E9E9E] pb-2">
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
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {statsCards.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", stat.color, "bg-opacity-20")}>
                      <Icon size={16} className={stat.color.replace('bg-', 'text-')} />
                    </div>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-black/60 uppercase tracking-widest">{stat.title}</p>
                  <p className="text-xl font-black text-black mt-1">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Alertas de stock */}
          {(outOfStock > 0 || lowStock > 0) && (
            <div className="mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 flex items-center gap-2">
                ⚠️ Alertas de Inventario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {outOfStock > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
                        <Package size={20} className="text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase">Productos Agotados</p>
                        <p className="text-2xl font-black text-red-600">{outOfStock} productos</p>
                        <p className="text-[10px] text-red-500">Requieren reposición urgente</p>
                      </div>
                    </div>
                  </div>
                )}
                {lowStock > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-200 rounded-lg flex items-center justify-center">
                        <AlertTriangle size={20} className="text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-yellow-700 uppercase">Stock Mínimo</p>
                        <p className="text-2xl font-black text-yellow-600">{lowStock} productos</p>
                        <p className="text-[10px] text-yellow-500">Por debajo del umbral</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Últimas transacciones */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 flex items-center gap-2">
              🕐 Últimas Transacciones
            </h3>
            <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#E8E8E8]">
                  <tr className="border-b border-[#9E9E9E]">
                    <th className="text-left p-3 text-[10px] font-black text-black uppercase">Fecha</th>
                    <th className="text-left p-3 text-[10px] font-black text-black uppercase">Tipo</th>
                    <th className="text-left p-3 text-[10px] font-black text-black uppercase">Cliente</th>
                    <th className="text-right p-3 text-[10px] font-black text-black uppercase">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {state.transactions.slice(-5).reverse().map((t, idx) => (
                    <tr key={idx} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                      <td className="p-3 text-xs text-black/60">{new Date(t.date).toLocaleDateString('es-VE')}</td>
                      <td className="p-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold",
                          t.type === 'contado' ? "bg-green-100 text-green-700" :
                          t.type === 'credito' ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {t.type === 'contado' ? 'CONTADO' : t.type === 'credito' ? 'CRÉDITO' : 'COBRO'}
                        </span>
                       </td>
                      <td className="p-3 text-xs text-black/80">{t.clientName || '—'}</td>
                      <td className="p-3 text-right font-bold text-black">BS {t.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'terminals' && <TerminalManager />}
      {activeTab === 'settings' && <AdminSettings />}
    </div>
  );
}

// Componente AlertTriangle
const AlertTriangle = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 9v4M12 17h.01"/>
    <path d="M12 2L2 20h20L12 2z"/>
  </svg>
);
