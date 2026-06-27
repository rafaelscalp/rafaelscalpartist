// ─── SEGUIMIENTOS AUTOMÁTICOS (CRON) ─────────────────────────────────────────

const cron   = require('node-cron');
const twilio = require('twilio');
const db     = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const WA_FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

function buildFollowupMsg(attempt, name) {
  const first = name && name !== '+' ? name.split(' ')[0] : 'te';
  if (attempt === 1) {
    return `Hola ${first}, te escribo para ver si tuviste oportunidad de revisar mi mensaje. ¿Tenés alguna duda que pueda responderte?`;
  }
  if (attempt === 2) {
    return `Hola ${first}, quería dejarte saber que estoy disponible para responder cualquier consulta sobre micropigmentación capilar cuando lo necesites.`;
  }
  return null; // intento 3 no envía mensaje, mueve a Perdido
}

async function processFollowups() {
  if (!process.env.TWILIO_ACCOUNT_SID) return;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const now = new Date().toISOString();

  const due = db.prepare(`
    SELECT f.*, c.phone, c.name, c.stage
    FROM wa_followups f
    JOIN clients c ON f.client_id = c.id
    WHERE f.status = 'pending'
    AND f.scheduled_at <= ?
    AND c.stage IN ('Nuevo','Contactado')
  `).all(now);

  for (const f of due) {
    try {
      if (f.attempt === 3) {
        // Mover a Perdido
        db.prepare(`UPDATE clients SET stage = 'Perdido', loss_reason = 'No respondió' WHERE id = ?`).run(f.client_id);
        db.prepare(`
          INSERT INTO interactions (id, client_id, type, direction, content)
          VALUES (?, ?, 'Sistema', 'Interno', ?)
        `).run(uuidv4(), f.client_id, 'Sin respuesta en 7 días → movido a Perdido automáticamente.');
      } else {
        const msg = buildFollowupMsg(f.attempt, f.name);
        if (msg) {
          await client.messages.create({
            from: WA_FROM,
            to: `whatsapp:${f.phone}`,
            body: msg,
          });
          db.prepare(`
            INSERT INTO interactions (id, client_id, type, direction, content)
            VALUES (?, ?, 'WhatsApp', 'Saliente', ?)
          `).run(uuidv4(), f.client_id, msg);
        }
      }

      db.prepare(`UPDATE wa_followups SET status = 'sent', sent_at = ? WHERE id = ?`).run(now, f.id);
      console.log(`[Followup] Intento ${f.attempt} procesado para cliente ${f.client_id}`);
    } catch (err) {
      console.error(`[Followup] Error en ${f.id}:`, err.message);
    }
  }
}

function startFollowupCron() {
  // Corre cada 15 minutos
  cron.schedule('*/15 * * * *', () => {
    processFollowups().catch(err => console.error('[Followup cron]', err.message));
  });
  console.log('[Followup] Cron iniciado — revisión cada 15 minutos');
}

module.exports = { startFollowupCron, processFollowups };
