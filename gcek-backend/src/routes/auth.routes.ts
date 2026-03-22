import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { register, login, getMe } from '../controllers/auth.controller';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['STUDENT', 'TEACHER', 'HOD', 'ADMIN']),
    department: z.enum(['ELECTRICAL', 'MECHANICAL', 'CIVIL', 'IT', 'COMPUTER', 'ELECTRONICS']),
    year: z.number().min(1).max(4).optional(),
    division: z.string().optional(),
    roll_number: z.string().optional(),
    phone: z.string().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, getMe);

export default router;
