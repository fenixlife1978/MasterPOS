"use client";

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, X, Archive, Calendar, Eye, Eraser, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatBsNumber } from '@/lib/currency-formatter';
import { syncService } from '@/services/syncService';

interface CloseHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

type CloseType = 'parcial' | 'final';
type FilterType = 'day' | 'month' | 'year';

interface UnifiedCloseRecord {
  id: string;
  fecha: string;
  tipo: CloseType;
  fechaDisplay: string;
  apertura: { bs: number; usd: number; tasa?: number };
  ventasContado: number;
  devoluciones: number;
  creditos: number;
  usdEfectivo: number;
  cuadre: Array<{ metodo: string; sistema: number; real: number; diferencia: number }>;
  totalSistema: number;
  totalReal: number;
  diferencia: number;
  estado: string;
  source: 'local' | 'turso';
  rawData: any;
}

// Función auxiliar para extraer un valor numérico de un objeto, probando múltiples rutas
function getNumericValue(obj: any, paths: string[]): number {
  for (const path of paths) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) break;
      current = current[part];
    }
    if (typeof current === 'number' && !isNaN(current)) {
      return current;
    }
  }
  return 0;
}

// Extraer ventas contado (en Bs) desde el array cuadre de un cierre final
function extractVentasContadoFromCuadre(cuadre: any[]): number {
  if (!cuadre || !Array.isArray(cuadre)) return 0;
  let total = 0;
  for (const row of cuadre) {
    if (row.moneda === 'Bs' || (row.metodo && row.metodo !== 'EFECTIVO USD' && row.metodo !== 'ZELLE')) {
      total += row.ventas || 0;
    }
  }
  return total;
}

