const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

// Valida que el teléfono tenga al menos 8 dígitos numéricos
function validatePhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8;
}

// ─── LISTAR / BUSCAR ────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { stage, origin, temperature, search, from, to } = req.query;

  let sql = `SELECT c.*,
    (SELECT COUNT(*) FROM interactions WHERE client_id = c.id) AS interaction_count,
    (SELECT COUNT(*) FROM sessions WHERE client_id = c.id) AS session_count,
    (SELECT COALESCE(SUM(price),0) FROM sessions WHERE client_id = c.id AND payment_status = 'Pagado') AS total_paid
    FROM clients c WHERE 1=1`;
  const params = [];

  if (stage)       { sql += ` AND c.stage = ?`;       params.push(stage); }
  if (origin)      { sql += ` AND c.origin = ?`;      params.push(origin); }
  if (temperature) { sql += ` AND c.temperature = ?`; params.push(temperature); }
  if (from)        { sql += ` AND c.created_at >= ?`; params.push(from); }
  if (to)          { sql += ` AND c.created_at <= ?`; params.push(to + 'T23:59:59'); }
  if (search) {
    sql += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.campaign LIKE ? OR c.initial_message LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q, q, q);
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
    const firstOfMonthDate = firstOfMonth.split('T')[0];

    const leadsThisMonth = db.prepare(
      `SELECT COUNT(*) as count FROM clients WHERE created_at >= ?`
    ).get(firstOfMonth);

    const byStage = db.prepare(
      `SELECT stage, COUNT(*) as count FROM clients GROUP BY stage`
    ).all();

    const activeClients = db.prepare(
      `SELECT COUNT(*) as count FROM clients WHERE stage = 'Cliente activo'`
    ).get();

    // Facturación: solo sesiones Pagadas
    const revenue = db.prepare(
      `SELECT COALESCE(SUM(price),0) as total FROM sessions WHERE payment_status = 'Pagado' AND date >= ?`
    ).get(firstOfMonthDate);

    const revenueTotal = db.prepare(
      `SELECT COALESCE(SUM(price),0) as total FROM sessions WHERE payment_status = 'Pagado'`
    ).get();

    const total = db.prepare(`SELECT COUNT(*) as count FROM clients`).get();
    const closed = db.prepare(`SELECT COUNT(*) as count FROM clients WHERE stage = 'Cliente activo'`).get();
    const closeRate = total.count > 0 ? ((closed.count / total.count) * 100).toFixed(1) : 0;

    const byOrigin = db.prepare(
      `SELECT origin, COUNT(*) as count FROM clients GROUP BY origin ORDER BY count DESC`
    ).all();

    const recentLeads = db.prepare(
      `SELECT id, name, phone, origin, stage, temperature, created_at, last_contact_at FROM clients ORDER BY created_at DESC LIMIT 5`
    ).all();

    // Leads sin contacto hace más de 24hs (excluye Perdidos y Clientes activos)
    const noContactAlert = db.prepare(`
      SELECT COUNT(*) as count FROM clients
      WHERE stage NOT IN ('Perdido','Cliente activo')
      AND (
        last_contact_at IS NULL AND created_at < datetime('now', '-24 hours')
        OR last_contact_at < datetime('now', '-24 hours')
      )
    `).get();

    // Motivos de pérdida del mes
    const lossReasons = db.prepare(`
      SELECT loss_reason, COUNT(*) as count FROM clients
      WHERE stage = 'Perdido' AND loss_reason IS NOT NULL AND updated_at >= ?
      GROUP BY loss_reason ORDER BY count DESC
    `).all(firstOfMonth);

    // Campañas Meta del mes
    const byCampaign = db.prepare(`
      SELECT campaign, COUNT(*) as count FROM clients
      WHERE origin = 'Meta' AND campaign IS NOT NULL AND campaign != '' AND created_at >= ?
      GROUP BY campaign ORDER BY count DESC LIMIT 5
    `).all(firstOfMonth);

    // Retoques próximos 90 días
    const today = now.toISOString().split('T')[0];
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingRetoques = db.prepare(`
      SELECT id, name, phone, next_retoque FROM clients
      WHERE next_retoque IS NOT NULL AND next_retoque BETWEEN ? AND ?
      ORDER BY next_retoque ASC LIMIT 20
    `).all(today, in90);

    // Pendiente de cobro: sesiones Señadas o Pendientes (todos los clientes)
    const pendingRevenue = db.prepare(
      `SELECT COALESCE(SUM(price),0) as total FROM sessions WHERE payment_status IN ('Señado','Pendiente')`
    ).get();

    res.json({
      ok: true,
      data: {
        leadsThisMonth: leadsThisMonth.count,
        totalLeads: total.count,
        activeClients: activeClients.count,
        closeRate: parseFloat(closeRate),
        revenueThisMonth: revenue.total,
        revenueTotal: revenueTotal.total,
        pendingRevenue: pendingRevenue.total,
        noContactAlert: noContactAlert.count,
        byStage,
        byOrigin,
        byCampaign,
        lossReasons,
        recentLeads,
        upcomingRetoques,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── BÚSQUEDA RÁPIDA (dropdown) ─────────────────────────────────────────────

router.get('/search/quick', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ ok: true, data: [] });
  const like = `%${q}%`;
  try {
    const results = db.prepare(`
      SELECT id, name, phone, stage, temperature, origin
      FROM clients
      WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR campaign LIKE ? OR initial_message LIKE ?
      ORDER BY created_at DESC LIMIT 8
    `).all(like, like, like, like, like);
    res.json({ ok: true, data: results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── AGENDA SEMANAL ──────────────────────────────────────────────────────────

router.get('/agenda/week', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ ok: false, error: 'from y to requeridos' });
  try {
    const sessions = db.prepare(`
      SELECT s.id, s.date, s.type, s.price, s.payment_status,
             c.id as client_id, c.name, c.phone
      FROM sessions s JOIN clients c ON s.client_id = c.id
      WHERE s.date BETWEEN ? AND ?
      ORDER BY s.date ASC
    `).all(from, to);

    const contacts = db.prepare(`
      SELECT id, name, phone, next_touch, stage
      FROM clients
      WHERE next_touch BETWEEN ? AND ?
      ORDER BY next_touch ASC
    `).all(from, to);

    res.json({ ok: true, data: { sessions, contacts } });
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
    const { name, phone, email, origin, campaign, adset, ad_name, ad_id,
            stage, temperature, budget, notes, initial_message, next_touch } = req.body;

    if (!name) return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    if (!phone) return res.status(400).json({ ok: false, error: 'El teléfono es obligatorio' });
    if (!validatePhone(phone)) return res.status(400).json({ ok: false, error: 'El teléfono debe tener al menos 8 dígitos' });

    const id = uuidv4();

    db.prepare(`
      INSERT INTO clients (id, name, phone, email, origin, campaign, adset, ad_name, ad_id,
        stage, temperature, budget, notes, initial_message, next_touch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, phone, email || null, origin || 'Otro', campaign || null,
           adset || null, ad_name || null, ad_id || null,
           stage || 'Nuevo', temperature || 'Tibio', budget || null,
           notes || '', initial_message || null, next_touch || null);

    // Interacción de sistema al crear
    let sysMsg = `Lead creado. Origen: ${origin || 'Otro'}.`;
    if (initial_message) sysMsg += ` Mensaje inicial registrado.`;
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'Sistema', 'Interno', ?)
    `).run(uuidv4(), id, sysMsg);

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

    // Validar teléfono si se está actualizando
    if (req.body.phone !== undefined) {
      if (!req.body.phone) return res.status(400).json({ ok: false, error: 'El teléfono es obligatorio' });
      if (!validatePhone(req.body.phone)) return res.status(400).json({ ok: false, error: 'El teléfono debe tener al menos 8 dígitos' });
    }

    const fields = ['name','phone','email','origin','campaign','adset','ad_name',
                    'stage','temperature','budget','notes','initial_message',
                    'next_touch','next_retoque','loss_reason'];
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
