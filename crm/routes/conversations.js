// ─── CONVERSACIONES WHATSAPP ──────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const Twilio  = require('twilio').Twilio;
const db      = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const WA_FROM = () => `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

// ─── LISTAR CONVERSACIONES ACTIVAS ───────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    // Clientes con al menos 1 interacción WhatsApp
    const convs = db.prepare(`
      SELECT
        c.id, c.name, c.phone, c.stage, c.temperature, c.updated_at,
        (SELECT content FROM interactions
         WHERE client_id = c.id AND type = 'WhatsApp'
         ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM interactions
         WHERE client_id = c.id AND type = 'WhatsApp'
         ORDER BY created_at DESC LIMIT 1) AS last_message_at,
        (SELECT direction FROM interactions
         WHERE client_id = c.id AND type = 'WhatsApp'
         ORDER BY created_at DESC LIMIT 1) AS last_direction,
        COALESCE(w.ai_enabled, 1) AS ai_enabled
      FROM clients c
      LEFT JOIN wa_ai_control w ON w.client_id = c.id
      WHERE EXISTS (
        SELECT 1 FROM interactions WHERE client_id = c.id AND type = 'WhatsApp'
      )
      ORDER BY last_message_at DESC
    `).all();

    res.json({ ok: true, data: convs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── HILO DE UN LEAD ─────────────────────────────────────────────────────────

router.get('/:clientId/messages', (req, res) => {
  try {
    const msgs = db.prepare(`
      SELECT id, type, direction, content, created_at, wa_message_sid
      FROM interactions
      WHERE client_id = ? AND type IN ('WhatsApp','Sistema')
      ORDER BY created_at ASC
    `).all(req.params.clientId);
    res.json({ ok: true, data: msgs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── ENVIAR MENSAJE MANUAL ────────────────────────────────────────────────────

router.post('/:clientId/send', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ ok: false, error: 'Mensaje vacío' });

    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(req.params.clientId);
    if (!client) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

    const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await twilioClient.messages.create({
      from: WA_FROM(),
      to: `whatsapp:${client.phone}`,
      body: message.trim(),
    });

    const intId = uuidv4();
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content, wa_message_sid)
      VALUES (?, ?, 'WhatsApp', 'Saliente', ?, ?)
    `).run(intId, client.id, message.trim(), result.sid);

    const saved = db.prepare(`SELECT * FROM interactions WHERE id = ?`).get(intId);
    res.json({ ok: true, data: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── TOGGLE IA ────────────────────────────────────────────────────────────────

router.patch('/:clientId/ai', (req, res) => {
  try {
    const { ai_enabled } = req.body;
    const val = ai_enabled ? 1 : 0;

    db.prepare(`
      INSERT INTO wa_ai_control (client_id, ai_enabled, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(client_id) DO UPDATE SET ai_enabled = ?, updated_at = datetime('now')
    `).run(req.params.clientId, val, val);

    const label = val ? 'IA activada' : 'IA desactivada — modo manual';
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'Sistema', 'Interno', ?)
    `).run(uuidv4(), req.params.clientId, label);

    res.json({ ok: true, data: { ai_enabled: val } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
