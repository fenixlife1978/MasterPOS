const { app, BrowserWindow, dialog, protocol, net, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');
const { PosPrinter } = require('electron-pos-printer');

// ✅ FORZAR ZONA HORARIA DE VENEZUELA
app.commandLine.appendSwitch('timezone', 'America/Caracas');

let mainWindow;

// Registrar el protocolo seguro 'app' antes de que la aplicación esté lista (vital para el offline)
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/logo-master.png'),
    show: false,
  });

  // CORRECCIÓN: Si está empaquetada (.exe), usa el modo offline nativo. Si estás desarrollando, usa el puerto 9002.
  if (app.isPackaged) {
    mainWindow.loadURL('app://-');
  } else {
    mainWindow.loadURL('http://localhost:9002');
  }
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================
// 🖨️ MANEJADORES DE IMPRESIÓN
// ============================================================

/**
 * Convierte los datos del recibo al formato que espera electron-pos-printer
 */
function buildPrintDataFromReceiptData(receiptData) {
  const printData = [];

  // 1. Encabezado
  printData.push({ type: 'text', value: 'LICORERIA CASTILLO', style: { fontWeight: "700", textAlign: 'center', fontSize: "18px" } });
  printData.push({ type: 'text', value: 'Calle Ayacucho entre Calles Occidente y La Cruz, Sector La Playita', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: 'RIF: V-11654282-6', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: 'TEL: 0424-5397181', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: 'Guama - Yaracuy', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });

  // 2. Título del documento
  const title = receiptData.type === 'credito' ? 'DOCUMENTO DE CRÉDITO' :
                receiptData.type === 'cobro_deuda' ? 'NOTA' :
                receiptData.type === 'colaboracion' ? 'COLABORACIÓN' :
                receiptData.type === 'consumo_propio' ? 'CONSUMO PROPIO' : 'RECIBO';
  printData.push({ type: 'text', value: title.toUpperCase(), style: { textAlign: 'center', fontWeight: "700", fontSize: "14px" } });
  printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });

  // 3. Información del recibo
  const docLabel = receiptData.type === 'cobro_deuda' ? 'NOTA N:' : (receiptData.type === 'credito' ? 'CRÉDITO N:' : 'RECIBO N:');
  printData.push({ type: 'text', value: `${docLabel} ${receiptData.receiptNumber}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: `FECHA: ${receiptData.date}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: `CLIENTE: ${receiptData.clientName.toUpperCase()}`, style: { textAlign: 'left', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });

  // 4. Items
  if (receiptData.items && receiptData.items.length > 0) {
    receiptData.items.forEach(item => {
      printData.push({
        type: 'text',
        value: `${item.quantity}x ${item.name.toUpperCase().slice(0, 20)}`,
        style: { fontWeight: "700", textAlign: 'left', fontSize: "10px" }
      });
      printData.push({
        type: 'text',
        value: `    Ref: ${item.priceBs.toFixed(2)} | Total: ${(item.priceBs * item.quantity).toFixed(2)} Bs`,
        style: { fontSize: "10px", textAlign: 'left', fontWeight: "400" }
      });
    });
  } else {
    // Si no hay items (ej. cobro de deuda)
    printData.push({
      type: 'text',
      value: `* ${receiptData.notes?.toUpperCase() || 'PAGO DE DEUDA'} *`,
      style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" }
    });
  }

  printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });

  // 5. Totales (solo si no es colaboración o consumo propio)
  if (receiptData.type !== 'colaboracion' && receiptData.type !== 'consumo_propio') {
    if (receiptData.subtotal > 0) {
      printData.push({ type: 'text', value: `SUBTOTAL: ${receiptData.subtotal.toFixed(2)} Bs`, style: { textAlign: 'right', fontSize: "10px", fontWeight: "400" } });
    }
    if (receiptData.iva > 0) {
      printData.push({ type: 'text', value: `IVA (16%): ${receiptData.iva.toFixed(2)} Bs`, style: { textAlign: 'right', fontSize: "10px", fontWeight: "400" } });
    }
    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
    printData.push({ 
      type: 'text', 
      value: `TOTAL: ${receiptData.total.toFixed(2)} Bs`, 
      style: { textAlign: 'right', fontWeight: "700", fontSize: "16px" } 
    });
    printData.push({ 
      type: 'text', 
      value: `REF: ${(receiptData.total / receiptData.exchangeRate).toFixed(2)} USD`, 
      style: { textAlign: 'right', fontSize: "12px", fontWeight: "400" } 
    });
  }

  // 6. Mensaje especial para crédito
  if (receiptData.type === 'credito') {
    printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
    printData.push({ type: 'text', value: '📋 ESTE ES UN DOCUMENTO DE CRÉDITO', style: { textAlign: 'center', fontSize: "10px", fontWeight: "700" } });
    printData.push({ type: 'text', value: `Saldo pendiente: ${receiptData.total.toFixed(2)} Bs`, style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
  }

  // 7. Pie de página
  printData.push({ type: 'text', value: '--------------------------------', style: { textAlign: 'center', fontSize: "10px", fontWeight: "400" } });
  printData.push({ type: 'text', value: '¡GRACIAS POR SU PREFERENCIA!', style: { textAlign: 'center', fontWeight: "700", fontSize: "12px" } });
  printData.push({ type: 'text', value: 'Desarrollado por MasterPOS v1.0', style: { textAlign: 'center', fontSize: "8px", fontWeight: "400" } });

  return printData;
}

// ✅ NUEVO HANDLER: printReceipt (para el frontend mejorado)
ipcMain.handle('printReceipt', async (event, data) => {
  console.log('📄 Imprimiendo recibo con printReceipt:', data.receiptNumber);

  try {
    // Convertir los datos al formato que espera electron-pos-printer
    const printData = buildPrintDataFromReceiptData(data);

    const options = {
      preview: false,
      margin: '0 0 0 0',
      copies: 1,
      printerName: '', // Usa la impresora predeterminada del sistema
      timeOutPerLine: 400,
      pageSize: '80mm'
    };

    await PosPrinter.print(printData, options);
    console.log('✅ Recibo impreso correctamente');
    return { success: true };

  } catch (error) {
    console.error('❌ Error en impresión directa:', error);
    return { success: false, error: error.message };
  }
});

// ✅ HANDLER LEGACY: print-ticket (para compatibilidad con código anterior)
ipcMain.handle('print-ticket', async (event, data) => {
  console.log('📄 Imprimiendo con print-ticket (legacy)');

  const options = {
    preview: false,
    margin: '0 0 0 0',
    copies: 1,
    printerName: '', // Usa la impresora predeterminada del sistema
    timeOutPerLine: 400,
    pageSize: '80mm'
  };

  try {
    await PosPrinter.print(data, options);
    return { success: true };
  } catch (error) {
    console.error('Error en impresión directa:', error);
    return { success: false, error: error.message };
  }
});

// ========== AUTO-UPDATER (Tu lógica intacta) ==========
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'fenixlife1978',
  repo: 'MasterPOS'
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Buscando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
  console.log('🆕 Actualización disponible:', info.version);
});

