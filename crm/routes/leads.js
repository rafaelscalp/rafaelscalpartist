const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

// ─── LISTAR / BUSCAR ────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { stage, origin, temperature, search, from, to } = req.query;

  let sql = `SELECT c.*,
    (SELECT COUNT(*) FROM interactions WHERE client_id = c.id) AS interaction_count,
    (SELECT COUNT(*) FROM sessions WHERE client_id = c.id) AS session_count,
    (SELECT SUM(price) FROM sessions WHERE client_id = c.id AND paid = 1) AS total_paid
    FROM clients c WHERE 1=1`;
  const params = [];

  if (stage)       { sql += ` AND c.stage = ?`;       params.push(stage); }
  if (origin)      { sql += ` AND c.origin = ?`;      params.push(origin); }
  if (temperature) { sql += ` AND c.temperature = ?`; params.push(temperature); }
  if (from)        { sql += ` AND c.created_at >= ?`; params.push(from); }
  if (to)          { sql += ` AND c.created_at <= ?`; params.push(to + 'T23:59:59'); }
  if (search) {
    sql += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ` ORDER BY c.created_at DESC`;

  try {
    const clients = db.prepare(sql).all(...params);
    res.json({ ok: true, data: clients });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── MÉTRICAS DASHBOARD ─────────────────────────────────────────────────────

router.get('/metrics', (req, res) => {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const leadsThisMonth = db.prepare(
      `SELECT COUNT(*) as count FROM clients WHERE created_at >= ?`
    ).get(firstOfMonth);

    const byStage = db.prepare(
      `SELECT stage, COUNT(*) as count FROM clients GROUP BY stage`
    ).all();

    const activeClients = db.prepare(
      `SELECT COUNT(*) as count FROM clients WHERE stage = 'Cliente activo'`
    ).get();

    const revenue = db.prepare(
      `SELECT COALESCE(SUM(price),0) as total FROM sessions WHERE paid = 1 AND date >= ?`
    ).get(firstOfMonth.split('T')[0]);

    const revenueTotal = db.prepare(
      `SELECT COALESCE(SUM(price),0) as total FROM sessions WHERE paid = 1`
    ).get();

    const closedThisMonth = db.prepare(
      `SELECT COUNT(*) as count FROM clients WHERE stage = 'Cliente activo' AND updated_at >= ?`
    ).get(firstOfMonth);

    const total = db.prepare(`SELECT COUNT(*) as count FROM clients`).get();
    const closed = db.prepare(`SELECT COUNT(*) as count FROM clients WHERE stage = 'Cliente activo'`).get();
    const closeRate = total.count > 0 ? ((closed.count / total.count) * 100).toFixed(1) : 0;

    const byOrigin = db.prepare(
      `SELECT origin, COUNT(*) as count FROM clients GROUP BY origin ORDER BY count DESC`
    ).all();

    const recentLeads = db.prepare(
      `SELECT id, name, phone, origin, stage, temperature, created_at FROM clients ORDER BY created_at DESC LIMIT 5`
    ).all();

    res.json({
      ok: true,
      data: {
        leadsThisMonth: leadsThisMonth.count,
        totalLeads: total.count,
        activeClients: activeClients.count,
        closeRate: parseFloat(closeRate),
        revenueThisMonth: revenue.total,
        revenueTotal: revenueTotal.total,
        closedThisMonth: closedThisMonth.count,
        byStage,
        byOrigin,
        recentLeads,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── OBTENER UNO ────────────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
  try {
    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(req.params.id);
    if (!client) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

    const interactions = db.prepare(
      `SELECT * FROM interactions WHERE client_id = ? ORDER BY created_at DESC`
    ).all(req.params.id);

    const sessions = db.prepare(
      `SELECT * FROM sessions WHERE client_id = ? ORDER BY date DESC`
    ).all(req.params.id);

    const photos = db.prepare(
      `SELECT * FROM photos WHERE client_id = ? ORDER BY created_at DESC`
    ).all(req.params.id);

    res.json({ ok: true, data: { ...client, interactions, sessions, photos } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── CREAR ──────────────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const { name, phone, email, origin, campaign, ad_id, stage, temperature, budget, notes, next_touch } = req.body;

    if (!name) return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });

    db.prepare(`
      INSERT INTO clients (id, name, phone, email, origin, campaign, ad_id, stage, temperature, budget, notes, next_touch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, phone || null, email || null, origin || 'Otro', campaign || null, ad_id || null,
           stage || 'Nuevo', temperature || 'Tibio', budget || null, notes || '', next_touch || null);

    // Interacción de sistema
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'Sistema', 'Interno', ?)
    `).run(uuidv4(), id, `Lead creado. Origen: ${origin || 'Otro'}.`);

    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
    res.status(201).json({ ok: true, data: client });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── ACTUALIZAR ─────────────────────────────────────────────────────────────

router.patch('/:id', (req, res) => {
  try {
    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(req.params.id);
    if (!client) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

    const fields = ['name','phone','email','origin','campaign','stage','temperature','budget','notes','next_touch'];
    const updates = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, error: 'Nada para actualizar' });

    values.push(req.params.id);
    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Registrar cambio de etapa
    if (req.body.stage && req.body.stage !== client.stage) {
      db.prepare(`
        INSERT INTO interactions (id, client_id, type, direction, content)
        VALUES (?, ?, 'Sistema', 'Interno', ?)
      `).run(uuidv4(), req.params.id, `Etapa cambiada: "${client.stage}" → "${req.body.stage}".`);
    }

    const updated = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(req.params.id);
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── ELIMINAR ───────────────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM clients WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    res.json({ ok: true, message: 'Cliente eliminado' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
