import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, requireRole } from '../middleware/auth';
import { createAssignment, submitAssignment, getAssignments } from '../controllers/assignment.controller';

const router = Router();

// Zod schemas
const createSchema = z.object({
  body: z.object({
    class_id: z.string(),
    title: z.string().min(3),
    description: z.string(),
    deadline: z.string().datetime(),
    max_marks: z.number().min(1),
    type: z.enum(['ASSIGNMENT', 'PRACTICAL', 'PROJECT', 'VIVA', 'QUIZ']),
    file_url: z.string().url().optional(),
    allow_late: z.boolean().optional(),
    late_penalty_percent: z.number().min(0).max(100).optional()
  }),
});

const submitSchema = z.object({
  body: z.object({
    assignment_id: z.string(),
    file_url: z.string().url(),
    file_name: z.string()
  }),
});

router.post('/create', authenticate, requireRole(['TEACHER', 'HOD']), validate(createSchema), createAssignment);
router.post('/submit', authenticate, requireRole(['STUDENT']), validate(submitSchema), submitAssignment);
router.get('/class/:class_id', authenticate, getAssignments);

export default router;
