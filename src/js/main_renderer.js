// main.renderer.js - Punto de entrada principal

import { inyectarEstilosGlobales, loadPlaceholder } from './ui.js';
import { cargarDatosIniciales } from './init.js';
import { loadProductos, cargarProductos, mostrarFormularioProducto } from './productos.js';
import { loadVentas } from './ventas.js';
import { loadDashboard } from './dashboard.js';

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ GestorLocal cargado (modular)');
    
    inyectarEstilosGlobales();
    
    if (window.electronAPI) {
        try {
            await cargarDatosIniciales();
            setupNavigation();
            setupButtons();
            loadDashboard();
        } catch (error) {
            console.error('Error inicializando:', error);
        }
    } else {
        console.warn('⚠️ electronAPI no disponible');
    }
});

// ============================================
// NAVEGACIÓN
// ============================================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const page = this.getAttribute('data-page');
            const titles = {
                'dashboard': 'Dashboard',
                'productos': 'Gestión de Productos',
                'ventas': 'Punto de Venta',
                'reportes': 'Reportes',
                'config': 'Configuración'
            };
            
            document.getElementById('page-title').textContent = titles[page];
            
            switch(page) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'productos':
                    loadProductos();
                    break;
                case 'ventas':
                    loadVentas();
                    break;
                default:
                    loadPlaceholder(page, titles[page]);
            }
        });
    });
}

// ============================================
// BOTONES PRINCIPALES (fuera de las páginas)
// ============================================
function setupButtons() {
    document.getElementById('btn-nueva-venta')?.addEventListener('click', () => {
        document.querySelector('[data-page="ventas"]').click();
    });
    
    document.getElementById('btn-actualizar')?.addEventListener('click', async () => {
        // Recargar productos desde la BD
        await cargarProductos();
        const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
        if (activePage === 'dashboard') {
            loadDashboard();
        } else if (activePage === 'productos') {
            loadProductos();
        }
    });
}