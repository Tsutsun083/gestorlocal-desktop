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