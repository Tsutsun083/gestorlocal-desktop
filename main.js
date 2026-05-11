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
      
      db.run("PRAGMA foreign_keys = ON");
      db.run("PRAGMA journal_mode = WAL");
      db.run("PRAGMA synchronous = NORMAL");
      
      crearTablas()
        .then(() => {
          crearIndices();
          dbResolve();
          resolve();
        })
        .catch(reject);
    });
  });
}

function crearTablas() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {

      //Creamos la tabla de usuarios
      db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        rol TEXT
    )`, (err) => {
        if (err) return reject(err);

        // Una vez creada, verificamos si está vacía para meter los usuarios iniciales
        db.get("SELECT COUNT(*) as count FROM usuarios", (err, row) => {
          if (row && row.count === 0) {
              const stmt = db.prepare("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)");
              stmt.run("admin", "admin123", "admin"); // El jefe
              stmt.run("vendedor", "ventas123", "vendedor"); // El trabajador
              stmt.finalize();
              console.log("✅ Usuarios iniciales creados: admin/admin123 y vendedor/ventas123");
          }
      });
    });
    // Categorías
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

      // Productos
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
          marca TEXT,
          proveedor_id INTEGER,
          fecha_vencimiento DATE,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id),
          FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        )
      `);

      // Ventas
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

      // Detalles de venta
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

      // Proveedores
      db.run(`
        CREATE TABLE IF NOT EXISTS proveedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rubro TEXT,
          nombre_empresa TEXT NOT NULL,
          nombre_contacto TEXT,
          telefono TEXT,
          direccion TEXT,
          fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
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
      // Tabla de clientes
      db.run(`
         CREATE TABLE IF NOT EXISTS clientes (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          ci TEXT UNIQUE,
          telefono TEXT,
          fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
          deuda REAL DEFAULT 0
         )
      `);
        // Agregar columna cliente_id a ventas si no existe
      db.all("PRAGMA table_info(ventas)", (err, columns) => {
        if (!err && columns) {
          const hasClienteId = columns.some(c => c.name === 'cliente_id');
        if (!hasClienteId) {
          db.run("ALTER TABLE ventas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id)");
          console.log('✅ Columna cliente_id agregada a la tabla ventas');
          }
        }
      });

      // Órdenes de compra
      db.run(`
        CREATE TABLE IF NOT EXISTS ordenes_compra (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          proveedor_id INTEGER,
          fecha_orden DATETIME DEFAULT CURRENT_TIMESTAMP,
          fecha_recibido DATETIME,
          estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'recibido', 'cancelado')),
          total REAL,
          observaciones TEXT,
          FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        )
      `);

      // Detalles de compra
      db.run(`
        CREATE TABLE IF NOT EXISTS detalle_compra (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          orden_id INTEGER,
          producto_id INTEGER,
          cantidad REAL NOT NULL,
          precio_unitario REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY (orden_id) REFERENCES ordenes_compra(id),
          FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
      `);

      // Configuración
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

      // FTS5 para búsqueda avanzada
      db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS productos_fts USING fts5(
          nombre, 
          descripcion,
          content=productos,
          content_rowid=id
        )
      `, function(err) {
        if (!err) {
          db.run(`INSERT INTO productos_fts (rowid, nombre, descripcion) SELECT id, nombre, descripcion FROM productos`);
        }
      });

      // Triggers FTS5
      db.run(`CREATE TRIGGER IF NOT EXISTS productos_ai AFTER INSERT ON productos BEGIN
        INSERT INTO productos_fts (rowid, nombre, descripcion) VALUES (new.id, new.nombre, new.descripcion);
      END;`);
      db.run(`CREATE TRIGGER IF NOT EXISTS productos_ad AFTER DELETE ON productos BEGIN
        INSERT INTO productos_fts (productos_fts, rowid, nombre, descripcion) VALUES('delete', old.id, old.nombre, old.descripcion);
      END;`);
      db.run(`CREATE TRIGGER IF NOT EXISTS productos_au AFTER UPDATE ON productos BEGIN
        INSERT INTO productos_fts (productos_fts, rowid, nombre, descripcion) VALUES('delete', old.id, old.nombre, old.descripcion);
        INSERT INTO productos_fts (rowid, nombre, descripcion) VALUES (new.id, new.nombre, new.descripcion);
      END;`);

      // Categorías por defecto
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
// ÍNDICES
// ============================================
function crearIndices() {
  db.serialize(() => {
    db.run("CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre)");
    db.run("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)");
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
  mainWindow.webContents.openDevTools();
  initDatabase().catch(err => console.error('Error iniciando BD:', err));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (db) db.close();
  });
}

