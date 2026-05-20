// Normalizar fecha a objeto Date
export const normalizeDate = (date: Date | string): Date => {
  return new Date(date);
};

// Obtener fecha en formato YYYY-MM-DD basado en la hora local del sistema
export const getLocalDateString = (date: Date | string = new Date()): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Obtener fecha inicio del día en la zona horaria local
export const getStartOfDay = (dateStr: string): Date => {
  // Crea una fecha a las 00:00:00 en hora local
  return new Date(dateStr + 'T00:00:00');
};

// Obtener fecha fin del día en la zona horaria local
export const getEndOfDay = (dateStr: string): Date => {
  // Crea una fecha a las 23:59:59 en hora local
  return new Date(dateStr + 'T23:59:59.999');
};

// Formatear fecha completa para mostrar en la UI (ajusta UTC a local automáticamente)
export const formatLocalDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Formatear fecha corta
export const formatLocalDateShort = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short'
  });
};

// Obtener fecha actual en formato ISO estándar (UTC)
export const getCurrentLocalISO = (): string => {
  return new Date().toISOString();
};
