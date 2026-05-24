// config.js - Módulo de configuración (UNIFICADO)

import { configuracion, setConfiguracion } from './state.js';
import { getConfiguracion, updateTasaBCV, updateConfig, getVersions } from './database.js';
import { mostrarNotificacion } from './ui.js';

export async function loadConfig() {
    const content = document.getElementById('page-content');
    if (!content) return;

    // Validar si es admin para mostrar la sección de seguridad
    const rolActual = localStorage.getItem('rol') || 'usuario'; 
    const esAdmin = rolActual === 'admin';

    // Obtener datos actuales
    const config = await getConfiguracion();
    const tasaActual = config.tasa_bcv_actual || 50.00;
    const nombreNegocio = config.nombre_negocio || 'Mi Negocio';
    const rif = config.rif || '';
    const pagoMovilInfo = config.pago_movil_info || '';
    const tema = config.tema || 'claro';
    const colorPrimario = config.color_primario || '#2563eb';

    // Obtener lista de backups (simplificada)
    const backups = await obtenerListaBackups();

    const versions = await getVersions();

    let html = `
        <h2>⚙️ Configuración del Sistema</h2>
        
        <div class="config-section">
            <h3>🏪 Datos del Negocio</h3>
            <div class="form-group">
                <label>Nombre del negocio:</label>
                <input type="text" id="config-nombre" class="form-control" value="${escapeHtml(nombreNegocio)}">
            </div>
            <div class="form-group">
                <label>RIF:</label>
                <input type="text" id="config-rif" class="form-control" value="${escapeHtml(rif)}">
            </div>
            <div class="form-group">
                <label>Información de Pago Móvil (teléfono, banco, cuenta):</label>
                <textarea id="config-pago-movil" class="form-control" rows="2">${escapeHtml(pagoMovilInfo)}</textarea>
                <small>Ejemplo: 0414-1234567, Banco Mercantil, Cuenta 000123456</small>
            </div>
            <button class="btn btn-primary" id="btn-guardar-negocio">Guardar Datos del Negocio</button>
        </div>

        <div class="config-section">
            <h3>🎨 Apariencia</h3>
            <div class="form-group">
                <label>Tema:</label>
                <select id="config-tema" class="form-control">
                    <option value="claro" ${tema === 'claro' ? 'selected' : ''}>Claro</option>
                    <option value="oscuro" ${tema === 'oscuro' ? 'selected' : ''}>Oscuro</option>
                </select>
            </div>
            <div class="form-group">
                <label>Color principal (para botones y acentos):</label>
                <input type="color" id="config-color-primario" value="${colorPrimario}" class="form-control" style="width: 80px; height: 40px;">
            </div>
            <button class="btn btn-primary" id="btn-guardar-apariencia">Guardar Apariencia</button>
        </div>

        <div class="config-section">
            <h3>💾 Copias de Seguridad</h3>
            <button class="btn btn-success" id="btn-backup-manual">➕ Crear Backup Ahora</button>
            ${backups.length === 0 ? '<p style="margin-top: 10px;">No hay backups disponibles.</p>' : `
                <div style="margin-top: 15px;">
                    <h4>Backups existentes:</h4>
                    <ul>
                        ${backups.map(b => `<li>${b.nombre} (${b.fecha}) - <button class="btn-restaurar" data-path="${b.ruta}">Restaurar</button> <button class="btn-eliminar-backup" data-path="${b.ruta}">Eliminar</button></li>`).join('')}
                    </ul>
                </div>
            `}
        </div>
    `;

    // -----------------------------------------------------------
    // INYECCIÓN DE LA SECCIÓN DE SEGURIDAD (SOLO ADMIN)
    // -----------------------------------------------------------
    if (esAdmin) {
        html += `
            <div class="card config-section" style="border-left: 5px solid #dc2626; background: var(--surface-color); border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 20px;">
                <div class="card-content">
                    <div style="margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: var(--text-color);"><i class="fas fa-shield-alt"></i> Seguridad y Accesos</h3>
                        <p style="color: #64748b; margin: 0;">Desde aquí podéis cambiar los usuarios y contraseñas. ¡Mosca con olvidar estos datos!</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <!-- Formulario del Administrador -->
                        <div style="background: var(--bg-color); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <h4 style="margin-top: 0; color: var(--text-color);"><i class="fas fa-user-tie"></i> Credenciales del Dueño</h4>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">Nuevo Usuario Admin:</label>
                                <input type="text" id="admin-user-input" class="form-control" style="width: 100%; padding: 8px; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">Nueva Clave Admin:</label>
                                <input type="password" id="admin-pass-input" class="form-control" style="width: 100%; padding: 8px; border-radius: 5px;">
                            </div>
                            <button id="btn-update-admin" class="btn btn-primary" style="width: 100%; padding: 10px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                <i class="fas fa-save"></i> Actualizar Dueño
                            </button>
                        </div>

                        <!-- Formulario del Vendedor -->
                        <div style="background: var(--bg-color); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <h4 style="margin-top: 0; color: var(--text-color);"><i class="fas fa-user"></i> Credenciales del Cajero</h4>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">Nuevo Usuario Vendedor:</label>
                                <input type="text" id="vend-user-input" class="form-control" style="width: 100%; padding: 8px; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">Nueva Clave Vendedor:</label>
                                <input type="password" id="vend-pass-input" class="form-control" style="width: 100%; padding: 8px; border-radius: 5px;">
                            </div>
                            <button id="btn-update-vendedor" class="btn" style="background-color: #059669; color: white; width: 100%; padding: 10px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                <i class="fas fa-save"></i> Actualizar Cajero
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // -----------------------------------------------------------
    // BOTÓN FLOTANTE DE CERRAR SESIÓN
    // -----------------------------------------------------------
    html += `
            <button id="btn-cerrar-sesion" style="
                position: fixed; 
                bottom: 30px; 
                right: 30px; 
                background-color: #2563eb; 
                color: white; 
                border: none; 
                border-radius: 50px; 
                padding: 15px 25px; 
                font-weight: bold; 
                font-size: 15px; 
                cursor: pointer; 
                display: flex; 
                align-items: center; 
                gap: 10px; 
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); 
                transition: transform 0.2s, background 0.2s;
                z-index: 1000;">
                <i class="fas fa-sign-out-alt" style="font-size: 18px;"></i> Cerrar Sesión
            </button>
    `;

    content.innerHTML = html;

    // ============================================
    // EVENTOS
    // ============================================
    document.getElementById('btn-guardar-negocio').addEventListener('click', guardarDatosNegocio);
    document.getElementById('btn-guardar-apariencia').addEventListener('click', guardarApariencia);
    document.getElementById('btn-backup-manual').addEventListener('click', crearBackupManual);

    document.querySelectorAll('.btn-restaurar').forEach(btn => {
        btn.addEventListener('click', () => restaurarBackup(btn.dataset.path));
    });
    document.querySelectorAll('.btn-eliminar-backup').forEach(btn => {
        btn.addEventListener('click', () => eliminarBackup(btn.dataset.path));
    });

    // Eventos de Seguridad
    if (esAdmin) {
        document.getElementById('btn-update-admin').addEventListener('click', () => guardarCredenciales('admin'));
        document.getElementById('btn-update-vendedor').addEventListener('click', () => guardarCredenciales('vendedor'));
    }

    // Evento Cerrar Sesión
    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            const confirmar = confirm("¿Estáis seguro que queréis cerrar la sesión?");
            if (confirmar) {
                localStorage.removeItem('rol');
                window.location.reload();
            }
        });
        btnCerrar.addEventListener('mouseenter', () => btnCerrar.style.transform = 'scale(1.05)');
        btnCerrar.addEventListener('mouseleave', () => btnCerrar.style.transform = 'scale(1)');
    }
}

// ============================================
// FUNCIONES DE SEGURIDAD (NUEVAS)
// ============================================
async function guardarCredenciales(rol) {
    const isAdmin = rol === 'admin';
    const userEl = document.getElementById(isAdmin ? 'admin-user-input' : 'vend-user-input');
    const passEl = document.getElementById(isAdmin ? 'admin-pass-input' : 'vend-pass-input');

    const nuevoUsuario = userEl.value.trim();
    const nuevaClave = passEl.value.trim();

    if (!nuevoUsuario || !nuevaClave) {
        mostrarNotificacion('¡Vergación! Tenéis que llenar usuario y clave pa\' poder guardar.', 'warning');
        return;
    }

    const confirmar = confirm(`¿Estáis seguro de cambiar los datos del ${rol}?`);
    if (!confirmar) return;

    try {
        const res = await window.electronAPI.updateCredenciales({
            rol: rol,
            nuevoUsuario: nuevoUsuario,
            nuevaClave: nuevaClave
        });

        if (res.success) {
            mostrarNotificacion(`¡Molleja de bien! Los datos se actualizaron al pelo.`, 'success');
            userEl.value = '';
            passEl.value = '';
        } else {
            mostrarNotificacion(`Hubo un rollo: ${res.message}`, 'error');
        }
    } catch (error) {
        console.error("Error cambiando clave:", error);
        mostrarNotificacion('Se escoñetó la conexión con la base de datos.', 'error');
    }
}

// ============================================
// FUNCIONES AUXILIARES (ORIGINALES INTACTAS)
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function obtenerListaBackups() {
    const lista = await window.electronAPI.listarBackups();
    return lista.map(b => ({
        nombre: b.nombre,
        ruta: b.ruta,
        fecha: new Date(b.fecha).toLocaleString(),
        tamano: (b.tamano / 1024 / 1024).toFixed(2) + ' MB'
    }));
}

async function obtenerVersionApp() {
    return await window.electronAPI.getAppVersion() || '1.0.0';
}

async function guardarDatosNegocio() {
    const nombre = document.getElementById('config-nombre').value.trim();
    const rif = document.getElementById('config-rif').value.trim();
    const pagoMovil = document.getElementById('config-pago-movil').value.trim();
    if (!nombre) return mostrarNotificacion('El nombre no puede estar vacío', 'error');
    await updateConfig({ nombre_negocio: nombre, rif, pago_movil_info: pagoMovil });
    setConfiguracion({ ...configuracion, nombre_negocio: nombre, rif, pago_movil_info: pagoMovil });
    mostrarNotificacion('Datos del negocio actualizados');
}

async function actualizarTasa() {
    const nuevaTasa = parseFloat(document.getElementById('nueva-tasa').value);
    if (isNaN(nuevaTasa) || nuevaTasa <= 0) return mostrarNotificacion('Tasa inválida', 'error');
    await updateTasaBCV(nuevaTasa);
    setConfiguracion({ ...configuracion, tasa_bcv: nuevaTasa });
    document.getElementById('tasa-actual').textContent = nuevaTasa.toFixed(2) + ' Bs/$';
    document.getElementById('nueva-tasa').value = '';
    mostrarNotificacion('Tasa actualizada');
}

async function guardarApariencia() {
    const tema = document.getElementById('config-tema').value;
    const colorPrimario = document.getElementById('config-color-primario').value;
    await updateConfig({ tema, color_primario: colorPrimario });
    setConfiguracion({ ...configuracion, tema, color_primario: colorPrimario });
    aplicarTemaYColor(tema, colorPrimario);
    mostrarNotificacion('Apariencia actualizada');
}

async function crearBackupManual() {
    const resultado = await window.electronAPI.realizarBackup();
    if (resultado.success) {
        mostrarNotificacion('Backup creado correctamente');
        loadConfig(); // recargar página para actualizar lista
    } else {
        mostrarNotificacion('Error al crear backup', 'error');
    }
}

async function restaurarBackup(ruta) {
    if (confirm('¿Restaurar este backup? Se perderán los cambios actuales.')) {
        const resultado = await window.electronAPI.restaurarBackup(ruta);
        if (resultado.success) {
            mostrarNotificacion('Backup restaurado. La aplicación se cerrará.');
            setTimeout(() => window.electronAPI.closeWindow(), 2000);
        } else {
            mostrarNotificacion('Error al restaurar', 'error');
        }
    }
}

async function eliminarBackup(ruta) {
    if (confirm('¿Eliminar este backup permanentemente?')) {
        const resultado = await window.electronAPI.eliminarBackup(ruta);
        if (resultado.success) {
            mostrarNotificacion('Backup eliminado');
            loadConfig();
        } else {
            mostrarNotificacion('Error al eliminar', 'error');
        }
    }
}

// Función global para aplicar tema y color (se llama al inicio y al guardar)
export function aplicarTemaYColor(tema, colorPrimario) {
    const body = document.body;
    body.classList.remove('tema-claro', 'tema-oscuro');
    body.classList.add(`tema-${tema}`);
    body.style.setProperty('--color-primario', colorPrimario);
    
    const styleId = 'tema-dinamico';
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    
    style.textContent = `
        /* ===== VARIABLES GLOBALES ===== */
        .tema-claro {
            --bg-color: #f8fafc;
            --surface-color: #ffffff;
            --text-color: #1e293b;
            --border-color: #e2e8f0;
            --input-bg: #ffffff;
            --input-text: #1e293b;
            --sidebar-bg: #ffffff;
            --sidebar-text: #334155;
            --sidebar-hover: #f1f5f9;
            --sidebar-active: #eff6ff;
        }
        .tema-oscuro {
            --bg-color: #0f172a;
            --surface-color: #1e293b;
            --text-color: #e2e8f0;
            --border-color: #334155;
            --input-bg: #0f172a;
            --input-text: #e2e8f0;
            --sidebar-bg: #111827;
            --sidebar-text: #cbd5e1;
            --sidebar-hover: #1f2937;
            --sidebar-active: #1e3a8a;
        }
        
        /* Aplicación base */
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
        }
        .sidebar {
            background-color: var(--sidebar-bg);
            border-right-color: var(--border-color);
        }
        .sidebar .logo, .sidebar .user-info {
            color: var(--sidebar-text);
        }
        .nav-item {
            color: var(--sidebar-text);
        }
        .nav-item:hover {
            background-color: var(--sidebar-hover);
            color: var(--color-primario);
        }
        .nav-item.active {
            background-color: var(--sidebar-active);
            color: var(--color-primario);
            border-left-color: var(--color-primario);
        }
        
        /* ===== COMPONENTES GENERALES ===== */
        .card, .dashboard-card, .config-section, .productos-table-container,
        .recent-products, .quick-actions, .modal-content, .filtros-productos,
        .panel-productos, .panel-carrito, .ventas-container, .reportes-container,
        .historial-ventas, .table-container, .producto-venta-card, .presentacion-card,
        .cliente-info, .carrito-items, .metodos-pago, .selector-cliente-container,
        .stock-bajo-section, .dashboard-simple .dashboard-card {
            background-color: var(--surface-color) !important;
            color: var(--text-color) !important;
            border-color: var(--border-color) !important;
        }
        
        /* El div que modificaste en ventas (con estilo en línea) también usará la variable */
        .ventas-container > div[style*="background"] {
            background-color: var(--surface-color) !important;
        }
        
        /* Tablas */
        .productos-table, .productos-table th, .productos-table td,
        .reportes-table, .reportes-table th, .reportes-table td {
            background-color: var(--surface-color) !important;
            color: var(--text-color) !important;
            border-color: var(--border-color) !important;
        }
        
        /* Formularios e inputs */
        .filtros-productos input, .filtros-productos select,
        .form-control, input:not([type="color"]), select, textarea {
            background-color: var(--input-bg) !important;
            color: var(--input-text) !important;
            border-color: var(--border-color) !important;
        }
        
        /* Botones secundarios */
        .btn-secondary, .btn-outline {
            background-color: #334155 !important;
            color: #e2e8f0 !important;
            border-color: #475569 !important;
        }
        
        /* Textos */
        .card-content h3, .card-content .card-value, .card-content small,
        .dashboard-card .card-content h3, .dashboard-card .card-value,
        .cliente-info span, .cliente-info strong,
        h1, h2, h3, h4, .producto-nombre, .producto-precio,
        .carrito-item-subtotal, .stock-bajo-nombre, .stock-bajo-cantidad {
            color: var(--text-color) !important;
        }
        
        /* Ajustes de acciones rápidas */
        .action-btn {
            background: var(--surface-color) !important;
            border-color: var(--border-color) !important;
            color: var(--text-color) !important;
        }
        .action-btn:hover {
            background: var(--sidebar-hover) !important;
        }
        
        /* Íconos de colores en modo oscuro */
        .tema-oscuro .card-primary .card-icon,
        .tema-oscuro .dashboard-card .card-primary .card-icon {
            background: #1e40af !important;
            color: #93c5fd !important;
        }
        .tema-oscuro .card-warning .card-icon,
        .tema-oscuro .dashboard-card .card-warning .card-icon {
            background: #78350f !important;
            color: #fcd34d !important;
        }
        .tema-oscuro .stock-bajo-section h3 {
            color: #f87171 !important;
        }
        .tema-oscuro .stock-bajo-item {
            background: #451a1a !important;
            border-left-color: #ef4444 !important;
        }
        .tema-oscuro .stock-bajo-nombre {
            color: #fca5a5 !important;
        }
        .tema-oscuro .stock-bajo-cantidad {
            color: #f87171 !important;
        }
        
        /* Bordes y detalles */
        .dashboard-card, .card, .ventas-container, .panel-productos, .panel-carrito {
            border: 1px solid var(--border-color);
        }
    `;
}