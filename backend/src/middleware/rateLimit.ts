import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { ApiError } from '../lib/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Small in-process limiter for the mock login endpoints. */
export function rateLimitByIp(key: string, max: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (config.isTest) {
      next();
      return;
    }

    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = `${key}:${ip}`;
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.'));
      return;
    }

    // Bound memory when the server is exposed to many distinct client IPs.
    if (buckets.size > 10_000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }

    next();
  };
}
