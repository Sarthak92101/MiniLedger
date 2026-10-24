import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and coerces a request segment against a Zod schema.
 * The parsed (and typed) result replaces the raw value so downstream handlers
 * receive well-formed data.
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        ApiError.badRequest('Validation failed', {
          source,
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    // req.query/req.params are getters in Express 5 but assignable in 4.
    if (source === 'body') {
      req.body = result.data;
    } else {
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}
