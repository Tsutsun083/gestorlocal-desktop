// productos.js - Funciones para la gestión de productos

import { productos, categorias, configuracion, setProductos, calcularPrecioBs } from './state.js';
import { getProductos, addProducto, updateProducto, deleteProducto } from './database.js';
import { crearModal, cerrarTodosLosModales, mostrarNotificacion } from './ui.js';

// ============================================
// CARGA INICIAL (llamada desde main.renderer)
// ============================================
export async function cargarProductos() {
    const prods = await getProductos();
    setProductos(prods || []);
}

// ============================================
// PÁGINA DE PRODUCTOS
// ============================================
export async function loadProductos() {
    const content = document.getElementById('page-content');
    if (!content) return;
    
    // Asegurar que productos esté actualizado
    await cargarProductos();
    
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
                                    ${stockActual.toFixed(2)}
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
                    await deleteProducto(parseInt(id));
                    mostrarNotificacion('✅ Producto eliminado');
                    await cargarProductos();
                    loadProductos(); // recargar la tabla
                    // También actualizar dashboard si es necesario
                    const { loadDashboard } = await import('./dashboard.js');
                    loadDashboard();
                } catch (error) {
                    mostrarNotificacion('❌ Error al eliminar', 'error');
                }
            }
        });
    });
}

// ============================================
// FORMULARIO DE PRODUCTO (CREAR/EDITAR)
// ============================================
export async function mostrarFormularioProducto(producto = null) {
    cerrarTodosLosModales();
    
    const isEdit = !!producto;
    const categoriasOptions = categorias.map(c => 
        `<option value="${c.id}" ${producto?.categoria_id == c.id ? 'selected' : ''}>
            ${c.icono || '📦'} ${c.nombre}
        </option>`
    ).join('');
    
    const contenido = `
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
            <label>Unidad de medida</label>
            <select id="producto-unidad" class="form-control">
                <option value="unidad" ${producto?.unidad_medida === 'unidad' ? 'selected' : ''}>Unidad</option>
                <option value="kg" ${producto?.unidad_medida === 'kg' ? 'selected' : ''}>Kilogramo (kg)</option>
                <option value="g" ${producto?.unidad_medida === 'g' ? 'selected' : ''}>Gramo (g)</option>
                <option value="l" ${producto?.unidad_medida === 'l' ? 'selected' : ''}>Litro (l)</option>
                <option value="ml" ${producto?.unidad_medida === 'ml' ? 'selected' : ''}>Mililitro (ml)</option>
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
        
        <div class="form-row">
            <div class="form-group">
                <label>Stock mínimo</label>
                <input type="number" id="producto-stock-min" min="0" step="0.01"
                       value="${producto?.stock_minimo || 5}" class="form-control">
            </div>
            <div class="form-group">
                <label>Stock actual</label>
                <input type="number" id="producto-stock-actual" min="0" step="0.01"
                       value="${producto?.stock_actual || 0}" class="form-control">
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn btn-secondary" id="btn-cancelar">Cancelar</button>
            <button class="btn btn-primary" id="guardar-producto">
                ${isEdit ? 'Actualizar' : 'Guardar'}
            </button>
        </div>
    `;
    
    const modal = crearModal(isEdit ? '✏️ Editar Producto' : '➕ Nuevo Producto', contenido);
    
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
    
    document.getElementById('btn-cancelar').addEventListener('click', () => modal.remove());
    
    document.getElementById('guardar-producto').addEventListener('click', async () => {
        const nombre = document.getElementById('producto-nombre').value.trim();
        if (!nombre) {
            mostrarNotificacion('⚠️ El nombre es obligatorio', 'error');
            return;
        }
        
        const tipo = document.getElementById('producto-tipo').value;
        const unidad = document.getElementById('producto-unidad').value;
        const productoData = {
            nombre,
            categoria_id: document.getElementById('producto-categoria').value || null,
            unidad_medida: unidad,
            stock_minimo: parseFloat(document.getElementById('producto-stock-min').value) || 5,
            stock_actual: parseFloat(document.getElementById('producto-stock-actual').value) || 0,
            usar_calculo_automatico: tipo === 'auto' ? 1 : 0
        };
        
        if (tipo === 'auto') {
            const precioUSD = parseFloat(document.getElementById('producto-precio-usd').value);
            if (isNaN(precioUSD) || precioUSD <= 0) {
                mostrarNotificacion('⚠️ Ingrese un precio USD válido', 'error');
                return;
            }
            productoData.precio_base_usd = precioUSD;
            productoData.margen_sugerido = parseInt(document.getElementById('producto-margen').value) || 30;
            productoData.precio_manual_bs = null;
        } else {
            const precioFijo = parseFloat(document.getElementById('producto-precio-fijo').value);
            if (isNaN(precioFijo) || precioFijo <= 0) {
                mostrarNotificacion('⚠️ Ingrese un precio fijo válido', 'error');
                return;
            }
            productoData.precio_manual_bs = precioFijo;
            productoData.precio_base_usd = null;
            productoData.margen_sugerido = null;
        }
        
        try {
            if (isEdit) {
                await updateProducto(producto.id, productoData);
                mostrarNotificacion('✅ Producto actualizado');
            } else {
                await addProducto(productoData);
                mostrarNotificacion('✅ Producto creado');
            }
            
            modal.remove();
            await cargarProductos();
            
            // Recargar página actual
            const activePage = document.querySelector('.nav-item.active').getAttribute('data-page');
            if (activePage === 'productos') {
                loadProductos();
            } else if (activePage === 'dashboard') {
                const { loadDashboard } = await import('./dashboard.js');
                loadDashboard();
            }
            
        } catch (error) {
            console.error(error);
            mostrarNotificacion('❌ Error al guardar', 'error');
        }
    });
    
    // Inicializar preview
    updatePreview();
}