import { Router } from 'express'
import { protect } from '../middleware/auth'
import { listHistory, getHistory, deleteHistory } from '../controllers/historyController'

const router = Router()
router.use(protect)
router.get('/', listHistory)
router.get('/:id', getHistory)
router.delete('/:id', deleteHistory)
export default router
