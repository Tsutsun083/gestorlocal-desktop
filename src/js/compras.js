// Módulo de compras y proveedores

import { productos } from './state.js';
import { configuracion } from './state.js';
import { getProveedores, addProveedor, updateProveedor, deleteProveedor, crearOrdenCompra, recibirOrden, getOrdenesCompra, getOrdenDetalle, updateOrdenCompra, updateOrdenCompleta } from './database.js';
import { crearModal, cerrarTodosLosModales, mostrarNotificacion } from './ui.js';

// ============================================
// PÁGINA DE COMPRAS
// ============================================
export async function loadCompras() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `
    <div style="margin-bottom: 20px;">
      <button class="btn btn-primary" id="btn-nueva-orden">➕ Nueva Orden</button>
      <button class="btn btn-secondary" id="btn-gestion-proveedores">📋 Gestionar Proveedores</button>
    </div>
    <div id="compras-contenido">
      <h3>Órdenes de Compra</h3>
      <div id="lista-ordenes"></div>
    </div>
  `;

  document.getElementById('btn-nueva-orden').addEventListener('click', mostrarModalNuevaOrden);
  document.getElementById('btn-gestion-proveedores').addEventListener('click', mostrarModalGestionProveedores);

  // Cargar lista de órdenes
  await cargarListaOrdenes();
}

async function cargarListaOrdenes() {
  const ordenes = await getOrdenesCompra();
  const container = document.getElementById('lista-ordenes');
  if (!container) return;

  if (ordenes.length === 0) {
    container.innerHTML = '<p>No hay órdenes de compra registradas.</p>';
    return;
  }

  container.innerHTML = `
    <table class="productos-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Proveedor</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Total</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${ordenes.map(orden => `
          <tr>
            <td>${orden.id}</td>
            <td>${orden.nombre_empresa || 'N/D'}</td>
            <td>${new Date(orden.fecha_orden).toLocaleDateString()}</td>
            <td>${orden.estado}</td>
            <td>${orden.total?.toFixed(2) || '0.00'} Bs</td>
            <td>
              ${orden.estado === 'pendiente' ? `
                <button class="btn-icon btn-editar" data-id="${orden.id}" title="Editar">✏️</button>
                <button class="btn-icon btn-recibir" data-id="${orden.id}" title="Recibir">📦</button>
                <button class="btn-icon btn-cancelar" data-id="${orden.id}" title="Cancelar">❌</button>
              ` : ''}
              <button class="btn-icon btn-ver" data-id="${orden.id}" title="Ver detalle">👁️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Evento para editar orden
  container.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => mostrarModalEditarOrden(parseInt(btn.dataset.id)));
  });

  // Evento para recibir orden
  container.querySelectorAll('.btn-recibir').forEach(btn => {
    btn.addEventListener('click', () => mostrarModalRecibirOrden(parseInt(btn.dataset.id)));
  });

  // Evento para cancelar orden
  container.querySelectorAll('.btn-cancelar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ordenId = parseInt(btn.dataset.id);
      if (confirm('¿Cancelar esta orden? No se actualizará el stock.')) {
        await updateOrdenCompra(ordenId, { estado: 'cancelado' });
        mostrarNotificacion('Orden cancelada');
        await cargarListaOrdenes();
      }
    });
  });

  // Evento para ver detalle
  container.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const ordenId = parseInt(btn.dataset.id);
      mostrarDetalleOrden(ordenId);
    });
  });
}

