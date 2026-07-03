"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAccounting } from '@/hooks/use-accounting';
import { Plus, Search, X, TrendingUp, TrendingDown, DollarSign, Filter, Eye, BarChart3, RefreshCw } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ExpenseModal from './expense-modal';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import { usePOSState } from '@/hooks/use-pos-state';

// ✅ Importar Firebase
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import syncService from '@/services/syncService';

// ✅ Configuración de Firebase (usa tus variables de entorno)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// ✅ Inicializar Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Función para obtener timestamp único
const getTimestamp = (): number => Date.now();

// ✅ Obtener fecha actual en Venezuela (formato YYYY-MM-DD)
const getVenezuelaDate = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

// ✅ Formatear fecha para mostrar (con zona horaria Venezuela)
const formatDateFriendly = (dateStr: string | Date): string => {
  if (!dateStr) return '—';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(dateStr);
  }
};

// ✅ FUNCIÓN CORREGIDA: Inicio del día en Venezuela (NO en UTC)
const getStartOfDayVenezuela = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-04:00`);
};

// ✅ FUNCIÓN CORREGIDA: Fin del día en Venezuela (NO en UTC)
const getEndOfDayVenezuela = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-04:00`);
};

// ✅ Parsear fecha de Firestore
const parseFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date.toDate) return date.toDate();
  if (typeof date === 'string') return new Date(date);
  if (date instanceof Date) return date;
  return new Date(date);
};

// ✅ Función para mostrar fecha en el filtro
const displayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// ✅ Categorías
const categoriesList = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'contado', label: 'Ventas Contado' },
  { id: 'credito', label: 'Ventas Crédito' },
  { id: 'compra_mercancia', label: 'Compra de Mercancía' },
  { id: 'pagos_proveedores', label: 'Pagos a Proveedores' },
  { id: 'servicios_publicos', label: 'Servicios Públicos' },
  { id: 'alquiler', label: 'Alquiler' },
  { id: 'telefonia', label: 'Telefonía' },
  { id: 'impuestos_municipales', label: 'Impuestos Municipales' },
  { id: 'declaracion_renta', label: 'Declaración de Renta' },
  { id: 'servicios_profesionales', label: 'Servicios Profesionales' },
  { id: 'reparacion_local', label: 'Reparación de Local' },
  { id: 'sueldos', label: 'Sueldos y Salarios' },
  { id: 'otros', label: 'Otros Gastos' },
  { id: 'devolucion', label: 'Devolución' },
  { id: 'cobro_deuda', label: 'Cobro de Deuda' },
  { id: 'cuenta_por_cobrar', label: 'Venta a Crédito' }
];

