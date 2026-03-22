import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const uploadMaterial = async (req: Request, res: Response) => {
  try {
    const uploaded_by = req.user.id;
    const { class_id, title, description, file_url, file_type, unit_number, tags } = req.body;

    const classRecord = await prisma.class.findUnique({ where: { id: class_id } });
    if (!classRecord || classRecord.teacher_id !== uploaded_by) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this class' });
    }

    const material = await prisma.studyMaterial.create({
      data: {
        class_id,
        uploaded_by,
        title,
        description,
        file_url,
        file_type,
        unit_number,
        tags: tags || [],
      },
    });

    return res.status(201).json({ message: 'Study material uploaded successfully', material });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getMaterials = async (req: Request, res: Response) => {
  try {
    const { class_id } = req.params;
    
    // In production we would check class enrollment, skipping for brevity
    const materials = await prisma.studyMaterial.findMany({
      where: { class_id },
      orderBy: { created_at: 'desc' }
    });

    return res.json({ materials });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