// ============================================
// GESTIÓN DE PROVEEDORES (sin cambios)
// ============================================
async function mostrarModalGestionProveedores() {
  const proveedores = await getProveedores();
  const listaProveedores = proveedores.map(p => `
    <tr>
      <td>${p.nombre_empresa}</td>
      <td>${p.rubro || '-'}</td>
      <td>${p.nombre_contacto || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td>
        <button class="btn-icon btn-edit" data-id="${p.id}">✏️</button>
        <button class="btn-icon btn-delete" data-id="${p.id}">🗑️</button>
       </td>
    </tr>
  `).join('');

  const contenido = `
    <div style="margin-bottom: 10px;">
      <button class="btn btn-primary" id="btn-nuevo-proveedor">➕ Nuevo Proveedor</button>
    </div>
    <table class="productos-table">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Rubro</th>
          <th>Contacto</th>
          <th>Teléfono</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${listaProveedores}
      </tbody>
    </table>
  `;

  const modal = crearModal('Gestionar Proveedores', contenido, '600px');

  document.getElementById('btn-nuevo-proveedor').addEventListener('click', () => mostrarModalProveedor());

  modal.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const proveedor = proveedores.find(p => p.id == id);
      mostrarModalProveedor(proveedor);
    });
  });

  modal.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('¿Eliminar este proveedor?')) {
        await deleteProveedor(id);
        mostrarNotificacion('Proveedor eliminado');
        modal.remove();
        mostrarModalGestionProveedores(); // recargar
      }
    });
  });
}

function mostrarModalProveedor(proveedor = null) {
  const isEdit = !!proveedor;
  const titulo = isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor';
  const contenido = `
    <div class="form-group">
      <label>Nombre de la empresa *</label>
      <input type="text" id="campo-empresa" value="${proveedor?.nombre_empresa || ''}" class="form-control">
    </div>
    <div class="form-group">
      <label>Rubro</label>
      <input type="text" id="campo-rubro" value="${proveedor?.rubro || ''}" class="form-control" placeholder="Ej: Lácteos">
    </div>
    <div class="form-group">
      <label>Nombre de contacto</label>
      <input type="text" id="campo-contacto" value="${proveedor?.nombre_contacto || ''}" class="form-control">
    </div>
    <div class="form-group">
      <label>Teléfono</label>
      <input type="text" id="campo-telefono" value="${proveedor?.telefono || ''}" class="form-control">
    </div>
    <div class="form-group">
      <label>Dirección</label>
      <input type="text" id="campo-direccion" value="${proveedor?.direccion || ''}" class="form-control">
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-proveedor">Guardar</button>
    </div>
  `;

  const modal = crearModal(titulo, contenido, '400px');

  document.getElementById('btn-guardar-proveedor').addEventListener('click', async () => {
    const proveedorData = {
      nombre_empresa: document.getElementById('campo-empresa').value.trim(),
      rubro: document.getElementById('campo-rubro').value.trim() || null,
      nombre_contacto: document.getElementById('campo-contacto').value.trim() || null,
      telefono: document.getElementById('campo-telefono').value.trim() || null,
      direccion: document.getElementById('campo-direccion').value.trim() || null,
    };
    if (!proveedorData.nombre_empresa) {
      mostrarNotificacion('El nombre de la empresa es obligatorio', 'error');
      return;
    }
    try {
      if (isEdit) {
        await updateProveedor(proveedor.id, proveedorData);
        mostrarNotificacion('Proveedor actualizado');
      } else {
        await addProveedor(proveedorData);
        mostrarNotificacion('Proveedor creado');
      }
      modal.remove();
      mostrarModalGestionProveedores(); // recargar lista
    } catch (error) {
      console.error(error);
      mostrarNotificacion('Error al guardar proveedor', 'error');
    }
  });
}