// ============================================
// BACKUP
// ============================================
function realizarBackup(origen = null) {
  if (!db) return { success: false, error: 'Base de datos no disponible' };
  const dbPath = origen || path.join(__dirname, 'src/database/gestorlocal.db');
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
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
// HELPER PARA ESPERAR BD
// ============================================
async function withDbReady(fn) {
  await dbReadyPromise;
  return fn();
}

// ============================================
// MANEJADORES IPC - CONFIGURACIÓN
// ============================================
ipcMain.handle('init-database', async () => {
  await dbReadyPromise;
  return { success: true, message: 'BD ya inicializada' };
});

ipcMain.handle('get-configuracion', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.get(`SELECT * FROM configuracion WHERE id = 1`, [], (err, row) => {
      if (err) reject(err);
      else resolve(row || { tasa_bcv_actual: 50.00, nombre_negocio: 'Mi Negocio' });
    });
  }));
});

ipcMain.handle('update-tasa-bcv', async (event, tasa) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.run(`UPDATE configuracion SET tasa_bcv_actual = ?, fecha_actualizacion_tasa = CURRENT_TIMESTAMP WHERE id = 1`, [tasa], function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  }));
});

ipcMain.handle('realizar-backup', async () => realizarBackup());

// ============================================
// MANEJADORES IPC - PRODUCTOS
// ============================================
ipcMain.handle('get-categorias', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM categorias WHERE activa = 1 ORDER BY orden`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }));
});

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
        unidad_medida,
        marca,                 // ← nuevo
        proveedor_id,          // ← nuevo
        fecha_vencimiento      // ← nuevo
      } = producto;

      if (stock_actual < 0 || stock_minimo < 0 || (precio_base_usd && precio_base_usd < 0) || (precio_manual_bs && precio_manual_bs < 0)) {
        return reject(new Error('Los valores de stock y precio no pueden ser negativos'));
      }
      
      const sql = `INSERT INTO productos (
        nombre, precio_base_usd, margen_sugerido, categoria_id, 
        stock_minimo, stock_actual, usar_calculo_automatico, precio_manual_bs, unidad_medida,
        marca, proveedor_id, fecha_vencimiento, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      
      db.run(sql, 
        [
          nombre, 
          precio_base_usd, 
          margen_sugerido, 
          categoria_id, 
          stock_minimo, 
          stock_actual, 
          usar_calculo_automatico ? 1 : 0, 
          precio_manual_bs, 
          unidad_medida,
          marca || null,
          proveedor_id || null,
          fecha_vencimiento || null
        ], 
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
ipcMain.handle('get-productos', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono, 
               pr.nombre_empresa as nombre_proveedor
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
        WHERE p.activo = 1
        ORDER BY p.nombre
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
});

ipcMain.handle('buscar-productos-fts', async (event, termino) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const query = `SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono FROM productos p JOIN (SELECT rowid FROM productos_fts WHERE productos_fts MATCH ?) AS fts ON p.id = fts.rowid WHERE p.activo = 1 ORDER BY p.nombre`;
    db.all(query, [termino], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }));
});

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
        unidad_medida,
        marca,                 // ← nuevo
        proveedor_id,          // ← nuevo
        fecha_vencimiento      // ← nuevo
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
        unidad_medida = COALESCE(?, unidad_medida),
        marca = COALESCE(?, marca),
        proveedor_id = COALESCE(?, proveedor_id),
        fecha_vencimiento = COALESCE(?, fecha_vencimiento)
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
          marca || null,
          proveedor_id !== undefined && proveedor_id !== null ? proveedor_id : null,
          fecha_vencimiento || null,
          id
        ], 
        function(err) {
          if (err) {
            console.error('❌ Error SQL en update-producto:', err);
            reject(err);
          } else {
            console.log('✅ Producto actualizado ID:', id, 'Stock:', stock_actual);
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  });
});

ipcMain.handle('delete-producto', async (event, id) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.run(`UPDATE productos SET activo = 0 WHERE id = ?`, [id], function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  }));
});

ipcMain.handle('get-productos-stock-bajo', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT id, nombre, stock_actual, stock_minimo, unidad_medida
        FROM productos
        WHERE activo = 1 AND stock_actual <= stock_minimo
        ORDER BY (stock_actual / stock_minimo) ASC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
});


// ============================================
// MANEJADORES IPC - VENTAS
// ============================================
ipcMain.handle('registrar-venta', async (event, ventaData) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const { items, total, metodoPago } = ventaData;
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`INSERT INTO ventas (fecha, total, metodo_pago) VALUES (datetime('now', 'localtime'), ?, ?)`, [total, metodoPago], function(err) {
        if (err) { db.run('ROLLBACK'); reject(err); return; }
        const ventaId = this.lastID;
        let pendientes = items.length;
        let error = false;
        items.forEach(item => {
          const sql = `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal, tipo_ingreso, unidad) VALUES (?, ?, ?, ?, ?, ?, ?)`;
          const params = [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal, item.tipo_ingreso || null, item.unidad || null];
          db.run(sql, params, function(err) {
            if (err) error = true;
            db.run(`UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?`, [item.cantidad, item.producto_id, item.cantidad], function(err) {
              if (err) error = true;
              pendientes--;
              if (pendientes === 0) {
                if (error) { db.run('ROLLBACK'); reject(new Error('Error en la venta')); }
                else { db.run('COMMIT'); resolve({ success: true, ventaId }); }
              }
            });
          });
        });
      });
    });
  }));
});

