import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getStudentAttendanceAnalytics = async (req: Request, res: Response) => {
  try {
    const student_id = req.params.id as string;
    
    // Check if requesting user is authorized (must be the student or a teacher)
    if (req.user.role === 'STUDENT' && req.user.id !== student_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own analytics' });
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: { student_id },
      include: { session: { select: { class_id: true } } }
    });

    let total = attendanceRecords.length;
    let present = attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'MANUAL_OVERRIDE').length;
    let proxy_flags = attendanceRecords.filter(r => r.status === 'PROXY_FLAGGED').length;
    
    const percentage = total > 0 ? (present / total) * 100 : 0;
    
    // Fetch actual Risk Profile from AI Engine
    let risk_data = {
      risk_level: 'LOW',
      risk_score: 0.1,
      recommendation: 'Monitor standard progress'
    };

    try {
      const aiResponse = await fetch('http://localhost:8000/predict-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id,
          attendance_percentage: percentage,
          proxy_flags_count: proxy_flags,
          recent_grades: [] // Could be populated from InternalMark table
        })
      });
      
      if (aiResponse.ok) {
        risk_data = await aiResponse.json();
      }
    } catch (aiError) {
      console.error('AI Engine unreachable, falling back to heuristics:', aiError);
      // Heuristic Fallback
      if (percentage < 75 || proxy_flags > 2) {
        risk_data.risk_level = 'HIGH';
        risk_data.recommendation = 'Immediate HOD Intervention required';
      }
      else if (percentage < 85) risk_data.risk_level = 'MEDIUM';
    }

    return res.json({
      analytics: {
        total_sessions: total,
        attended: present,
        percentage: percentage.toFixed(2),
        proxy_flags,
        risk_level: risk_data.risk_level,
        risk_score: risk_data.risk_score,
        recommendation: risk_data.recommendation,
        velocity_trend: percentage >= 75 ? 'UPWARD' : 'DOWNWARD'
      }
    });

  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
