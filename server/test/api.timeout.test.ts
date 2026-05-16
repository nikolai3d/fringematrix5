import { EventEmitter } from 'events';
import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Unit tests for the request timeout middleware added in PR #77.
// The middleware lives at the top of server.ts and:
//   1. Sets a 30-second setTimeout that sends a 503 if the request is still open.
//   2. Exposes res.locals['timedOut'] as a closure returning the flag.
//   3. Clears the timer on res 'finish' or 'close' events.
//
// Strategy: extract the middleware under test by re-implementing it as a
// standalone function (mirroring server.ts exactly) so we can unit-test it
// without spinning up the full Express app. This lets us use jest fake timers
// cleanly without the async complications of supertest + hanging routes.

// ─── Middleware under test (mirrors server.ts verbatim) ───────────────────────
const REQUEST_TIMEOUT_MS = 30_000;

function timeoutMiddleware(
  _req: unknown,
  res: {
    headersSent: boolean;
    locals: Record<string, unknown>;
    status(code: number): { json(body: unknown): void };
    on(event: string, cb: () => void): void;
  },
  next: () => void,
): void {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout' });
    }
  }, REQUEST_TIMEOUT_MS);
  res.locals['timedOut'] = () => timedOut;
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal mock res object compatible with the middleware. */
function makeMockRes() {
  const emitter = new EventEmitter();
  const statusMock = jest.fn<(code: number) => { json: jest.Mock }>().mockReturnValue({
    json: jest.fn(),
  });

  return {
    headersSent: false,
    locals: {} as Record<string, unknown>,
    status: statusMock,
    on: emitter.on.bind(emitter) as (event: string, cb: () => void) => void,
    emit: emitter.emit.bind(emitter),
    _statusMock: statusMock,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  jest.useRealTimers();
});

describe('request timeout middleware', () => {
  describe('503 after timeout elapses', () => {
    it('sends a 503 JSON response once REQUEST_TIMEOUT_MS has passed', () => {
      jest.useFakeTimers();

      const res = makeMockRes();
      const next = jest.fn();

      timeoutMiddleware({}, res, next);

      // next() must be called synchronously so the request proceeds.
      expect(next).toHaveBeenCalledTimes(1);

      // Before the timeout, no response should have been sent.
      expect(res._statusMock).not.toHaveBeenCalled();

      // Advance time to the exact threshold — the callback should now fire.
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);

      expect(res._statusMock).toHaveBeenCalledWith(503);
      const jsonMock = res._statusMock.mock.results[0]?.value?.json as jest.Mock;
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Request timeout' });
    });

    it('does NOT send a 503 if the timeout has not elapsed yet', () => {
      jest.useFakeTimers();

      const res = makeMockRes();

      timeoutMiddleware({}, res, jest.fn());

      // Advance to just before the threshold.
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1);

      expect(res._statusMock).not.toHaveBeenCalled();
    });

    it('does not send a 503 if headers were already sent when the timer fires', () => {
      jest.useFakeTimers();

      const res = makeMockRes();
      res.headersSent = true; // simulate response already completed

      timeoutMiddleware({}, res, jest.fn());

      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);

      // timedOut flag becomes true, but res.status() must NOT be called.
      expect(res._statusMock).not.toHaveBeenCalled();
      // The timedOut accessor should still return true.
      const timedOut = res.locals['timedOut'] as () => boolean;
      expect(timedOut()).toBe(true);
    });
  });

  describe('res.locals.timedOut()', () => {
    it('returns false before the timeout fires', () => {
      jest.useFakeTimers();

      const res = makeMockRes();

      timeoutMiddleware({}, res, jest.fn());

      const timedOut = res.locals['timedOut'] as () => boolean;
      expect(typeof timedOut).toBe('function');
      expect(timedOut()).toBe(false);
    });

    it('returns true after the timeout fires', () => {
      jest.useFakeTimers();

      const res = makeMockRes();
      // Prevent .status().json() from throwing when headersSent is false.
      // (The mock already returns a json stub, so this is fine as-is.)

      timeoutMiddleware({}, res, jest.fn());

      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);

      const timedOut = res.locals['timedOut'] as () => boolean;
      expect(timedOut()).toBe(true);
    });
  });

  describe('timer cleared on response completion', () => {
    it('does not fire when the response emits "finish" before the timeout', () => {
      jest.useFakeTimers();

      const res = makeMockRes();

      timeoutMiddleware({}, res, jest.fn());

      // Simulate the response completing well before the timeout.
      res.headersSent = true;
      res.emit('finish');

      // Advance past the timeout — the callback should be a no-op because
      // clearTimeout was called, but even if it runs, headersSent is true.
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS + 1);

      expect(res._statusMock).not.toHaveBeenCalled();
    });

    it('does not fire when the response emits "close" before the timeout', () => {
      jest.useFakeTimers();

      const res = makeMockRes();

      timeoutMiddleware({}, res, jest.fn());

      res.headersSent = true;
      res.emit('close');

      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS + 1);

      expect(res._statusMock).not.toHaveBeenCalled();
    });

    it('timedOut() returns false after close clears the timer', () => {
      jest.useFakeTimers();

      const res = makeMockRes();

      timeoutMiddleware({}, res, jest.fn());

      res.emit('close');

      const timedOut = res.locals['timedOut'] as () => boolean;
      // The flag starts false and the timer was cancelled, so it stays false.
      expect(timedOut()).toBe(false);

      // Confirm it stays false even after advancing past timeout.
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS + 1);
      expect(timedOut()).toBe(false);
    });

    it('timedOut() returns false after finish clears the timer', () => {
      jest.useFakeTimers();

      const res = makeMockRes();

      timeoutMiddleware({}, res, jest.fn());

      res.emit('finish');

      const timedOut = res.locals['timedOut'] as () => boolean;
      // The flag starts false and the timer was cancelled, so it stays false.
      expect(timedOut()).toBe(false);

      // Confirm it stays false even after advancing past timeout.
      jest.advanceTimersByTime(REQUEST_TIMEOUT_MS + 1);
      expect(timedOut()).toBe(false);
    });
  });
});
