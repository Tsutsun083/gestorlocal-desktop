const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let db;

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
      crearTablas().then(resolve).catch(reject);
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

      // Tabla de productos
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
          stock_actual INTEGER DEFAULT 0,
          stock_minimo INTEGER DEFAULT 5,
          unidad_medida TEXT DEFAULT 'unidad',
          activo INTEGER DEFAULT 1,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id)
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
          actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (!err) {
          // Insertar configuración inicial si no existe
          db.get(`SELECT * FROM configuracion WHERE id = 1`, (err, row) => {
            if (!row) {
              db.run(`INSERT INTO configuracion (id, nombre_negocio, tasa_bcv_actual) VALUES (1, 'Mi Negocio', 50.00)`);
            }
          });
        }
      });

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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    initDatabase().catch(err => console.error('Error iniciando BD:', err));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (db) db.close();
  });
}

// ============================================
// MANEJADORES IPC (Comunicación con frontend)
// ============================================

// Inicializar BD
ipcMain.handle('init-database', async () => {
  if (db) return { success: true, message: 'BD ya inicializada' };
  await initDatabase();
  return { success: true, message: 'BD inicializada' };
});

// Obtener configuración
ipcMain.handle('get-configuracion', async () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM configuracion WHERE id = 1`, [], (err, row) => {
      if (err) reject(err);
      else resolve(row || { tasa_bcv_actual: 50.00, nombre_negocio: 'Mi Negocio' });
    });
  });
});

// Actualizar tasa BCV
ipcMain.handle('update-tasa-bcv', async (event, tasa) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE configuracion SET tasa_bcv_actual = ?, fecha_actualizacion_tasa = CURRENT_TIMESTAMP WHERE id = 1`, 
      [tasa], function(err) {
        if (err) reject(err);
        else resolve({ success: true });
      });
  });
});

// Obtener categorías
ipcMain.handle('get-categorias', async () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM categorias WHERE activa = 1 ORDER BY orden`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

// Obtener productos activos
ipcMain.handle('get-productos', async () => {
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

// Actualizar producto - VERSIÓN CORREGIDA
ipcMain.handle('update-producto', async (event, id, producto) => {
    return new Promise((resolve, reject) => {
        const { 
            nombre, 
            precio_base_usd, 
            margen_sugerido, 
            categoria_id, 
            stock_minimo,
            stock_actual,
            usar_calculo_automatico,
            precio_manual_bs 
        } = producto;
        
        // 🔥 IMPORTANTE: Verificar que los valores no sean undefined
        console.log('🔄 Actualizando producto:', { 
            id, nombre, stock_actual, precio_base_usd, margen_sugerido 
        });
        
        // Asegurar valores por defecto
        const sql = `UPDATE productos SET 
            nombre = COALESCE(?, nombre),
            precio_base_usd = COALESCE(?, precio_base_usd),
            margen_sugerido = COALESCE(?, margen_sugerido),
            categoria_id = COALESCE(?, categoria_id),
            stock_minimo = COALESCE(?, stock_minimo),
            stock_actual = COALESCE(?, stock_actual),
            usar_calculo_automatico = COALESCE(?, usar_calculo_automatico),
            precio_manual_bs = COALESCE(?, precio_manual_bs)
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
                id
            ], 
            function(err) {
                if (err) {
                    console.error('❌ Error SQL en update-producto:', err);
                    console.error('📝 SQL ejecutado:', sql);
                    console.error('📊 Parámetros:', [
                        nombre, precio_base_usd, margen_sugerido, categoria_id,
                        stock_minimo, stock_actual, usar_calculo_automatico, 
                        precio_manual_bs, id
                    ]);
                    reject(err);
                } else {
                    console.log('✅ Producto actualizado ID:', id, 'Stock:', stock_actual);
                    resolve({ success: true, changes: this.changes });
                }
            }
        );
    });
});

// Eliminar producto (borrado lógico)
ipcMain.handle('delete-producto', async (event, id) => {
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
// Habilitar prompt() en Electron
app.commandLine.appendSwitch('enable-features', 'NativeNotifications');
app.commandLine.appendSwitch('disable-features', 'NetworkService');
app.commandLine.appendSwitch('disable-gpu-compositing');

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});