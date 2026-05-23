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

    // COMPRAS/PROVEEDORES
    getProveedores: () => ipcRenderer.invoke('get-proveedores'),
    addProveedor: (proveedor) => ipcRenderer.invoke('add-proveedor', proveedor),
    updateProveedor: (id, proveedor) => ipcRenderer.invoke('update-proveedor', id, proveedor),
    deleteProveedor: (id) => ipcRenderer.invoke('delete-proveedor', id),
    crearOrdenCompra: (ordenData) => ipcRenderer.invoke('crear-orden-compra', ordenData),
    recibirOrden: (ordenId, items) => ipcRenderer.invoke('recibir-orden', ordenId, items),
    getOrdenesCompra: () => ipcRenderer.invoke('get-ordenes-compra'),
    getOrdenDetalle: (ordenId) => ipcRenderer.invoke('get-orden-detalle', ordenId),
    updateOrdenCompra: (id, datos) => ipcRenderer.invoke('update-orden-compra', id, datos),
    updateOrdenCompleta: (id, ordenData) => ipcRenderer.invoke('update-orden-completa', id, ordenData),

    // REPORTES
    getHistorialVentas: () => ipcRenderer.invoke('get-historial-ventas'),
    getTotalesReportes: () => ipcRenderer.invoke('get-totales-reportes'),
    
    // Clientes
    getClientes: () => ipcRenderer.invoke('get-clientes'),
    addCliente: (cliente) => ipcRenderer.invoke('add-cliente', cliente),
    asignarDeuda: (data) => ipcRenderer.invoke('asignar-deuda', data),
    abonarDeudaCliente: (datos) => ipcRenderer.invoke('abonar-deuda', datos),

   // Usuarios
    validarLogin: (datos) => ipcRenderer.invoke('validar-login', datos),
    updateCredenciales: (datos) => ipcRenderer.invoke('update-credenciales', datos), 

    // Exportar PDF
    exportarTodasVentasPDF: () => ipcRenderer.invoke('exportar-todas-ventas-pdf'),
});