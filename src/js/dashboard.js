// dashboard.js - Nueva versión minimalista

import { configuracion, setConfiguracion } from './state.js';
import { getVentasDia, updateTasaBCV, getProductosStockBajo } from './database.js';
import { mostrarModalTasa } from './ui.js';

export async function loadDashboard() {
    const content = document.getElementById('page-content');
    if (!content) return;

    // Obtener ventas del día
    let ventasDia = { cantidad: 0, total: 0 };
    try {
        ventasDia = await getVentasDia();
        ventasDia = {
            cantidad: Number(ventasDia?.cantidad) || 0,
            total: Number(ventasDia?.total) || 0
        };
    } catch (error) {
        console.error('Error obteniendo ventas:', error);
    }

    // Calcular total en USD usando tasa actual
    const totalUSD = ventasDia.total / (configuracion.tasa_bcv || 1);

    // Obtener productos con stock bajo
    let stockBajo = [];
    try {
        stockBajo = await getProductosStockBajo();
    } catch (error) {
        console.error('Error obteniendo stock bajo:', error);
    }

    // Construir HTML
    content.innerHTML = `
        <div class="dashboard-simple">
            <!-- Ventas del día -->
            <div class="dashboard-card card-primary">
                <div class="card-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="card-content">
                    <h3>Ventas Hoy</h3>
                    <p class="card-value">${ventasDia.total.toLocaleString()} Bs</p>
                    <p class="card-sub">≈ ${totalUSD.toFixed(2)} USD</p>
                    <small>${ventasDia.cantidad} transacciones</small>
                </div>
            </div>

            <!-- Tasa BCV -->
            <div class="dashboard-card card-warning" id="tasa-card" style="cursor:pointer;">
                <div class="card-icon"><i class="fas fa-chart-line"></i></div>
                <div class="card-content">
                    <h3>Tasa BCV</h3>
                    <p class="card-value">${configuracion.tasa_bcv.toFixed(2)} Bs/$</p>
                    <small>Click para actualizar</small>
                </div>
            </div>
        </div>

        <!-- Productos con stock bajo -->
        <div class="stock-bajo-section">
            <h3><i class="fas fa-exclamation-triangle"></i> Productos con stock bajo</h3>
            ${stockBajo.length === 0 ? `
                <div class="stock-bajo-vacio">
                    <p>✅ No hay productos con stock bajo.</p>
                </div>
            ` : `
                <div class="stock-bajo-lista">
                    ${stockBajo.map(p => `
                        <div class="stock-bajo-item">
                            <div class="stock-bajo-nombre">${p.nombre}</div>
                            <div class="stock-bajo-cantidad">
                                Stock: ${p.stock_actual.toFixed(2)} ${p.unidad_medida}
                                <span class="stock-minimo">(mínimo: ${p.stock_minimo.toFixed(2)})</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;

    // Evento para actualizar tasa
    document.getElementById('tasa-card').addEventListener('click', () => {
        mostrarModalTasa();
    });
}