import { turso } from '@/lib/db';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM products');
    return Response.json({ products: result.rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
