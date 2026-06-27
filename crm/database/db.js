const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'crm.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA BASE ─────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    phone            TEXT,
    email            TEXT,
    origin           TEXT CHECK(origin IN ('Meta','Google','Instagram','Referido','Orgánico','Otro')) DEFAULT 'Otro',
    campaign         TEXT,
    adset            TEXT,
    ad_name          TEXT,
    ad_id            TEXT,
    stage            TEXT CHECK(stage IN ('Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido')) DEFAULT 'Nuevo',
    temperature      TEXT CHECK(temperature IN ('Caliente','Tibio','Frío')) DEFAULT 'Tibio',
    budget           REAL,
    notes            TEXT,
    initial_message  TEXT,
    next_touch       TEXT,
    next_retoque     TEXT,
    loss_reason      TEXT,
    last_contact_at  TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
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
    id             TEXT PRIMARY KEY,
    client_id      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_number INTEGER,
    date           TEXT NOT NULL,
    type           TEXT CHECK(type IN ('Sesión inicial','Retoque','Consulta')) DEFAULT 'Sesión inicial',
    duration       INTEGER,
    price          REAL,
    paid           INTEGER DEFAULT 0,
    payment_status TEXT CHECK(payment_status IN ('Pagado','Señado','Pendiente')) DEFAULT 'Pagado',
    notes          TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    type        TEXT CHECK(type IN ('Antes','Después','Proceso')) DEFAULT 'Antes',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Control de IA por lead: si ai_enabled=0, Rafael responde manualmente
  CREATE TABLE IF NOT EXISTS wa_ai_control (
    client_id   TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    ai_enabled  INTEGER DEFAULT 1,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- Seguimientos automáticos pendientes
  CREATE TABLE IF NOT EXISTS wa_followups (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    attempt     INTEGER DEFAULT 1,
    scheduled_at TEXT NOT NULL,
    sent_at     TEXT,
    status      TEXT DEFAULT 'pending'
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

// ─── MIGRACIONES (agregan columnas sin borrar datos existentes) ───────────────

const migrations = [
  { table: 'clients',  col: 'initial_message', def: 'TEXT' },
  { table: 'clients',  col: 'last_contact_at', def: 'TEXT' },
  { table: 'clients',  col: 'next_retoque',    def: 'TEXT' },
  { table: 'clients',  col: 'loss_reason',     def: 'TEXT' },
  { table: 'clients',  col: 'adset',           def: 'TEXT' },
  { table: 'clients',  col: 'ad_name',         def: 'TEXT' },
  { table: 'sessions', col: 'session_number',  def: 'INTEGER' },
  { table: 'sessions', col: 'payment_status',  def: "TEXT DEFAULT 'Pagado'" },
  { table: 'interactions', col: 'wa_message_sid', def: 'TEXT' },
];

for (const { table, col, def } of migrations) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch(e) {}
}

// ─── TRIGGERS ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TRIGGER IF NOT EXISTS clients_updated_at
  AFTER UPDATE ON clients
  BEGIN
    UPDATE clients SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

  -- Actualiza last_contact_at cuando se registra una interacción real (no Sistema)
  CREATE TRIGGER IF NOT EXISTS update_last_contact
  AFTER INSERT ON interactions
  WHEN NEW.type != 'Sistema'
  BEGIN
    UPDATE clients SET last_contact_at = datetime('now') WHERE id = NEW.client_id;
  END;
`);

module.exports = db;
