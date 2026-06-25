// src/components/suppliers/InvoiceDetailModal.tsx
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SupplierInvoice, PurchaseInvoiceItem } from '@/lib/types';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InvoiceDetailModalProps {
  invoice: SupplierInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  exchangeRate: number;
}

export default function InvoiceDetailModal({ invoice, isOpen, onClose, exchangeRate }: InvoiceDetailModalProps) {
  if (!invoice) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPaid = invoice.paidAmount || 0;
  const remaining = invoice.total - totalPaid;

  // ✅ Manejar paidAmount que puede ser undefined
  const paidAmount = invoice.paidAmount || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-3xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-4 bg-[#1A2C4E] text-white sticky top-0 z-10">
          <button onClick={onClose} className="absolute top-4 right-4 hover:opacity-70">
            <X size={20} />
          </button>
          <DialogTitle className="text-lg font-black">
            Factura #{invoice.invoiceNumber || invoice.id}
          </DialogTitle>
          <p className="text-white/60 text-sm">{invoice.supplierName}</p>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
            <div>
              <label className="text-[10px] font-black text-black/60 uppercase">Fecha</label>
              <p className="text-sm font-bold">{formatDate(invoice.date)}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-black/60 uppercase">Estado</label>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                invoice.status === 'pagada' ? "bg-green-100 text-green-700" :
                invoice.status === 'parcial' ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#F5F5F5] rounded-lg p-3">
              <label className="text-[9px] font-black text-black/60 uppercase">Total</label>
              <p className="text-lg font-black text-black">{formatBs(invoice.total)}</p>
            </div>
            <div className="bg-[#F5F5F5] rounded-lg p-3">
              <label className="text-[9px] font-black text-black/60 uppercase">Pagado</label>
              <p className="text-lg font-black text-green-600">{formatBs(paidAmount)}</p>
            </div>
            <div className="bg-[#F5F5F5] rounded-lg p-3">
              <label className="text-[9px] font-black text-black/60 uppercase">Saldo</label>
              <p className="text-lg font-black text-red-600">{formatBs(remaining)}</p>
            </div>
          </div>

          {invoice.items && invoice.items.length > 0 && (
            <div>
              <label className="text-[10px] font-black text-black/60 uppercase flex items-center gap-2 mb-3">
                📦 PRODUCTOS
              </label>
              <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8E8E8]">
                    <tr>
                      <th className="text-left p-3 text-[10px] font-black uppercase">CANT</th>
                      <th className="text-left p-3 text-[10px] font-black uppercase">PRODUCTO</th>
                      <th className="text-right p-3 text-[10px] font-black uppercase">COSTO USD</th>
                      <th className="text-right p-3 text-[10px] font-black uppercase">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item: PurchaseInvoiceItem, idx: number) => (
                      <tr key={idx} className="border-b border-[#9E9E9E]/50">
                        <td className="p-3 text-xs font-bold">{item.qty || item.quantity || 0}</td>
                        <td className="p-3 text-xs font-bold">{item.productName}</td>
                        <td className="p-3 text-right text-xs">{formatUsd(item.costUsd)}</td>
                        <td className="p-3 text-right text-xs font-bold">{formatBs(item.totalBs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#F5F5F5] p-4 border-t flex justify-end">
          <Button onClick={onClose}>CERRAR</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Importar cn si no está importado
import { cn } from '@/lib/utils';