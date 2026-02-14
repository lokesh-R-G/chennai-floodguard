import Redis from 'ioredis';
import logger from './logger.js';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error('Redis: max retries reached, giving up');
      return null;
    }
    return Math.min(times * 200, 5000);
  },
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let cacheClient: Redis | null = null;

export function getPubClient(): Redis {
  if (!pubClient) {
    pubClient = new Redis(redisConfig);
    pubClient.on('connect', () => logger.info('Redis pub client connected'));
    pubClient.on('error', (err) => logger.error('Redis pub error:', err.message));
  }
  return pubClient;
}

export function getSubClient(): Redis {
  if (!subClient) {
    subClient = new Redis(redisConfig);
    subClient.on('connect', () => logger.info('Redis sub client connected'));
    subClient.on('error', (err) => logger.error('Redis sub error:', err.message));
  }
  return subClient;
}

export function getCacheClient(): Redis {
  if (!cacheClient) {
    cacheClient = new Redis(redisConfig);
    cacheClient.on('connect', () => logger.info('Redis cache client connected'));
    cacheClient.on('error', (err) => logger.error('Redis cache error:', err.message));
  }
  return cacheClient;
}

/**
 * Cache wrapper – get / set with TTL.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getCacheClient();
  const raw = await client.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getCacheClient();
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getCacheClient();
  await client.del(key);
}

/**
 * Health check for Redis connectivity.
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const client = getCacheClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Gracefully close all Redis connections.
 */
export async function closeRedisConnections(): Promise<void> {
  const clients = [pubClient, subClient, cacheClient].filter(Boolean) as Redis[];
  await Promise.all(clients.map((c) => c.quit().catch(() => c.disconnect())));
  pubClient = null;
  subClient = null;
  cacheClient = null;
  logger.info('All Redis connections closed');
}

export { redisConfig };
export default getCacheClient;
