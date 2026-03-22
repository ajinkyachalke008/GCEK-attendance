import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma';
import { generateToken } from '../utils/jwt';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, department, year, division, roll_number, phone } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role,
        department,
        year,
        division,
        roll_number,
        phone,
      },
    });

    const token = generateToken({ userId: user.id, role: user.role });

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      },
      access_token: token,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Forbidden', message: 'Account is deactivated' });
    }

    const token = generateToken({ userId: user.id, role: user.role });

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      },
      access_token: token,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    // req.user is populated by the auth middleware
    return res.json({ user: req.user });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
