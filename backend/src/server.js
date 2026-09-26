require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });

const cors = require('cors');
const express = require('express');
const database = require('./database');

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10kb' }));

function normalizeExpression(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[¿?¡!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function serializeExpression(row) {
  return {
    id: row.id,
    expression: row.expression,
    meaning: row.meaning,
    region: row.region,
    context: row.context,
    equivalent: row.equivalent,
    example: row.example,
    pronunciation: row.pronunciation,
    audioUrl: row.audio_url,
    source: 'database'
  };
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'entrejergas-api' });
});

app.post('/api/lookup', (request, response) => {
  const expression = typeof request.body?.expression === 'string'
    ? request.body.expression.trim()
    : '';

  if (!expression || expression.length > 100) {
    return response.status(400).json({
      error: 'La expresión debe tener entre 1 y 100 caracteres.'
    });
  }

  const normalized = normalizeExpression(expression);
  const entry = database.prepare(
    'SELECT * FROM expressions WHERE normalized_expression = ?'
  ).get(normalized);

  database.prepare(`
    INSERT INTO search_history (searched_expression, normalized_expression, found)
    VALUES (?, ?, ?)
  `).run(expression, normalized, entry ? 1 : 0);

  return response.json({
    found: Boolean(entry),
    entry: entry ? serializeExpression(entry) : null,
    message: entry ? undefined : 'Todavía no tenemos esta expresión en el diccionario.'
  });
});

app.get('/api/history', (_request, response) => {
  const history = database.prepare(`
    SELECT id, searched_expression AS expression, found, created_at AS createdAt
    FROM search_history
    ORDER BY id DESC
    LIMIT 30
  `).all();

  response.json({ items: history });
});

app.get('/api/dashboard', (_request, response) => {
  const expressions = database.prepare('SELECT COUNT(*) AS count FROM expressions').get().count;
  const searches = database.prepare('SELECT COUNT(*) AS count FROM search_history').get().count;
  const regions = database.prepare(`
    SELECT region, COUNT(*) AS count
    FROM expressions
    GROUP BY region
    ORDER BY count DESC, region ASC
  `).all();

  response.json({ expressions, searches, regions });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
});

app.listen(port, () => {
  console.log(`EntreJergas API escuchando en http://localhost:${port}`);
});