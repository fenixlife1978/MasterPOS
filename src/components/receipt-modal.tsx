"use client";

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { Transaction } from '@/lib/types';

interface ReceiptModalProps {
  transaction: Transaction;
  exchangeRate: number;
  onClose: () => void;
}

export default function ReceiptModal({ transaction, exchangeRate, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
      <html>
        <head>
          <title>Recibo de Venta</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              margin: 0;
              padding: 8px;
              font-size: 10px;
              background: white;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .title {
              font-size: 14px;
              font-weight: bold;
              margin: 0;
            }
            .subtitle {
              font-size: 9px;
              margin: 4px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            th, td {
              text-align: left;
              padding: 4px 0;
            }
            th {
              border-bottom: 1px dashed #000;
            }
            .totals {
              border-top: 1px dashed #000;
              padding-top: 8px;
              margin-top: 8px;
            }
            .total-grand {
              font-size: 12px;
              font-weight: bold;
              margin-top: 8px;
              padding-top: 4px;
              border-top: 2px solid #000;
            }
            .footer {
              text-align: center;
              margin-top: 16px;
              padding-top: 8px;
              border-top: 1px dashed #000;
              font-size: 8px;
            }
            .payment-method {
              background: #f0f0f0;
              padding: 4px;
              margin: 8px 0;
              text-align: center;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div>\${printContent}</div>
          <script>
            window.print();
            window.onafterprint = () => window.close();
          <\/script>
        </body>
      </html>
    `);
    printWindow?.document.close();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paymentMethodLabels: Record<string, string> = {
    efectivo_bs: 'EFECTIVO BS',
    tarjeta: 'TARJETA',
    usd_efectivo: 'EFECTIVO USD',
    biopago: 'BIOPAGO',
    pago_movil: 'PAGO MÓVIL',
    zelle: 'ZELLE',
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="bg-[#1A2C4E] p-4 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Printer size={18} /> Recibo de Venta
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto bg-gray-50">
          <div ref={printRef} className="bg-white p-4 rounded-lg shadow-inner" style={{ width: '80mm', margin: '0 auto' }}>
            <div className="header text-center">
              <h1 className="title">LICOPOS ELITE</h1>
              <p className="subtitle">Sistema de Punto de Venta</p>
              <p className="subtitle">RIF: J-12345678-0</p>
              <p className="subtitle">Tel: (0212) 555-1234</p>
              <div className="info-row" style={{ justifyContent: 'center', gap: '8px', fontSize: '9px', marginTop: '8px' }}>
                <span>FECHA: {formatDate(transaction.date)}</span>
              </div>
              <div className="info-row" style={{ justifyContent: 'center', gap: '8px', fontSize: '9px' }}>
                <span>N°: {transaction.id.toString().padStart(8, '0')}</span>
              </div>
              {transaction.clientName && (
                <div className="info-row" style={{ justifyContent: 'center', fontSize: '9px', marginTop: '4px' }}>
                  <span>CLIENTE: {transaction.clientName}</span>
                </div>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>CANT</th>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>DESCRIPCIÓN</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>PRECIO</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 0' }}>{item.qty}</td>
                    <td style={{ padding: '4px 0', fontSize: '9px' }}>{item.name.slice(0, 20)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>BS {item.priceBs.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>BS {(item.priceBs * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals" style={{ borderTop: '1px dashed #000', paddingTop: '8px', marginTop: '8px' }}>
              <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>SUBTOTAL:</span>
                <span>BS {transaction.subtotal.toFixed(2)}</span>
              </div>
              <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>IVA (16%):</span>
                <span>BS {transaction.iva.toFixed(2)}</span>
              </div>
              <div className="total-grand" style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '8px', paddingTop: '4px', borderTop: '2px solid #000' }}>
                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL:</span>
                  <span>BS {transaction.total.toFixed(2)}</span>
                </div>
              </div>
              <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>MONTO PAGADO:</span>
                <span>BS {transaction.paidBs.toFixed(2)}</span>
              </div>
              {transaction.change > 0 && (
                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>VUELTO:</span>
                  <span>BS {transaction.change.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="payment-method" style={{ background: '#f0f0f0', padding: '4px', margin: '8px 0', textAlign: 'center', fontWeight: 'bold' }}>
              {paymentMethodLabels[transaction.payMethod] || transaction.payMethod.toUpperCase()}
            </div>

            <div className="footer" style={{ textAlign: 'center', marginTop: '16px', paddingTop: '8px', borderTop: '1px dashed #000', fontSize: '8px' }}>
              <p>¡Gracias por su compra!</p>
              <p>Válido como comprobante fiscal</p>
              <p style={{ fontSize: '7px', marginTop: '8px' }}>www.licopos.com</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-all">
            CERRAR
          </button>
          <button onClick={handlePrint} className="flex-1 py-2 bg-[#D4A017] text-black font-bold rounded-lg hover:bg-[#C4940F] transition-all flex items-center justify-center gap-2">
            <Printer size={16} /> IMPRIMIR
          </button>
        </div>
      </div>
    </div>
  );
}