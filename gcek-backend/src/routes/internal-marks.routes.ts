import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, requireRole } from '../middleware/auth';
import { enterInternalMarks, getStudentMarks } from '../controllers/internal-marks.controller';

const router = Router();

const enterMarksSchema = z.object({
  body: z.object({
    class_id: z.string(),
    student_id: z.string(),
    exam_type: z.enum(['UT1', 'UT2', 'MID_TERM', 'PRELIM', 'PRACTICAL_EXAM', 'ASSIGNMENT_AVG']),
    marks_obtained: z.number().min(0),
    max_marks: z.number().min(1),
  }),
});

router.post('/enter', authenticate, requireRole(['TEACHER', 'HOD']), validate(enterMarksSchema), enterInternalMarks);
router.get('/my-marks', authenticate, requireRole(['STUDENT']), getStudentMarks);

export default router;
