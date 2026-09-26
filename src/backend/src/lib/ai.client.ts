/**
 * ai.client.ts — Groq AI Client with server-side itinerary guardrails
 *
 * - Gọi Groq để sinh gợi ý lịch trình công tác.
 * - Dùng Structured Outputs (JSON Schema strict mode) để giảm lỗi output sai schema.
 * - Server vẫn validate lại toàn bộ output và tự tính tổng chi phí.
 * - Retry tối đa 2 lần khi output không hợp lệ hoặc vượt budget.
 * - Không tin totalEstimatedCost do model tự khai báo.
 */

import { Errors } from '../middlewares/error-handler';
import { formatCurrencyVND } from '../utils/date.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItineraryItem {
  dayNumber: number;
  date: string;
  timeSlot: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ALL_DAY';
  location: string;
  activity: string;
  category: 'MEETING' | 'ACCOMMODATION' | 'TRANSPORT' | 'MEAL' | 'OTHER';
  estimatedCost: number;
  notes?: string;
}

export interface ItineraryDraft {
  items: ItineraryItem[];
  totalEstimatedCost: number;
  guardrailPass: boolean;
  retryCount: number;
}

export interface GenerateItineraryInput {
  origin: string;
  destination: string;
  days: number;
  budget: number; // VNĐ — budget cap cho guardrail BR-TR-07
  departureDate: string;
  returnDate: string;
  purpose?: string;
  preferences?: string; // nội dung KHÔNG TIN CẬY — sanitize trước khi đưa vào prompt
  hotelLimitPerNight?: number;
  perDiemPerDay?: number;
}

type DraftFailureReason = 'MALFORMED' | 'BUDGET_EXCEEDED';

interface DraftValidation {
  ok: boolean;
  reason?: DraftFailureReason;
  detail?: string;
  items?: ItineraryItem[];
  totalEstimatedCost?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_NAME = 'openai/gpt-oss-20b';
const MAX_RETRIES = 2;
const MAX_PROVIDER_ATTEMPTS = 3;
const PROVIDER_RETRY_BASE_MS = 500;

const GROQ_TIMEOUT_MS = 4_500;
const TOTAL_DEADLINE_MS = 12_000;

const LOCATION_MAX = 300;
const ACTIVITY_MAX = 1000;
const NOTES_MAX = 2000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING', 'ALL_DAY'] as const;
const CATEGORIES = ['MEETING', 'ACCOMMODATION', 'TRANSPORT', 'MEAL', 'OTHER'] as const;

/**
 * Groq Strict Structured Outputs yêu cầu mọi field trong object đều nằm trong
 * required và object phải có additionalProperties: false.
 * notes vì vậy là required nhưng có thể null.
 */
const ITINERARY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayNumber: {
            type: 'integer',
            minimum: 1,
          },
          date: {
            type: 'string',
          },
          timeSlot: {
            type: 'string',
            enum: [...TIME_SLOTS],
          },
          location: {
            type: 'string',
          },
          activity: {
            type: 'string',
          },
          category: {
            type: 'string',
            enum: [...CATEGORIES],
          },
          estimatedCost: {
            type: 'integer',
            minimum: 0,
          },
          notes: {
            type: ['string', 'null'],
          },
        },
        required: [
          'dayNumber',
          'date',
          'timeSlot',
          'location',
          'activity',
          'category',
          'estimatedCost',
          'notes',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

// ─── Logging / environment ────────────────────────────────────────────────────

function getGroqApiKey(): string {
  const apiKey = process.env['GROQ_API_KEY']?.trim();

  if (!apiKey) {
    logEvent('ERROR', 'AI_CONFIG_MISSING', {
      variable: 'GROQ_API_KEY',
    });
    throw Errors.INTERNAL_ERROR();
  }

  return apiKey;
}

function isAiDebugEnabled(): boolean {
  return process.env['AI_DEBUG_OUTPUT'] === 'true' && process.env['NODE_ENV'] !== 'production';
}

function logEvent(
  level: 'INFO' | 'WARN' | 'ERROR',
  action: string,
  data: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    level,
    action,
    ...data,
    timestamp: new Date().toISOString(),
  });

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

