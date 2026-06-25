const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

// Agregar interacción (el trigger de DB actualiza last_contact_at automáticamente)
router.post('/:clientId', (req, res) => {
  try {
    const { type, direction, content } = req.body;
    if (!content) return res.status(400).json({ ok: false, error: 'El contenido es obligatorio' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.params.clientId, type || 'Nota', direction || 'Interno', content);

    const interaction = db.prepare(`SELECT * FROM interactions WHERE id = ?`).get(id);
    res.status(201).json({ ok: true, data: interaction });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar interacción
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM interactions WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Interacción no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Agregar sesión
router.post('/:clientId/sessions', (req, res) => {
  try {
    const { date, type, price, payment_status, notes } = req.body;
    if (!date) return res.status(400).json({ ok: false, error: 'La fecha es obligatoria' });

    // Calcular número de sesión automáticamente
    const count = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE client_id = ?`).get(req.params.clientId);
    const sessionNumber = count.c + 1;

    const status = payment_status || 'Pagado';
    const paid = status === 'Pagado' ? 1 : 0;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO sessions (id, client_id, session_number, date, type, price, paid, payment_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.clientId, sessionNumber, date, type || 'Sesión inicial',
           price || null, paid, status, notes || '');

    // Interacción automática de sistema
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'Sistema', 'Interno', ?)
    `).run(uuidv4(), req.params.clientId,
           `Sesión #${sessionNumber} registrada: ${type || 'Sesión inicial'} el ${date}. Precio: $${price || 0}. Estado: ${status}.`);

    const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
    res.status(201).json({ ok: true, data: session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
