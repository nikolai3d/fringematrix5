import type { Request, Response, NextFunction } from 'express';

// Defense-in-depth: send a 503 if an async request handler takes longer than
// 30 seconds. This handles cases such as an upstream dependency hanging or a
// very slow network call. Note: a synchronous CPU-blocking operation (e.g. a
// ReDoS in route matching) cannot be interrupted by a setTimeout callback;
// protection against that class of attack comes from using a patched
// path-to-regexp (via Express 5), not from this middleware.
export const REQUEST_TIMEOUT_MS = 30_000;

export function timeoutMiddleware(_req: Request, res: Response, next: NextFunction): void {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout' });
    }
  }, REQUEST_TIMEOUT_MS);
  // Store the flag on res.locals so downstream handlers can skip writing
  // their response after the timeout has already fired.
  res.locals['timedOut'] = () => timedOut;
  // Clear the timer when the response completes so it doesn't fire late.
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}
