/**
 * itinerary.service.ts — Itinerary Item Service
 * API.md §7 | US-03 | BR-TR-06 (immutableGuard enforced at route level)
 */

import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';
import { HOTEL_LIMIT } from './policy.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItineraryItemInput {
  itemDate:       string;   // YYYY-MM-DD
  timeSlot:       string;   // MORNING|AFTERNOON|EVENING|ALL_DAY
  location:       string;
  activity:       string;
  category:       string;   // MEETING|ACCOMMODATION|TRANSPORT|MEAL|OTHER
  estimatedCost?: number;
  notes?:         string;
  sortOrder?:     number;
}

const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING', 'ALL_DAY'] as const;
const CATEGORIES = ['MEETING', 'ACCOMMODATION', 'TRANSPORT', 'MEAL', 'OTHER'] as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function assertOwner(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      employeeId: true,
      departureDate: true,
      returnDate: true,
      status: true,
      employee: { select: { jobGrade: true } }, // BUG-12: cần jobGrade để check hotel limit BR-TR-01
    },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();
  if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
  return trip;
}

function validateInput(data: Partial<ItineraryItemInput>) {
  if (data.timeSlot && !TIME_SLOTS.includes(data.timeSlot as typeof TIME_SLOTS[number])) {
    throw Errors.VALIDATION_ERROR({ fieldErrors: { timeSlot: ['Invalid timeSlot'] }, formErrors: [] });
  }
  if (data.category && !CATEGORIES.includes(data.category as typeof CATEGORIES[number])) {
    throw Errors.VALIDATION_ERROR({ fieldErrors: { category: ['Invalid category'] }, formErrors: [] });
  }
}

function computeTotalCost(items: { estimatedCost: number }[]) {
  return items.reduce((sum, i) => sum + i.estimatedCost, 0);
}

/**
 * checkAccommodationLimit — BR-TR-01: Kiểm tra hạn mức khách sạn theo jobGrade
 * Áp dụng khi category=ACCOMMODATION và estimatedCost > 0.
 * Chỉ cảnh báo (WARNING) — không block — nhất quán với policy.service.ts.
 */
function checkAccommodationLimit(
  category: string,
  estimatedCost: number | undefined,
  jobGrade: string
): void {
  if (category !== 'ACCOMMODATION') return;
  if (!estimatedCost || estimatedCost <= 0) return;
  const limit = HOTEL_LIMIT[jobGrade];
  if (limit !== undefined && estimatedCost > limit) {
    // Log warning — không throw (BR-TR-01 là WARNING severity trong policy.service.ts)
    // Sẽ hiển thị thông qua policyCheckResult khi submit trip
    console.warn(JSON.stringify({
      level: 'WARN',
      action: 'ACCOMMODATION_OVER_LIMIT',
      jobGrade,
      estimatedCost,
      limit,
      timestamp: new Date().toISOString(),
    }));
  }
}

// ─── getItinerary ─────────────────────────────────────────────────────────────
export async function getItinerary(tripId: string, userId: string, userRole: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { employeeId: true, employee: { select: { managerId: true } } },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();

  const canRead =
    ['TRAVEL_ADMIN', 'FINANCE', 'ADMIN'].includes(userRole) ||
    trip.employeeId === userId ||
    (userRole === 'MANAGER' && trip.employee.managerId === userId);
  if (!canRead) throw Errors.FORBIDDEN();

  const items = await prisma.itineraryItem.findMany({
    where: { tripId },
    orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
  });

  return { tripId, totalEstimatedCost: computeTotalCost(items), items };
}

