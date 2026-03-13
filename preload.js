const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Control de ventanas
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // Base de datos
    initDatabase: () => ipcRenderer.invoke('init-database'),
    getConfiguracion: () => ipcRenderer.invoke('get-configuracion'),
    updateTasaBCV: (tasa) => ipcRenderer.invoke('update-tasa-bcv', tasa),
    getCategorias: () => ipcRenderer.invoke('get-categorias'),
    getProductos: () => ipcRenderer.invoke('get-productos'),
    realizarBackup: () => ipcRenderer.invoke('realizar-backup'),
    buscarProductosFTS: (termino) => ipcRenderer.invoke('buscar-productos-fts', termino),
    
    // CRUD Productos
    addProducto: (producto) => ipcRenderer.invoke('add-producto', producto),
    updateProducto: (id, producto) => ipcRenderer.invoke('update-producto', id, producto),
    deleteProducto: (id) => ipcRenderer.invoke('delete-producto', id),
    registrarVenta: (ventaData) => ipcRenderer.invoke('registrar-venta', ventaData),
    getVentasDia: () => ipcRenderer.invoke('get-ventas-dia'),

    // REPORTES
    getHistorialVentas: () => ipcRenderer.invoke('get-historial-ventas'),
    getTotalesReportes: () => ipcRenderer.invoke('get-totales-reportes'),
});