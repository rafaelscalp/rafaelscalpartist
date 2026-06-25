const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const clients = [
  { name: 'Martín Rodríguez', phone: '+5491155551111', email: 'martin@email.com', origin: 'Meta', campaign: 'SMP_BA_Junio', stage: 'Cliente activo', temperature: 'Caliente', budget: 180000, notes: 'Completó 2 sesiones. Muy satisfecho.' },
  { name: 'Diego Fernández', phone: '+5491155552222', email: 'diego@email.com', origin: 'Instagram', campaign: null, stage: 'Sesión agendada', temperature: 'Caliente', budget: 160000, notes: 'Sesión confirmada para el viernes.' },
  { name: 'Lucas Gómez', phone: '+5491155553333', email: 'lucas@email.com', origin: 'Google', campaign: 'SMP_Search_BA', stage: 'Presupuestado', temperature: 'Tibio', budget: 150000, notes: 'Pidió tiempo para pensarlo.' },
  { name: 'Nicolás Pérez', phone: '+5491155554444', email: null, origin: 'Referido', campaign: null, stage: 'Contactado', temperature: 'Tibio', budget: null, notes: 'Lo refirió Martín R.' },
  { name: 'Sebastián Torres', phone: '+5491155555555', email: 'seba@email.com', origin: 'Meta', campaign: 'SMP_BA_Mayo', stage: 'Nuevo', temperature: 'Frío', budget: null, notes: 'No respondió aún.' },
  { name: 'Andrés López', phone: '+5491155556666', email: null, origin: 'Meta', campaign: 'SMP_BA_Junio', stage: 'Perdido', temperature: 'Frío', budget: 150000, notes: 'Eligió otra clínica por precio.' },
  { name: 'Facundo Martínez', phone: '+5491155557777', email: 'facu@email.com', origin: 'Google', campaign: 'SMP_Search_BA', stage: 'Contactado', temperature: 'Caliente', budget: 170000, notes: 'Muy interesado, quiere ver resultados.' },
  { name: 'Pablo Sánchez', phone: '+5491155558888', email: null, origin: 'Instagram', campaign: null, stage: 'Nuevo', temperature: 'Tibio', budget: null, notes: '' },
];

const insertClient = db.prepare(`
  INSERT OR IGNORE INTO clients (id, name, phone, email, origin, campaign, stage, temperature, budget, notes, created_at)
  VALUES (@id, @name, @phone, @email, @origin, @campaign, @stage, @temperature, @budget, @notes, @created_at)
`);

const insertInteraction = db.prepare(`
  INSERT OR IGNORE INTO interactions (id, client_id, type, direction, content, created_at)
  VALUES (@id, @client_id, @type, @direction, @content, @created_at)
`);

const insertSession = db.prepare(`
  INSERT OR IGNORE INTO sessions (id, client_id, date, type, price, paid, notes)
  VALUES (@id, @client_id, @date, @type, @price, @paid, @notes)
`);

const seedAll = db.transaction(() => {
  for (const c of clients) {
    const id = uuidv4();
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    insertClient.run({ ...c, id, created_at: date.toISOString() });

    insertInteraction.run({
      id: uuidv4(),
      client_id: id,
      type: 'WhatsApp',
      direction: 'Saliente',
      content: 'Mensaje de bienvenida enviado automáticamente.',
      created_at: date.toISOString(),
    });

    if (c.stage === 'Cliente activo') {
      insertSession.run({
        id: uuidv4(),
        client_id: id,
        date: date.toISOString().split('T')[0],
        type: 'Sesión inicial',
        price: c.budget,
        paid: 1,
        notes: 'Primera sesión completada con éxito.',
      });
    }
  }
});

seedAll();
console.log('✅ Base de datos inicializada con datos de prueba.');