// ─── addItineraryItem ─────────────────────────────────────────────────────────
export async function addItineraryItem(tripId: string, userId: string, data: ItineraryItemInput) {
  const trip = await assertOwner(tripId, userId);
  validateInput(data);

  // BUG-12: Kiểm tra hotel limit BR-TR-01 khi category=ACCOMMODATION
  checkAccommodationLimit(data.category, data.estimatedCost, trip.employee.jobGrade);

  const itemDate = new Date(data.itemDate + 'T00:00:00.000Z');
  const dep = new Date(trip.departureDate); dep.setUTCHours(0, 0, 0, 0);
  const ret = new Date(trip.returnDate);    ret.setUTCHours(0, 0, 0, 0);
  if (itemDate < dep || itemDate > ret) {
    throw Errors.VALIDATION_ERROR({ fieldErrors: { itemDate: ['itemDate must be within trip date range'] }, formErrors: [] });
  }

  // dayNumber = diff từ departureDate + 1
  const diffMs  = itemDate.getTime() - dep.getTime();
  const dayNumber = Math.round(diffMs / 86400000) + 1;

  return prisma.itineraryItem.create({
    data: {
      tripId,
      itemDate,
      dayNumber,
      timeSlot:      data.timeSlot,
      location:      data.location.trim(),
      activity:      data.activity.trim(),
      category:      data.category,
      estimatedCost: data.estimatedCost ?? 0,
      notes:         data.notes         ?? null,
      sortOrder:     data.sortOrder     ?? 0,
      isAiGenerated: false,
    },
  });
}

// ─── updateItineraryItem ──────────────────────────────────────────────────────
export async function updateItineraryItem(
  tripId: string, itemId: string, userId: string,
  data: Partial<ItineraryItemInput>
) {
  const trip = await assertOwner(tripId, userId);
  validateInput(data);

  const item = await prisma.itineraryItem.findFirst({ where: { id: itemId, tripId } });
  if (!item) throw Errors.NOT_FOUND('itinerary item');

  // BUG-12: Kiểm tra hotel limit BR-TR-01 khi update category/cost ACCOMMODATION
  const effectiveCategory = data.category ?? item.category;
  const effectiveCost     = data.estimatedCost ?? item.estimatedCost;
  checkAccommodationLimit(effectiveCategory, effectiveCost, trip.employee.jobGrade);

  // BUG-19 fix: re-compute dayNumber khi itemDate thay đổi
  let newItemDate: Date | undefined;
  let newDayNumber: number | undefined;
  if (data.itemDate !== undefined) {
    newItemDate = new Date(data.itemDate + 'T00:00:00.000Z');
    const dep = new Date(trip.departureDate); dep.setUTCHours(0, 0, 0, 0);
    const ret = new Date(trip.returnDate);    ret.setUTCHours(0, 0, 0, 0);
    if (newItemDate < dep || newItemDate > ret) {
      throw Errors.VALIDATION_ERROR({ fieldErrors: { itemDate: ['itemDate must be within trip date range'] }, formErrors: [] });
    }
    const diffMs = newItemDate.getTime() - dep.getTime();
    newDayNumber = Math.round(diffMs / 86400000) + 1;
  }

  return prisma.itineraryItem.update({
    where: { id: itemId },
    data: {
      ...(newItemDate    !== undefined && { itemDate:  newItemDate, dayNumber: newDayNumber }),
      ...(data.timeSlot      !== undefined && { timeSlot:  data.timeSlot }),
      ...(data.location      !== undefined && { location:  data.location.trim() }),
      ...(data.activity      !== undefined && { activity:  data.activity.trim() }),
      ...(data.category      !== undefined && { category:  data.category }),
      ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
      ...(data.notes         !== undefined && { notes:     data.notes }),
      ...(data.sortOrder     !== undefined && { sortOrder: data.sortOrder }),
    },
  });
}

// ─── deleteItineraryItem ──────────────────────────────────────────────────────
export async function deleteItineraryItem(tripId: string, itemId: string, userId: string) {
  await assertOwner(tripId, userId);
  const item = await prisma.itineraryItem.findFirst({ where: { id: itemId, tripId } });
  if (!item) throw Errors.NOT_FOUND('itinerary item');
  await prisma.itineraryItem.delete({ where: { id: itemId } });
}
