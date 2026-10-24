/**
 * Global async error safety net.
 *
 * Express 4 only catches *synchronous* throws inside route handlers. An
 * `async` handler that rejects leaves the request hanging forever and
 * surfaces as an unhandled rejection, which is exactly the kind of bug that
 * turns into a mystery timeout in CI.
 *
 * We patch `Layer.prototype.handle_request` — the single choke point every
 * route handler and middleware flows through — so that a rejected promise is
 * forwarded to `next(err)` and lands in the central error handler.
 *
 * Route handlers with 4 declared parameters are Express error handlers and are
 * left untouched (they are invoked through `handle_error`, not
 * `handle_request`).
 */

type NextFn = (err?: unknown) => void;
type AnyFn = (...args: unknown[]) => unknown;

interface LayerLike {
  handle: AnyFn;
  handle_request(req: unknown, res: unknown, next: NextFn): void;
}

interface LayerCtor {
  prototype: LayerLike;
}

export function installAsyncErrorHandling(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Layer = require('express/lib/router/layer') as LayerCtor;

  const original = Layer.prototype.handle_request;

  Layer.prototype.handle_request = function patched(
    this: LayerLike,
    req: unknown,
    res: unknown,
    next: NextFn,
  ) {
    const fn = this.handle;

    // 4-arity functions are Express error handlers.
    if (fn.length > 3) {
      original.call(this, req, res, next);
      return;
    }

    let result: unknown;
    try {
      result = fn.call(this, req, res, next);
    } catch (err) {
      next(err);
      return;
    }

    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(undefined, (err) => next(err));
    }
  };
}
