import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  const app = createApp(db, config.logLevel);
  let shuttingDown = false;
  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await app.close();
    } finally {
      db.close();
    }
  }
  process.once('SIGINT', () => { void shutdown().then(() => process.exit(0)).catch(() => process.exit(1)); });
  process.once('SIGTERM', () => { void shutdown().then(() => process.exit(0)).catch(() => process.exit(1)); });
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.fatal({ err: error }, 'Backend startup failed');
    await shutdown();
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  // Do not log environment values or credentials.
  console.error('Backend initialization failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
