from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ResponseModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class ResumeProfile(ResponseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    summary: str = ""
    education: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: str = ""
    projects: str = ""
    certifications: str = ""
    achievements: str = ""


class ResumeResponse(ResponseModel):
    id: str
    filename: str
    profile: ResumeProfile
    created_at: str
    original_text: str | None = None
    privacy_notice: str | None = None


class ResumeSummary(ResponseModel):
    id: str
    filename: str
    profile: ResumeProfile
    created_at: str


class DashboardCounts(ResponseModel):
    resumes: int
    reviews: int
    matches: int
    roadmaps: int
    interview_answers: int


class ActivityResponse(ResponseModel):
    kind: str
    label: str
    created_at: str


class DashboardResponse(ResponseModel):
    counts: DashboardCounts
    resumes: list[ResumeSummary]
    latest_analysis: dict[str, Any] | None
    latest_match: dict[str, Any] | None
    latest_roadmap: dict[str, Any] | None
    activity: list[ActivityResponse]


class HealthResponse(ResponseModel):
    status: str
    ai_configured: bool
    ai_model: str


class DeleteResponse(ResponseModel):
    message: str


class ResumeAnalysisResponse(ResponseModel):
    source: str
    score: int = Field(ge=0, le=100)
    score_label: str
    score_explanation: str
    strengths: list[str]
    suggestions: list[str]
    missing_sections: list[str]
    section_checks: dict[str, bool]
    bullet_rewrites: list[dict[str, Any]]
    disclaimer: str


class JobMatchResponse(ResponseModel):
    job_title: str
    score: int = Field(ge=0, le=100)
    score_label: str
    score_explanation: str
    explicit_matches: list[str]
    missing_keywords: list[str]
    matching_skills: list[Any]
    inferred_skills: list[Any]
    relevant_experience: list[Any]
    recommendations: list[str]
    interview_topics: list[str]
    disclaimer: str


class InterviewQuestionResponse(ResponseModel):
    question: str
    type: str = "general"
    focus: str | None = None


class InterviewQuestionsResponse(ResponseModel):
    questions: list[InterviewQuestionResponse]


class InterviewScoresResponse(ResponseModel):
    relevance: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    correctness: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    examples: int = Field(ge=1, le=5)


class InterviewFeedbackResponse(ResponseModel):
    scores: InterviewScoresResponse
    strengths: list[str]
    improvements: list[str]
    model_answer: str = ""
    star_guidance: list[str] = Field(default_factory=list)


class RoadmapResponse(ResponseModel):
    goal: str = ""
    weeks: list[dict[str, Any]]
    estimated_time_note: str = ""


class RoadmapProgressResponse(ResponseModel):
    roadmap: dict[str, Any]
    message: str


class AssistantResponse(ResponseModel):
    answer: str
    grounded_in_documents: bool
    document_evidence: str
    general_guidance: str


class ProfileUpdateResponse(ResponseModel):
    id: str
    profile: ResumeProfile
