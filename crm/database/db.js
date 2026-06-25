const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'crm.sqlite');
const db = new Database(DB_PATH);

// WAL mode para mejor performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    origin      TEXT CHECK(origin IN ('Meta','Google','Instagram','Referido','Orgánico','Otro')) DEFAULT 'Otro',
    campaign    TEXT,
    ad_id       TEXT,
    stage       TEXT CHECK(stage IN ('Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido')) DEFAULT 'Nuevo',
    temperature TEXT CHECK(temperature IN ('Caliente','Tibio','Frío')) DEFAULT 'Tibio',
    budget      REAL,
    notes       TEXT,
    next_touch  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type        TEXT CHECK(type IN ('Llamada','WhatsApp','Email','Visita','Nota','Sistema')) DEFAULT 'Nota',
    direction   TEXT CHECK(direction IN ('Entrante','Saliente','Interno')) DEFAULT 'Interno',
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,
    type        TEXT CHECK(type IN ('Sesión inicial','Retoque','Consulta')) DEFAULT 'Sesión inicial',
    duration    INTEGER,
    price       REAL,
    paid        INTEGER DEFAULT 0,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    type        TEXT CHECK(type IN ('Antes','Después','Proceso')) DEFAULT 'Antes',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meta_leads (
    id            TEXT PRIMARY KEY,
    client_id     TEXT REFERENCES clients(id),
    form_id       TEXT,
    ad_id         TEXT,
    campaign_id   TEXT,
    campaign_name TEXT,
    adset_name    TEXT,
    raw_data      TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );
`);

// Trigger para updated_at automático
db.exec(`
  CREATE TRIGGER IF NOT EXISTS clients_updated_at
  AFTER UPDATE ON clients
  BEGIN
    UPDATE clients SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`);

module.exports = db;
