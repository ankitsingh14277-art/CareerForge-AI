import json
import zipfile
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from docx.opc.exceptions import PackageNotFoundError

from backend.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES
from backend.database import (
    create_resume,
    delete_resume,
    delete_all_data,
    get_dashboard,
    get_resume,
    save_interview_progress,
    save_roadmap_state,
    save_result,
)
from backend.services.career_logic import (
    ai_analyze,
    ai_match,
    analyze_resume,
    career_chat,
    evaluate_answer,
    generate_roadmap,
    interview_questions,
    match_job,
)
from backend.services.gemini import AIConfigurationError, AIServiceError
from backend.services.pdf_exporter import build_resume_pdf
from backend.services.resume_parser import extract_profile, extract_text
from backend.schemas import (
    AssistantResponse,
    DashboardResponse,
    DeleteResponse,
    HealthResponse,
    InterviewFeedbackResponse,
    InterviewQuestionsResponse,
    JobMatchResponse,
    ProfileUpdateResponse,
    ResumeAnalysisResponse,
    ResumeResponse,
    RoadmapProgressResponse,
    RoadmapResponse,
)


router = APIRouter(prefix="/api")


class ResumeAnalysisRequest(BaseModel):
    target_role: str = Field(default="", max_length=150)
    use_ai: bool = True


class JobMatchRequest(BaseModel):
    resume_id: str
    job_title: str = Field(default="", max_length=150)
    job_description: str = Field(min_length=50, max_length=12000)
    use_ai: bool = True


class InterviewQuestionsRequest(BaseModel):
    role: str = Field(default="", max_length=150)
    resume_id: str | None = None
    job_description: str = Field(default="", max_length=8000)
    category: str = Field(default="mixed", max_length=30)


class InterviewAnswerRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    answer: str = Field(min_length=1, max_length=5000)
    question_type: str = Field(default="general", max_length=30)
    resume_id: str | None = None


class RoadmapRequest(BaseModel):
    resume_id: str | None = None
    target_role: str = Field(min_length=2, max_length=150)
    skills: list[str] = Field(default_factory=list, max_length=40)
    missing_skills: list[str] = Field(default_factory=list, max_length=40)


class RoadmapProgressRequest(BaseModel):
    roadmap: dict[str, Any]
    resume_id: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=3000)
    resume_id: str | None = None
    job_description: str = Field(default="", max_length=8000)


class ResumeProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(default="", max_length=100)
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=50)
    summary: str = Field(default="", max_length=5000)
    education: str = Field(default="", max_length=5000)
    skills: list[str] = Field(default_factory=list, max_length=40)
    experience: str = Field(default="", max_length=5000)
    projects: str = Field(default="", max_length=5000)
    certifications: str = Field(default="", max_length=3000)
    achievements: str = Field(default="", max_length=3000)


def _profile_to_text(profile: dict[str, Any]) -> str:
    lines = [
        str(profile.get("name", "")),
        str(profile.get("email", "")),
        str(profile.get("phone", "")),
    ]
    for field, label in (
        ("summary", "Summary"),
        ("experience", "Experience"),
        ("projects", "Projects"),
        ("education", "Education"),
        ("skills", "Skills"),
        ("certifications", "Certifications"),
        ("achievements", "Achievements"),
    ):
        value = profile.get(field)
        if value:
            rendered = ", ".join(value) if isinstance(value, list) else str(value)
            lines.extend((label, rendered))
    return "\n".join(line for line in lines if line)[:60_000]


