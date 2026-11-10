import { Injectable } from '@nestjs/common';
import { tooMany } from './errors';

interface Entry { fails: number; first: number; lockedUntil: number }

/** Limitador de intentos fallidos en memoria (un solo proceso; ver README para escalar). */
@Injectable()
export class FailLimiter {
  private map = new Map<string, Entry>();

  check(key: string) {
    const e = this.map.get(key);
    if (e && e.lockedUntil > Date.now()) throw tooMany('Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.');
  }
  fail(key: string, maxFails: number, windowMs: number, lockMs: number) {
    const now = Date.now();
    let e = this.map.get(key);
    if (!e || now - e.first > windowMs) e = { fails: 0, first: now, lockedUntil: 0 };
    e.fails++;
    if (e.fails >= maxFails) { e.lockedUntil = now + lockMs; e.fails = 0; e.first = now; }
    this.map.set(key, e);
    if (this.map.size > 20000) this.gc();
  }
  success(key: string) { this.map.delete(key); }
  reset() { this.map.clear(); }
  private gc() { const now = Date.now(); for (const [k, v] of this.map) if (v.lockedUntil < now && now - v.first > 3600_000) this.map.delete(k); }
}