// ============================================
// NUEVA ORDEN DE COMPRA (MODIFICADA)
// ============================================
async function mostrarModalNuevaOrden() {
  const proveedores = await getProveedores();
  const tasaBCV = configuracion.tasa_bcv || 50;
  const opcionesProveedores = proveedores.map(p => `<option value="${p.id}">${p.nombre_empresa}</option>`).join('');

  let items = [];

  const contenido = `
    <div style="margin-bottom: 15px;">
      <label>Proveedor</label>
      <select id="orden-proveedor" class="form-control">
        <option value="">-- Seleccionar proveedor --</option>
        ${opcionesProveedores}
      </select>
      <small><a href="#" id="link-nuevo-proveedor">+ Agregar nuevo proveedor</a></small>
    </div>
    <div style="margin-bottom: 15px;">
      <label>Observaciones</label>
      <textarea id="orden-observaciones" class="form-control" rows="2"></textarea>
    </div>
    <h4>Productos</h4>
    <div style="margin-bottom: 10px;">
      <input type="text" id="buscador-productos-orden" class="form-control" placeholder="Buscar producto...">
      <div id="resultados-busqueda-orden" style="max-height: 150px; overflow-y: auto; margin-top: 5px;"></div>
    </div>
    <table class="productos-table">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio Unitario (USD)</th>
          <th>Subtotal (Bs)</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="tabla-items-orden"></tbody>
    </table>
    <div style="text-align: right; font-weight: bold; margin-top: 10px;">
      Total: <span id="total-orden">0</span> Bs
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-orden">Guardar Orden (Pendiente)</button>
    </div>
  `;

  const modal = crearModal('Nueva Orden de Compra', contenido, '700px');

  const selectProveedor = document.getElementById('orden-proveedor');
  const inputObservaciones = document.getElementById('orden-observaciones');
  const tbody = document.getElementById('tabla-items-orden');
  const totalSpan = document.getElementById('total-orden');
  const buscador = document.getElementById('buscador-productos-orden');
  const resultadosDiv = document.getElementById('resultados-busqueda-orden');

function actualizarTabla() {
  const tasa = configuracion.tasa_bcv || 50;
  tbody.innerHTML = items.map((item, index) => {
    const subtotalBs = (item.cantidad * item.precio) * tasa;
    return `
      <tr>
        <td>${item.nombre}</td>
        <td><input type="number" step="0.01" min="0.01" value="${item.cantidad}" class="form-control" style="width:80px;" data-index="${index}" data-campo="cantidad"></td>
        <td><input type="number" step="0.01" min="0" value="${item.precio}" class="form-control" style="width:100px;" data-index="${index}" data-campo="precio"></td>
        <td>${subtotalBs.toFixed(2)} Bs</td>
        <td><button class="btn-icon btn-delete" data-index="${index}">🗑️</button></td>
      </tr>
    `;
  }).join('');
  const totalBs = items.reduce((sum, i) => sum + ((i.cantidad * i.precio) * tasa), 0);
  totalSpan.textContent = totalBs.toFixed(2) + ' Bs';
}

  buscador.addEventListener('input', (e) => {
    const termino = e.target.value.toLowerCase();
    if (termino.length < 2) {
      resultadosDiv.innerHTML = '';
      return;
    }
    const resultados = productos.filter(p => p.nombre.toLowerCase().includes(termino) && p.activo);
    resultadosDiv.innerHTML = resultados.map(p => `
      <div style="padding: 5px; cursor: pointer; border-bottom: 1px solid #eee;" data-id="${p.id}" data-nombre="${p.nombre}">
        ${p.nombre}
      </div>
    `).join('');
    resultadosDiv.querySelectorAll('div[data-id]').forEach(div => {
      div.addEventListener('click', () => {
        const id = parseInt(div.dataset.id);
        const nombre = div.dataset.nombre;
        items.push({ producto_id: id, nombre, cantidad: 1, precio: 0 });
        actualizarTabla();
        resultadosDiv.innerHTML = '';
        buscador.value = '';
      });
    });
  });

  tbody.addEventListener('input', (e) => {
    if (e.target.classList.contains('form-control')) {
      const index = parseInt(e.target.dataset.index);
      const campo = e.target.dataset.campo;
      let valor = parseFloat(e.target.value);
      if (!isNaN(valor) && valor >= 0) {
        if (campo === 'cantidad') items[index].cantidad = valor;
        else if (campo === 'precio') items[index].precio = valor;
        actualizarTabla();
      }
    }
  });

  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete')) {
      const index = parseInt(e.target.dataset.index);
      items.splice(index, 1);
      actualizarTabla();
    }
  });

  document.getElementById('link-nuevo-proveedor').addEventListener('click', async (e) => {
    e.preventDefault();
    // Creamos un modal para nuevo proveedor y al cerrar refrescamos el select
    const proveedorModal = crearModal('Nuevo Proveedor', `
      <div class="form-group"><label>Nombre empresa</label><input type="text" id="nuevoProvEmpresa" class="form-control"></div>
      <div class="form-group"><label>Rubro</label><input type="text" id="nuevoProvRubro" class="form-control"></div>
      <div class="form-group"><label>Contacto</label><input type="text" id="nuevoProvContacto" class="form-control"></div>
      <div class="form-group"><label>Teléfono</label><input type="text" id="nuevoProvTelefono" class="form-control"></div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-primary" id="guardarNuevoProv">Guardar</button></div>
    `, '400px');
    document.getElementById('guardarNuevoProv').addEventListener('click', async () => {
      const nuevo = {
        nombre_empresa: document.getElementById('nuevoProvEmpresa').value.trim(),
        rubro: document.getElementById('nuevoProvRubro').value.trim() || null,
        nombre_contacto: document.getElementById('nuevoProvContacto').value.trim() || null,
        telefono: document.getElementById('nuevoProvTelefono').value.trim() || null,
      };
      if (!nuevo.nombre_empresa) {
        mostrarNotificacion('Nombre de empresa obligatorio', 'error');
        return;
      }
      try {
        await addProveedor(nuevo);
        mostrarNotificacion('Proveedor agregado');
        proveedorModal.remove();
        // Recargar el select de proveedores
        const nuevosProveedores = await getProveedores();
        selectProveedor.innerHTML = '<option value="">-- Seleccionar proveedor --</option>' + nuevosProveedores.map(p => `<option value="${p.id}">${p.nombre_empresa}</option>`).join('');
      } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al guardar proveedor', 'error');
      }
    });
  });

  document.getElementById('btn-guardar-orden').addEventListener('click', async () => {
    const proveedor_id = selectProveedor.value;
    if (!proveedor_id) {
      mostrarNotificacion('Seleccione un proveedor', 'error');
      return;
    }
    if (items.length === 0) {
      mostrarNotificacion('Agregue al menos un producto', 'error');
      return;
    }
    const total = items.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const ordenData = {
      proveedor_id: parseInt(proveedor_id),
      observaciones: inputObservaciones.value,
      items: items.map(i => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio
      })),
      total
    };
    try {
      // CAMBIO: Usamos addOrdenCompra en lugar de crearOrdenCompra
      const resultado = await crearOrdenCompra(ordenData);
      mostrarNotificacion(`Orden de compra creada con ID: ${resultado.id}`);
      modal.remove();
      await cargarListaOrdenes(); // refrescar lista de órdenes
    } catch (error) {
      console.error(error);
      mostrarNotificacion('Error al crear orden', 'error');
    }
  });
}

