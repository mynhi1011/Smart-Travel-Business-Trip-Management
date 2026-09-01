/**
 * expense.controller.ts — Expense Claim Controller
 *
 * Handles:
 *   GET    /trips/:id/expenses             — getExpense
 *   POST   /trips/:id/expenses             — createExpense
 *   POST   /trips/:id/expenses/submit      — submitExpense
 *   POST   /trips/:id/expenses/approve     — approveExpense  (FINANCE)
 *   POST   /trips/:id/expenses/reject      — rejectExpense   (FINANCE)
 *   POST   /trips/:id/expenses/reapprove   — reapproveExpense (MANAGER)
 *   POST   /trips/:id/expenses/items       — addExpenseItem
 *   PUT    /trips/:id/expenses/items/:itemId — updateExpenseItem
 *   DELETE /trips/:id/expenses/items/:itemId — deleteExpenseItem
 *
 * TODO: Implement đầy đủ khi xây dựng Expense feature
 */

import { Request, Response, NextFunction } from 'express';

export async function getExpense(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'getExpense — TODO' });
}

export async function createExpense(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'createExpense — TODO' });
}

export async function submitExpense(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'submitExpense — TODO' });
}

export async function approveExpense(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'approveExpense — TODO' });
}

export async function rejectExpense(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'rejectExpense — TODO' });
}

export async function reapproveExpense(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'reapproveExpense — TODO' });
}

export async function addExpenseItem(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'addExpenseItem — TODO' });
}

export async function updateExpenseItem(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'updateExpenseItem — TODO' });
}

export async function deleteExpenseItem(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'deleteExpenseItem — TODO' });
}
