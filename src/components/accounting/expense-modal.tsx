"use client";

import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/lib/types';

// ✅ Función para obtener fecha actual en Venezuela en formato YYYY-MM-DD
const getVenezuelaDateString = (): string => {
  const now = new Date();
  const venezuelaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  const year = venezuelaDate.getFullYear();
  const month = String(venezuelaDate.getMonth() + 1).padStart(2, '0');
  const day = String(venezuelaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    category: string;
    subcategory?: string;
    concept: string;
    description: string;
    amount: number;
    date: string;
  }) => void;
}

export default function ExpenseModal({ open, onClose, onConfirm }: ExpenseModalProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [concept, setConcept] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getVenezuelaDateString);

  // ✅ Obtener la categoría seleccionada
  const currentCategory = EXPENSE_CATEGORIES.find(c => c.value === selectedCategory);

  const handleConfirm = () => {
    if (!selectedCategory) {
      alert('Seleccione una categoría');
      return;
    }
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      alert('Ingrese un monto válido');
      return;
    }
    if (!date) {
      alert('Ingrese una fecha');
      return;
    }

    onConfirm({
      category: selectedCategory,
      subcategory: selectedSubcategory || undefined,
      concept: concept || currentCategory?.label || '',
      description,
      amount: amountNum,
      date
    });
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setConcept('');
    setDescription('');
    setAmount('');
    setDate(getVenezuelaDateString);
  };

  const getCategoryLabel = (value: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-3xl p-0 overflow-hidden rounded-2xl shadow-xl">
        <DialogHeader className="sr-only"><DialogTitle>Registrar Egreso</DialogTitle></DialogHeader>
        <div className="flex flex-col">
          <div className="bg-[#1A2C4E] p-4 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2"><DollarSign size={20} className="text-primary" /><h3 className="text-lg font-headline font-black">Registrar Egreso</h3></div>
              <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-white/60 text-xs mt-1">Complete los datos del gasto</p>
          </div>
          
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Categoría *</label>
                  <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubcategory(''); }} className="w-full h-10 bg-white border border-[#9E9E9E] rounded-lg px-3 text-sm">
                    <option value="">Seleccione una categoría</option>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Subcategoría (opcional)</label>
                  <Input 
                    value={selectedSubcategory} 
                    onChange={(e) => setSelectedSubcategory(e.target.value)} 
                    placeholder="Ej: Electricidad, Agua, etc." 
                    className="bg-white border-[#9E9E9E]" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Concepto</label>
                  <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Pago de nómina, reparación, etc." className="bg-white border-[#9E9E9E]" />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Monto (Bs) *</label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-white border-[#9E9E9E] text-lg font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Fecha *</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white border-[#9E9E9E]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-black/60 uppercase tracking-widest block mb-1">Descripción (opcional)</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle adicional del gasto" className="bg-white border-[#9E9E9E]" />
                </div>
              </div>
            </div>
            {selectedCategory && parseFloat(amount) > 0 && (
              <div className="mt-4 p-3 bg-[#F5F5F5] rounded-lg">
                <p className="text-[10px] font-bold text-black/60 uppercase text-center">Resumen del Egreso</p>
                <div className="grid grid-cols-2 gap-2 text-center mt-1">
                  <div><p className="text-[9px] text-black/50">Categoría</p><p className="text-xs font-bold text-black">{getCategoryLabel(selectedCategory)}</p></div>
                  <div><p className="text-[9px] text-black/50">Monto</p><p className="text-sm font-black text-red-600">Bs {parseFloat(amount || '0').toFixed(2)}</p></div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-[#F5F5F5] p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} className="px-6 text-black">CANCELAR</Button>
            <Button onClick={handleConfirm} className="px-6 bg-primary text-black font-black">REGISTRAR EGRESO</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}