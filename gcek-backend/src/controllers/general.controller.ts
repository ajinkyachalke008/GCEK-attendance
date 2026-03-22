import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getTimetable = async (req: Request, res: Response) => {
  try {
    const { class_id } = req.params;
    const timetable = await prisma.timetable.findMany({
      where: { class_id },
      orderBy: [
        { day_of_week: 'asc' },
        { start_time: 'asc' }
      ]
    });
    return res.json({ timetable });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getNotices = async (req: Request, res: Response) => {
  try {
    const notices = await prisma.notice.findMany({
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        poster: { select: { name: true, role: true } }
      }
    });
    return res.json({ notices });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getPlacements = async (req: Request, res: Response) => {
  try {
    const placements = await prisma.placement.findMany({
      where: { status: { in: ['OPEN', 'UPCOMING'] } },
      orderBy: { drive_date: 'asc' }
    });
    return res.json({ placements });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
