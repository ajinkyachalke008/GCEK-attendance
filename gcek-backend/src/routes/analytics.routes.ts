import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStudentAttendanceAnalytics } from '../controllers/analytics.controller';

const router = Router();

router.get('/student/:id/attendance', authenticate, getStudentAttendanceAnalytics);

export default router;
