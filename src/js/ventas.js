// ventas.js - Funciones para el punto de venta

import { productos, carritoVentas, setCarritoVentas, configuracion, calcularPrecioBs, redondearCantidad } from './state.js';
import { getProductos, registrarVenta } from './database.js';
import { crearModal, cerrarTodosLosModales, mostrarNotificacion } from './ui.js';

// ============================================
// CARGA INICIAL
// ============================================
async function cargarProductosVentas() {
    // Los productos ya están en state, pero podemos forzar actualización
    const prods = await getProductos();
    // Nota: no modificamos state directamente aquí, pero podríamos
    return prods;
}

// ============================================
// PÁGINA DE VENTAS
// ============================================
export function loadVentas() {
    const content = document.getElementById('page-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="ventas-container">
            <div class="ventas-grid">
                <!-- Panel izquierdo: Búsqueda y productos -->
                <div class="panel-productos">
                    <h3>🔍 Buscar Productos</h3>
                    <input type="text" id="buscador-ventas" class="form-control buscador-grande" 
                           placeholder="Escribe nombre del producto..." autofocus>
                    
                    <div id="resultados-busqueda" class="resultados-grid">
                        <div class="loading-message">Escribe para buscar productos...</div>
                    </div>
                </div>
                
                <!-- Panel derecho: Carrito de compras -->
                <div class="panel-carrito">
                    <h3>🛒 Venta Actual</h3>
                    <div id="carrito-items" class="carrito-items">
                        <div class="carrito-vacio">El carrito está vacío</div>
                    </div>
                    
                    <div class="carrito-total">
                        <span>TOTAL:</span>
                        <span id="total-venta" class="total-valor">0 Bs</span>
                    </div>
                    
                    <div class="metodos-pago">
                        <h4>Método de Pago</h4>
                        <select id="metodo-pago" class="form-control">
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="mixto">Mixto</option>
                        </select>
                    </div>
                    
                    <div class="acciones-venta">
                        <button class="btn btn-secondary" id="cancelar-venta">Cancelar</button>
                        <button class="btn btn-success" id="finalizar-venta">Finalizar Venta</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupBuscadorVentas();
    setupFinalizarVenta();

    document.getElementById('cancelar-venta').addEventListener('click', () => {
        if (carritoVentas.length > 0) {
            if (confirm('¿Cancelar la venta actual?')) {
                setCarritoVentas([]);
                actualizarCarritoUI();
            }
        }
    });
}

// ============================================
// BUSCADOR
// ============================================
let timeoutIdBusqueda;

function setupBuscadorVentas() {
    const buscador = document.getElementById('buscador-ventas');
    if (!buscador) return;
    
    buscador.addEventListener('input', (e) => {
        const termino = e.target.value.trim();
        clearTimeout(timeoutIdBusqueda);
        
        if (termino.length < 2) {
            document.getElementById('resultados-busqueda').innerHTML = 
                '<div class="loading-message">Escribe al menos 2 caracteres...</div>';
            return;
        }
        
        timeoutIdBusqueda = setTimeout(() => {
            buscarProductosVenta(termino);
        }, 300);
    });
}

async function buscarProductosVenta(termino) {
    const resultadosDiv = document.getElementById('resultados-busqueda');
    resultadosDiv.innerHTML = '<div class="loading-message">Buscando...</div>';
    
    try {
        // Usar productos del state (ya cargados)
        const resultados = productos.filter(p => 
            p.nombre.toLowerCase().includes(termino.toLowerCase()) &&
            p.activo !== 0
        );
        
        if (resultados.length === 0) {
            resultadosDiv.innerHTML = '<div class="loading-message">No se encontraron productos</div>';
            return;
        }
        
        resultadosDiv.innerHTML = resultados.map(p => {
            const precioBs = calcularPrecioBs(p);
            const stockActual = p.stock_actual || 0;
            const stockClass = stockActual <= (p.stock_minimo || 5) ? 'stock-bajo' : 'stock-normal';
            
            return `
                <div class="producto-venta-card" data-id="${p.id}" 
                     onclick="window.seleccionarProductoVenta(${p.id})">
                    <div class="producto-nombre">${p.nombre}</div>
                    <div class="producto-precio">${precioBs.toLocaleString()} Bs</div>
                    <div class="producto-stock ${stockClass}">
                        Stock: ${stockActual.toFixed(2)} ${p.unidad_medida}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error buscando productos:', error);
        resultadosDiv.innerHTML = '<div class="error-message">Error al buscar productos</div>';
    }
}

// Exponer globalmente para que funcione onclick
window.seleccionarProductoVenta = seleccionarProducto;

// ============================================
// SELECCIÓN DE PRODUCTO (MODAL)
// ============================================
function seleccionarProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const precioBs = calcularPrecioBs(producto);
    const unidad = producto.unidad_medida || 'unidad';

    const contenido = `
        <p>Precio: ${precioBs} Bs/${unidad}</p>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Modo de ingreso:</label>
            <select id="modo-ingreso" class="form-control">
                <option value="cantidad">Por cantidad (${unidad})</option>
                <option value="monto">Por monto (Bs)</option>
            </select>
        </div>
        
        <div id="input-cantidad" style="display: block;">
            <div class="form-group">
                <label>Cantidad (${unidad}):</label>
                <input type="number" id="cantidad-venta" step="0.01" min="0.01" value="1" class="form-control">
            </div>
            <div style="margin: 10px 0; text-align: center; font-weight: bold;">
                Total: <span id="total-preview-cantidad">${precioBs} Bs</span>
            </div>
        </div>
        
        <div id="input-monto" style="display: none;">
            <div class="form-group">
                <label>Monto (Bs):</label>
                <input type="number" id="monto-venta" step="100" min="100" value="${precioBs}" class="form-control">
            </div>
            <div style="margin: 10px 0; text-align: center; font-weight: bold;">
                Equivale a: <span id="cantidad-preview-monto">1 ${unidad}</span>
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-primary" id="btn-agregar-venta">Agregar al carrito</button>
        </div>
    `;

    const modal = crearModal(producto.nombre, contenido, '400px');

    const modoSelect = document.getElementById('modo-ingreso');
    const divCantidad = document.getElementById('input-cantidad');
    const divMonto = document.getElementById('input-monto');
    const inputCantidad = document.getElementById('cantidad-venta');
    const inputMonto = document.getElementById('monto-venta');
    const totalPreviewCantidad = document.getElementById('total-preview-cantidad');
    const cantidadPreviewMonto = document.getElementById('cantidad-preview-monto');
    const btnAgregar = document.getElementById('btn-agregar-venta');

    modoSelect.addEventListener('change', function() {
        if (this.value === 'cantidad') {
            divCantidad.style.display = 'block';
            divMonto.style.display = 'none';
            actualizarPreviewCantidad();
        } else {
            divCantidad.style.display = 'none';
            divMonto.style.display = 'block';
            actualizarPreviewMonto();
        }
    });

    function actualizarPreviewCantidad() {
        const cant = parseFloat(inputCantidad.value) || 0;
        totalPreviewCantidad.textContent = (precioBs * cant).toFixed(0) + ' Bs';
    }

    function actualizarPreviewMonto() {
        const monto = parseFloat(inputMonto.value) || 0;
        const cantidadEquivalente = monto / precioBs;
        cantidadPreviewMonto.textContent = cantidadEquivalente.toFixed(3) + ' ' + unidad;
    }

    inputCantidad.addEventListener('input', actualizarPreviewCantidad);
    inputMonto.addEventListener('input', actualizarPreviewMonto);

    btnAgregar.addEventListener('click', function() {
        const modo = modoSelect.value;
        let cantidad, monto, tipoIngreso;

        if (modo === 'cantidad') {
            cantidad = parseFloat(inputCantidad.value);
            if (isNaN(cantidad) || cantidad <= 0) {
                mostrarNotificacion('Cantidad inválida', 'error');
                return;
            }
            monto = precioBs * cantidad;
            tipoIngreso = 'cantidad';
        } else {
            monto = parseFloat(inputMonto.value);
            if (isNaN(monto) || monto <= 0) {
                mostrarNotificacion('Monto inválido', 'error');
                return;
            }
            cantidad = +(monto / precioBs).toFixed(3);
            tipoIngreso = 'monto';
        }

        if (cantidad > producto.stock_actual) {
            mostrarNotificacion(`Stock insuficiente. Solo hay ${producto.stock_actual.toFixed(2)} ${unidad}`, 'error');
            return;
        }

        // Actualizar carrito (inmutable)
        const nuevoCarrito = [
            ...carritoVentas,
            {
                producto_id: producto.id,
                nombre: producto.nombre,
                cantidad,
                unidad,
                precio_unitario: precioBs,
                subtotal: monto,
                tipo_ingreso: tipoIngreso,
                detalle: tipoIngreso === 'cantidad' 
                    ? `${cantidad.toFixed(3)} ${unidad}`
                    : `Bs ${monto.toFixed(0)} (${cantidad.toFixed(3)} ${unidad})`
            }
        ];
        setCarritoVentas(nuevoCarrito);

        modal.remove();
        actualizarCarritoUI();
    });

    inputCantidad.focus();
}

// ============================================
// CARRITO UI
// ============================================
export function actualizarCarritoUI() {
    const container = document.getElementById('carrito-items');
    const totalSpan = document.getElementById('total-venta');

    if (!container) return;

    if (carritoVentas.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">Carrito vacío</p>';
        totalSpan.textContent = '0 Bs';
        return;
    }

    let total = 0;
    container.innerHTML = carritoVentas.map((item, index) => {
        total += item.subtotal;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                <div style="flex: 1;">
                    <div><strong>${item.nombre}</strong></div>
                    <div style="font-size: 12px; color: #666;">${item.detalle}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #2563eb;">${item.subtotal.toFixed(0)} Bs</span>
                    <button onclick="window.eliminarDelCarrito(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    totalSpan.textContent = total.toFixed(0) + ' Bs';
}

window.eliminarDelCarrito = function(index) {
    const nuevoCarrito = carritoVentas.filter((_, i) => i !== index);
    setCarritoVentas(nuevoCarrito);
    actualizarCarritoUI();
};

// ============================================
// FINALIZAR VENTA
// ============================================
function setupFinalizarVenta() {
    const btnFinalizar = document.getElementById('finalizar-venta');
    if (!btnFinalizar) return;
    
    btnFinalizar.addEventListener('click', async () => {
        if (carritoVentas.length === 0) {
            mostrarNotificacion('❌ El carrito está vacío', 'error');
            return;
        }
        
        const metodoPago = document.getElementById('metodo-pago').value;
        const total = carritoVentas.reduce((sum, item) => sum + item.subtotal, 0);
        
        const resumen = carritoVentas.map(item => 
            `${item.nombre} - ${item.detalle} = ${item.subtotal.toLocaleString()} Bs`
        ).join('\n');
        
        if (!confirm(`¿Registrar venta?\n\n${resumen}\n\nTOTAL: ${total.toLocaleString()} Bs\nMétodo: ${metodoPago}`)) {
            return;
        }
        
        try {
            // Verificar stock nuevamente
            for (const item of carritoVentas) {
                const producto = productos.find(p => p.id === item.producto_id);
                if (!producto || (producto.stock_actual || 0) < item.cantidad) {
                    mostrarNotificacion(`❌ Stock insuficiente para ${item.nombre}`, 'error');
                    return;
                }
            }
            
            const resultado = await registrarVenta({
                items: carritoVentas.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal,
                    tipo_ingreso: item.tipo_ingreso || null,
                    unidad: item.unidad
                })),
                total,
                metodoPago
            });
            
            if (resultado.success) {
                mostrarNotificacion('✅ Venta registrada exitosamente');
                setCarritoVentas([]);
                actualizarCarritoUI();
                
                // Actualizar productos (stock)
                const { cargarProductos } = await import('./productos.js');
                await cargarProductos();
                
                document.getElementById('buscador-ventas').value = '';
                document.getElementById('resultados-busqueda').innerHTML = 
                    '<div class="loading-message">Escribe para buscar productos...</div>';
                
                const activePage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
                if (activePage === 'dashboard') {
                    const { loadDashboard } = await import('./dashboard.js');
                    await loadDashboard();
                }
            }
        } catch (error) {
            console.error('Error registrando venta:', error);
            mostrarNotificacion('❌ Error al registrar la venta', 'error');
        }
    });
}