// ============================================
// RECIBIR ORDEN (CON MODAL PARA MODIFICAR CANTIDADES)
// ============================================
async function mostrarModalRecibirOrden(ordenId) {
  try {
    const items = await getOrdenDetalle(ordenId);
    if (!items || items.length === 0) {
      mostrarNotificacion('No se encontraron productos en esta orden', 'error');
      return;
    }


    let itemsEditables = items.map(item => ({
      ...item,
      cantidadRecibir: item.cantidad
    }));

    const contenido = `
      <h4>Recibir productos de la orden #${ordenId}</h4>
      <p>Modifique las cantidades si es necesario. Solo se recibirán los productos con cantidad > 0.</p>
      <table class="productos-table" style="width:100%; margin-top: 10px;">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad pedida</th>
            <th>Cantidad a recibir</th>
            <th>Precio unitario (USD)</th>
          </tr>
        </thead>
        <tbody id="tabla-recibir-orden">
          ${itemsEditables.map((item, idx) => `
            <tr data-index="${idx}">
              <td>${item.nombre}</td>
              <td>${item.cantidad}</td>
              <td>
                <input type="number" step="0.01" min="0" value="${item.cantidadRecibir}" class="form-control cantidad-recibir" style="width:100px;" data-index="${idx}">
              </td>
              <td>${item.precio_unitario} USD</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="btn-cancelar-recibir">Cancelar</button>
        <button class="btn btn-primary" id="btn-confirmar-recibir">Confirmar Recepción</button>
      </div>
    `;

    const modal = crearModal(`Recibir Orden #${ordenId}`, contenido, '700px');

    // Actualizar el array cuando cambian las cantidades
    const inputs = modal.querySelectorAll('.cantidad-recibir');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const nuevaCantidad = parseFloat(e.target.value) || 0;
        itemsEditables[idx].cantidadRecibir = nuevaCantidad;
      });
    });

    // Botón cancelar
    modal.querySelector('#btn-cancelar-recibir').addEventListener('click', () => modal.remove());

    // Botón confirmar
    modal.querySelector('#btn-confirmar-recibir').addEventListener('click', async () => {
      const itemsRecibir = itemsEditables
        .filter(item => item.cantidadRecibir > 0)
        .map(item => ({
          producto_id: item.producto_id,
          cantidadRecibida: item.cantidadRecibir
        }));

      if (itemsRecibir.length === 0) {
        mostrarNotificacion('No se ha seleccionado ninguna cantidad para recibir', 'error');
        return;
      }

      try {
        await recibirOrden(ordenId, itemsRecibir);
        mostrarNotificacion('Orden recibida y stock actualizado');
        modal.remove();
        await cargarListaOrdenes(); // refrescar la lista
      } catch (error) {
        console.error(error);
        mostrarNotificacion('Error al recibir orden', 'error');
      }
    });

  } catch (error) {
    console.error('Error al obtener detalle de orden:', error);
    mostrarNotificacion('Error al cargar el modal de recepción', 'error');
  }
}

