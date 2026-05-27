"use client";

import { useState } from 'react';
import { Product, CartItem } from '@/lib/types';
import { X, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';

interface PriceTypeModalProps {
  product: Product;
  currentItem: CartItem;
  exchangeRate: number;
  onClose: () => void;
  onSelect: (priceUsd: number) => void; // ✅ Recibe solo el precio en USD
}

export default function PriceTypeModal({ product, currentItem, exchangeRate, onClose, onSelect }: PriceTypeModalProps) {
  // Definir las opciones de precio disponibles (solo aquellas con valor)
  const priceOptions = [
    { key: 'priceRetail', label: 'Detal', priceUsd: product.priceRetail },
    { key: 'priceWholesale', label: 'Mayor', priceUsd: product.priceWholesale },
    { key: 'priceCost', label: 'Costo', priceUsd: product.priceCost },
  ].filter(opt => opt.priceUsd !== undefined && opt.priceUsd !== null && opt.priceUsd > 0);

  // Si no hay opciones alternativas, mostrar solo el precio actual
  const currentPriceUsd = currentItem.priceUsd;
  const currentPriceBs = currentItem.priceBs;

  const handleSelect = (priceUsd: number) => {
    onSelect(priceUsd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#1E3A8A] text-white p-4 flex justify-between items-center">
          <h3 className="text-base font-black flex items-center gap-2">
            <DollarSign size={18} /> Cambiar precio: {product.name}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500 mb-2">
            Selecciona el tipo de precio para este producto:
          </p>

          {priceOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.priceUsd!)}
              className={cn(
                "w-full p-3 rounded-xl border-2 text-left transition-all",
                currentPriceUsd === opt.priceUsd
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300 bg-white"
              )}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">{opt.label}</p>
                  <p className="text-[10px] text-gray-500">Precio unitario</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm">{formatUsd(opt.priceUsd!)}</p>
                  <p className="font-mono text-xs text-gray-500">{formatBs(opt.priceUsd! * exchangeRate)}</p>
                </div>
              </div>
            </button>
          ))}

          {/* Mostrar el precio actual si no está en las opciones (ej. precio personalizado) */}
          {!priceOptions.some(opt => opt.priceUsd === currentPriceUsd) && (
            <div className="p-3 rounded-xl bg-gray-100 border border-gray-300">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">Precio actual (personalizado)</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm">{formatUsd(currentPriceUsd)}</p>
                  <p className="font-mono text-xs text-gray-500">{formatBs(currentPriceBs)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-3 flex justify-end border-t">
          <Button onClick={onClose} variant="ghost" className="text-gray-600">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}