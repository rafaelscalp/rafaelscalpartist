const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Exportar todos los clientes a CSV
router.get('/csv', (req, res) => {
  try {
    const { stage, origin, from, to } = req.query;

    let sql = `SELECT c.id, c.name, c.phone, c.email, c.origin, c.campaign,
      c.stage, c.temperature, c.budget, c.notes, c.next_touch, c.created_at,
      (SELECT COUNT(*) FROM sessions WHERE client_id = c.id) AS sessions,
      (SELECT COALESCE(SUM(price),0) FROM sessions WHERE client_id = c.id AND paid=1) AS total_paid
      FROM clients c WHERE 1=1`;
    const params = [];

    if (stage)  { sql += ` AND c.stage = ?`;       params.push(stage); }
    if (origin) { sql += ` AND c.origin = ?`;      params.push(origin); }
    if (from)   { sql += ` AND c.created_at >= ?`; params.push(from); }
    if (to)     { sql += ` AND c.created_at <= ?`; params.push(to + 'T23:59:59'); }

    sql += ` ORDER BY c.created_at DESC`;
    const clients = db.prepare(sql).all(...params);

    const headers = [
      'ID','Nombre','Teléfono','Email','Origen','Campaña',
      'Etapa','Temperatura','Presupuesto','Sesiones','Total cobrado',
      'Notas','Próximo contacto','Fecha de ingreso'
    ];

    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = clients.map(c => [
      c.id, c.name, c.phone, c.email, c.origin, c.campaign,
      c.stage, c.temperature, c.budget, c.sessions, c.total_paid,
      c.notes, c.next_touch, c.created_at
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `rafael-scalp-crm-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM para Excel
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
