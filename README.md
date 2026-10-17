# CareerForge AI

CareerForge AI is a local-first career workspace for resume review, job-description comparison, resume editing and PDF export, mock interview practice, learning roadmaps, and career Q&A. The interface is built with React and TypeScript; the API uses FastAPI, SQLite, PyMuPDF, python-docx, and an optional Google Gemini provider.

> **Demo and privacy note:** This project has no authentication. Its SQLite database is local to the backend machine and is intended for a private development/demo environment only. Do not expose it publicly with personal resume data. Uploaded resume text and related records are retained in the local database until deleted in Settings. Gemini-powered actions send the relevant resume, job description, answer, or skill context to Google.

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer and npm
- A Gemini API key for the Gemini-powered workflows (heuristic resume review and job matching work without one)

## Setup

Open two PowerShell terminals from the repository root.

### 1. Backend

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` and set `GEMINI_API_KEY` to your own key. The key is read by the backend and is never included in frontend code. `GEMINI_MODEL` defaults to `gemini-2.5-flash`; change it only to a model enabled for your Google AI Studio project.

Start the API:

```powershell
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API docs are available at <http://localhost:8000/docs>. On startup, the app creates `data\careerforge.db`; this directory and all `.env` files are ignored by Git.

### 2. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:5173>. If the backend runs on another origin, edit `frontend\.env.local` (`VITE_API_URL`) and set the matching origin in backend `CORS_ORIGINS`, then restart both processes.

## Features

- **Resume analyzer:** Accepts PDF and DOCX (8 MB maximum), extracts common resume sections, and provides a transparent local heuristic checklist. Gemini reviews are optional and clearly identified.
- **Job matcher:** Calculates a documented keyword-coverage estimate from the selected resume and pasted job description. Gemini can add evidenced, inferred, and missing-skill insights.
- **Resume builder:** Edits extracted fields, shows a live preview, saves edits locally, prints from the browser, or exports a PDF from the backend.
- **Interview coach:** Generates role-aware question sets and evaluates one submitted answer at a time across relevance, clarity, correctness, communication, and examples. Behavioral answers include STAR guidance; example answers are not claims about the user's experience.
- **Skill roadmap:** Generates a role-oriented plan with topics, practice tasks, project ideas, checkpoints, approximate time estimates, and completion tracking.
- **Career assistant:** Answers questions with document-grounded evidence separated from general guidance.
- **Dashboard and settings:** Counts and activity come from records actually saved in the local database, including reviewed interview answers and roadmap milestones. Settings lets the user delete a resume and its associated analyses, matches, interview scores, and resume-linked roadmap, or delete all workspace records.

Without `GEMINI_API_KEY`, AI-only endpoints return a clear configuration error. Heuristic review and keyword comparison remain available; the app does not display fabricated AI results.

## API overview

All endpoints are under `/api`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | API status and whether Gemini is configured (never returns the key) |
| `GET` | `/dashboard` | Saved resume records, latest results, counts, and activity |
| `POST` | `/resumes/upload` | Parse and store a PDF/DOCX resume |
| `GET` | `/resumes/{resume_id}` | Get a resume's extracted profile |
| `PUT` | `/resumes/{resume_id}/profile` | Save edits to the extracted profile |
| `DELETE` | `/resumes/{resume_id}` | Delete resume and linked records |
| `DELETE` | `/data` | Delete all resumes, results, roadmap progress, and activity |
| `POST` | `/resumes/{resume_id}/analyze` | Run heuristic or Gemini-supported review (`target_role`, `use_ai`) |
| `POST` | `/resumes/{resume_id}/export` | Generate a PDF from the submitted edited profile |
| `POST` | `/jobs/match` | Compare a resume with a job description (`resume_id`, `job_title`, `job_description`, `use_ai`) |
| `POST` | `/interviews/questions` | Generate interview questions by role, context, and question category |
| `POST` | `/interviews/feedback` | Return structured feedback on one interview answer |
| `POST` | `/roadmaps` | Generate a learning roadmap for a target role |
| `PUT` | `/roadmaps/progress` | Persist roadmap completion state |
| `POST` | `/assistant` | Ask a career question with optional resume/job context |

FastAPI's OpenAPI page at `/docs` contains request and response schemas.

## Validation

Run the backend API/service tests from the repository root:

```powershell
python -m unittest discover -s backend\tests -v
```

Check the frontend TypeScript types and production bundle:

```powershell
cd frontend
npm run build
```

## Known limitations

- Resume parsing is text extraction, not OCR. Image-only/scanned PDFs need to be converted to searchable text first.
- Resume and job scores are explanatory heuristics, not actual employer ATS scores or hiring predictions.
- Gemini responses are schema-checked, but users should review AI suggestions and verify every factual claim.
- There is no sign-in, multi-user isolation, cloud deployment configuration, DOCX export, or cross-device sync. Keep the demo on a trusted private machine.
# CareerForge-AI
# CareerForge-AI
