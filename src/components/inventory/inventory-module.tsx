"use client";

import { useState, useEffect } from 'react';
import { usePOSState } from '@/hooks/use-pos-state';
import { Plus, Search, Info, Pencil, Trash2, X, Barcode as BarcodeIcon, Tag, Boxes, TrendingUp, DollarSign, Percent, Filter, Download, Printer, Share2, FileText, FileSpreadsheet, File, AlertTriangle, FolderPlus, Package, History, RefreshCw, Save, Minus, Plus as PlusIcon, LayoutGrid } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product } from '@/lib/types';

interface InventoryModuleProps {
  state: ReturnType<typeof usePOSState>;
}

// Extender Product para incluir campos de costo, ganancia, stock mínimo y departamento
interface ProductWithDetails extends Product {
  costBs: number;
  costUsd: number;
  profitPercent: number;
  minStock: number;
  department: string;
}

interface StockAdjustment {
  id: number;
  productId: number;
  productName: string;
  previousStock: number;
  newStock: number;
  adjustment: number;
  reason: string;
  date: string;
  userId: string;
  userName: string;
}

interface KardexEntry {
  id: number;
  date: string;
  type: 'venta' | 'compra' | 'ajuste_inicial' | 'ajuste_manual';
  quantity: number;
  previousStock: number;
  newStock: number;
  reference: string;
  note: string;
}

// Departamentos predefinidos
const DEFAULT_DEPARTMENTS = ['Polar', 'Munchy'];

// Umbral mínimo global por defecto
const DEFAULT_MIN_STOCK = 5;

// Función para obtener fecha local de Venezuela
function getVenezuelaDate(): Date {
  const nowUTC = new Date();
  return new Date(nowUTC.getTime() - (4 * 60 * 60 * 1000));
}

function getVenezuelaISOString(): string {
  return getVenezuelaDate().toISOString();
}

