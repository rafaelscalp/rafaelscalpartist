// ─── API LAYER ────────────────────────────────────────────────────────────────
// Centraliza todas las llamadas al backend Express.

const BASE = '/api';

const api = {
  async request(method, url, body) {
    const opts = { method, headers: {} };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    const res = await fetch(BASE + url, opts);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error desconocido');
    return json.data;
  },

  // Clientes / Leads
  leads: {
    list:    (params = {}) => api.request('GET', '/leads?' + new URLSearchParams(params)),
    metrics: ()            => api.request('GET', '/leads/metrics'),
    get:     (id)          => api.request('GET', `/leads/${id}`),
    create:  (data)        => api.request('POST', '/leads', data),
    update:  (id, data)    => api.request('PATCH', `/leads/${id}`, data),
    delete:  (id)          => api.request('DELETE', `/leads/${id}`),
  },

  // Interacciones
  interactions: {
    add:    (clientId, data) => api.request('POST', `/interactions/${clientId}`, data),
    delete: (id)             => api.request('DELETE', `/interactions/${id}`),
    addSession: (clientId, data) => api.request('POST', `/interactions/${clientId}/sessions`, data),
  },

  // Fotos
  photos: {
    upload: (clientId, file, type) => {
      const form = new FormData();
      form.append('photo', file);
      form.append('type', type);
      return api.request('POST', `/photos/${clientId}`, form);
    },
    delete: (id) => api.request('DELETE', `/photos/${id}`),
  },

  // Export
  export: {
    csvUrl: (params = {}) => BASE + '/export/csv?' + new URLSearchParams(params),
  },
};
