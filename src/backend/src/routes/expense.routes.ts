import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { roleGuard } from '../middlewares/role.guard';
import {
  getExpense, createExpense, updateExpense,
  addExpenseItem, updateExpenseItem, deleteExpenseItem,
  submitExpense, approveExpense, rejectExpense, reapproveExpense,
} from '../controllers/expense.controller';

const router = Router();

// Expense header
router.get(  '/:id/expense',         authGuard,                               getExpense);
router.post( '/:id/expense',         authGuard, roleGuard(['EMPLOYEE']),       createExpense);
router.patch('/:id/expense',         authGuard, roleGuard(['EMPLOYEE']),       updateExpense);

// Expense items
router.post(  '/:id/expense/items',              authGuard, roleGuard(['EMPLOYEE']), addExpenseItem);
router.patch( '/:id/expense/items/:itemId',      authGuard, roleGuard(['EMPLOYEE']), updateExpenseItem);
router.delete('/:id/expense/items/:itemId',      authGuard, roleGuard(['EMPLOYEE']), deleteExpenseItem);

// Actions
router.post('/:id/expense/submit',    authGuard, roleGuard(['EMPLOYEE']),              submitExpense);
router.post('/:id/expense/approve',   authGuard, roleGuard(['FINANCE']),               approveExpense);
router.post('/:id/expense/reject',    authGuard, roleGuard(['FINANCE']),               rejectExpense);
router.post('/:id/expense/reapprove', authGuard, roleGuard(['MANAGER']),               reapproveExpense);

export default router;
