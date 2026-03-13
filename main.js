const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

let mainWindow;
let db;
let dbReadyPromise;
let dbResolve;

// Promesa que se resolverá cuando la BD esté lista
dbReadyPromise = new Promise((resolve) => {
  dbResolve = resolve;
});

// ============================================
// BASE DE DATOS
// ============================================
function initDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, 'src/database/gestorlocal.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error:', err);
        reject(err);
        return;
      }
      console.log('✅ Conectado a SQLite');
      
      // Activar pragmas para mejorar concurrencia e integridad
      db.run("PRAGMA foreign_keys = ON");
      db.run("PRAGMA journal_mode = WAL");
      db.run("PRAGMA synchronous = NORMAL");
      
      crearTablas()
        .then(() => {
          crearIndices();
          dbResolve(); // Resolver la promesa cuando todo esté listo
          resolve();
        })
        .catch(reject);
    });
  });
}

function crearTablas() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabla de categorías
      db.run(`
        CREATE TABLE IF NOT EXISTS categorias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          icono TEXT DEFAULT '📦',
          color TEXT DEFAULT '#667eea',
          orden INTEGER DEFAULT 0,
          activa INTEGER DEFAULT 1
        )
      `);

      // Tabla de productos (con stock REAL)
      db.run(`
        CREATE TABLE IF NOT EXISTS productos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT UNIQUE,
          nombre TEXT NOT NULL,
          descripcion TEXT,
          categoria_id INTEGER,
          precio_compra_usd REAL,
          margen_sugerido REAL DEFAULT 30,
          precio_base_usd REAL,
          precio_manual_bs REAL,
          usar_calculo_automatico INTEGER DEFAULT 1,
          stock_actual REAL DEFAULT 0,
          stock_minimo REAL DEFAULT 5,
          unidad_medida TEXT DEFAULT 'unidad',
          activo INTEGER DEFAULT 1,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        )
      `);

      // Tabla de ventas
      db.run(`
        CREATE TABLE IF NOT EXISTS ventas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
          total REAL,
          metodo_pago TEXT,
          subtotal REAL,
          descuento REAL DEFAULT 0
        )
      `);

      // Tabla de detalles de venta (con cantidad REAL y unidad)
      db.run(`
        CREATE TABLE IF NOT EXISTS venta_detalles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER,
          producto_id INTEGER,
          cantidad REAL NOT NULL,
          precio_unitario REAL NOT NULL,
          subtotal REAL NOT NULL,
          tipo_ingreso TEXT,
          unidad TEXT,
          FOREIGN KEY (venta_id) REFERENCES ventas(id),
          FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
      `);

      // Agregar columna tipo_ingreso si no existe (por si acaso)
      db.all("PRAGMA table_info(venta_detalles)", (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(c => c.name);
          if (!columnNames.includes('tipo_ingreso')) {
            db.run("ALTER TABLE venta_detalles ADD COLUMN tipo_ingreso TEXT");
            console.log('✅ Columna tipo_ingreso agregada a venta_detalles');
          }
        }
      });

      // Tabla de configuración
      db.run(`
        CREATE TABLE IF NOT EXISTS configuracion (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          nombre_negocio TEXT DEFAULT 'Mi Negocio',
          tasa_bcv_actual REAL DEFAULT 50.00,
          fecha_actualizacion_tasa DATETIME,
          redondear_precios INTEGER DEFAULT 1,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (!err) {
          db.get(`SELECT * FROM configuracion WHERE id = 1`, (err, row) => {
            if (!row) {
              db.run(`INSERT INTO configuracion (id, nombre_negocio, tasa_bcv_actual) VALUES (1, 'Mi Negocio', 50.00)`);
            }
          });
        }
      });

      // Crear tabla virtual FTS5 para búsqueda avanzada
db.run(`
  CREATE VIRTUAL TABLE IF NOT EXISTS productos_fts USING fts5(
    nombre, 
    descripcion,
    content=productos,
    content_rowid=id
  )
`, function(err) {
  if (err) {
    console.error('Error creando tabla FTS5:', err);
  } else {
    console.log('✅ Tabla FTS5 creada/verificada');
    // Poblar la tabla FTS con los productos existentes
    db.run(`
      INSERT INTO productos_fts (rowid, nombre, descripcion)
      SELECT id, nombre, descripcion FROM productos
    `, function(err) {
      if (err) {
        console.error('Error poblando FTS5:', err);
      } else {
        console.log('✅ Tabla FTS5 poblada');
      }
    });
  }
});

// Triggers para mantener sincronizada la tabla FTS
db.run(`
  CREATE TRIGGER IF NOT EXISTS productos_ai AFTER INSERT ON productos BEGIN
    INSERT INTO productos_fts (rowid, nombre, descripcion) VALUES (new.id, new.nombre, new.descripcion);
  END;
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS productos_ad AFTER DELETE ON productos BEGIN
    INSERT INTO productos_fts (productos_fts, rowid, nombre, descripcion) VALUES('delete', old.id, old.nombre, old.descripcion);
  END;
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS productos_au AFTER UPDATE ON productos BEGIN
    INSERT INTO productos_fts (productos_fts, rowid, nombre, descripcion) VALUES('delete', old.id, old.nombre, old.descripcion);
    INSERT INTO productos_fts (rowid, nombre, descripcion) VALUES (new.id, new.nombre, new.descripcion);
  END;
`);

      // Insertar categorías por defecto
      const categoriasDefault = [
        ['Víveres', '🍚', '#2563eb', 1],
        ['Charcutería y Lácteos', '🧀', '#059669', 2],
        ['Chucherías y Snacks', '🍬', '#d97706', 3],
        ['Bebidas', '🥤', '#7c3aed', 4],
        ['Higiene y Limpieza', '🧼', '#dc2626', 5],
        ['Proteínas y Frescos', '🥩', '#0891b2', 6],
        ['Papelería', '📄', '#6b7280', 7],
        ['Panadería', '🍞', '#b45309', 8],
        ['Otros', '📦', '#4b5563', 9]
      ];
      
      const stmt = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, icono, color, orden) VALUES (?, ?, ?, ?)`);
      categoriasDefault.forEach(cat => stmt.run(cat));
      stmt.finalize();
      
      resolve();
    });
  });
}

