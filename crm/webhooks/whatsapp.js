// ─── WEBHOOK WHATSAPP / TWILIO ────────────────────────────────────────────────

const express    = require('express');
const router     = express.Router();
const twilio     = require('twilio');
const Anthropic  = require('@anthropic-ai/sdk');
const db         = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { sendHotLeadEmail } = require('../services/mailer');

// Clientes creados lazy para tomar las env vars en runtime, no al cargar el módulo
function getTwilio()    { return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); }
function getAnthropic() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); }
function getWAFrom()    { return `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`; }

const SYSTEM_PROMPT = `Sos el asistente de Rafael Oropeza, especialista en micropigmentación capilar en Buenos Aires con más de 5 años de experiencia. Tu trabajo es responder consultas de clientes potenciales de forma profesional, cercana y directa.

Reglas:
- Nunca des precios exactos. El precio se define en una consulta personalizada.
- Siempre terminá con una pregunta para mantener la conversación activa.
- Si el cliente pregunta por disponibilidad o quiere agendar, decile que Rafael va a confirmar la fecha.
- Si detectás que el cliente está listo para cerrar (pregunta precio, quiere agendar, dice que se decide), incluí al final de tu respuesta la etiqueta: [CALIENTE]
- Respondé siempre en español neutro, sin voseo argentino.
- Máximo 3 oraciones por respuesta. Claro y directo.`;

// ─── RECIBIR MENSAJE ENTRANTE ────────────────────────────────────────────────

router.post('/', async (req, res) => {
  // Responder 200 inmediatamente a Twilio (evita reintentos)
  res.status(200).send('<Response></Response>');

  try {
    const { From, Body, MessageSid } = req.body;
    if (!From || !Body) return;

    // Normalizar número: "whatsapp:+5491144332211" → "+5491144332211"
    const phone = From.replace('whatsapp:', '');
    const msgText = Body.trim();

    // Buscar o crear lead
    let client = db.prepare(
      `SELECT * FROM clients WHERE phone = ? OR phone = ? LIMIT 1`
    ).get(phone, phone.replace(/^\+/, ''));

    if (!client) {
      const newId = uuidv4();
      db.prepare(`
        INSERT INTO clients (id, name, phone, origin, stage, temperature, initial_message)
        VALUES (?, ?, ?, 'Otro', 'Nuevo', 'Tibio', ?)
      `).run(newId, phone, phone, msgText);

      db.prepare(`
        INSERT INTO interactions (id, client_id, type, direction, content, wa_message_sid)
        VALUES (?, ?, 'Sistema', 'Interno', ?, ?)
      `).run(uuidv4(), newId, `Lead creado automáticamente vía WhatsApp.`, MessageSid);

      client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(newId);
    }

    // Guardar mensaje entrante en historial
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content, wa_message_sid)
      VALUES (?, ?, 'WhatsApp', 'Entrante', ?, ?)
    `).run(uuidv4(), client.id, msgText, MessageSid);

    // Verificar si la IA está habilitada para este lead
    const control = db.prepare(`SELECT ai_enabled FROM wa_ai_control WHERE client_id = ?`).get(client.id);
    const aiEnabled = control ? control.ai_enabled === 1 : true;
    if (!aiEnabled) return; // Rafael toma control manual

    // Cancelar followups pendientes (el cliente respondió)
    db.prepare(`
      UPDATE wa_followups SET status = 'cancelled'
      WHERE client_id = ? AND status = 'pending'
    `).run(client.id);

    // Obtener historial reciente (últimas 10 interacciones WA)
    const history = db.prepare(`
      SELECT direction, content FROM interactions
      WHERE client_id = ? AND type = 'WhatsApp'
      ORDER BY created_at DESC LIMIT 10
    `).all(client.id).reverse();

    // Construir mensajes para Claude
    const messages = history.map(h => ({
      role: h.direction === 'Entrante' ? 'user' : 'assistant',
      content: h.content,
    }));
    // Asegurarse de que el último mensaje sea el actual (user)
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: msgText });
    }

    const clientContext = `
Cliente: ${client.name !== client.phone ? client.name : 'Desconocido'}
Etapa: ${client.stage}
Temperatura: ${client.temperature}
${client.initial_message ? `Primer mensaje: "${client.initial_message}"` : ''}
`.trim();

    // Llamar a Claude
    const aiResponse = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT + `\n\nContexto del lead:\n${clientContext}`,
      messages,
    });

    const replyText = aiResponse.content[0].text.trim();
    const isHot = replyText.includes('[CALIENTE]');
    const cleanReply = replyText.replace('[CALIENTE]', '').trim();

    // Enviar respuesta por WhatsApp
    await getTwilio().messages.create({
      from: getWAFrom(),
      to: `whatsapp:${phone}`,
      body: cleanReply,
    });

    // Guardar respuesta de la IA en historial
    db.prepare(`
      INSERT INTO interactions (id, client_id, type, direction, content)
      VALUES (?, ?, 'WhatsApp', 'Saliente', ?)
    `).run(uuidv4(), client.id, cleanReply);

    // Si Claude detectó [CALIENTE], actualizar temperatura y notificar
    if (isHot && client.temperature !== 'Caliente') {
      db.prepare(`UPDATE clients SET temperature = 'Caliente' WHERE id = ?`).run(client.id);
      db.prepare(`
        INSERT INTO interactions (id, client_id, type, direction, content)
        VALUES (?, ?, 'Sistema', 'Interno', ?)
      `).run(uuidv4(), client.id, 'IA clasificó el lead como CALIENTE.');

      await sendHotLeadEmail({
        name: client.name,
        phone: client.phone,
        lastMessage: msgText,
        clientId: client.id,
      }).catch(err => console.error('Email error:', err));
    }

    // Programar seguimiento si el lead es Nuevo o Contactado
    if (['Nuevo','Contactado'].includes(client.stage)) {
      scheduleFollowup(client.id, client.name, phone);
    }

  } catch (err) {
    console.error('WhatsApp webhook error:', err.message);
  }
});

// ─── PROGRAMAR SEGUIMIENTO ───────────────────────────────────────────────────

function scheduleFollowup(clientId, name, phone) {
  // Cancelar seguimientos anteriores pendientes
  db.prepare(`UPDATE wa_followups SET status = 'cancelled' WHERE client_id = ? AND status = 'pending'`).run(clientId);

  const now = new Date();

  // Intento 1: 24 horas
  const at24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  // Intento 2: 72 horas
  const at72h = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  // Intento 3: 7 días → mover a Perdido
  const at7d  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const [attempt, scheduled_at] of [[1, at24h],[2, at72h],[3, at7d]]) {
    db.prepare(`
      INSERT INTO wa_followups (id, client_id, attempt, scheduled_at, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(uuidv4(), clientId, attempt, scheduled_at);
  }
}

module.exports = router;
module.exports.scheduleFollowup = scheduleFollowup;
