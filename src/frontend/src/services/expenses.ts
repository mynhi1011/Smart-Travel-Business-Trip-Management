import { apiRequest } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'MANAGER_REAPPROVE';

export type ExpenseCategory =
  | 'ACCOMMODATION'
  | 'TRANSPORT'
  | 'MEAL'
  | 'PER_DIEM'
  | 'OTHER';

export interface BackendExpenseItem {
  id: string;
  expenseId: string;
  expenseDate: string;    // ISO string
  category: ExpenseCategory;
  amount: number;         // VNĐ integer
  description: string;
  receiptUrl: string | null;
  createdAt: string;
}

export interface BackendExpense {
  id: string;
  tripId: string;
  totalActual: number;
  estimatedBudgetSnapshot: number;
  variancePct: number | null;
  varianceAmount: number | null;
  justification: string | null;
  managerReapprovalRequired: boolean;
  managerReapproved: boolean;
  status: ExpenseStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BackendExpenseItem[];
}

export interface ExpenseItemInput {
  expenseDate: string;      // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  description: string;
  receiptUrl?: string;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function getExpense(tripId: string): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense`);
  return res.data;
}

export async function createExpense(tripId: string): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense`, {
    method: 'POST',
  });
  return res.data;
}

export async function updateExpenseJustification(
  tripId: string,
  justification: string,
): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense`, {
    method: 'PATCH',
    body: JSON.stringify({ justification }),
  });
  return res.data;
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function addExpenseItem(
  tripId: string,
  input: ExpenseItemInput,
): Promise<BackendExpenseItem> {
  const res = await apiRequest<{ data: BackendExpenseItem }>(`/trips/${tripId}/expense/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateExpenseItem(
  tripId: string,
  itemId: string,
  input: Partial<ExpenseItemInput>,
): Promise<BackendExpenseItem> {
  const res = await apiRequest<{ data: BackendExpenseItem }>(
    `/trips/${tripId}/expense/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return res.data;
}

export async function deleteExpenseItem(tripId: string, itemId: string): Promise<void> {
  await apiRequest<void>(`/trips/${tripId}/expense/items/${itemId}`, { method: 'DELETE' });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function submitExpense(tripId: string): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense/submit`, {
    method: 'POST',
  });
  return res.data;
}

export async function approveExpense(
  tripId: string,
  comment?: string,
): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
  return res.data;
}

export async function rejectExpense(
  tripId: string,
  comment: string,
): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
  return res.data;
}

/** Manager re-approve khi chi phí vượt >10% ngưỡng (BR-TR-05). */
export async function reapproveExpense(
  tripId: string,
  comment: string,
): Promise<BackendExpense> {
  const res = await apiRequest<{ data: BackendExpense }>(`/trips/${tripId}/expense/reapprove`, {
    method: 'POST',
    body: JSON.stringify({ action: 'APPROVED', comment }),
  });
  return res.data;
}
