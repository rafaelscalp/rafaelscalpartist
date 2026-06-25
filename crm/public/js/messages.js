// ─── WHATSAPP MESSAGE GENERATOR ───────────────────────────────────────────────

function openWAModal() {
  const c = currentClientData;
  if (!c) { toast('Abrí un cliente primero', 'error'); return; }
  document.getElementById('wa-message-box').textContent = 'Seleccioná un tipo de mensaje arriba.';
  document.getElementById('modal-wa').classList.add('open');
}

function closeWAModal() {
  document.getElementById('modal-wa').classList.remove('open');
}

function generateWAMessage(type) {
  const c = currentClientData;
  if (!c) return;
  const nombre = c.name.split(' ')[0]; // Solo el primer nombre
  let msg = '';

  switch (type) {
    case 'primer_contacto':
      msg = `Hola ${nombre}, soy Rafael del estudio Rafael Scalp Artist.

Vi tu consulta y quería escribirte personalmente para contarte un poco más sobre el servicio.

La micropigmentación capilar es una técnica permanente que simula la apariencia de cabello en el cuero cabelludo — sin cirugía, sin dolor, y con resultados naturales desde la primera sesión.

¿Tenés alguna consulta puntual o preferís que coordinemos una videollamada sin compromiso para que veas casos reales?`;
      break;

    case 'seguimiento_24':
      msg = `Hola ${nombre}, te escribo porque ayer te mandé un mensaje y no sé si te llegó bien.

¿Pudiste ver la info? Si tenés alguna duda o querés ver antes y después de trabajos reales, con gusto te mando.`;
      break;

    case 'seguimiento_72':
      msg = `Hola ${nombre}, sé que el timing a veces no es el mejor para revisar mensajes.

Solo quería dejar la puerta abierta por si en algún momento querés retomar la consulta sobre la micropigmentación. No hay apuro ni compromiso de tu lado.

Cuando quieras, acá estoy.`;
      break;

    case 'presupuesto':
      const budget = c.budget ? `El valor del procedimiento es de $${Number(c.budget).toLocaleString('es-AR')}.` : 'El valor lo coordinamos en la consulta dependiendo de la zona a tratar.';
      msg = `Hola ${nombre}, te paso el presupuesto que hablamos.

${budget}

Esto incluye la sesión completa, los materiales, y el seguimiento post-procedimiento. El retoque de mantenimiento (si lo necesitás) se hace recién a los 3 años aproximadamente.

¿Tenés alguna pregunta sobre el proceso o querés que empecemos a coordinar fecha?`;
      break;

    case 'confirmar_sesion':
      msg = `Hola ${nombre}, te confirmo la sesión que tenemos agendada.

Solo recordarte que el día de la sesión:
• Vení con el cabello limpio y seco
• No uses ningún producto en el cuero cabelludo
• Si podés, descansá bien la noche anterior

Cualquier duda de último momento, escribime acá mismo.

¡Nos vemos pronto!`;
      break;
  }

  const box = document.getElementById('wa-message-box');
  box.textContent = msg;
}

async function copyWAMessage() {
  const text = document.getElementById('wa-message-box').textContent;
  if (!text || text === 'Seleccioná un tipo de mensaje arriba.') {
    toast('Generá un mensaje primero', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Mensaje copiado al portapapeles ✓', 'success');
  } catch {
    toast('No se pudo copiar, seleccionalo manualmente', 'error');
  }
}
