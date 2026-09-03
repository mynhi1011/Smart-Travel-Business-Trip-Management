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
router.get(  '/:id/expenses',         authGuard,                               getExpense);
router.post( '/:id/expenses',         authGuard, roleGuard(['EMPLOYEE']),       createExpense);
router.patch('/:id/expenses',         authGuard, roleGuard(['EMPLOYEE']),       updateExpense);

// Expense items
router.post(  '/:id/expenses/items',              authGuard, roleGuard(['EMPLOYEE']), addExpenseItem);
router.patch( '/:id/expenses/items/:itemId',      authGuard, roleGuard(['EMPLOYEE']), updateExpenseItem);
router.delete('/:id/expenses/items/:itemId',      authGuard, roleGuard(['EMPLOYEE']), deleteExpenseItem);

// Actions
router.post('/:id/expenses/submit',    authGuard, roleGuard(['EMPLOYEE']),              submitExpense);
router.post('/:id/expenses/approve',   authGuard, roleGuard(['FINANCE']),               approveExpense);
router.post('/:id/expenses/reject',    authGuard, roleGuard(['FINANCE']),               rejectExpense);
router.post('/:id/expenses/reapprove', authGuard, roleGuard(['MANAGER']),               reapproveExpense);

export default router;
