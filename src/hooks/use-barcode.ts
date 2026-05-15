"use client";

import { useEffect, useRef } from 'react';

export function useBarcode(onScan: (code: string) => void) {
  const buffer = useRef('');
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in an input unless it's explicitly allowed (handled via events)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Special case for our scan-ready inputs
        if (target.id !== 'pos-search-input' && target.id !== 'barcode-field') {
          return;
        }
      }

      if (timer.current) clearTimeout(timer.current);

      if (e.key === 'Enter') {
        if (buffer.current.length >= 4) {
          onScan(buffer.current);
          buffer.current = '';
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
        timer.current = setTimeout(() => {
          buffer.current = '';
        }, 150); // Timeout to differentiate human typing from scanner
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [onScan]);
}
