interface RateLimitOptions {
  interval: number; // in milliseconds, e.g. 60000 for 1 minute
  uniqueTokenPerInterval?: number; // max active tokens tracked
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new Map<string, number[]>();
  const interval = options.interval || 60000;
  const maxTokens = options.uniqueTokenPerInterval || 5000;

  return {
    check: async (key: string, limit: number): Promise<RateLimitResult> => {
      const now = Date.now();
      const windowStart = now - interval;

      let timestamps = tokenCache.get(key) || [];
      // Filter out timestamps older than current window
      timestamps = timestamps.filter((t) => t > windowStart);

      if (tokenCache.size > maxTokens) {
        // Prune oldest keys to prevent memory leaks in long-running processes
        const entries = Array.from(tokenCache.entries());
        for (let i = 0; i < Math.floor(maxTokens * 0.2); i++) {
          if (entries[i]) tokenCache.delete(entries[i][0]);
        }
      }

      const isAllowed = timestamps.length < limit;

      if (isAllowed) {
        timestamps.push(now);
        tokenCache.set(key, timestamps);
      }

      const remaining = Math.max(0, limit - timestamps.length);
      const oldestTimestamp = timestamps[0] || now;
      const reset = Math.ceil((oldestTimestamp + interval - now) / 1000);

      return {
        success: isAllowed,
        limit,
        remaining,
        reset: Math.max(1, reset),
      };
    },
  };
}

// Pre-configured limiters for critical application paths
export const authLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 2000 }); // 10 attempts / min
export const trackingLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 10000 }); // 120 requests / min
export const webhookLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 5000 }); // 300 requests / min