export default function InventoryModule({ state }: InventoryModuleProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'outOfStock' | 'lowStock'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingKardex, setViewingKardex] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdjustingStock, setIsAdjustingStock] = useState<ProductWithDetails | null>(null);
  const [costBs, setCostBs] = useState('');
  const [costUsd, setCostUsd] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [minStock, setMinStock] = useState(DEFAULT_MIN_STOCK.toString());
  const [department, setDepartment] = useState(DEFAULT_DEPARTMENTS[0]);
  const [calculatedPriceUsd, setCalculatedPriceUsd] = useState(0);
  const [calculatedPriceBs, setCalculatedPriceBs] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [kardexEntries, setKardexEntries] = useState<Record<number, KardexEntry[]>>({});
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  
  const { toast } = useToast();

  // Cargar departamentos guardados
  useEffect(() => {
    const saved = localStorage.getItem('inventory_departments');
    if (saved) {
      setDepartments(JSON.parse(saved));
    }
  }, []);

  // Guardar departamentos
  useEffect(() => {
    localStorage.setItem('inventory_departments', JSON.stringify(departments));
  }, [departments]);

  // Cargar historial de Kardex
  useEffect(() => {
    const savedKardex = localStorage.getItem('kardex_entries');
    if (savedKardex) {
      setKardexEntries(JSON.parse(savedKardex));
    }
  }, []);

  // Guardar Kardex
  useEffect(() => {
    localStorage.setItem('kardex_entries', JSON.stringify(kardexEntries));
  }, [kardexEntries]);

  // Calcular precios de venta automáticamente
  useEffect(() => {
    const costUsdNum = parseFloat(costUsd) || 0;
    const profitNum = parseFloat(profitPercent) || 0;
    const calculatedUsd = costUsdNum + (costUsdNum * profitNum / 100);
    setCalculatedPriceUsd(calculatedUsd);
    setCalculatedPriceBs(calculatedUsd * state.exchangeRate);
  }, [costUsd, profitPercent, state.exchangeRate]);

  // Cuando se edita un producto, cargar sus valores
  useEffect(() => {
    if (editingProduct) {
      setCostBs(editingProduct.costBs?.toString() || '');
      setCostUsd(editingProduct.costUsd?.toString() || '');
      setProfitPercent(editingProduct.profitPercent?.toString() || '');
      setMinStock(editingProduct.minStock?.toString() || DEFAULT_MIN_STOCK.toString());
      setDepartment(editingProduct.department || departments[0]);
      setCalculatedPriceUsd(editingProduct.priceUsd || 0);
      setCalculatedPriceBs(editingProduct.priceBs || 0);
    }
  }, [editingProduct, departments]);

  // Limpiar formulario al agregar nuevo
  useEffect(() => {
    if (isAdding) {
      setCostBs('');
      setCostUsd('');
      setProfitPercent('');
      setMinStock(DEFAULT_MIN_STOCK.toString());
      setDepartment(departments[0]);
      setCalculatedPriceUsd(0);
      setCalculatedPriceBs(0);
    }
  }, [isAdding, departments]);

  // Obtener el stock mínimo de un producto
  const getProductMinStock = (product: any) => {
    return product.minStock || DEFAULT_MIN_STOCK;
  };

  // Verificar si un producto tiene stock bajo
  const isLowStock = (product: any) => {
    const min = getProductMinStock(product);
    return product.stock > 0 && product.stock <= min;
  };

  // Agregar entrada al Kardex
  const addKardexEntry = (productId: number, entry: KardexEntry) => {
    setKardexEntries(prev => ({
      ...prev,
      [productId]: [entry, ...(prev[productId] || [])]
    }));
  };

  // Registrar ajuste de stock
  const registerStockAdjustment = (product: ProductWithDetails, newStock: number, reason: string) => {
    // Agregar al Kardex
    const kardexEntry: KardexEntry = {
      id: Date.now(),
      date: getVenezuelaISOString(),
      type: reason === 'inicial' ? 'ajuste_inicial' : 'ajuste_manual',
      quantity: newStock - product.stock,
      previousStock: product.stock,
      newStock: newStock,
      reference: `Ajuste: ${reason}`,
      note: reason
    };
    addKardexEntry(product.id, kardexEntry);
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Desea eliminar este producto permanentemente?')) {
      state.deleteProduct(id);
      toast({ title: "Eliminado", description: "Producto eliminado correctamente." });
    }
  };

  const handleStockAdjust = (product: ProductWithDetails) => {
    setIsAdjustingStock(product);
    setAdjustmentQuantity('');
    setAdjustmentReason('');
  };

  const confirmStockAdjustment = () => {
    if (!isAdjustingStock) return;
    
    const newQuantity = parseInt(adjustmentQuantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      toast({ title: "Error", description: "Ingrese una cantidad válida", variant: "destructive" });
      return;
    }
    
    if (!adjustmentReason.trim()) {
      toast({ title: "Error", description: "Ingrese un motivo para el ajuste", variant: "destructive" });
      return;
    }
    
    const previousStock = isAdjustingStock.stock;
    const updatedProduct = { ...isAdjustingStock, stock: newQuantity };
    state.updateProduct(updatedProduct);
    
    registerStockAdjustment(isAdjustingStock, newQuantity, adjustmentReason);
    
    toast({ title: "Ajuste Realizado", description: `Stock actualizado de ${previousStock} a ${newQuantity} unidades` });
    setIsAdjustingStock(null);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const costBsNum = parseFloat(formData.get('costBs') as string) || 0;
    const costUsdNum = parseFloat(formData.get('costUsd') as string) || 0;
    const profitPercentNum = parseFloat(formData.get('profitPercent') as string) || 0;
    const minStockNum = parseInt(formData.get('minStock') as string) || DEFAULT_MIN_STOCK;
    const selectedDepartment = formData.get('department') as string;
    
    const salePriceUsd = costUsdNum + (costUsdNum * profitPercentNum / 100);
    const salePriceBs = salePriceUsd * state.exchangeRate;
    const stock = parseInt(formData.get('stock') as string) || 0;
    
    const data = {
      barcode: formData.get('barcode') as string,
      name: formData.get('name') as string,
      category: formData.get('category') as any,
      department: selectedDepartment,
      costBs: costBsNum,
      costUsd: costUsdNum,
      profitPercent: profitPercentNum,
      minStock: minStockNum,
      priceUsd: salePriceUsd,
      priceBs: salePriceBs,
      stock: stock,
    };

    if (isAdding) {
      const newProduct = { id: Date.now(), ...data };
      state.addProduct(newProduct);
      
      // Registrar ajuste inicial en Kardex
      registerStockAdjustment(newProduct as ProductWithDetails, stock, 'inicial');
      
      toast({ title: "Éxito", description: "Producto agregado correctamente." });
      setIsAdding(false);
    } else if (editingProduct) {
      // Verificar si hubo cambio de stock
      if (stock !== editingProduct.stock) {
        registerStockAdjustment(editingProduct, stock, 'edición de producto');
      }
      
      state.updateProduct({ ...editingProduct, ...data });
      toast({ title: "Éxito", description: "Producto actualizado correctamente." });
      setEditingProduct(null);
    }
  };

  const addDepartment = () => {
    if (newDepartment.trim() && !departments.includes(newDepartment.trim())) {
      setDepartments([...departments, newDepartment.trim()]);
      setNewDepartment('');
      setShowDepartmentModal(false);
      toast({ title: "Departamento creado", description: `"${newDepartment.trim()}" agregado correctamente.` });
    } else if (departments.includes(newDepartment.trim())) {
      toast({ title: "Error", description: "Este departamento ya existe", variant: "destructive" });
    }
  };

  const getStockColor = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "bg-red-100 text-red-700 border-red-300";
    } else if (product.stock <= minStock) {
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    } else {
      return "bg-green-100 text-green-700 border-green-300";
    }
  };

  const getStockText = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "AGOTADO";
    } else if (product.stock <= minStock) {
      return `STOCK MÍNIMO (${product.stock}/${minStock})`;
    } else {
      return `${product.stock} UDS`;
    }
  };

  // Calcular valores de inventario
  const getProductUnitValue = (product: any): number => {
    return (product as any).costUsd || product.priceUsd * 0.7; // Si no tiene costo, estimar 70% del precio
  };

  const getProductInventoryValue = (product: any): number => {
    return getProductUnitValue(product) * product.stock;
  };

  // Filtrar productos
  const filtered = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.barcode.includes(search);
    
    let matchesStock = true;
    if (filterType === 'outOfStock') {
      matchesStock = p.stock === 0;
    } else if (filterType === 'lowStock') {
      matchesStock = isLowStock(p);
    }
    
    const matchesDepartment = filterDepartment === 'all' || (p as any).department === filterDepartment;
    
    return matchesSearch && matchesStock && matchesDepartment;
  });

  // Totales del inventario
  const totalInventoryValue = filtered.reduce((sum, p) => sum + getProductInventoryValue(p), 0);
  const totalUnits = filtered.reduce((sum, p) => sum + p.stock, 0);

  // Contar productos por estado
  const outOfStockCount = state.products.filter(p => p.stock === 0).length;
  const lowStockCount = state.products.filter(p => isLowStock(p)).length;

  // Obtener nombre del departamento para el reporte
  const getReportDepartmentName = () => {
    if (filterDepartment === 'all') return 'General';
    return filterDepartment;
  };

  // Generar HTML para reporte profesional (horizontal)
  const generateReportHTML = () => {
    const departmentName = getReportDepartmentName();
    const now = new Date();
    const fechaHora = now.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Inventario - MasterPOS</title>
        <style>
          @page {
            size: landscape;
            margin: 1.5cm;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 9pt;
            line-height: 1.3;
            color: #1a1a2e;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #D4A017;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #1E3A8A;
            font-size: 18pt;
            margin: 0;
            letter-spacing: 2px;
          }
          .header h2 {
            color: #D4A017;
            font-size: 14pt;
            margin: 5px 0 0 0;
          }
          .header p {
            color: #666;
            font-size: 9pt;
            margin: 5px 0;
          }
          .department-badge {
            background: #1E3A8A;
            color: white;
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 9pt;
            font-weight: bold;
            margin: 10px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            flex-wrap: wrap;
          }
          .info-card {
            background: #f5f5f5;
            padding: 8px 15px;
            border-radius: 8px;
            min-width: 150px;
          }
          .info-card .label {
            font-size: 7pt;
            color: #666;
            text-transform: uppercase;
            font-weight: bold;
          }
          .info-card .value {
            font-size: 14pt;
            font-weight: bold;
            color: #1E3A8A;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 8pt;
          }
          th {
            background: #1E3A8A;
            color: white;
            padding: 10px 6px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #2c4a7a;
          }
          td {
            padding: 8px 6px;
            border: 1px solid #ddd;
            text-align: center;
            vertical-align: middle;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .text-left {
            text-align: left;
          }
          .text-right {
            text-align: right;
          }
          .text-bold {
            font-weight: bold;
          }
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 7pt;
            color: #999;
          }
          .total-row {
            background-color: #1E3A8A !important;
            color: white;
            font-weight: bold;
          }
          .total-row td {
            background-color: #1E3A8A;
            color: white;
            font-weight: bold;
          }
          .stock-zero {
            color: #e74c3c;
            font-weight: bold;
          }
          .stock-low {
            color: #f39c12;
            font-weight: bold;
          }
          .stock-ok {
            color: #27ae60;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MASTERPOS</h1>
          <h2>REPORTE DE INVENTARIO</h2>
          <p>Generado: ${fechaHora}</p>
          <div class="department-badge">DEPARTAMENTO: ${departmentName.toUpperCase()}</div>
        </div>
        
        <div class="info-row">
          <div class="info-card">
            <div class="label">Total Productos</div>
            <div class="value">${filtered.length}</div>
          </div>
          <div class="info-card">
            <div class="label">Unidades Totales</div>
            <div class="value">${totalUnits.toLocaleString()}</div>
          </div>
          <div class="info-card">
            <div class="label">Valor Inventario (USD)</div>
            <div class="value">$${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>PRODUCTO</th>
              <th>CATEGORÍA</th>
              <th>PRECIO USD</th>
              <th>VALOR UNITARIO USD</th>
              <th>STOCK</th>
              <th>ESTADO</th>
              <th>VALOR INVENTARIO USD</th>
             </tr>
          </thead>
          <tbody>
            ${filtered.map(p => {
              const unitValue = getProductUnitValue(p);
              const inventoryValue = getProductInventoryValue(p);
              let stockClass = '';
              let stockText = '';
              if (p.stock === 0) {
                stockClass = 'stock-zero';
                stockText = 'AGOTADO';
              } else if (isLowStock(p)) {
                stockClass = 'stock-low';
                stockText = `${p.stock} / ${getProductMinStock(p)}`;
              } else {
                stockClass = 'stock-ok';
                stockText = `${p.stock}`;
              }
              return `
                <tr>
                  <td>${p.barcode}</td>
                  <td class="text-left">${p.name}</td>
                  <td>${p.category}</td>
                  <td class="text-right">$${p.priceUsd.toFixed(2)}</td>
                  <td class="text-right">$${unitValue.toFixed(2)}</td>
                  <td class="text-right ${stockClass}">${stockText}</td>
                  <td class="text-center">${p.stock === 0 ? 'AGOTADO' : (isLowStock(p) ? 'STOCK MÍNIMO' : 'NORMAL')}</td>
                  <td class="text-right text-bold">$${inventoryValue.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="7" class="text-right text-bold">TOTALES:</td>
              <td class="text-right text-bold">$${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
             </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>Reporte generado por MasterPOS - Sistema de Punto de Venta | www.masterpos.com</p>
          <p>Este documento es válido como comprobante de inventario</p>
        </div>
      </body>
      </html>
    `;
  };

  // Exportar a PDF
  const exportToPDF = () => {
    const htmlContent = generateReportHTML();
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(htmlContent);
    printWindow?.document.close();
    setTimeout(() => {
      printWindow?.print();
    }, 500);
  };

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = ['Código', 'Producto', 'Departamento', 'Categoría', 'Precio USD', 'Valor Unitario USD', 'Stock', 'Estado', 'Valor Inventario USD'];
    const rows = filtered.map(p => [
      p.barcode,
      p.name,
      (p as any).department || 'Sin departamento',
      p.category,
      p.priceUsd.toFixed(2),
      getProductUnitValue(p).toFixed(2),
      p.stock,
      p.stock === 0 ? 'AGOTADO' : (isLowStock(p) ? 'STOCK MÍNIMO' : 'NORMAL'),
      getProductInventoryValue(p).toFixed(2)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${getReportDepartmentName()}_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Exportado", description: "Archivo CSV generado correctamente." });
  };

  // Exportar a Excel (HTML)
  const exportToExcel = () => {
    const departmentName = getReportDepartmentName();
    const now = new Date();
    
    let htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte Inventario - MasterPOS</title>
          <style>
            th { background: #1E3A8A; color: white; padding: 8px; }
            td { padding: 6px; border: 1px solid #ddd; }
            table { border-collapse: collapse; width: 100%; }
            .total-row { background: #1E3A8A; color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>MASTERPOS - REPORTE DE INVENTARIO</h2>
          <p>Departamento: ${departmentName}</p>
          <p>Fecha: ${now.toLocaleString('es-VE')}</p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Departamento</th>
                <th>Categoría</th>
                <th>Precio USD</th>
                <th>Valor Unitario USD</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Valor Inventario USD</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    filtered.forEach(p => {
      htmlContent += `
        <tr>
          <td>${p.barcode}</td>
          <td>${p.name}</td>
          <td>${(p as any).department || 'Sin departamento'}</td>
          <td>${p.category}</td>
          <td>$${p.priceUsd.toFixed(2)}</td>
          <td>$${getProductUnitValue(p).toFixed(2)}</td>
          <td>${p.stock}</td>
          <td>${p.stock === 0 ? 'AGOTADO' : (isLowStock(p) ? 'STOCK MÍNIMO' : 'NORMAL')}</td>
          <td>$${getProductInventoryValue(p).toFixed(2)}</td>
        </tr>
      `;
    });
    
    htmlContent += `
              <tr class="total-row">
                <td colspan="8"><strong>TOTAL VALOR INVENTARIO:</strong></td>
                <td><strong>$${totalInventoryValue.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
          <p>Total Productos: ${filtered.length} | Unidades Totales: ${totalUnits}</p>
          <p>Generado por MasterPOS</p>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${departmentName}_${new Date().toISOString().slice(0,19)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Exportado", description: "Archivo Excel generado correctamente." });
  };

  const handlePrint = () => {
    exportToPDF();
  };

  const handleShare = async () => {
    const departmentName = getReportDepartmentName();
    const text = `📊 *REPORTE DE INVENTARIO - MASTERPOS*\n\n📁 Departamento: ${departmentName}\n📦 Total Productos: ${filtered.length}\n📦 Unidades Totales: ${totalUnits}\n💰 Valor Total Inventario: $${totalInventoryValue.toFixed(2)}\n📅 ${new Date().toLocaleString('es-VE')}\n\nGenerado por MasterPOS`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Reporte Inventario MasterPOS', text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Resumen copiado al portapapeles." });
    }
  };

  // Obtener movimientos de Kardex para un producto
  const getKardexForProduct = (productId: number): KardexEntry[] => {
    return kardexEntries[productId] || [];
  };

  // Componente de Tarjeta Kardex
  const KardexModal = ({ product, onClose }: { product: Product, onClose: () => void }) => {
    const kardex = getKardexForProduct(product.id);
    
    return (
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="bg-white border-border text-foreground max-w-3xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[85vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Kardex - {product.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col h-full">
            <div className="bg-[#1E3A8A] p-5 text-white sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black">Tarjeta Kardex</h3>
                  <p className="text-sm font-bold opacity-90">{product.name}</p>
                  <p className="text-xs opacity-70">Código: {product.barcode}</p>
                </div>
                <button onClick={onClose} className="text-white/60 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              <div className="bg-slate-50 p-4 rounded-xl mb-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-500">Stock Actual</p>
                  <p className={cn("text-2xl font-black", product.stock === 0 ? "text-red-600" : isLowStock(product) ? "text-yellow-600" : "text-green-600")}>
                    {product.stock} UDS
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-500">Valor Inventario</p>
                  <p className="text-2xl font-black text-blue-600">${getProductInventoryValue(product).toFixed(2)}</p>
                </div>
              </div>
              
              <h4 className="text-xs font-black uppercase mb-3 text-[#1E3A8A] flex items-center gap-2">
                <History size={12} /> HISTORIAL DE MOVIMIENTOS
              </h4>
              
              {kardex.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Package size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No hay movimientos registrados para este producto</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="p-2">FECHA</th>
                        <th className="p-2">TIPO</th>
                        <th className="p-2 text-right">CANTIDAD</th>
                        <th className="p-2 text-right">STOCK PREVIO</th>
                        <th className="p-2 text-right">STOCK NUEVO</th>
                        <th className="p-2">REFERENCIA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kardex.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono">{new Date(entry.date).toLocaleString('es-VE')}</td>
                          <td className="p-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold",
                              entry.type === 'venta' ? "bg-red-100 text-red-700" :
                              entry.type === 'compra' ? "bg-green-100 text-green-700" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {entry.type === 'venta' ? 'VENTA' : entry.type === 'compra' ? 'COMPRA' : 'AJUSTE'}
                            </span>
                          </td>
                          <td className={cn("p-2 text-right font-mono font-bold", entry.quantity < 0 ? "text-red-600" : "text-green-600")}>
                            {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                          </td>
                          <td className="p-2 text-right font-mono">{entry.previousStock}</td>
                          <td className="p-2 text-right font-mono font-bold">{entry.newStock}</td>
                          <td className="p-2 text-slate-500 max-w-[150px] truncate">{entry.reference || entry.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-3 border-t flex justify-end">
              <Button onClick={onClose} variant="ghost" size="sm" className="text-xs">CERRAR KARDEX</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="p-6 overflow-y-auto h-full scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-headline font-black text-foreground">Inventario Premium</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar producto..." 
              className="pl-9 h-10 bg-white border-border text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={() => setIsAdding(true)}
            className="bg-primary hover:brightness-105 text-black font-black shadow-md"
          >
            <Plus size={18} className="mr-2" /> AGREGAR
          </Button>

          <Button 
            onClick={() => setShowExportModal(true)}
            className="bg-[#E8E8E8] hover:bg-[#D4A017] text-black border border-black/20 font-black"
          >
            <Download size={16} className="mr-2" /> EXPORTAR
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Button
          onClick={() => setFilterType('all')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filterType === 'all' 
              ? "bg-[#1A2C4E] text-white" 
              : "bg-[#E8E8E8] text-black hover:bg-[#D4A017]"
          )}
        >
          <Filter size={12} className="mr-1" /> TODOS ({state.products.length})
        </Button>
        <Button
          onClick={() => setFilterType('outOfStock')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filterType === 'outOfStock' 
              ? "bg-red-600 text-white" 
              : "bg-red-100 text-red-700 hover:bg-red-200"
          )}
        >
          AGOTADOS ({outOfStockCount})
        </Button>
        <Button
          onClick={() => setFilterType('lowStock')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filterType === 'lowStock' 
              ? "bg-yellow-600 text-white" 
              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          )}
        >
          STOCK MÍNIMO ({lowStockCount})
        </Button>
        
        <div className="h-6 w-px bg-slate-300 mx-1" />
        
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300 bg-white"
        >
          <option value="all">📁 TODOS LOS DEPARTAMENTOS</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        
        <Button
          onClick={() => setShowDepartmentModal(true)}
          variant="outline"
          size="sm"
          className="text-[10px] font-bold border-dashed"
        >
          <FolderPlus size={12} className="mr-1" /> NUEVO DEPARTAMENTO
        </Button>
      </div>

      {/* Modal de nuevo departamento */}
      {showDepartmentModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-[#9E9E9E]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-black">Nuevo Departamento</h3>
              <button onClick={() => setShowDepartmentModal(false)} className="text-black/50 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="Nombre del departamento"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={addDepartment} className="flex-1 bg-[#1A2C4E] text-white font-bold">CREAR</Button>
              <Button onClick={() => setShowDepartmentModal(false)} variant="ghost" className="flex-1">CANCELAR</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de exportación */}
      {showExportModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-[#9E9E9E]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-black">Exportar Inventario</h3>
              <button onClick={() => setShowExportModal(false)} className="text-black/50 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { exportToPDF(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <File size={16} /> EXPORTAR A PDF (Horizontal)
              </button>
              <button
                onClick={() => { exportToCSV(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={16} /> EXPORTAR A CSV
              </button>
              <button
                onClick={() => { exportToExcel(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <FileSpreadsheet size={16} /> EXPORTAR A EXCEL
              </button>
              <button
                onClick={() => { handlePrint(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Printer size={16} /> IMPRIMIR
              </button>
              <button
                onClick={() => { handleShare(); setShowExportModal(false); }}
                className="w-full py-2.5 bg-[#E8E8E8] hover:bg-[#D4A017] text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Share2 size={16} /> COMPARTIR RESUMEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de inventario */}
      <div className="bg-card/50 border border-border rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Código</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Producto</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Departamento</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Categoría</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Precio USD</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Valor Unitario</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Stock</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Valor Inventario</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const productWithDept = p as ProductWithDetails;
                const unitValue = getProductUnitValue(p);
                const inventoryValue = getProductInventoryValue(p);
                
                return (
                  <TableRow key={p.id} className="border-border hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{p.barcode}</TableCell>
                    <TableCell className="font-bold text-sm text-foreground">{p.name}</TableCell>
                    <TableCell>
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-bold">
                        {productWithDept.department || 'Sin dept.'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="bg-primary/20 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {p.category}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-sm text-secondary">${p.priceUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-slate-600">${unitValue.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm inline-block min-w-[100px] whitespace-nowrap text-center cursor-pointer",
                        getStockColor(p)
                      )}>
                        {getStockText(p)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600">${inventoryValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-secondary hover:bg-secondary/10"
                          onClick={() => setViewingProduct(p)}
                          title="Ver detalles"
                        >
                          <Info size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100"
                          onClick={() => setViewingKardex(p)}
                          title="Ver Kardex"
                        >
                          <History size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-100"
                          onClick={() => handleStockAdjust(productWithDept)}
                          title="Ajustar stock"
                        >
                          <RefreshCw size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-secondary hover:bg-secondary/10"
                          onClick={() => setEditingProduct(productWithDept)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground italic">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              )}
              {/* Fila de totales */}
              {filtered.length > 0 && (
                <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                  <TableCell colSpan={7} className="text-right font-black text-sm">TOTAL VALOR INVENTARIO:</TableCell>
                  <TableCell className="text-right font-black text-lg text-blue-700">${totalInventoryValue.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL EDITAR / AGREGAR */}
      <Dialog open={!!editingProduct || isAdding} onOpenChange={() => { setEditingProduct(null); setIsAdding(false); }}>
        <DialogContent className="bg-white border-border text-foreground max-w-4xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{isAdding ? 'Nuevo Producto' : 'Editar Producto'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="flex flex-col">
            <div className="bg-secondary p-4 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {isAdding ? <Plus size={20} /> : <Pencil size={20} />}
                  <h3 className="text-lg font-headline font-black">
                    {isAdding ? 'Nuevo Producto' : 'Editar Producto'}
                  </h3>
                </div>
                <button 
                  type="button"
                  onClick={() => { setEditingProduct(null); setIsAdding(false); }} 
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código de Barras</label>
                  <Input name="barcode" defaultValue={editingProduct?.barcode} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nombre del Producto</label>
                  <Input name="name" defaultValue={editingProduct?.name} required className="bg-background border-border" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <LayoutGrid size={10} /> Departamento
                  </label>
                  <select name="department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm focus:ring-2 focus:ring-secondary outline-none text-foreground">
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Categoría</label>
                  <select name="category" defaultValue={editingProduct?.category} className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm focus:ring-2 focus:ring-secondary outline-none text-foreground">
                    <option value="Whisky">Whisky</option>
                    <option value="Ron">Ron</option>
                    <option value="Cerveza">Cerveza</option>
                    <option value="Vino">Vino</option>
                    <option value="Vodka">Vodka</option>
                    <option value="Tequila">Tequila</option>
                    <option value="Licor">Licor</option>
                    <option value="Gin">Gin</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Stock Inicial</label>
                  <Input name="stock" type="number" defaultValue={editingProduct?.stock} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle size={10} /> Stock Mínimo
                  </label>
                  <Input 
                    name="minStock" 
                    type="number" 
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder={DEFAULT_MIN_STOCK.toString()}
                    required 
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg mb-4">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Tag size={10} /> DATOS DE COSTO
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Costo (Bs)</label>
                    <Input 
                      name="costBs" 
                      type="number" 
                      step="0.01"
                      value={costBs}
                      onChange={(e) => setCostBs(e.target.value)}
                      placeholder="0.00"
                      required 
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Costo (USD)</label>
                    <Input 
                      name="costUsd" 
                      type="number" 
                      step="0.01"
                      value={costUsd}
                      onChange={(e) => setCostUsd(e.target.value)}
                      placeholder="0.00"
                      required 
                      className="bg-background border-border"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <p className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Percent size={10} /> CONFIGURACIÓN DE GANANCIA
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">% de Ganancia</label>
                    <Input 
                      name="profitPercent" 
                      type="number" 
                      step="0.01"
                      value={profitPercent}
                      onChange={(e) => setProfitPercent(e.target.value)}
                      placeholder="30"
                      required 
                      className="bg-background border-primary/30"
                    />
                  </div>
                </div>

                <div className="bg-secondary/10 p-3 rounded-lg">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-2 flex items-center gap-1">
                    <DollarSign size={10} /> PRECIOS DE VENTA (Calculados)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] font-bold text-muted-foreground">Precio Venta USD</label>
                      <div className="text-base font-black text-secondary">
                        ${calculatedPriceUsd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-muted-foreground">Precio Venta Bs</label>
                      <div className="text-base font-black text-foreground">
                        Bs {calculatedPriceBs.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-2 text-center">
                    Tasa BCV: {state.exchangeRate.toFixed(2)} Bs/USD
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-4 border-t border-border flex justify-end gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => { setEditingProduct(null); setIsAdding(false); }} 
                className="px-6 text-foreground"
              >
                CANCELAR
              </Button>
              <Button 
                type="submit" 
                className="px-6 bg-secondary text-white font-black hover:bg-secondary/90"
              >
                GUARDAR CAMBIOS
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL AJUSTE DE STOCK */}
      <Dialog open={!!isAdjustingStock} onOpenChange={() => setIsAdjustingStock(null)}>
        <DialogContent className="bg-white border-border text-foreground max-w-md p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Ajustar Stock</DialogTitle>
          </DialogHeader>
          {isAdjustingStock && (
            <div className="flex flex-col">
              <div className="bg-amber-500 p-4 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={18} />
                    <h3 className="text-lg font-headline font-black">Ajustar Stock</h3>
                  </div>
                  <button onClick={() => setIsAdjustingStock(null)} className="text-white/60 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm font-bold mt-1">{isAdjustingStock.name}</p>
                <p className="text-xs opacity-80">Stock actual: {isAdjustingStock.stock} UDS</p>
              </div>
              
              <div className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">
                      Nueva Cantidad
                    </label>
                    <Input 
                      type="number" 
                      step="1"
                      value={adjustmentQuantity}
                      onChange={(e) => setAdjustmentQuantity(e.target.value)}
                      placeholder="Ingrese la nueva cantidad"
                      className="text-lg font-bold"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">
                      Motivo del Ajuste
                    </label>
                    <textarea
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Ej: Rotura, merma, inventario inicial, etc."
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-4 border-t flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsAdjustingStock(null)} className="px-6">
                  CANCELAR
                </Button>
                <Button onClick={confirmStockAdjustment} className="px-6 bg-amber-500 text-white font-black hover:bg-amber-600">
                  <Save size={14} className="mr-2" /> CONFIRMAR AJUSTE
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLES PRODUCTO */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="bg-white border-border text-foreground max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalles del Producto: {viewingProduct?.name}</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="flex flex-col h-full">
              <div className="bg-secondary p-6 text-white relative">
                <button onClick={() => setViewingProduct(null)} className="absolute top-4 right-4 hover:opacity-70"><X size={20} /></button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                    <BarcodeIcon size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-headline font-black leading-tight">{viewingProduct.name}</h3>
                    <p className="text-sm font-bold opacity-80 uppercase tracking-widest">{viewingProduct.category}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-3 gap-6">
                <div className="space-y-6 col-span-1 border-r border-border pr-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código Fiscal</span>
                    <p className="font-mono text-sm font-bold text-foreground">{viewingProduct.barcode}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Departamento</span>
                    <p className="text-sm font-bold text-purple-700">{(viewingProduct as any).department || 'Sin departamento'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Disponibilidad Actual</span>
                    <div className="flex items-center gap-2">
                      <Boxes size={18} className="text-secondary" />
                      <p className={cn(
                        "text-xl font-black",
                        viewingProduct.stock === 0 ? "text-red-600" :
                        isLowStock(viewingProduct) ? "text-yellow-600" :
                        "text-green-600"
                      )}>
                        {viewingProduct.stock === 0 ? "AGOTADO" : `${viewingProduct.stock} / ${getProductMinStock(viewingProduct)} Unidades`}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Precio USD</span>
                      <span className="text-lg font-black text-secondary">${viewingProduct.priceUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Valor Unitario</span>
                      <span className="text-lg font-black text-slate-600">${getProductUnitValue(viewingProduct).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Valor Inventario</span>
                      <span className="text-lg font-black text-blue-600">${getProductInventoryValue(viewingProduct).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-secondary">
                      <TrendingUp size={14} /> Historial de Movimientos
                    </h4>
                    <button
                      onClick={() => { setViewingKardex(viewingProduct); setViewingProduct(null); }}
                      className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold hover:bg-slate-200"
                    >
                      Ver Kardex completo →
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                    {getKardexForProduct(viewingProduct.id).slice(0, 10).map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl group hover:border-secondary/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[9px] font-bold text-muted-foreground text-center leading-tight">
                            {new Date(entry.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-foreground capitalize">{entry.type}</div>
                            <div className="text-[8px] text-muted-foreground">{entry.reference || entry.note}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-xs font-black", entry.quantity < 0 ? "text-red-600" : "text-green-600")}>
                            {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity} UDS
                          </div>
                          <div className="text-[9px] text-muted-foreground">Stock: {entry.newStock}</div>
                        </div>
                      </div>
                    ))}
                    {getKardexForProduct(viewingProduct.id).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-muted/30">
                        <History size={40} strokeWidth={1} />
                        <p className="text-xs font-bold mt-2">Sin movimientos registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 border-t border-border flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setViewingProduct(null)} 
                  className="font-bold text-xs uppercase tracking-widest text-foreground"
                >
                  Cerrar
                </Button>
                <Button 
                  onClick={() => { handleStockAdjust(viewingProduct as ProductWithDetails); setViewingProduct(null); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                >
                  <RefreshCw size={12} className="mr-1" /> Ajustar Stock
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL KARDEX COMPLETO */}
      {viewingKardex && (
        <KardexModal product={viewingKardex} onClose={() => setViewingKardex(null)} />
      )}
    </div>
  );
}