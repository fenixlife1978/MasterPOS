import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export async function GET() {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return Response.json({ products });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}