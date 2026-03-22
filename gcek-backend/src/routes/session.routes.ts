import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, requireRole } from '../middleware/auth';
import { startSession, endSession } from '../controllers/session.controller';

const router = Router();

const startSessionSchema = z.object({
  body: z.object({
    class_id: z.string().cuid(),
    geo_lat: z.number().min(-90).max(90).optional(),
    geo_lng: z.number().min(-180).max(180).optional(),
    geo_radius_meters: z.number().min(10).max(1000).optional(),
    notes: z.string().optional(),
  }),
});

router.post('/start', authenticate, requireRole(['TEACHER', 'HOD', 'ADMIN']), validate(startSessionSchema), startSession);
router.post('/:id/end', authenticate, requireRole(['TEACHER', 'HOD', 'ADMIN']), endSession);

export default router;
