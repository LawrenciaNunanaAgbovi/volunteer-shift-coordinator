import { Router } from 'express';
import { createOrg, getAllOrgs, getOrgById, updateOrg, deleteOrg, getMyOrgDashboard } from '../controllers/orgController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/my/dashboard', authenticate, requireRole('org_admin'), getMyOrgDashboard);
router.get('/', authenticate, getAllOrgs);
router.get('/:id', authenticate, getOrgById);
router.post('/', authenticate, requireRole('org_admin'), createOrg);
router.put('/:id', authenticate, requireRole('org_admin'), updateOrg);
router.delete('/:id', authenticate, requireRole('org_admin'), deleteOrg);

export default router;
