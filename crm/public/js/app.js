// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
// Inicialización, navegación y coordinación entre módulos.

const VIEWS = ['dashboard', 'pipeline', 'clients'];
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  pipeline:  'Pipeline',
  clients:   'Clientes',
};

let currentView = 'dashboard';
let searchDebounced = debounce(handleGlobalSearch, 300);

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────

function navigate(view) {
  if (!VIEWS.includes(view)) return;
  currentView = view;

  // Actualizar sidebar
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  // Mostrar view correcta
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');

  // Título del topbar
  document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view;

  // Cargar datos de la view
  if (view === 'dashboard') loadDashboard();
  if (view === 'pipeline')  loadPipeline();
  if (view === 'clients')   loadClients();
}

// ─── BÚSQUEDA GLOBAL ─────────────────────────────────────────────────────────

function handleGlobalSearch(value) {
  const q = value.trim();
  if (currentView === 'pipeline') {
    filterPipeline(q);
  } else if (currentView === 'clients') {
    applyClientsFilters();
  } else if (q.length > 1) {
    navigate('clients');
  }
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
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Exportando CSV…', 'info');
}

// ─── SWITCH DE TAB EN DETALLE ────────────────────────────────────────────────

function switchDetailTabByClick(tab) {
  activateTab(tab);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();

  // Búsqueda con debounce
  document.getElementById('global-search').addEventListener('input', (e) => {
    searchDebounced(e.target.value);
  });

  // Cerrar modales con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailModal();
      closeFormModal();
    }
  });
});
