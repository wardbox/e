import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Endpoint Evolution is alive',
  });
});

const port = process.env.PORT || 3000;

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