export default function AccountingModule() {
  const { entries, addEntry } = useAccounting();
  const state = usePOSState();
  const globalExchangeRate = state.exchangeRate || 1;
  
  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  
  // ✅ Estados para Firestore y RTDB
  const [firestoreEntries, setFirestoreEntries] = useState<any[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ✅ Cargar desde Firestore y RTDB (RECONCILIACIÓN TOTAL)
  const loadFromSources = useCallback(async () => {
    setIsLoadingFirestore(true);
    setSyncError(null);
    
    try {
      console.log('🔍 Iniciando reconciliación de Libro Diario...');
      
      // 1. Obtener asientos registrados en Firestore (Contabilidad Manual)
      const q = query(collection(db, 'accounting_entries'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      const firestoreEntriesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: parseFirestoreDate(data.date),
          createdAt: parseFirestoreDate(data.createdAt || data.date),
          updatedAt: parseFirestoreDate(data.updatedAt || data.date),
          amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
          totalUsd: data.totalUsd || (data.amount / (data.exchangeRate || globalExchangeRate)),
          _origin: 'firestore'
        };
      });

      // 2. Obtener TODAS las transacciones de la RTDB (Fuente de Verdad de Ventas)
      const rtdbTransactions = await syncService.getAllTransactions();
      
      // 3. Normalizar transacciones de RTDB que NO tengan asiento en Firestore (Reconciliación)
      const missingTransactions = rtdbTransactions
        .filter(tx => {
          // ✅ REGLA: Excluir 'credito' (Venta a Crédito) del Libro Diario. Solo impactan Contado y Cobros de Deuda.
          const isValidType = ['contado', 'cobro_deuda', 'devolucion', 'colaboracion', 'consumo_propio'].includes(tx.type);
          if (!isValidType) return false;

          // Evitar duplicados: verificar si ya existe un asiento con este referenceId
          const alreadyInFirestore = firestoreEntriesData.some(e => String(e.referenceId) === String(tx.id));
          return !alreadyInFirestore;
        })
        .map(tx => {
          const isExpense = tx.type === 'devolucion' || tx.type === 'colaboracion' || tx.type === 'consumo_propio';
          const rate = tx.exchangeRate || globalExchangeRate;
          const totalBs = tx.total || 0;
          const totalUsd = tx.totalUsd || (totalBs / rate);

          return {
            id: `tx_${tx.id}`,
            referenceId: tx.id,
            date: new Date(tx.date),
            type: isExpense ? 'egreso' : 'ingreso',
            category: tx.type,
            concept: tx.type === 'devolucion' ? 'DEVOLUCIÓN DE VENTA' : 
                     tx.type === 'cobro_deuda' ? 'COBRO DE DEUDA' : 'VENTA',
            description: `Cliente: ${tx.clientName || 'Cliente Final'} - Terminal: ${tx.terminalId || 'Principal'}`,
            amount: totalBs,
            totalUsd: totalUsd,
            exchangeRate: rate,
            _origin: 'rtdb_normalized'
          };
        });

      // 4. Combinar ambas fuentes
      const combined = [...firestoreEntriesData, ...missingTransactions];
      
      // 5. Aplicar filtros en memoria (para asegurar consistencia total)
      const finalEntries = combined.filter(entry => {
        // ✅ REGLA ADICIONAL: Excluir cualquier asiento guardado explícitamente como venta a crédito (cuenta por cobrar)
        if (entry.category === 'credito' || entry.category === 'cuenta_por_cobrar') return false;

        // Filtro de fecha
        if (startDate && endDate) {
          const start = getStartOfDayVenezuela(startDate);
          const end = getEndOfDayVenezuela(endDate);
          if (entry.date < start || entry.date > end) return false;
        }

        // Filtro de tipo (Ingreso/Egreso)
        if (filterType !== 'todos' && entry.type !== filterType) return false;

        // Filtro de categoría
        if (filterCategory !== 'todas' && entry.category !== filterCategory) return false;

        return true;
      });

      // Ordenar por fecha descendente (más recientes primero)
      finalEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      console.log(`✅ Libro Diario Normalizado: ${finalEntries.length} registros cargados.`);
      setFirestoreEntries(finalEntries);
      setLastSync(new Date());
      
    } catch (error) {
      console.error('❌ Error en reconciliación contable:', error);
      setSyncError('Error al sincronizar el Libro Diario.');
      setFirestoreEntries(entries || []);
    } finally {
      setIsLoadingFirestore(false);
    }
  }, [startDate, endDate, filterType, filterCategory, entries, globalExchangeRate]);

  // ✅ Cargar al montar y cuando cambian los filtros
  useEffect(() => {
    loadFromSources();
  }, [loadFromSources]);

  // ✅ Totales calculados sobre la fuente normalizada
  const totalIngresosBs = firestoreEntries.filter(e => e.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
  const totalEgresosBs = firestoreEntries.filter(e => e.type === 'egreso').reduce((sum, e) => sum + e.amount, 0);
  const balanceBs = totalIngresosBs - totalEgresosBs;
  
  const totalIngresosUsd = firestoreEntries
    .filter(e => e.type === 'ingreso')
    .reduce((sum, e) => sum + (e.totalUsd || (e.amount / (e.exchangeRate || globalExchangeRate))), 0);
  
  const totalEgresosUsd = firestoreEntries
    .filter(e => e.type === 'egreso')
    .reduce((sum, e) => sum + (e.totalUsd || (e.amount / (e.exchangeRate || globalExchangeRate))), 0);
    
  const balanceUsd = totalIngresosUsd - totalEgresosUsd;

  // ✅ Guardar Egreso Manual
  const handleExpenseConfirm = async (data: any) => {
    if (!addEntry) return;
    const now = getVenezuelaDate();
    const entryId = getTimestamp();
    const rateToSave = data.exchangeRate || globalExchangeRate;
    
    const entryData = {
      id: entryId,
      date: data.date || now,
      type: 'egreso',
      category: data.category,
      subcategory: data.subcategory,
      concept: data.concept || data.category,
      description: data.description || '',
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
      totalUsd: data.amount / rateToSave,
      exchangeRate: rateToSave,
      referenceType: 'expense',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const firestoreData = {
        ...entryData,
        date: new Date(entryData.date),
        serverTimestamp: Timestamp.now(),
      };
      await addDoc(collection(db, 'accounting_entries'), firestoreData);
      console.log('✅ Egreso guardado en Firestore');
    } catch (error) {
      console.error('❌ Error guardando egreso:', error);
    }

    await addEntry(entryData);
    await loadFromSources();
    setShowExpenseModal(false);
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-headline font-black text-black uppercase">Libro Diario - Contabilidad</h2>
            <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-300 uppercase tracking-widest">
              RTDB Synchronized ✓
            </span>
            {isLoadingFirestore && (
              <span className="text-[8px] font-black bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-300 uppercase tracking-widest animate-pulse">
                Sincronizando...
              </span>
            )}
          </div>
          <p className="text-sm text-black font-black mt-1 uppercase tracking-widest">
            Registro Unificado de Ingresos y Egresos (RTDB + Firestore)
            {lastSync && (
              <span className="text-[10px] font-black text-gray-500 ml-2">
                Última actualización: {lastSync.toLocaleTimeString('es-VE')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadFromSources} 
            variant="outline" 
            className="border-[#9E9E9E] text-black font-black h-10 px-4 text-xs"
            disabled={isLoadingFirestore}
          >
            <RefreshCw size={14} className={cn("mr-2", isLoadingFirestore && "animate-spin")} />
            REFRESCAR DATOS
          </Button>
          <Button 
            onClick={() => setShowExpenseModal(true)} 
            className="bg-red-600 hover:bg-red-700 text-white font-black border-2 border-black shadow-lg h-10 px-6 text-sm"
          >
            <Plus size={18} className="mr-2" /> REGISTRAR EGRESO
          </Button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-green-600" />
            <p className="text-[10px] font-black text-black uppercase tracking-widest">Total Ingresos</p>
          </div>
          <p className="text-2xl font-black text-green-700">{formatUsd(totalIngresosUsd)}</p>
          <p className="text-xs text-black font-black font-mono mt-0.5">{formatBs(totalIngresosBs)}</p>
        </div>
        
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-red-600" />
            <p className="text-[10px] font-black text-black uppercase tracking-widest">Total Egresos</p>
          </div>
          <p className="text-2xl font-black text-red-700">{formatUsd(totalEgresosUsd)}</p>
          <p className="text-xs text-black font-black font-mono mt-0.5">{formatBs(totalEgresosBs)}</p>
        </div>
        
        <div className={cn("bg-white rounded-xl border-2 p-4 shadow-md", balanceUsd >= 0 ? "border-green-500" : "border-red-500")}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className={balanceUsd >= 0 ? "text-green-600" : "text-red-600"} />
            <p className="text-[10px] font-black text-black uppercase tracking-widest">Balance de Caja</p>
          </div>
          <p className={cn("text-3xl font-black", balanceUsd >= 0 ? "text-green-700" : "text-red-700")}>
            {formatUsd(balanceUsd)}
          </p>
          <p className={cn("text-xs font-black font-mono mt-1", balanceUsd >= 0 ? "text-green-600" : "text-red-600")}>
            {formatBs(balanceBs)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Tipo de Movimiento</label>
            <select 
              value={filterType} 
              onChange={(e) => { 
                setFilterType(e.target.value as any); 
                setFilterCategory('todas'); 
              }} 
              className="w-full h-9 bg-white border border-[#9E9E9E] rounded-lg px-3 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="todos">Todos los Tipos</option>
              <option value="ingreso">Solo Ingresos</option>
              <option value="egreso">Solo Egresos</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Categoría</label>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)} 
              className="w-full h-9 bg-white border border-[#9E9E9E] rounded-lg px-3 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="todas">Todas las Categorías</option>
              {categoriesList.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">
              Desde Fecha (Venezuela)
            </label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="h-9 border-[#9E9E9E] text-xs font-black" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">
              Hasta Fecha (Venezuela)
            </label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="h-9 border-[#9E9E9E] text-xs font-black" 
            />
          </div>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md flex-1">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">
            <TableRow className="border-b border-[#9E9E9E]">
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3">Fecha (Caracas)</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3">Tipo</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3">Concepto / Descripción</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3 text-right">Monto USD</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3 text-right">Monto Bs</TableHead>
              <TableHead className="text-[10px] font-black text-black uppercase tracking-widest p-3 text-center">Fuente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingFirestore ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                    <span className="text-black font-black text-sm uppercase">Reconciliando RTDB con Libro Diario...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : firestoreEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-black font-black italic text-sm">
                  No hay registros contables en este período.
                </TableCell>
              </TableRow>
            ) : (
              firestoreEntries.map((entry, idx) => (
                <TableRow 
                  key={entry.id} 
                  className="border-b border-[#9E9E9E]/40 hover:bg-primary/5 cursor-pointer transition-colors" 
                  onClick={() => { setSelectedEntry(entry); setShowEntryDetail(true); }}
                >
                  <TableCell className="text-xs font-black text-black p-3 font-mono">
                    {formatDateFriendly(entry.date)}
                  </TableCell>
                  <TableCell className="p-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", entry.type === 'ingreso' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                      {entry.type.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="p-3">
                    <p className="text-xs font-black text-black uppercase">{entry.concept}</p>
                    <p className="text-[10px] font-black text-black truncate max-w-xs">{entry.description}</p>
                  </TableCell>
                  <TableCell className={cn("text-right font-black text-sm p-3", entry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>
                    {entry.type === 'ingreso' ? '+' : '-'} {formatUsd(entry.totalUsd)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-black text-black font-mono p-3">
                    {formatBs(entry.amount)}
                  </TableCell>
                  <TableCell className="text-center p-3">
                    <span className={cn(
                      "text-[7px] font-black px-1.5 py-0.5 rounded border",
                      entry._origin === 'firestore' ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                    )}>
                      {entry._origin === 'firestore' ? 'MANUAL' : 'RTDB'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modales */}
      <ExpenseModal 
        open={showExpenseModal} 
        onClose={() => setShowExpenseModal(false)} 
        onConfirm={handleExpenseConfirm} 
        exchangeRate={globalExchangeRate}
      />

      <Dialog open={showEntryDetail} onOpenChange={setShowEntryDetail}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-lg p-0 rounded-2xl shadow-xl overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Detalle</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="flex flex-col">
              <div className="bg-[#1A2C4E] p-4 text-white flex justify-between items-center">
                <h3 className="text-lg font-black uppercase">Detalle del Registro</h3>
                <button onClick={() => setShowEntryDetail(false)}><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between border-b pb-2"><span className="text-[10px] font-black text-black uppercase">Fecha (Caracas)</span><span className="text-sm font-black">{formatDateFriendly(selectedEntry.date)}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-[10px] font-black text-black uppercase">Tipo</span><span className={cn("text-sm font-black", selectedEntry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>{selectedEntry.type.toUpperCase()}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-[10px] font-black text-black uppercase">Concepto</span><span className="text-sm font-black uppercase">{selectedEntry.concept}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-[10px] font-black text-black uppercase">Monto Divisas</span><span className="text-xl font-black text-blue-700">{formatUsd(selectedEntry.totalUsd)}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-[10px] font-black text-black uppercase">Equivalente Bs</span><span className="text-lg font-black font-mono">{formatBs(selectedEntry.amount)}</span></div>
                <div><span className="text-[10px] font-black text-black uppercase block mb-1">Descripción</span><div className="bg-slate-50 p-3 rounded-lg border text-sm font-black uppercase">{selectedEntry.description}</div></div>
                <div className="pt-2 text-center text-[8px] font-black text-gray-400">ID REFERENCIA: {selectedEntry.referenceId || selectedEntry.id}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
