/**
 * types.ts — Shared TypeScript Types & Enums
 *
 * Định nghĩa các enum types bám đúng data-model.md §4.
 * Dùng ở cả Service layer và Controller layer.
 *
 * Lưu ý: SQLite không hỗ trợ native enum → các giá trị này là string constants
 * được validate ở Service layer (Prisma lưu dưới dạng String trong DB).
 */

// ─── User Types ───────────────────────────────────────────────────────────────

export const UserRole = {
  EMPLOYEE:     'EMPLOYEE',
  MANAGER:      'MANAGER',
  TRAVEL_ADMIN: 'TRAVEL_ADMIN',
  FINANCE:      'FINANCE',
  ADMIN:        'ADMIN',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const JobGrade = {
  STAFF:         'STAFF',
  MANAGER_GRADE: 'MANAGER_GRADE',
  DIRECTOR:      'DIRECTOR',
} as const;
export type JobGrade = typeof JobGrade[keyof typeof JobGrade];

// ─── Trip Types ───────────────────────────────────────────────────────────────

export const DestinationType = {
  TIER1_CITY: 'TIER1_CITY',
  OTHER:      'OTHER',
} as const;
export type DestinationType = typeof DestinationType[keyof typeof DestinationType];

export const TripStatus = {
  DRAFT:                  'DRAFT',
  SUBMITTED:              'SUBMITTED',
  MANAGER_REVIEWING:      'MANAGER_REVIEWING',
  PENDING_ADMIN_APPROVAL: 'PENDING_ADMIN_APPROVAL',
  APPROVED:               'APPROVED',
  ONGOING:                'ONGOING',
  EXPENSE_DRAFT:          'EXPENSE_DRAFT',
  EXPENSE_SUBMITTED:      'EXPENSE_SUBMITTED',
  EXPENSE_APPROVED:       'EXPENSE_APPROVED',
  EXPENSE_REJECTED:       'EXPENSE_REJECTED',
  MANAGER_REAPPROVE:      'MANAGER_REAPPROVE',
  CLOSED:                 'CLOSED',
  REJECTED:               'REJECTED',
} as const;
export type TripStatus = typeof TripStatus[keyof typeof TripStatus];

// ─── Itinerary Types ──────────────────────────────────────────────────────────

export const TimeSlot = {
  MORNING:   'MORNING',
  AFTERNOON: 'AFTERNOON',
  EVENING:   'EVENING',
  ALL_DAY:   'ALL_DAY',
} as const;
export type TimeSlot = typeof TimeSlot[keyof typeof TimeSlot];

export const ItineraryCategory = {
  MEETING:       'MEETING',
  ACCOMMODATION: 'ACCOMMODATION',
  TRANSPORT:     'TRANSPORT',
  MEAL:          'MEAL',
  OTHER:         'OTHER',
} as const;
export type ItineraryCategory = typeof ItineraryCategory[keyof typeof ItineraryCategory];

// ─── Approval Types ───────────────────────────────────────────────────────────

export const ApprovalLevel = {
  LEVEL_1:           'LEVEL_1',
  LEVEL_2:           'LEVEL_2',
  MANAGER_REAPPROVE: 'MANAGER_REAPPROVE',
} as const;
export type ApprovalLevel = typeof ApprovalLevel[keyof typeof ApprovalLevel];

export const ApprovalAction = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalAction = typeof ApprovalAction[keyof typeof ApprovalAction];

// ─── Expense Types ────────────────────────────────────────────────────────────

export const ExpenseStatus = {
  DRAFT:     'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED:  'APPROVED',
  REJECTED:  'REJECTED',
  CLOSED:    'CLOSED',
} as const;
export type ExpenseStatus = typeof ExpenseStatus[keyof typeof ExpenseStatus];

export const ExpenseCategory = {
  ACCOMMODATION: 'ACCOMMODATION',
  TRANSPORT:     'TRANSPORT',
  MEAL:          'MEAL',
  PER_DIEM:      'PER_DIEM',
  OTHER:         'OTHER',
} as const;
export type ExpenseCategory = typeof ExpenseCategory[keyof typeof ExpenseCategory];

// ─── API Response Types ───────────────────────────────────────────────────────

/** Standard API success response wrapper */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

/** Standard paginated response */
export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** JWT Payload (architecture.md §6.1) */
export interface JwtPayload {
  sub: string;   // userId
  role: UserRole;
  name: string;
  iat: number;
  exp: number;
}
