// ─── PIPELINE / KANBAN ────────────────────────────────────────────────────────

const STAGES = ['Nuevo','Contactado','Presupuestado','Sesión agendada','Cliente activo','Perdido'];

let pipelineData = [];
let draggedId = null;

async function loadPipeline(filters = {}) {
  try {
    pipelineData = await api.leads.list({ ...filters });
    renderPipeline();
  } catch (err) {
    toast('Error cargando pipeline', 'error');
  }
}

function renderPipeline() {
  const board = document.getElementById('pipeline-board');
  board.innerHTML = '';
  for (const stage of STAGES) {
    const cards = pipelineData.filter(c => c.stage === stage);
    board.appendChild(buildColumn(stage, cards));
  }
}

function buildColumn(stage, cards) {
  const col = document.createElement('div');
  col.className = 'pipeline-col';
  col.dataset.stage = stage;

  col.innerHTML = `
    <div class="col-header">
      <span class="col-title">${stage}</span>
      <span class="col-count">${cards.length}</span>
    </div>
    <div class="col-body" data-stage="${stage}">
      ${cards.length === 0 ? '<div class="empty-state" style="padding:24px 0"><p>Sin leads</p></div>' : ''}
    </div>
  `;

  const body = col.querySelector('.col-body');
  for (const card of cards) body.appendChild(buildCard(card));

  body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drag-over'); });
  body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
  body.addEventListener('drop', async (e) => {
    e.preventDefault();
    body.classList.remove('drag-over');
    if (!draggedId) return;
    const targetStage = body.dataset.stage;
    const current = pipelineData.find(c => c.id === draggedId);
    if (!current || current.stage === targetStage) return;

    // Si se mueve a Perdido, pedir motivo
    if (targetStage === 'Perdido') {
      openLossModal(draggedId, targetStage);
      return;
    }

    try {
      await api.leads.update(draggedId, { stage: targetStage });
      current.stage = targetStage;
      renderPipeline();
      toast(`Movido a "${targetStage}"`, 'success');
      if (document.getElementById('view-dashboard').classList.contains('active')) loadDashboard();
    } catch (err) {
      toast('Error actualizando etapa', 'error');
    }
  });

  return col;
}

// Calcula horas desde el último contacto
function hoursSinceContact(client) {
  const ref = client.last_contact_at || client.created_at;
  if (!ref) return null;
  return (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60);
}

function buildCard(client) {
  const el = document.createElement('div');
  el.className = 'kanban-card';
  el.draggable = true;
  el.dataset.id = client.id;

  // Alerta sin contacto (solo en etapas activas, no Perdido ni Cliente activo)
  const activeStages = ['Nuevo','Contactado','Presupuestado','Sesión agendada'];
  let noContactHtml = '';
  if (activeStages.includes(client.stage)) {
    const hours = hoursSinceContact(client);
    if (hours !== null) {
      if (hours > 72) {
        el.classList.add('no-contact-critical');
        noContactHtml = `<span class="no-contact-badge critical">⚠ ${Math.floor(hours/24)}d sin contacto</span>`;
      } else if (hours > 24) {
        el.classList.add('no-contact-alert');
        noContactHtml = `<span class="no-contact-badge">${Math.floor(hours)}h sin contacto</span>`;
      }
    }
  }

  el.innerHTML = `
    <div class="card-name">${client.name}</div>
    <div class="card-phone">${client.phone || 'Sin teléfono'}</div>
    <div class="card-meta">
      <span class="temp-dot ${client.temperature}"></span>
      <span class="badge badge-origin" style="font-size:10px">${client.origin}</span>
      ${client.budget ? `<span style="font-size:11px;color:var(--accent)">${fmtCurrency(client.budget)}</span>` : ''}
      ${noContactHtml}
    </div>
    <div class="card-date">Ingresó ${timeAgo(client.created_at)}</div>
    <div class="card-actions">
      <button class="btn btn-ghost btn-icon btn-sm" title="Ver detalle" onclick="event.stopPropagation();openClientDetail('${client.id}')">👁</button>
      <button class="btn btn-ghost btn-icon btn-sm" title="Mensaje WA" onclick="event.stopPropagation();openClientDetail('${client.id}').then(()=>openWAModal())">💬</button>
      <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="event.stopPropagation();openEditModal('${client.id}')">✏️</button>
    </div>
  `;

  el.addEventListener('dragstart', () => { draggedId = client.id; el.classList.add('dragging'); });
  el.addEventListener('dragend', () => { draggedId = null; el.classList.remove('dragging'); });
  el.addEventListener('click', () => openClientDetail(client.id));
  return el;
}

function filterPipeline(search) {
  const q = search.toLowerCase();
  const board = document.getElementById('pipeline-board');
  board.innerHTML = '';
  for (const stage of STAGES) {
    const cards = q
      ? pipelineData.filter(c => c.stage === stage && (c.name.toLowerCase().includes(q) || (c.phone||'').includes(q)))
      : pipelineData.filter(c => c.stage === stage);
    board.appendChild(buildColumn(stage, cards));
  }
}
