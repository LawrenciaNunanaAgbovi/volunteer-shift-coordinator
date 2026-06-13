import { Router } from 'express';
import {
  createShift,
  getAllShifts,
  getShiftById,
  updateShift,
  updateShiftStatus,
  deleteShift,
  addPosition,
  updatePosition,
  removePosition,
} from '../controllers/shiftController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/',    authenticate, getAllShifts);
router.get('/:id', authenticate, getShiftById);
router.post('/',   authenticate, requireRole('org_admin'), createShift);
router.put('/:id', authenticate, requireRole('org_admin'), updateShift);
router.patch('/:id/status', authenticate, requireRole('org_admin'), updateShiftStatus);
router.delete('/:id', authenticate, requireRole('org_admin'), deleteShift);

// Positions
router.post('/:id/positions',            authenticate, requireRole('org_admin'), addPosition);
router.put('/:id/positions/:posId',      authenticate, requireRole('org_admin'), updatePosition);
router.delete('/:id/positions/:posId',   authenticate, requireRole('org_admin'), removePosition);

export default router;
