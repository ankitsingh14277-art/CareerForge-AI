import os
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / "backend" / ".env")
DATA_DIR = Path(os.getenv("CAREERFORGE_DATA_DIR", ROOT_DIR / "data"))
if not DATA_DIR.is_absolute():
    DATA_DIR = ROOT_DIR / DATA_DIR
DATABASE_PATH = DATA_DIR / "careerforge.db"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
