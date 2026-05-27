// src/lib/currency-formatter.ts

/**
 * Formatea un monto en Bolívares (Bs.) con decimales personalizables
 * Ejemplo: formatBs(10256.12) → "Bs. 10.256,12"
 * Ejemplo: formatBs(2100) → "Bs. 2.100,00"
 * Ejemplo: formatBs(10256.1234, 4) → "Bs. 10.256,1234"
 */
export function formatBs(amount: number, decimals: number = 2): string {
    if (isNaN(amount)) return 'Bs. 0,00';
    if (amount === null || amount === undefined) return 'Bs. 0,00';
    if (typeof amount !== 'number') return 'Bs. 0,00';
    
    return 'Bs. ' + amount.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  /**
   * Formatea un monto en Dólares (USD) con decimales personalizables
   * Ejemplo: formatUsd(25.15) → "USD $25,15"
   * Ejemplo: formatUsd(1256.24) → "USD $1.256,24"
   * Ejemplo: formatUsd(3.89) → "USD $3,89"
   * Ejemplo: formatUsd(25.1578, 4) → "USD $25,1578"
   */
  export function formatUsd(amount: number, decimals: number = 2): string {
    if (isNaN(amount)) return 'USD $0,00';
    if (amount === null || amount === undefined) return 'USD $0,00';
    if (typeof amount !== 'number') return 'USD $0,00';
    
    return 'USD $' + amount.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  /**
   * Formatea un monto en Dólares sin el símbolo $ (para casos especiales)
   * Ejemplo: formatUsdNumber(25.15) → "25,15"
   * Ejemplo: formatUsdNumber(25.1578, 4) → "25,1578"
   */
  export function formatUsdNumber(amount: number, decimals: number = 2): string {
    if (isNaN(amount)) return '0,00';
    if (amount === null || amount === undefined) return '0,00';
    
    return amount.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  /**
   * Formatea un monto en Bolívares sin el símbolo (para casos especiales)
   * Ejemplo: formatBsNumber(10256.12) → "10.256,12"
   * Ejemplo: formatBsNumber(10256.1234, 4) → "10.256,1234"
   */
  export function formatBsNumber(amount: number, decimals: number = 2): string {
    if (isNaN(amount)) return '0,00';
    if (amount === null || amount === undefined) return '0,00';
    
    return amount.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  /**
   * Formato genérico según el tipo de moneda
   */
  export function formatCurrency(amount: number, currency: 'VES' | 'USD' = 'VES', decimals: number = 2): string {
    if (currency === 'USD') {
      return formatUsd(amount, decimals);
    }
    return formatBs(amount, decimals);
  }
  
  /**
   * Para montos que están en USD y quieres mostrar el equivalente en Bs
   * Ejemplo: formatBsEquivalent(3.89, 540.04) → "Bs. 2.100,00"
   */
  export function formatBsEquivalent(usdAmount: number, exchangeRate: number, decimals: number = 2): string {
    const bsAmount = usdAmount * exchangeRate;
    return formatBs(bsAmount, decimals);
  }