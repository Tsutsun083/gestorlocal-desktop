// state.js - Estado global y funciones auxiliares

// ============================================
// ESTADO GLOBAL
// ============================================
export let configuracion = { 
    tasa_bcv: 50.00,
    nombre_egocio: 'Mi Negocio'
};

export let categorias = [];
export let productos = [];
export let carritoVentas = [];

// ============================================
// FUNCIONES DE ACTUALIZACIÓN DE ESTADO
// ============================================
export function setConfiguracion(nuevaConfig) {
    configuracion = { ...configuracion, ...nuevaConfig };
}

export function setCategorias(nuevasCategorias) {
    categorias = nuevasCategorias;
}

export function setProductos(nuevosProductos) {
    productos = nuevosProductos;
}

export function setCarritoVentas(nuevoCarrito) {
    carritoVentas = nuevoCarrito;
}

// ============================================
// FUNCIONES AUXILIARES (PURAS)
// ============================================

// Calcular precio en Bs (no depende del DOM, solo del estado)
export function calcularPrecioBs(producto) {
    if (!producto) return 0;
    if (!producto.usar_calculo_automatico && producto.precio_manual_bs) {
        return producto.precio_manual_bs;
    }
    const precioUSD = producto.precio_base_usd || 0;
    const margen = producto.margen_sugerido || 30;
    const tasa = configuracion.tasa_bcv || 50;
    return Math.round(precioUSD * (1 + margen/100) * tasa);
}

// Redondear cantidad a 3 decimales (útil en ventas)
export function redondearCantidad(cantidad) {
    return Math.round(cantidad * 1000) / 1000;
}