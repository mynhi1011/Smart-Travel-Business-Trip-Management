import { Router } from 'express';
import { authGuard } from '../middlewares/auth.guard';
import { listNotifications, markAsRead, markAllRead, streamNotifications } from '../controllers/notification.controller';

const router = Router();

// SSE stream — auth via query ?token= (EventSource cannot set headers)
router.get('/stream',                  streamNotifications);

// Protected
router.get('/',                        authGuard, listNotifications);
router.patch('/read-all',              authGuard, markAllRead);
router.patch('/:notificationId/read',  authGuard, markAsRead);

export default router;
