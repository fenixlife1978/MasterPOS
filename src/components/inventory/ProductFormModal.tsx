"use client";

import React, { useState, useEffect, useRef, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Product, Category, KitComponent } from '@/lib/types';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { Package, Percent, X, PlusCircle, Trash2 } from 'lucide-react';
import syncService from '@/services/syncService';

const roundTo2 = (num: number): number => Math.round(num * 100) / 100;
const roundTo4 = (num: number): number => Math.round(num * 10000) / 10000;

const calculatePriceUsdFromCostAndProfit = (cost: number, profitPercent: number): number => {
  if (cost <= 0 || profitPercent <= 0) return 0;
  if (profitPercent >= 99.99) return cost * 100;
  return roundTo2(cost / (1 - profitPercent / 100));
};

const calculateProfitFromCostAndPriceUsd = (cost: number, priceUsd: number): number => {
  if (cost <= 0 || priceUsd <= 0) return 0;
  if (priceUsd <= cost) return 0;
  const profitPercent = (1 - (cost / priceUsd)) * 100;
  if (profitPercent > 99.99) return 99.99;
  return roundTo2(profitPercent);
};

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  onSave: (product: Product) => Promise<void>;
  exchangeRate: number;
  products: Product[];
  categories: string[];
  departments: string[];
}

