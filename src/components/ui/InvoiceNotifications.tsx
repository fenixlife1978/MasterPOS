"use client";

import { useState, useEffect } from 'react';
import { useSuppliers } from '@/hooks/use-suppliers';
import { AlertCircle, Bell, X, Clock, Calendar, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface InvoiceNotificationsProps {
  variant?: 'dashboard' | 'cashier';
}

export default function InvoiceNotifications({ variant = 'dashboard' }: InvoiceNotificationsProps) {
  const { invoices, suppliers } = useSuppliers();
  const [showModal, setShowModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const notificationsList: any[] = [];
    
    invoices.forEach(invoice => {
      if (invoice.status === 'pagada') return;
      
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const supplier = suppliers.find(s => s.id === invoice.supplierId);
      
      if (diffDays === 0) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_today',
          message: `La factura #${invoice.invoiceNumber} VENCE HOY`,
          urgency: 'high',
          icon: AlertCircle
        });
      } else if (diffDays === 1) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_tomorrow',
          message: `La factura #${invoice.invoiceNumber} vence MAÑANA`,
          urgency: 'medium',
          icon: Clock
        });
      } else if (diffDays === 2) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_48h',
          message: `La factura #${invoice.invoiceNumber} vence en 48 HORAS`,
          urgency: 'low',
          icon: Calendar
        });
      } else if (diffDays > 0 && diffDays <= 7) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_week',
          message: `La factura #${invoice.invoiceNumber} vence en ${diffDays} días`,
          urgency: 'low',
          icon: Calendar
        });
      }
    });
    
    setNotifications(notificationsList.sort((a, b) => a.urgency === 'high' ? -1 : 1));
    setHasUnread(notificationsList.length > 0);
  }, [invoices, suppliers]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 border-red-300 text-red-700';
      case 'medium': return 'bg-orange-100 border-orange-300 text-orange-700';
      default: return 'bg-yellow-100 border-yellow-300 text-yellow-700';
    }
  };

  if (variant === 'cashier') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="relative"
          title="Facturas por pagar"
        >
          <Truck size={18} className="text-white/70 hover:text-white transition-colors" />
          {hasUnread && (
            <span className="absolute -top-1 -right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
            <DialogHeader className="sr-only"><DialogTitle>Facturas por Pagar</DialogTitle></DialogHeader>
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Bell size={20} className="text-primary" /><h3 className="text-lg font-black">Facturas por Pagar</h3></div>
                  <button onClick={() => setShowModal(false)}><X size={18} /></button>
                </div>
                <p className="text-white/60 text-xs">Notificaciones de vencimiento</p>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-black/50 italic">No hay facturas próximas a vencer</div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notif, idx) => {
                      const Icon = notif.icon;
                      const remaining = notif.total - notif.paidAmount;
                      return (
                        <div key={idx} className={cn("p-3 rounded-lg border", getUrgencyColor(notif.urgency))}>
                          <div className="flex items-start gap-2">
                            <Icon size={16} className="mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-bold">{notif.message}</p>
                              <p className="text-[10px] mt-1">Proveedor: {notif.supplierName}</p>
                              <p className="text-[9px]">Monto pendiente: <span className="font-bold">Bs {remaining.toFixed(2)}</span></p>
                              <p className="text-[9px]">Total factura: Bs {notif.total.toFixed(2)} | Pagado: Bs {notif.paidAmount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="bg-[#F5F5F5] p-3 border-t text-center">
                <p className="text-[8px] text-black/50">Revise el módulo de Proveedores para gestionar pagos</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Variante dashboard
  return (
    <>
      {notifications.length > 0 && (
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-primary" />
              <h3 className="text-sm font-black text-black uppercase">Notificaciones de Vencimiento</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowModal(true)} className="text-[10px] text-primary">Ver todas</Button>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((notif, idx) => {
              const Icon = notif.icon;
              return (
                <div key={idx} className={cn("p-2 rounded-lg border text-xs", getUrgencyColor(notif.urgency))}>
                  <div className="flex items-center gap-2">
                    <Icon size={12} />
                    <span className="font-bold">{notif.message}</span>
                  </div>
                  <p className="text-[9px] mt-0.5">Proveedor: {notif.supplierName}</p>
                </div>
              );
            })}
            {notifications.length > 3 && (
              <p className="text-[9px] text-center text-black/50">+{notifications.length - 3} notificaciones más</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only"><DialogTitle>Facturas por Pagar</DialogTitle></DialogHeader>
          <div className="flex flex-col">
            <div className="bg-[#1A2C4E] p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Bell size={20} className="text-primary" /><h3 className="text-lg font-black">Facturas por Pagar</h3></div>
                <button onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <p className="text-white/60 text-xs">Notificaciones de vencimiento</p>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-black/50 italic">No hay facturas próximas a vencer</div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, idx) => {
                    const Icon = notif.icon;
                    const remaining = notif.total - notif.paidAmount;
                    return (
                      <div key={idx} className={cn("p-3 rounded-lg border", getUrgencyColor(notif.urgency))}>
                        <div className="flex items-start gap-2">
                          <Icon size={16} className="mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-bold">{notif.message}</p>
                            <p className="text-[10px] mt-1">Proveedor: {notif.supplierName}</p>
                            <p className="text-[9px]">Monto pendiente: <span className="font-bold">Bs {remaining.toFixed(2)}</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="bg-[#F5F5F5] p-3 border-t text-center">
              <p className="text-[8px] text-black/50">Revise el módulo de Proveedores para gestionar pagos</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
