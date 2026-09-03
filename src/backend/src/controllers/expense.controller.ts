import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/expense.service.full';
import { Errors } from '../middlewares/error-handler';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.utils';

function u(req: Request) { if (!req.user) throw Errors.UNAUTHORIZED(); return req.user; }

export async function getExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const user = u(req); sendSuccess(res, await svc.getExpense(req.params['id'] ?? '', user.id, user.role)); }
  catch (err) { next(err); }
}

export async function createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const user = u(req); sendCreated(res, await svc.createExpense(req.params['id'] ?? '', user.id)); }
  catch (err) { next(err); }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = u(req);
    const j = (req.body as Record<string, unknown>)['justification'] as string ?? '';
    sendSuccess(res, await svc.updateExpense(req.params['id'] ?? '', user.id, j));
  } catch (err) { next(err); }
}

export async function addExpenseItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const user = u(req); sendCreated(res, await svc.addExpenseItem(req.params['id'] ?? '', user.id, req.body as svc.ExpenseItemInput)); }
  catch (err) { next(err); }
}

export async function updateExpenseItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const user = u(req); sendSuccess(res, await svc.updateExpenseItem(req.params['id'] ?? '', req.params['itemId'] ?? '', user.id, req.body as Partial<svc.ExpenseItemInput>)); }
  catch (err) { next(err); }
}

export async function deleteExpenseItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const user = u(req); await svc.deleteExpenseItem(req.params['id'] ?? '', req.params['itemId'] ?? '', user.id); sendNoContent(res); }
  catch (err) { next(err); }
}

export async function submitExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const user = u(req); sendSuccess(res, await svc.submitExpense(req.params['id'] ?? '', user.id, req.ip ?? undefined)); }
  catch (err) { next(err); }
}

export async function approveExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = u(req);
    const comment = (req.body as Record<string, unknown>)['comment'] as string | undefined;
    sendSuccess(res, await svc.approveExpense(req.params['id'] ?? '', user.id, comment, req.ip ?? undefined));
  } catch (err) { next(err); }
}

export async function rejectExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = u(req);
    const comment = (req.body as Record<string, unknown>)['comment'] as string;
    sendSuccess(res, await svc.rejectExpense(req.params['id'] ?? '', user.id, comment, req.ip ?? undefined));
  } catch (err) { next(err); }
}

export async function reapproveExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = u(req);
    const { action, comment } = req.body as { action: 'APPROVED' | 'REJECTED'; comment?: string };
    sendSuccess(res, await svc.reapproveExpense(req.params['id'] ?? '', user.id, action, comment, req.ip ?? undefined));
  } catch (err) { next(err); }
}
