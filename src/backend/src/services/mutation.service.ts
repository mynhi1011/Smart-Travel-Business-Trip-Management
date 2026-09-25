import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '../prisma/client';
import { AppError, Errors } from '../middlewares/error-handler';

export type AfterCommit = (effect: () => void | Promise<void>) => void;
interface Receipt { scope: string; key?: string; payload: unknown }

function retryable(error: unknown): boolean {
  if (error instanceof AppError || !error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; meta?: { code?: string } };
  return e.code === 'P2034' || e.code === 'P1008' ||
    (e.code === 'P2028' && /Unable to start a transaction/i.test(e.message ?? '')) ||
    (e.code === 'P2010' && ['5', '6', '517'].includes(e.meta?.code ?? ''));
}

/** SQLite canonical boundary: acquire its writer before ANY business read.
 * The first UPDATE takes the database write lock on this tx connection and holds
 * it until commit/rollback. No process-local mutex, no SELECT FOR UPDATE.
 * Every retry starts a fresh transaction and discards rolled-back SSE callbacks.
 */
export async function runMutation<T>(
  work: (tx: Prisma.TransactionClient, afterCommit: AfterCommit) => Promise<T>,
  receipt?: Receipt,
  client: PrismaClient = prisma,
): Promise<T> {
  if (receipt?.key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(receipt.key)) {
    throw Errors.VALIDATION_ERROR({ fieldErrors: { idempotencyKey: ['Invalid Idempotency-Key'] } });
  }
  const fingerprint = receipt?.key
    ? createHash('sha256').update(JSON.stringify(receipt.payload, (_key, value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const object = value as Record<string, unknown>;
        return Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));
      }
      return value;
    })).digest('hex') : '';
  for (let attempt = 0; ; attempt++) {
    const effects: Array<() => void | Promise<void>> = [];
    let result: T;
    try {
      result = await client.$transaction(async tx => {
        const locked = await tx.$executeRaw`UPDATE mutation_lock SET id = id WHERE id = 1`;
        if (locked !== 1) throw new Error('Missing mutation_lock singleton; run migrations');
        if (receipt?.key) {
          const rows = await tx.$queryRaw<Array<{ fingerprint: string; result: string }>>`
            SELECT fingerprint, result FROM mutation_receipts
            WHERE scope = ${receipt.scope} AND request_key = ${receipt.key}`;
          const saved = rows[0];
          if (saved) {
            if (saved.fingerprint !== fingerprint) throw Errors.IDEMPOTENCY_CONFLICT();
            return JSON.parse(saved.result) as T;
          }
        }
        const value = await work(tx, effect => effects.push(effect));
        if (receipt?.key) {
          const serialized = JSON.stringify(value ?? null);
          await tx.$executeRaw`INSERT INTO mutation_receipts (scope, request_key, fingerprint, result)
            VALUES (${receipt.scope}, ${receipt.key}, ${fingerprint}, ${serialized})`;
        }
        return value;
      }, { maxWait: 2000, timeout: 5000 });
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt >= 2) throw Errors.CONCURRENT_MODIFICATION();
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1) + Math.random() * 25));
      continue;
    }
    // DB notifications are already durable. SSE is only a best-effort wakeup;
    // failure must never turn a committed mutation into an HTTP failure/retry.
    for (const effect of effects) {
      try { await effect(); }
      catch { console.error('Post-commit notification delivery failed; notification remains in DB'); }
    }
    return result;
  }
}

export async function assertMutableTrip(tx: Prisma.TransactionClient, tripId: string) {
  const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { status: true } });
  if (!trip) throw Errors.TRIP_NOT_FOUND();
  if (trip.status === 'CLOSED') throw Errors.TRIP_IMMUTABLE();
}
