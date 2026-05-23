import { inyectarEstilosGlobales, loadPlaceholder, mostrarNotificacion, mostrarModalTasa } from './ui.js';
import { cargarDatosIniciales } from './init.js';
import { loadProductos, mostrarFormularioProducto, } from './productos.js';
import { loadVentas } from './ventas.js';
import { loadDashboard } from './dashboard.js';
import { loadReportes } from './reportes.js';
import { loadCompras } from './compras.js';
import { loadClientes } from './clientes.js';
import { setUsuarioActual, usuarioActual, configuracion, setConfiguracion } from './state.js';
import { validarLogin } from './database.js';
import { loadConfiguracion } from './configuracion.js';import { aplicarTemaYColor, loadConfig } from './config.js';

// ============================================
// ATALOS DE TECLADO
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F2' || e.key === 'F3' || e.key === 'F4') {
            e.preventDefault();
        }

        switch (e.key) {
            case 'F2': // Nueva venta
                const ventasNav = document.querySelector('[data-page="ventas"]');
                if (ventasNav) ventasNav.click();
                break;
            case 'F3': // Nuevo producto
                const productosNav = document.querySelector('[data-page="productos"]');
                if (productosNav) {
                    productosNav.click();
                    setTimeout(() => {
                        if (typeof mostrarFormularioProducto === 'function') {
                            mostrarFormularioProducto();
                        }
                    }, 200);
                }
                break;
            case 'F4': // Actualizar tasa BCV
                if (typeof mostrarModalTasa === 'function') {
                    mostrarModalTasa();
                } else {
                    const tasaCard = document.getElementById('tasa-card');
                    if (tasaCard) tasaCard.click();
                }
                break;
        }
    });
}

// ============================================
// APLICAR PERMISOS SEGÚN ROL
// ============================================
function aplicarPermisos() {
    const rol = usuarioActual?.rol;
    if (rol === 'vendedor') {
        const prohibidos = ['[data-page="compras"]', '[data-page="reportes"]'];
        prohibidos.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'none';
        });
        // Redirigir a ventas si estaba en dashboard o productos
        const activePage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
        if (activePage === 'dashboard' || activePage === 'productos') {
            document.querySelector('[data-page="ventas"]')?.click();
        }
    }
}

