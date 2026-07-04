// ============================================================
// SINCRONIZACIÓN CORRECTA PARA WORKSTATION DE FIREBASE
// ============================================================

// ✅ Usar las credenciales por defecto de Google Cloud
const admin = require('firebase-admin');

// ✅ Inicializar con las credenciales automáticas de la Workstation
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://' + process.env.GCLOUD_PROJECT + '.firebaseio.com'
});

const db = admin.database();

(async () => {
  console.log('🔥 SINCRONIZANDO 02/07 - 03/07...');
  
  try {
    // Obtener transacciones
    console.log('📊 Leyendo transacciones...');
    const txsSnapshot = await db.ref('transactions').once('value');
    const transactions = Object.values(txsSnapshot.val() || {});
    console.log('📊 Transacciones totales:', transactions.length);
    
    // Obtener contabilidad
    console.log('📊 Leyendo contabilidad...');
    const accSnapshot = await db.ref('accounting').once('value');
    const accounting = accSnapshot.val() || {};
    
    // IDs existentes
    const existentes = new Set();
    Object.values(accounting).forEach(e => {
      if (e.referenceId) existentes.add(e.referenceId);
    });
    console.log('📊 IDs registrados:', existentes.size);
    
    // Filtrar pendientes
    const pendientes = transactions.filter(t => {
      const fecha = new Date(t.date);
      return fecha >= new Date('2026-07-02') && 
             fecha <= new Date('2026-07-03 23:59:59') && 
             !existentes.has(t.id) &&
             t.type !== 'credito';
    });
    
    console.log('📊 FALTAN:', pendientes.length);
    
    if (pendientes.length === 0) {
      console.log('✅ NADA QUE SINCRONIZAR');
      return;
    }
    
    pendientes.forEach((t, i) => {
      console.log('  ' + (i+1) + '. ' + t.type + ' | ' + t.date + ' | ' + t.total + ' Bs');
    });
    
    let count = 0;
    const ref = db.ref('accounting');
    
    for (const t of pendientes) {
      try {
        const esEgreso = ['colaboracion','consumo_propio','devolucion','ajuste_negativo'].includes(t.type);
        
        let category = 'ventas';
        if (t.type === 'cobro_deuda') category = 'cobro_deuda';
        else if (t.type === 'devolucion') category = 'devolucion';
        else if (t.type === 'ajuste_positivo' || t.type === 'ajuste_negativo') category = 'ajuste_inventario';
        else if (t.type === 'colaboracion' || t.type === 'consumo_propio') category = 'otros';
        
        await ref.push({
          id: Date.now() + count,
          date: t.date || new Date().toISOString(),
          type: esEgreso ? 'egreso' : 'ingreso',
          category: category,
          concept: (t.type || 'VENTA').toUpperCase() + ' #' + (t.receiptNumber || t.id),
          description: t.clientName || t.notes || t.type || 'Transacción',
          amount: t.total || 0,
          totalUsd: t.totalUsd || (t.total || 0) / (t.exchangeRate || 1),
          exchangeRate: t.exchangeRate || 1,
          referenceType: t.type || 'venta',
          referenceId: t.id,
          createdAt: new Date().toISOString()
        });
        
        count++;
        console.log('✅ ' + count + '/' + pendientes.length + ' - ' + t.type + ' - ' + t.id);
        
      } catch(e) {
        console.error('❌ Error con ' + t.id + ':', e.message);
      }
    }
    
    console.log('✅ LISTO! ' + count + ' transacciones agregadas');
    
  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
  }
})();
