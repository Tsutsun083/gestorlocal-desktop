// dashboard.js - Funciones para el dashboard

import { configuracion, productos, setConfiguracion } from './state.js';
import { getVentasDia, updateTasaBCV } from './database.js';
import { mostrarModalTasa } from './ui.js'; // Asumiendo que pondremos el modal de tasa en ui.js

// ============================================
// DASHBOARD
// ============================================
export async function loadDashboard() {
    const content = document.getElementById('page-content');
    if (!content) return;

    let ventasDia = { cantidad: 0, total: 0 };
    try {
        ventasDia = await getVentasDia();
    } catch (error) {
        console.error('❌ Error obteniendo ventas:', error);
    }
    
    const totalProductos = productos.length;
    const stockBajo = productos.filter(p => (p.stock_actual || 0) <= (p.stock_minimo || 5)).length;
    
    content.innerHTML = `
        <div class="dashboard-grid">
            <div class="card card-primary">
                <div class="card-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="card-content">
                    <h3>Ventas Hoy</h3>
                    <p class="card-value">${ventasDia.total.toLocaleString()} Bs</p>
                    <small>${ventasDia.cantidad} transacciones - ${configuracion.nombre_negocio}</small>
                </div>
            </div>
            <div class="card card-success">
                <div class="card-icon"><i class="fas fa-boxes"></i></div>
                <div class="card-content">
                    <h3>Productos</h3>
                    <p class="card-value">${totalProductos}</p>
                    <small>Total en inventario</small>
                </div>
            </div>
            <div class="card card-warning" id="tasa-card" style="cursor:pointer;">
                <div class="card-icon"><i class="fas fa-chart-line"></i></div>
                <div class="card-content">
                    <h3>Tasa BCV</h3>
                    <p class="card-value">${configuracion.tasa_bcv.toFixed(2)} Bs/$</p>
                    <small>Click para actualizar</small>
                </div>
            </div>
            <div class="card card-info">
                <div class="card-icon"><i class="fas fa-cubes"></i></div>
                <div class="card-content">
                    <h3>Productos Activos</h3>
                    <p class="card-value">${totalProductos}</p>
                    <small>Total de productos</small>
                </div>
            </div>
        </div>
        
        <div style="text-align: right; margin: 10px 0;">
            <button class="btn btn-secondary btn-sm" id="btn-refresh-dashboard">
                <i class="fas fa-sync-alt"></i> Actualizar Datos
            </button>
        </div>
        
        <div class="quick-actions">
            <h3>Acciones Rápidas</h3>
            <div class="actions-grid">
                <button class="action-btn" id="btn-quick-producto">
                    <i class="fas fa-plus-circle"></i> <span>Nuevo Producto</span>
                </button>
                <button class="action-btn" id="btn-quick-tasa">
                    <i class="fas fa-calculator"></i> <span>Actualizar Tasa</span>
                </button>
            </div>
        </div>
        
        <div class="recent-products">
            <h3>📦 Productos con Stock</h3>
            ${productos.filter(p => (p.stock_actual || 0) > 0).slice(0, 5).map(p => {
                const precioBs = (p.precio_base_usd * (1 + (p.margen_sugerido||30)/100) * configuracion.tasa_bcv).toFixed(0);
                return `
                <div class="product-row">
                    <div>
                        <strong>${p.nombre}</strong>
                        <span style="margin-left:10px; background:#e2e8f0; padding:2px 8px; border-radius:12px; font-size:11px;">
                            ${(p.stock_actual || 0).toFixed(2)} ${p.unidad_medida}
                        </span>
                    </div>
                    <div class="product-price">${precioBs} Bs</div>
                </div>
            `}).join('')}
        </div>
    `;
    
    document.getElementById('tasa-card').addEventListener('click', () => mostrarModalTasa());
    document.getElementById('btn-quick-producto')?.addEventListener('click', () => {
        document.querySelector('[data-page="productos"]').click();
        // El click ya carga la página de productos, que a su vez puede abrir el modal si se desea
        // Podríamos agregar un flag para abrir automáticamente el formulario
    });
    document.getElementById('btn-quick-tasa')?.addEventListener('click', () => mostrarModalTasa());
    document.getElementById('btn-refresh-dashboard')?.addEventListener('click', async () => {
        await loadDashboard();
    });
}