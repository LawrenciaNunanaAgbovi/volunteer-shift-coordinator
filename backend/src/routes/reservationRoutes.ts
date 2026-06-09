import { Router } from 'express';
import { reserve, updateStatus, myReservations, shiftReservations } from '../controllers/reservationController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/reservations/my', authenticate, requireRole('volunteer'), myReservations);
router.post('/shifts/:shiftId/reservations', authenticate, requireRole('volunteer'), reserve);
router.get('/shifts/:shiftId/reservations', authenticate, requireRole('org_admin'), shiftReservations);
router.patch('/reservations/:id/status', authenticate, requireRole('org_admin'), updateStatus);

export default router;
