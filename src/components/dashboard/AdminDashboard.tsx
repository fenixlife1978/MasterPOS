"use client";

import { useState, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { useSuppliers } from '@/hooks/use-suppliers';
import InvoiceNotifications from '@/components/ui/InvoiceNotifications';
import InvoiceReminderModal from '@/components/ui/InvoiceReminderModal';
import CloseHistoryModal from '@/components/register/close-history-modal';
import { 
  TrendingUp, DollarSign, Users, Package, 
  CreditCard, ShoppingBag, Computer, FileText,
  Calendar, ArrowUp, ArrowDown, Truck, Eye,
  RefreshCw, Lock, KeyRound, Save, AlertTriangle,
  Trash2, XCircle, Archive, Unlock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TerminalManager from '@/components/admin/TerminalManager';
import UserManager from '@/components/admin/UserManager';
import ReportsModule from '@/components/admin/ReportsModule';
import CashSupervision from '@/components/admin/CashSupervision';
import syncService from '@/services/syncService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { db, rtdb } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { ref, get, set } from 'firebase/database';

interface AdminDashboardProps {
  state: ReturnType<typeof usePOSState>;
}

type AdminTab = 'dashboard' | 'reports' | 'terminals' | 'users' | 'supervision';

export default function AdminDashboard({ state }: AdminDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const { suppliers, invoices } = useSuppliers();
  
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  
  const [exchangeRateInput, setExchangeRateInput] = useState(state.exchangeRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  
  const [adminPin, setAdminPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [confirmAdminPin, setConfirmAdminPin] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [showPinSection, setShowPinSection] = useState(false);
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPinInput, setResetPinInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const loadAdminCode = async () => {
      const adminCodeData = await syncService.getAdminCode();
      if (adminCodeData) {
        setAdminPin(adminCodeData.code);
      }
    };
    loadAdminCode();
  }, []);

  const calculateMonthlyRevenue = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const revenueBs = state.transactions
      .filter(t => t.type === 'contado' && new Date(t.date) >= startOfMonth)
      .reduce((sum, t) => sum + (t.total || 0), 0);
    const revenueUsd = revenueBs / state.exchangeRate;
    setMonthlyRevenue(roundTo2(revenueUsd));
  };

  const calculateMonthlyExpenses = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const expenses = invoices
      .filter(inv => inv.paidAmount > 0 && new Date(inv.date) >= startOfMonth)
      .reduce((sum, inv) => sum + inv.paidAmount, 0);
    setMonthlyExpenses(expenses);
  };

  useEffect(() => {
    calculateMonthlyRevenue();
    calculateMonthlyExpenses();
  }, [state.transactions, invoices, state.exchangeRate]);

  const roundTo2 = (num: number) => Math.round(num * 100) / 100;

  const handleUpdateExchangeRate = async () => {
    const newRate = parseFloat(exchangeRateInput);
    if (isNaN(newRate) || newRate <= 0) {
      toast({ title: "Error", description: "Ingrese una tasa válida", variant: "destructive" });
      return;
    }
    setIsUpdatingRate(true);
    try {
      await state.setExchangeRate(newRate);
      toast({ title: "Tasa actualizada", description: `Nueva tasa BCV: ${formatBs(newRate)}` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar la tasa", variant: "destructive" });
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleUpdateAdminPin = async () => {
    if (!newAdminPin || newAdminPin.length !== 6) {
      toast({ title: "Error", description: "El PIN debe tener exactamente 6 dígitos", variant: "destructive" });
      return;
    }
    if (newAdminPin !== confirmAdminPin) {
      toast({ title: "Error", description: "Los PINs no coinciden", variant: "destructive" });
      return;
    }
    setIsUpdatingPin(true);
    try {
      await syncService.saveGlobalSettings({ adminCode: newAdminPin });
      setAdminPin(newAdminPin);
      setNewAdminPin('');
      setConfirmAdminPin('');
      setShowPinSection(false);
      toast({ title: "PIN actualizado", description: "Nuevo PIN de autorización registrado" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el PIN", variant: "destructive" });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleResetSystem = async () => {
    if (!resetPinInput) {
      toast({ title: "Error", description: "Ingrese el PIN de autorización", variant: "destructive" });
      return;
    }
    if (resetPinInput !== adminPin) {
      toast({ title: "Acceso denegado", description: "PIN de autorización incorrecto", variant: "destructive" });
      setResetPinInput('');
      return;
    }
    
    setIsResetting(true);
    
    try {
      let usersToKeep: any[] = [];
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersSnapshot.forEach(doc => {
          usersToKeep.push({ id: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.warn('No se pudieron obtener usuarios:', e);
      }

      let currentAdminCode = adminPin || '123456';

      const firestoreCollections = [
        'transactions',
        'accounts',
        'products',
        'clients',
        'suppliers',
        'purchase_invoices',
        'purchase_items',
        'supplier_payments',
        'accounting_entries',
        'kardex_entries',
        'terminals',
        'registers',
        'cash_closes',
        'cash_sessions',
        'global_settings',
        'register',
      ];

      for (const collectionName of firestoreCollections) {
        try {
          const colRef = collection(db, collectionName);
          const snapshot = await getDocs(colRef);
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        } catch (error) {
          console.error(`❌ Error borrando ${collectionName}:`, error);
        }
      }

      const rtdbNodes = [
        'transactions',
        'accounts',
        'products',
        'clients',
        'suppliers',
        'purchase_invoices',
        'purchase_items',
        'supplier_payments',
        'accounting_entries',
        'kardex_entries',
        'terminals',
        'registers',
        'cash_closes',
        'global_settings',
        'register',
        'terminal_transactions',
      ];

      for (const nodeName of rtdbNodes) {
        try {
          const nodeRef = ref(rtdb, nodeName);
          await set(nodeRef, null);
        } catch (error) {
          console.error(`❌ Error borrando ${nodeName}:`, error);
        }
      }

      for (const user of usersToKeep) {
        try {
          await setDoc(doc(db, 'users', user.id), user);
          const rtdbUserData = {
            uid: user.uid || user.id,
            name: user.name || '',
            email: user.email || '',
            role: user.role || 'user',
            terminalId: user.terminalId || null,
            terminalName: user.terminalName || null,
            status: user.status || 'active',
            createdAt: user.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await set(ref(rtdb, `users/${user.id}`), rtdbUserData);
        } catch (error) {
          console.error(`❌ Error restaurando usuario ${user.id}:`, error);
        }
      }

      try {
        await set(ref(rtdb, 'global_settings/admin_code'), currentAdminCode);
      } catch (error) {
        console.error('❌ Error restaurando código de administrador:', error);
      }

      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (
            key.startsWith('pos_cache_') || 
            key.startsWith('last_receipt_number_') || 
            key.startsWith('last_return_number_') ||
            key.startsWith('pos_register_') ||
            key.startsWith('invoice_reminder_') ||
            key.startsWith('cierre_final_') ||
            key.startsWith('corte_parcial_')
          ) {
            localStorage.removeItem(key);
          }
        }
        localStorage.removeItem('bcv_exchange_rate');
        localStorage.removeItem('last_receipt_number');
        localStorage.removeItem('pos_register_default');
      } catch (error) {
        console.error('❌ Error limpiando caché local:', error);
      }

      toast({ 
        title: "✅ Sistema reseteado", 
        description: `Todos los datos eliminados. ${usersToKeep.length} usuarios conservados. Recargando página...`,
        variant: "default"
      });

      setTimeout(() => {
        window.location.reload();
      }, 3000);

      setShowResetModal(false);
      setResetPinInput('');

    } catch (error) {
      console.error("Error al resetear el sistema:", error);
      toast({ title: "Error", description: "No se pudo completar el reseteo", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const totalProducts = state.products.length;
  const totalClients = state.clients.length;
  const totalSales = state.transactions.filter(t => t.type === 'contado').length;
  const totalRevenue = state.transactions.filter(t => t.type === 'contado').reduce((sum, t) => sum + t.total, 0);
  const totalCreditBs = state.accounts.reduce((sum, acc) => sum + (acc.amountBs - (acc.paidAmount || 0)), 0);
  const totalCreditUsd = totalCreditBs / state.exchangeRate;
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

  const maskPin = (pin: any): string => {
    const pinStr = String(pin || '');
    return pinStr.split('').map(() => '•').join('');
  };

  return (
    <>
      <InvoiceReminderModal />
      <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
        <div className="mb-6">
          <InvoiceNotifications variant="dashboard" />
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-headline font-black text-black">Panel de Administración</h2>
              <p className="text-sm font-black text-black mt-1">Gestiona tu negocio desde un solo lugar</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-[#1A2C4E] rounded-xl p-3 flex items-center gap-3 shadow-md">
                <div className="bg-primary/20 rounded-lg p-2">
                  <DollarSign size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-white">TASA BCV</p>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="text"
                      inputMode="decimal"
                      value={exchangeRateInput}
                      onChange={(e) => setExchangeRateInput(e.target.value)}
                      className="h-7 w-24 text-xs font-mono font-black bg-white/10 border-white/20 text-white focus:border-primary"
                      placeholder="0.00"
                    />
                    <Button
                      onClick={handleUpdateExchangeRate}
                      disabled={isUpdatingRate}
                      size="sm"
                      className="h-7 px-2 bg-primary text-black font-black text-[10px]"
                    >
                      <RefreshCw size={10} className={cn("mr-1", isUpdatingRate && "animate-spin")} />
                      Actualizar
                    </Button>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => setShowHistoryModal(true)}
                variant="outline"
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs border-blue-500"
              >
                <Archive size={14} className="mr-2" />
                HISTORIAL CIERRES
              </Button>
              
              <Button
                onClick={() => setShowResetModal(true)}
                variant="outline"
                className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs border-red-500"
              >
                <Trash2 size={14} className="mr-2" />
                RESET SISTEMA
              </Button>
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
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-black text-sm transition-all",
                    isActive
                      ? "bg-primary text-black"
                      : "text-black hover:bg-primary/20"
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
            
            <button
              onClick={() => setShowPinSection(!showPinSection)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-black text-sm transition-all ml-auto",
                showPinSection
                  ? "bg-amber-500 text-black"
                  : "text-black hover:bg-amber-100"
              )}
            >
              <KeyRound size={16} />
              PIN Autorización
            </button>
          </div>
          
          {showPinSection && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={16} className="text-amber-600" />
                <h3 className="text-sm font-black text-amber-800 uppercase">Código de Autorización</h3>
              </div>
              <p className="text-xs font-black text-amber-900 mb-3">
                Este PIN de 6 dígitos será requerido para autorizar ajustes de inventario y transacciones de colaboración/consumo propio.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-black uppercase text-amber-900 block mb-1">Nuevo PIN (6 dígitos)</label>
                  <Input 
                    type="password"
                    maxLength={6}
                    value={newAdminPin}
                    onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                    className="h-8 text-sm font-mono text-center bg-white"
                    placeholder="••••••"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-amber-900 block mb-1">Confirmar PIN</label>
                  <Input 
                    type="password"
                    maxLength={6}
                    value={confirmAdminPin}
                    onChange={(e) => setConfirmAdminPin(e.target.value.replace(/\D/g, ''))}
                    className="h-8 text-sm font-mono text-center bg-white"
                    placeholder="••••••"
                  />
                </div>
                <div>
                  <Button
                    onClick={handleUpdateAdminPin}
                    disabled={isUpdatingPin}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black h-8 text-xs"
                  >
                    <Save size={12} className="mr-1" />
                    Guardar PIN
                  </Button>
                </div>
              </div>
              {adminPin && (
                <p className="text-[10px] font-black text-amber-800 mt-2">
                  PIN actual: {maskPin(adminPin)}
                </p>
              )}
            </div>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-xs font-black text-black uppercase">Productos</p>
                <p className="text-2xl font-black text-black">{totalProducts}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-xs font-black text-black uppercase">Clientes</p>
                <p className="text-2xl font-black text-black">{totalClients}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-xs font-black text-black uppercase">Ventas</p>
                <p className="text-2xl font-black text-black">{totalSales}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-xs font-black text-black uppercase">Ingresos del Mes</p>
                <p className="text-2xl font-black text-green-600">{formatUsd(monthlyRevenue)}</p>
                <p className="text-[10px] font-black text-black">Reinicia cada 1ro del mes</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <p className="text-xs font-black text-black uppercase">Gastos del Mes</p>
                <p className="text-2xl font-black text-red-600">{formatUsd(monthlyExpenses)}</p>
                <p className="text-[10px] font-black text-black">Compras pagadas en el mes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={18} className="text-orange-500" />
                  <p className="text-sm font-black text-black uppercase">Cuentas por Cobrar</p>
                </div>
                <p className="text-2xl font-black text-red-600">{formatUsd(totalCreditUsd)}</p>
                <p className="text-[10px] font-black text-black">Total de créditos pendientes de clientes</p>
              </div>
              <div className="bg-white rounded-xl border border-[#9E9E9E] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={18} className="text-blue-500" />
                  <p className="text-sm font-black text-black uppercase">Cuentas por Pagar</p>
                </div>
                <p className="text-2xl font-black text-red-600">{formatUsd(totalPayable)}</p>
                <p className="text-[10px] font-black text-black">Total de facturas pendientes a proveedores</p>
              </div>
            </div>

            {(outOfStock > 0 || lowStock > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3">⚠️ Alertas de Inventario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {outOfStock > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-black text-red-900">Productos Agotados: {outOfStock}</p>
                    </div>
                  )}
                  {lowStock > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs font-black text-yellow-900">Stock Mínimo: {lowStock}</p>
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
      
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="bg-white max-w-md p-0 rounded-xl">
          <DialogHeader className="bg-red-600 p-4 text-white rounded-t-xl">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <AlertTriangle size={18} /> RESET TOTAL DEL SISTEMA
              </DialogTitle>
              <button onClick={() => setShowResetModal(false)} className="text-white hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
          </DialogHeader>
          
          <div className="p-5">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-5">
              <p className="text-red-900 font-black text-sm mb-2">⚠️ ¡ADVERTENCIA!</p>
              <p className="text-red-800 font-black text-xs">
                Esta acción ELIMINARÁ PERMANENTEMENTE los siguientes datos:
              </p>
              <ul className="text-red-800 font-black text-xs mt-2 space-y-1 list-disc list-inside">
                <li>Productos, clientes, transacciones, cuentas por cobrar</li>
                <li>Facturas de compra, proveedores, pagos a proveedores</li>
                <li>Kardex, entradas contables, historial de cierres</li>
                <li>Cajas, registros y sesiones de terminal</li>
              </ul>
              <p className="text-red-900 font-black text-sm mt-3">
                ✅ Los USUARIOS y el PIN actual se conservarán.
              </p>
              <p className="text-red-900 font-black text-sm mt-2">
                Esta operación es IRREVERSIBLE.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="text-[11px] font-black uppercase text-black block mb-2">
                Ingrese el PIN de autorización para continuar
              </label>
              <Input 
                type="password"
                maxLength={6}
                value={resetPinInput}
                onChange={(e) => setResetPinInput(e.target.value.replace(/\D/g, ''))}
                className="h-10 text-lg font-mono text-center bg-gray-50 border-gray-400 font-black"
                placeholder="••••••"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && resetPinInput.length === 6) {
                    handleResetSystem();
                  }
                }}
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowResetModal(false)}
                variant="outline"
                className="flex-1 h-10 border-gray-400 text-black font-black"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleResetSystem}
                disabled={isResetting || resetPinInput.length !== 6}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-black"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="mr-1 animate-spin" />
                    Resetear...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} className="mr-1" />
                    CONFIRMAR RESET
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CloseHistoryModal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
    </>
  );
}
