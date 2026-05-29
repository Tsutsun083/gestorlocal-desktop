const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let db;
let dbReadyPromise;
let dbResolve;

// Promesa que se resolverá cuando la BD esté lista
dbReadyPromise = new Promise((resolve) => {
  dbResolve = resolve;
});

// Función para encriptar claves y que no queden en texto plano
function encriptarClave(clave) {
    return crypto.createHash('sha256').update(clave).digest('hex');
}
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
              
              // ¡Aquí encriptamos las claves iniciales!
              const adminClave = encriptarClave("admin123");
              const vendedorClave = encriptarClave("ventas123");
              
              stmt.run("admin", adminClave, "admin"); // El jefe
              stmt.run("vendedor", vendedorClave, "vendedor"); // El trabajador
              stmt.finalize();
              console.log("✅ Usuarios iniciales creados y encriptados");
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
          const columnNames = columns.map(c => c.name);
          
          if (!columnNames.includes('cliente_id')) {
            db.run("ALTER TABLE ventas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id)");
            console.log('✅ Columna cliente_id agregada a la tabla ventas');
          }
          
          // ¡AQUÍ ESTÁ LA NUEVA COLUMNA PA' CONGELAR LA TASA!
          if (!columnNames.includes('tasa_bcv')) {
            db.run("ALTER TABLE ventas ADD COLUMN tasa_bcv REAL");
            console.log('✅ Columna tasa_bcv agregada a la tabla ventas');
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

            // Tabla de configuración
      db.run(`
        CREATE TABLE IF NOT EXISTS configuracion (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          nombre_negocio TEXT DEFAULT 'Mi Negocio',
          tasa_bcv_actual REAL DEFAULT 50.00,
          fecha_actualizacion_tasa DATETIME,
          redondear_precios INTEGER DEFAULT 1,
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          rif TEXT,
          pago_movil_info TEXT,
          tema TEXT DEFAULT 'claro',
          color_primario TEXT DEFAULT '#2563eb'
        )
      `, function(err) {
        if (!err) {
          // Verificar si ya existe una fila; si no, insertar con los valores por defecto
          db.get(`SELECT * FROM configuracion WHERE id = 1`, (err, row) => {
            if (!row) {
              db.run(`
                INSERT INTO configuracion 
                (id, nombre_negocio, tasa_bcv_actual, rif, pago_movil_info, tema, color_primario) 
                VALUES (1, 'Mi Negocio', 50.00, '', '', 'claro', '#2563eb')
              `, function(err) {
                if (err) console.error('Error insertando configuración inicial:', err);
                else console.log('✅ Configuración inicial insertada');
              });
            } else {
              // Si la fila ya existe pero le faltan columnas, agregarlas (seguridad adicional)
              // (opcional, ya lo harán los ALTER TABLE después)
            }
          });
        }
      });

      // Después de crear la tabla, asegurar que todas las columnas existan (por si la tabla era antigua)
      db.all("PRAGMA table_info(configuracion)", (err, columns) => {
        if (!err && columns) {
          const columnNames = columns.map(c => c.name);
          const nuevasColumnas = [
            { name: 'rif', sql: "ALTER TABLE configuracion ADD COLUMN rif TEXT" },
            { name: 'pago_movil_info', sql: "ALTER TABLE configuracion ADD COLUMN pago_movil_info TEXT" },
            { name: 'tema', sql: "ALTER TABLE configuracion ADD COLUMN tema TEXT DEFAULT 'claro'" },
            { name: 'color_primario', sql: "ALTER TABLE configuracion ADD COLUMN color_primario TEXT DEFAULT '#2563eb'" }
          ];
          nuevasColumnas.forEach(col => {
            if (!columnNames.includes(col.name)) {
              db.run(col.sql, (err) => {
                if (err) console.error(`Error agregando columna ${col.name}:`, err);
                else console.log(`✅ Columna ${col.name} agregada a configuracion`);
              });
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


      db.run(`
            CREATE TABLE IF NOT EXISTS logs_auditoria (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              usuario TEXT,
              fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
              tabla TEXT NOT NULL,
              registro_id INTEGER NOT NULL,
              accion TEXT NOT NULL,
              campo TEXT,
              nombre_producto TEXT,
              nombre_cliente TEXT,
              valor_anterior TEXT,
              valor_nuevo TEXT
            )
          `);

          
     // Trigger para stock_actual
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_productos_stock_update
        AFTER UPDATE OF stock_actual ON productos
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_producto)
          VALUES ('sistema', 'productos', NEW.id, 'UPDATE', 'stock_actual', OLD.stock_actual, NEW.stock_actual, NEW.nombre);
        END
      `);

      // Trigger para precio_base_usd
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_productos_precio_usd_update
        AFTER UPDATE OF precio_base_usd ON productos
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_producto)
          VALUES ('sistema', 'productos', NEW.id, 'UPDATE', 'precio_base_usd', OLD.precio_base_usd, NEW.precio_base_usd, NEW.nombre);
        END
      `);

      // Trigger para precio_manual_bs
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_productos_precio_bs_update
        AFTER UPDATE OF precio_manual_bs ON productos
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_producto)
          VALUES ('sistema', 'productos', NEW.id, 'UPDATE', 'precio_manual_bs', OLD.precio_manual_bs, NEW.precio_manual_bs, NEW.nombre);
        END
      `);

      // Trigger para activo
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_productos_activo_update
        AFTER UPDATE OF activo ON productos
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_producto)
          VALUES ('sistema', 'productos', NEW.id, 'UPDATE', 'activo', OLD.activo, NEW.activo, NEW.nombre);
        END
      `);

      // Trigger para proveedor_id
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_productos_proveedor_update
        AFTER UPDATE OF proveedor_id ON productos
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_producto)
          VALUES ('sistema', 'productos', NEW.id, 'UPDATE', 'proveedor_id', OLD.proveedor_id, NEW.proveedor_id, NEW.nombre);
        END
      `);

      // Clientes
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_clientes_deuda_update
        AFTER UPDATE OF deuda ON clientes
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_cliente)
          VALUES ('sistema', 'clientes', NEW.id, 'UPDATE', 'deuda', OLD.deuda, NEW.deuda, NEW.nombre);
        END
      `);

      // Trigger para nombre
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_clientes_nombre_update
        AFTER UPDATE OF nombre ON clientes
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_cliente)
          VALUES ('sistema', 'clientes', NEW.id, 'UPDATE', 'nombre', OLD.nombre, NEW.nombre, NEW.nombre);
        END
      `);

      // Trigger para ci
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_clientes_ci_update
        AFTER UPDATE OF ci ON clientes
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_cliente)
          VALUES ('sistema', 'clientes', NEW.id, 'UPDATE', 'ci', OLD.ci, NEW.ci, NEW.nombre);
        END
      `);

      // Trigger para telefono
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_clientes_telefono_update
        AFTER UPDATE OF telefono ON clientes
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, nombre_cliente)
          VALUES ('sistema', 'clientes', NEW.id, 'UPDATE', 'telefono', OLD.telefono, NEW.telefono, NEW.nombre);
        END
      `);

      // Órdenes de compra
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_ordenes_estado_update
        AFTER UPDATE OF estado ON ordenes_compra
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo)
          VALUES ('sistema', 'ordenes_compra', NEW.id, 'UPDATE', 'estado', OLD.estado, NEW.estado);
        END
      `);

      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_ordenes_total_update
        AFTER UPDATE OF total ON ordenes_compra
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo)
          VALUES ('sistema', 'ordenes_compra', NEW.id, 'UPDATE', 'total', OLD.total, NEW.total);
        END
      `);

      // Configuración (tasa BCV)
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_configuracion_tasa_update
        AFTER UPDATE OF tasa_bcv_actual ON configuracion
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo)
          VALUES ('sistema', 'configuracion', NEW.id, 'UPDATE', 'tasa_bcv_actual', OLD.tasa_bcv_actual, NEW.tasa_bcv_actual);
        END
      `);

      // Usuarios
      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_usuarios_insert
        AFTER INSERT ON usuarios
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_nuevo)
          VALUES ('sistema', 'usuarios', NEW.id, 'INSERT', 'rol', NEW.rol);
        END
      `);

      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_usuarios_delete
        AFTER DELETE ON usuarios
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior)
          VALUES ('sistema', 'usuarios', OLD.id, 'DELETE', 'rol', OLD.rol);
        END
      `);

      db.run(`
        CREATE TRIGGER IF NOT EXISTS tr_usuarios_rol_update
        AFTER UPDATE OF rol ON usuarios
        BEGIN
          INSERT INTO logs_auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo)
          VALUES ('sistema', 'usuarios', NEW.id, 'UPDATE', 'rol', OLD.rol, NEW.rol);
        END
      `);

      // Limpiar logs de más de 90 días 
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 180);
      db.run(`DELETE FROM logs_auditoria WHERE fecha < ?`, [fechaLimite.toISOString()], (err) => {
        if (err) console.error('Error limpiando logs antiguos:', err);
        else console.log('🗑️ Logs antiguos eliminados (>90 días)');
      });

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

              // Nuevas categorías solicitadas
        const nuevasCategorias = [
          ['Hortalizas', '🥬', '#4ade80', 10],
          ['Tabaco', '🚬', '#f97316', 11],
          ['Agua y Hielo', '💧', '#38bdf8', 12],
          ['Helados', '🍦', '#facc15', 13],
          ['Condimentos', '🧂', '#a855f7', 14],
          ['Enlatados', '🥫', '#6b7280', 15],
          ['Ferretería', '🔧', '#fef08a', 16],
          ['Quincallería', '🔩', '#9ca3af', 17]
        ];

        const stmtNuevas = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, icono, color, orden) VALUES (?, ?, ?, ?)`);
        nuevasCategorias.forEach(cat => stmtNuevas.run(cat));
        stmtNuevas.finalize();
      
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
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.*, 
               c.nombre as categoria_nombre, 
               c.icono as categoria_icono,
               pr.nombre_empresa as nombre_proveedor
        FROM productos p
        JOIN (
          SELECT rowid 
          FROM productos_fts 
          WHERE productos_fts MATCH ?
        ) AS fts ON p.id = fts.rowid
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
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

ipcMain.handle('buscar-productos-filtros', async (event, filtros) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      let { nombre, categoria_id, marca, proveedor_id, precio_min_bs, precio_max_bs, limit, offset } = filtros;
      let condiciones = [];
      let params = [];

      // Obtener tasa BCV
      db.get(`SELECT tasa_bcv_actual FROM configuracion WHERE id = 1`, (err, row) => {
        if (err) return reject(err);
        const tasa = (row && row.tasa_bcv_actual) || 50.00;

        // Condiciones de búsqueda
        if (nombre && nombre.trim()) {
          condiciones.push("p.nombre LIKE ?");
          params.push(`%${nombre.trim()}%`);
        }
        if (categoria_id && categoria_id !== '') {
          condiciones.push("p.categoria_id = ?");
          params.push(categoria_id);
        }
        if (marca && marca.trim()) {
          condiciones.push("p.marca LIKE ?");
          params.push(`%${marca.trim()}%`);
        }
        if (proveedor_id && proveedor_id !== '') {
          condiciones.push("p.proveedor_id = ?");
          params.push(proveedor_id);
        }

        // Condiciones de precio (en Bs)
        let precioCond = "";
        const min = parseFloat(precio_min_bs);
        const max = parseFloat(precio_max_bs);
        if (!isNaN(min)) {
          precioCond += ` AND (CASE WHEN p.usar_calculo_automatico = 1 THEN ROUND((p.precio_base_usd * (1 + p.margen_sugerido/100)) * ${tasa}, 2) ELSE p.precio_manual_bs END) >= ${min}`;
        }
        if (!isNaN(max)) {
          precioCond += ` AND (CASE WHEN p.usar_calculo_automatico = 1 THEN ROUND((p.precio_base_usd * (1 + p.margen_sugerido/100)) * ${tasa}, 2) ELSE p.precio_manual_bs END) <= ${max}`;
        }

        // Consulta principal con paginación
        let sql = `
          SELECT p.*, c.nombre as categoria_nombre, c.icono as categoria_icono,
                 pr.nombre_empresa as nombre_proveedor
          FROM productos p
          LEFT JOIN categorias c ON p.categoria_id = c.id
          LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
          WHERE p.activo = 1
        `;
        if (condiciones.length > 0) sql += " AND " + condiciones.join(" AND ");
        sql += precioCond;
        sql += " ORDER BY p.nombre";

        // Aplicar LIMIT y OFFSET si se proporcionaron
        if (limit && !isNaN(parseInt(limit))) {
          sql += ` LIMIT ${parseInt(limit)}`;
          if (offset && !isNaN(parseInt(offset))) {
            sql += ` OFFSET ${parseInt(offset)}`;
          }
        }

        // Consulta para contar el total (sin paginación)
        let countSql = `
          SELECT COUNT(*) as total
          FROM productos p
          WHERE p.activo = 1
        `;
        if (condiciones.length > 0) countSql += " AND " + condiciones.join(" AND ");
        countSql += precioCond;

        // Ejecutar ambas consultas
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          db.get(countSql, params, (errCount, countRow) => {
            if (errCount) return reject(errCount);
            resolve({
              productos: rows,
              total: countRow ? countRow.total : 0
            });
          });
        });
      });
    });
  });
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
    const { items, total, metodoPago, clienteId } = ventaData; 
    
    db.get(`SELECT tasa_bcv_actual FROM configuracion WHERE id = 1`, (err, config) => {
      if (err) return reject(err);
      const tasaDelMomento = (config && config.tasa_bcv_actual) ? config.tasa_bcv_actual : 1;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(`INSERT INTO ventas (fecha, total, metodo_pago, cliente_id, tasa_bcv) VALUES (datetime('now', 'localtime'), ?, ?, ?, ?)`, 
        [total, metodoPago, clienteId || null, tasaDelMomento], 
        function(err) {
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
                  if (error) { 
                      db.run('ROLLBACK'); 
                      reject(new Error('Error en la venta')); 
                  } else { 
                      if (metodoPago === 'credito' && clienteId) {
                          db.run(`UPDATE clientes SET deuda = deuda + ? WHERE id = ?`, [total, clienteId], (errDeuda) => {
                              if (errDeuda) {
                                  db.run('ROLLBACK');
                                  reject(new Error('Error actualizando deuda del cliente'));
                              } else {
                                  db.run('COMMIT'); 
                                  verificarYExportarVentas(); 
                                  resolve({ success: true, ventaId });
                              }
                          });
                      } else {
                          db.run('COMMIT'); 
                          verificarYExportarVentas(); 
                          resolve({ success: true, ventaId }); 
                      }
                  }
                }
              });
            });
          });
        });
      });
    });
  }));
});
ipcMain.handle('get-ventas-dia', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total FROM ventas WHERE fecha >= datetime('now', 'start of day') AND fecha < datetime('now', 'start of day', '+1 day') AND metodo_pago != 'credito'`;
    db.get(query, [], (err, row) => {
      if (err) reject(err);
      else resolve({ cantidad: row?.cantidad || 0, total: row?.total || 0 });
    });
  }));
});
// ============================================
// HISTORIAL DE DEUDAS 
// ============================================
ipcMain.handle('get-detalles-deuda', async (event, clienteId) => {
  return withDbReady(() => new Promise((resolve, reject) => {
    // Cruzamos ventas, detalles y productos para traer la lista exacta
    const query = `
      SELECT v.fecha, p.nombre as producto, vd.cantidad, vd.precio_unitario, vd.subtotal
      FROM ventas v
      JOIN venta_detalles vd ON v.id = vd.venta_id
      JOIN productos p ON vd.producto_id = p.id
      WHERE v.cliente_id = ? AND v.metodo_pago = 'credito'
      ORDER BY v.fecha DESC
    `;
    
    db.all(query, [clienteId], (err, rows) => {
      if (err) {
          console.error("Error buscando detalles de deuda:", err);
          reject(err);
      } else {
          resolve(rows || []);
      }
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
    db.all("SELECT ventas.*, clientes.nombre AS cliente_nombre FROM ventas LEFT JOIN clientes ON ventas.cliente_id = clientes.id ORDER BY fecha DESC LIMIT 100", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  }));
});

ipcMain.handle('get-totales-reportes', async () => {
  return withDbReady(() => new Promise((resolve, reject) => {
    // Excluimos el crédito de los 3 cálculos (hoy, semana y mes)
    const query = `
      SELECT 
        SUM(CASE WHEN date(fecha) = date('now', 'localtime') AND metodo_pago != 'credito' THEN total ELSE 0 END) as hoy, 
        SUM(CASE WHEN strftime('%Y-%W', fecha) = strftime('%Y-%W', 'now', 'localtime') AND metodo_pago != 'credito' THEN total ELSE 0 END) as semana, 
        SUM(CASE WHEN strftime('%m-%Y', fecha) = strftime('%m-%Y', 'now', 'localtime') AND metodo_pago != 'credito' THEN total ELSE 0 END) as mes 
      FROM ventas`;
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

ipcMain.handle('abonar-deuda', async (event, data) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const { clienteId, monto, metodoPago } = data;
      
      // ¡AQUÍ ESTÁ LA TRAMPA! Buscamos la tasa exacta en el momento del abono
      db.get(`SELECT tasa_bcv_actual FROM configuracion WHERE id = 1`, (err, config) => {
        if (err) return reject(err);
        const tasaDelMomento = (config && config.tasa_bcv_actual) ? config.tasa_bcv_actual : 1;

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          db.run(`UPDATE clientes SET deuda = deuda - ? WHERE id = ?`, [monto, clienteId], (err) => {
              if (err) { db.run('ROLLBACK'); return reject(err); }
          });
          const metodoAbono = "Abono - " + metodoPago;
          
          db.run(
            `INSERT INTO ventas (fecha, total, metodo_pago, subtotal, descuento, cliente_id, tasa_bcv) 
             VALUES (datetime('now', 'localtime'), ?, ?, 0, 0, ?, ?)`,
            [monto, metodoAbono, clienteId, tasaDelMomento],
            function(err) {
              if (err) {
                  db.run('ROLLBACK'); 
                  return reject(err);
              }
              
              db.run('COMMIT');
              resolve({ success: true, ventaId: this.lastID });
            }
          );
        });
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
// MANEJADORES IPC - LOGIN Y SEGURIDAD
// ============================================
ipcMain.handle('validar-login', async (event, { user, pass }) => {
    return new Promise((resolve) => {
        const claveEncriptada = encriptarClave(pass); // Encriptamos lo que metió el usuario
        
        db.get("SELECT id, username, rol FROM usuarios WHERE username = ? AND password = ?", 
        [user, claveEncriptada], (err, row) => { // Comparamos con la base de datos
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

// NUEVA FUNCIÓN: Actualizar usuarios
ipcMain.handle('update-credenciales', async (event, { rol, nuevoUsuario, nuevaClave }) => {
    return withDbReady(() => new Promise((resolve, reject) => {
        const claveEncriptada = encriptarClave(nuevaClave);
        db.run(
            `UPDATE usuarios SET username = ?, password = ? WHERE rol = ?`, 
            [nuevoUsuario, claveEncriptada, rol], 
            function(err) {
                if (err) {
                    // Si da error por username duplicado (UNIQUE constraint)
                    if (err.message.includes('UNIQUE')) {
                        resolve({ success: false, message: 'Ese nombre de usuario ya está ocupado' });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve({ success: true });
                }
            }
        );
    }));
});

// ============================================
// MANEJADORES IPC - EXPORTAR PDF MANUAL
// ============================================
ipcMain.handle('exportar-todas-ventas-pdf', async (event) => {
    const { dialog, BrowserWindow } = require('electron');
    const fs = require('fs');

    return new Promise((resolve) => {
        // 1. ¡PRIMERO LO PRIMERO! Buscamos la tasa del BCV pa' poder calcular
        db.get(`SELECT tasa_bcv_actual FROM configuracion WHERE id = 1`, [], (err, config) => {
            const tasaBCV = (config && config.tasa_bcv_actual) ? config.tasa_bcv_actual : 1;

            // 2. Ahora sí, nos traemos todas las ventas
            const query = `
                SELECT v.*, c.nombre as cliente_nombre 
                FROM ventas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id
                ORDER BY v.fecha DESC
            `;
            
            db.all(query, [], async (err, ventas) => {
                if (err) return resolve({ success: false, error: err.message });
                if (!ventas || ventas.length === 0) return resolve({ success: false, empty: true });

                let htmlFilas = '';
                let gananciaTotalUSD = 0;
                let gananciaTotalBs = 0;

                ventas.forEach(venta => {
                    const cliente = venta.cliente_nombre || 'Consumidor Final';
                    const totalBs = parseFloat(venta.total) || 0; 
                    const tasaUsar = venta.tasa_bcv || tasaBCV;
                    const totalUSD = totalBs / tasaUsar; 

                    if (venta.metodo_pago !== 'credito') {
                        gananciaTotalUSD += totalUSD;
                        gananciaTotalBs += totalBs;
                    }

                    htmlFilas += `
                        <tr>
                            <td>${venta.fecha}</td>
                            <td>${cliente}</td>
                            <td>${venta.metodo_pago || 'N/A'}</td>
                            <td>$${totalUSD.toFixed(2)}</td>
                            <td>Bs.${totalBs.toFixed(2)}</td>
                        </tr>
                    `;
                });

                const contenidoHTML = `
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h2 { text-align: center; color: #1e293b; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f8fafc; }
                            .totales { margin-top: 20px; font-size: 18px; font-weight: bold; text-align: right; }
                        </style>
                    </head>
                    <body>
                        <h2>Reporte General de Ventas (Manual)</h2>
                        <p><strong>Fecha de emisión:</strong> ${new Date().toLocaleString()}</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th>Método de Pago</th>
                                    <th>Total (USD)</th>
                                    <th>Total (Bs)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlFilas}
                            </tbody>
                        </table>
                        <div class="totales">
                            <p>Total Acumulado USD: $${gananciaTotalUSD.toFixed(2)}</p>
                            <p>Total Acumulado Bs: Bs.${gananciaTotalBs.toFixed(2)}</p>
                        </div>
                    </body>
                    </html>
                `;

                const pdfPath = await dialog.showSaveDialog({
                    title: 'Guardar Reporte Manual de Ventas',
                    defaultPath: `Reporte_Completo_${Date.now()}.pdf`,
                    filters: [{ name: 'Archivos PDF', extensions: ['pdf'] }]
                });

                if (pdfPath.canceled) return resolve({ success: false, cancelado: true });

                const printWindow = new BrowserWindow({ show: false });
                await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contenidoHTML)}`);
                
                try {
                    const data = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
                    fs.writeFileSync(pdfPath.filePath, data);
                    printWindow.close();
                    resolve({ success: true, path: pdfPath.filePath });
                } catch (error) {
                    printWindow.close();
                    resolve({ success: false, error: error.message });
                }
            });
        });
    });
});
// ============================================
// VENTANA OCULTA PARA PDF AUTOMÁTICO
// ============================================
async function verificarYExportarVentas() {
    const limite = 500; // El número ideal de ventas para no guindar la PC

    db.get("SELECT COUNT(*) as total FROM ventas", async (err, row) => {
        if (err || !row || row.total < limite) return; // Si no ha llegado a 500, no hace nada

        console.log(`¡Llegamos a ${limite} ventas! Generando PDF automático...`);

        // 1. Buscamos la tasa del BCV pa' poder hacer la conversión
        db.get(`SELECT tasa_bcv_actual FROM configuracion WHERE id = 1`, [], (err, config) => {
            const tasaBCV = (config && config.tasa_bcv_actual) ? config.tasa_bcv_actual : 1;

            // 2. Buscamos todas las ventas con el nombre del cliente
            const query = `
                SELECT v.*, c.nombre as cliente_nombre 
                FROM ventas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id
            `;
            
            db.all(query, [], async (err, ventas) => {
                if (err || ventas.length === 0) return;

                let htmlFilas = '';
                let gananciaTotalUSD = 0;
                let gananciaTotalBs = 0;

                // 3. Armamos las filas y sumamos los cobres con el arreglo que hicimos
                ventas.forEach(venta => {
                    const cliente = venta.cliente_nombre || 'Consumidor Final';
                    const totalBs = parseFloat(venta.total) || 0; 
                    const tasaUsar = venta.tasa_bcv || tasaBCV;
                    const totalUSD = totalBs / tasaUsar; 

                    if (venta.metodo_pago !== 'credito') {
                        gananciaTotalUSD += totalUSD;
                        gananciaTotalBs += totalBs;
                    }

                    htmlFilas += `
                        <tr>
                            <td>${venta.fecha}</td>
                            <td>${cliente}</td>
                            <td>${venta.metodo_pago || 'N/A'}</td>
                            <td>$${totalUSD.toFixed(2)}</td>
                            <td>Bs.${totalBs.toFixed(2)}</td>
                        </tr>
                    `;
                });

                // 4. Preparamos el diseño del PDF
                const contenidoHTML = `
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h2 { text-align: center; color: #1e293b; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f8fafc; }
                            .totales { margin-top: 20px; font-size: 18px; font-weight: bold; text-align: right; }
                        </style>
                    </head>
                    <body>
                        <h2>Reporte de Ventas Automático (Corte de ${limite} transacciones)</h2>
                        <p><strong>Fecha de corte:</strong> ${new Date().toLocaleString()}</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th>Método de Pago</th>
                                    <th>Total (USD)</th>
                                    <th>Total (Bs)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlFilas}
                            </tbody>
                        </table>
                        <div class="totales">
                            <p>Ganancia Total USD: $${gananciaTotalUSD.toFixed(2)}</p>
                            <p>Ganancia Total Bs: Bs.${gananciaTotalBs.toFixed(2)}</p>
                        </div>
                    </body>
                    </html>
                `;

                // 5. Creamos la carpeta si no existe en "Mis Documentos"
                const carpetaReportes = path.join(app.getPath('documents'), 'GestorLocal_Reportes');
                if (!fs.existsSync(carpetaReportes)) {
                    fs.mkdirSync(carpetaReportes, { recursive: true });
                }

                // Nombre único con la fecha exacta en milisegundos
                const nombreArchivo = `Corte_Ventas_${Date.now()}.pdf`;
                const rutaPDF = path.join(carpetaReportes, nombreArchivo);

                // 6. Generamos el PDF de forma oculta
                const printWindow = new BrowserWindow({ show: false });
                await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contenidoHTML)}`);
                
                try {
                    const data = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
                    fs.writeFileSync(rutaPDF, data);
                    printWindow.close();
                    console.log(`✅ PDF guardado calladito en: ${rutaPDF}`);

                    // 7. ¡La Limpieza! Borramos las ventas que acabamos de meter en el PDF
                    const idsVentas = ventas.map(v => v.id).join(',');
                    db.run(`DELETE FROM ventas WHERE id IN (${idsVentas})`, (err) => {
                        if (!err) console.log('✅ Ventas borradas de la base de datos para ahorrar espacio.');
                    });

                } catch (error) {
                    console.error("Error generando el PDF automático:", error);
                    printWindow.close();
                }
            });
        });
    });
}

// ============================================
// MANEJADORES IPC - CONFIGURACION
// ============================================

ipcMain.handle('update-config', async (event, nuevosDatos) => {
  return withDbReady(() => {
    return new Promise((resolve, reject) => {
      const campos = Object.keys(nuevosDatos).map(k => `${k} = ?`).join(', ');
      const valores = Object.values(nuevosDatos);
      if (campos.length === 0) return resolve({ success: true });
      db.run(`UPDATE configuracion SET ${campos} WHERE id = 1`, valores, function(err) {
        if (err) reject(err);
        else resolve({ success: true });
      });
    });
  });
});

// Obtener lista de backups
ipcMain.handle('listar-backups', async () => {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) return [];
    const archivos = fs.readdirSync(backupDir);
    return archivos
        .filter(f => f.startsWith('gestorlocal_') && f.endsWith('.db'))
        .map(f => {
            const ruta = path.join(backupDir, f);
            const stats = fs.statSync(ruta);
            return {
                nombre: f,
                ruta: ruta,
                fecha: stats.mtime,
                tamano: stats.size
            };
        });
});

// Obtener versión de la app (desde package.json)
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Restaurar backup
ipcMain.handle('restaurar-backup', async (event, backupPath) => {
    try {
        const dbPath = path.join(__dirname, 'src/database/gestorlocal.db');
        // Cerrar la base de datos actual
        if (db) db.close();
        // Copiar backup al lugar original
        fs.copyFileSync(backupPath, dbPath);
        // Volver a conectar
        await initDatabase();
        return { success: true };
    } catch (error) {
        console.error('Error restaurando backup:', error);
        return { success: false };
    }
});

// Eliminar backup
ipcMain.handle('eliminar-backup', async (event, backupPath) => {
    try {
        fs.unlinkSync(backupPath);
        return { success: true };
    } catch (error) {
        console.error('Error eliminando backup:', error);
        return { success: false };
    }
});

ipcMain.handle('get-versions', () => {
    return {
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome
    };
});