/**
 * Preferences là input không tin cậy.
 * Loại bỏ ký tự điều khiển và delimiter có thể phá cấu trúc prompt.
 */
function sanitizeUserText(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/`+/g, "'")
    .replace(/"{3}/g, "''")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(
  input: GenerateItineraryInput,
  attempt = 0,
  previousReason?: DraftFailureReason,
): string {
  const origin = sanitizeUserText(input.origin);
  const destination = sanitizeUserText(input.destination);
  const purpose = sanitizeUserText(input.purpose ?? 'Công tác');
  const budgetLabel = formatCurrencyVND(input.budget);

  const departure = Date.parse(`${input.departureDate}T00:00:00.000Z`);
  const requestedEndDate = new Date(
    departure + (input.days - 1) * 86_400_000,
  ).toISOString().slice(0, 10);

  const hotelLimit = input.hotelLimitPerNight === undefined
    ? 'Không có dữ liệu hạn mức'
    : formatCurrencyVND(input.hotelLimitPerNight);

  const perDiem = input.perDiemPerDay === undefined
    ? 'Không có dữ liệu hạn mức'
    : formatCurrencyVND(input.perDiemPerDay);

  const preferences = input.preferences && input.preferences.trim().length > 0
    ? sanitizeUserText(input.preferences)
    : 'Không có';

  const dayPlan = input.days === 1
    ? `- Chuyến chỉ có 1 ngày: ưu tiên TRANSPORT ${origin} → ${destination}, hoạt động phục vụ mục đích công tác, và chuẩn bị/di chuyển về ${origin} nếu hợp lý. Không bịa giờ, booking hoặc tên dịch vụ cụ thể.`
    : `- Ngày 1 (${input.departureDate}): ưu tiên TRANSPORT ${origin} → ${destination}, sau đó ổn định/check-in và chuẩn bị công việc.
- Các ngày giữa: phân bổ MORNING, AFTERNOON, EVENING hợp lý; nội dung phải phục vụ mục đích công tác và không lặp chung chung.
- Ngày cuối (${requestedEndDate}): hoàn thành việc còn lại, check-out, sau đó ưu tiên TRANSPORT ${destination} → ${origin}; không xếp công việc sau khi đã trở về.`;

  let retryConstraint = '';

  if (attempt > 0 && previousReason === 'BUDGET_EXCEEDED') {
    const target = attempt >= 2
      ? formatCurrencyVND(Math.floor(input.budget * 0.9))
      : budgetLabel;

    retryConstraint = `
RÀNG BUỘC RETRY: Lần trước tổng chi phí vượt giới hạn. Lần này tổng estimatedCost của toàn bộ items PHẢI <= ${target}. Giảm các khoản ước tính nếu cần nhưng vẫn giữ lịch trình thực tế.`;
  } else if (attempt > 0 && previousReason === 'MALFORMED') {
    retryConstraint = `
RÀNG BUỘC RETRY: Lần trước output không vượt qua validation của server. Hãy tuân thủ tuyệt đối: đúng ngày, đúng dayNumber, mỗi ngày ít nhất 2 items, enum đúng chính tả, estimatedCost là số nguyên không âm, không tạo field ngoài schema.`;
  }

  return `Bạn là trợ lý lập kế hoạch chuyến công tác.

Nhiệm vụ DUY NHẤT: tạo bản nháp lịch trình theo từng ngày cho chuyến đi dưới đây.
Không phê duyệt, không đặt vé/khách sạn/phòng họp, không xác nhận booking, không khẳng định có dữ liệu real-time.
Chi phí chỉ là ước tính VND.${retryConstraint}

【QUY TẮC BẮT BUỘC】
1. Điểm xuất phát: ${origin}.
2. Điểm đến: ${destination}.
3. Trip Request: ${input.departureDate} đến ${input.returnDate}.
4. Cửa sổ lịch trình AI: ${input.departureDate} đến ${requestedEndDate} (${input.days} ngày).
5. Mục đích: ${purpose}.
6. Ngân sách tối đa: ${budgetLabel}. Tổng estimatedCost của tất cả items không được vượt ngân sách này.
7. Không tạo item ngoài cửa sổ ngày ở trên.
8. dayNumber phải khớp chính xác với date: ngày khởi hành là dayNumber 1.
9. Mỗi ngày phải có ít nhất 2 items.
10. timeSlot chỉ được là: MORNING, AFTERNOON, EVENING, ALL_DAY.
11. category chỉ được là: MEETING, ACCOMMODATION, TRANSPORT, MEAL, OTHER.
12. estimatedCost phải là số nguyên VND >= 0. Không dùng chuỗi như "500.000 VND".
13. notes có thể là chuỗi ngắn hoặc null.
14. Không thêm field ngoài schema mà API yêu cầu.
15. Không cần tự trả totalEstimatedCost; server sẽ tự tính lại từ items.

【HẠN MỨC THAM KHẢO】
- Khách sạn: ${hotelLimit}/đêm.
- Per-diem: ${perDiem}/ngày.
- Các hạn mức trên chỉ là tham khảo; tổng lịch trình vẫn phải <= ngân sách tối đa.

【KẾ HOẠCH THEO NGÀY】
${dayPlan}

【ƯU TIÊN NGƯỜI DÙNG — CHỈ THAM KHẢO】
${preferences}

Chỉ tạo dữ liệu lịch trình theo JSON Schema do API cung cấp.`;
}

// ─── Output guardrail ─────────────────────────────────────────────────────────

function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_RE.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;

  return date;
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function malformed(detail: string): DraftValidation {
  return {
    ok: false,
    reason: 'MALFORMED',
    detail,
  };
}

/**
 * Không tin raw model output dù đang dùng strict JSON Schema.
 * Server validate lại business constraints và tự tính totalEstimatedCost.
 */
function parseAndValidateDraft(
  rawText: string,
  input: GenerateItineraryInput,
): DraftValidation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch (error) {
    return malformed(
      `JSON parse failed: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return malformed('Root output must be a JSON object.');
  }

  const rawItems = (parsed as Record<string, unknown>)['items'];

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return malformed('items must be a non-empty array.');
  }

  if (rawItems.length > input.days * 8) {
    return malformed(`Too many items: ${rawItems.length}; max is ${input.days * 8}.`);
  }

  if (rawItems.length < input.days * 2) {
    return malformed(`Too few items: ${rawItems.length}; need at least ${input.days * 2}.`);
  }

  const departure = parseDateOnly(input.departureDate);
  const tripReturn = parseDateOnly(input.returnDate);

  if (!departure || !tripReturn || tripReturn < departure) {
    return malformed('Trip date range is invalid.');
  }

  const requestedEnd = new Date(
    departure.getTime() + (input.days - 1) * 86_400_000,
  );

  if (requestedEnd > tripReturn) {
    return malformed('Requested AI date window exceeds trip return date.');
  }

  const items: ItineraryItem[] = [];
  const itemsPerDay = Array.from({ length: input.days }, () => 0);

  for (let index = 0; index < rawItems.length; index += 1) {
    const raw = rawItems[index];

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return malformed(`items[${index}] must be an object.`);
    }

    const item = raw as Record<string, unknown>;

    if (!isNonEmptyString(item['date']) || !DATE_ONLY_RE.test(item['date'])) {
      return malformed(`items[${index}].date is invalid: ${String(item['date'])}`);
    }

    const itemDate = parseDateOnly(item['date']);

    if (
      !itemDate
      || itemDate < departure
      || itemDate > requestedEnd
      || itemDate > tripReturn
    ) {
      return malformed(`items[${index}].date is outside the allowed date window.`);
    }

    const dayOffset = Math.round(
      (itemDate.getTime() - departure.getTime()) / 86_400_000,
    );
    const dayNumber = dayOffset + 1;

    if (dayNumber < 1 || dayNumber > input.days) {
      return malformed(`items[${index}] resolves to invalid dayNumber ${dayNumber}.`);
    }

    if (!Number.isInteger(item['dayNumber']) || item['dayNumber'] !== dayNumber) {
      return malformed(
        `items[${index}].dayNumber=${String(item['dayNumber'])} does not match date; expected ${dayNumber}.`,
      );
    }

    const timeSlot = item['timeSlot'];

    if (
      typeof timeSlot !== 'string'
      || !(TIME_SLOTS as readonly string[]).includes(timeSlot)
    ) {
      return malformed(`items[${index}].timeSlot is invalid: ${String(timeSlot)}`);
    }

    const category = item['category'];

    if (
      typeof category !== 'string'
      || !(CATEGORIES as readonly string[]).includes(category)
    ) {
      return malformed(`items[${index}].category is invalid: ${String(category)}`);
    }

    if (
      !isNonEmptyString(item['location'])
      || item['location'].trim().length > LOCATION_MAX
    ) {
      return malformed(`items[${index}].location is invalid.`);
    }

    if (
      !isNonEmptyString(item['activity'])
      || item['activity'].trim().length > ACTIVITY_MAX
    ) {
      return malformed(`items[${index}].activity is invalid.`);
    }

    if (!isNonNegativeInt(item['estimatedCost'])) {
      return malformed(
        `items[${index}].estimatedCost must be a non-negative integer; received ${String(item['estimatedCost'])}.`,
      );
    }

    const notes = item['notes'];

    if (
      notes !== undefined
      && notes !== null
      && (typeof notes !== 'string' || notes.length > NOTES_MAX)
    ) {
      return malformed(`items[${index}].notes is invalid.`);
    }

    items.push({
      dayNumber,
      date: item['date'],
      timeSlot: timeSlot as ItineraryItem['timeSlot'],
      location: (item['location'] as string).trim(),
      activity: (item['activity'] as string).trim(),
      category: category as ItineraryItem['category'],
      estimatedCost: item['estimatedCost'],
      ...(typeof notes === 'string' && notes.trim().length > 0
        ? { notes: notes.trim() }
        : {}),
    });

    itemsPerDay[dayNumber - 1] += 1;
  }

  const missingDayIndex = itemsPerDay.findIndex((count) => count < 2);

  if (missingDayIndex !== -1) {
    return malformed(
      `Day ${missingDayIndex + 1} has only ${itemsPerDay[missingDayIndex]} item(s); minimum is 2.`,
    );
  }

  // Server là source of truth cho tổng chi phí.
  const totalEstimatedCost = items.reduce(
    (sum, item) => sum + item.estimatedCost,
    0,
  );

  if (!Number.isSafeInteger(totalEstimatedCost) || totalEstimatedCost < 0) {
    return malformed('Computed totalEstimatedCost is invalid.');
  }

  if (totalEstimatedCost > input.budget) {
    return {
      ok: false,
      reason: 'BUDGET_EXCEEDED',
      detail: `Computed total ${totalEstimatedCost} exceeds budget ${input.budget}.`,
    };
  }

  return {
    ok: true,
    items,
    totalEstimatedCost,
  };
}

