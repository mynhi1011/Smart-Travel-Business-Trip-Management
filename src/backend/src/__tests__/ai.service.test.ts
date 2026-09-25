import { beforeEach, describe, expect, it, vi } from 'vitest';

const aiServiceMocks = vi.hoisted(() => ({
  findTrip: vi.fn(),
  generateItinerary: vi.fn(),
}));

vi.mock('../prisma/client', () => ({
  default: { trip: { findUnique: aiServiceMocks.findTrip } },
}));

vi.mock('../lib/ai.client', () => ({
  generateItinerary: aiServiceMocks.generateItinerary,
}));

import { generateItineraryDraft } from '../services/ai.service';

const request = {
  tripId: '11111111-1111-4111-8111-111111111111',
  destination: 'Ho Chi Minh City',
  days: 2,
  budget: 5_000_000,
  preferences: 'Keep travel between meetings short',
};

const trip = {
  employeeId: 'employee-1',
  origin: 'Da Nang',
  destination: 'Ho Chi Minh City',
  destinationType: 'TIER1_CITY',
  departureDate: new Date('2026-10-05T00:00:00.000Z'),
  returnDate: new Date('2026-10-06T00:00:00.000Z'),
  purpose: 'Customer meetings',
  status: 'DRAFT',
  employee: { jobGrade: 'STAFF' },
};

const draft = {
  items: [{
    dayNumber: 1,
    date: '2026-10-05',
    timeSlot: 'MORNING' as const,
    location: 'Customer office',
    activity: 'Customer meeting',
    category: 'MEETING' as const,
    estimatedCost: 100_000,
  }],
  totalEstimatedCost: 100_000,
  guardrailPass: true,
  retryCount: 0,
};

describe('AI itinerary service context mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiServiceMocks.findTrip.mockResolvedValue(trip);
    aiServiceMocks.generateItinerary.mockResolvedValue(draft);
  });

  it('maps saved Trip fields and server policy references with request budget/preferences', async () => {
    const result = await generateItineraryDraft('employee-1', request);

    expect(aiServiceMocks.generateItinerary).toHaveBeenCalledWith({
      origin: 'Da Nang',
      destination: 'Ho Chi Minh City',
      days: 2,
      budget: 5_000_000,
      departureDate: '2026-10-05',
      returnDate: '2026-10-06',
      purpose: 'Customer meetings',
      preferences: 'Keep travel between meetings short',
      hotelLimitPerNight: 1_000_000,
      perDiemPerDay: 400_000,
    });
    expect(result.destination).toBe(trip.destination);
    expect(result.items[0].itemDate).toBe('2026-10-05');
    expect(result.budgetCap).toBe(request.budget);
  });

  it('rejects a destination that differs from the saved Trip before calling Gemini', async () => {
    await expect(generateItineraryDraft('employee-1', {
      ...request,
      destination: 'Hanoi',
    })).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });

    expect(aiServiceMocks.generateItinerary).not.toHaveBeenCalled();
  });

  it('rejects a requested schedule longer than the saved Trip', async () => {
    await expect(generateItineraryDraft('employee-1', {
      ...request,
      days: 3,
    })).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });

    expect(aiServiceMocks.generateItinerary).not.toHaveBeenCalled();
  });

  it('rejects a non-owner and a CLOSED Trip before calling Gemini', async () => {
    await expect(generateItineraryDraft('someone-else', request))
      .rejects.toMatchObject({ errorCode: 'NOT_OWNER' });
    expect(aiServiceMocks.generateItinerary).not.toHaveBeenCalled();

    aiServiceMocks.findTrip.mockResolvedValueOnce({ ...trip, status: 'CLOSED' });
    await expect(generateItineraryDraft('employee-1', request))
      .rejects.toMatchObject({ errorCode: 'TRIP_IMMUTABLE' });
    expect(aiServiceMocks.generateItinerary).not.toHaveBeenCalled();
  });
});