// ============================================
// PANTALLA DE LOGIN (integrada)
// ============================================
async function mostrarPantallaLogin() {
    return new Promise((resolve) => {
        const body = document.body;
        const loginHTML = `
            <div id="login-overlay" class="login-overlay">
                <div class="login-card" style="position: relative;">
                    <button id="btn-cerrar-app" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✖</button>
                    <h2>🔐 GestorLocal</h2>
                    <p>¡Bienvenido! por favor, identificate.</p>
                    <div class="form-group">
                        <label>Usuario</label>
                        <input type="text" id="login-user" class="form-control" placeholder="Ej: admin">
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="password" id="login-pass" class="form-control" style="flex: 1;">
                            <button id="btn-ver-clave" class="btn btn-secondary" style="padding: 0 10px; cursor: pointer;" type="button" title="Mostrar/Ocultar">👁️</button>
                        </div>
                    </div>
                    <button id="btn-login" class="btn btn-primary" style="width:100%; margin-top:10px;">Entrar</button>
                </div>
            </div>
        `;
        body.insertAdjacentHTML('beforeend', loginHTML);

        const botonLogin = document.getElementById('btn-login');
        const userInput = document.getElementById('login-user');
        const passInput = document.getElementById('login-pass');
        const btnCerrarApp = document.getElementById('btn-cerrar-app');
        const btnVerClave = document.getElementById('btn-ver-clave');

        if (btnCerrarApp) {
            btnCerrarApp.addEventListener('click', () => window.electronAPI.closeWindow());
        }
        if (btnVerClave) {
            btnVerClave.addEventListener('click', () => {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    btnVerClave.textContent = '🙈';
                } else {
                    passInput.type = 'password';
                    btnVerClave.textContent = '👁️';
                }
            });
        }
        const entrarConEnter = (evento) => {
            if (evento.key === 'Enter') botonLogin.click();
        };
        userInput.addEventListener('keyup', entrarConEnter);
        passInput.addEventListener('keyup', entrarConEnter);

        botonLogin.addEventListener('click', async () => {
            const user = userInput.value.trim();
            const pass = passInput.value.trim();
            if (!user || !pass) {
                return mostrarNotificacion('Por favor, completa todos los campos', 'error');
            }
            try {
                const res = await validarLogin(user, pass);
                if (res.success) {
                    setUsuarioActual(res.usuario);
                    localStorage.setItem('rol', res.usuario.rol);
                    document.getElementById('login-overlay').remove();
                    await cargarDatosIniciales();
                    if (typeof setupNavigation === 'function') setupNavigation();
                    if (typeof setupButtons === 'function') setupButtons();
                    if (typeof loadDashboard === 'function') loadDashboard();
                    
                    mostrarNotificacion(`¡Bienvenido, ${res.usuario.username}! Entraste sin problemas.`);
                } else {
                    mostrarNotificacion('Usuario o clave incorrectos', 'error');
                }
            } catch (error) {
                console.error(error);
                mostrarNotificacion('Error al intentar iniciar sesión', 'error');
            }
        });
    }
    
    // Un toque pa' que arranque con el cursor en el campo de usuario de una vez
    userInput.focus();
}
function aplicarPermisos() {
            const rol = usuarioActual?.rol;
    
            if (rol === 'vendedor') {
             // Seleccionamos los items del menú que el vendedor NO debe ver
             const prohibidos = [
                '[data-page="compras"]',
                '[data-page="reportes"]',
            ];

            prohibidos.forEach(selector => {
            const el = document.querySelector(selector);
                if (el) el.style.display = 'none'; // ¡Pa' fuera!
            });

            // Si por casualidad el sistema intenta cargarlo en el dashboard, 
            // lo mandamos directo a ventas
            loadVentas(); 
            document.querySelector('[data-page="ventas"]')?.classList.add('active');
            }
        userInput.focus();
    });
}
// ============================================
// NAVEGACIÓN
// ============================================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            const rol = usuarioActual?.rol;
            if (rol === 'vendedor' && (page === 'compras' || page === 'reportes')) {
                mostrarNotificacion('No tienes permiso para entrar ahí.', 'error');
                return;
            }
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const titles = {
                'dashboard': 'Dashboard',
                'productos': 'Gestión de Productos',
                'ventas': 'Punto de Venta',
                'reportes': 'Reportes',
                'config': 'Configuración',
                'compras': 'Compras',
                'clientes': 'Clientes'
            }; 

            document.getElementById('page-title').textContent = titles[page];
            switch(page) {
                case 'dashboard': loadDashboard(); break;
                case 'productos': loadProductos(); break;
                case 'ventas': loadVentas(); break;
                case 'compras': loadCompras(); break;
                case 'reportes': loadReportes(); break;
                case 'clientes': loadClientes(); break;
                case 'config': loadConfig(); break;
                case 'config':         
                    loadConfiguracion();
                    break;
                default: loadPlaceholder(page, titles[page]);
            }
        });
    });
}

// ============================================
// BOTONES PRINCIPALES
// ============================================
function setupButtons() {
    document.getElementById('btn-nueva-venta')?.addEventListener('click', () => {
        document.querySelector('[data-page="ventas"]')?.click();
    });
    document.getElementById('btn-actualizar')?.addEventListener('click', async () => {
        if (typeof cargarProductos === 'function') await cargarProductos();
        const activePage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
        if (activePage === 'dashboard') {
            loadDashboard();
        } else if (activePage === 'productos') {
            loadProductos();
        }
    });
}

// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    inyectarEstilosGlobales();
    setupKeyboardShortcuts();

    if (!window.electronAPI) {
        console.warn('⚠️ electronAPI no disponible');
        return;
    }

    await mostrarPantallaLogin(); // Login y carga de datos iniciales (dentro debe actualizar configuracion)

    // Aplicar tema después de que configuracion esté cargada
    const tema = configuracion.tema || 'claro';
    const colorPrimario = configuracion.color_primario || '#2563eb';
    aplicarTemaYColor(tema, colorPrimario);

    setupNavigation();
    setupButtons();
    loadDashboard();
});