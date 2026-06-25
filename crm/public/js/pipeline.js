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

  for (const card of cards) {
    body.appendChild(buildCard(card));
  }

  // Drag-and-drop handlers
  body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drag-over'); });
  body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
  body.addEventListener('drop', async (e) => {
    e.preventDefault();
    body.classList.remove('drag-over');
    if (!draggedId) return;
    const targetStage = body.dataset.stage;
    const current = pipelineData.find(c => c.id === draggedId);
    if (!current || current.stage === targetStage) return;

    try {
      await api.leads.update(draggedId, { stage: targetStage });
      current.stage = targetStage;
      renderPipeline();
      toast(`Movido a "${targetStage}"`, 'success');
      // Refrescar dashboard si está visible
      if (document.getElementById('view-dashboard').classList.contains('active')) loadDashboard();
    } catch (err) {
      toast('Error actualizando etapa', 'error');
    }
  });

  return col;
}

function buildCard(client) {
  const el = document.createElement('div');
  el.className = 'kanban-card';
  el.draggable = true;
  el.dataset.id = client.id;

  el.innerHTML = `
    <div class="card-name">${client.name}</div>
    <div class="card-phone">${client.phone || 'Sin teléfono'}</div>
    <div class="card-meta">
      <span class="temp-dot ${client.temperature}"></span>
      <span class="badge badge-origin" style="font-size:10px">${client.origin}</span>
      ${client.budget ? `<span style="font-size:11px;color:var(--accent)">${fmtCurrency(client.budget)}</span>` : ''}
    </div>
    <div class="card-date">${timeAgo(client.created_at)}</div>
    <div class="card-actions">
      <button class="btn btn-ghost btn-icon btn-sm" title="Ver detalle" onclick="event.stopPropagation();openClientDetail('${client.id}')">👁</button>
      <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="event.stopPropagation();openEditModal('${client.id}')">✏️</button>
    </div>
  `;

  el.addEventListener('dragstart', () => {
    draggedId = client.id;
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    draggedId = null;
    el.classList.remove('dragging');
  });

  el.addEventListener('click', () => openClientDetail(client.id));
  return el;
}

// Filtro de búsqueda en pipeline
function filterPipeline(search) {
  const q = search.toLowerCase();
  const filtered = q
    ? pipelineData.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
    : pipelineData;

  const board = document.getElementById('pipeline-board');
  board.innerHTML = '';
  for (const stage of STAGES) {
    const cards = filtered.filter(c => c.stage === stage);
    board.appendChild(buildColumn(stage, cards));
  }
}
