// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

const VIEWS = ['dashboard', 'pipeline', 'clients', 'agenda'];
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  pipeline:  'Pipeline',
  clients:   'Clientes',
  agenda:    'Agenda',
};

let currentView = 'dashboard';
let searchDebounced = debounce(handleGlobalSearch, 250);
let searchDropdownDebounced = debounce(runQuickSearch, 300);

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────

function navigate(view) {
  if (!VIEWS.includes(view)) return;
  currentView = view;
  closeSearchDropdown();

  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view;

  if (view === 'dashboard') loadDashboard();
  if (view === 'pipeline')  loadPipeline();
  if (view === 'clients')   loadClients();
  if (view === 'agenda')    loadAgenda();
}

// ─── BÚSQUEDA GLOBAL — FILTROS DE VISTA ──────────────────────────────────────

function handleGlobalSearch(value) {
  const q = value.trim();
  if (q.length >= 2) {
    searchDropdownDebounced(q);
  } else {
    closeSearchDropdown();
  }
  if (currentView === 'pipeline' && !q) renderPipeline();
  if (currentView === 'clients')  applyClientsFilters();
}

// ─── BUSCADOR DROPDOWN ────────────────────────────────────────────────────────

async function runQuickSearch(q) {
  try {
    const results = await api.leads.quickSearch(q);
    renderSearchDropdown(results);
  } catch { closeSearchDropdown(); }
}

function renderSearchDropdown(results) {
  const dd = document.getElementById('search-dropdown');
  if (!results.length) {
    dd.innerHTML = '<div class="search-empty">Sin resultados</div>';
    dd.style.display = 'block';
    return;
  }
  dd.innerHTML = results.map(r => `
    <div class="search-result" onclick="selectSearchResult('${r.id}')">
      <div class="sr-avatar">${initials(r.name)}</div>
      <div class="sr-info">
        <div class="sr-name">${r.name}</div>
        <div class="sr-meta">${r.phone || ''} · ${r.origin}</div>
      </div>
      <div class="sr-stage">
        ${tempBadge(r.temperature)}<br>
        <span style="font-size:10px">${r.stage}</span>
      </div>
    </div>
  `).join('');
  dd.style.display = 'block';
}

function selectSearchResult(id) {
  closeSearchDropdown();
  document.getElementById('global-search').value = '';
  openClientDetail(id);
}

function closeSearchDropdown() {
  const dd = document.getElementById('search-dropdown');
  if (dd) dd.style.display = 'none';
}

// ─── LIMPIAR FILTROS ──────────────────────────────────────────────────────────

function clearFilters() {
  ['filter-stage','filter-origin','filter-temp','filter-from','filter-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('global-search').value = '';
  loadClients();
}

// ─── EXPORTAR CSV ────────────────────────────────────────────────────────────

function exportCSV() {
  const stage  = document.getElementById('filter-stage')?.value || '';
  const origin = document.getElementById('filter-origin')?.value || '';
  const from   = document.getElementById('filter-from')?.value || '';
  const to     = document.getElementById('filter-to')?.value || '';
  const params = {};
  if (stage) params.stage = stage;
  if (origin) params.origin = origin;
  if (from) params.from = from;
  if (to) params.to = to;
  const url = api.export.csvUrl(params);
  const a = document.createElement('a');
  a.href = url; a.download = '';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('Exportando CSV…', 'info');
}

// ─── SWITCH DE TAB EN DETALLE ────────────────────────────────────────────────

function switchDetailTabByClick(tab) {
  activateTab(tab);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();

  const searchInput = document.getElementById('global-search');
  searchInput.addEventListener('input', (e) => {
    searchDebounced(e.target.value);
  });
  searchInput.addEventListener('focus', (e) => {
    if (e.target.value.trim().length >= 2) runQuickSearch(e.target.value.trim());
  });

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) closeSearchDropdown();
    // Cerrar notas rápidas al hacer clic fuera
    if (!e.target.closest('.kanban-card')) {
      document.querySelectorAll('.quick-note-popup').forEach(p => p.style.display = 'none');
    }
  });

  // Cerrar modales y dropdown con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailModal();
      closeFormModal();
      closeSearchDropdown();
      document.getElementById('global-search').value = '';
      document.querySelectorAll('.quick-note-popup').forEach(p => p.style.display = 'none');
    }
  });
});