const ProductFormModal = memo(function ProductFormModal({
  open,
  onClose,
  editingProduct,
  onSave,
  exchangeRate,
  products,
  categories,
  departments
}: ProductFormModalProps) {
  const { toast } = useToast();
  
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Otros');
  const [category, setCategory] = useState('Otro');
  const [unitMeasure, setUnitMeasure] = useState('');
  const [stockInput, setStockInput] = useState('');
  const [minStockInput, setMinStockInput] = useState('');
  const [priceWholesaleInput, setPriceWholesaleInput] = useState('');
  const [priceCostInput, setPriceCostInput] = useState('');
  const [costUsdInput, setCostUsdInput] = useState('');
  const [profitPercentInput, setProfitPercentInput] = useState('');
  const [priceRetailBs, setPriceRetailBs] = useState('');
  const [localPriceUsd, setLocalPriceUsd] = useState('');
  const [ivaType, setIvaType] = useState<'con_iva' | 'sin_iva' | 'exento'>('con_iva');
  const [ivaPercentage, setIvaPercentage] = useState(16);
  const [isKit, setIsKit] = useState(false);
  const [kitHasOwnStock, setKitHasOwnStock] = useState(false);
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  const [searchChildProduct, setSearchChildProduct] = useState('');
  const [selectedChildProduct, setSelectedChildProduct] = useState<Product | null>(null);
  const [childQuantity, setChildQuantity] = useState('1');
  const [hideChildResults, setHideChildResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (open && editingProduct) {
      setBarcode(editingProduct.barcode || '');
      setName(editingProduct.name);
      setDepartment(editingProduct.department || 'Otros');
      setCategory(typeof editingProduct.category === 'string' ? editingProduct.category : editingProduct.category?.id || 'Otro');
      setUnitMeasure(editingProduct.unitMeasure || '');
      setStockInput(editingProduct.stock.toString());
      setMinStockInput((editingProduct.minStock || 5).toString());
      setPriceWholesaleInput(editingProduct.priceWholesale?.toString() || '');
      setPriceCostInput(editingProduct.priceCost?.toString() || '');
      setCostUsdInput(editingProduct.costUsd?.toString() || '');
      setProfitPercentInput((editingProduct.profitPercent || 0).toString());
      setLocalPriceUsd(editingProduct.priceUsd.toString());
      setPriceRetailBs(editingProduct.priceBs.toString());
      setIvaType(editingProduct.ivaType || 'con_iva');
      setIvaPercentage(editingProduct.ivaPercentage || 16);
      setIsKit(editingProduct.isKit || false);
      setKitHasOwnStock(editingProduct.kitHasOwnStock || false);
      setKitComponents(editingProduct.kitComponents || []);
    } else if (open && !editingProduct) {
      setBarcode('');
      setName('');
      setDepartment('Otros');
      setCategory('Otro');
      setUnitMeasure('');
      setStockInput('');
      setMinStockInput('5');
      setPriceWholesaleInput('');
      setPriceCostInput('');
      setCostUsdInput('');
      setProfitPercentInput('');
      setLocalPriceUsd('');
      setPriceRetailBs('');
      setIvaType('con_iva');
      setIvaPercentage(16);
      setIsKit(false);
      setKitHasOwnStock(false);
      setKitComponents([]);
      setSearchChildProduct('');
      setSelectedChildProduct(null);
      setChildQuantity('1');
      setHideChildResults(false);
    }
  }, [open, editingProduct]);

  const childProductResults = React.useMemo(() => {
    if (!searchChildProduct.trim() || hideChildResults) return [];
    const q = searchChildProduct.toLowerCase();
    return products.filter(p => 
      p.id !== editingProduct?.id && 
      (p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q))
    ).slice(0, 5);
  }, [searchChildProduct, products, editingProduct, hideChildResults]);

  const addKitComponent = () => {
    if (!selectedChildProduct) return;
    const qty = parseInt(childQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Error", description: "Cantidad no válida", variant: "destructive" });
      return;
    }
    if (kitComponents.some(c => c.productId === selectedChildProduct.id)) {
      toast({ title: "Error", description: "El producto ya está en la lista", variant: "destructive" });
      return;
    }
    const newComponent: KitComponent = {
      productId: selectedChildProduct.id,
      quantity: qty
    };
    setKitComponents(prev => [...prev, newComponent]);
    setSelectedChildProduct(null);
    setSearchChildProduct('');
    setChildQuantity('1');
    setHideChildResults(false);
  };

  const removeKitComponent = (productId: number) => {
    setKitComponents(prev => prev.filter(c => c.productId !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cost = parseFloat(costUsdInput) || 0;
    let profitPercent = profitPercentInput !== '' ? parseFloat(profitPercentInput) : 0;
    let priceUsd = localPriceUsd !== '' ? parseFloat(localPriceUsd) : 0;
    let priceBs = priceRetailBs !== '' ? parseFloat(priceRetailBs) : 0;
    
    if (priceBs > 0) {
      priceUsd = priceBs / exchangeRate;
      if (cost > 0 && priceUsd > 0) {
        profitPercent = calculateProfitFromCostAndPriceUsd(cost, priceUsd);
      }
    } 
    else if (priceUsd > 0) {
      if (cost > 0 && priceUsd > 0) {
        profitPercent = calculateProfitFromCostAndPriceUsd(cost, priceUsd);
      }
      priceBs = priceUsd * exchangeRate;
    }
    else if (profitPercent > 0 && cost > 0) {
      priceUsd = calculatePriceUsdFromCostAndProfit(cost, profitPercent);
      priceBs = priceUsd * exchangeRate;
    }
    
    if (profitPercent >= 99.99) {
      toast({ 
        title: "Porcentaje no válido", 
        description: "El porcentaje de ganancia no puede superar 99.99%", 
        variant: "destructive" 
      });
      return;
    }
    
    const existingProduct = products.find(p => p.barcode === barcode && p.id !== editingProduct?.id);
    if (existingProduct && barcode !== '') {
      toast({ 
        title: "Código de barras duplicado", 
        description: `Ya existe un producto con el código "${barcode}" (${existingProduct.name})`, 
        variant: "destructive" 
      });
      return;
    }
    
    const productId = editingProduct?.id || Date.now();
    
    const productData: Product = {
      id: productId,
      barcode,
      name,
      department: department || 'Otros',
      category: category as unknown as Category,
      unitMeasure,
      stock: parseInt(stockInput) || 0,
      minStock: parseInt(minStockInput) || 5,
      costUsd: roundTo4(cost),
      costBs: cost > 0 ? roundTo2(cost * exchangeRate) : 0,
      profitPercent: profitPercent,
      priceUsd: roundTo2(priceUsd),
      priceBs: roundTo2(priceBs),
      priceRetail: roundTo2(priceUsd),
      priceWholesale: roundTo2(parseFloat(priceWholesaleInput) || 0),
      priceCost: roundTo2(parseFloat(priceCostInput) || 0),
      ivaType: ivaType,
      ivaPercentage: ivaType === 'con_iva' ? ivaPercentage : 0,
      isKit: isKit,
      kitHasOwnStock: isKit ? kitHasOwnStock : false,
      kitComponents: isKit && kitComponents.length > 0 ? kitComponents : [],
      isPriceFixed: false
    };
    
    setIsSubmitting(true);
    try {
      await onSave(productData);
      onClose();
    } catch (error: any) {
      console.error('Error al guardar producto:', error);
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo guardar el producto", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="bg-white max-w-3xl p-0 rounded-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="bg-[#1A2C4E] p-3 text-white rounded-t-xl flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Package size={16} />
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <button type="button" onClick={onClose} className="text-white/60 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] font-black uppercase">Código de Barras</label>
                  <Input value={barcode} onChange={e => setBarcode(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase">Nombre del Producto</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-black uppercase">Departamento</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full h-7 border rounded px-2 text-xs bg-white">
                      {departments.map((d, i) => <option key={`${d}-${i}`} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Categoría</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-7 border rounded px-2 text-xs bg-white">
                      {categories.map((c, i) => <option key={`${c}-${i}`} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase">Unidad de Medida</label>
                  <Input value={unitMeasure} onChange={e => setUnitMeasure(e.target.value)} className="h-7 text-xs" placeholder="UNID, KG, LTS..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-black uppercase">Stock Inicial</label>
                    <Input type="text" inputMode="numeric" value={stockInput} onChange={e => setStockInput(e.target.value)} className="h-7 text-xs" placeholder="0" readOnly={!!editingProduct} />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Stock Mínimo</label>
                    <Input type="text" inputMode="numeric" value={minStockInput} onChange={e => setMinStockInput(e.target.value)} className="h-7 text-xs" placeholder="5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-black uppercase">Precio Mayor (USD)</label>
                    <Input type="text" inputMode="decimal" value={priceWholesaleInput} onChange={e => setPriceWholesaleInput(e.target.value)} className="h-7 text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase">Precio Costo (USD)</label>
                    <Input type="text" inputMode="decimal" value={priceCostInput} onChange={e => setPriceCostInput(e.target.value)} className="h-7 text-xs" placeholder="0.00" />
                  </div>
                </div>
                
                <div className="border-t pt-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isKit} onChange={e => setIsKit(e.target.checked)} className="rounded text-primary" />
                    <span className="text-[9px] font-black uppercase">Es kit / compuesto</span>
                  </label>
                  <p className="text-[7px] text-black/40 mt-1">Al vender este producto, se descontarán las cantidades de sus componentes.</p>
                </div>
                
                {isKit && (
                  <div className="border border-dashed border-blue-300 rounded-lg p-2 bg-blue-50/30 space-y-2">
                    <div className="flex items-center justify-between bg-white/50 rounded p-1.5">
                      <span className="text-[8px] font-bold uppercase">Stock del kit:</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setKitHasOwnStock(false)} className={cn("px-2 py-0.5 rounded text-[9px] font-bold transition-all", !kitHasOwnStock ? "bg-primary text-black" : "bg-gray-200 text-gray-600")}>Sin stock propio</button>
                        <button type="button" onClick={() => setKitHasOwnStock(true)} className={cn("px-2 py-0.5 rounded text-[9px] font-bold transition-all", kitHasOwnStock ? "bg-primary text-black" : "bg-gray-200 text-gray-600")}>Con stock propio</button>
                      </div>
                    </div>
                    <p className="text-[7px] text-blue-700 bg-blue-100 rounded px-2 py-1">{!kitHasOwnStock ? "📦 Sin stock propio: El kit siempre se puede vender si hay suficiente stock de sus componentes. Al vender, SOLO se descuentan los componentes." : "⚠️ Con stock propio: El kit tiene su propio inventario. Al vender, se descuenta 1 del kit + las cantidades de sus componentes."}</p>
                    <p className="text-[8px] font-bold text-blue-800 mb-1 flex items-center gap-1"><Package size={10} /> Componentes del kit</p>
                    <div className="space-y-2">
                      {kitComponents.length > 0 && (
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {kitComponents.map(comp => {
                            const childProd = products.find(p => p.id === comp.productId);
                            return (
                              <div key={comp.productId} className="flex justify-between items-center bg-white rounded px-2 py-1 text-[10px]">
                                <span>{childProd?.name || 'Producto'} x{comp.quantity}</span>
                                <button type="button" onClick={() => removeKitComponent(comp.productId)} className="text-red-500">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <div className="relative">
                          <Input 
                            type="text" 
                            placeholder="Buscar producto componente..." 
                            value={searchChildProduct} 
                            onChange={(e) => {
                              setSearchChildProduct(e.target.value);
                              setHideChildResults(false);
                              if (selectedChildProduct && e.target.value !== selectedChildProduct.name) {
                                setSelectedChildProduct(null);
                              }
                            }} 
                            className="h-7 text-xs pr-7" 
                          />
                          {!hideChildResults && childProductResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border rounded shadow z-20 mt-1 max-h-24 overflow-y-auto">
                              {childProductResults.map((p, i) => (
                                <button 
                                  key={`child-${p.id}-${i}`} 
                                  type="button" 
                                  onClick={() => {
                                    setSelectedChildProduct(p);
                                    setSearchChildProduct(p.name);
                                    setHideChildResults(true);
                                  }} 
                                  className="w-full text-left px-2 py-1 text-[10px] hover:bg-primary/10"
                                >
                                  {p.name} ({formatUsd(p.priceUsd)})
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedChildProduct && (
                          <div className="flex gap-1 items-center">
                            <Input type="text" inputMode="numeric" value={childQuantity} onChange={e => setChildQuantity(e.target.value)} className="h-7 text-xs w-20 text-center" placeholder="Cant." />
                            <Button type="button" onClick={addKitComponent} size="sm" className="h-7 text-[9px] bg-primary text-black">Agregar</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
                <div className="w-3/4">
                  <label className="text-[7px] font-bold uppercase">Costo Unitario USD</label>
                  <Input 
                    type="text" 
                    inputMode="decimal" 
                    value={costUsdInput}
                    placeholder="0.0000"
                    onChange={(e) => {
                      setCostUsdInput(e.target.value);
                      const costVal = parseFloat(e.target.value) || 0;
                      const profitVal = profitPercentInput !== '' ? parseFloat(profitPercentInput) : 0;
                      if (costVal > 0 && profitVal > 0) {
                        const newPriceUsd = calculatePriceUsdFromCostAndProfit(costVal, profitVal);
                        setLocalPriceUsd(newPriceUsd.toFixed(2));
                        setPriceRetailBs(roundTo2(newPriceUsd * exchangeRate).toFixed(2));
                      } else if (costVal === 0) {
                        setLocalPriceUsd('');
                        setPriceRetailBs('');
                      }
                    }} 
                    className="bg-white h-7 text-xs font-mono" 
                  />
                </div>
                
                <div>
                  <label className="text-[7px] font-bold uppercase">% de Ganancia sobre VENTA</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      value={profitPercentInput}
                      placeholder="0"
                      onChange={(e) => {
                        let raw = e.target.value;
                        let numValue = parseFloat(raw);
                        
                        if (!isNaN(numValue) && numValue > 99.99) {
                          toast({ 
                            title: "Porcentaje no válido", 
                            description: "El porcentaje de ganancia no puede superar 99.99%", 
                            variant: "destructive",
                            duration: 3000
                          });
                          return;
                        }
                        
                        setProfitPercentInput(raw);
                        const newProfit = isNaN(numValue) ? 0 : numValue;
                        const costVal = parseFloat(costUsdInput) || 0;
                        
                        if (costVal > 0 && newProfit > 0 && newProfit < 100) {
                          const newPriceUsd = calculatePriceUsdFromCostAndProfit(costVal, newProfit);
                          const newPriceBs = roundTo2(newPriceUsd * exchangeRate);
                          setLocalPriceUsd(newPriceUsd.toFixed(2));
                          setPriceRetailBs(newPriceBs.toFixed(2));
                        } 
                        else if (costVal === 0) {
                          setLocalPriceUsd('');
                          setPriceRetailBs('');
                        }
                      }}
                      className="bg-white h-7 text-xs font-mono w-24 text-right"
                    />
                    <span className="text-[9px] text-black/60">%</span>
                  </div>
                </div>

                <div className="mt-1 pt-1 border-t border-dashed border-gray-300">
                  <div className="flex justify-between items-center">
                    <label className="text-[7px] font-bold uppercase text-green-600">Ganancia por unidad (USD)</label>
                    <span className="text-xs font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      {(() => {
                        const cost = parseFloat(costUsdInput) || 0;
                        const priceUsd = parseFloat(localPriceUsd) || 0;
                        if (cost <= 0 || priceUsd <= 0 || priceUsd <= cost) return '$0.00';
                        const profitUsd = priceUsd - cost;
                        return `$${profitUsd.toFixed(2)}`;
                      })()}
                    </span>
                  </div>
                  <p className="text-[6px] text-green-600/80 mt-0.5">Ganancia en USD por cada unidad vendida (Precio Detal - Costo)</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[7px] font-bold uppercase">Precio Detal USD</label>
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      value={localPriceUsd}
                      placeholder="0.00"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                          const usdVal = parseFloat(raw);
                          const costVal = parseFloat(costUsdInput) || 0;
                          
                          if (!isNaN(usdVal) && usdVal > 0 && costVal > 0) {
                            let newProfit = calculateProfitFromCostAndPriceUsd(costVal, usdVal);
                            if (newProfit > 99.99) {
                              toast({ 
                                title: "Precio no válido", 
                                description: "El precio implicaría una ganancia superior al 99.99%", 
                                variant: "destructive",
                                duration: 3000
                              });
                              return;
                            }
                            setLocalPriceUsd(raw);
                            setProfitPercentInput(newProfit.toString());
                            setPriceRetailBs(roundTo2(usdVal * exchangeRate).toFixed(2));
                          } else if (usdVal === 0 || costVal === 0) {
                            setLocalPriceUsd(raw);
                            if (costVal === 0 && usdVal > 0) {
                              setProfitPercentInput('');
                              setPriceRetailBs(roundTo2(usdVal * exchangeRate).toFixed(2));
                            } else if (usdVal === 0) {
                              setProfitPercentInput('');
                              setPriceRetailBs('');
                            }
                          } else {
                            setLocalPriceUsd(raw);
                          }
                        }
                      }}
                      className="bg-white h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[7px] font-bold uppercase">Precio Detal Bs (final)</label>
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      value={priceRetailBs}
                      placeholder="0.00"
                      onChange={(e) => { 
                        const newValue = e.target.value;
                        const bs = parseFloat(newValue);
                        
                        if (!isNaN(bs) && bs > 0) {
                          const usd = bs / exchangeRate;
                          const costVal = parseFloat(costUsdInput) || 0;
                          
                          if (costVal > 0 && usd > 0) {
                            let newProfit = calculateProfitFromCostAndPriceUsd(costVal, usd);
                            if (newProfit > 99.99) {
                              toast({ 
                                title: "Precio no válido", 
                                description: "El precio implicaría una ganancia superior al 99.99%", 
                                variant: "destructive",
                                duration: 3000
                              });
                              return;
                            }
                            setPriceRetailBs(newValue);
                            setLocalPriceUsd(usd.toFixed(2));
                            setProfitPercentInput(newProfit.toString());
                          } else {
                            setPriceRetailBs(newValue);
                            if (costVal === 0 && usd > 0) {
                              setLocalPriceUsd(usd.toFixed(2));
                              setProfitPercentInput('');
                            }
                          }
                        } else {
                          setPriceRetailBs(newValue);
                          if (bs === 0) {
                            setLocalPriceUsd('');
                            setProfitPercentInput('');
                          }
                        }
                      }} 
                      className="bg-white h-7 text-xs font-mono w-full" 
                    />
                  </div>
                </div>
                
                <div className="border-t pt-2 mt-1">
                  <label className="text-[7px] font-bold uppercase text-black/60 block mb-1">Configuración de IVA</label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setIvaType('con_iva')}
                      className={cn(
                        "flex-1 py-1 text-[9px] font-bold rounded border transition-all",
                        ivaType === 'con_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      Con I.V.A.
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIvaType('sin_iva')}
                      className={cn(
                        "flex-1 py-1 text-[9px] font-bold rounded border transition-all",
                        ivaType === 'sin_iva' ? "bg-primary text-black border-primary" : "bg-white text-black/60 border-gray-300"
                      )}
                    >
                      Sin I.V.A.
                    </button>
                  </div>
                  {ivaType === 'con_iva' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Percent size={10} className="text-black/40" />
                      <Input 
                        type="text"
                        inputMode="decimal"
                        value={isNaN(ivaPercentage) ? '' : ivaPercentage}
                        onChange={(e) => setIvaPercentage(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="h-6 text-[9px] w-20 text-center"
                      />
                      <span className="text-[8px] text-black/60">% de I.V.A.</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded p-1.5 border mt-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-black/60">Precio Base USD (sin IVA):</span>
                    <span className="font-black text-secondary">
                      {(() => {
                        const priceUsd = parseFloat(localPriceUsd) || (calculatePriceUsdFromCostAndProfit(parseFloat(costUsdInput) || 0, parseFloat(profitPercentInput) || 0));
                        if (ivaType === 'con_iva' && ivaPercentage > 0 && priceUsd > 0) {
                          return formatUsd(roundTo2(priceUsd / (1 + ivaPercentage / 100)));
                        }
                        return formatUsd(priceUsd);
                      })()}
                    </span>
                  </div>
                  {ivaType === 'con_iva' && (
                    <div className="flex justify-between text-[9px]">
                      <span className="text-black/60">+ IVA ({isNaN(ivaPercentage) ? 0 : ivaPercentage}%):</span>
                      <span className="text-black/70">
                        {formatUsd((() => {
                          const priceUsd = parseFloat(localPriceUsd) || (calculatePriceUsdFromCostAndProfit(parseFloat(costUsdInput) || 0, parseFloat(profitPercentInput) || 0));
                          if (priceUsd > 0) {
                            return roundTo2(priceUsd * (isNaN(ivaPercentage) ? 0 : ivaPercentage) / 100);
                          }
                          return 0;
                        })())}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] pt-1 border-t mt-1">
                    <span className="text-black/60">Precio Mayor USD:</span>
                    <span className="font-black text-secondary">{formatUsd(parseFloat(priceWholesaleInput) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-black/60">Precio Costo USD:</span>
                    <span className="font-black text-secondary">{formatUsd(parseFloat(priceCostInput) || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-[#F5F5F5] p-3 border-t flex justify-end gap-2 flex-shrink-0">
            <Button type="submit" disabled={isSubmitting} id="submit-product-btn" className="bg-primary text-black font-black px-6 h-8 text-xs">
              {isSubmitting ? 'GUARDANDO...' : 'GUARDAR PRODUCTO'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default ProductFormModal;
