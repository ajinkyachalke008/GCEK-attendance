import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { verifyToken } from '../utils/jwt';
import { getDistanceFromLatLonInMeters } from '../utils/geo';

export const scanQR = async (req: Request, res: Response) => {
  try {
    const student_id = req.user.id;
    const { qr_token, device_id, geo_lat, geo_lng, timestamp } = req.body;

    // 1. Validate Token
    let decoded: any;
    try {
      decoded = verifyToken(qr_token);
    } catch (e) {
      return res.status(400).json({ error: 'TOKEN_EXPIRED', message: 'QR code expired. Please scan again.' });
    }

    const { sessionId, role } = decoded;
    if (role !== 'SESSION_QR' || !sessionId) {
      return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Invalid QR code.' });
    }

    // 2. Load Session
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'SESSION_CLOSED', message: 'This session is no longer active.' });
    }

    // 3. Verify Enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { class_id_student_id: { class_id: session.class_id, student_id } },
    });
    if (!enrollment) {
      return res.status(403).json({ error: 'NOT_ENROLLED', message: 'You are not enrolled in this class.' });
    }

    // 4. Duplicate Check
    const existingEntry = await prisma.attendance.findUnique({
      where: { session_id_student_id: { session_id: sessionId, student_id } },
    });
    if (existingEntry) {
      return res.status(400).json({ error: 'ALREADY_MARKED', message: 'Attendance already recorded.' });
    }

    // 5. Geo-fencing Check
    let distance = null;
    let proxy_flagged = false;
    let proxy_reason = null;

    if (session.geo_lat && session.geo_lng && geo_lat && geo_lng) {
      distance = getDistanceFromLatLonInMeters(session.geo_lat, session.geo_lng, geo_lat, geo_lng);
      if (distance > session.geo_radius_meters) {
        proxy_flagged = true;
        proxy_reason = `Geo-fence violation (${Math.round(distance)}m away)`;
      }
    } else if (session.geo_lat && (!geo_lat || !geo_lng)) {
      proxy_flagged = true;
      proxy_reason = 'Location services disabled by student';
    }

    // 6. Device Fingerprinting (Proxy Check)
    const deviceConflict = await prisma.attendance.findFirst({
      where: { session_id: sessionId, device_id, student_id: { not: student_id } },
    });
    if (deviceConflict) {
      proxy_flagged = true;
      proxy_reason = proxy_reason ? `${proxy_reason} | Device ID reused` : 'Device ID reused';
    }

    // 7. Enhanced AI Proxy Detection
    let ai_confidence = 1.0;
    try {
      const student = await prisma.user.findUnique({ where: { id: student_id } });
      const aiProxyResponse = await fetch('http://localhost:8000/proxy-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_lat: session.geo_lat,
          session_lng: session.geo_lng,
          student_lat: geo_lat,
          student_lng: geo_lng,
          device_id,
          known_devices: student?.device_id ? [student.device_id] : []
        })
      });

      if (aiProxyResponse.ok) {
        const aiData = await aiProxyResponse.json();
        if (aiData.is_proxy_suspected) {
          proxy_flagged = true;
          proxy_reason = aiData.flags.join(' | ');
          ai_confidence = aiData.confidence_score;
        }
      }
    } catch (aiError) {
      console.error('AI Proxy Detection unreachable:', aiError);
    }

    // 8. Final Confidence & Status
    let confidence = ai_confidence;
    if (proxy_flagged && confidence > 0.5) confidence = 0.4; // Override if manually flagged but AI missed it

    // 8. Record Attendance
    const attendance = await prisma.attendance.create({
      data: {
        session_id: sessionId,
        student_id,
        status: proxy_flagged ? 'PROXY_FLAGGED' : 'PRESENT',
        confidence_score: confidence,
        device_id,
        geo_lat,
        geo_lng,
        geo_distance_meters: distance,
        proxy_risk_score: proxy_flagged ? 0.8 : 0.0,
        proxy_reason,
        marked_by: 'QR_SCAN',
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    // 9. Increment Session Count
    await prisma.session.update({
      where: { id: sessionId },
      data: { total_present: { increment: 1 } },
    });

    if (proxy_flagged) {
      return res.status(200).json({
        message: 'Attendance recorded but flagged for review.',
        warning: proxy_reason,
        status: 'PROXY_FLAGGED',
      });
    }

    return res.status(200).json({
      message: 'Attendance recorded successfully!',
      status: 'PRESENT',
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
