"use client";

import { useState, useMemo } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Vault, Lock, Unlock, FileText, Share2, Printer, CreditCard, Banknote, Smartphone, Fingerprint, Plane, DollarSign, History, Download, Check } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CashModuleProps {
  state: ReturnType<typeof usePOSState>;
}

export default function CashModule({ state }: CashModuleProps) {
  const [openAmount, setOpenAmount] = useState('0.00');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [copied, setCopied] = useState(false);

  const reg = state.register;
  const isClosed = !reg || !reg.isOpen;

  const totalContado = reg?.txs.filter(t => t.type === 'contado' || t.type === 'cobro_deuda').reduce((s,t) => s + t.total, 0) || 0;
  const totalCredito = reg?.txs.filter(t => t.type === 'credito').reduce((s,t) => s + t.total, 0) || 0;

  // Distribución por método de pago
  const paymentDistribution = useMemo(() => {
    const methods = ['efectivo_bs', 'tarjeta', 'usd_efectivo', 'biopago', 'pago_movil', 'zelle'];
    const dist: Record<string, number> = {};
    
    methods.forEach(m => dist[m] = 0);
    
    if (reg) {
      reg.txs.forEach(t => {
        if (t.type === 'contado' || t.type === 'cobro_deuda') {
          const method = t.payMethod || 'efectivo_bs';
          if (dist[method] !== undefined) {
            dist[method] += t.total;
          } else {
            dist[method] = (dist[method] || 0) + t.total;
          }
        }
      });
    }
    return Object.entries(dist).map(([method, total]) => ({ method, total }));
  }, [reg]);

  const methodIcons: Record<string, any> = {
    efectivo_bs: Banknote,
    tarjeta: CreditCard,
    usd_efectivo: DollarSign,
    biopago: Fingerprint,
    pago_movil: Smartphone,
    zelle: Plane,
  };

  const methodLabels: Record<string, string> = {
    efectivo_bs: 'Efectivo BS',
    tarjeta: 'Tarjeta',
    usd_efectivo: 'USD Efectivo',
    biopago: 'Biopago',
    pago_movil: 'Pago Móvil',
    zelle: 'Zelle',
  };

  // Función para exportar a PDF/CSV/JSON
  const handleExport = () => {
    const data = {
      fecha: new Date().toLocaleString(),
      caja: {
        estado: isClosed ? 'CERRADA' : 'ABIERTA',
        apertura: reg?.openAmount || 0,
        totalCaja: reg ? (reg.openAmount + totalContado) : 0,
        ventasCredito: totalCredito
      },
      transacciones: reg?.txs || [],
      distribucionPagos: paymentDistribution
    };

    if (exportFormat === 'pdf') {
      // Crear ventana de impresión para "PDF"
      const printWindow = window.open('', '_blank');
      printWindow?.document.write(`
        <html>
          <head><title>Reporte de Caja</title></head>
          <body>
            <pre>${JSON.stringify(data, null, 2)}</pre>
            <script>window.print();<\/script>
          </body>
        </html>
      `);
    } else if (exportFormat === 'csv') {
      // Exportar a CSV
      const headers = ['Fecha', 'Tipo', 'Método', 'Monto BS', 'Cliente'];
      const rows = reg?.txs.map(t => [
        new Date(t.date).toLocaleString(),
        t.type,
        t.payMethod || 'efectivo_bs',
        t.total,
        t.clientName || 'CLIENTE FINAL'
      ]) || [];
      
      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_caja_${new Date().toISOString().slice(0,19)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_caja_${new Date().toISOString().slice(0,19)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    setShowExportModal(false);
  };

  // Función para imprimir
  const handlePrint = () => {
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <html>
        <head>
          <title>Reporte de Caja - LicoPOS</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Reporte de Caja</h1>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Estado: ${isClosed ? 'CERRADA' : 'ABIERTA'}</p>
          <p>Apertura: BS ${reg?.openAmount?.toFixed(2) || 0}</p>
          <p>Total en Caja: BS ${((reg?.openAmount || 0) + totalContado).toFixed(2)}</p>
          <p>Ventas Crédito: BS ${totalCredito.toFixed(2)}</p>
          <h2>Transacciones</h2>
          <table>
            <tr><th>Hora</th><th>Tipo</th><th>Método</th><th>Monto BS</th><th>Cliente</th></tr>
            ${reg?.txs.map(t => `
              <tr>
                <td>${new Date(t.date).toLocaleTimeString()}</td>
                <td>${t.type}</td>
                <td>${t.payMethod || 'efectivo_bs'}</td>
                <td>BS ${t.total.toFixed(2)}</td>
                <td>${t.clientName || 'CLIENTE FINAL'}</td>
              </tr>
            `).join('') || '<tr><td colspan="5">Sin transacciones</td></tr>'}
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(printContent.innerHTML);
    printWindow?.document.close();
    printWindow?.print();
  };

  // Función para compartir
  const handleShare = async () => {
    const shareData = {
      title: 'Reporte de Caja LicoPOS',
      text: `Reporte del día ${new Date().toLocaleDateString()}\nTotal en Caja: BS ${((reg?.openAmount || 0) + totalContado).toFixed(2)}\nVentas: ${reg?.txs.length || 0} transacciones`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error al compartir:', err);
        setShowShareModal(true);
      }
    } else {
      setShowShareModal(true);
    }
  };

  // Función para copiar reporte al portapapeles
  const copyToClipboard = () => {
    const reportText = `
REPORTE DE CAJA - LicoPOS
========================
Fecha: ${new Date().toLocaleString()}
Estado: ${isClosed ? 'CERRADA' : 'ABIERTA'}
Apertura: BS ${reg?.openAmount?.toFixed(2) || 0}
Total en Caja: BS ${((reg?.openAmount || 0) + totalContado).toFixed(2)}
Ventas Crédito: BS ${totalCredito.toFixed(2)}
Total Transacciones: ${reg?.txs.length || 0}

DISTRIBUCIÓN POR MÉTODO:
${paymentDistribution.map(d => `${methodLabels[d.method]}: BS ${d.total.toFixed(2)}`).join('\n')}

ÚLTIMAS TRANSACCIONES:
${reg?.txs.slice(-5).reverse().map(t => `${new Date(t.date).toLocaleTimeString()} - ${t.type} - BS ${t.total.toFixed(2)}`).join('\n') || 'Sin transacciones'}
    `;
    
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <h2 className="text-2xl font-headline font-black text-black mb-6">Gestión de Bóveda</h2>

      {/* Tabla de estado de caja */}
      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md mb-6">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Estado</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Apertura</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Total en Caja</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Ventas Crédito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-b border-[#9E9E9E]">
              <TableCell className="py-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold",
                  isClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                )}>
                  {isClosed ? 'CERRADA' : 'ABIERTA'}
                </span>
              </TableCell>
              <TableCell className="font-bold text-black">
                {!isClosed ? `BS ${reg.openAmount.toFixed(2)}` : '—'}
              </TableCell>
              <TableCell className="font-bold text-black">
                {!isClosed ? `BS ${(reg.openAmount + totalContado).toFixed(2)}` : '—'}
              </TableCell>
              <TableCell className="font-bold text-black">
                {!isClosed ? `BS ${totalCredito.toFixed(2)}` : '—'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Apertura/Acciones de caja */}
      {isClosed ? (
        <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6 shadow-md">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-black uppercase tracking-widest">Monto Inicial</span>
              <Input 
                type="number" 
                value={openAmount} 
                onChange={(e) => setOpenAmount(e.target.value)}
                className="w-32 bg-white border-[#9E9E9E] text-black font-bold text-center"
              />
              <span className="text-black font-bold">BS</span>
            </div>
            <Button 
              onClick={() => state.openCashRegister(parseFloat(openAmount) || 0)}
              className="bg-[#2ECC71] hover:bg-[#27AE60] text-white font-black h-9 px-6"
            >
              <Unlock size={16} className="mr-2" /> ABRIR CAJA
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap mb-6">
          <Button 
            variant="destructive" 
            className="font-black h-9 px-6" 
            onClick={() => {
              if (confirm('¿Está seguro de cerrar la caja? Se generará un reporte final.')) {
                state.closeCashRegister();
              }
            }}
          >
            <Lock size={16} className="mr-2" /> CERRAR CAJA
          </Button>
          <Button 
            className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-[#9E9E9E] font-black h-9 px-4"
            onClick={() => setShowExportModal(true)}
          >
            <FileText size={16} className="mr-2" /> EXPORTAR
          </Button>
          <Button 
            className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-[#9E9E9E] font-black h-9 px-4"
            onClick={handlePrint}
          >
            <Printer size={16} className="mr-2" /> IMPRIMIR
          </Button>
          <Button 
            className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-[#9E9E9E] font-black h-9 px-4"
            onClick={handleShare}
          >
            <Share2 size={16} className="mr-2" /> COMPARTIR
          </Button>
        </div>
      )}

      {/* Modal de Exportación */}
      {showExportModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full border border-[#9E9E9E]">
            <h3 className="text-lg font-bold text-black mb-4">Exportar Reporte</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="radio" value="pdf" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} />
                <span className="text-black">PDF (Imprimir)</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="radio" value="csv" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} />
                <span className="text-black">CSV (Excel)</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="radio" value="json" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} />
                <span className="text-black">JSON</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => setShowExportModal(false)} className="flex-1 bg-[#E8E8E8] text-black border border-[#9E9E9E]">
                CANCELAR
              </Button>
              <Button onClick={handleExport} className="flex-1 bg-[#D4A017] text-black font-bold">
                <Download size={16} className="mr-2" /> EXPORTAR
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compartir */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full border border-[#9E9E9E]">
            <h3 className="text-lg font-bold text-black mb-4">Compartir Reporte</h3>
            <p className="text-sm text-black/70 mb-4">Copia el resumen del reporte al portapapeles:</p>
            <div className="bg-[#F5F5F5] p-3 rounded-lg mb-4 max-h-40 overflow-y-auto text-xs text-black">
              <pre className="whitespace-pre-wrap">
{`REPORTE DE CAJA - LicoPOS
Fecha: ${new Date().toLocaleString()}
Total en Caja: BS ${((reg?.openAmount || 0) + totalContado).toFixed(2)}
Transacciones: ${reg?.txs.length || 0}`}
              </pre>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowShareModal(false)} className="flex-1 bg-[#E8E8E8] text-black border border-[#9E9E9E]">
                CERRAR
              </Button>
              <Button onClick={copyToClipboard} className="flex-1 bg-[#D4A017] text-black font-bold">
                {copied ? <Check size={16} className="mr-2" /> : <Share2 size={16} className="mr-2" />}
                {copied ? 'COPIADO' : 'COPIAR'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Distribución por Método */}
      {!isClosed && (
        <div className="mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 flex items-center gap-2">
            <Vault size={14} className="text-[#D4A017]" /> Distribución por Método de Pago
          </h3>
          <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
            <Table>
              <TableHeader className="bg-[#E8E8E8]">
                <TableRow className="border-b border-[#9E9E9E]">
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Método</TableHead>
                  <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Total (BS)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentDistribution.map(({ method, total }) => {
                  const Icon = methodIcons[method] || DollarSign;
                  return (
                    <TableRow key={method} className="border-b border-[#9E9E9E]">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#D4A017]/10 flex items-center justify-center">
                            <Icon size={12} className="text-[#D4A017]" />
                          </div>
                          <span className="text-xs font-bold text-black">{methodLabels[method] || method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-black">
                        BS {total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Historial de Transacciones */}
      <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 flex items-center gap-2">
        <History size={14} className="text-[#D4A017]" /> Historial de Transacciones
      </h3>
      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Hora</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Tipo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Método</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest">Monto BS</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest text-right">Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reg?.txs.map((t) => (
              <TableRow key={t.id} className="border-b border-[#9E9E9E] hover:bg-[#F5F5F5]">
                <TableCell className="text-xs text-black/60">
                  {new Date(t.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    t.type === 'contado' ? "bg-green-100 text-green-700" :
                    t.type === 'credito' ? "bg-orange-100 text-orange-700" :
                    "bg-blue-100 text-blue-700"
                  )}>
                    {t.type.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-bold uppercase text-black/60">
                  {(t.payMethod || 'efectivo_bs').replace('_', ' ')}
                </TableCell>
                <TableCell className="font-bold text-sm text-black">
                  BS {t.total.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-medium text-xs text-black/60">
                  {t.clientName || 'CLIENTE FINAL'}
                </TableCell>
              </TableRow>
            ))}
            {(!reg || reg.txs.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-black/50 italic">
                  Sin movimientos registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}