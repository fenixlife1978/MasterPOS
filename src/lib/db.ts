import { createClient } from '@libsql/client';

// Configuración de Turso con fallbacks para asegurar funcionamiento en Workstation/Electron
const url = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || 'libsql://masterpostv1-fenixlife1978.aws-us-east-1.turso.io';
const authToken = process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODA5Njk3NjAsImlkIjoiMDE5ZThlMDgtMmYwMS03MjRiLWJjYWYtYzhmMTY5MGMzMTE0IiwicmlkIjoiODQ3MGQ0MTgtYmMxMC00ZmUwLWFmYTctZDYxZjY2YjFmZmU5In0.wr0aYI7XvziB6lU62XTLko8k0RoMfYOkQ364P_gZtpL5vewFd5S4tRe6H0ZYR1af7I_c_ysOrEvTKHHa3PbdDA';

if (!url || !authToken) {
  console.error('⚠️ Error: Credenciales de Turso no detectadas.');
}

export const turso = createClient({ url, authToken });

// Función helper para ejecutar consultas SQL con logging
export async function executeQuery(sql: string, args?: any[]) {
  try {
    const result = args 
      ? await turso.execute({ sql, args })
      : await turso.execute(sql);
    return result;
  } catch (error) {
    console.error('Error en executeQuery:', { sql, args, error });
    throw error;
  }
}

// Función para obtener un registro por ID
export async function getById(table: string, id: number | string, idColumn: string = 'id') {
  const result = await turso.execute({
    sql: `SELECT * FROM ${table} WHERE ${idColumn} = ?`,
    args: [id]
  });
  return result.rows[0] || null;
}

// Función para obtener todos los registros de una tabla
export async function getAll(table: string) {
  const result = await turso.execute(`SELECT * FROM ${table}`);
  return result.rows;
}

// Función para insertar un registro
export async function insert(table: string, data: Record<string, any>) {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);
  
  const result = await turso.execute({
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    args: values
  });
  return result;
}

// Función para actualizar un registro
export async function update(table: string, id: number | string, data: Record<string, any>, idColumn: string = 'id') {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(data), id];
  
  const result = await turso.execute({
    sql: `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = ?`,
    args: values
  });
  return result;
}

// Función para eliminar un registro
export async function remove(table: string, id: number | string, idColumn: string = 'id') {
  const result = await turso.execute({
    sql: `DELETE FROM ${table} WHERE ${idColumn} = ?`,
    args: [id]
  });
  return result;
}