ipcMain.handle('get-ventas-dia', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total FROM ventas WHERE fecha >= datetime('now', 'start of day') AND fecha < datetime('now', 'start of day', '+1 day')`;
    db.get(query, [], (err, row) => {
      if (err) reject(err);
      else resolve({ cantidad: row?.cantidad || 0, total: row?.total || 0 });
    });
  }));
});

// ============================================
// MANEJADORES IPC - PROVEEDORES
// ============================================
ipcMain.handle('get-proveedores', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM proveedores ORDER BY nombre_empresa`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }));
});

ipcMain.handle('add-proveedor', async (event, proveedor) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const { rubro, nombre_empresa, nombre_contacto, telefono, direccion } = proveedor;
    db.run(`INSERT INTO proveedores (rubro, nombre_empresa, nombre_contacto, telefono, direccion) VALUES (?, ?, ?, ?, ?)`, [rubro, nombre_empresa, nombre_contacto, telefono, direccion], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  }));
});

ipcMain.handle('update-proveedor', async (event, id, proveedor) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const { rubro, nombre_empresa, nombre_contacto, telefono, direccion } = proveedor;
    db.run(`UPDATE proveedores SET rubro=?, nombre_empresa=?, nombre_contacto=?, telefono=?, direccion=? WHERE id=?`, [rubro, nombre_empresa, nombre_contacto, telefono, direccion, id], function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  }));
});

ipcMain.handle('delete-proveedor', async (event, id) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.run(`DELETE FROM proveedores WHERE id=?`, [id], function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  }));
});

// ============================================
// MANEJADORES IPC - ÓRDENES DE COMPRA
// ============================================
ipcMain.handle('crear-orden-compra', async (event, ordenData) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const { proveedor_id, observaciones, items } = ordenData;
    let total = items.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`INSERT INTO ordenes_compra (proveedor_id, total, observaciones) VALUES (?, ?, ?)`, [proveedor_id, total, observaciones], function(err) {
        if (err) { db.run('ROLLBACK'); reject(err); return; }
        const ordenId = this.lastID;
        let pendientes = items.length;
        let error = false;
        items.forEach(item => {
          const subtotal = item.cantidad * item.precio_unitario;
          db.run(`INSERT INTO detalle_compra (orden_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)`, [ordenId, item.producto_id, item.cantidad, item.precio_unitario, subtotal], function(err) {
            if (err) error = true;
            pendientes--;
            if (pendientes === 0) {
              if (error) { db.run('ROLLBACK'); reject(new Error('Error al insertar detalles')); }
              else { db.run('COMMIT'); resolve({ id: ordenId }); }
            }
          });
        });
      });
    });
  }));
});

ipcMain.handle('recibir-orden', async (event, ordenId, itemsModificados) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`UPDATE ordenes_compra SET estado='recibido', fecha_recibido=CURRENT_TIMESTAMP WHERE id=?`, [ordenId], function(err) {
        if (err) { db.run('ROLLBACK'); reject(err); return; }
        let pendientes = itemsModificados.length;
        let error = false;
        itemsModificados.forEach(item => {
          db.run(`UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?`, [item.cantidadRecibida, item.producto_id], function(err) {
            if (err) error = true;
            pendientes--;
            if (pendientes === 0) {
              if (error) { db.run('ROLLBACK'); reject(new Error('Error al actualizar stock')); }
              else { db.run('COMMIT'); resolve({ success: true }); }
            }
          });
        });
      });
    });
  }));
});

