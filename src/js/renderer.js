// src/js/renderer.js - VERSIÓN FINAL CORREGIDA

// Estado de la aplicación
let configuracion = { 
    tasa_bcv: 50.00,
    nombre_negocio: 'Mi Negocio'
};
let categorias = [];
let productos = [];

// Cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ GestorLocal cargado');
    
    if (window.electronAPI) {
        console.log('🔌 electronAPI disponible');
        window.electronAPI.initDatabase()
            .then(() => cargarDatosIniciales())
            .catch(err => {
                console.error('Error:', err);
                cargarDatosDemo();
            });
    } else {
        console.warn('⚠️ Usando datos demo');
        cargarDatosDemo();
    }
    
    setupNavigation();
    setupButtons();
});

// Cargar datos iniciales
async function cargarDatosIniciales() {
    try {
        const config = await window.electronAPI.getConfiguracion();
        if (config) {
            configuracion = {
                tasa_bcv: config.tasa_bcv_actual || 50.00,
                nombre_negocio: config.nombre_negocio || 'Mi Negocio'
            };
        }
        
        categorias = await window.electronAPI.getCategorias() || [];
        productos = await window.electronAPI.getProductos() || [];
        
        console.log('✅ Datos cargados:', {
            config: configuracion,
            categorias: categorias.length,
            productos: productos.length
        });
        
        // Si no hay productos, insertar demo
        if (productos.length === 0) {
            console.log('📦 No hay productos, insertando demo...');
            await insertarProductosDemo();
            productos = await window.electronAPI.getProductos() || [];
        } else {
            // Verificar productos con stock 0
            const productosSinStock = productos.filter(p => (p.stock_actual || 0) === 0);
            if (productosSinStock.length > 0) {
                console.log(`⚠️ ${productosSinStock.length} productos con stock 0. Forzando actualización...`);
                
                for (const prod of productosSinStock) {
                    // Determinar stock según el nombre del producto
                    let stockNuevo = 10; // valor por defecto
                    const nombreLower = prod.nombre.toLowerCase();
                    
                    if (nombreLower.includes('pan')) stockNuevo = 10;
                    else if (nombreLower.includes('café') || nombreLower.includes('cafe')) stockNuevo = 15;
                    else if (nombreLower.includes('leche')) stockNuevo = 8;
                    else if (nombreLower.includes('queso')) stockNuevo = 6;
                    else if (nombreLower.includes('huevo')) stockNuevo = 12;
                    
                    console.log(`🔄 Actualizando ${prod.nombre} con stock ${stockNuevo}`);
                    
                    // 🔥 CORRECCIÓN: Crear objeto SOLO con los campos necesarios
                    const productoActualizado = {
                        nombre: prod.nombre,
                        categoria_id: prod.categoria_id,
                        stock_minimo: prod.stock_minimo || 5,
                        stock_actual: stockNuevo,
                        usar_calculo_automatico: prod.usar_calculo_automatico || 1,
                        precio_base_usd: prod.precio_base_usd,
                        margen_sugerido: prod.margen_sugerido,
                        precio_manual_bs: prod.precio_manual_bs
                    };
                    
                    try {
                        await window.electronAPI.updateProducto(prod.id, productoActualizado);
                        console.log(`✅ ${prod.nombre} actualizado`);
                    } catch (error) {
                        console.error(`❌ Error actualizando ${prod.nombre}:`, error);
                    }
                }
                
                // Recargar productos después de actualizar
                productos = await window.electronAPI.getProductos() || [];
                console.log('✅ Productos recargados:', productos.map(p => ({ 
                    nombre: p.nombre, 
                    stock: p.stock_actual 
                })));
            }
        }
        
        await loadDashboard();
    } catch (error) {
        console.error('Error cargando datos:', error);
        cargarDatosDemo();
    }
}
// Insertar productos de demostración con stock
async function insertarProductosDemo() {
    const productosDemo = [
        { nombre: 'Pan Canilla', precio_base_usd: 3.00, margen_sugerido: 30, categoria_id: 8, stock_minimo: 5, stock_actual: 10 },
        { nombre: 'Café', precio_base_usd: 2.50, margen_sugerido: 25, categoria_id: 4, stock_minimo: 5, stock_actual: 15 },
        { nombre: 'Leche', precio_base_usd: 3.50, margen_sugerido: 20, categoria_id: 2, stock_minimo: 5, stock_actual: 8 },
        { nombre: 'Queso', precio_base_usd: 5.00, margen_sugerido: 25, categoria_id: 2, stock_minimo: 3, stock_actual: 6 },
        { nombre: 'Huevos', precio_base_usd: 7.00, margen_sugerido: 28, categoria_id: 6, stock_minimo: 4, stock_actual: 12 }
    ];
    
    for (const prod of productosDemo) {
        try {
            await window.electronAPI.addProducto({
                ...prod,
                usar_calculo_automatico: 1,
                precio_manual_bs: null
            });
        } catch (error) {
            console.error('Error insertando producto demo:', error);
        }
    }
    console.log('✅ Productos demo insertados con stock');
}

