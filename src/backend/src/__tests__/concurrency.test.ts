import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const harness = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const { PrismaClient } = await import('@prisma/client');
  const databasePath = `${process.cwd().replace(/\\/g, '/')}/fix08-${process.pid}.test.db`;
  const clients = [0, 1].map(() => new PrismaClient({
    datasources: { db: { url: `file:${databasePath}?connection_limit=1&socket_timeout=1` } },
  }));
  return { clients, databasePath, context: new AsyncLocalStorage<number>() };
});

// Only select the connection for each request; every database operation is real.
vi.mock('../prisma/client', () => ({ default: new Proxy(harness.clients[0], {
  get(_target, name) {
    const client = harness.clients[harness.context.getStore() ?? 0];
    const value = Reflect.get(client, name);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) }));

import tripsRouter from '../routes/trips.routes';
import expenseRouter from '../routes/expense.routes';
import itineraryRouter from '../routes/itinerary.routes';
import { errorHandler } from '../middlewares/error-handler';
import { runMutation } from '../services/mutation.service';
import * as sseEmitter from '../lib/sse-emitter';

const db = harness.clients[0];
const apps = harness.clients.map((_client, index) => {
  const app = express();
  app.use(express.json());
  app.use((_req, _res, next) => harness.context.run(index, next));
  app.use('/trips', tripsRouter, expenseRouter, itineraryRouter);
  app.use(errorHandler);
  return app;
});
function post(index: number, path: string, role = 'MANAGER', body: unknown = {}) {
  const user = role === 'EMPLOYEE' ? 'employee' : role === 'FINANCE' ? 'finance' : role === 'TRAVEL_ADMIN' ? 'admin' : 'manager';
  const token = jwt.sign({ sub: user, role, name: user }, process.env.JWT_ACCESS_SECRET!);
  return request(apps[index]).post(`/trips/${path}`).set('Authorization', `Bearer ${token}`).send(body);
}
const employeeToken = () => jwt.sign({ sub: 'employee', role: 'EMPLOYEE', name: 'Employee' }, process.env.JWT_ACCESS_SECRET!);
const expenseItem = { expenseDate: '2099-10-01', category: 'MEAL', amount: 100, description: 'Lunch' };
const aiItem = { itemDate: '2099-10-01', timeSlot: 'MORNING', category: 'MEETING', location: 'Office', activity: 'Meeting', estimatedCost: 100, isAiGenerated: true };

async function trip(status = 'SUBMITTED', id = 'trip') {
  return db.trip.create({ data: {
    id, tripCode: id, employeeId: 'employee', origin: 'Origin', destination: 'Destination',
    destinationType: 'OTHER', departureDate: new Date('2099-10-01'), returnDate: new Date('2099-10-03'),
    purpose: 'Concurrency verification', estimatedBudget: 1000000, status,
  } });
}
async function expense(status = 'SUBMITTED', tripStatus = 'EXPENSE_SUBMITTED') {
  await trip(tripStatus);
  return db.expense.create({ data: {
    id: 'expense', tripId: 'trip', status, estimatedBudgetSnapshot: 1000000, totalActual: 100,
    justification: 'Business reason', items: { create: { ...expenseItem, expenseDate: new Date(expenseItem.expenseDate) } },
  } });
}
function oneWinner(responses: Array<{ status: number; body: { error?: string } }>) {
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  expect(responses.find(r => r.status === 409)?.body.error).toMatch(/INVALID_STATUS_TRANSITION|TRIP_IMMUTABLE|CONCURRENT_MODIFICATION/);
}

beforeAll(async () => {
  const migrations = new URL('../prisma/migrations/', import.meta.url);
  for (const entry of readdirSync(migrations, { withFileTypes: true }).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    for (const sql of readFileSync(new URL(`${entry.name}/migration.sql`, migrations), 'utf8').split(';').filter(s => s.trim())) {
      await db.$executeRawUnsafe(sql);
    }
  }
  for (const [id, role] of [['manager', 'MANAGER'], ['finance', 'FINANCE'], ['admin', 'TRAVEL_ADMIN'], ['employee', 'EMPLOYEE']]) {
    await db.user.create({ data: { id, name: id, email: `${id}@fix08.test`, role, passwordHash: 'unused', ...(id === 'employee' && { managerId: 'manager' }) } });
  }
}, 20000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_expense_write');
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_audit_write');
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fail_notification_write');
  await db.$executeRawUnsafe('DELETE FROM mutation_receipts');
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.approvalRecord.deleteMany();
  await db.expenseItem.deleteMany();
  await db.expense.deleteMany();
  await db.itineraryItem.deleteMany();
  await db.policyCheckResult.deleteMany();
  await db.trip.deleteMany();
});
afterAll(async () => {
  await Promise.all(harness.clients.map(client => client.$disconnect()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    if (existsSync(harness.databasePath + suffix)) unlinkSync(harness.databasePath + suffix);
  }
});

describe('FIX-08: HTTP mutations over independent SQLite connections', () => {
  it.each(['approve', 'reject'])('two manager decisions: approve versus %s', async action => {
    await trip();
    oneWinner(await Promise.all([post(0, 'trip/approve'), post(1, `trip/${action}`, 'MANAGER', { comment: 'Decision' })]));
    expect(await db.approvalRecord.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(1);
    expect(await db.notification.count()).toBe(1);
  });
  it('two level-2 approvals create one record', async () => {
    await trip('PENDING_ADMIN_APPROVAL');
    oneWinner(await Promise.all([post(0, 'trip/approve', 'TRAVEL_ADMIN'), post(1, 'trip/approve', 'TRAVEL_ADMIN')]));
    expect(await db.approvalRecord.count()).toBe(1);
  });
  it('update racing submit never resets an already submitted policy snapshot', async () => {
    await trip('DRAFT');
    const responses = await Promise.all([
      request(apps[0]).patch('/trips/trip').set('Authorization', `Bearer ${employeeToken()}`).send({ estimatedBudget: 2000000 }),
      post(1, 'trip/submit', 'EMPLOYEE'),
    ]);
    expect(responses[1].status).toBe(200);
    expect([200, 409]).toContain(responses[0].status);
    const saved = await db.trip.findUniqueOrThrow({ where: { id: 'trip' }, include: { policyCheckResult: true } });
    expect(saved.status).toBe('SUBMITTED');
    expect(saved.approvalReasons).not.toBeNull();
    expect(saved.policyCheckResult).not.toBeNull();
  });
  it('delete racing submit cannot delete a committed submitted trip', async () => {
    await trip('DRAFT');
    const responses = await Promise.all([
      request(apps[0]).delete('/trips/trip').set('Authorization', `Bearer ${employeeToken()}`),
      post(1, 'trip/submit', 'EMPLOYEE'),
    ]);
    if (responses[0].status === 204) {
      expect(responses[1].status).toBe(404);
      expect(await db.auditLog.count()).toBe(0);
    } else {
      expect(responses.map(r => r.status)).toEqual([409, 200]);
      expect(await db.trip.count()).toBe(1);
    }
  });
  it('double close closes both records once', async () => {
    await expense('APPROVED', 'EXPENSE_APPROVED');
    oneWinner(await Promise.all([post(0, 'trip/close', 'FINANCE'), post(1, 'trip/close', 'FINANCE')]));
    expect((await db.expense.findUniqueOrThrow({ where: { id: 'expense' } })).status).toBe('CLOSED');
    expect(await db.auditLog.count()).toBe(1);
  });
  it('concurrent expense inserts preserve the sum and intentional identical items', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    const responses = await Promise.all([post(0, 'trip/expense/items', 'EMPLOYEE', expenseItem), post(1, 'trip/expense/items', 'EMPLOYEE', expenseItem)]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(await db.expenseItem.count()).toBe(3);
    expect((await db.expense.findUniqueOrThrow({ where: { id: 'expense' } })).totalActual).toBe(300);
  });
  it('expense item racing submit leaves an internally consistent variance snapshot', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    const responses = await Promise.all([post(0, 'trip/expense/items', 'EMPLOYEE', { ...expenseItem, amount: 1100000 }), post(1, 'trip/expense/submit', 'EMPLOYEE')]);
    expect(responses[1].status).toBe(200);
    expect([201, 409]).toContain(responses[0].status);
    const saved = await db.expense.findUniqueOrThrow({ where: { id: 'expense' }, include: { items: true } });
    expect(saved.totalActual).toBe(saved.items.reduce((sum, item) => sum + item.amount, 0));
    expect(saved.varianceAmount).toBe(saved.totalActual - saved.estimatedBudgetSnapshot);
    expect(saved.managerReapprovalRequired).toBe(saved.totalActual * 100 > saved.estimatedBudgetSnapshot * 110);
  });
  it.each(['approve', 'reject'])('expense approve racing %s has one winner', async action => {
    await expense();
    oneWinner(await Promise.all([post(0, 'trip/expense/approve', 'FINANCE'), post(1, `trip/expense/${action}`, 'FINANCE', { comment: 'Decision' })]));
    expect(await db.auditLog.count()).toBe(1);
    const saved = await db.expense.findUniqueOrThrow({ where: { id: 'expense' }, include: { trip: true } });
    expect(saved.trip.status).toBe(`EXPENSE_${saved.status}`);
  });
  it('Manager reapprove rolls back trip and audit when the expense write fails', async () => {
    await expense('SUBMITTED', 'MANAGER_REAPPROVE');
    await db.expense.update({ where: { id: 'expense' }, data: { managerReapprovalRequired: true } });
    await db.$executeRawUnsafe("CREATE TRIGGER fail_expense_write BEFORE UPDATE ON expenses BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/expense/reapprove', 'MANAGER', { action: 'APPROVED' })).status).toBe(500);
    expect((await db.trip.findUniqueOrThrow({ where: { id: 'trip' } })).status).toBe('MANAGER_REAPPROVE');
    expect(await db.auditLog.count()).toBe(0);
  });
  it('close racing itinerary mutation permits only writes serialized before close', async () => {
    await expense('APPROVED', 'EXPENSE_APPROVED');
    const results = await Promise.all([post(0, 'trip/itinerary', 'EMPLOYEE', { items: [aiItem] }), post(1, 'trip/close', 'FINANCE')]);
    expect(results[1].status).toBe(200);
    expect([201, 409]).toContain(results[0].status);
    const count = await db.itineraryItem.count();
    expect((await post(0, 'trip/itinerary', 'EMPLOYEE', { items: [aiItem] })).status).toBe(409);
    expect(await db.itineraryItem.count()).toBe(count);
  });
  it('concurrent create expense is unique with a business conflict', async () => {
    await trip('ONGOING');
    const results = await Promise.all([post(0, 'trip/expense', 'EMPLOYEE'), post(1, 'trip/expense', 'EMPLOYEE')]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await db.expense.count()).toBe(1);
    expect((await db.trip.findUniqueOrThrow({ where: { id: 'trip' } })).status).toBe('EXPENSE_DRAFT');
  });
  it('concurrent trip creation allocates unique codes, including after deletion', async () => {
    const input = { origin: 'Origin', destination: 'Destination', departureDate: '2099-10-01', returnDate: '2099-10-03', purpose: 'Business meeting', estimatedBudget: 1000000 };
    const results = await Promise.all([post(0, '', 'EMPLOYEE', input), post(1, '', 'EMPLOYEE', input)]);
    expect(results.map(r => r.status)).toEqual([201, 201]);
    expect(new Set(results.map(r => r.body.data.tripCode)).size).toBe(2);
    const oldCode = results[1].body.data.tripCode;
    await db.trip.delete({ where: { id: results[1].body.data.id } });
    const next = await post(0, '', 'EMPLOYEE', input);
    expect(next.status).toBe(201);
    expect(next.body.data.tripCode).not.toBe(oldCode);
  });
  it('audit insertion failure rolls back approval record and trip', async () => {
    await trip();
    await db.$executeRawUnsafe("CREATE TRIGGER fail_audit_write BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/approve')).status).toBe(500);
    expect(await db.approvalRecord.count()).toBe(0);
    expect((await db.trip.findUniqueOrThrow({ where: { id: 'trip' } })).status).toBe('SUBMITTED');
  });
  it('notification persistence failure rolls back; SSE failure after commit does not fail HTTP', async () => {
    await trip();
    await db.$executeRawUnsafe("CREATE TRIGGER fail_notification_write BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/approve')).status).toBe(500);
    expect(await db.auditLog.count()).toBe(0);
    expect(await db.approvalRecord.count()).toBe(0);
    await db.$executeRawUnsafe('DROP TRIGGER fail_notification_write');
    vi.spyOn(sseEmitter, 'emit').mockImplementation(() => { throw new Error('disconnected'); });
    expect((await post(0, 'trip/approve')).status).toBe(200);
    expect(await db.notification.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(1);
  });
  it('AI Apply retries with one key replay one batch/audit; new key is a new intent', async () => {
    await trip('DRAFT');
    const body = { items: [aiItem, { ...aiItem, estimatedCost: 200 }] };
    const responses = await Promise.all([post(0, 'trip/itinerary', 'EMPLOYEE', body).set('Idempotency-Key', 'same-intent'), post(1, 'trip/itinerary', 'EMPLOYEE', body).set('Idempotency-Key', 'same-intent')]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(await db.itineraryItem.count({ where: { isAiGenerated: true } })).toBe(2);
    expect(await db.auditLog.count()).toBe(1);
    expect(JSON.parse((await db.auditLog.findFirstOrThrow()).metadata)).toEqual({ itemCount: 2, totalEstimatedCost: 300 });
    expect((await post(0, 'trip/itinerary', 'EMPLOYEE', { items: [aiItem] }).set('Idempotency-Key', 'same-intent')).body.error).toBe('IDEMPOTENCY_CONFLICT');
    expect((await post(0, 'trip/itinerary', 'EMPLOYEE', body).set('Idempotency-Key', 'new-intent')).status).toBe(201);
    expect(await db.itineraryItem.count()).toBe(4);
  });
  it('acquires the writer before reads and rechecks state after contention', async () => {
    await trip();
    let release!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>(resolve => { locked = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const holder = db.$transaction(async tx => {
      await tx.$executeRaw`UPDATE mutation_lock SET id = id WHERE id = 1`;
      locked();
      await gate;
      await tx.trip.update({ where: { id: 'trip' }, data: { status: 'REJECTED' } });
    });
    await acquired;
    const pending = post(1, 'trip/approve').then(response => response);
    await new Promise(resolve => setTimeout(resolve, 100));
    release();
    await holder;
    expect((await pending).status).toBe(409);
    expect(await db.approvalRecord.count()).toBe(0);
  });
  it('retries the full transaction without duplicate durable or external effects', async () => {
    await trip();
    let attempts = 0;
    let delivered = 0;
    await runMutation(async (tx, afterCommit) => {
      await tx.auditLog.create({ data: { userId: 'manager', entityType: 'TRIP', entityId: 'trip', action: 'TEST_RETRY' } });
      afterCommit(() => { delivered++; });
      if (++attempts === 1) throw Object.assign(new Error('injected serialization conflict'), { code: 'P2034' });
    });
    expect(attempts).toBe(2);
    expect(await db.auditLog.count()).toBe(1);
    expect(delivered).toBe(1);
  });
  it('lock exhaustion on an independent connection returns 409 and never runs the mutation', async () => {
    let release!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>(resolve => { locked = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const holder = db.$transaction(async tx => {
      await tx.$executeRaw`UPDATE mutation_lock SET id = id WHERE id = 1`;
      locked();
      await gate;
    }, { timeout: 12000 });
    await acquired;
    const work = vi.fn();
    try {
      await expect(runMutation(work, undefined, harness.clients[1])).rejects.toMatchObject({ statusCode: 409, errorCode: 'CONCURRENT_MODIFICATION' });
      expect(work).not.toHaveBeenCalled();
    } finally {
      release();
      await holder;
    }
  });
  it('expense item update versus delete keeps the header sum exact', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    const second = await db.expenseItem.create({ data: { expenseId: 'expense', ...expenseItem, expenseDate: new Date(expenseItem.expenseDate) } });
    await db.expense.update({ where: { id: 'expense' }, data: { totalActual: 200 } });
    const first = await db.expenseItem.findFirstOrThrow({ where: { id: { not: second.id } } });
    const auth = `Bearer ${employeeToken()}`;
    const results = await Promise.all([
      request(apps[0]).patch(`/trips/trip/expense/items/${first.id}`).set('Authorization', auth).send({ amount: 350 }),
      request(apps[1]).delete(`/trips/trip/expense/items/${second.id}`).set('Authorization', auth),
    ]);
    expect(results.map(r => r.status)).toEqual([200, 204]);
    expect((await db.expense.findUniqueOrThrow({ where: { id: 'expense' } })).totalActual).toBe(350);
  });
  it('expense creation rolls back if switching the trip status fails', async () => {
    await trip('ONGOING');
    await db.$executeRawUnsafe("CREATE TRIGGER fail_expense_write BEFORE UPDATE ON trips BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/expense', 'EMPLOYEE')).status).toBe(500);
    expect(await db.expense.count()).toBe(0);
    expect((await db.trip.findUniqueOrThrow({ where: { id: 'trip' } })).status).toBe('ONGOING');
  });
  it('expense item insertion rolls back if recalculating total fails', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    await db.$executeRawUnsafe("CREATE TRIGGER fail_expense_write BEFORE UPDATE ON expenses BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/expense/items', 'EMPLOYEE', expenseItem)).status).toBe(500);
    expect(await db.expenseItem.count()).toBe(1);
    expect((await db.expense.findUniqueOrThrow({ where: { id: 'expense' } })).totalActual).toBe(100);
  });
  it('close rolls back trip if the expense write fails, preserving the real error', async () => {
    await expense('APPROVED', 'EXPENSE_APPROVED');
    await db.$executeRawUnsafe("CREATE TRIGGER fail_expense_write BEFORE UPDATE ON expenses BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/close', 'FINANCE')).status).toBe(500);
    expect((await db.trip.findUniqueOrThrow({ where: { id: 'trip' } })).status).toBe('EXPENSE_APPROVED');
    expect(await db.auditLog.count()).toBe(0);
  });
  it.each([['APPROVED', 'start'], ['ONGOING', 'end']])('double %s -> %s has one winner', async (status, action) => {
    await trip(status);
    oneWinner(await Promise.all([post(0, `trip/${action}`, 'EMPLOYEE'), post(1, `trip/${action}`, 'EMPLOYEE')]));
    expect(await db.auditLog.count()).toBe(1);
  });
  it('explicit request identity deduplicates expense items and trip creation', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    const items = await Promise.all([post(0, 'trip/expense/items', 'EMPLOYEE', expenseItem).set('Idempotency-Key', 'item-key'), post(1, 'trip/expense/items', 'EMPLOYEE', expenseItem).set('Idempotency-Key', 'item-key')]);
    expect(items.map(r => r.status)).toEqual([201, 201]);
    expect(items[0].body).toEqual(items[1].body);
    expect(await db.expenseItem.count()).toBe(2);
    const input = { origin: 'Origin', destination: 'Destination', departureDate: '2099-10-01', returnDate: '2099-10-03', purpose: 'Business meeting', estimatedBudget: 1000000 };
    const trips = await Promise.all([post(0, '', 'EMPLOYEE', input).set('Idempotency-Key', 'trip-key'), post(1, '', 'EMPLOYEE', input).set('Idempotency-Key', 'trip-key')]);
    expect(trips.map(r => r.status)).toEqual([201, 201]);
    expect(trips[0].body).toEqual(trips[1].body);
    expect(await db.auditLog.count()).toBe(1);
  });
  it('Manager reapprove replay does not duplicate its audit', async () => {
    await expense('SUBMITTED', 'MANAGER_REAPPROVE');
    await db.expense.update({ where: { id: 'expense' }, data: { managerReapprovalRequired: true } });
    const results = await Promise.all([post(0, 'trip/expense/reapprove', 'MANAGER', { action: 'APPROVED' }).set('Idempotency-Key', 'manager-key'), post(1, 'trip/expense/reapprove', 'MANAGER', { action: 'APPROVED' }).set('Idempotency-Key', 'manager-key')]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(await db.auditLog.count()).toBe(1);
    expect((await db.trip.findUniqueOrThrow({ where: { id: 'trip' } })).status).toBe('EXPENSE_SUBMITTED');
  });
  it('submit rebuilds a legacy stale total from the protected item snapshot', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    await db.expense.update({ where: { id: 'expense' }, data: { totalActual: 2000000 } });
    expect((await post(0, 'trip/expense/submit', 'EMPLOYEE')).status).toBe(200);
    const saved = await db.expense.findUniqueOrThrow({ where: { id: 'expense' } });
    expect(saved.totalActual).toBe(100);
    expect(saved.varianceAmount).toBe(-999900);
    expect(saved.managerReapprovalRequired).toBe(false);
  });
  it('justification racing submit cannot be changed after a successful submit', async () => {
    await expense('DRAFT', 'EXPENSE_DRAFT');
    const results = await Promise.all([
      request(apps[0]).patch('/trips/trip/expense').set('Authorization', `Bearer ${employeeToken()}`).send({ justification: 'Updated reason' }),
      post(1, 'trip/expense/submit', 'EMPLOYEE'),
    ]);
    expect(results[1].status).toBe(200);
    expect([200, 409]).toContain(results[0].status);
    const saved = await db.expense.findUniqueOrThrow({ where: { id: 'expense' } });
    const later = await request(apps[0]).patch('/trips/trip/expense').set('Authorization', `Bearer ${employeeToken()}`).send({ justification: 'Too late' });
    expect(later.status).toBe(409);
    expect((await db.expense.findUniqueOrThrow({ where: { id: 'expense' } })).justification).toBe(saved.justification);
  });
  it('failed AI transaction leaves no receipt, so the same key can be retried', async () => {
    await trip('DRAFT');
    await db.$executeRawUnsafe("CREATE TRIGGER fail_audit_write BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    expect((await post(0, 'trip/itinerary', 'EMPLOYEE', { items: [aiItem] }).set('Idempotency-Key', 'retryable-intent')).status).toBe(500);
    expect(await db.itineraryItem.count()).toBe(0);
    expect(await db.$queryRaw`SELECT * FROM mutation_receipts`).toEqual([]);
    await db.$executeRawUnsafe('DROP TRIGGER fail_audit_write');
    expect((await post(1, 'trip/itinerary', 'EMPLOYEE', { items: [aiItem] }).set('Idempotency-Key', 'retryable-intent')).status).toBe(201);
    expect(await db.itineraryItem.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(1);
  });
});
