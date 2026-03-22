import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const teacher_id = req.user.id;
    const { class_id, title, description, deadline, max_marks, type, file_url, allow_late, late_penalty_percent } = req.body;

    const classRecord = await prisma.class.findUnique({ where: { id: class_id } });
    if (!classRecord || classRecord.teacher_id !== teacher_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this class' });
    }

    const assignment = await prisma.assignment.create({
      data: {
        class_id,
        created_by: teacher_id,
        title,
        description,
        deadline: new Date(deadline),
        max_marks,
        type,
        file_url,
        is_published: true,
        allow_late: allow_late || false,
        late_penalty_percent: late_penalty_percent || 0,
      },
    });

    return res.status(201).json({ message: 'Assignment created successfully', assignment });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const submitAssignment = async (req: Request, res: Response) => {
  try {
    const student_id = req.user.id;
    const { assignment_id, file_url, file_name } = req.body;

    const assignment = await prisma.assignment.findUnique({ where: { id: assignment_id } });
    if (!assignment) {
      return res.status(404).json({ error: 'Not Found', message: 'Assignment not found' });
    }

    const now = new Date();
    const is_late = now > assignment.deadline;

    if (is_late && !assignment.allow_late) {
      return res.status(400).json({ error: 'Deadline Passed', message: 'Late submissions are not allowed for this assignment' });
    }

    let late_by_minutes = 0;
    if (is_late) {
      late_by_minutes = Math.floor((now.getTime() - assignment.deadline.getTime()) / 60000);
    }

    const submission = await prisma.submission.upsert({
      where: {
        assignment_id_student_id: { assignment_id, student_id }
      },
      update: {
        file_url,
        file_name,
        submitted_at: now,
        is_late,
        late_by_minutes,
        status: 'SUBMITTED'
      },
      create: {
        assignment_id,
        student_id,
        file_url,
        file_name,
        submitted_at: now,
        is_late,
        late_by_minutes,
        status: 'SUBMITTED'
      }
    });

    return res.json({ message: 'Assignment submitted successfully', submission });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const class_id = req.params.class_id as string;
    
    // In a real app we'd verify enrollment, for simplicity we just fetch
    const assignments = await prisma.assignment.findMany({
      where: { class_id, is_published: true },
      orderBy: { deadline: 'asc' },
      include: {
        submissions: {
          where: { student_id: req.user.id },
          select: { id: true, status: true, submitted_at: true, marks_obtained: true }
        }
      }
    });

    return res.json({ assignments });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
