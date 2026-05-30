/**
 * Rate Limit Store Interface
 *
 * Defines the contract for rate limit storage backends.
 * Implement this interface to support different storage mechanisms:
 * - In-memory (default, single instance)
 * - Redis (recommended for horizontal scaling)
 * - Other distributed caches
 *
 * SECURITY (D-3): This abstraction allows swapping storage backends
 * without changing rate limiting logic.
 */

export interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  consecutiveFailures: number;
}

export interface RateLimitStore {
  /**
   * Get the current rate limit entry for a key.
   * Returns null if no entry exists.
   */
  get(key: string): Promise<RateLimitEntry | null>;

  /**
   * Set or update a rate limit entry.
   * The store should handle TTL/expiration based on windowMs.
   */
  set(key: string, entry: RateLimitEntry, windowMs: number): Promise<void>;

  /**
   * Increment the count for a key atomically.
   * If the key doesn't exist, create it with count=1.
   * Returns the updated entry.
   */
  increment(key: string, windowMs: number): Promise<RateLimitEntry>;

  /**
   * Record a failure (increment consecutiveFailures).
   */
  recordFailure(key: string): Promise<void>;

  /**
   * Delete a rate limit entry (on successful auth).
   */
  delete(key: string): Promise<void>;
}

/**
 * In-Memory Rate Limit Store
 *
 * Default implementation for single-instance deployments.
 * Rate limits are lost on server restart and don't share across instances.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  async get(key: string): Promise<RateLimitEntry | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, entry: RateLimitEntry, _windowMs: number): Promise<void> {
    this.store.set(key, entry);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now - existing.firstAttempt > windowMs) {
      const entry: RateLimitEntry = {
        count: 1,
        firstAttempt: now,
        consecutiveFailures: existing?.consecutiveFailures ?? 0,
      };
      this.store.set(key, entry);
      return entry;
    }

    existing.count++;
    return existing;
  }

  async recordFailure(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.consecutiveFailures++;
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Redis Rate Limit Store
 *
 * Implementation for horizontal scaling.
 * Requires Redis connection via REDIS_URL environment variable.
 *
 * Usage:
 * ```typescript
 * import { Redis } from "ioredis";
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisRateLimitStore(redis);
 * ```
 *
 * NOTE: This is a reference implementation. Install `ioredis` package
 * and uncomment when deploying with multiple instances.
 */
export class RedisRateLimitStore implements RateLimitStore {
  // Uncomment when using Redis:
  // private redis: Redis;
  private prefix: string;

  constructor(
    // redis: Redis,
    prefix: string = "ratelimit:"
  ) {
    // this.redis = redis;
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    // Uncomment when using Redis:
    // const data = await this.redis.get(this.getKey(key));
    // if (!data) return null;
    // return JSON.parse(data) as RateLimitEntry;

    // Placeholder - throws to indicate Redis not configured
    throw new Error(
      "Redis rate limiting not configured. Set REDIS_URL and uncomment Redis implementation."
    );
  }

  async set(key: string, entry: RateLimitEntry, windowMs: number): Promise<void> {
    // Uncomment when using Redis:
    // const ttlSeconds = Math.ceil(windowMs / 1000);
    // await this.redis.setex(
    //   this.getKey(key),
    //   ttlSeconds,
    //   JSON.stringify(entry)
    // );

    throw new Error("Redis rate limiting not configured.");
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    // Uncomment when using Redis:
    // const redisKey = this.getKey(key);
    // const ttlSeconds = Math.ceil(windowMs / 1000);
    //
    // // Lua script for atomic increment with TTL
    // const script = `
    //   local key = KEYS[1]
    //   local ttl = tonumber(ARGV[1])
    //   local now = tonumber(ARGV[2])
    //
    //   local data = redis.call('GET', key)
    //   local entry
    //
    //   if data then
    //     entry = cjson.decode(data)
    //     if now - entry.firstAttempt > ttl * 1000 then
    //       -- Window expired, reset
    //       entry = {count = 1, firstAttempt = now, consecutiveFailures = entry.consecutiveFailures or 0}
    //     else
    //       entry.count = entry.count + 1
    //     end
    //   else
    //     entry = {count = 1, firstAttempt = now, consecutiveFailures = 0}
    //   end
    //
    //   redis.call('SETEX', key, ttl, cjson.encode(entry))
    //   return cjson.encode(entry)
    // `;
    //
    // const result = await this.redis.eval(script, 1, redisKey, ttlSeconds, Date.now());
    // return JSON.parse(result as string) as RateLimitEntry;

    throw new Error("Redis rate limiting not configured.");
  }

  async recordFailure(key: string): Promise<void> {
    // Uncomment when using Redis:
    // const entry = await this.get(key);
    // if (entry) {
    //   entry.consecutiveFailures++;
    //   // Keep existing TTL
    //   const ttl = await this.redis.ttl(this.getKey(key));
    //   if (ttl > 0) {
    //     await this.redis.setex(this.getKey(key), ttl, JSON.stringify(entry));
    //   }
    // }

    throw new Error("Redis rate limiting not configured.");
  }

  async delete(key: string): Promise<void> {
    // Uncomment when using Redis:
    // await this.redis.del(this.getKey(key));

    throw new Error("Redis rate limiting not configured.");
  }
}

/**
 * Factory function to create the appropriate rate limit store.
 *
 * Uses Redis if REDIS_URL is set, otherwise falls back to in-memory.
 */
export function createRateLimitStore(): RateLimitStore {
  if (process.env.REDIS_URL) {
    // Uncomment when using Redis:
    // const { Redis } = require("ioredis");
    // const redis = new Redis(process.env.REDIS_URL);
    // return new RedisRateLimitStore(redis);

    console.warn(
      "[rateLimit] REDIS_URL is set but Redis implementation is not active. " +
      "Install ioredis and uncomment Redis code in rateLimit.store.ts"
    );
  }

  return new InMemoryRateLimitStore();
}
