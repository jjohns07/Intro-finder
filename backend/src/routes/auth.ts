import { Router } from 'express'
import { getCurrentUser, loginUser, registerUser } from '../controllers/authController'
import { protect } from '../middleware/auth'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/me', protect, getCurrentUser)

export default router
