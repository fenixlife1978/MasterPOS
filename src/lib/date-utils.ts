// Zona horaria de Venezuela (UTC-4 sin horario de verano)
const VENEZUELA_TZ = 'America/Caracas';

/**
 * Obtiene la fecha y hora actual en Venezuela como objeto Date
 * Nota: El objeto Date internamente sigue siendo UTC, pero representa el momento exacto.
 */
export const getCurrentVenezuelaDate = (): Date => {
  return new Date(); // Esto es universal, pero al formatear usamos la zona
};

/**
 * Normalizar fecha a objeto Date (sin cambios)
 */
export const normalizeDate = (date: Date | string): Date => {
  return new Date(date);
};

/**
 * Obtiene la fecha actual en Venezuela en formato YYYY-MM-DD (para Firestore)
 */
export const getVenezuelaDateString = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VENEZUELA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

/**
 * Obtiene la fecha y hora actual en Venezuela en formato ISO 8601 con offset -04:00
 * Ejemplo: "2026-06-02T09:36:51.000-04:00"
 */
export const getVenezuelaISOString = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VENEZUELA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  // Añadir el offset fijo de Venezuela (-04:00)
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}.${partMap.fractionalSecond}-04:00`;
};

/**
 * Obtiene un timestamp numérico (ms desde epoch) basado en la hora actual de Venezuela.
 * Como el timestamp es universal, no necesita cambio.
 */
export const getVenezuelaTimestamp = (): number => {
  return Date.now();
};

/**
 * Obtiene la fecha en formato YYYY-MM-DD basado en la zona horaria de Venezuela.
 * @param date Fecha opcional (por defecto ahora)
 */
export const getLocalDateString = (date: Date | string = new Date()): string => {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VENEZUELA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

/**
 * Obtiene fecha inicio del día en la zona horaria local (Venezuela)
 * Devuelve un objeto Date que representa las 00:00:00 de ese día en Caracas.
 */
export const getStartOfDay = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  // Forzar la interpretación como fecha local de Venezuela al inicio del día
  return new Date(`${dateStr}T00:00:00-04:00`);
};

/**
 * Obtiene fecha fin del día en la zona horaria local (Venezuela)
 * Devuelve un objeto Date que representa las 23:59:59 de ese día en Caracas.
 */
export const getEndOfDay = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  // Forzar la interpretación como fecha local de Venezuela al final del día
  return new Date(`${dateStr}T23:59:59.999-04:00`);
};

/**
 * Formatear fecha completa para mostrar en la UI (usando zona Venezuela)
 */
export const formatLocalDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-VE', {
    timeZone: VENEZUELA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formatear fecha corta (solo día/mes)
 */
export const formatLocalDateShort = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-VE', {
    timeZone: VENEZUELA_TZ,
    day: '2-digit',
    month: 'short'
  });
};

/**
 * Obtiene la fecha actual en formato ISO estándar (UTC) - útil para comparaciones
 */
export const getCurrentLocalISO = (): string => {
  return new Date().toISOString();
};

// Mantener compatibilidad con nombres anteriores
export const getVenezuelaDateForFirestore = getVenezuelaDateString;
