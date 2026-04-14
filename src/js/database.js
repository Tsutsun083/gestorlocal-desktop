// database.js - Comunicación con el backend (electronAPI)

// ============================================
// CONFIGURACIÓN
// ============================================
export async function initDatabase() {
    return await window.electronAPI.initDatabase();
}

export async function getConfiguracion() {
    return await window.electronAPI.getConfiguracion();
}

export async function updateTasaBCV(tasa) {
    return await window.electronAPI.updateTasaBCV(tasa);
}

// ============================================
// CATEGORÍAS
// ============================================
export async function getCategorias() {
    return await window.electronAPI.getCategorias();
}

// ============================================
// PRODUCTOS
// ============================================
export async function getProductos() {
    return await window.electronAPI.getProductos();
}

export async function addProducto(productoData) {
    return await window.electronAPI.addProducto(productoData);
}

export async function updateProducto(id, productoData) {
    return await window.electronAPI.updateProducto(id, productoData);
}

export async function deleteProducto(id) {
    return await window.electronAPI.deleteProducto(id);
}

// ============================================
// VENTAS
// ============================================
export async function registrarVenta(ventaData) {
    return await window.electronAPI.registrarVenta(ventaData);
}

export async function getVentasDia() {
    return await window.electronAPI.getVentasDia();
}

// ============================================
// PROVEEDORES (NUEVAS)
// ============================================
export async function getProveedores() {
    return await window.electronAPI.getProveedores();
}

export async function addProveedor(proveedorData) {
    return await window.electronAPI.addProveedor(proveedorData);
}

export async function updateProveedor(id, proveedorData) {
    return await window.electronAPI.updateProveedor(id, proveedorData);
}

export async function deleteProveedor(id) {
    return await window.electronAPI.deleteProveedor(id);
}

// ============================================
// ÓRDENES DE COMPRA (NUEVAS)
// ============================================
export async function getOrdenesCompra() {
    return await window.electronAPI.getOrdenesCompra();
}

export async function getOrdenDetalle(ordenId) {
    return await window.electronAPI.getOrdenDetalle(ordenId);
}

export async function crearOrdenCompra(ordenData) {
    return await window.electronAPI.crearOrdenCompra(ordenData);
}

export async function recibirOrden(ordenId, itemsModificados) {
    return await window.electronAPI.recibirOrden(ordenId, itemsModificados);
}

export async function addOrdenCompra(ordenData) {
    return await window.electronAPI.addOrdenCompra(ordenData);
}

export async function updateOrdenCompleta(id, ordenData) {
    return await window.electronAPI.updateOrdenCompleta(id, ordenData);
}

export async function updateOrdenCompra(id, datos) {
    return await window.electronAPI.updateOrdenCompra(id, datos);
}

export async function deleteOrdenCompra(id) {
    return await window.electronAPI.deleteOrdenCompra(id);
}

// ============================================
// REPORTES
// ============================================
export async function getHistorialVentas() {
    return await window.electronAPI.getHistorialVentas();
}

export async function getTotalesReportes() {
    return await window.electronAPI.getTotalesReportes();
}

// ============================================
// CLIENTES
// ============================================
export async function getClientes() {
    return await window.electronAPI.getClientes();
}
export async function addCliente(cliente) {
    return await window.electronAPI.addCliente(cliente);
}
export async function abonarDeudaCliente(datosAbono) {
    return await window.electronAPI.abonarDeudaCliente(datosAbono);
}
export async function asignarDeuda(data) {
    return await window.electronAPI.asignarDeuda(data);
}