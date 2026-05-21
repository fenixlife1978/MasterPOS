const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const next = require('electron-next');
const { autoUpdater } = require('electron-updater');

let mainWindow;

async function createWindow() {
  await next(path.join(__dirname, '..'));
  
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

  mainWindow.loadURL('http://localhost:8000');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ========== AUTO-UPDATER ==========
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

app.on('ready', () => {
  createWindow();
  // Verificar updates 5 segundos después de abrir
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);
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