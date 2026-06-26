// src/components/suppliers/InvoiceDetailModal.tsx
"use client";

import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SupplierInvoice, PurchaseInvoiceItem, SupplierPayment } from '@/lib/types';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { X, Package, Wallet, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InvoiceDetailModalProps {
  invoice: SupplierInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  exchangeRate: number;
  supplierPayments?: SupplierPayment[];
  supplierName?: string;
}

export default function InvoiceDetailModal({ 
  invoice, 
  isOpen, 
  onClose, 
  exchangeRate,
  supplierPayments = [],
  supplierName
}: InvoiceDetailModalProps) {
  if (!invoice) return null;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const totalPaid = invoice.paidAmount || 0;
  const remaining = invoice.total - totalPaid;

  // ✅ Filtrar abonos específicos de esta factura
  const invoiceAbonos = useMemo(() => {
    return supplierPayments
      .filter(p => p.invoiceId === invoice.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplierPayments, invoice.id]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 bg-[#1A2C4E] text-white sticky top-0 z-10">
          <button onClick={onClose} className="absolute top-4 right-4 hover:opacity-70">
            <X size={20} />
          </button>
          <DialogTitle className="text-lg font-black">
            Detalle de Factura #{invoice.invoiceNumber || invoice.id}
          </DialogTitle>
          <p className="text-white/60 text-sm">{supplierName || invoice.supplierName}</p>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
            <div>
              <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Fecha de Registro</label>
              <p className="text-sm font-bold">{formatDate(invoice.date)}</p>
            </div>
            <div className="text-right">
              <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Estado de Pago</label>
              <div className="mt-1">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black border",
                  invoice.status === 'pagada' ? "bg-green-100 text-green-700 border-green-300" :
                  invoice.status === 'parcial' ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                  "bg-red-100 text-red-700 border-red-300"
                )}>
                  {invoice.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#F5F5F5] rounded-xl p-4 border border-gray-200">
              <p className="text-[9px] font-black text-black/40 uppercase text-center">Monto Total</p>
              <p className="text-xl font-black text-black text-center mt-1">{formatUsd(invoice.total)}</p>
              <p className="text-[9px] text-black/30 text-center">Tasa: {formatBs(invoice.exchangeRate || exchangeRate)}</p>
            </div>
            <div className="bg-[#F5F5F5] rounded-xl p-4 border border-gray-200">
              <p className="text-[9px] font-black text-black/40 uppercase text-center">Total Pagado</p>
              <p className="text-xl font-black text-green-600 text-center mt-1">{formatUsd(totalPaid)}</p>
              <p className="text-[9px] text-green-600/40 text-center">Ref: {formatBs(totalPaid * (invoice.exchangeRate || exchangeRate))}</p>
            </div>
            <div className="bg-[#F5F5F5] rounded-xl p-4 border border-gray-200">
              <p className="text-[9px] font-black text-black/40 uppercase text-center">Saldo Pendiente</p>
              <p className="text-xl font-black text-red-600 text-center mt-1">{formatUsd(remaining)}</p>
              <p className="text-[9px] text-red-600/40 text-center">Ref: {formatBs(remaining * (invoice.exchangeRate || exchangeRate))}</p>
            </div>
          </div>

          {/* Sección de Productos */}
          <div>
            <h4 className="text-xs font-black uppercase text-black/60 flex items-center gap-2 mb-3">
              <Package size={14} className="text-primary" /> Ítems de la Factura
            </h4>
            <div className="border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#E8E8E8]">
                  <tr>
                    <th className="text-left p-3 text-[10px] font-black uppercase">Cant.</th>
                    <th className="text-left p-3 text-[10px] font-black uppercase">Producto</th>
                    <th className="text-right p-3 text-[10px] font-black uppercase">Costo USD</th>
                    <th className="text-right p-3 text-[10px] font-black uppercase">Subtotal USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item: PurchaseInvoiceItem, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 text-xs font-bold text-black">{item.qty || item.quantity || 0}</td>
                        <td className="p-3 text-xs font-bold text-black">{item.productName}</td>
                        <td className="p-3 text-right text-xs font-mono">{formatUsd(item.costUsd, 4)}</td>
                        <td className="p-3 text-right text-xs font-black">{formatUsd(item.totalUsd || (item.costUsd * (item.qty || item.quantity || 0)), 4)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-black/40 italic text-xs">Sin detalle de productos</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sección de Historial de Pagos */}
          <div>
            <h4 className="text-xs font-black uppercase text-black/60 flex items-center gap-2 mb-3">
              <History size={14} className="text-green-600" /> Historial de Abonos
            </h4>
            <div className="border border-[#9E9E9E] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#E8E8E8]">
                  <tr>
                    <th className="text-left p-3 text-[10px] font-black uppercase">Fecha</th>
                    <th className="text-left p-3 text-[10px] font-black uppercase">Método</th>
                    <th className="text-left p-3 text-[10px] font-black uppercase">Referencia</th>
                    <th className="text-right p-3 text-[10px] font-black uppercase">Monto USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoiceAbonos.length > 0 ? (
                    invoiceAbonos.map((payment, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 text-xs text-black/60">{formatDate(payment.date)}</td>
                        <td className="p-3 text-xs font-bold uppercase">{payment.method.replace('_', ' ')}</td>
                        <td className="p-3 text-xs text-black/40">{payment.reference || '—'} {payment.bank ? `(${payment.bank})` : ''}</td>
                        <td className="p-3 text-right text-xs font-black text-green-600">{formatUsd(payment.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-black/40 italic text-xs">No hay abonos registrados para esta factura</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="px-6 text-black font-bold">CERRAR</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
