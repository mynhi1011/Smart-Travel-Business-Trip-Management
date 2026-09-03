import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { roleGuard } from '../middlewares/role.guard';
import { immutableGuard } from '../middlewares/immutable.guard';
import { getItinerary, addItineraryItem, updateItineraryItem, deleteItineraryItem } from '../controllers/itinerary.controller';

const router = Router();

router.get( '/:id/itinerary',               authGuard,                                           getItinerary);
router.post('/:id/itinerary',               authGuard, roleGuard(['EMPLOYEE']), immutableGuard,  addItineraryItem);
router.patch('/:id/itinerary/:itemId',      authGuard, roleGuard(['EMPLOYEE']), immutableGuard,  updateItineraryItem);
router.delete('/:id/itinerary/:itemId',     authGuard, roleGuard(['EMPLOYEE']), immutableGuard,  deleteItineraryItem);

export default router;
