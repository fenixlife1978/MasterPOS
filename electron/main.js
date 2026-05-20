const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let nextServer = null;
let serverPort = 3000;

// Buscar un puerto disponible
function findAvailablePort(startPort, callback) {
  const server = http.createServer();
  server.listen(startPort, () => {
    server.close(() => callback(startPort));
  });
  server.on('error', () => {
    findAvailablePort(startPort + 1, callback);
  });
}

function createWindow() {
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
    title: 'MasterPOS',
    show: false,
  });

  // Esperar a que el servidor Next.js esté listo
  const waitForServer = () => {
    const options = {
      hostname: 'localhost',
      port: serverPort,
      path: '/',
      method: 'HEAD',
      timeout: 1000
    };
    
    const req = http.request(options, (res) => {
      mainWindow.loadURL(`http://localhost:${serverPort}`);
      mainWindow.show();
    });
    
    req.on('error', () => {
      setTimeout(waitForServer, 500);
    });
    
    req.end();
  };

  waitForServer();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Crear menú personalizado
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Salir',
          click: () => { app.quit(); }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startNextServer() {
  // Buscar puerto disponible
  findAvailablePort(serverPort, (port) => {
    serverPort = port;
    console.log(`Servidor Next.js en puerto: ${serverPort}`);
    
    // Obtener la ruta al ejecutable de Node.js empaquetado
    const nextPath = path.join(__dirname, '../node_modules/next/dist/bin/next');
    
    nextServer = spawn('node', [nextPath, 'start', '-p', serverPort], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: serverPort,
        ELECTRON_START: 'true'
      },
      stdio: 'pipe'
    });

    nextServer.stdout.on('data', (data) => {
      console.log(`Next.js: ${data}`);
    });

    nextServer.stderr.on('data', (data) => {
      console.error(`Next.js error: ${data}`);
    });

    nextServer.on('close', (code) => {
      console.log(`Next.js proceso cerrado con código: ${code}`);
    });
  });
}

app.whenReady().then(() => {
  startNextServer();
  setTimeout(() => {
    if (!mainWindow) {
      createWindow();
    }
  }, 3000);
});

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});