"use client";

import { useRef } from 'react';
import { Printer, X, FileText, Share2 } from 'lucide-react';
import { Transaction } from '@/lib/types';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface ReceiptModalProps {
  transaction: Transaction;
  exchangeRate: number;
  receiptNumber?: number;
  onClose: () => void;
}

// Formatea la fecha de forma nativa para Venezuela
function formatToVenezuelaTime(dateStr: string): string {
  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      return new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    }
    
    return dateObj.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    return dateStr;
  }
}

export default function ReceiptModal({ transaction, exchangeRate, receiptNumber, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const rawNumber = transaction?.receiptNumber || receiptNumber;
  const formattedReceiptNumber = rawNumber 
    ? rawNumber.toString().padStart(8, '0')
    : (transaction?.id?.toString().slice(-8) || '00000000');

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo_Venta_${formattedReceiptNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0;
              padding: 4mm;
              font-size: 11px;
              color: #000;
              background: #fff;
              line-height: 1.2;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .header {
              margin-bottom: 6px;
              padding-bottom: 6px;
              border-bottom: 1px dashed #000;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              margin: 0 0 4px 0;
              letter-spacing: 1px;
            }
            .subtitle {
              font-size: 10px;
              margin: 2px 0;
            }
            .info-block {
              margin: 6px 0;
              font-size: 10px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 2px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            th {
              border-bottom: 1px dashed #000;
              border-top: 1px dashed #000;
              font-weight: bold;
              padding: 4px 0;
              font-size: 10px;
            }
            td {
              padding: 4px 0;
              vertical-align: top;
              font-size: 10px;
            }
            .totals {
              border-top: 1px dashed #000;
              padding-top: 4px;
              margin-top: 4px;
            }
            .total-grand {
              font-size: 13px;
              font-weight: bold;
              margin: 6px 0;
              padding: 4px 0;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
            }
            .payment-method {
              border: 1px solid #000;
              padding: 4px;
              margin: 8px 0;
              text-align: center;
              font-weight: bold;
              font-size: 11px;
            }
            .payment-list {
              border: 1px solid #000;
              padding: 4px;
              margin: 8px 0;
            }
            .payment-item {
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              margin: 2px 0;
            }
            .footer {
              margin-top: 12px;
              padding-top: 6px;
              border-top: 1px dashed #000;
              font-size: 9px;
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow?.document.close();
  };

  const handleExportPDF = () => handlePrint();
  const handleSharePDF = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Recibo ${formattedReceiptNumber}`,
          text: `Resumen de recibo correlativo nro ${formattedReceiptNumber} por un total de ${formatBs(transaction.total)}`,
        });
      } catch (err) {
        handlePrint();
      }
    } else {
      handlePrint();
    }
  };

  const paymentMethodLabels: Record<string, string> = {
    efectivo_bs: 'EFECTIVO BS',
    tarjeta: 'TARJETA DE DÉBITO/CRÉDITO',
    usd_efectivo: 'EFECTIVO USD ($)',
    biopago: 'BIOPAGO BANCO DE VENEZUELA',
    pago_movil: 'PAGO MÓVIL INTERBANCARIO',
    zelle: 'TRANSFERENCIA ZELLE',
  };

  const isCredito = transaction?.type === 'credito';
  const isCobroDeuda = transaction?.type === 'cobro_deuda';
  const isColaboracion = transaction?.type === 'colaboracion';
  const isConsumoPropio = transaction?.type === 'consumo_propio';

  const transactionDate = transaction?.date ? formatToVenezuelaTime(transaction.date) : '';
  const transactionClientName = transaction?.clientName || 'CONSUMIDOR FINAL';
  const transactionSubtotal = transaction?.subtotal || 0;
  const transactionIva = transaction?.iva || 0;
  const transactionTotal = transaction?.total || 0;
  const transactionPaidBs = transaction?.paidBs || 0;
  const transactionChange = transaction?.change || 0;
  const transactionPayMethod = transaction?.payMethod || 'efectivo_bs';
  const transactionItems = transaction?.items || [];
  const transactionExchangeRate = transaction?.exchangeRate || exchangeRate;
  const transactionPayments = transaction?.payments || [];

  // Determinar título según tipo de transacción
  const getDocumentTitle = () => {
    if (isCredito) return 'DOCUMENTO DE CRÉDITO';
    if (isCobroDeuda) return 'NOTA';
    if (isColaboracion) return 'COLABORACIÓN';
    if (isConsumoPropio) return 'CONSUMO PROPIO';
    return 'RECIBO';
  };

  const getTitleBgColor = () => {
    if (isCredito) return '#e74c3c';
    if (isCobroDeuda) return '#27ae60';
    if (isColaboracion) return '#9b59b6';
    if (isConsumoPropio) return '#f39c12';
    return '#2c3e50';
  };

  const getSpecialMessage = () => {
    if (isColaboracion) {
      return {
        title: '🎁 COLABORACIÓN',
        description: 'Salida de inventario por colaboración / donación',
        note: transaction.notes || 'Sin motivo especificado',
        showPrice: false
      };
    }
    if (isConsumoPropio) {
      return {
        title: '🍽️ CONSUMO PROPIO',
        description: 'Salida de inventario por consumo interno',
        note: transaction.notes || 'Sin motivo especificado',
        showPrice: false
      };
    }
    return null;
  };

  const special = getSpecialMessage();

  // ✅ Renderizar la sección de pagos (compuestos o simple) - CORREGIDO
  const renderPaymentSection = () => {
    if (isCredito || isCobroDeuda || isColaboracion || isConsumoPropio) return null;

    // Si hay pagos compuestos (múltiples métodos)
    if (transactionPayments && transactionPayments.length > 0) {
      return (
        <div className="payment-list" style={{ border: '1px solid #000', padding: '4px', margin: '8px 0' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', marginBottom: '4px' }}>DETALLE DE PAGOS</div>
          {transactionPayments.map((payment, idx) => {
            const isUsd = payment.method === 'usd_efectivo' || payment.method === 'zelle';
            let amountDisplay = '';
            if (isUsd) {
              // Para pagos en USD, usar usdAmount si existe, o amount (que viene en USD)
              const usdValue = payment.usdAmount !== undefined ? payment.usdAmount : payment.amount;
              amountDisplay = formatUsd(usdValue);
            } else {
              // Pagos en Bs
              amountDisplay = formatBs(payment.amount);
            }
            return (
              <div key={idx} className="payment-item" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '2px 0' }}>
                <span>{paymentMethodLabels[payment.method] || payment.method.toUpperCase()}</span>
                <span style={{ fontWeight: 'bold' }}>{amountDisplay}</span>
              </div>
            );
          })}
        </div>
      );
    } else {
      // Pago simple (compatibilidad con transacciones antiguas)
      return (
        <div className="payment-method" style={{ border: '1px solid #000', padding: '3px', margin: '8px 0', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>
          FORMA DE PAGO: {paymentMethodLabels[transactionPayMethod] || transactionPayMethod.toUpperCase()}
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col border border-gray-200">
        
        <div className="bg-[#1A2C4E] p-3.5 flex justify-between items-center border-b border-gray-700">
          <h3 className="text-white font-bold text-sm flex items-center gap-2 tracking-wide">
            <Printer size={16} className="text-amber-400" /> VISTA PREVIA DEL RECIBO
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 max-h-[65vh] overflow-y-auto bg-gray-100 flex justify-center">
          <div 
            ref={printRef} 
            className="bg-white p-5 shadow-sm text-black font-mono select-none"
            style={{ width: '72mm', boxSizing: 'border-box', color: '#000' }}
          >
            <div className="text-center" style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '1px' }}>LICORERIA CASTILLO</h1>
              <p style={{ fontSize: '10px', margin: '2px 0', fontWeight: 'bold' }}>Calle Ayacucho entre Calles Occidente y La Cruz, Sector La Playita</p>
              <p style={{ fontSize: '9px', margin: '2px 0' }}>RIF: V-11654282-6</p>
              <p style={{ fontSize: '9px', margin: '2px 0' }}>TEL: 0424-5397181</p>
              <p style={{ fontSize: '9px', margin: '2px 0' }}>Guama - Yaracuy</p>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <span style={{ 
                background: getTitleBgColor(), 
                color: 'white', 
                padding: '2px 8px', 
                fontSize: '9px', 
                fontWeight: 'bold',
                display: 'inline-block'
              }}>
                {getDocumentTitle()}
              </span>
            </div>

            <div style={{ margin: '6px 0', fontSize: '9px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{isCobroDeuda ? 'NOTA N°:' : (isCredito ? 'CRÉDITO N°:' : 'RECIBO N°:')} <span style={{ fontWeight: 'bold' }}>{formattedReceiptNumber}</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>FECHA: {transactionDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>CLIENTE: {transactionClientName.toUpperCase()}</span>
              </div>
            </div>

            {special && (
              <div style={{ 
                border: '1px dashed #9b59b6', 
                padding: '6px', 
                margin: '8px 0', 
                textAlign: 'center', 
                fontSize: '9px', 
                background: '#f9f0ff',
                borderRadius: '4px'
              }}>
                <p style={{ margin: '2px 0', fontWeight: 'bold', color: '#8e44ad' }}>{special.title}</p>
                <p style={{ margin: '2px 0' }}>{special.description}</p>
                <p style={{ margin: '2px 0', fontStyle: 'italic', fontSize: '8px' }}>Motivo: {special.note}</p>
                {special.showPrice && (
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Costo operación: {formatUsd(transaction.costoTotalOperacion || 0)}</p>
                )}
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000', borderTop: '1px dashed #000' }}>
                  <th style={{ textAlign: 'left', padding: '3px 0', fontSize: '9px' }}>CANT</th>
                  <th style={{ textAlign: 'left', padding: '3px 0', fontSize: '9px', paddingLeft: '4px' }}>PRODUCTO</th>
                  <th style={{ textAlign: 'right', padding: '3px 0', fontSize: '9px' }}>TOTAL (Bs)</th>
                </tr>
              </thead>
              <tbody>
                {transactionItems.length > 0 ? (
                  transactionItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dotted #eee' }}>
                      <td style={{ padding: '4px 0', fontSize: '9px', fontWeight: 'bold' }}>{item.qty} x</td>
                      <td style={{ padding: '4px 0', paddingLeft: '4px', fontSize: '9px' }}>
                        {item.name.toUpperCase().slice(0, 22)}
                        <div style={{ fontSize: '8px', color: '#555' }}>Ref: {formatBs(item.priceBs)}</div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '4px 0', fontSize: '9px', fontWeight: 'bold' }}>
                        {formatBsNumber(item.priceBs * item.qty)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '8px 0', color: '#666', fontStyle: 'italic' }}>
                      {isCobroDeuda ? '* ABONO / LIQUIDACIÓN DE CUENTA *' : '* Operación de Pago *'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mostrar solo subtotal/IVA si no es colaboración/consumo (estos tienen total 0) */}
            {!isColaboracion && !isConsumoPropio && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '2px 0' }}>
                  <span>SUBTOTAL:</span>
                  <span>{formatBs(transactionSubtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '2px 0' }}>
                  <span>IVA (16.00%):</span>
                  <span>{formatBs(transactionIva)}</span>
                </div>
                
                <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '5px 0', padding: '3px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>{isCredito ? 'TOTAL ADEUDADO:' : (isCobroDeuda ? 'MONTO ABONADO:' : 'TOTAL A PAGAR:')}</span>
                    <span>{formatBs(transactionTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333', fontWeight: 'normal', marginTop: '2px' }}>
                    <span>REF. DIVISAS:</span>
                    <span>{formatUsd(transactionTotal / transactionExchangeRate)}</span>
                  </div>
                </div>

                {isCredito && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', margin: '2px 0', color: '#e67e22' }}>
                    <span>TASA BCV APLICADA:</span>
                    <span>1 USD = {formatBsNumber(transactionExchangeRate)}</span>
                  </div>
                )}

                {!isCredito && !isCobroDeuda && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '2px 0' }}>
                      <span>MONTO RECIBIDO:</span>
                      <span>{formatBs(transactionPaidBs)}</span>
                    </div>
                    {transactionChange > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', margin: '2px 0', fontWeight: 'bold' }}>
                        <span>SU CAMBIO (VUELTO):</span>
                        <span>{formatBs(transactionChange)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Renderizar pagos compuestos o simple */}
            {!isCredito && !isColaboracion && !isConsumoPropio && renderPaymentSection()}

            {isCredito && (
              <div style={{ border: '1px dashed #e74c3c', padding: '6px', margin: '8px 0', textAlign: 'center', fontSize: '9px', background: '#fff5f5' }}>
                <p style={{ margin: '2px 0', fontWeight: 'bold', color: '#e74c3c' }}>📋 ESTE ES UN DOCUMENTO DE CRÉDITO</p>
                <p style={{ margin: '2px 0' }}>El cliente ha recibido los productos a crédito</p>
                <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Saldo pendiente: {formatBs(transactionTotal)}</p>
                <p style={{ margin: '2px 0', fontSize: '8px' }}>Conserve este documento como comprobante de deuda</p>
              </div>
            )}

            {isCobroDeuda && (
              <div style={{ border: '1px solid #27ae60', padding: '4px', margin: '8px 0', textAlign: 'center', fontSize: '9px', background: '#e8f8f5' }}>
                <p style={{ margin: '2px 0', fontWeight: 'bold', color: '#27ae60' }}>
                  {transaction.notes?.toLowerCase().includes('abono') ? '✓ ABONO DE DEUDA' : '✓ LIQUIDACIÓN DE DEUDA'}
                </p>
                <p style={{ margin: '2px 0', fontSize: '8px' }}>La deuda ha sido actualizada</p>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '6px', borderTop: '1px dashed #000', fontSize: '8px' }}>
              {isCredito ? (
                <>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>CONDICIONES DE CRÉDITO</p>
                  <p style={{ margin: '2px 0' }}>El pago debe realizarse en la fecha acordada</p>
                </>
              ) : isColaboracion ? (
                <>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>🎁 SALIDA POR COLABORACIÓN</p>
                  <p style={{ margin: '2px 0' }}>Este movimiento no genera ingreso en caja</p>
                </>
              ) : isConsumoPropio ? (
                <>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>🍽️ SALIDA POR CONSUMO PROPIO</p>
                  <p style={{ margin: '2px 0' }}>Este movimiento no genera ingreso en caja</p>
                </>
              ) : (
                <p style={{ margin: '2px 0', fontWeight: 'bold' }}>¡GRACIAS POR SU PREFERENCIA!</p>
              )}
              <p style={{ margin: '2px 0' }}>CONSERVE ESTE TICKET COMO COMPROBANTE</p>
              <p style={{ fontSize: '7px', marginTop: '6px', color: '#444' }}>Desarrollado por MasterPOS v1.0</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-200 text-slate-800 font-bold text-xs rounded-lg hover:bg-gray-300 transition-colors uppercase tracking-wider">Cerrar</button>
          <button onClick={handleExportPDF} className="flex-1 py-2 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm"><FileText size={14} /> PDF</button>
          <button onClick={handleSharePDF} className="flex-1 py-2 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm"><Share2 size={14} /> Compartir</button>
          <button onClick={handlePrint} className="flex-1 py-2 bg-[#D4A017] text-slate-950 font-black text-xs rounded-lg hover:bg-[#C4940F] transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm"><Printer size={14} /> Imprimir</button>
        </div>

      </div>
    </div>
  );
}