// ============================================
// CREACIÓN DE ÍNDICES
// ============================================
function crearIndices() {
  db.serialize(() => {
    // Índice para búsquedas por nombre (agiliza la búsqueda en ventas)
    db.run("CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre)");
    
    // Índice para filtrar productos por categoría
    db.run("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)");
    
    // Índice para ventas por fecha (reportes diarios)
    db.run("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)");
    
    // Índice para detalles de venta por producto (productos más vendidos)
    db.run("CREATE INDEX IF NOT EXISTS idx_venta_detalles_producto ON venta_detalles(producto_id)");
    
    console.log('✅ Índices creados/verificados');
  });
}

// ============================================
// VENTANA PRINCIPAL
// ============================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'GestorLocal Desktop',
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, 'src/assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    frame: false,
    backgroundColor: '#f8fafc'
  });

  mainWindow.loadFile('index.html');
  
  // Abrir DevTools en desarrollo (comenta esta línea para producción)
  mainWindow.webContents.openDevTools();

  // Inicializar base de datos antes de mostrar la ventana
  initDatabase().catch(err => console.error('Error iniciando BD:', err));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (db) db.close();
  });
}

// ============================================
// FUNCIÓN DE BACKUP
// ============================================
function realizarBackup(origen = null) {
  if (!db) return { success: false, error: 'Base de datos no disponible' };
  
  const dbPath = origen || path.join(__dirname, 'src/database/gestorlocal.db');
  const backupDir = path.join(app.getPath('userData'), 'backups');
  
  // Crear carpeta de backups si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const fecha = new Date();
  const sufijo = `${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}_${fecha.getHours().toString().padStart(2,'0')}-${fecha.getMinutes().toString().padStart(2,'0')}-${fecha.getSeconds().toString().padStart(2,'0')}`;
  const backupPath = path.join(backupDir, `gestorlocal_${sufijo}.db`);
  
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup realizado en ${backupPath}`);
    return { success: true, path: backupPath };
  } catch (err) {
    console.error('❌ Error al realizar backup:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// MANEJADORES IPC (Comunicación con frontend)
// ============================================

// Helper para esperar a que la BD esté lista
async function withDbReady(fn) {
  await dbReadyPromise;
  return fn();
}

// Inicializar BD (ya no es necesario llamarlo desde el frontend, pero lo dejamos por compatibilidad)
ipcMain.handle('init-database', async () => {
  await dbReadyPromise;
  return { success: true, message: 'BD ya inicializada' };
});

// Obtener configuración
ipcMain.handle('get-configuracion', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM configuracion WHERE id = 1`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row || { tasa_bcv_actual: 50.00, nombre_negocio: 'Mi Negocio' });
      });
    });
  });
});

