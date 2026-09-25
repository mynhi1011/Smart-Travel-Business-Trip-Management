import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import prisma from '../prisma/client';
import { addItineraryItem, addBatchItineraryItems, getItinerary, updateItineraryItem, deleteItineraryItem } from '../services/itinerary.service';
import { AuditActions } from '../services/audit.service';
import express from 'express';
import request from 'supertest';
import { addItineraryItem as addController } from '../controllers/itinerary.controller';

const { databasePath } = vi.hoisted(() => ({ databasePath: `${process.cwd().replace(/\\/g, '/')}/fix06-${process.pid}.test.db` }));
vi.mock('../prisma/client', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { default: new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } }) };
});

const input = {
  itemDate: '2026-10-01', timeSlot: 'MORNING', location: 'Office',
  activity: 'Meeting', category: 'MEETING', estimatedCost: 120000,
};

beforeAll(async () => {
  // A real, isolated SQLite file; never touch the application's database.
  const migrations = new URL('../prisma/migrations/', import.meta.url);
  for (const dir of readdirSync(migrations, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const migration = readFileSync(new URL(`${dir.name}/migration.sql`, migrations), 'utf8');
    for (const statement of migration.split(';').filter(sql => sql.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
  await prisma.user.create({ data: {
    id: 'fix06-user', name: 'FIX-06', email: 'fix06@example.test', passwordHash: 'unused', role: 'EMPLOYEE',
  } });
  await prisma.trip.create({ data: {
    id: 'fix06-trip', tripCode: 'FIX-06', employeeId: 'fix06-user', origin: 'Ha Noi', destination: 'Da Nang',
    destinationType: 'TIER1_CITY', departureDate: new Date('2026-10-01'), returnDate: new Date('2026-10-03'),
    purpose: 'Test AI apply', estimatedBudget: 1000000,
  } });
});
beforeEach(async () => {
  await prisma.itineraryItem.deleteMany();
  await prisma.auditLog.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); unlinkSync(databasePath); });

describe('FIX-06 AI itinerary apply (real SQLite)', () => {
  it('accepts batch and existing single-item payloads on the same POST endpoint', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.assign(req, { user: { id: 'fix06-user', role: 'EMPLOYEE' } });
      next();
    });
    app.post('/trips/:id/itinerary', addController);
    const batch = await request(app).post('/trips/fix06-trip/itinerary').send({ items: [{ ...input, isAiGenerated: true }] });
    expect(batch.status).toBe(201);
    expect(batch.body.data[0].isAiGenerated).toBe(true);
    const manual = await request(app).post('/trips/fix06-trip/itinerary').send(input);
    expect(manual.status).toBe(201);
    expect(manual.body.data.isAiGenerated).toBe(false);
    expect(await prisma.auditLog.count()).toBe(1);
  });
  it('persists one AI item and the successful batch audit', async () => {
    await addBatchItineraryItems('fix06-trip', 'fix06-user', [{ ...input, isAiGenerated: true }]);
    expect((await prisma.itineraryItem.findMany()).map(item => item.isAiGenerated)).toEqual([true]);
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AuditActions.AI_ITINERARY_APPLIED);
    expect(JSON.parse(logs[0].metadata)).toEqual({ itemCount: 1, totalEstimatedCost: 120000 });
  });
  it('keeps manual additions false and preserves read/update/delete', async () => {
    const item = await addItineraryItem('fix06-trip', 'fix06-user', input);
    expect((await prisma.itineraryItem.findUniqueOrThrow({ where: { id: item.id } })).isAiGenerated).toBe(false);
    await updateItineraryItem('fix06-trip', item.id, 'fix06-user', { activity: 'Updated' });
    expect((await getItinerary('fix06-trip', 'fix06-user', 'EMPLOYEE')).items[0].activity).toBe('Updated');
    await deleteItineraryItem('fix06-trip', item.id, 'fix06-user');
    expect(await prisma.itineraryItem.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
  it('flags every AI item and counts only the actual AI batch, excluding existing/manual items', async () => {
    await addItineraryItem('fix06-trip', 'fix06-user', { ...input, estimatedCost: 999 });
    const items = await addBatchItineraryItems('fix06-trip', 'fix06-user', [
      { ...input, isAiGenerated: true },
      { ...input, estimatedCost: 80000, isAiGenerated: true },
      { ...input, estimatedCost: undefined, isAiGenerated: true },
      { ...input, estimatedCost: 500 },
    ]);
    expect(items.map(item => item.isAiGenerated)).toEqual([true, true, true, false]);
    expect(await prisma.itineraryItem.count({ where: { isAiGenerated: true } })).toBe(3);
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0].metadata)).toEqual({ itemCount: 3, totalEstimatedCost: 200000 });
  });
  it('rolls back a batch when a later item fails validation, without a success audit', async () => {
    await expect(addBatchItineraryItems('fix06-trip', 'fix06-user', [
      { ...input, isAiGenerated: true }, { ...input, itemDate: '2026-11-01', isAiGenerated: true },
    ])).rejects.toThrow();
    expect(await prisma.itineraryItem.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
  it('rolls back on a database insert failure without a success audit', async () => {
    await expect(addBatchItineraryItems('fix06-trip', 'fix06-user', [
      { ...input, isAiGenerated: true }, { ...input, estimatedCost: NaN, isAiGenerated: true },
    ])).rejects.toThrow();
    expect(await prisma.itineraryItem.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
  it('rejects empty batches and non-owners without writing items or audits', async () => {
    await expect(addBatchItineraryItems('fix06-trip', 'fix06-user', [])).rejects.toThrow();
    await expect(addBatchItineraryItems('fix06-trip', 'someone-else', [{ ...input, isAiGenerated: true }])).rejects.toThrow();
    expect(await prisma.itineraryItem.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
