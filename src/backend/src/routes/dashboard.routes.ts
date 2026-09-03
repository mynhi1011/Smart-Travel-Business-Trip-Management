import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { getDashboard } from '../controllers/dashboard.controller';

const router = Router();
router.get('/', authGuard, getDashboard);
export default router;
