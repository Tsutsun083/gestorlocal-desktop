//=============================
// PANTALLA DE CONFIGURACIÓN
//=============================
// configuracion.js - Módulo de configuración y seguridad
import { mostrarNotificacion } from './ui.js';

export async function loadConfiguracion() {
    const content = document.getElementById('page-content');
    if (!content) return;

    // 1. Averiguamos qué rol tiene el que está logueado
    // (Ajustá esto si guardáis el rol en sessionStorage o en otra variable global)
    const rolActual = localStorage.getItem('rol') || 'usuario'; 
    const esAdmin = rolActual === 'admin';

    // 2. Empezamos a armar la pantalla
    let htmlConfiguracion = `
        <div class="config-section" style="animation: fadeIn 0.3s ease; padding-bottom: 80px;">
            <h2 style="color: #1e293b; margin-bottom: 20px;"><i class="fas fa-cogs"></i> Configuración del Sistema</h2>
    `;

    // 3. Si es el dueño (admin), le mostramos el tarjetón de las claves
    if (esAdmin) {
        htmlConfiguracion += `
            <div class="card" style="border-left: 5px solid #dc2626; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
                <div class="card-content">
                    <div style="margin-bottom: 20px;">
                        <h3 style="margin-top: 0;"><i class="fas fa-shield-alt"></i> Seguridad y Accesos</h3>
                        <p style="color: #64748b; margin: 0;">Desde aquí podéis cambiar los usuarios y contraseñas. ¡Mosca con olvidar estos datos!</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <!-- Formulario del Administrador -->
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <h4 style="margin-top: 0; color: #1e293b;"><i class="fas fa-user-tie"></i> Credenciales del Dueño</h4>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nuevo Usuario Admin:</label>
                                <input type="text" id="admin-user-input" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nueva Clave Admin:</label>
                                <input type="password" id="admin-pass-input" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 5px;">
                            </div>
                            <button id="btn-update-admin" style="width: 100%; padding: 10px; background-color: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                <i class="fas fa-save"></i> Actualizar Dueño
                            </button>
                        </div>

                        <!-- Formulario del Vendedor -->
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <h4 style="margin-top: 0; color: #1e293b;"><i class="fas fa-user"></i> Credenciales del Cajero</h4>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nuevo Usuario Vendedor:</label>
                                <input type="text" id="vend-user-input" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nueva Clave Vendedor:</label>
                                <input type="password" id="vend-pass-input" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 5px;">
                            </div>
                            <button id="btn-update-vendedor" style="width: 100%; padding: 10px; background-color: #059669; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                <i class="fas fa-save"></i> Actualizar Cajero
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Si es el vendedor, le mostramos un espacio vacío o un mensaje pa' las futuras funciones
        htmlConfiguracion += `
            <div class="card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div class="card-content" style="text-align: center; color: #64748b; padding: 40px 0;">
                    <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 15px; color: #cbd5e1;"></i>
                    <h3>Opciones del Usuario</h3>
                    <p>Próximamente se añadirán más configuraciones para tu perfil aquí.</p>
                </div>
            </div>
        `;
    }

    // 4. Clavamos el botón azul de Cerrar Sesión abajo a la derecha
    htmlConfiguracion += `
            <button id="btn-cerrar-sesion" style="
                position: fixed; 
                bottom: 30px; 
                right: 30px; 
                background-color: #2563eb; /* Azulito pavo */
                color: white; 
                border: none; 
                border-radius: 50px; /* Redondito pa' que resalte */
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
        </div>
    `;

    // 5. Inyectamos todo el HTML
    content.innerHTML = htmlConfiguracion;

    // 6. Activamos los eventos (solo si los botones existen, es decir, si es admin)
    if (esAdmin) {
        document.getElementById('btn-update-admin').addEventListener('click', () => guardarCredenciales('admin'));
        document.getElementById('btn-update-vendedor').addEventListener('click', () => guardarCredenciales('vendedor'));
    }

    // 7. Evento del botón flotante de Cerrar Sesión
    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        const confirmar = confirm("¿Estáis seguro que queréis cerrar la sesión?");
        if (confirmar) {
            // Borramos de la memoria quién estaba logueado pa' que no queden rastros
            localStorage.removeItem('rol'); 
            window.location.reload();
        }
    });

    // Efectico pavo al pasar el mouse por el botón
    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    btnCerrar.addEventListener('mouseenter', () => btnCerrar.style.transform = 'scale(1.05)');
    btnCerrar.addEventListener('mouseleave', () => btnCerrar.style.transform = 'scale(1)');
}

// ... (La función guardarCredenciales() queda igualitica a la que te mandé antes) ...
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