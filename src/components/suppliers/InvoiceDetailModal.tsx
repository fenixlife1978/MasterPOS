// components/suppliers/InvoiceDetailModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupplierInvoice, SupplierPayment, PurchaseInvoiceItem } from "@/lib/types";
import { formatUsd } from "@/lib/currency-formatter";

// ✅ Función auxiliar para formatear fecha (copiada localmente)
function formatDateFromString(dateStr: string): string {
  if (dateStr.includes('T') || dateStr.includes(' ') || /^\d+$/.test(dateStr)) {
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

interface InvoiceDetailModalProps {
  invoice: SupplierInvoice;
  isOpen: boolean;
  onClose: () => void;
  purchaseItems: Record<number, PurchaseInvoiceItem[]>; // ✅ Record
  supplierPayments: SupplierPayment[];
  supplierName: string;
}

export default function InvoiceDetailModal({
  invoice,
  isOpen,
  onClose,
  purchaseItems,
  supplierPayments,
  supplierName,
}: InvoiceDetailModalProps) {
  const invoiceItems = purchaseItems[invoice.id] || [];
  const invoicePayments = supplierPayments.filter((p) => p.invoiceId === invoice.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de la Factura #{invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Información de la factura */}
          <div className="border rounded-lg p-4 space-y-2 bg-gray-50">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-sm font-semibold">Fecha:</span>
                <span className="ml-2">{formatDateFromString(invoice.date)}</span>
              </div>
              <div>
                <span className="text-sm font-semibold">Proveedor:</span>
                <span className="ml-2">{supplierName}</span>
              </div>
              <div>
                <span className="text-sm font-semibold">Total:</span>
                <span className="ml-2 font-bold text-red-500">{formatUsd(invoice.total)}</span>
              </div>
              <div>
                <span className="text-sm font-semibold">Pagado:</span>
                <span className="ml-2 text-green-600">{formatUsd(invoice.paidAmount)}</span>
              </div>
            </div>
          </div>

          {/* Tabla de productos */}
          <div>
            <h3 className="text-md font-semibold mb-2">Productos/Servicios</h3>
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-center">Cantidad</th>
                  <th className="p-2 text-right">Precio Unitario (USD)</th>
                  <th className="p-2 text-right">Subtotal (USD)</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{item.productName}</td>
                    <td className="p-2 text-center">{item.qty}</td>
                    <td className="p-2 text-right font-mono">{formatUsd(item.costUsd)}</td>
                    <td className="p-2 text-right font-mono">{formatUsd(item.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Historial de pagos */}
          <div>
            <h3 className="text-md font-semibold mb-2">Historial de Pagos / Abonos</h3>
            {invoicePayments.length === 0 ? (
              <p className="text-sm text-gray-500">No hay pagos registrados para esta factura.</p>
            ) : (
              <div className="space-y-2">
                {invoicePayments.map((payment) => (
                  <div key={payment.id} className="border rounded p-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{payment.method.replace("_", " ")}</span>
                      <span className="font-bold text-green-600">{formatUsd(payment.amount)}</span>
                    </div>
                    <div className="text-sm text-gray-500 flex justify-between mt-1">
                      <span>Fecha: {formatDateFromString(payment.date)}</span>
                      {payment.reference && <span>Referencia: {payment.reference}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}