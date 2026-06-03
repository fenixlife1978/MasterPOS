const { app, BrowserWindow, dialog, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

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
});;