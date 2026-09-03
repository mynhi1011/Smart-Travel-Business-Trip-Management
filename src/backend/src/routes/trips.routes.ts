/**
 * trips.routes.ts — Trip Request CRUD & Action Routes
 * API.md §5 + §6
 */

import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { roleGuard } from '../middlewares/role.guard';
import { immutableGuard } from '../middlewares/immutable.guard';
import {
  createTrip, listTrips, getTripById, updateTrip, deleteTrip,
  submitTrip, approveTrip, rejectTrip, closeTrip,
} from '../controllers/trip.controller';

const router = Router();

// CRUD
router.get( '/',     authGuard,                                              listTrips);
router.post('/',     authGuard, roleGuard(['EMPLOYEE']),                     createTrip);
router.get( '/:id',  authGuard,                                              getTripById);
router.patch('/:id', authGuard, roleGuard(['EMPLOYEE']), immutableGuard,     updateTrip);
router.delete('/:id',authGuard, roleGuard(['EMPLOYEE']),                     deleteTrip);

// Actions
router.post('/:id/submit',  authGuard, roleGuard(['EMPLOYEE']),                       submitTrip);
router.post('/:id/approve', authGuard, roleGuard(['MANAGER', 'TRAVEL_ADMIN']),        approveTrip);
router.post('/:id/reject',  authGuard, roleGuard(['MANAGER', 'TRAVEL_ADMIN']),        rejectTrip);
router.post('/:id/close',   authGuard, roleGuard(['FINANCE']),                        closeTrip);

export default router;
