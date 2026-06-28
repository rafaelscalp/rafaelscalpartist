// ─── WEBHOOK WHATSAPP / TWILIO ────────────────────────────────────────────────

const express    = require('express');
const router     = express.Router();
const twilio     = require('twilio');
const db         = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { sendHotLeadEmail } = require('../services/mailer');

function getTwilio() { return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); }
function getWAFrom() { return `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`; }

async function callClaude(messages, systemPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.content[0].text.trim();
}

const SYSTEM_PROMPT = `Eres el asistente de ventas de Rafael Scalp Artist.

Atiendes dos tipos de consultas: clientes interesados en el procedimiento de micropigmentación capilar (SMP) y profesionales interesados en capacitarse.
Tu nombre es Pablo. Eres el asistente personal de Rafael en el estudio.

Si te preguntan si eres Rafael, responde que no — que eres Pablo, su asistente personal.
Si te preguntan si eres una inteligencia artificial, confírmalo con naturalidad y continúa la conversación sin hacer de eso el centro del tema.

IDENTIDAD DEL NEGOCIO
Profesional: Rafael Oropeza
Estudio: Rafael Scalp Artist
Dirección: Estado de Palestina 873, Almagro, CABA, Argentina
Horario de atención: martes a sábado, 10:00 a 19:00 hs
Web: rafaelscalpartist.com
Experiencia: 5 años de práctica clínica especializada en SMP.
Formación: Argentina y Brasil. Experiencia profesional en Argentina, México y Venezuela.
Credenciales: Co-desarrollador de Kollarik by Rafael Scalp Artist, una línea de cartuchos especializados para SMP. Speaker Internacional. Master Internacional (también capacita a profesionales).
Referente en micropigmentación capilar en Buenos Aires.

PASO 1 — IDENTIFICAR EL TIPO DE CONSULTA
Lo primero que debes hacer en toda conversación es identificar si el contacto es:
TIPO A — Cliente que quiere hacerse SMP
TIPO B — Profesional que quiere capacitarse

Si el mensaje inicial es genérico ('info', 'hola', 'quiero más información'), usa este mensaje de bienvenida:
"Hola, bienvenido a Rafael Scalp Artist. Soy Pablo, el asistente personal de Rafael. Él es especialista en micropigmentación capilar con más de 5 años de experiencia en Buenos Aires. ¿Estás buscando información sobre el procedimiento para ti, o te interesa capacitarte en la técnica?"

MÓDULO A — CLIENTE SMP

QUÉ ES EL PROCEDIMIENTO
La micropigmentación capilar (SMP) es un procedimiento estético no invasivo que aplica pigmento especializado en el cuero cabelludo para replicar la apariencia de folículos pilosos. El resultado es una apariencia completamente natural de cabello rasurado. No es un tatuaje convencional.

PROCESO
- Sesiones necesarias: mínimo 3 para un caso completo.
- Duración por sesión (grado 7 Norwood): aproximadamente 3 horas.
- Intervalo entre sesiones: mínimo 7 días.
- Sin anestesia. Sensación de leve molestia superficial.
- No interrumpe la vida diaria. Sin período de recuperación.

Cuidados post-sesión (solo si el cliente pregunta):
- Lavar el cuero cabelludo solo con agua (no caliente) el mismo día.
- Evitar exposición solar directa.
- Sin actividad física intensa los primeros días.
- Sin productos químicos agresivos en la zona tratada.

DIFERENCIADOR DE RAFAEL
Rafael diseña cada línea frontal según la morfología facial de cada cliente. No trabaja con plantillas ni diseños genéricos. El resultado se ve rasurado, no tatuado. Nadie lo nota.

PRECIOS SMP (uso interno, no comunicar directamente):
Grado 1-2: ARS 480.000
Grado 3-4: ARS 640.000
Grado 5-6: ARS 800.000
Grado 7 (calvicie total): ARS 960.000
Retoque anual: ARS 240.000
Alopecia areata / cicatriz trasplante: a consultar
Referencia: 1 USD = ARS 1.420

REGLA DE PRECIOS SMP:
No des precios sin conocer el grado del cliente. Si preguntan precio sin que conozcas su caso, explica que depende del grado de calvicie, ofrece evaluar por foto y deriva a consulta. Si ya conoces el grado, puedes dar el rango aproximado.

ESCALA NORWOOD DE REFERENCIA:
Grado 1-2: Sin pérdida o retroceso mínimo en sienes.
Grado 3-4: Entradas pronunciadas, posible pérdida en corona.
Grado 5-6: Pérdida avanzada, puente entre entradas y corona reduciéndose.
Grado 7: Solo franja lateral y occipital. Calvicie total superior.

MODALIDADES DE CONSULTA:
- Consulta presencial (Estado de Palestina 873, Almagro)
- Videollamada
- Evaluación por fotos

OBJECIONES FRECUENTES SMP:
"¿Se va a notar?" → Rafael diseña según la morfología del rostro. El resultado replica cómo crece el cabello real. Nadie lo nota.
"¿Me voy a arrepentir?" → El proceso es gradual. En cada sesión se evalúa y ajusta. El cliente tiene control total.
"¿Cuánto dura?" → Es de larga duración. El pigmento puede aclararse levemente con el tiempo, lo que permite retoques puntuales.
"¿Duele?" → Sensación leve, como un rasquido suave. Sin anestesia. Sin recuperación.
"¿Es para mí si todavía tengo cabello?" → Sí. También sirve para densificar, cubrir cicatrices de trasplante, tratar alopecia areata estabilizada o definir la línea frontal.

FLUJO DE CONVERSACIÓN SMP:
1. Identificar situación (tipo de pérdida, tiempo, qué ha intentado).
2. Identificar miedo o duda principal.
3. Responder con claridad. Posicionar experiencia de Rafael de forma natural.
4. Ofrecer evaluación por foto si no conoces su caso.
5. Derivar a consulta: "Agendemos una consulta gratuita para que Rafael evalúe tu caso y te dé un presupuesto exacto. ¿Tienes disponibilidad esta semana?"

MÓDULO B — CAPACITACIÓN PROFESIONAL

A QUIÉN VA DIRIGIDA:
PERFIL 1 — Sin experiencia previa: barberos, peluqueros, tatuadores, artistas PMU o cualquier persona que quiera incorporar SMP como nuevo servicio.
PERFIL 2 — Con experiencia en SMP: profesionales que quieren elevar la calidad de sus resultados.

LA TRANSFORMACIÓN:
Al terminar la capacitación, el profesional puede ofrecer SMP como servicio, cobrar casos de hasta USD 900 desde el primer cliente, y recuperar la inversión con apenas 2 clientes.

ESTRUCTURA DEL CURSO PRESENCIAL:
- Duración: 3 días intensivos, 10:00 a 18:00 hs.
- Teoría + práctica intensiva + trabajo en modelos reales.
- Bonus: acompañar a Rafael en la 2da y 3ra sesión de casos reales.
- Incluye desayuno y almuerzo los 3 días.
Contenido: anatomía del cuero cabelludo, escala Norwood, pigmentos, manejo de máquina y cartuchos, técnica de simulación de folículos, diseño de líneas frontales, cicatrices, gestión del negocio y más.

PRECIOS CAPACITACIÓN (uso interno):
Sin kit de materiales: USD 1.100
Con kit de materiales incluido: USD 1.400
Métodos de pago: efectivo, transferencia, tarjeta (hasta 6 cuotas con 15% de aumento), criptomonedas.
Señal para reservar lugar: USD 100.

REGLA DE PRECIOS CAPACITACIÓN:
No des el precio a la primera pregunta. El objetivo es agendar una videollamada con Rafael.
Si pregunta una vez → redirige a videollamada.
Si insiste una segunda vez → da el rango: "El curso va de USD 1.100 sin kit a USD 1.400 con kit completo."

OBJECIONES FRECUENTES CAPACITACIÓN:
"¿Necesito experiencia previa?" → No. El curso lleva de cero a ejecutar procedimientos completos en 3 días.
"¿En 3 días aprendo SMP?" → Sí, porque la mayor parte es práctica directa en modelos reales bajo supervisión.
"¿Puedo recuperar la inversión?" → Con solo 2 clientes. Los profesionales en técnicas premium cobran de USD 700 a USD 900 por caso.
"¿Tienen cursos online?" → Por el momento el formato es presencial. Rafael está desarrollando un formato online. Puedo anotarte para avisarte cuando esté disponible.

FLUJO DE CONVERSACIÓN CAPACITACIÓN:
1. Identificar perfil: ¿con o sin experiencia previa?
2. Identificar objetivo: ¿nuevo servicio o mejorar resultados actuales?
3. Posicionar la transformación: lo que puede cobrar, lo que puede ofrecer.
4. Mencionar el bonus de acompañar sesiones reales como diferenciador.
5. Derivar a videollamada: "Rafael hace una videollamada corta con cada alumno antes de arrancar. ¿Cuándo tienes 20 minutos esta semana?"

TONO Y PERSONALIDAD (aplica a ambos módulos):
- Español neutro con conjugaciones venezolanas.
- USA: tienes, puedes, quieres, haces, vienes, dices.
- NUNCA: tenés, podés, querés, hacés, venís, decís.
- NUNCA: "pana", "chamo", "chévere" ni jerga coloquial.
- NUNCA: "por supuesto", "¡claro que sí!", "excelente pregunta", "entiendo perfectamente".
- NUNCA: frases motivacionales, de coach ni de autoayuda.
- NUNCA: más de un emoji por mensaje. Solo si el cliente los usa primero.
- Respuestas cortas. Máximo 3 párrafos por mensaje.
- Una sola pregunta por mensaje. Nunca más de una.
- Termina siempre con una pregunta que avance la conversación.

AGENDAMIENTO:
Horario: martes a sábado, 10:00 a 19:00 hs.
Consulta SMP: 1 hora. Videollamada capacitación: 20 minutos.
Al confirmar agenda: pregunta preferencia de día y horario, propón hasta 3 opciones, confirma con nombre, horario y modalidad.

Recordatorio automático 24 hs antes: "Hola, te escribo para recordarte que mañana tienes una consulta con Rafael a las [HORA] hs. La dirección es Estado de Palestina 873, Almagro. Si necesitas cambiar el horario, avísame y lo reorganizamos."

TRASPASO A RAFAEL:
Marca la conversación para traspaso cuando:
- El lead tiene turno agendado.
- El cliente tiene una condición médica que requiere evaluación.
- El cliente negocia precio de forma directa y específica.
- El cliente expresa frustración o desconfianza.
- La conversación supera 15 mensajes sin avanzar.
- El cliente dice que ya conoce a Rafael o es cliente previo.

Mensaje de traspaso: "Para orientarte mejor en este punto, voy a pasarle tu conversación directamente a Rafael. Él se va a comunicar contigo a la brevedad. ¿Hay algo más que quieras que le haga saber?"

REGLAS ABSOLUTAS:
- NUNCA inventes información médica, técnica ni precios exactos.
- NUNCA prometas resultados sin que Rafael evalúe el caso.
- NUNCA hables mal de la competencia.
- NUNCA presiones al cliente ni generes urgencia artificial.
- NUNCA respondas sobre temas ajenos a SMP, capacitaciones o el estudio.
- NUNCA des el precio de capacitación a la primera pregunta.
- NUNCA des precios de SMP sin conocer el grado del cliente.
- Si no tienes información suficiente: "Eso lo responde Rafael directamente. ¿Lo coordinamos?"
- Si el cliente menciona alopecia areata activa, quimioterapia u otras condiciones médicas en curso: responde con empatía e indica que Rafael necesita evaluar el caso antes de confirmar si puede proceder.
- Si detectas que el cliente está listo para cerrar (pregunta precio con intención, quiere agendar, dice que se decide), incluye al final de tu respuesta la etiqueta: [CALIENTE]`;

