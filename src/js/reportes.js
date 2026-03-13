// reportes.js - Módulo de estadísticas e historial
import { configuracion } from './state.js';
// Aquí importamos las funciones de database.js (ajusta los nombres según tu database.js)
import { getHistorialVentas, getTotalesReportes } from './database.js';

export async function loadReportes() {
    const content = document.getElementById('page-content');
    if (!content) return;

    // 1. Dibujamos la estructura (HTML)
    content.innerHTML = `
        <div class="reports-section">
            <div class="dashboard-grid"> <div class="card" style="border-left: 5px solid #2563eb;">
                    <div class="card-content">
                        <h3>Ventas Hoy</h3>
                        <p class="card-value" id="rep-hoy">0.00 $</p>
                    </div>
                </div>
                <div class="card" style="border-left: 5px solid #7c3aed;">
                    <div class="card-content">
                        <h3>Esta Semana</h3>
                        <p class="card-value" id="rep-semana">0.00 $</p>
                    </div>
                </div>
                <div class="card" style="border-left: 5px solid #059669;">
                    <div class="card-content">
                        <h3>Este Mes</h3>
                        <p class="card-value" id="rep-mes">0.00 $</p>
                    </div>
                </div>
            </div>

            <div class="table-container" style="background: white; border-radius: 12px; padding: 20px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3>Historial de Ventas</h3>
                    <button class="btn btn-secondary" onclick="window.print()">
                        <i class="fas fa-file-pdf"></i> Imprimir / PDF
                    </button>
                </div>
                <table class="productos-table"> <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Método</th>
                            <th>Total Bs.</th>
                            <th>Total USD.</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="lista-ventas-reporte">
                        <tr><td colspan="5" style="text-align:center;">Cargando datos...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 2. Ejecutamos la carga de datos
    actualizarCifrasReporte();
    renderizarTablaHistorial();
}

async function actualizarCifrasReporte() {
    try {
        const totales = await getTotalesReportes();
        document.getElementById('rep-hoy').innerText = `${totales.hoy.toFixed(2)} $`;
        document.getElementById('rep-semana').innerText = `${totales.semana.toFixed(2)} $`;
        document.getElementById('rep-mes').innerText = `${totales.mes.toFixed(2)} $`;
    } catch (err) {
        console.error("Error cargando totales:", err);
    }
}

async function renderizarTablaHistorial() {
    try {
        const ventas = await getHistorialVentas();
        const tbody = document.getElementById('lista-ventas-reporte');
        
        if (ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay ventas registradas</td></tr>';
            return;
        }

        tbody.innerHTML = ventas.map(v => {
            const montoBS = v.total / configuracion.tasa_bcv;
            return `
                <tr>
                    <td>${new Date(v.fecha).toLocaleString()}</td>
                    <td><span class="stock-badge stock-normal">${v.metodo_pago}</span></td>
                    <td style="font-weight: bold; color: #059669;">${v.total.toFixed(2)} $</td>
                    <td style="color: #64748b;">${montoBS.toLocaleString('es-VE')} Bs.</td>
                    <td>
                        <button class="btn-icon btn-edit"><i class="fas fa-eye"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error en tabla historial:", err);
    }
}