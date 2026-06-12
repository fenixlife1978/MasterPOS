import { turso } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return Response.json({ error: 'Falta el parámetro uid' }, { status: 400 });
  }

  try {
    const result = await turso.execute({
      sql: 'SELECT name, role, email FROM users WHERE uid = ?',
      args: [uid]
    });

    if (result.rows.length === 0) {
      return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return Response.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
