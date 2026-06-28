import { Router } from 'express'
import { getRecommendations, generateDescription } from '../controllers/aiController'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

router.get('/recommendations',      authenticate, requireRole('volunteer'), getRecommendations)
router.post('/generate-description', authenticate, requireRole('org_admin'), generateDescription)

export default router