// Datos de demostración (fallback)
function cargarDatosDemo() {
    configuracion = { tasa_bcv: 50.20, nombre_negocio: 'Panadería Demo' };
    categorias = [
        { id: 1, nombre: 'Panadería', icono: '🍞' },
        { id: 2, nombre: 'Bebidas', icono: '🥤' },
        { id: 3, nombre: 'Lácteos', icono: '🧀' }
    ];
    productos = [
        { id: 1, nombre: 'Pan Canilla', precio_base_usd: 3.00, margen_sugerido: 30,
          stock_actual: 10, stock_minimo: 5, categoria_nombre: 'Panadería', usar_calculo_automatico: 1 },
        { id: 2, nombre: 'Café', precio_base_usd: 2.50, margen_sugerido: 25,
          stock_actual: 15, stock_minimo: 5, categoria_nombre: 'Bebidas', usar_calculo_automatico: 1 },
        { id: 3, nombre: 'Leche', precio_base_usd: 3.50, margen_sugerido: 20,
          stock_actual: 8, stock_minimo: 5, categoria_nombre: 'Lácteos', usar_calculo_automatico: 1 }
    ];
    loadDashboard();
}

// Calcular precio en Bs
function calcularPrecioBs(producto) {
    if (!producto) return 0;
    if (!producto.usar_calculo_automatico && producto.precio_manual_bs) {
        return producto.precio_manual_bs;
    }
    const precioUSD = producto.precio_base_usd || 0;
    const margen = producto.margen_sugerido || 30;
    const tasa = configuracion.tasa_bcv || 50;
    return Math.round(precioUSD * (1 + margen/100) * tasa);
}

// Navegación
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
            
            if (page === 'dashboard') loadDashboard();
            else if (page === 'productos') loadProductos();
            else if (page === 'ventas') loadVentas();
            else loadPlaceholder(page, titles[page]);
        });
    });
}

// MODAL PARA ACTUALIZAR TASA
function mostrarModalTasa() {
    // Eliminar cualquier modal existente
    const modalesExistentes = document.querySelectorAll('.modal');
    modalesExistentes.forEach(modal => modal.remove());
    
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
    
    // Cancelar
    document.getElementById('cancelar-tasa').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Guardar
    document.getElementById('guardar-tasa').addEventListener('click', async () => {
        const nuevaTasa = parseFloat(document.getElementById('nueva-tasa').value);
        
        if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
            alert('⚠️ Ingrese un valor válido');
            return;
        }
        
        configuracion.tasa_bcv = nuevaTasa;
        
        if (window.electronAPI?.updateTasaBCV) {
            try {
                await window.electronAPI.updateTasaBCV(nuevaTasa);
                console.log('✅ Tasa actualizada');
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        document.body.removeChild(modal);
        
        const activePage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
        if (activePage === 'dashboard') loadDashboard();
        else if (activePage === 'productos') loadProductos();
    });
    
    // Cerrar con Escape
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    });
    
    document.getElementById('nueva-tasa').focus();
}

