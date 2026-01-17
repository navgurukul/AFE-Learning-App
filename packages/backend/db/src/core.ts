import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get database instance (singleton pattern)
 * Database is stored at: C:\ProgramData\OfflineLearningApp\data.db
 */
export function getDatabase(dataPath?: string) {
  if (db) return db;

  const dbPath = dataPath || path.join('C:\\ProgramData\\OfflineLearningApp', 'data.db');

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL'); // Better concurrency
  sqlite.pragma('foreign_keys = ON'); // Enforce foreign keys

  db = drizzle(sqlite, { schema });
  return db;
}

/**
 * Initialize database with tables
 */
export function initializeDatabase(dataPath?: string) {
  const database = getDatabase(dataPath);

  console.log('Running migrations...');
  try {
    // Run migrations from the 'drizzle' folder
    // We need to resolve the path relative to this file (which will be in dist/ or src/)
    // In dev (src): ../drizzle
    // In prod (dist): ../drizzle
    const migrationsFolder = path.join(__dirname, '../drizzle');

    migrate(database, { migrationsFolder });
    console.log('✓ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }

  return database;
}
