import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const enterInternalMarks = async (req: Request, res: Response) => {
  try {
    const teacher_id = req.user.id;
    const { class_id, student_id, exam_type, marks_obtained, max_marks } = req.body;

    const classRecord = await prisma.class.findUnique({ where: { id: class_id } });
    if (!classRecord || classRecord.teacher_id !== teacher_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this class' });
    }

    const marks = await prisma.internalMark.create({
      data: {
        student_id,
        class_id,
        exam_type,
        marks_obtained,
        max_marks,
        entered_by: teacher_id,
      },
    });

    return res.status(201).json({ message: 'Marks entered successfully', marks });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getStudentMarks = async (req: Request, res: Response) => {
  try {
    const student_id = req.user.id;
    const marks = await prisma.internalMark.findMany({
      where: { student_id },
      include: { class: { select: { subject_name: true, subject_code: true } } },
      orderBy: { created_at: 'desc' }
    });

    return res.json({ marks });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
