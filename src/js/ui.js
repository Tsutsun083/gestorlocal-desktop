// ui.js - Componentes de interfaz reutilizables

import { configuracion, setConfiguracion } from './state.js';
import { updateTasaBCV } from './database.js';
import { loadDashboard } from './dashboard.js';
import { loadProductos } from './productos.js';

// ============================================
// MODALES
// ============================================

// Cierra todos los modales abiertos
export function cerrarTodosLosModales() {
    document.querySelectorAll('.modal').forEach(modal => modal.remove());
}

// Crea un modal básico con título y contenido
export function crearModal(titulo, contenidoHTML, ancho = '500px') {
    cerrarTodosLosModales();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: ${ancho}; max-width: 90%;">
            <h3>${titulo}</h3>
            ${contenidoHTML}
        </div>
    `;
    
    // Cerrar con Escape
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') modal.remove();
    });
    
    document.body.appendChild(modal);
    return modal;
}

// ============================================
// NOTIFICACIONES (TOASTS)
// ============================================
export function mostrarNotificacion(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${tipo === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    // Añadir animación si no existe
    if (!document.querySelector('#toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// MODAL DE TASA BCV
// ============================================
export function mostrarModalTasa() {
    cerrarTodosLosModales();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-tipo', 'tasa');
    
    modal.innerHTML = `
        <div class="modal-content" style="width: 400px;">
            <h3>💰 Actualizar Tasa BCV</h3>
            <p>Tasa actual: <strong>${configuracion.tasa_bcv.toFixed(2)} Bs/$</strong></p>
            
            <div class="form-group">
                <label>Nueva tasa:</label>
                <input type="number" id="nueva-tasa" step="0.01" min="1" 
                       value="${configuracion.tasa_bcv}" class="form-control" autofocus>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" id="cancelar-tasa">Cancelar</button>
                <button class="btn btn-primary" id="guardar-tasa">Actualizar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cancelar-tasa').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.getElementById('guardar-tasa').addEventListener('click', async () => {
        const nuevaTasa = parseFloat(document.getElementById('nueva-tasa').value);
        
        if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
            mostrarNotificacion('⚠️ Ingrese un valor válido', 'error');
            return;
        }
        
        setConfiguracion({ ...configuracion, tasa_bcv: nuevaTasa });
        
        try {
            await updateTasaBCV(nuevaTasa);
            mostrarNotificacion('✅ Tasa actualizada');
        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('❌ Error al actualizar tasa', 'error');
        }
        
        document.body.removeChild(modal);
        
        const activePage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
        if (activePage === 'dashboard') {
            await loadDashboard();
        } else if (activePage === 'productos') {
            await loadProductos();
        }
    });
    
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    });
    
    document.getElementById('nueva-tasa').focus();
}

// ============================================
// PLACEHOLDER PARA PÁGINAS NO IMPLEMENTADAS
// ============================================
export function loadPlaceholder(page, title) {
    const content = document.getElementById('page-content');
    if (content) {
        content.innerHTML = `
            <div class="coming-soon">
                <i class="fas fa-tools" style="font-size:64px; color:#666;"></i>
                <h2>${title}</h2>
                <p>Sección en desarrollo</p>
            </div>
        `;
    }
}

// ============================================
// ESTILOS GLOBALES (los que estaban al final)
// ============================================
export function inyectarEstilosGlobales() {
    const style = document.createElement('style');
    style.textContent = `
        /* ========== ESTILOS GENERALES ========== */
        .quick-actions { background: white; border-radius: 12px; padding: 25px; margin-top: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .action-btn { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
        .action-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
        .action-btn i { font-size: 28px; color: #2563eb; }
        
        .recent-products { background: white; border-radius: 12px; padding: 25px; margin-top: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .product-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .product-row:last-child { border-bottom: none; }
        .product-price { font-weight: bold; color: #2563eb; }
        
        .productos-table-container { background: white; border-radius: 8px; overflow: auto; max-height: 500px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .productos-table { width: 100%; border-collapse: collapse; }
        .productos-table th { background: #f1f5f9; padding: 12px; text-align: left; position: sticky; top: 0; }
        .productos-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        
        .stock-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .stock-normal { background: #dcfce7; color: #16a34a; }
        .stock-bajo { background: #fee2e2; color: #dc2626; }
        
        .btn-icon { background: none; border: none; cursor: pointer; padding: 5px 10px; border-radius: 4px; }
        .btn-edit { color: #2563eb; }
        .btn-delete { color: #dc2626; }
        .btn-icon:hover { background: #f1f5f9; }
        
        /* Modales */
        .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 12px; padding: 25px; max-height: 90%; overflow-y: auto; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
        .form-control { width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 14px; }
        .form-control:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .coming-soon { text-align: center; padding: 80px 20px; background: white; border-radius: 12px; }
        .form-row { display: flex; gap: 15px; margin-bottom: 15px; }
        .form-row .form-group { flex: 1; }
        
        /* Dashboard cards */
        .card-info .card-icon { background: #cffafe; color: #0891b2; }
    `;
    document.head.appendChild(style);
}