import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'transito.db');

let db = null;

// Initialize database
export async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS operativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      lugar TEXT,
      hora_inicio TEXT,
      hora_fin TEXT,
      personal TEXT,
      vehiculos_controlados_total INTEGER DEFAULT 0,
      actas_simples_auto INTEGER DEFAULT 0,
      actas_simples_moto INTEGER DEFAULT 0,
      retencion_doc_auto INTEGER DEFAULT 0,
      retencion_doc_moto INTEGER DEFAULT 0,
      alcoholemia_positiva_auto INTEGER DEFAULT 0,
      alcoholemia_positiva_moto INTEGER DEFAULT 0,
      actas_ruido_auto INTEGER DEFAULT 0,
      actas_ruido_moto INTEGER DEFAULT 0,
      maxima_graduacion_gl REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();
  return db;
}

// Save database to file
export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

// Get database instance
export function getDb() {
  return db;
}

export default { initDatabase, saveDatabase, getDb };