// DASHBOARD
async function loadDashboard() {
    const content = document.getElementById('page-content');
    if (!content) return;

    // Obtener ventas del día
    let ventasDia = { cantidad: 0, total: 0 };
    try {
        if (window.electronAPI?.getVentasDia) {
            console.log('📞 Llamando a getVentasDia...');
            ventasDia = await window.electronAPI.getVentasDia();
            console.log('📊 Ventas del día recibidas:', ventasDia);
            
            ventasDia = {
                cantidad: Number(ventasDia?.cantidad) || 0,
                total: Number(ventasDia?.total) || 0
            };
        } else {
            console.error('❌ electronAPI.getVentasDia no está disponible');
        }
    } catch (error) {
        console.error('❌ Error obteniendo ventas:', error);
    }
    
    const totalProductos = productos.length;
    const stockBajo = productos.filter(p => (p.stock_actual || 0) <= (p.stock_minimo || 5)).length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock_actual || 0), 0);
    
    content.innerHTML = `
        <div class="dashboard-grid">
            <div class="card card-primary">
                <div class="card-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="card-content">
                    <h3>Ventas Hoy</h3>
                    <p class="card-value">${ventasDia.total.toLocaleString()} Bs</p>
                    <small>${ventasDia.cantidad} transacciones - ${configuracion.nombre_negocio}</small>
                </div>
            </div>
            <div class="card card-success">
                <div class="card-icon"><i class="fas fa-boxes"></i></div>
                <div class="card-content">
                    <h3>Productos</h3>
                    <p class="card-value">${totalProductos}</p>
                    <small>Total en inventario</small>
                </div>
            </div>
            <div class="card card-warning" id="tasa-card" style="cursor:pointer;">
                <div class="card-icon"><i class="fas fa-chart-line"></i></div>
                <div class="card-content">
                    <h3>Tasa BCV</h3>
                    <p class="card-value">${configuracion.tasa_bcv.toFixed(2)} Bs/$</p>
                    <small>Click para actualizar</small>
                </div>
            </div>
            <div class="card card-danger">
                <div class="card-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="card-content">
                    <h3>Stock Total</h3>
                    <p class="card-value">${totalStock}</p>
                    <small>Unidades en inventario</small>
                </div>
            </div>
        </div>
        
        <div style="text-align: right; margin: 10px 0;">
            <button class="btn btn-secondary btn-sm" id="btn-refresh-dashboard">
                <i class="fas fa-sync-alt"></i> Actualizar Datos
            </button>
        </div>
        
        <div class="quick-actions">
            <h3>Acciones Rápidas</h3>
            <div class="actions-grid">
                <button class="action-btn" id="btn-quick-producto">
                    <i class="fas fa-plus-circle"></i> <span>Nuevo Producto</span>
                </button>
                <button class="action-btn" id="btn-quick-tasa">
                    <i class="fas fa-calculator"></i> <span>Actualizar Tasa</span>
                </button>
            </div>
        </div>
        
        <div class="recent-products">
            <h3>📦 Productos con Stock</h3>
            ${productos.filter(p => (p.stock_actual || 0) > 0).slice(0, 5).map(p => `
                <div class="product-row">
                    <div>
                        <strong>${p.nombre}</strong>
                        <span style="margin-left:10px; background:#e2e8f0; padding:2px 8px; border-radius:12px; font-size:11px;">
                            ${p.stock_actual || 0} und
                        </span>
                    </div>
                    <div class="product-price">${calcularPrecioBs(p).toLocaleString()} Bs</div>
                </div>
            `).join('')}
            ${productos.filter(p => (p.stock_actual || 0) === 0).length > 0 ? `
                <div style="margin-top:10px; padding:10px; background:#fee2e2; border-radius:8px; color:#dc2626; font-size:12px;">
                    ⚠️ ${productos.filter(p => (p.stock_actual || 0) === 0).length} productos sin stock
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('tasa-card').addEventListener('click', () => mostrarModalTasa());
    document.getElementById('btn-quick-producto')?.addEventListener('click', () => {
        document.querySelector('[data-page="productos"]').click();
        setTimeout(() => mostrarFormularioProducto(), 100);
    });
    document.getElementById('btn-quick-tasa')?.addEventListener('click', () => mostrarModalTasa());
    document.getElementById('btn-refresh-dashboard')?.addEventListener('click', async () => {
        console.log('🔄 Actualizando dashboard manualmente');
        await loadDashboard();
    });
} // ← ESTA LLAVE CIERRA LA FUNCIÓN loadDashboard

