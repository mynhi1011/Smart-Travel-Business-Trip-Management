import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { roleGuard } from '../middlewares/role.guard';
import { immutableGuard } from '../middlewares/immutable.guard';
import {
  getExpense, createExpense, updateExpense,
  addExpenseItem, updateExpenseItem, deleteExpenseItem,
  submitExpense, approveExpense, rejectExpense, reapproveExpense,
} from '../controllers/expense.controller';

const router = Router();

// Expense header
router.get(  '/:id/expense',         authGuard,                               getExpense);
router.post( '/:id/expense',         authGuard, roleGuard(['EMPLOYEE']), immutableGuard, createExpense);
router.patch('/:id/expense',         authGuard, roleGuard(['EMPLOYEE']), immutableGuard, updateExpense);

// Expense items — BR-TR-06: immutableGuard trả 409 TRIP_IMMUTABLE khi trip CLOSED
router.post(  '/:id/expense/items',              authGuard, roleGuard(['EMPLOYEE']), immutableGuard, addExpenseItem);
router.patch( '/:id/expense/items/:itemId',      authGuard, roleGuard(['EMPLOYEE']), immutableGuard, updateExpenseItem);
router.delete('/:id/expense/items/:itemId',      authGuard, roleGuard(['EMPLOYEE']), immutableGuard, deleteExpenseItem);

// Actions
router.post('/:id/expense/submit',    authGuard, roleGuard(['EMPLOYEE']),              immutableGuard, submitExpense);
router.post('/:id/expense/approve',   authGuard, roleGuard(['FINANCE']),               immutableGuard, approveExpense);
router.post('/:id/expense/reject',    authGuard, roleGuard(['FINANCE']),               immutableGuard, rejectExpense);
router.post('/:id/expense/reapprove', authGuard, roleGuard(['MANAGER']),               immutableGuard, reapproveExpense);

export default router;