// Actualizar tasa BCV
ipcMain.handle('update-tasa-bcv', async (event, tasa) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE configuracion SET tasa_bcv_actual = ?, fecha_actualizacion_tasa = CURRENT_TIMESTAMP WHERE id = 1`, 
        [tasa], function(err) {
          if (err) reject(err);
          else resolve({ success: true });
        });
    });
  });
});

// Obtener categorías
ipcMain.handle('get-categorias', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM categorias WHERE activa = 1 ORDER BY orden`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
});

// Añadir producto (con validación)
ipcMain.handle('add-producto', async (event, producto) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const { 
        nombre, 
        precio_base_usd, 
        margen_sugerido, 
        categoria_id, 
        stock_minimo,
        stock_actual,
        usar_calculo_automatico,
        precio_manual_bs,
        unidad_medida 
      } = producto;

      if (stock_actual < 0 || stock_minimo < 0 || (precio_base_usd && precio_base_usd < 0) || (precio_manual_bs && precio_manual_bs < 0)) {
        return reject(new Error('Los valores de stock y precio no pueden ser negativos'));
      }
      
      const sql = `INSERT INTO productos (
        nombre, precio_base_usd, margen_sugerido, categoria_id, 
        stock_minimo, stock_actual, usar_calculo_automatico, precio_manual_bs, unidad_medida, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      
      db.run(sql, 
        [nombre, precio_base_usd, margen_sugerido, categoria_id, 
         stock_minimo, stock_actual, usar_calculo_automatico ? 1 : 0, precio_manual_bs, unidad_medida], 
        function(err) {
          if (err) {
            console.error('❌ Error insertando:', err);
            reject(err);
          } else {
            console.log('✅ Producto insertado ID:', this.lastID, 'Stock:', stock_actual);
            resolve({ id: this.lastID, success: true });
          }
        }
      );
    });
  });
});

// Obtener productos activos
ipcMain.handle('get-productos', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono 
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1
        ORDER BY p.nombre
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
});

// Búsqueda avanzada de productos con FTS5
ipcMain.handle('buscar-productos-fts', async (event, termino) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono
        FROM productos p
        JOIN (
          SELECT rowid FROM productos_fts WHERE productos_fts MATCH ?
        ) AS fts ON p.id = fts.rowid
        WHERE p.activo = 1
        ORDER BY p.nombre
      `;
      db.all(query, [termino], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
});

// Actualizar producto (con validación)
ipcMain.handle('update-producto', async (event, id, producto) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const { 
        nombre, 
        precio_base_usd, 
        margen_sugerido, 
        categoria_id, 
        stock_minimo,
        stock_actual,
        usar_calculo_automatico,
        precio_manual_bs,
        unidad_medida 
      } = producto;

      if (stock_actual < 0 || stock_minimo < 0 || (precio_base_usd && precio_base_usd < 0) || (precio_manual_bs && precio_manual_bs < 0)) {
        return reject(new Error('Los valores de stock y precio no pueden ser negativos'));
      }
      
      const sql = `UPDATE productos SET 
        nombre = COALESCE(?, nombre),
        precio_base_usd = COALESCE(?, precio_base_usd),
        margen_sugerido = COALESCE(?, margen_sugerido),
        categoria_id = COALESCE(?, categoria_id),
        stock_minimo = COALESCE(?, stock_minimo),
        stock_actual = COALESCE(?, stock_actual),
        usar_calculo_automatico = COALESCE(?, usar_calculo_automatico),
        precio_manual_bs = COALESCE(?, precio_manual_bs),
        unidad_medida = COALESCE(?, unidad_medida)
        WHERE id = ?`;
      
      db.run(sql, 
        [
          nombre || null,
          precio_base_usd || null,
          margen_sugerido || null,
          categoria_id || null,
          stock_minimo !== undefined ? stock_minimo : null,
          stock_actual !== undefined ? stock_actual : null,
          usar_calculo_automatico !== undefined ? usar_calculo_automatico : null,
          precio_manual_bs || null,
          unidad_medida || null,
          id
        ], 
        function(err) {
          if (err) {
            console.error('❌ Error SQL en update-producto:', err);
            reject(err);
          } else {
            console.log('✅ Producto actualizado ID:', id, 'Stock:', stock_actual, 'Unidad:', unidad_medida);
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  });
});

