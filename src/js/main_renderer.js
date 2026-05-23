import { inyectarEstilosGlobales, loadPlaceholder, mostrarNotificacion} from './ui.js';
import { cargarDatosIniciales } from './init.js';
import { loadProductos, cargarProductos, mostrarFormularioProducto } from './productos.js';
import { loadVentas } from './ventas.js';
import { loadDashboard } from './dashboard.js';
import { loadReportes } from './reportes.js';
import { loadCompras } from './compras.js';
import { loadClientes } from './clientes.js';
import { setUsuarioActual, usuarioActual } from './state.js';
import { validarLogin } from './database.js';
import { loadConfiguracion } from './configuracion.js';
// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    inyectarEstilosGlobales();
    
    if (window.electronAPI) {
        mostrarPantallaLogin(); // ¡Epa! Primero el login, mijo.
    }
});
function mostrarPantallaLogin() {
    const body = document.body;
    
    // 1. EL HTML: Le metimos la X de cerrar y el botón del ojito
    const loginHTML = `
        <div id="login-overlay" class="login-overlay">
            <div class="login-card" style="position: relative;">
                
                <button id="btn-cerrar-app" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">
                    ✖
                </button>

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
                        <button id="btn-ver-clave" class="btn btn-secondary" style="padding: 0 10px; cursor: pointer;" type="button" title="Mostrar/Ocultar">
                            👁️
                        </button>
                    </div>
                </div>
                
                <button id="btn-login" class="btn btn-primary" style="width:100%; margin-top:10px;">
                    Entrar
                </button>
            </div>
        </div>
    `;

    body.insertAdjacentHTML('beforeend', loginHTML);

    // 2. BUSCAMOS LOS ELEMENTOS NUEVOS
    const botonLogin = document.getElementById('btn-login');
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-pass');
    const btnCerrarApp = document.getElementById('btn-cerrar-app');
    const btnVerClave = document.getElementById('btn-ver-clave');

    // 3. EVENTO: CERRAR APLICACIÓN
    if (btnCerrarApp) {
        btnCerrarApp.addEventListener('click', () => {
            // Llamamos a la función que ya tenés en preload.js
            window.electronAPI.closeWindow(); 
        });
    }

    // 4. EVENTO: MOSTRAR/OCULTAR CONTRASEÑA
    if (btnVerClave) {
        btnVerClave.addEventListener('click', () => {
            if (passInput.type === 'password') {
                passInput.type = 'text';
                btnVerClave.textContent = '🙈'; // Cambiamos el icono para que sepa que está visible
            } else {
                passInput.type = 'password';
                btnVerClave.textContent = '👁️';
            }
        });
    }

    // 5. EVENTO: PRESIONAR 'ENTER' PARA ENTRAR
    const entrarConEnter = (evento) => {
        if (evento.key === 'Enter') {
            botonLogin.click(); // Es como si el usuario le diera clic al botón azul
        }
    };
    
    // Se lo ponemos a los dos por si le dan enter desde el usuario o desde la clave
    userInput.addEventListener('keyup', entrarConEnter);
    passInput.addEventListener('keyup', entrarConEnter);

    // 6. EL LOGIN NORMALITO QUE YA TENÍAS (Sin las llaves en validarLogin)
    if (botonLogin) {
        botonLogin.addEventListener('click', async () => {
            const user = userInput.value.trim();
            const pass = passInput.value.trim();

            if (!user || !pass) {
                return mostrarNotificacion('Por favor, completa todos los campos', 'error');
            }

            try {
                // Recordá: SIN LLAVES, tal cual como lo arreglamos
                const res = await validarLogin(user, pass); 
                
                if (res.success) {
                    setUsuarioActual(res.usuario);
                    localStorage.setItem('rol', res.usuario.rol);
                    document.getElementById('login-overlay').remove();
                    
                    // ¡Importante para los permisos del vendedor!
                    if (typeof aplicarPermisos === 'function') aplicarPermisos();

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

            // 2. EL BLOQUEO
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
                case 'compras':
                    loadCompras();
                    break;
                case 'reportes':
                    loadReportes();
                    break;
                case 'clientes':
                    loadClientes();
                    break;
                case 'config':         
                    loadConfiguracion();
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