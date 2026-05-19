"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, X, Archive, Printer, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CloseHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

interface CloseHistory {
  id: string;
  fecha: string;
  fechaCierre: string;
  apertura: {
    montoBs: number;
    tasaUsd: number;
    montoUsd: number;
  };
  ventas: {
    totalContado: number;
    totalCredito: number;
    totalEnCaja: number;
    porMetodo: Record<string, number>;
  };
  cuadre: Array<{
    metodo: string;
    sistema: number;
    real: number;
    diferencia: number;
  }>;
  totales: {
    sistema: number;
    real: number;
    diferencia: number;
    estado: string;
  };
}

export default function CloseHistoryModal({ open, onClose }: CloseHistoryModalProps) {
  const [closeHistory, setCloseHistory] = useState<CloseHistory[]>([]);

  useEffect(() => {
    if (open) {
      const history: CloseHistory[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cierre_caja_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            history.push({ ...data, id: key });
          } catch (e) {}
        }
      }
      setCloseHistory(history.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
    }
  }, [open]);

  const exportToPDF = (history: CloseHistory) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Reporte de Cierre - MasterPOS</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #D4A017; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #D4A017; color: black; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            .success { color: green; font-weight: bold; }
            .warning { color: orange; font-weight: bold; }
            .error { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>MasterPOS - Reporte de Cierre</h1>
          <p><strong>Fecha de cierre:</strong> ${new Date(history.fecha).toLocaleString()}</p>
          <p><strong>Apertura:</strong> BS ${history.apertura.montoBs.toFixed(2)} (≈ $${history.apertura.montoUsd.toFixed(2)})</p>
          <p><strong>Tasa BCV:</strong> BS ${history.apertura.tasaUsd.toFixed(2)} / USD</p>
          <p><strong>Total Ventas:</strong> BS ${history.ventas.totalContado.toFixed(2)}</p>
          <p><strong>Total Crédito:</strong> BS ${history.ventas.totalCredito.toFixed(2)}</p>
          <h3>Cuadre por Método</h3>
          <tr>
            <thead><tr><th>Método</th><th>Sistema (BS)</th><th>Real (BS)</th><th>Diferencia</th></tr></thead>
            <tbody>
              ${history.cuadre.map(c => `
                <tr>
                  <td>${c.metodo}</td>
                  <td>BS ${c.sistema.toFixed(2)}</td>
                  <td>BS ${c.real.toFixed(2)}</td>
                  <td class="${c.diferencia > 0 ? 'warning' : c.diferencia < 0 ? 'error' : 'success'}">${c.diferencia > 0 ? '+' : ''}${c.diferencia.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <h3>Resumen Final</h3>
          <p><strong>Total Sistema:</strong> BS ${history.totales.sistema.toFixed(2)}</p>
          <p><strong>Total Real:</strong> BS ${history.totales.real.toFixed(2)}</p>
          <p><strong>Diferencia:</strong> <span class="${history.totales.diferencia > 0 ? 'warning' : history.totales.diferencia < 0 ? 'error' : 'success'}">${history.totales.diferencia > 0 ? '+' : ''}${history.totales.diferencia.toFixed(2)}</span></p>
          <p><strong>Estado:</strong> ${history.totales.estado}</p>
          <div class="footer">Reporte generado por MasterPOS</div>
        </body>
      </html>
    `;
    printWindow?.document.write(content);
    printWindow?.document.close();
    printWindow?.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex flex-col">
          <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Archive size={24} className="text-primary" />
                <h3 className="text-xl font-headline font-black">Historial de Cierres de Caja</h3>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
          </div>
          <div className="p-6">
            {closeHistory.length === 0 ? (
              <div className="text-center py-10 text-black/50 italic">No hay cierres registrados</div>
            ) : (
              <div className="space-y-3">
                {closeHistory.map((history) => (
                  <div key={history.id} className="bg-white border border-[#9E9E9E] rounded-xl p-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-center flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-bold text-black">{new Date(history.fecha).toLocaleString()}</p>
                        <p className="text-[10px] text-black/50">Apertura: BS {history.apertura.montoBs.toFixed(2)} | Ventas: BS {history.ventas.totalContado.toFixed(2)}</p>
                        <p className={cn("text-[10px] font-bold mt-1", 
                          history.totales.estado === 'CONCILIADO' ? "text-green-600" : 
                          history.totales.estado === 'SOBRANTE' ? "text-yellow-600" : "text-red-600"
                        )}>
                          {history.totales.estado} {history.totales.diferencia !== 0 && `(${history.totales.diferencia > 0 ? '+' : ''}${history.totales.diferencia.toFixed(2)})`}
                        </p>
                      </div>
                      <Button onClick={() => exportToPDF(history)} className="bg-[#D4A017] hover:brightness-110 text-black font-black">
                        <FileText size={14} className="mr-2" /> EXPORTAR PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end">
            <Button onClick={onClose} className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]">CERRAR</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