// PÁGINA DE PRODUCTOS
function loadProductos() {
    const content = document.getElementById('page-content');
    if (!content) return;
    
    content.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
            <h2>Gestión de Productos</h2>
            <button class="btn btn-primary" id="btn-nuevo-producto">
                <i class="fas fa-plus"></i> Nuevo Producto
            </button>
        </div>
        
        <div class="productos-table-container">
            <table class="productos-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Precio Bs</th>
                        <th>Stock Actual</th>
                        <th>Stock Mínimo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${productos.map(p => {
                        const stockActual = p.stock_actual || 0;
                        const stockMinimo = p.stock_minimo || 5;
                        const stockBajo = stockActual <= stockMinimo;
                        return `
                        <tr data-id="${p.id}">
                            <td>${p.nombre}</td>
                            <td>${p.categoria_nombre || 'Sin categoría'}</td>
                            <td class="text-right font-bold">${calcularPrecioBs(p).toLocaleString()} Bs</td>
                            <td class="text-center">
                                <span class="stock-badge ${stockBajo ? 'stock-bajo' : 'stock-normal'}">
                                    ${stockActual}
                                </span>
                            </td>
                            <td class="text-center">${stockMinimo}</td>
                            <td class="text-center">
                                ${stockActual === 0 ? '🔴 Sin stock' : 
                                  stockBajo ? '🟡 Stock bajo' : '🟢 Normal'}
                            </td>
                            <td class="text-center">
                                <button class="btn-icon btn-edit" data-id="${p.id}" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon btn-delete" data-id="${p.id}" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('btn-nuevo-producto').addEventListener('click', () => mostrarFormularioProducto());
    
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const producto = productos.find(p => p.id == id);
            if (producto) mostrarFormularioProducto(producto);
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const producto = productos.find(p => p.id == id);
            if (confirm(`¿Eliminar "${producto.nombre}"?`)) {
                try {
                    await window.electronAPI.deleteProducto(parseInt(id));
                    alert('✅ Producto eliminado');
                    productos = await window.electronAPI.getProductos() || [];
                    loadProductos();
                    loadDashboard();
                } catch (error) {
                    alert('❌ Error al eliminar');
                }
            }
        });
    });
}

// PÁGINA DE VENTAS
function loadVentas() {
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
                        <!-- Los productos aparecerán aquí -->
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
                        <span id="total-venta" class="total-valor">0,00 Bs</span>
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
    
    // Inicializar el buscador
    setupBuscadorVentas();

    // Configurar botón de finalizar venta
    setupFinalizarVenta();

    // Configurar botón de cancelar
    document.getElementById('cancelar-venta').addEventListener('click', () => {
        if (carritoVentas.length > 0) {
            if (confirm('¿Cancelar la venta actual?')) {
                carritoVentas = [];
                actualizarCarritoUI();
            }
        }
    });
}

// Configurar buscador de productos para ventas
function setupBuscadorVentas() {
    const buscador = document.getElementById('buscador-ventas');
    if (!buscador) return;
    
    let timeoutId;
    
    buscador.addEventListener('input', (e) => {
        const termino = e.target.value.trim();
        
        // Limpiar timeout anterior (para no buscar en cada letra)
        clearTimeout(timeoutId);
        
        if (termino.length < 2) {
            document.getElementById('resultados-busqueda').innerHTML = 
                '<div class="loading-message">Escribe al menos 2 caracteres...</div>';
            return;
        }
        
        // Esperar 300ms después de dejar de escribir
        timeoutId = setTimeout(() => {
            buscarProductosVenta(termino);
        }, 300);
    });
}

// Buscar productos en la base de datos
async function buscarProductosVenta(termino) {
    const resultadosDiv = document.getElementById('resultados-busqueda');
    resultadosDiv.innerHTML = '<div class="loading-message">Buscando...</div>';
    
    try {
        // Obtener todos los productos (ya los tenemos en memoria)
        // Filtrar localmente para mayor velocidad
        const resultados = productos.filter(p => 
            p.nombre.toLowerCase().includes(termino.toLowerCase()) &&
            p.activo !== 0
        );
        
        if (resultados.length === 0) {
            resultadosDiv.innerHTML = '<div class="loading-message">No se encontraron productos</div>';
            return;
        }
        
        // Mostrar resultados
        resultadosDiv.innerHTML = resultados.map(p => {
            const precioBs = calcularPrecioBs(p);
            const stockActual = p.stock_actual || 0;
            const stockClass = stockActual <= (p.stock_minimo || 5) ? 'stock-bajo' : 'stock-normal';
            
            return `
                <div class="producto-venta-card" data-id="${p.id}" 
                     onclick="agregarAlCarrito(${p.id})">
                    <div class="producto-nombre">${p.nombre}</div>
                    <div class="producto-precio">${precioBs.toLocaleString()} Bs</div>
                    <div class="producto-stock ${stockClass}">
                        Stock: ${stockActual}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error buscando productos:', error);
        resultadosDiv.innerHTML = '<div class="error-message">Error al buscar productos</div>';
    }
}

// Variable global para el carrito
let carritoVentas = [];

// Agregar producto al carrito
window.agregarAlCarrito = async function(productoId) {
    const producto = productos.find(p => p.id == productoId);
    if (!producto) return;
    
    const stockActual = producto.stock_actual || 0;
    if (stockActual <= 0) {
        alert('❌ Producto sin stock disponible');
        return;
    }
    
    // Buscar si ya está en el carrito
    const itemExistente = carritoVentas.find(item => item.id === productoId);
    
    if (itemExistente) {
        // Verificar stock
        if (itemExistente.cantidad >= stockActual) {
            alert('❌ No hay suficiente stock');
            return;
        }
        itemExistente.cantidad++;
    } else {
        carritoVentas.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: calcularPrecioBs(producto),
            cantidad: 1,
            stock: stockActual
        });
    }
    
    actualizarCarritoUI();
};

