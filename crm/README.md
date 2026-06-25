# Rafael Scalp CRM

## Instalación (primera vez)

### 1. Instalar Node.js
Descargar desde https://nodejs.org → versión LTS → instalar el `.pkg`.

### 2. Instalar dependencias
```bash
cd crm
npm install
```

### 3. Cargar datos de prueba (opcional)
```bash
npm run seed
```

### 4. Iniciar el CRM
```bash
npm start
```

Abre http://localhost:3001 en el navegador.

---

## Estructura

```
crm/
├── server.js          # Servidor Express
├── database/
│   ├── db.js          # SQLite schema
│   └── seed.js        # Datos de prueba
├── routes/
│   ├── leads.js       # CRUD clientes + métricas
│   ├── interactions.js
│   ├── photos.js
│   └── export.js      # CSV
├── webhooks/
│   └── meta.js        # Fase 2 (Meta Lead Ads)
├── whatsapp/          # Fase 3
├── ai/                # Fase 4
└── public/            # Frontend
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── api.js
        ├── utils.js
        ├── dashboard.js
        ├── pipeline.js
        ├── clients.js
        └── app.js
```
