/**
 * API Cache Utility with 60-second TTL
 * Provides in-memory caching for API responses to reduce redundant requests
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ApiCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly ttlMs: number;

  constructor(ttlSeconds: number = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Generate a cache key from the request path and options
   */
  private generateKey(path: string, init?: RequestInit): string {
    const method = init?.method || "GET";
    const body = init?.body ? JSON.stringify(init.body) : "";
    return `${method}:${path}:${body}`;
  }

  /**
   * Check if a cached entry is still valid
   */
  private isValid(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp < this.ttlMs;
  }

  /**
   * Get cached data if it exists and is still valid
   */
  get<T>(path: string, init?: RequestInit): T | null {
    const key = this.generateKey(path, init);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in the cache
   */
  set<T>(path: string, data: T, init?: RequestInit): void {
    const key = this.generateKey(path, init);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear a specific cache entry
   */
  clear(path: string, init?: RequestInit): void {
    const key = this.generateKey(path, init);
    this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; ttlSeconds: number } {
    return {
      size: this.cache.size,
      ttlSeconds: this.ttlMs / 1000,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance with 60-second TTL
export const apiCache = new ApiCache(60);

// Cleanup expired entries every 5 minutes
if (typeof window !== "undefined") {
  setInterval(() => {
    apiCache.cleanup();
  }, 5 * 60 * 1000);
}
