import type { RequestHandler } from "express";

// Fixed-window per-IP limiter, in memory.
// ponytail: single instance only; use a shared store if the backend is ever scaled out.
export function rateLimit(max: number, windowMs = 60_000, now: () => number = Date.now): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const t = now();
    if (hits.size > 1000) for (const [k, h] of hits) if (h.resetAt <= t) hits.delete(k); // keep the map bounded
    const key = req.ip ?? "unknown";
    let hit = hits.get(key);
    if (!hit || hit.resetAt <= t) hits.set(key, (hit = { count: 0, resetAt: t + windowMs }));
    if (++hit.count > max) {
      res.set("Retry-After", String(Math.ceil((hit.resetAt - t) / 1000)));
      return void res.status(429).json({ message: "Too many requests. Please wait a moment and try again." });
    }
    next();
  };
}
