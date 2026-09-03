import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { exportTripPdf } from '../controllers/pdf.controller';

const router = Router();
router.get('/:id/export-pdf', authGuard, exportTripPdf);
export default router;