def _resume_or_404(resume_id: str) -> dict[str, Any]:
    resume = get_resume(resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found. Upload it again to continue.")
    return resume


def _service_error(error: Exception) -> HTTPException:
    if isinstance(error, AIConfigurationError):
        return HTTPException(status_code=503, detail=str(error))
    if isinstance(error, AIServiceError):
        return HTTPException(status_code=502, detail=str(error))
    return HTTPException(status_code=502, detail="The AI response was invalid. Please try again.")


@router.get("/health", response_model=HealthResponse)
def health() -> dict[str, str | bool]:
    from backend.config import GEMINI_API_KEY, GEMINI_MODEL

    return {
        "status": "ok",
        "ai_configured": bool(GEMINI_API_KEY),
        "ai_model": GEMINI_MODEL,
    }


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard() -> dict[str, Any]:
    return get_dashboard()


@router.post("/resumes/upload", response_model=ResumeResponse)
async def upload_resume(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = file.filename or "resume"
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload a PDF or DOCX resume.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Resume exceeds the 8 MB upload limit.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    try:
        text = extract_text(filename, content)
    except (ValueError, RuntimeError, zipfile.BadZipFile, PackageNotFoundError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    profile = extract_profile(text)
    resume_id = str(uuid4())
    create_resume(resume_id, filename[:255], text, profile)
    return {
        "id": resume_id,
        "filename": filename[:255],
        "profile": profile,
        "created_at": get_resume(resume_id)["created_at"],
        "original_text": text,
        "privacy_notice": "Resume text is stored locally in this app's SQLite database until you delete it. AI analysis sends relevant resume text to Google Gemini.",
    }


@router.get("/resumes/{resume_id}", response_model=ResumeResponse)
def resume_detail(resume_id: str) -> dict[str, Any]:
    resume = _resume_or_404(resume_id)
    return {
        "id": resume["id"],
        "filename": resume["filename"],
        "profile": resume["profile"],
        "created_at": resume["created_at"],
        "original_text": resume["original_text"],
    }


@router.delete("/resumes/{resume_id}", response_model=DeleteResponse)
def remove_resume(resume_id: str) -> dict[str, str]:
    if not delete_resume(resume_id):
        raise HTTPException(status_code=404, detail="Resume not found.")
    return {"message": "Resume and associated career records were deleted."}


@router.delete("/data", response_model=DeleteResponse)
def remove_all_data() -> dict[str, str]:
    delete_all_data()
    return {"message": "All CareerForge records were deleted."}


@router.post("/resumes/{resume_id}/analyze", response_model=ResumeAnalysisResponse)
async def resume_analysis(resume_id: str, body: ResumeAnalysisRequest) -> dict[str, Any]:
    resume = _resume_or_404(resume_id)
    result = analyze_resume(resume["profile"], resume["extracted_text"])
    if body.use_ai:
        try:
            result = await ai_analyze(
                resume["profile"], resume["extracted_text"], body.target_role
            )
        except (AIConfigurationError, AIServiceError) as error:
            raise _service_error(error) from error
        except ValueError as error:
            raise _service_error(error) from error
    save_result("analyses", resume_id, result)
    return result


@router.post("/jobs/match", response_model=JobMatchResponse)
async def job_match(body: JobMatchRequest) -> dict[str, Any]:
    resume = _resume_or_404(body.resume_id)
    result = match_job(
        resume["profile"], resume["extracted_text"], body.job_title, body.job_description
    )
    if body.use_ai:
        try:
            result = await ai_match(
                resume["profile"], resume["extracted_text"], body.job_title, body.job_description
            )
        except (AIConfigurationError, AIServiceError) as error:
            raise _service_error(error) from error
        except ValueError as error:
            raise _service_error(error) from error
    save_result(
        "matches",
        body.resume_id,
        result,
        job_title=body.job_title,
        job_description=body.job_description,
    )
    return result


@router.post("/interviews/questions", response_model=InterviewQuestionsResponse)
async def get_interview_questions(body: InterviewQuestionsRequest) -> dict[str, Any]:
    resume_text = _resume_or_404(body.resume_id)["extracted_text"] if body.resume_id else ""
    try:
        return await interview_questions(
            body.role, resume_text, body.job_description, body.category
        )
    except (AIConfigurationError, AIServiceError, ValueError) as error:
        raise _service_error(error) from error


@router.post("/interviews/feedback", response_model=InterviewFeedbackResponse)
async def interview_feedback(body: InterviewAnswerRequest) -> dict[str, Any]:
    if body.resume_id:
        _resume_or_404(body.resume_id)
    try:
        result = await evaluate_answer(body.question, body.answer, body.question_type)
    except (AIConfigurationError, AIServiceError, ValueError) as error:
        raise _service_error(error) from error
    save_interview_progress(body.resume_id, result["scores"])
    return result


@router.post("/roadmaps", response_model=RoadmapResponse)
async def roadmap(body: RoadmapRequest) -> dict[str, Any]:
    resume = _resume_or_404(body.resume_id) if body.resume_id else None
    current_skills = body.skills or (
        resume["profile"].get("skills", []) if resume else []
    )
    missing = body.missing_skills
    try:
        result = await generate_roadmap(body.target_role, current_skills, missing)
    except (AIConfigurationError, AIServiceError, ValueError) as error:
        raise _service_error(error) from error
    result["estimated_time_note"] = "Learning-time estimates are approximate and vary by prior experience."
    save_result("roadmaps", body.resume_id, result, target_role=body.target_role)
    save_roadmap_state(result, body.resume_id)
    return result


@router.put("/roadmaps/progress", response_model=RoadmapProgressResponse)
def save_roadmap_progress(body: RoadmapProgressRequest) -> dict[str, Any]:
    if body.resume_id:
        _resume_or_404(body.resume_id)
    if len(str(body.roadmap)) > 30_000:
        raise HTTPException(status_code=413, detail="Roadmap data is too large.")
    save_roadmap_state(body.roadmap, body.resume_id)
    return {"roadmap": body.roadmap, "message": "Roadmap progress saved."}


@router.post("/assistant", response_model=AssistantResponse)
async def assistant(body: ChatRequest) -> dict[str, Any]:
    resume_text = _resume_or_404(body.resume_id)["extracted_text"] if body.resume_id else ""
    try:
        return await career_chat(body.message, resume_text, body.job_description)
    except (AIConfigurationError, AIServiceError, ValueError) as error:
        raise _service_error(error) from error


@router.put("/resumes/{resume_id}/profile", response_model=ProfileUpdateResponse)
def update_resume_profile(
    resume_id: str, profile: ResumeProfileRequest
) -> dict[str, Any]:
    _resume_or_404(resume_id)
    from backend.database import _connect

    profile_data = profile.model_dump()
    with _connect() as db:
        db.execute(
            "UPDATE resumes SET profile_json = ?, extracted_text = ? WHERE id = ?",
            (json.dumps(profile_data), _profile_to_text(profile_data), resume_id),
        )
    return {"id": resume_id, "profile": profile_data}


@router.post("/resumes/{resume_id}/export")
def export_resume(resume_id: str, profile: ResumeProfileRequest) -> Response:
    _resume_or_404(resume_id)
    try:
        pdf = build_resume_pdf(profile.model_dump())
    except Exception as error:
        raise HTTPException(status_code=500, detail="Could not generate the resume PDF.") from error
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="careerforge-resume.pdf"'},
    )