// Actualizar la interfaz del carrito
function actualizarCarritoUI() {
    const carritoDiv = document.getElementById('carrito-items');
    const totalSpan = document.getElementById('total-venta');
    
    if (carritoVentas.length === 0) {
        carritoDiv.innerHTML = '<div class="carrito-vacio">El carrito está vacío</div>';
        totalSpan.textContent = '0,00 Bs';
        return;
    }
    
    let total = 0;
    carritoDiv.innerHTML = carritoVentas.map(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        
        return `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <div class="carrito-item-nombre">${item.nombre}</div>
                    <div class="carrito-item-precio">${item.precio.toLocaleString()} Bs c/u</div>
                </div>
                <div class="carrito-item-cantidad">
                    <button class="btn-cantidad" onclick="cambiarCantidad(${item.id}, -1)">-</button>
                    <span>${item.cantidad}</span>
                    <button class="btn-cantidad" onclick="cambiarCantidad(${item.id}, 1)">+</button>
                </div>
                <div class="carrito-item-subtotal">
                    ${subtotal.toLocaleString()} Bs
                </div>
                <button class="btn-eliminar" onclick="eliminarDelCarrito(${item.id})">🗑️</button>
            </div>
        `;
    }).join('');
    
    totalSpan.textContent = total.toLocaleString() + ' Bs';
}

