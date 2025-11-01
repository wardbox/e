import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { watch } from 'node:fs';
import { loadEndpoints, loadActions, execute, getAll, decay } from './endpoints';
import { evolveLoop } from './evolution';
import { getEvents } from './drama';

const app = new Hono();

// CORS for React dev server
app.use('*', cors());

// Dashboard
app.get('/', async (c) => {
  const file = Bun.file('src/public/dashboard.html');
  const html = await file.text();
  return c.html(html);
});

// API: Get all endpoints
app.get('/api/endpoints', (c) => {
  return c.json(getAll());
});

// API: Get drama feed
app.get('/api/drama', (c) => {
  return c.json(getEvents());
});

// Catch-all: Execute or spawn endpoint
app.all('/*', async (c) => {
  const path = c.req.path;

  // Skip API routes
  if (path.startsWith('/api/')) {
    return c.notFound();
  }

  try {
    const input = c.req.query('input') || await c.req.text() || null;
    const result = await execute(path, input);
    return c.json({ success: true, result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

const port = process.env.PORT || 3000;

// Initialize
async function init() {
  await loadEndpoints();
  await loadActions();

  // Evolution loop (every 30 seconds)
  const actions = await import('../actions/core.js');
  const actionsModule = actions.default ?? actions;
  const availableActions = Object.keys(actionsModule);

  setInterval(async () => {
    await evolveLoop(availableActions);
  }, 30000);

  // Decay loop (every 60 seconds)
  setInterval(async () => {
    await decay();
  }, 60000);

  // Watch endpoints.json for changes
  watch('data/endpoints.json', async (eventType) => {
    if (eventType === 'change') {
      console.log('📝 endpoints.json changed, reloading...');
      await loadEndpoints();
    }
  });

  console.log(`🚀 Server running on http://localhost:${port}`);
}

await init();

export default {
  port,
  fetch: app.fetch,
};
