import { Logger } from "pagopa-interop-commons";

type CacheEntry<T> = {
  data: T[];
  timestamp: number;
};

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Generic in-memory cache with TTL support.
 */
export class SimpleCache<T> {
  private cacheEntry: CacheEntry<T> | null = null;

  constructor(private logger: Logger, private cacheName: string) {}

  public get(): T[] | null {
    if (!this.cacheEntry) {
      this.logger.debug(`${this.cacheName} cache miss - no entry found`);
      return null;
    }

    const isExpired = Date.now() - this.cacheEntry.timestamp > CACHE_TTL_MS;
    if (isExpired) {
      this.logger.debug(`${this.cacheName} cache expired, removing entry`);
      // eslint-disable-next-line functional/immutable-data
      this.cacheEntry = null;
      return null;
    }

    this.logger.debug(`${this.cacheName} cache hit`);
    return this.cacheEntry.data;
  }

  public set(data: T[]): void {
    // eslint-disable-next-line functional/immutable-data
    this.cacheEntry = {
      data,
      timestamp: Date.now(),
    };

    this.logger.debug(`${this.cacheName} cached with ${data.length} items`);
  }

  /**
   * Manually clears the cache (useful for testing).
   */
  public clear(): void {
    // eslint-disable-next-line functional/immutable-data
    this.cacheEntry = null;
    this.logger.debug(`${this.cacheName} cache cleared`);
  }
}
