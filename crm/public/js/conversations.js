// ─── CONVERSACIONES WHATSAPP ──────────────────────────────────────────────────

let activeConvId   = null;
let convAutoRefresh = null;

async function loadConversations() {
  try {
    const convs = await api.conversations.list();
    renderConvList(convs);
    // Actualizar badge del menú
    const unread = convs.filter(c => c.last_direction === 'Entrante').length;
    const badge = document.getElementById('nav-unread');
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-flex' : 'none';
    }
  } catch (err) {
    toast('Error cargando conversaciones', 'error');
  }
}

function renderConvList(convs) {
  const el = document.getElementById('conv-list-body');
  if (!convs.length) {
    el.innerHTML = `<div class="conv-empty">
      <p>Sin conversaciones WhatsApp aún.</p>
      <p style="font-size:11px">Los mensajes aparecen aquí cuando un cliente escribe al número de WhatsApp.</p>
    </div>`;
    return;
  }

  el.innerHTML = convs.map(c => {
    const isActive = c.id === activeConvId;
    const aiIcon   = c.ai_enabled ? '🤖' : '👤';
    const name     = c.name !== c.phone ? c.name : c.phone;
    const preview  = (c.last_message || '').substring(0, 60) + (c.last_message?.length > 60 ? '…' : '');
    const inbound  = c.last_direction === 'Entrante';
    return `
      <div class="conv-item ${isActive ? 'active' : ''} ${inbound ? 'unread' : ''}"
           onclick="openConversation('${c.id}')">
        <div class="conv-item-avatar">${initials(name)}</div>
        <div class="conv-item-info">
          <div class="conv-item-name">${name} <span class="conv-ai-badge">${aiIcon}</span></div>
          <div class="conv-item-preview">${preview || '—'}</div>
        </div>
        <div class="conv-item-meta">
          ${tempBadge(c.temperature)}
          <div class="conv-item-time">${timeAgo(c.last_message_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function openConversation(clientId) {
  activeConvId = clientId;
  // Resaltar en la lista
  document.querySelectorAll('.conv-item').forEach(el => {
    el.classList.toggle('active', el.onclick?.toString().includes(clientId));
  });

  const thread = document.getElementById('conv-thread');
  thread.innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner" style="margin:auto"></div></div>`;

  try {
    const [msgs, convs] = await Promise.all([
      api.conversations.messages(clientId),
      api.conversations.list(),
    ]);
    const conv = convs.find(c => c.id === clientId);
    renderThread(clientId, conv, msgs);
  } catch (err) {
    toast('Error cargando hilo', 'error');
  }
}

function renderThread(clientId, conv, msgs) {
  if (!conv) return;
  const name     = conv.name !== conv.phone ? conv.name : conv.phone;
  const aiOn     = conv.ai_enabled;
  const aiLabel  = aiOn ? '🤖 IA activa' : '👤 Control manual';
  const aiBtnTxt = aiOn ? 'Tomar control' : 'Activar IA';

  const thread = document.getElementById('conv-thread');
  thread.innerHTML = `
    <div class="conv-thread-header">
      <div>
        <div class="conv-thread-name">${name}</div>
        <div class="conv-thread-sub">${conv.phone} · ${conv.stage} · ${tempBadge(conv.temperature)}</div>
      </div>
      <div class="conv-thread-actions">
        <span class="conv-ai-status ${aiOn ? 'ai-on' : 'ai-off'}">${aiLabel}</span>
        <button class="btn btn-secondary btn-sm" onclick="toggleAI('${clientId}', ${!aiOn})">
          ${aiBtnTxt}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="openClientDetail('${clientId}')">Ver ficha →</button>
      </div>
    </div>

    <div class="conv-messages" id="conv-messages-${clientId}">
      ${msgs.map(m => renderMessage(m)).join('')}
    </div>

    <div class="conv-reply">
      <textarea id="conv-reply-input" class="form-textarea"
        placeholder="Escribir mensaje de WhatsApp…" rows="3"
        onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){sendConvMessage('${clientId}')}"></textarea>
      <div class="conv-reply-footer">
        <span class="conv-reply-hint">Ctrl+Enter para enviar</span>
        <button class="btn btn-primary btn-sm" onclick="sendConvMessage('${clientId}')">
          Enviar 💬
        </button>
      </div>
    </div>
  `;

  // Scroll al fondo
  const msgEl = document.getElementById(`conv-messages-${clientId}`);
  if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
}

function renderMessage(m) {
  const isOutbound = m.direction === 'Saliente';
  const isSystem   = m.direction === 'Interno';
  if (isSystem) {
    return `<div class="conv-msg-system">${m.content} · ${timeAgo(m.created_at)}</div>`;
  }

  // Detectar si el contenido es una foto de Twilio
  const fotoMatch = m.content && m.content.match(/📷 Foto: (https:\/\/api\.twilio\.com\S+)/);
  let bubbleHtml;
  if (fotoMatch) {
    const proxyUrl = `/api/media?url=${encodeURIComponent(fotoMatch[1])}`;
    bubbleHtml = `<img src="${proxyUrl}" alt="Foto del cliente"
      style="max-width:220px;max-height:300px;border-radius:8px;cursor:pointer;display:block"
      onclick="window.open('${proxyUrl}','_blank')"
      onerror="this.outerHTML='<span style=color:#999>📷 Foto no disponible</span>'"
    >`;
  } else {
    bubbleHtml = m.content;
  }

  return `
    <div class="conv-msg ${isOutbound ? 'outbound' : 'inbound'}">
      <div class="conv-msg-bubble">${bubbleHtml}</div>
      <div class="conv-msg-time">${fmtDateTime(m.created_at)}</div>
    </div>
  `;
}

async function sendConvMessage(clientId) {
  const input = document.getElementById('conv-reply-input');
  const msg   = input?.value?.trim();
  if (!msg) return toast('Escribí un mensaje', 'error');
  input.value = '';
  input.disabled = true;

  try {
    await api.conversations.send(clientId, msg);
    toast('Mensaje enviado ✓', 'success');
    await openConversation(clientId);
  } catch (err) {
    toast(err.message, 'error');
    input.disabled = false;
  }
}

async function toggleAI(clientId, enable) {
  try {
    await api.conversations.toggleAI(clientId, enable);
    toast(enable ? 'IA activada' : 'Modo manual activado', 'success');
    await openConversation(clientId);
    loadConversations();
  } catch (err) {
    toast(err.message, 'error');
  }
}
