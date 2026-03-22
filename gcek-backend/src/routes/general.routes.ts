import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTimetable, getNotices, getPlacements } from '../controllers/general.controller';

const router = Router();

router.get('/timetable/:class_id', authenticate, getTimetable);
router.get('/notices', authenticate, getNotices);
router.get('/placements', authenticate, getPlacements);

export default router;
