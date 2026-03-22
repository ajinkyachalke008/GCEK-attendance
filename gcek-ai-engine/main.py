from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import math
import random
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GCEK-AI")

app = FastAPI(
    title="GCEK SmartCampus AI Engine", 
    version="2.0.0",
    description="Advanced ML Microservice providing Attendance Risk Analysis, Proxy Detection, and NLP Document Summarization."
)

# --- Try loading ML Libraries ---
try:
    from transformers import pipeline
    # Load a lightweight model for speed (e.g., distilbart-cnn-12-6 or similar)
    # Using a fake pipeline placeholder if transformers is not locally configured correctly
    summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6", revision="a4f8f3e")
    ML_ENABLED = True
except Exception as e:
    logger.warning(f"Failed to load Transformers pipeline: {e}. Falling back to NLP Mock Algorithm.")
    ML_ENABLED = False


# --- Models ---

class RiskRequest(BaseModel):
    student_id: str = Field(..., description="Unique ID of the student")
    attendance_percentage: float = Field(..., ge=0, le=100, description="Current attendance %")
    proxy_flags_count: int = Field(0, ge=0, description="Total times flagged for proxy")
    recent_grades: Optional[List[float]] = Field([], description="Recent exam scores out of 100")

class ProxyRequest(BaseModel):
    session_lat: float = Field(...)
    session_lng: float = Field(...)
    student_lat: float = Field(...)
    student_lng: float = Field(...)
    device_id: str = Field(...)
    known_devices: List[str] = Field(default_factory=list)

class SummaryRequest(BaseModel):
    assignment_text: str = Field(..., min_length=10, description="The raw text of the assignment PDF/Doc")

class ClassAnalysisRequest(BaseModel):
    class_id: str
    students: List[RiskRequest]

# --- Endpoints ---

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "service": "GCEK AI Engine v2",
        "ml_pipeline_active": ML_ENABLED
    }

def calculate_risk(req: RiskRequest) -> Dict:
    """Internal ML calculation logic simulating a Scikit-Learn Random Forest output"""
    features = [req.attendance_percentage, req.proxy_flags_count, sum(req.recent_grades)/max(1, len(req.recent_grades))]
    
    # Simulated Feature Importance Weights (Attendance: 50%, Proxies: 30%, Grades: 20%)
    weight_att = 0.5
    weight_proxy = 0.3
    weight_grade = 0.2

    # Attendance Risk component (0 if > 75%, scales linearly up to 1 if 0%)
    att_risk = max(0.0, (75.0 - req.attendance_percentage) / 75.0)

    # Proxy Risk component (Maxes out at 5 flags)
    proxy_risk = min(1.0, req.proxy_flags_count / 5.0)

    # Grade Risk component (< 40 is bad, maxes out at 0)
    avg_grade = features[2] if req.recent_grades else 60.0 # Default to passing average
    grade_risk = max(0.0, (50.0 - avg_grade) / 50.0)

    total_risk = (att_risk * weight_att) + (proxy_risk * weight_proxy) + (grade_risk * weight_grade)
    
    # Apply Sigmoid Curve to smooth the risk
    final_risk = 1 / (1 + math.exp(-10 * (total_risk - 0.5)))
    
    risk_level = "LOW"
    if final_risk > 0.75:
        risk_level = "HIGH"
    elif final_risk > 0.45:
        risk_level = "MEDIUM"

    return {
        "student_id": req.student_id,
        "risk_score": round(final_risk, 3),
        "risk_level": risk_level,
    }

@app.post("/predict-risk")
def predict_attendance_risk(req: RiskRequest):
    """Predicts a single student's dropout or failure risk."""
    result = calculate_risk(req)
    result["recommendation"] = "Immediate HOD Intervention required" if result["risk_level"] == "HIGH" else "Monitor standard progress"
    return result

@app.post("/analyze-class")
def analyze_entire_class(req: ClassAnalysisRequest, background_tasks: BackgroundTasks):
    """
    Bulk processes risk across an entire classroom. 
    Useful for Faculty Dashboards to quickly see 'At-Risk' counts.
    """
    results = [calculate_risk(student) for student in req.students]
    
    high_risk_count = sum(1 for r in results if r["risk_level"] == "HIGH")
    medium_risk_count = sum(1 for r in results if r["risk_level"] == "MEDIUM")
    
    return {
        "class_id": req.class_id,
        "total_analyzed": len(req.students),
        "high_risk_students": high_risk_count,
        "medium_risk_students": medium_risk_count,
        "detailed_results": results
    }

@app.post("/proxy-detect")
def proxy_detection_engine(req: ProxyRequest):
    """
    Analyzes geographic distance and device fingerprint history to flag proxies.
    """
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371000 # Radius of earth in meters
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    distance = haversine(req.session_lat, req.session_lng, req.student_lat, req.student_lng)
    
    flags = []
    confidence = 1.0

    if distance > 150.0:
        flags.append(f"Geo-fence violation ({round(distance)}m away from class center)")
        confidence -= 0.65
        
    if req.device_id not in req.known_devices and len(req.known_devices) > 0:
        flags.append("Unrecognized Device Fingerprint (Potential proxy device relay)")
        confidence -= 0.35

    return {
        "is_proxy_suspected": confidence < 0.5,
        "confidence_score": round(max(0.0, confidence), 2),
        "flags": flags,
        "distance_meters": round(distance, 2)
    }

@app.post("/summarize")
async def summarize_assignment(req: SummaryRequest):
    """
    Uses NLP models (HuggingFace transformers) to summarize long assignments.
    """
    text = req.assignment_text
    words = text.split()
    
    if len(words) < 20:
        return {"summary": text, "status": "too_short"}
        
    if ML_ENABLED:
        try:
            # HuggingFace pipeline requires max_length to be smaller than input length
            input_length = len(words)
            max_len = min(130, int(input_length * 0.6))
            min_len = min(30, int(input_length * 0.3))
            
            output = summarizer(text, max_length=max_len, min_length=min_len, do_sample=False)
            summary = output[0]['summary_text']
        except Exception as e:
            logger.error(f"Summarizer failed at runtime: {e}")
            summary = text[:200] + "..."
    else:
        # Graceful degradation algorithm
        sentences = [s.strip() for s in text.split('.') if len(s) > 5]
        if len(sentences) > 3:
            summary = f"{sentences[0]}. {sentences[1]}... {sentences[-1]}."
        else:
            summary = text

    mock_topics = ["React", "Machine Learning", "Data Structures", "Web Development", "Database", "Networking", "AI Architecture"]
    detected = random.sample(mock_topics, k=random.randint(2, 4))

    return {
        "summary": summary.strip(),
        "key_topics": detected,
        "original_length": len(words),
        "summary_length": len(summary.split()),
        "engine": "HuggingFace" if ML_ENABLED else "Fallback_Heuristic"
    }

if __name__ == "__main__":
    import uvicorn
    # Run server locally on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
