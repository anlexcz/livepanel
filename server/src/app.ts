import Fastify from 'fastify';
import type Database from 'better-sqlite3';

export function createApp(db: Database.Database, logLevel = 'info') {
  const app = Fastify({
    logger: {
      level: logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    bodyLimit: 64 * 1024,
  });

  app.get('/health', async (_request, reply) => {
    try {
      db.prepare('SELECT 1').get();
      return { status: 'ok', service: 'metrobus-livepanel' };
    } catch {
      reply.code(503);
      return { status: 'unavailable', service: 'metrobus-livepanel' };
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'not_found' });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, 'HTTP request failed');
    const status = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    reply.code(status >= 400 && status < 500 ? status : 500)
      .send({ error: 'request_failed' });
  });
  return app;
}
