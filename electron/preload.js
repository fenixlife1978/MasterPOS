const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ✅ NUEVO: Método principal para impresión de recibos (usado por el frontend mejorado)
    printReceipt: (data) => ipcRenderer.invoke('printReceipt', data),
    
    // ✅ LEGACY: Método antiguo para compatibilidad (si algún código viejo lo usa)
    printTicket: (data) => ipcRenderer.invoke('print-ticket', data),
    
    // ✅ OPCIONAL: Para listar impresoras (si lo necesitas en el futuro)
    getPrinters: () => ipcRenderer.invoke('getPrinters'),
});