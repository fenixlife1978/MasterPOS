"use client";

import { useState, useEffect } from 'react';
import { useSuppliers } from '@/hooks/use-suppliers';
import { AlertCircle, Bell, X, Clock, Calendar, Truck, DollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface InvoiceReminderModalProps {
  onAcknowledge?: () => void;
}

export default function InvoiceReminderModal({ onAcknowledge }: InvoiceReminderModalProps) {
  const { invoices, suppliers } = useSuppliers();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasBeenShown, setHasBeenShown] = useState(false);

  useEffect(() => {
    // Verificar si ya se mostró hoy
    const lastShown = localStorage.getItem('invoice_reminder_last_shown');
    const today = new Date().toDateString();
    
    if (lastShown === today) {
      setHasBeenShown(true);
      return;
    }
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const notificationsList: any[] = [];
    
    invoices.forEach(invoice => {
      if (invoice.status === 'pagada') return;
      
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      const supplier = suppliers.find(s => s.id === invoice.supplierId);
      const remaining = invoice.total - invoice.paidAmount;
      
      if (diffDays === 0) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_today',
          message: `🚨 ¡URGENTE! La factura #${invoice.invoiceNumber} VENCE HOY`,
          urgency: 'high',
          remaining: remaining
        });
      } else if (diffDays === 1) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_tomorrow',
          message: `⚠️ La factura #${invoice.invoiceNumber} vence MAÑANA`,
          urgency: 'medium',
          remaining: remaining
        });
      } else if (diffDays === 2) {
        notificationsList.push({
          ...invoice,
          supplierName: supplier?.name || 'Proveedor',
          type: 'due_48h',
          message: `📅 La factura #${invoice.invoiceNumber} vence en 48 HORAS`,
          urgency: 'low',
          remaining: remaining
        });
      }
    });
    
    if (notificationsList.length > 0 && !hasBeenShown) {
      setNotifications(notificationsList);
      setIsOpen(true);
    }
  }, [invoices, suppliers, hasBeenShown]);

  const handleAcknowledge = () => {
    const today = new Date().toDateString();
    localStorage.setItem('invoice_reminder_last_shown', today);
    setIsOpen(false);
    if (onAcknowledge) onAcknowledge();
  };

  const totalPending = notifications.reduce((sum, n) => sum + n.remaining, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-white border-2 border-red-400 text-black max-w-lg p-0 overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
        <DialogHeader className="sr-only"><DialogTitle>Recordatorio de Facturas por Pagar</DialogTitle></DialogHeader>
        <div className="flex flex-col">
          {/* Header llamativo */}
          <div className="bg-gradient-to-r from-red-600 to-orange-500 p-5 text-white text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center">
              <Bell size={32} className="text-white animate-pulse" />
            </div>
            <h2 className="text-2xl font-black">¡Facturas por Vencer!</h2>
            <p className="text-white/80 text-sm mt-1">Tiene {notifications.length} factura(s) próximas a vencer</p>
          </div>
          
          {/* Contenido */}
          <div className="p-5 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {notifications.map((notif, idx) => (
                <div key={idx} className={cn(
                  "p-4 rounded-xl border-2",
                  notif.urgency === 'high' ? "bg-red-50 border-red-300" :
                  notif.urgency === 'medium' ? "bg-orange-50 border-orange-300" :
                  "bg-yellow-50 border-yellow-300"
                )}>
                  <div className="flex items-start gap-3">
                    {notif.urgency === 'high' ? (
                      <AlertCircle size={24} className="text-red-600 shrink-0" />
                    ) : notif.urgency === 'medium' ? (
                      <Clock size={24} className="text-orange-600 shrink-0" />
                    ) : (
                      <Calendar size={24} className="text-yellow-600 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-base font-black text-black">{notif.message}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-[10px] text-black/50">Proveedor</p>
                          <p className="font-bold text-black">{notif.supplierName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-black/50">Factura #</p>
                          <p className="font-bold text-black">{notif.invoiceNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-black/50">Total Factura</p>
                          <p className="font-bold text-black">{formatBs(notif.total)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-black/50">Monto Pendiente</p>
                          <p className="font-bold text-red-600">{formatBs(notif.remaining)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Resumen */}
            <div className="mt-4 p-3 bg-[#1A2C4E] rounded-xl text-white text-center">
              <p className="text-[10px] text-white/60">Total pendiente por pagar</p>
              <p className="text-2xl font-black">{formatBs(totalPending)}</p>
            </div>
          </div>
          
          {/* Botones */}
          <div className="bg-[#F5F5F5] p-4 border-t flex gap-3">
            <Button 
              onClick={handleAcknowledge}
              className="flex-1 bg-primary hover:brightness-110 text-black font-black py-3 text-base"
            >
              <CheckCircle size={18} className="mr-2" /> ENTENDIDO
            </Button>
          </div>
          <div className="bg-[#F5F5F5] px-4 pb-4 text-center">
            <p className="text-[8px] text-black/40">Recordatorio diario. Las notificaciones quedarán en la campana del panel superior hasta el pago de la factura.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}