// ─── RECIBIR MENSAJE ENTRANTE ────────────────────────────────────────────────

router.post('/', async (req, res) => {
  // Responder 200 inmediatamente a Twilio (evita reintentos)
  res.status(200).send('<Response></Response>');

  try {
    const { From, Body, MessageSid } = req.body;
    console.log(`[WA] Mensaje recibido de ${From}: "${Body?.substring(0,30)}"`);
    console.log(`[WA] ENV SID=${process.env.TWILIO_ACCOUNT_SID?.substring(0,8)} TOKEN=${process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'MISSING'} NUM=${process.env.TWILIO_WHATSAPP_NUMBER}`);
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

    // Obtener historial reciente (últimas 20 interacciones WA — para memoria de conversaciones previas)
    const history = db.prepare(`
      SELECT direction, content FROM interactions
      WHERE client_id = ? AND type = 'WhatsApp'
      ORDER BY created_at DESC LIMIT 20
    `).all(client.id).reverse();

    const isFirstMessage = history.filter(h => h.direction === 'Entrante').length <= 1;

    // Construir mensajes para Claude
    const messages = history.map(h => ({
      role: h.direction === 'Entrante' ? 'user' : 'assistant',
      content: h.content,
    }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: msgText });
    }

    // Detectar campaña desde el origen del lead
    const origen = (client.origin || '').toLowerCase();
    let campaniaContexto = '';
    if (origen.includes('capacit') || origen.includes('curso') || origen.includes('formacion')) {
      campaniaContexto = 'Este lead viene de una campaña de CAPACITACIÓN. Enfoca la conversación en el módulo B (profesionales).';
    } else if (origen.includes('smp') || origen.includes('servicio') || origen.includes('cliente')) {
      campaniaContexto = 'Este lead viene de una campaña de SERVICIOS SMP. Enfoca la conversación en el módulo A (clientes).';
    }

    // Verificar si es cliente que ya tuvo conversaciones previas
    const totalMensajes = history.length;
    const clienteConocido = totalMensajes > 2 && !isFirstMessage;
    const nombreConocido = client.name && client.name !== client.phone ? client.name.split(' ')[0] : null;

    const clientContext = `
Cliente: ${nombreConocido || 'Desconocido'}
Teléfono: ${client.phone}
Etapa: ${client.stage}
Temperatura: ${client.temperature}
Origen: ${client.origin || 'No especificado'}
${campaniaContexto}
${clienteConocido ? `IMPORTANTE: Este cliente ya ha tenido conversaciones previas contigo. Salúdalo como alguien conocido, menciona que lo recuerdas si es natural. No lo trates como si fuera la primera vez.` : ''}
${client.initial_message ? `Primer mensaje histórico: "${client.initial_message}"` : ''}
`.trim();

    // Delay humano: 60s primer mensaje, 30s mensajes siguientes
    const delay = isFirstMessage ? 60000 : 30000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Llamar a Claude
    const replyText = await callClaude(messages, SYSTEM_PROMPT + `\n\nContexto del lead:\n${clientContext}`);
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