// Cambiar cantidad en el carrito
window.cambiarCantidad = function(productoId, delta) {
    const item = carritoVentas.find(i => i.id === productoId);
    if (!item) return;
    
    const nuevaCantidad = item.cantidad + delta;
    
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(productoId);
        return;
    }
    
    if (nuevaCantidad > item.stock) {
        alert('❌ No hay suficiente stock');
        return;
    }
    
    item.cantidad = nuevaCantidad;
    actualizarCarritoUI();
};

// Eliminar del carrito
window.eliminarDelCarrito = function(productoId) {
    carritoVentas = carritoVentas.filter(i => i.id !== productoId);
    actualizarCarritoUI();
};

// Configurar botón de finalizar venta
function setupFinalizarVenta() {
    const btnFinalizar = document.getElementById('finalizar-venta');
    if (!btnFinalizar) return;
    
    btnFinalizar.addEventListener('click', async () => {
        if (carritoVentas.length === 0) {
            alert('❌ El carrito está vacío');
            return;
        }
        
        const metodoPago = document.getElementById('metodo-pago').value;
        const total = carritoVentas.reduce((sum, item) => 
            sum + (item.precio * item.cantidad), 0
        );
        
        // Mostrar resumen de la venta
        const resumen = carritoVentas.map(item => 
            `${item.nombre} x${item.cantidad} = ${(item.precio * item.cantidad).toLocaleString()} Bs`
        ).join('\n');
        
        if (!confirm(`¿Registrar venta?\n\n${resumen}\n\nTOTAL: ${total.toLocaleString()} Bs\nMétodo: ${metodoPago}`)) {
            return;
        }
        
        try {
            // Verificar stock nuevamente
            for (const item of carritoVentas) {
                const producto = productos.find(p => p.id === item.id);
                if (!producto || (producto.stock_actual || 0) < item.cantidad) {
                    alert(`❌ Stock insuficiente para ${item.nombre}`);
                    return;
                }
            }
            
            const resultado = await window.electronAPI.registrarVenta({
                items: carritoVentas.map(item => ({
                    id: item.id,
                    cantidad: item.cantidad,
                    precio: item.precio
                })),
                total: total,
                metodoPago: metodoPago
            });
            
            if (resultado.success) {
                alert('✅ Venta registrada exitosamente');
                
                // Limpiar carrito
                carritoVentas = [];
                actualizarCarritoUI();
                
                // Recargar productos (para actualizar stock)
                productos = await window.electronAPI.getProductos() || [];
                
                // Limpiar búsqueda
                document.getElementById('buscador-ventas').value = '';
                document.getElementById('resultados-busqueda').innerHTML = 
                    '<div class="loading-message">Escribe para buscar productos...</div>';
                
                // 🔥 ACTUALIZAR DASHBOARD SI ESTAMOS EN ÉL
    const activePage = document.querySelector('.nav-item.active')?.getAttribute('data-page');
    if (activePage === 'dashboard') {
        await loadDashboard();
        console.log('📊 Dashboard actualizado con nuevas ventas');
    } 
    // Limpiar búsqueda
    document.getElementById('buscador-ventas').value = '';
    document.getElementById('resultados-busqueda').innerHTML = 
        '<div class="loading-message">Escribe para buscar productos...</div>';
                }
            }
        catch (error) {
            console.error('Error registrando venta:', error);
            alert('❌ Error al registrar la venta. Revisa la consola para más detalles.');
        }
    });
}