// ============================================
// MOSTRAR DETALLE DE UNA ORDEN
// ============================================
async function mostrarDetalleOrden(ordenId) {
  try {
    const items = await getOrdenDetalle(ordenId);
    if (!items || items.length === 0) {
      mostrarNotificacion('No se encontraron productos en esta orden', 'error');
      return;
    }

    // Obtener la tasa BCV actual
    const tasa = configuracion.tasa_bcv || 50;

    // Calcular total en USD y luego en Bs
    const totalUSD = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
    const totalBs = totalUSD * tasa;

    // Crear el contenido HTML del modal
    const contenido = `
      <h4>Productos de la orden #${ordenId}</h4>
      <table class="productos-table" style="width:100%; margin-top: 10px;">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio unitario (USD)</th>
            <th>Subtotal (Bs)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const subtotalBs = (item.cantidad * item.precio_unitario) * tasa;
            return `
              <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad}${item.unidad_medida ? ' ' + item.unidad_medida : ''}</td>
                <td>${item.precio_unitario.toFixed(2)} USD</td>
                <td>${subtotalBs.toFixed(2)} Bs</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold;">
            <td colspan="3" style="text-align: right;">TOTAL (Bs):</td>
            <td>${totalBs.toFixed(2)} Bs</td>
          </tr>
        </tfoot>
      </table>
    `;

    const modal = crearModal(`Detalle de Orden #${ordenId}`, contenido, '600px');
    const botonCerrar = document.createElement('button');
    botonCerrar.textContent = 'Cerrar';
    botonCerrar.className = 'btn btn-secondary';
    botonCerrar.style.marginTop = '20px';
    botonCerrar.addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-content').appendChild(botonCerrar);

  } catch (error) {
    console.error('Error al obtener detalle de orden:', error);
    mostrarNotificacion('Error al cargar el detalle de la orden', 'error');
  }
}

