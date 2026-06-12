import { turso } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await turso.execute('SELECT sqlite_version() as version');
    return NextResponse.json({ 
      success: true, 
      version: result.rows[0],
      message: 'Conexión a Turso exitosa'
    });
  } catch (error: any) {
    console.error('Error de conexión:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
