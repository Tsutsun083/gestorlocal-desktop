// clientes.js - Módulo de gestión de clientes y cuentas por cobrar
import { crearModal, cerrarTodosLosModales, mostrarNotificacion } from './ui.js';
import { getClientes, addCliente, abonarDeudaCliente, asignarDeuda } from './database.js';
let clientesLista = [];

// ============================================
// PÁGINA PRINCIPAL DE CLIENTES
// ============================================

export async function loadClientes() {
    const content = document.getElementById('page-content');
    if (!content) return;

    try {
        clientesLista = await getClientes() || [];
    } catch (e) { console.error("Error cargando clientes:", e); }

    content.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
            <h2>👥 Gestión de Clientes</h2>
            <button class="btn btn-primary\" id="btn-nuevo-cliente">
                <i class="fas fa-user-plus"></i> Nuevo Cliente
            </button>
        </div>
        
        <div class="productos-table-container">
            <table class="productos-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Cédula/RIF</th>
                        <th>Teléfono</th>
                        <th>Deuda Actual</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="lista-clientes-body">
                    ${clientesLista.map(c => `
                        <tr>
                            <td>${c.nombre}</td>
                            <td>${c.ci || 'N/A'}</td>
                            <td>${c.telefono || '-'}</td>
                            <td style="font-weight:bold; color: ${c.deuda > 0 ? '#dc2626' : '#059669'}">
                                ${c.deuda.toFixed(2)} Bs.
                            </td>
                            <td>
                                <button class="btn-icon btn-edit btn-cobrar" 
                                        data-id="${c.id}" 
                                        data-nombre="${c.nombre}" 
                                        data-deuda="${c.deuda}"
                                        title="Cobrar">
                                    <i class="fas fa-hand-holding-usd"></i>
                                </button>
                                <button class="btn-icon btn-edit btn-asignar-deuda" 
                                        data-id="${c.id}" data-nombre="${c.nombre}">
                                    <i class="fas fa-plus-circle"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    document.querySelectorAll('.btn-cobrar').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const nombre = btn.getAttribute('data-nombre');
            const deuda = parseFloat(btn.getAttribute('data-deuda'));
            
            if (deuda <= 0) {
                return mostrarNotificacion('¡Ese cliente no debe nada, está sano!', 'success');
            }
            mostrarModalCobro(id, nombre, deuda);
        });
    });
    // Escuchamos los botones de Asignar Deuda (pa' que no se te olvide)
    document.querySelectorAll('.btn-asignar-deuda').forEach(btn => {
        btn.addEventListener('click', () => {
            mostrarModalAsignarDeuda(btn.getAttribute('data-id'), btn.getAttribute('data-nombre'));
        });
    });
    // Evento para nuevo cliente
    document.getElementById('btn-nuevo-cliente')?.addEventListener('click', mostrarModalNuevoCliente);
}
function renderizarTablaClientes(lista) {
    const tbody = document.getElementById('tabla-clientes-body');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes pa\' mostrar</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(c => {
        const deudaBs = c.deuda || 0;
        const claseDeuda = deudaBs > 0 ? 'color: #dc2626; font-weight: bold;' : 'color: #059669;';
        
        return `
            <tr>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.ci || 'N/A'}</td>
                <td>${c.telefono || 'N/A'}</td>
                <td style="${claseDeuda}">${deudaBs.toLocaleString('es-VE')} Bs</td>
             <td>
                <button class="btn btn-warning btn-sm" onclick="mostrarModalAsignarDeuda(${c.id}, '${c.nombre}')">
                    <i class="fas fa-hand-holding-usd"></i> Fiar
                </button>
                <button class="btn btn-success btn-sm" onclick="mostrarModalCobrar(${c.id}, '${c.nombre}', ${c.deuda})">
                    <i class="fas fa-cash-register"></i> Cobrar
                </button>
            </td>
        </tr>
        `;
    }).join('');

    // Agregar eventos a los botones de cobrar
    document.querySelectorAll('.btn-abonar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { id, nombre, deuda } = e.currentTarget.dataset;
            mostrarFormularioAbono(id, nombre, parseFloat(deuda));
        });
    });
}
// ============================================
// MODAL: NUEVO CLIENTE
// ============================================
function mostrarFormularioCliente() {
    const contenido = `
        <div class="form-group">
            <label>Nombre Completo *</label>
            <input type="text" id="cli-nombre" class="form-control" placeholder="Ej: Juan Bimba" autofocus>
        </div>
        <div class="form-group">
            <label>Cédula (CI)</label>
            <input type="text" id="cli-ci" class="form-control" placeholder="Ej: V-12345678">
        </div>
        <div class="form-group">
            <label>Teléfono</label>
            <input type="text" id="cli-telefono" class="form-control" placeholder="Ej: 0414-0000000">
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-primary" id="btn-guardar-cli">Guardar Cliente</button>
        </div>
    `;
    const modal = crearModal('👤 Registrar Cliente', contenido, '400px');

    document.getElementById('btn-guardar-cli').addEventListener('click', async () => {
        const nombre = document.getElementById('cli-nombre').value.trim();
        const ci = document.getElementById('cli-ci').value.trim();
        const telefono = document.getElementById('cli-telefono').value.trim();

        if (!nombre) {
            mostrarNotificacion('¡Primo, el nombre es obligatorio!', 'error');
            return;
        }

        try {
            await addCliente({ nombre, ci, telefono });
            mostrarNotificacion('¡Cliente registrado al pelo!');
            modal.remove();
            loadClientes(); // Recargar la tabla
        } catch (err) {
            console.error(err);
            mostrarNotificacion('Error guardando el cliente', 'error');
        }
    });
}
// ============================================
// MODAL: COBRAR DEUDA
// ============================================
function mostrarFormularioAbono(id, nombre, deudaActual) {
    const contenido = `
        <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 0; color: #991b1b;">Deuda Total: <strong>${deudaActual.toLocaleString('es-VE')} Bs</strong></p>
        </div>
        
        <div class="form-group">
            <label>Monto a Pagar (Bs) *</label>
            <input type="number" id="abono-monto" class="form-control" step="0.01" max="${deudaActual}" value="${deudaActual}">
        </div>
        <div class="form-group">
            <label>Método de Pago</label>
            <select id="abono-metodo" class="form-control">
                <option value="efectivo">Efectivo</option>
                <option value="pago_movil">Pago Móvil / Transferencia</option>
                <option value="punto">Punto de Venta</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-success" id="btn-procesar-abono">Procesar Pago</button>
            <button class="btn btn-warning btn-sm" onclick="mostrarModalAsignarDeuda(${c.id}, '${c.nombre}')">
            <i class="fas fa-hand-holding-usd"></i> Fiar
        </button>
            <button class="btn btn-success btn-sm" onclick="mostrarModalCobrar(${c.id}, '${c.nombre}', ${c.deuda})">
             <i class="fas fa-cash-register"></i> Cobrar
        </button>
        </div>
    `;
    const modal = crearModal(`💰 Cobrar a ${nombre}`, contenido, '400px');

    document.getElementById('btn-procesar-abono').addEventListener('click', async () => {
        const monto = parseFloat(document.getElementById('abono-monto').value);
        const metodo = document.getElementById('abono-metodo').value;

        if (isNaN(monto) || monto <= 0 || monto > deudaActual) {
            mostrarNotificacion('¡Monto inválido, revisá bien los números!', 'error');
            return;
        }

        try {
            // Mandamos a pagar la trampa
            await abonarDeudaCliente({ clienteId: id, monto, metodoPago: metodo });
            mostrarNotificacion('¡Pago registrado! Los cobres ya están en el reporte.');
            modal.remove();
            loadClientes(); // Actualizar tabla
        } catch (err) {
            console.error(err);
            mostrarNotificacion('Error procesando el abono', 'error');
        }
    });
}
//=============================================
// MODAL: pagar deuda (cobrar al cliente)
//=============================================
function mostrarModalCobro(id, nombre, deudaActual) {
    const contenido = `
        <div class="form-group">
            <p><strong>Deuda de ${nombre}:</strong> ${deudaActual.toFixed(2)} Bs.</p>
            <label>Monto a Cobrar (Bs.):</label>
            <input type="number" id="abono-monto" class="form-control" 
                   value="${deudaActual}" step="0.01" max="${deudaActual}">
        </div>
        <div class="form-group">
            <label>Método de Pago:</label>
            <select id="abono-metodo" class="form-control">
                <option value="efectivo">Efectivo</option>
                <option value="pago_movil">Pago Móvil</option>
                <option value="punto">Punto de Venta</option>
                <option value="divisas">Divisas (Efectivo)</option>
            </select>
        </div>
        <div class="modal-actions" style="display:flex; justify-content: flex-end; gap:10px;">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-success" id="btn-procesar-pago">Registrar Pago</button>
        </div>
    `;

    const modal = crearModal(`💰 Cobrar a ${nombre}`, contenido, '350px');

    document.getElementById('btn-procesar-pago').addEventListener('click', async () => {
        const monto = parseFloat(document.getElementById('abono-monto').value);
        const metodo = document.getElementById('abono-metodo').value;

        if (isNaN(monto) || monto <= 0 || monto > (deudaActual + 0.01)) {
            return mostrarNotificacion('¡Epa! Meté un monto válido, ni más ni menos.', 'error');
        }

        try {
            // Mandamos los cobres a la base de datos
            await abonarDeudaCliente({ 
                clienteId: parseInt(id), 
                monto, 
                metodoPago: metodo 
            });

            mostrarNotificacion(`¡Listo! Se cobraron ${monto} Bs. a ${nombre}`);
            modal.remove();
            loadClientes(); // Recargamos la tabla para que se vea el saldo nuevo
        } catch (error) {
            console.error(error);
            mostrarNotificacion('Molleja, hubo un error procesando el pago.', 'error');
        }
    });
}

export function buscarClientesFiltro(termino) {
    const t = termino.toLowerCase();
    // Filtramos de la lista global que ya tenés cargada en ese módulo
    return clientesLista.filter(c => 
        c.nombre.toLowerCase().includes(t) || 
        (c.ci && c.ci.toString().includes(t))
    );
}
export function mostrarModalAsignarDeuda(id, nombre) {
    const contenido = `
        <div class="form-group" style="margin-bottom: 15px;">
            <label style="display:block; margin-bottom:5px;">Monto de la Deuda (Bs):</label>
            <input type="number" id="deuda-monto" class="form-control" placeholder="0.00" step="0.01">
        </div>
        <div class="modal-actions" style="display:flex; justify-content: flex-end; gap:10px;">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-primary" id="btn-guardar-deuda">Confirmar Deuda</button>
        </div>
    `;
    const modal = crearModal(`📝 Asignar Deuda a ${nombre}`, contenido, '350px');

    document.getElementById('btn-guardar-deuda').addEventListener('click', async () => {
        const montoInput = document.getElementById('deuda-monto');
        const monto = parseFloat(montoInput.value);

        if (isNaN(monto) || monto <= 0) {
            return mostrarNotificacion('¡Epa primo, meté un monto que valga la pena!', 'error');
        }
        try {
            // Llamamos a la base de datos
            await asignarDeuda({ clienteId: id, monto: monto });
            
            mostrarNotificacion('¡Listo! Deuda anotada en la cuenta.');
            modal.remove(); // Cerramos el modal
            loadClientes(); // Recargamos la tabla para que se vea el nuevo saldo
        } catch (error) {
            console.error(error);
            mostrarNotificacion('Molleja ' + nombre + ', hubo un error guardando eso.', 'error');
        }
    });
}
window.mostrarModalAsignarDeuda = mostrarModalAsignarDeuda;
window.mostrarFormularioAbono= mostrarFormularioAbono; 