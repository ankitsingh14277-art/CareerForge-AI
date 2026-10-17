import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import CORS_ORIGINS
from backend.database import initialize_database
from backend.routes.api import router


logger = logging.getLogger("careerforge.api")
app = FastAPI(
    title="CareerForge AI API",
    version="1.0.0",
    description="Resume parsing, career analysis, job matching, interview preparation, and roadmaps.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, error: Exception) -> JSONResponse:
    logger.error("Unhandled request failure (%s)", type(error).__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )


app.include_router(router)