// ============================================
// EDITAR ORDEN (solo si está pendiente)
// ============================================
async function mostrarModalEditarOrden(ordenId) {
  // Obtener datos actuales de la orden (cabecera y detalles)
  const ordenes = await getOrdenesCompra();
  const orden = ordenes.find(o => o.id === ordenId);
  if (!orden) return;
  const detalles = await getOrdenDetalle(ordenId);
  const proveedores = await getProveedores();
  const tasaBCV = configuracion.tasa_bcv || 50;

  // Preparar items editables
  let items = detalles.map(d => ({
    producto_id: d.producto_id,
    nombre: d.nombre,
    cantidad: d.cantidad,
    precio: d.precio_unitario
  }));

  const opcionesProveedores = proveedores.map(p => `<option value="${p.id}" ${p.id === orden.proveedor_id ? 'selected' : ''}>${p.nombre_empresa}</option>`).join('');

  const contenido = `
    <div style="margin-bottom: 15px;">
      <label>Proveedor</label>
      <select id="orden-proveedor" class="form-control">
        <option value="">-- Seleccionar proveedor --</option>
        ${opcionesProveedores}
      </select>
      <small><a href="#" id="link-nuevo-proveedor">+ Agregar nuevo proveedor</a></small>
    </div>
    <div style="margin-bottom: 15px;">
      <label>Observaciones</label>
      <textarea id="orden-observaciones" class="form-control" rows="2">${orden.observaciones || ''}</textarea>
    </div>
    <h4>Productos</h4>
    <div style="margin-bottom: 10px;">
      <input type="text" id="buscador-productos-orden" class="form-control" placeholder="Buscar producto...">
      <div id="resultados-busqueda-orden" style="max-height: 150px; overflow-y: auto; margin-top: 5px;"></div>
    </div>
    <table class="productos-table">
      <thead>
        <tr><th>Producto</th><th>Cantidad</th><th>Precio unitario (USD)</th><th>Subtotal (Bs)</th><th></th></tr>
      </thead>
      <tbody id="tabla-items-orden"></tbody>
    </table>
    <div style="text-align: right; font-weight: bold; margin-top: 10px;">
      Total: <span id="total-orden">0</span> Bs
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
      <button class="btn btn-primary" id="btn-actualizar-orden">Actualizar Orden</button>
    </div>
  `;

  const modal = crearModal(`Editar Orden #${ordenId}`, contenido, '700px');

  const selectProveedor = document.getElementById('orden-proveedor');
  const inputObservaciones = document.getElementById('orden-observaciones');
  const tbody = document.getElementById('tabla-items-orden');
  const totalSpan = document.getElementById('total-orden');
  const buscador = document.getElementById('buscador-productos-orden');
  const resultadosDiv = document.getElementById('resultados-busqueda-orden');

  function actualizarTabla() {
    const tasa = configuracion.tasa_bcv || 50;
    tbody.innerHTML = items.map((item, index) => {
      const subtotalBs = (item.cantidad * item.precio) * tasa;
      return `
        <tr>
          <td>${item.nombre}</td>
          <td><input type="number" step="0.01" min="0.01" value="${item.cantidad}" class="form-control" style="width:80px;" data-index="${index}" data-campo="cantidad"></td>
          <td><input type="number" step="0.01" min="0" value="${item.precio}" class="form-control" style="width:100px;" data-index="${index}" data-campo="precio"></td>
          <td>${subtotalBs.toFixed(2)} Bs</td>
          <td><button class="btn-icon btn-delete" data-index="${index}">🗑️</button></td>
        </tr>
      `;
    }).join('');
    const totalBs = items.reduce((sum, i) => sum + ((i.cantidad * i.precio) * tasa), 0);
    totalSpan.textContent = totalBs.toFixed(2) + ' Bs';
  }

  // Búsqueda de productos (similar a nueva orden)
  buscador.addEventListener('input', (e) => {
    const termino = e.target.value.toLowerCase();
    if (termino.length < 2) { resultadosDiv.innerHTML = ''; return; }
    const resultados = productos.filter(p => p.nombre.toLowerCase().includes(termino) && p.activo);
    resultadosDiv.innerHTML = resultados.map(p => `
      <div style="padding: 5px; cursor: pointer; border-bottom: 1px solid #eee;" data-id="${p.id}" data-nombre="${p.nombre}">
        ${p.nombre}
      </div>
    `).join('');
    resultadosDiv.querySelectorAll('div[data-id]').forEach(div => {
      div.addEventListener('click', () => {
        const id = parseInt(div.dataset.id);
        const nombre = div.dataset.nombre;
        items.push({ producto_id: id, nombre, cantidad: 1, precio: 0 });
        actualizarTabla();
        resultadosDiv.innerHTML = '';
        buscador.value = '';
      });
    });
  });

  // Eventos para modificar cantidades/precios y eliminar
  tbody.addEventListener('input', (e) => {
    if (e.target.classList.contains('form-control')) {
      const index = parseInt(e.target.dataset.index);
      const campo = e.target.dataset.campo;
      const valor = parseFloat(e.target.value);
      if (!isNaN(valor) && valor >= 0) {
        if (campo === 'cantidad') items[index].cantidad = valor;
        else if (campo === 'precio') items[index].precio = valor;
        actualizarTabla();
      }
    }
  });
  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete')) {
      const index = parseInt(e.target.dataset.index);
      items.splice(index, 1);
      actualizarTabla();
    }
  });

  // Enlace para nuevo proveedor
  document.getElementById('link-nuevo-proveedor').addEventListener('click', async (e) => {
    e.preventDefault();
    const proveedorModal = crearModal('Nuevo Proveedor', `
      <div class="form-group"><label>Nombre empresa</label><input type="text" id="nuevoProvEmpresa" class="form-control"></div>
      <div class="form-group"><label>Rubro</label><input type="text" id="nuevoProvRubro" class="form-control"></div>
      <div class="form-group"><label>Contacto</label><input type="text" id="nuevoProvContacto" class="form-control"></div>
      <div class="form-group"><label>Teléfono</label><input type="text" id="nuevoProvTelefono" class="form-control"></div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-primary" id="guardarNuevoProv">Guardar</button></div>
    `, '400px');
    document.getElementById('guardarNuevoProv').addEventListener('click', async () => {
      const nuevo = {
        nombre_empresa: document.getElementById('nuevoProvEmpresa').value.trim(),
        rubro: document.getElementById('nuevoProvRubro').value.trim() || null,
        nombre_contacto: document.getElementById('nuevoProvContacto').value.trim() || null,
        telefono: document.getElementById('nuevoProvTelefono').value.trim() || null,
      };
      if (!nuevo.nombre_empresa) return mostrarNotificacion('Nombre empresa obligatorio', 'error');
      await addProveedor(nuevo);
      mostrarNotificacion('Proveedor agregado');
      proveedorModal.remove();
      // Recargar el select de proveedores
      const nuevosProveedores = await getProveedores();
      selectProveedor.innerHTML = '<option value="">-- Seleccionar proveedor --</option>' + nuevosProveedores.map(p => `<option value="${p.id}">${p.nombre_empresa}</option>`).join('');
    });
  });

  // Botón actualizar orden
  document.getElementById('btn-actualizar-orden').addEventListener('click', async () => {
    const proveedor_id = selectProveedor.value;
    if (!proveedor_id) return mostrarNotificacion('Seleccione un proveedor', 'error');
    if (items.length === 0) return mostrarNotificacion('Agregue al menos un producto', 'error');
    const total = items.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);
    const ordenData = {
      proveedor_id: parseInt(proveedor_id),
      observaciones: inputObservaciones.value,
      items: items.map(i => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio
      })),
      total
    };
    try {
      await updateOrdenCompleta(ordenId, ordenData);
      mostrarNotificacion('Orden actualizada');
      modal.remove();
      await cargarListaOrdenes();
    } catch (error) {
      console.error(error);
      mostrarNotificacion('Error al actualizar orden', 'error');
    }
  });

  actualizarTabla();
}
