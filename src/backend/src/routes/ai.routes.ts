/**
 * ai.routes.ts — AI Itinerary Generation Route
 * POST /api/v1/ai/generate-itinerary
 *
 * Roles: EMPLOYEE (API.md §2.3). Ownership + TRIP_IMMUTABLE (BR-TR-06)
 * kiểm tra ở service layer (tripId nằm trong body, không phải params).
 */

import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { roleGuard } from '../middlewares/role.guard';
import { generateItinerary } from '../controllers/ai.controller';

const router = Router();

router.post('/generate-itinerary', authGuard, roleGuard(['EMPLOYEE']), generateItinerary);

export default router;
