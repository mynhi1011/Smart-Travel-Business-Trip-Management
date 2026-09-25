import { beforeEach, describe, expect, it, vi } from 'vitest';

const geminiMocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiMocks.generateContent };
  },
}));

const response = (draft: unknown) => ({
  text: JSON.stringify(draft),
});

const rejected = (message: string, status: number, headers?: Headers) => Object.assign(
  new Error(message), { status, headers },
);

import { generateItinerary } from '../lib/ai.client';

const input = {
  origin: 'Da Nang',
  destination: 'Ha Noi',
  days: 1,
  budget: 1_000_000,
  departureDate: '2026-10-05',
  returnDate: '2026-10-06',
  purpose: 'Customer meeting',
  preferences: 'Quiet hotel',
  hotelLimitPerNight: 1_000_000,
  perDiemPerDay: 400_000,
};

const validDraft = {
  items: [
    {
      dayNumber: 1,
      date: '2026-10-05',
      timeSlot: 'MORNING',
      location: 'Office',
      activity: 'Customer meeting',
      category: 'MEETING',
      estimatedCost: 120_000,
    },
    {
      dayNumber: 1,
      date: '2026-10-05',
      timeSlot: 'EVENING',
      location: 'Restaurant',
      activity: 'Dinner',
      category: 'MEAL',
      estimatedCost: 80_000,
    },
  ],
  totalEstimatedCost: 200_000,
};

describe('Gemini itinerary client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['GEMINI_API_KEY'] = 'test-gemini-key';
    geminiMocks.generateContent.mockResolvedValue(response(validDraft));
  });

  it('requests structured JSON and includes validated policy references in the prompt', async () => {
    const result = await generateItinerary(input);
    const request = geminiMocks.generateContent.mock.calls[0][0] as { contents: string; config: unknown };
    const prompt = request.contents;

    expect(result.totalEstimatedCost).toBe(200_000);
    expect(result.guardrailPass).toBe(true);
    expect(request).toEqual(expect.objectContaining({ model: 'gemini-3.7-flash', config: expect.objectContaining({ responseMimeType: 'application/json' }) }));
    expect(prompt).toContain('1.000.000 VNĐ/đêm');
    expect(prompt).toContain('400.000 VNĐ/ngày');
    expect(prompt).toContain('Customer meeting');
    expect(prompt).toContain('Quiet hotel');
    expect(prompt).toContain('Điểm xuất phát: Da Nang');
    expect(prompt).toContain('Ngày về của Trip Request: 2026-10-06');
    expect(prompt).toContain('Ngày cuối cửa sổ AI: 2026-10-05');
  });

  it('handles absent optional preferences without inventing a value', async () => {
    await generateItinerary({
      ...input,
      preferences: undefined,
      hotelLimitPerNight: undefined,
      perDiemPerDay: undefined,
    });
    const prompt = (geminiMocks.generateContent.mock.calls[0][0] as { contents: string }).contents;

    expect(prompt).toContain('Không có');
    expect(prompt).toContain('Không có dữ liệu hạn mức');
  });

  it('rejects malformed calendar dates and incomplete day coverage', async () => {
    geminiMocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        ...validDraft,
        items: validDraft.items.map(item => ({ ...item, date: '2026-02-30' })),
      }),
    });
    await expect(generateItinerary(input)).rejects.toMatchObject({ errorCode: 'INTERNAL_SERVER_ERROR' });

    geminiMocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        items: Array.from({ length: 4 }, (_, index) => ({
          ...validDraft.items[index % validDraft.items.length],
          dayNumber: 1,
        })),
        totalEstimatedCost: 400_000,
      }),
    });
    await expect(generateItinerary({ ...input, days: 2 })).rejects.toMatchObject({ errorCode: 'INTERNAL_SERVER_ERROR' });

    geminiMocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        ...validDraft,
        items: validDraft.items.map(item => ({ ...item, date: '2026-10-06', dayNumber: 2 })),
      }),
    });
    await expect(generateItinerary(input)).rejects.toMatchObject({ errorCode: 'INTERNAL_SERVER_ERROR' });

    geminiMocks.generateContent.mockResolvedValueOnce({
      text: 'not JSON',
    });
    await expect(generateItinerary(input)).rejects.toMatchObject({ errorCode: 'INTERNAL_SERVER_ERROR' });
  });

  it('retries over-budget results and rejects after the configured attempts', async () => {
    geminiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        items: validDraft.items.map(item => ({ ...item, estimatedCost: 600_000 })),
        totalEstimatedCost: 1_200_000,
      }),
    });

    await expect(generateItinerary(input)).rejects.toMatchObject({ errorCode: 'AI_BUDGET_GUARDRAIL_FAILED' });
    expect(geminiMocks.generateContent).toHaveBeenCalledTimes(3);
    expect(geminiMocks.generateContent.mock.calls[1][0].contents).toContain('RÀNG BUỘC CỨNG');
  });

  it('retries transient 503 responses with backoff and succeeds when Gemini recovers', async () => {
    vi.useFakeTimers();
    geminiMocks.generateContent
      .mockRejectedValueOnce(rejected('overloaded', 503))
      .mockRejectedValueOnce(rejected('overloaded', 503))
      .mockResolvedValueOnce(response(validDraft));

    try {
      const resultPromise = generateItinerary(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.totalEstimatedCost).toBe(200_000);
      expect(geminiMocks.generateContent).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns AI_PROVIDER_UNAVAILABLE after three 503 responses', async () => {
    vi.useFakeTimers();
    geminiMocks.generateContent.mockRejectedValue(
      rejected('overloaded', 503),
    );

    try {
      const resultPromise = expect(generateItinerary(input)).rejects.toMatchObject({
        statusCode: 503,
        errorCode: 'AI_PROVIDER_UNAVAILABLE',
      });
      await vi.runAllTimersAsync();
      await resultPromise;
      expect(geminiMocks.generateContent).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry non-503 provider errors', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(
      rejected('forbidden', 403),
    );

    await expect(generateItinerary(input)).rejects.toMatchObject({ errorCode: 'INTERNAL_SERVER_ERROR' });
    expect(geminiMocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it('maps provider 429 to AI_PROVIDER_RATE_LIMITED without retrying', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(
      rejected('rate limited', 429),
    );

    await expect(generateItinerary(input)).rejects.toMatchObject({
      statusCode: 429,
      errorCode: 'AI_PROVIDER_RATE_LIMITED',
    });
    expect(geminiMocks.generateContent).toHaveBeenCalledTimes(1);
  });
});
