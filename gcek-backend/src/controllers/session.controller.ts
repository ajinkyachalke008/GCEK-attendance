import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { generateToken } from '../utils/jwt';

export const startSession = async (req: Request, res: Response) => {
  try {
    const teacher_id = req.user.id;
    const { class_id, geo_lat, geo_lng, geo_radius_meters, notes } = req.body;

    // Verify class ownership
    const classRecord = await prisma.class.findUnique({ where: { id: class_id } });
    if (!classRecord || classRecord.teacher_id !== teacher_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this class' });
    }

    // Generate initial 45s QR token
    const qr_token = generateToken({ userId: teacher_id, role: 'SESSION_QR' }); // We can add session_id later

    const newSession = await prisma.session.create({
      data: {
        class_id,
        teacher_id,
        start_time: new Date(),
        status: 'ACTIVE',
        qr_token,
        qr_refresh_count: 0,
        geo_lat,
        geo_lng,
        geo_radius_meters: geo_radius_meters || 150,
        notes,
      },
    });

    // We realistically want to pack the session_id into the QR token so we re-sign it
    const final_qr_token = generateToken({ userId: teacher_id, role: 'SESSION_QR', sessionId: newSession.id } as any);
    await prisma.session.update({
      where: { id: newSession.id },
      data: { qr_token: final_qr_token },
    });

    return res.status(201).json({
      message: 'Session started',
      session: { ...newSession, qr_token: final_qr_token },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const endSession = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const teacher_id = req.user.id;

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.teacher_id !== teacher_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    await prisma.session.update({
      where: { id },
      data: {
        status: 'ENDED',
        end_time: new Date(),
      },
    });

    return res.json({ message: 'Session ended successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