// Eliminar producto (borrado lógico)
ipcMain.handle('delete-producto', async (event, id) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE productos SET activo = 0 WHERE id = ?`, [id], function(err) {
        if (err) {
          console.error('Error eliminando:', err);
          reject(err);
        } else {
          console.log('✅ Producto eliminado ID:', id);
          resolve({ success: true });
        }
      });
    });
  });
});

// Registrar venta (incluye unidad en los detalles)
ipcMain.handle('registrar-venta', async (event, ventaData) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const { items, total, metodoPago } = ventaData;
      
      console.log('🔄 Iniciando registro de venta. Items:', items.length, 'Total:', total);
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          `INSERT INTO ventas (fecha, total, metodo_pago) VALUES (datetime('now', 'localtime'), ?, ?)`,
          [total, metodoPago],
          function(err) {
            if (err) {
              console.error('❌ Error insertando venta:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const ventaId = this.lastID;
            console.log('✅ Venta insertada con ID:', ventaId);
            
            let pendientes = items.length;
            let error = false;
            
            items.forEach((item, index) => {
              console.log(`Procesando item ${index}:`, item);
              
              const sql = `INSERT INTO venta_detalles 
                (venta_id, producto_id, cantidad, precio_unitario, subtotal, tipo_ingreso, unidad) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
              const params = [
                ventaId,
                item.producto_id,
                item.cantidad,
                item.precio_unitario,
                item.subtotal,
                item.tipo_ingreso || null,
                item.unidad || null
              ];
              
              db.run(sql, params, function(err) {
                if (err) {
                  console.error('❌ Error insertando detalle:', err);
                  console.error('SQL:', sql);
                  console.error('Params:', params);
                  error = true;
                } else {
                  console.log(`✅ Detalle insertado para producto ${item.producto_id}`);
                }
                
                db.run(
                  `UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?`,
                  [item.cantidad, item.producto_id, item.cantidad],
                  function(err) {
                    if (err) {
                      console.error('❌ Error actualizando stock:', err);
                      error = true;
                    } else {
                      console.log(`✅ Stock actualizado para producto ${item.producto_id}`);
                    }
                    
                    pendientes--;
                    if (pendientes === 0) {
                      if (error) {
                        console.error('❌ Errores detectados, haciendo ROLLBACK');
                        db.run('ROLLBACK');
                        reject(new Error('Error en la venta'));
                      } else {
                        db.run('COMMIT');
                        console.log('✅ Venta completada con éxito. ID:', ventaId);
                        resolve({ success: true, ventaId });
                      }
                    }
                  }
                );
              });
            });
          }
        );
      });
    });
  });
});

// Obtener ventas del día
ipcMain.handle('get-ventas-dia', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as cantidad,
          COALESCE(SUM(total), 0) as total
        FROM ventas 
        WHERE fecha >= datetime('now', 'start of day') 
          AND fecha < datetime('now', 'start of day', '+1 day')
      `;
      
      db.get(query, [], (err, row) => {
        if (err) {
          console.error('❌ Error obteniendo ventas del día:', err);
          reject(err);
        } else {
          const resultado = {
            cantidad: row?.cantidad || 0,
            total: row?.total || 0
          };
          resolve(resultado);
        }
      });
    });
  });
});
// ============================================
// REPORTES
// ============================================

// 1. Obtener el historial completo
ipcMain.handle('get-historial-ventas', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      // Traemos las últimas 100 ventas
      db.all("SELECT * FROM ventas ORDER BY fecha DESC LIMIT 100", [], (err, rows) => {
        if (err) {
          console.error('❌ Error obteniendo historial:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  });
});

// 2. Obtener los totales (Hoy, Semana, Mes)
ipcMain.handle('get-totales-reportes', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          SUM(CASE WHEN date(fecha) = date('now', 'localtime') THEN total ELSE 0 END) as hoy,
          SUM(CASE WHEN strftime('%Y-%W', fecha) = strftime('%Y-%W', 'now', 'localtime') THEN total ELSE 0 END) as semana,
          SUM(CASE WHEN strftime('%m-%Y', fecha) = strftime('%m-%Y', 'now', 'localtime') THEN total ELSE 0 END) as mes
        FROM ventas
      `;
      db.get(query, [], (err, row) => {
        if (err) {
          console.error('❌ Error calculando totales:', err);
          reject(err);
        } else {
          resolve({
            hoy: row?.hoy || 0,
            semana: row?.semana || 0,
            mes: row?.mes || 0
          });
        }
      });
    });
  });
});
// ============================================
// CONTROL DE VENTANAS
// ============================================
ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('realizar-backup', async () => {
  return realizarBackup();
});
ipcMain.on('close-window', () => mainWindow?.close());

// ============================================
// INICIO DE LA APLICACIÓN
// ============================================
app.commandLine.appendSwitch('enable-features', 'NativeNotifications');
app.commandLine.appendSwitch('disable-features', 'NetworkService');
app.commandLine.appendSwitch('disable-gpu-compositing');

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  realizarBackup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});