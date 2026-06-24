import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return Response.json({ error: 'Falta el parámetro uid' }, { status: 400 });
  }

  try {
    // Buscar en Firestore
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    return Response.json({
      name: userData.name || '',
      role: userData.role || 'user',
      email: userData.email || ''
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}