// Extraer devoluciones totales (en Bs) desde el array cuadre
function extractDevolucionesFromCuadre(cuadre: any[]): number {
  if (!cuadre || !Array.isArray(cuadre)) return 0;
  let total = 0;
  for (const row of cuadre) {
    if (row.moneda === 'Bs' || (row.metodo && row.metodo !== 'EFECTIVO USD' && row.metodo !== 'ZELLE')) {
      total += row.devoluciones || 0;
    }
  }
  return total;
}

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CloseHistoryModal({ open, onClose }: CloseHistoryModalProps) {
  const [records, setRecords] = useState<UnifiedCloseRecord[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('day');
  // Fecha local actual para el filtro por día
  const [dateFilter, setDateFilter] = useState<string>(() => getLocalDateString(new Date()));
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [yearFilter, setYearFilter] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedRecord, setSelectedRecord] = useState<UnifiedCloseRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar cierres al abrir (localStorage + Turso)
  const loadAllCloses = async () => {
    const loadedRecords: UnifiedCloseRecord[] = [];

    // --- Procesar cierres desde localStorage ---
    const processParcial = (key: string, data: any): UnifiedCloseRecord => {
      const diff = data.diferenciaNetaGlobal ?? (data.cuadre?.reduce((sum: number, r: any) => sum + (r.diff ?? r.diferencia), 0) ?? 0);
      const totalSistema = data.cuadre?.reduce((sum: number, r: any) => sum + (r.sistema ?? r.sistBs ?? 0), 0) ?? 0;
      const totalReal = data.cuadre?.reduce((sum: number, r: any) => sum + (r.real ?? r.fisicoBs ?? 0), 0) ?? 0;
      const estado = Math.abs(diff) < 0.01 ? 'CONCILIADO' : (diff > 0 ? 'SOBRANTE' : 'FALTANTE');
      const cuadre = (data.cuadre || []).map((c: any) => ({
        metodo: c.metodo,
        sistema: c.sistema ?? c.sistBs ?? 0,
        real: c.real ?? c.fisicoBs ?? 0,
        diferencia: c.diff ?? c.diferencia ?? 0,
      }));
      const ventasContado = getNumericValue(data, ['ventas.totalContado', 'totalVentasContado', 'ventasContado']);
      const creditos = getNumericValue(data, ['creditos.total', 'totalCreditos', 'creditos']);
      const devoluciones = getNumericValue(data, ['devoluciones.total', 'totalDevoluciones', 'devoluciones']);
      const usdEfectivo = getNumericValue(data, ['usdEfectivo', 'efectivoUsd', 'totalUsdEfectivo']);
      return {
        id: key,
        fecha: data.fecha,
        tipo: 'parcial',
        fechaDisplay: new Date(data.fecha).toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
        apertura: { bs: data.apertura?.montoBs ?? 0, usd: data.apertura?.montoUsd ?? 0, tasa: data.tasaBCV },
        ventasContado,
        devoluciones,
        creditos,
        usdEfectivo,
        cuadre,
        totalSistema,
        totalReal,
        diferencia: diff,
        estado,
        source: 'local',
        rawData: data,
      };
    };

    const processFinal = (key: string, data: any): UnifiedCloseRecord => {
      const diff = data.totales?.diferencia ?? 0;
      const estado = data.totales?.estado ?? (Math.abs(diff) < 0.01 ? 'CONCILIADO' : (diff > 0 ? 'SOBRANTE' : 'FALTANTE'));
      const cuadre = (data.cuadre || []).map((c: any) => ({
        metodo: c.metodo,
        sistema: c.sistema,
        real: c.real,
        diferencia: c.diferencia,
      }));
      let ventasContado = 0;
      let devoluciones = 0;
      if (cuadre.length > 0) {
        ventasContado = extractVentasContadoFromCuadre(data.cuadre);
        devoluciones = extractDevolucionesFromCuadre(data.cuadre);
      } else {
        ventasContado = getNumericValue(data, ['ventas.totalContado', 'totalVentasContado', 'ventasContado']);
        devoluciones = getNumericValue(data, ['devoluciones.total', 'totalDevoluciones', 'devoluciones']);
      }
      const creditos = getNumericValue(data, ['totalCreditoBs', 'creditos.total', 'totalCreditos', 'creditos']);
      const usdEfectivo = getNumericValue(data, ['usdEfectivo', 'efectivoUsd', 'totalUsdEfectivo']);
      return {
        id: key,
        fecha: data.fecha,
        tipo: 'final',
        fechaDisplay: new Date(data.fecha).toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
        apertura: { bs: data.apertura?.bs ?? 0, usd: data.apertura?.usd ?? 0, tasa: data.tasaPeriodo2 },
        ventasContado,
        devoluciones,
        creditos,
        usdEfectivo,
        cuadre,
        totalSistema: data.totales?.sistema ?? 0,
        totalReal: data.totales?.real ?? 0,
        diferencia: diff,
        estado,
        source: 'local',
        rawData: data,
      };
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('corte_parcial_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          loadedRecords.push(processParcial(key, data));
        } catch (e) {}
      }
      if (key?.startsWith('cierre_final_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          loadedRecords.push(processFinal(key, data));
        } catch (e) {}
      }
    }

    // --- Cargar cierres desde Turso (colección cash_closes) ---
    try {
      const tursoCloses = await syncService.getAllCashCloses();
      for (const docData of tursoCloses) {
        const data = docData;
        const docId = data.id;
        if (!docId) {
          console.warn('Documento de Turso sin ID:', data);
          continue;
        }
        if (data.tipo === 'parcial') {
          const diff = data.diferenciaNetaGlobal ?? (data.cuadre?.reduce((sum: number, r: any) => sum + (r.diff ?? r.diferencia), 0) ?? 0);
          const totalSistema = data.cuadre?.reduce((sum: number, r: any) => sum + (r.sistema ?? 0), 0) ?? 0;
          const totalReal = data.cuadre?.reduce((sum: number, r: any) => sum + (r.real ?? 0), 0) ?? 0;
          const estado = Math.abs(diff) < 0.01 ? 'CONCILIADO' : (diff > 0 ? 'SOBRANTE' : 'FALTANTE');
          const cuadre = (data.cuadre || []).map((c: any) => ({
            metodo: c.metodo,
            sistema: c.sistema,
            real: c.real,
            diferencia: c.diff ?? c.diferencia ?? 0,
          }));
          const ventasContado = getNumericValue(data, ['ventas.totalContado', 'totalVentasContado', 'ventasContado']);
          const creditos = getNumericValue(data, ['creditos.total', 'totalCreditos', 'creditos']);
          const devoluciones = getNumericValue(data, ['devoluciones.total', 'totalDevoluciones', 'devoluciones']);
          const usdEfectivo = getNumericValue(data, ['usdEfectivo', 'efectivoUsd', 'totalUsdEfectivo']);
          loadedRecords.push({
            id: docId,
            fecha: data.fecha,
            tipo: 'parcial',
            fechaDisplay: new Date(data.fecha).toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
            apertura: { bs: data.apertura?.montoBs ?? 0, usd: data.apertura?.montoUsd ?? 0, tasa: data.tasaBCV },
            ventasContado,
            devoluciones,
            creditos,
            usdEfectivo,
            cuadre,
            totalSistema,
            totalReal,
            diferencia: diff,
            estado,
            source: 'turso',
            rawData: data,
          });
        } else if (data.tipo === 'final') {
          const diff = data.totales?.diferencia ?? 0;
          const estado = data.totales?.estado ?? (Math.abs(diff) < 0.01 ? 'CONCILIADO' : (diff > 0 ? 'SOBRANTE' : 'FALTANTE'));
          const cuadre = (data.cuadre || []).map((c: any) => ({
            metodo: c.metodo,
            sistema: c.sistema,
            real: c.real,
            diferencia: c.diferencia,
          }));
          let ventasContado = 0;
          let devoluciones = 0;
          if (cuadre.length > 0) {
            ventasContado = extractVentasContadoFromCuadre(data.cuadre);
            devoluciones = extractDevolucionesFromCuadre(data.cuadre);
          } else {
            ventasContado = getNumericValue(data, ['ventas.totalContado', 'totalVentasContado', 'ventasContado']);
            devoluciones = getNumericValue(data, ['devoluciones.total', 'totalDevoluciones', 'devoluciones']);
          }
          const creditos = getNumericValue(data, ['totalCreditoBs', 'creditos.total', 'totalCreditos', 'creditos']);
          const usdEfectivo = getNumericValue(data, ['usdEfectivo', 'efectivoUsd', 'totalUsdEfectivo']);
          loadedRecords.push({
            id: docId,
            fecha: data.fecha,
            tipo: 'final',
            fechaDisplay: new Date(data.fecha).toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'medium' }),
            apertura: { bs: data.apertura?.bs ?? 0, usd: data.apertura?.usd ?? 0, tasa: data.tasaPeriodo2 },
            ventasContado,
            devoluciones,
            creditos,
            usdEfectivo,
            cuadre,
            totalSistema: data.totales?.sistema ?? 0,
            totalReal: data.totales?.real ?? 0,
            diferencia: diff,
            estado,
            source: 'turso',
            rawData: data,
          });
        }
      }
    } catch (error) {
      console.error('Error cargando cierres desde Turso:', error);
    }

    // Ordenar por fecha descendente
    loadedRecords.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    setRecords(loadedRecords);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadAllCloses();
  }, [open]);

  // Filtrar registros
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = new Date(record.fecha);
      switch (filterType) {
        case 'day': {
          if (!dateFilter) return true;
          const recordYear = recordDate.getFullYear();
          const recordMonth = recordDate.getMonth();
          const recordDay = recordDate.getDate();
          const [filterYear, filterMonth, filterDay] = dateFilter.split('-').map(Number);
          return recordYear === filterYear && recordMonth === filterMonth - 1 && recordDay === filterDay;
        }
        case 'month':
          if (!monthFilter) return true;
          const [year, month] = monthFilter.split('-').map(Number);
          return recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month;
        case 'year':
          if (!yearFilter) return true;
          return recordDate.getFullYear() === parseInt(yearFilter);
        default:
          return true;
      }
    });
  }, [records, filterType, dateFilter, monthFilter, yearFilter]);

  const handleClearFilters = () => {
    setFilterType('day');
    const today = new Date();
    setDateFilter(getLocalDateString(today));
    setMonthFilter(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    setYearFilter(today.getFullYear().toString());
  };

  // ✅ CORREGIDO: Eliminar cierre usando syncService (Turso)
  const handleDeleteRecord = async (record: UnifiedCloseRecord) => {
    const confirmMsg = `¿Eliminar este cierre del ${record.fechaDisplay}? Esta acción no se puede deshacer.`;
    if (!confirm(confirmMsg)) return;

    try {
      let idToDelete = record.id;
      if (!idToDelete && record.rawData) {
        idToDelete = record.rawData.id || record.rawData.docId;
      }
      if (!idToDelete) {
        console.error('No se pudo determinar el ID del cierre a eliminar', record);
        alert('Error: No se pudo identificar el cierre para eliminar.');
        return;
      }

      console.log(`Eliminando cierre: ${idToDelete} (fuente: ${record.source})`);

      if (record.source === 'local') {
        localStorage.removeItem(idToDelete);
      } else if (record.source === 'turso') {
        // ✅ Usar syncService para eliminar de Turso
        await syncService.deleteCashClose?.(idToDelete);
      }
      // Recargar la lista después de eliminar
      await loadAllCloses();
    } catch (error: any) {
      console.error('Error al eliminar cierre:', error);
      alert(`No se pudo eliminar el cierre: ${error.message || 'Error desconocido'}`);
    }
  };

  const exportToPDF = (record: UnifiedCloseRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = `
      <html>
        <head><title>Reporte de Cierre - MasterPOS</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #D4A017; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #D4A017; color: black; }
          .right { text-align: right; }
          .success { color: green; }
          .warning { color: orange; }
          .error { color: red; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
        </head>
        <body>
          <h1>MasterPOS - Reporte de Cierre</h1>
          <p><strong>Fecha:</strong> ${record.fechaDisplay}</p>
          <p><strong>Tipo:</strong> ${record.tipo === 'parcial' ? 'CORTE PARCIAL' : 'CIERRE FINAL'}</p>
          <p><strong>Fuente:</strong> ${record.source === 'turso' ? 'Cloud (Turso)' : 'Local (navegador)'}</p>
          <p><strong>Apertura:</strong> ${formatBs(record.apertura.bs)} + ${formatUsd(record.apertura.usd)}</p>
          ${record.apertura.tasa ? `<p><strong>Tasa BCV:</strong> ${formatBs(record.apertura.tasa)}</p>` : ''}
          <p><strong>Ventas Contado:</strong> ${formatBs(record.ventasContado)}</p>
          <p><strong>Devoluciones:</strong> ${formatBs(record.devoluciones)}</p>
          <p><strong>Créditos:</strong> ${formatBs(record.creditos)}</p>
          <p><strong>USD en efectivo:</strong> ${formatUsd(record.usdEfectivo)}</p>
          <h3>Cuadre por Método</h3>
          <table>
            <thead>
              <tr><th>Método</th><th>Sistema (Bs)</th><th>Real (Bs)</th><th>Diferencia</th></tr>
            </thead>
            <tbody>${record.cuadre.map(c => `
              <tr>
                <td>${c.metodo}</td>
                <td class="right">${formatBsNumber(c.sistema)}</td>
                <td class="right">${formatBsNumber(c.real)}</td>
                <td class="right ${c.diferencia > 0 ? 'warning' : c.diferencia < 0 ? 'error' : 'success'}">${c.diferencia > 0 ? '+' : ''}${formatBsNumber(c.diferencia)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <h3>Resumen Final</h3>
          <p><strong>Total Sistema:</strong> ${formatBs(record.totalSistema)}</p>
          <p><strong>Total Real:</strong> ${formatBs(record.totalReal)}</p>
          <p><strong>Diferencia Neta:</strong> <span class="${record.diferencia > 0 ? 'warning' : record.diferencia < 0 ? 'error' : 'success'}">${record.diferencia > 0 ? '+' : ''}${formatBs(record.diferencia)}</span></p>
          <p><strong>Estado:</strong> ${record.estado}</p>
          <div class="footer">Reporte generado por MasterPOS el ${new Date().toLocaleString()}</div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-5xl p-0 overflow-hidden rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Historial de Cierres de Caja</DialogTitle>
          </DialogHeader>
          <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Archive size={24} className="text-primary" />
                <h3 className="text-xl font-headline font-black">Historial de Cierres de Caja</h3>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
          </div>
          <div className="p-5 border-b border-gray-200">
            <div className="flex flex-wrap gap-4 items-end">
              <div><label className="text-[10px] font-bold uppercase text-black/60 block mb-1">Filtrar por</label>
                <div className="flex gap-2">
                  <button onClick={() => setFilterType('day')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition", filterType === 'day' ? "bg-primary text-black" : "bg-gray-100 text-black/60")}>Día</button>
                  <button onClick={() => setFilterType('month')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition", filterType === 'month' ? "bg-primary text-black" : "bg-gray-100 text-black/60")}>Mes</button>
                  <button onClick={() => setFilterType('year')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition", filterType === 'year' ? "bg-primary text-black" : "bg-gray-100 text-black/60")}>Año</button>
                </div>
              </div>
              {filterType === 'day' && (
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase text-black/60 block mb-1">Fecha</label><Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="h-8 text-sm" /></div>
              )}
              {filterType === 'month' && (
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase text-black/60 block mb-1">Mes</label><Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="h-8 text-sm" /></div>
              )}
              {filterType === 'year' && (
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase text-black/60 block mb-1">Año</label><Input type="number" value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="h-8 text-sm" placeholder="2024" /></div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleClearFilters} variant="outline" className="h-8 text-xs border-gray-300">
                  <Eraser size={12} className="mr-1" /> Limpiar Filtros
                </Button>
                <Button
                  onClick={() => {
                    const today = new Date();
                    setFilterType('day');
                    setDateFilter(getLocalDateString(today));
                  }}
                  variant="outline"
                  className="h-8 text-xs border-gray-300"
                >
                  <Calendar size={12} className="mr-1" /> Hoy
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-black/40 mt-3">
              Mostrando ${filteredRecords.length} de ${records.length} cierres
              {!loading && records.some(r => r.source === 'turso') && <span className="ml-2 text-primary">(incluye datos en la nube)</span>}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="text-center py-10 text-black/50 italic">Cargando historial...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-10 text-black/50 italic">No hay cierres para el período seleccionado</div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map(record => (
                  <div key={record.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start flex-wrap gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full", record.tipo === 'parcial' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                            {record.tipo === 'parcial' ? 'CORTE PARCIAL' : 'CIERRE FINAL'}
                          </span>
                          {record.source === 'turso' && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Cloud</span>
                          )}
                          <p className="text-xs font-mono text-black/50">{record.id}</p>
                        </div>
                        <p className="text-sm font-bold text-black mt-1">{record.fechaDisplay}</p>
                        <p className="text-[10px] text-black/50 mt-1">Apertura: ${formatBs(record.apertura.bs)} + ${formatUsd(record.apertura.usd)} | Ventas: ${formatBs(record.ventasContado)} | Créditos: ${formatBs(record.creditos)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", record.estado === 'CONCILIADO' ? "bg-green-100 text-green-700" : record.estado === 'SOBRANTE' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                            {record.estado} ${record.diferencia !== 0 && `(${record.diferencia > 0 ? '+' : ''}${formatBsNumber(Math.abs(record.diferencia))})`}
                          </div>
                          <span className="text-[9px] text-black/40">USD en caja: ${formatUsd(record.usdEfectivo)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => { setSelectedRecord(record); setShowDetailModal(true); }} variant="outline" className="h-8 text-xs border-gray-300"><Eye size={12} className="mr-1" /> Detalle</Button>
                        <Button onClick={() => exportToPDF(record)} className="h-8 text-xs bg-[#D4A017] hover:bg-[#b8890f] text-black font-bold"><FileText size={12} className="mr-1" /> PDF</Button>
                        <Button onClick={() => handleDeleteRecord(record)} variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50">
                          <Trash2 size={12} className="mr-1" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
            <p className="text-[9px] text-black/40">Los cierres se almacenan localmente y en la nube (Turso)</p>
            <Button onClick={onClose} variant="ghost" className="text-black/60 hover:text-black text-xs">Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del Cierre</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <>
              <div className="bg-[#1A2C4E] p-4 text-white sticky top-0">
                <div className="flex justify-between items-center">
                  <h4 className="font-black">Detalle del Cierre</h4>
                  <button onClick={() => setShowDetailModal(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[9px] text-black/50">Fecha</p><p className="font-bold text-sm">{selectedRecord.fechaDisplay}</p></div>
                  <div><p className="text-[9px] text-black/50">Tipo</p><p className="font-bold text-sm">{selectedRecord.tipo === 'parcial' ? 'Corte Parcial' : 'Cierre Final'}</p></div>
                  <div><p className="text-[9px] text-black/50">Apertura</p><p className="font-bold text-sm">{formatBs(selectedRecord.apertura.bs)} + {formatUsd(selectedRecord.apertura.usd)}</p></div>
                  {selectedRecord.apertura.tasa && <div><p className="text-[9px] text-black/50">Tasa BCV</p><p className="font-bold text-sm">{formatBs(selectedRecord.apertura.tasa)}</p></div>}
                  <div><p className="text-[9px] text-black/50">Ventas Contado</p><p className="font-bold text-sm">{formatBs(selectedRecord.ventasContado)}</p></div>
                  <div><p className="text-[9px] text-black/50">Devoluciones</p><p className="font-bold text-sm text-red-600">{formatBs(selectedRecord.devoluciones)}</p></div>
                  <div><p className="text-[9px] text-black/50">Créditos</p><p className="font-bold text-sm">{formatBs(selectedRecord.creditos)}</p></div>
                  <div><p className="text-[9px] text-black/50">USD Efectivo</p><p className="font-bold text-sm">{formatUsd(selectedRecord.usdEfectivo)}</p></div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs font-bold mb-2">Cuadre por método</p>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr><th className="p-2 text-left">Método</th><th className="p-2 text-right">Sistema (Bs)</th><th className="p-2 text-right">Real (Bs)</th><th className="p-2 text-right">Diferencia</th></tr>
                    </thead>
                    <tbody>
                      {selectedRecord.cuadre.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{row.metodo}</td>
                          <td className="p-2 text-right">{formatBsNumber(row.sistema)}</td>
                          <td className="p-2 text-right">{formatBsNumber(row.real)}</td>
                          <td className={cn("p-2 text-right", row.diferencia < 0 ? "text-red-600" : row.diferencia > 0 ? "text-emerald-600" : "")}>
                            {row.diferencia === 0 ? '✓' : formatBsNumber(Math.abs(row.diferencia))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-black/50">Resultado Global</p>
                  <p className={cn("text-xl font-black", selectedRecord.diferencia > 0 ? "text-emerald-600" : selectedRecord.diferencia < 0 ? "text-red-600" : "text-slate-500")}>
                    {selectedRecord.diferencia > 0 ? '+' : ''}{formatBs(selectedRecord.diferencia)} ({selectedRecord.estado})
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 border-t flex justify-end">
                <Button onClick={() => exportToPDF(selectedRecord)} className="bg-[#D4A017] hover:bg-[#b8890f] text-black font-bold text-xs">
                  <FileText size={12} className="mr-1" /> Exportar PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}