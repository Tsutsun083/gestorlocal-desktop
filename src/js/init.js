// init.js - Inicialización de datos (productos demo, verificación de stock)

import { setConfiguracion, setCategorias, setProductos, configuracion } from './state.js';
import { getConfiguracion, getCategorias, getProductos, updateProducto, addProducto } from './database.js';

export async function cargarDatosIniciales() {
    try {
        const config = await getConfiguracion();
        if (config) {
            setConfiguracion({
                tasa_bcv: config.tasa_bcv_actual || 50.00,
                nombre_negocio: config.nombre_negocio || 'Mi Negocio'
            });
        }
        
        const cats = await getCategorias();
        setCategorias(cats || []);
        
        let prods = await getProductos();
        setProductos(prods || []);
        
        console.log('✅ Datos cargados:', {
            config: configuracion,
            categorias: cats.length,
            productos: prods.length
        });
        
        // Si no hay productos, insertar demo
        if (prods.length === 0) {
            console.log('📦 No hay productos, insertando demo...');
            await insertarProductosDemo();
            prods = await getProductos();
            setProductos(prods || []);
        } else {
            // Verificar productos con stock 0
            const productosSinStock = prods.filter(p => (p.stock_actual || 0) === 0);
            if (productosSinStock.length > 0) {
                console.log(`⚠️ ${productosSinStock.length} productos con stock 0. Forzando actualización...`);
                
                for (const prod of productosSinStock) {
                    let stockNuevo = 10;
                    const nombreLower = prod.nombre.toLowerCase();
                    
                    if (nombreLower.includes('pan')) stockNuevo = 10;
                    else if (nombreLower.includes('café') || nombreLower.includes('cafe')) stockNuevo = 15;
                    else if (nombreLower.includes('leche')) stockNuevo = 8;
                    else if (nombreLower.includes('queso')) stockNuevo = 6;
                    else if (nombreLower.includes('huevo')) stockNuevo = 12;
                    
                    console.log(`🔄 Actualizando ${prod.nombre} con stock ${stockNuevo}`);
                    
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
                        await updateProducto(prod.id, productoActualizado);
                        console.log(`✅ ${prod.nombre} actualizado`);
                    } catch (error) {
                        console.error(`❌ Error actualizando ${prod.nombre}:`, error);
                    }
                }
                
                prods = await getProductos();
                setProductos(prods || []);
                console.log('✅ Productos recargados:', prods.map(p => ({ nombre: p.nombre, stock: p.stock_actual })));
            }
        }
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
            await addProducto({
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
    setConfiguracion({ tasa_bcv: 50.20, nombre_negocio: 'Panadería Demo' });
    setCategorias([
        { id: 1, nombre: 'Panadería', icono: '🍞' },
        { id: 2, nombre: 'Bebidas', icono: '🥤' },
        { id: 3, nombre: 'Lácteos', icono: '🧀' }
    ]);
    setProductos([
        { id: 1, nombre: 'Pan Canilla', precio_base_usd: 3.00, margen_sugerido: 30,
          stock_actual: 10, stock_minimo: 5, categoria_nombre: 'Panadería', usar_calculo_automatico: 1 },
        { id: 2, nombre: 'Café', precio_base_usd: 2.50, margen_sugerido: 25,
          stock_actual: 15, stock_minimo: 5, categoria_nombre: 'Bebidas', usar_calculo_automatico: 1 },
        { id: 3, nombre: 'Leche', precio_base_usd: 3.50, margen_sugerido: 20,
          stock_actual: 8, stock_minimo: 5, categoria_nombre: 'Lácteos', usar_calculo_automatico: 1 }
    ]);
    // loadDashboard se llamará después desde main.renderer
}