// FORMULARIO DE PRODUCTO - VERSIÓN CORREGIDA
function mostrarFormularioProducto(producto = null) {
    // Eliminar cualquier modal existente
    const modalesExistentes = document.querySelectorAll('.modal');
    modalesExistentes.forEach(modal => modal.remove());
    
    const isEdit = !!producto;
    const categoriasOptions = categorias.map(c => 
        `<option value="${c.id}" ${producto?.categoria_id == c.id ? 'selected' : ''}>
            ${c.icono || '📦'} ${c.nombre}
        </option>`
    ).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-tipo', 'producto');
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${isEdit ? '✏️ Editar' : '➕ Nuevo'} Producto</h3>
            
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="producto-nombre" value="${producto?.nombre || ''}" 
                       class="form-control" placeholder="Ej: Pan Canilla" autofocus>
            </div>
            
            <div class="form-group">
                <label>Categoría</label>
                <select id="producto-categoria" class="form-control">
                    <option value="">-- Seleccionar --</option>
                    ${categoriasOptions}
                </select>
            </div>
            
            <div class="form-group">
                <label>Tipo de precio</label>
                <select id="producto-tipo" class="form-control">
                    <option value="auto" ${(!producto || producto.usar_calculo_automatico) ? 'selected' : ''}>
                        Automático (USD + Margen)
                    </option>
                    <option value="fijo" ${(producto && !producto.usar_calculo_automatico) ? 'selected' : ''}>
                        Precio fijo en Bs
                    </option>
                </select>
            </div>
            
            <div id="auto-fields" style="display:${(!producto || producto.usar_calculo_automatico) ? 'block' : 'none'};">
                <div class="form-group">
                    <label>Precio base (USD)</label>
                    <input type="number" id="producto-precio-usd" step="0.01" min="0" 
                           value="${producto?.precio_base_usd || ''}" class="form-control" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Margen (%)</label>
                    <input type="number" id="producto-margen" min="0" max="1000" 
                           value="${producto?.margen_sugerido || 30}" class="form-control">
                </div>
                <div class="preview-price" id="preview-auto" style="background:#f0f9ff; padding:10px; border-radius:4px;">
                    Precio estimado: <strong>0 Bs</strong>
                </div>
            </div>
            
            <div id="fijo-fields" style="display:${(producto && !producto.usar_calculo_automatico) ? 'block' : 'none'};">
                <div class="form-group">
                    <label>Precio fijo (Bs)</label>
                    <input type="number" id="producto-precio-fijo" min="0" 
                           value="${producto?.precio_manual_bs || ''}" class="form-control" placeholder="0">
                </div>
            </div>
            
            <div class="form-row" style="display:flex; gap:15px;">
                <div class="form-group" style="flex:1;">
                    <label>Stock mínimo</label>
                    <input type="number" id="producto-stock-min" min="0" 
                           value="${producto?.stock_minimo || 5}" class="form-control">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Stock actual</label>
                    <input type="number" id="producto-stock-actual" min="0" 
                           value="${producto?.stock_actual || 0}" class="form-control">
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" id="btn-cancelar">Cancelar</button>
                <button class="btn btn-primary" id="guardar-producto">
                    ${isEdit ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Preview de precio
    const updatePreview = () => {
        if (document.getElementById('producto-tipo').value !== 'auto') return;
        const usd = parseFloat(document.getElementById('producto-precio-usd').value) || 0;
        const margen = parseFloat(document.getElementById('producto-margen').value) || 30;
        const tasa = configuracion.tasa_bcv || 50;
        const precio = Math.round(usd * (1 + margen/100) * tasa);
        document.getElementById('preview-auto').innerHTML = 
            `Precio estimado: <strong>${precio.toLocaleString()} Bs</strong> (tasa: ${tasa})`;
    };
    
    document.getElementById('producto-tipo').addEventListener('change', (e) => {
        const isAuto = e.target.value === 'auto';
        document.getElementById('auto-fields').style.display = isAuto ? 'block' : 'none';
        document.getElementById('fijo-fields').style.display = isAuto ? 'none' : 'block';
        if (isAuto) updatePreview();
    });
    
    document.getElementById('producto-precio-usd')?.addEventListener('input', updatePreview);
    document.getElementById('producto-margen')?.addEventListener('input', updatePreview);
    
    // Cancelar
    document.getElementById('btn-cancelar').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Guardar
    document.getElementById('guardar-producto').addEventListener('click', async () => {
        const nombre = document.getElementById('producto-nombre').value.trim();
        if (!nombre) {
            alert('⚠️ El nombre es obligatorio');
            return;
        }
        
        const tipo = document.getElementById('producto-tipo').value;
        const productoData = {
            nombre: nombre,
            categoria_id: document.getElementById('producto-categoria').value || null,
            stock_minimo: parseInt(document.getElementById('producto-stock-min').value) || 5,
            stock_actual: parseInt(document.getElementById('producto-stock-actual').value) || 0,
            usar_calculo_automatico: tipo === 'auto' ? 1 : 0
        };
        
        if (tipo === 'auto') {
            const precioUSD = parseFloat(document.getElementById('producto-precio-usd').value);
            if (isNaN(precioUSD) || precioUSD <= 0) {
                alert('⚠️ Ingrese un precio USD válido');
                return;
            }
            productoData.precio_base_usd = precioUSD;
            productoData.margen_sugerido = parseInt(document.getElementById('producto-margen').value) || 30;
            productoData.precio_manual_bs = null;
        } else {
            const precioFijo = parseInt(document.getElementById('producto-precio-fijo').value);
            if (isNaN(precioFijo) || precioFijo <= 0) {
                alert('⚠️ Ingrese un precio fijo válido');
                return;
            }
            productoData.precio_manual_bs = precioFijo;
            productoData.precio_base_usd = null;
            productoData.margen_sugerido = null;
        }
        
        try {
            if (isEdit) {
                await window.electronAPI.updateProducto(producto.id, productoData);
                alert('✅ Producto actualizado');
            } else {
                await window.electronAPI.addProducto(productoData);
                alert('✅ Producto creado');
            }
            
            // IMPORTANTE: Eliminar modal antes de recargar
            document.body.removeChild(modal);
            
            // Recargar datos
            productos = await window.electronAPI.getProductos() || [];
            const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
            if (activePage === 'productos') loadProductos();
            else if (activePage === 'dashboard') loadDashboard();
            
        } catch (error) {
            alert('❌ Error al guardar');
            console.error(error);
        }
    });
    
    // Cerrar con Escape
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    });
    
    document.getElementById('producto-nombre').focus();
    updatePreview();
}

// Placeholder
function loadPlaceholder(page, title) {
    document.getElementById('page-content').innerHTML = `
        <div class="coming-soon">
            <i class="fas fa-tools" style="font-size:64px; color:#666;"></i>
            <h2>${title}</h2>
            <p>Sección en desarrollo</p>
        </div>
    `;
}

// Botones principales
function setupButtons() {
    document.getElementById('btn-nueva-venta')?.addEventListener('click', () => {
        alert('🚧 Módulo de Ventas en desarrollo');
    });
    
    document.getElementById('btn-actualizar')?.addEventListener('click', async () => {
        if (window.electronAPI?.getProductos) {
            productos = await window.electronAPI.getProductos() || [];
        }
        const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
        if (activePage === 'dashboard') loadDashboard();
        else if (activePage === 'productos') loadProductos();
    });
}

// Estilos adicionales
const style = document.createElement('style');
style.textContent = `
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
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; border-radius: 12px; padding: 25px; width: 500px; max-width: 90%; max-height: 90%; overflow-y: auto; }
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
`;
document.head.appendChild(style);