autoUpdater.on('update-not-available', () => {
  console.log('✅ Ya tienes la última versión');
});

autoUpdater.on('error', (err) => {
  console.log('❌ Error en actualización:', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`📥 Descargando: ${Math.floor(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', () => {
  console.log('✅ Actualización descargada');
  const response = dialog.showMessageBoxSync({
    type: 'info',
    title: 'Actualización lista',
    message: 'Se ha descargado una nueva versión. ¿Reiniciar ahora para instalarla?',
    buttons: ['Reiniciar ahora', 'Más tarde']
  });
  
  if (response === 0) {
    autoUpdater.quitAndInstall();
  }
});
// ========== FIN AUTO-UPDATER ==========

app.whenReady().then(() => {
  // Manejador nativo de archivos (Carga tu HTML/CSS directo desde el .exe rápido y offline)
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let pathname = url.pathname;

    if (pathname === "/" || pathname === "") {
      pathname = "/index.html";
    } else if (!path.extname(pathname)) {
      pathname = path.join(pathname, "index.html");
    }

    // Como este archivo está dentro de la carpeta 'electron', usamos '..' para subir un nivel y hallar 'out'
    const filePath = path.join(__dirname, "..", "out", pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  // Verificar actualizaciones automáticas 5 segundos después de abrir (Solo en el ejecutable final)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});