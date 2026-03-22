import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadMaterial, getMaterials } from '../controllers/materials.controller';

const router = Router();

const uploadSchema = z.object({
  body: z.object({
    class_id: z.string(),
    title: z.string().min(3),
    description: z.string().optional(),
    file_url: z.string().url(),
    file_type: z.enum(['PDF', 'PPT', 'VIDEO_LINK', 'DOC', 'IMAGE', 'OTHER']),
    unit_number: z.number().optional(),
    tags: z.array(z.string()).optional()
  }),
});

router.post('/upload', authenticate, requireRole(['TEACHER', 'HOD']), validate(uploadSchema), uploadMaterial);
router.get('/class/:class_id', authenticate, getMaterials);

export default router;
