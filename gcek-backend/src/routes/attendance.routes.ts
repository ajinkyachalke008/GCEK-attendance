import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, requireRole } from '../middleware/auth';
import { scanQR } from '../controllers/attendance.controller';

const router = Router();

const scanQRSchema = z.object({
  body: z.object({
    qr_token: z.string(),
    device_id: z.string(),
    geo_lat: z.number().min(-90).max(90).optional().nullable(),
    geo_lng: z.number().min(-180).max(180).optional().nullable(),
    timestamp: z.string().datetime().optional(),
  }),
});

router.post('/scan', authenticate, requireRole(['STUDENT']), validate(scanQRSchema), scanQR);

export default router;