ipcMain.handle('get-ordenes-compra', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const sql = `SELECT o.*, p.nombre_empresa FROM ordenes_compra o LEFT JOIN proveedores p ON o.proveedor_id = p.id ORDER BY o.fecha_orden DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }));
});

ipcMain.handle('get-orden-detalle', async (event, ordenId) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const sql = `SELECT d.*, p.nombre FROM detalle_compra d JOIN productos p ON d.producto_id = p.id WHERE d.orden_id = ?`;
    db.all(sql, [ordenId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }));
});

ipcMain.handle('update-orden-compra', async (event, id, datos) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const { estado, fecha_recibido } = datos;
    db.run(`UPDATE ordenes_compra SET estado = ?, fecha_recibido = ? WHERE id = ?`, [estado, fecha_recibido || null, id], function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  }));
});

ipcMain.handle('update-orden-completa', async (event, ordenId, ordenData) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const { proveedor_id, observaciones, items, total } = ordenData;
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`UPDATE ordenes_compra SET proveedor_id = ?, observaciones = ?, total = ? WHERE id = ?`, [proveedor_id, observaciones, total, ordenId], function(err) {
        if (err) { db.run('ROLLBACK'); reject(err); return; }
        db.run(`DELETE FROM detalle_compra WHERE orden_id = ?`, [ordenId], function(err) {
          if (err) { db.run('ROLLBACK'); reject(err); return; }
          let pendientes = items.length;
          let error = false;
          items.forEach(item => {
            const subtotal = item.cantidad * item.precio_unitario;
            db.run(`INSERT INTO detalle_compra (orden_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)`, [ordenId, item.producto_id, item.cantidad, item.precio_unitario, subtotal], function(err) {
              if (err) error = true;
              pendientes--;
              if (pendientes === 0) {
                if (error) { db.run('ROLLBACK'); reject(new Error('Error al actualizar detalles')); }
                else { db.run('COMMIT'); resolve({ success: true }); }
              }
            });
          });
        });
      });
    });
  }));
});

// ============================================
// MANEJADORES IPC - REPORTES
// ============================================
ipcMain.handle('get-historial-ventas', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    db.all("SELECT * FROM ventas ORDER BY fecha DESC LIMIT 100", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  }));
});

ipcMain.handle('get-totales-reportes', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const query = `SELECT SUM(CASE WHEN date(fecha) = date('now', 'localtime') THEN total ELSE 0 END) as hoy, SUM(CASE WHEN strftime('%Y-%W', fecha) = strftime('%Y-%W', 'now', 'localtime') THEN total ELSE 0 END) as semana, SUM(CASE WHEN strftime('%m-%Y', fecha) = strftime('%m-%Y', 'now', 'localtime') THEN total ELSE 0 END) as mes FROM ventas`;
    db.get(query, [], (err, row) => {
      if (err) reject(err);
      else resolve({ hoy: row?.hoy || 0, semana: row?.semana || 0, mes: row?.mes || 0 });
    });
  }));
});

// ============================================
// CONTROL DE VENTANAS
// ============================================
ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
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

// ============================================
// CLIENTES Y CUENTAS POR COBRAR
// ============================================

ipcMain.handle('get-clientes', async () => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM clientes ORDER BY nombre", [], (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });
  });
});

ipcMain.handle('add-cliente', async (event, cliente) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO clientes (nombre, ci, telefono) VALUES (?, ?, ?)`;
      db.run(sql, [cliente.nombre, cliente.ci, cliente.telefono], function(err) {
        if (err) reject(err); else resolve({ success: true, id: this.lastID });
      });
    });
  });
});

// ESTA ES LA JOYA DE LA CORONA: El Abono
ipcMain.handle('abonar-deuda', async (event, data) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const { clienteId, monto, metodoPago } = data;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Le bajamos la cuenta al cliente
        db.run(`UPDATE clientes SET deuda = deuda - ? WHERE id = ?`, [monto, clienteId], (err) => {
            if (err) { db.run('ROLLBACK'); return reject(err); }
        });

        // 2. Registramos la entrada de dinero en la tabla de ventas pa' los reportes
        // Le ponemos subtotal 0, pero total = monto para que no descuadre inventario
        db.run(
          `INSERT INTO ventas (fecha, total, metodo_pago, subtotal, descuento, cliente_id) 
           VALUES (datetime('now', 'localtime'), ?, ?, 0, 0, ?)`,
          [monto, metodoPago, clienteId],
          function(err) {
            if (err) {
                db.run('ROLLBACK'); 
                return reject(err);
            }
            
            // Listo, sellado y guardado
            db.run('COMMIT');
            resolve({ success: true, ventaId: this.lastID });
          }
        );
      });
    });
  });
});

ipcMain.handle('asignar-deuda', async (event, data) => {
  return new Promise((resolve, reject) => {
    const { clienteId, monto } = data;    
    db.run(`UPDATE clientes SET deuda = deuda + ? WHERE id = ?`, [monto, clienteId], (err) => {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});
// ============================================
// MANEJADORES IPC - LOGIN
// ============================================
ipcMain.handle('validar-login', async (event, { user, pass }) => {
    return new Promise((resolve) => {
        db.get("SELECT id, username, rol FROM usuarios WHERE username = ? AND password = ?", 
        [user, pass], (err, row) => {
            if (err) {
                resolve({ success: false, message: "Error en la base de datos" });
            } else if (row) {
                resolve({ success: true, usuario: row });
            } else {
                resolve({ success: false, message: "Usuario o clave incorrectos" });
            }
        });
    });
});