// ─── Groq provider ─────────────────────────────────────────────────────────────

class GroqProviderUnavailableError extends Error {
  constructor() {
    super('Groq provider remained unavailable after retry attempts.');
    this.name = 'GroqProviderUnavailableError';
  }
}

class GroqProviderRateLimitedError extends Error {
  readonly retryAfterMs?: number;

  constructor(retryAfterMs?: number) {
    super('Groq rate limit was reached.');
    this.name = 'GroqProviderRateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

function getProviderStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const value = (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { statusCode?: unknown }).statusCode;
  const status = Number(value);

  return Number.isFinite(status) ? status : undefined;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const headers = (error as {
    headers?: { get?: (name: string) => string | null };
  }).headers;

  const raw = headers?.get?.('retry-after');

  if (!raw) return undefined;

  const seconds = Number(raw);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(raw);

  return Number.isNaN(date)
    ? undefined
    : Math.max(0, date - Date.now());
}

function isTransientProviderStatus(status: number | undefined): boolean {
  return status === 408
    || status === 500
    || status === 502
    || status === 503
    || status === 504;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Gọi Groq với JSON Schema strict mode.
 * deadlineAt bảo đảm provider retry không vượt quá hard deadline toàn request.
 */
async function callGroq(prompt: string, deadlineAt: number): Promise<string> {
  const apiKey = getGroqApiKey();

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();

    if (remainingMs <= 0) {
      throw new Error('GROQ_TIMEOUT');
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(1, Math.min(GROQ_TIMEOUT_MS, remainingMs));
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
              {
                role: 'system',
                content: 'You generate business-trip itinerary data. Follow the supplied JSON Schema and user constraints exactly.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'business_trip_itinerary',
                strict: true,
                schema: ITINERARY_RESPONSE_SCHEMA,
              },
            },
            temperature: 0.2,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as {
          error?: { message?: unknown };
        } | null;

        const providerMessage = typeof errorBody?.error?.message === 'string'
          ? errorBody.error.message.slice(0, 500)
          : undefined;

        throw Object.assign(new Error('GROQ_HTTP_ERROR'), {
          status: response.status,
          headers: response.headers,
          providerMessage,
        });
      }

      const payload = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };

      const text = payload.choices?.[0]?.message?.content;

      if (!text?.trim()) {
        throw new Error('AI_EMPTY_RESPONSE');
      }

      return text;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('GROQ_TIMEOUT');
      }

      const status = getProviderStatus(error);

      if (status === 429) {
        throw new GroqProviderRateLimitedError(getRetryAfterMs(error));
      }

      if (!isTransientProviderStatus(status)) {
        throw error;
      }

      if (attempt === MAX_PROVIDER_ATTEMPTS) {
        throw new GroqProviderUnavailableError();
      }

      const backoffMs = PROVIDER_RETRY_BASE_MS * (2 ** (attempt - 1));

      if (Date.now() + backoffMs >= deadlineAt) {
        throw new GroqProviderUnavailableError();
      }

      logEvent('WARN', 'AI_PROVIDER_RETRY', {
        model: MODEL_NAME,
        providerStatus: status,
        attempt,
        nextAttempt: attempt + 1,
        backoffMs,
      });

      await sleep(backoffMs);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new GroqProviderUnavailableError();
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function generateItinerary(
  input: GenerateItineraryInput,
): Promise<ItineraryDraft> {
  let lastReason: DraftFailureReason = 'MALFORMED';
  let lastDetail: string | undefined;

  const loopStartedAt = Date.now();
  const deadlineAt = loopStartedAt + TOTAL_DEADLINE_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const elapsed = Date.now() - loopStartedAt;

    if (Date.now() >= deadlineAt) {
      logEvent('WARN', 'AI_DEADLINE_EXCEEDED', {
        attempt,
        elapsedMs: elapsed,
        totalDeadlineMs: TOTAL_DEADLINE_MS,
        destination: input.destination,
      });

      throw Errors.INTERNAL_ERROR();
    }

    const startedAt = Date.now();
    let text: string;

    try {
      text = await callGroq(
        buildPrompt(
          input,
          attempt,
          attempt === 0 ? undefined : lastReason,
        ),
        deadlineAt,
      );
    } catch (error) {
      if (error instanceof GroqProviderUnavailableError) {
        logEvent('ERROR', 'AI_PROVIDER_UNAVAILABLE', {
          model: MODEL_NAME,
          providerStatus: 503,
          providerAttempts: MAX_PROVIDER_ATTEMPTS,
          destination: input.destination,
          totalElapsedMs: Date.now() - loopStartedAt,
        });

        throw Errors.AI_PROVIDER_UNAVAILABLE();
      }

      if (error instanceof GroqProviderRateLimitedError) {
        logEvent('WARN', 'AI_PROVIDER_RATE_LIMITED', {
          model: MODEL_NAME,
          providerStatus: 429,
          retryAfterMs: error.retryAfterMs,
          destination: input.destination,
          totalElapsedMs: Date.now() - loopStartedAt,
        });

        throw Errors.AI_PROVIDER_RATE_LIMITED();
      }

      const isTimeout = error instanceof Error && error.message === 'GROQ_TIMEOUT';
      const providerStatus = getProviderStatus(error) ?? null;
      const providerMessage = typeof error === 'object'
        && error !== null
        && 'providerMessage' in error
        ? String(
          (error as { providerMessage?: unknown }).providerMessage ?? '',
        ).slice(0, 500)
        : undefined;

      logEvent('ERROR', isTimeout ? 'AI_TIMEOUT' : 'AI_PROVIDER_FAILURE', {
        attempt,
        model: MODEL_NAME,
        providerStatus,
        providerErrorName: error instanceof Error ? error.name : 'UnknownError',
        providerMessage,
        destination: input.destination,
        durationMs: Date.now() - startedAt,
        totalElapsedMs: Date.now() - loopStartedAt,
      });

      throw Errors.INTERNAL_ERROR();
    }

    const validation = parseAndValidateDraft(text, input);

    if (validation.ok) {
      logEvent('INFO', 'AI_RESPONSE', {
        attempt,
        destination: input.destination,
        days: input.days,
        budget: input.budget,
        itemCount: validation.items?.length,
        totalEstimatedCost: validation.totalEstimatedCost,
        guardrailPass: true,
        durationMs: Date.now() - startedAt,
        totalElapsedMs: Date.now() - loopStartedAt,
      });

      return {
        items: validation.items ?? [],
        totalEstimatedCost: validation.totalEstimatedCost ?? 0,
        guardrailPass: true,
        retryCount: attempt,
      };
    }

    lastReason = validation.reason ?? 'MALFORMED';
    lastDetail = validation.detail;

    logEvent('WARN', 'AI_OUTPUT_REJECTED', {
      attempt,
      reason: lastReason,
      detail: lastDetail,
      destination: input.destination,
      durationMs: Date.now() - startedAt,
      totalElapsedMs: Date.now() - loopStartedAt,
    });

    if (isAiDebugEnabled()) {
      console.error('===== RAW AI RESPONSE (DEV ONLY) =====');
      console.error(text);
      console.error('======================================');
    }

    if (attempt < MAX_RETRIES && Date.now() < deadlineAt) {
      continue;
    }

    break;
  }

  if (lastReason === 'BUDGET_EXCEEDED') {
    logEvent('WARN', 'AI_GUARDRAIL_REJECT', {
      destination: input.destination,
      budget: input.budget,
      attempts: MAX_RETRIES + 1,
      detail: lastDetail,
      totalElapsedMs: Date.now() - loopStartedAt,
    });

    throw Errors.AI_BUDGET_GUARDRAIL_FAILED();
  }

  logEvent('ERROR', 'AI_OUTPUT_INVALID', {
    destination: input.destination,
    detail: lastDetail,
    attempts: MAX_RETRIES + 1,
    totalElapsedMs: Date.now() - loopStartedAt,
  });

  throw Errors.INTERNAL_ERROR();
}
