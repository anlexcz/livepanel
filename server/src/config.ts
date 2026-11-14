import { resolve } from 'node:path';

export type ServerConfig = { host: string; port: number; databasePath: string; logLevel: string; devSockets: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.LIVEPANEL_HOST ?? '127.0.0.1';
  const port = Number(env.LIVEPANEL_PORT ?? '3100');
  const databasePath = resolve(env.LIVEPANEL_DB_PATH ?? './data/livepanel.sqlite');
  const logLevel = env.LIVEPANEL_LOG_LEVEL ?? 'info';
  const devSockets = env.LIVEPANEL_DEV_WS === 'true';
  if (!/^(127\.0\.0\.1|localhost|::1)$/.test(host) && env.LIVEPANEL_ALLOW_REMOTE !== 'true') {
    throw new Error('Non-loopback listening requires LIVEPANEL_ALLOW_REMOTE=true (only behind a secured proxy)');
  }
  if (devSockets && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
    throw new Error('Development WebSocket cannot be enabled on a non-loopback host');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid LIVEPANEL_PORT');
  if (!['fatal','error','warn','info','debug','trace','silent'].includes(logLevel)) throw new Error('Invalid LIVEPANEL_LOG_LEVEL');
  return { host, port, databasePath, logLevel, devSockets };
}
