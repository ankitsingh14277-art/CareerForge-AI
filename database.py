import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from backend.config import DATA_DIR, DATABASE_PATH


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    with _connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS resumes (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                extracted_text TEXT NOT NULL,
                original_text TEXT NOT NULL DEFAULT '',
                profile_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
                job_title TEXT NOT NULL,
                job_description TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS roadmaps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resume_id TEXT REFERENCES resumes(id) ON DELETE CASCADE,
                target_role TEXT NOT NULL,
                roadmap_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                label TEXT NOT NULL,
                created_at TEXT NOT NULL,
                resume_id TEXT REFERENCES resumes(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS roadmap_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                resume_id TEXT REFERENCES resumes(id) ON DELETE CASCADE,
                roadmap_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS interview_practice (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resume_id TEXT REFERENCES resumes(id) ON DELETE CASCADE,
                scores_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        activity_columns = {
            row["name"] for row in db.execute("PRAGMA table_info(activities)").fetchall()
        }
        if "resume_id" not in activity_columns:
            db.execute(
                "ALTER TABLE activities ADD COLUMN resume_id TEXT REFERENCES resumes(id) ON DELETE CASCADE"
            )
        resume_columns = {
            row["name"] for row in db.execute("PRAGMA table_info(resumes)").fetchall()
        }
        if "original_text" not in resume_columns:
            db.execute("ALTER TABLE resumes ADD COLUMN original_text TEXT NOT NULL DEFAULT ''")
            db.execute("UPDATE resumes SET original_text = extracted_text WHERE original_text = ''")
        db.execute("PRAGMA foreign_keys = ON")
        db.commit()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_resume(
    resume_id: str, filename: str, extracted_text: str, profile: dict[str, Any]
) -> None:
    with _connect() as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.execute(
            "INSERT INTO resumes (id, filename, extracted_text, original_text, profile_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                resume_id,
                filename,
                extracted_text,
                extracted_text,
                json.dumps(profile),
                now_iso(),
            ),
        )
        record_activity(db, "resume", f"Uploaded {filename}", resume_id)


def get_resume(resume_id: str) -> dict[str, Any] | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, filename, extracted_text, original_text, profile_json, created_at FROM resumes WHERE id = ?",
            (resume_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "filename": row["filename"],
        "extracted_text": row["extracted_text"],
        "original_text": row["original_text"],
        "profile": json.loads(row["profile_json"]),
        "created_at": row["created_at"],
    }


def save_result(
    table: str, resume_id: str | None, result: dict[str, Any], **fields: str
) -> None:
    allowed = {"analyses", "matches", "roadmaps"}
    if table not in allowed:
        raise ValueError("Unsupported result table")
    columns = {
        "analyses": ["resume_id", "result_json", "created_at"],
        "matches": ["resume_id", "job_title", "job_description", "result_json", "created_at"],
        "roadmaps": ["resume_id", "target_role", "roadmap_json", "created_at"],
    }[table]
    values: dict[str, Any] = {
        "resume_id": resume_id,
        "result_json": json.dumps(result),
        "created_at": now_iso(),
        "job_title": fields.get("job_title", ""),
        "job_description": fields.get("job_description", ""),
        "target_role": fields.get("target_role", ""),
        "roadmap_json": json.dumps(result),
    }
    with _connect() as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
            tuple(values[column] for column in columns),
        )
        record_activity(db, table[:-1], {
            "analyses": "Completed resume review",
            "matches": f"Matched resume to {fields.get('job_title') or 'a job description'}",
            "roadmaps": f"Generated a roadmap for {fields.get('target_role') or 'a target role'}",
        }[table], resume_id)


def record_activity(
    db: sqlite3.Connection, kind: str, label: str, resume_id: str | None = None
) -> None:
    db.execute(
        "INSERT INTO activities (kind, label, created_at, resume_id) VALUES (?, ?, ?, ?)",
        (kind, label, now_iso(), resume_id),
    )


def get_dashboard() -> dict[str, Any]:
    with _connect() as db:
        resumes = db.execute(
            "SELECT id, filename, profile_json, created_at FROM resumes ORDER BY created_at DESC"
        ).fetchall()
        analysis = db.execute(
            "SELECT result_json, created_at FROM analyses ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        match = db.execute(
            "SELECT result_json, job_title, created_at FROM matches ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        roadmap = db.execute(
            "SELECT roadmap_json, created_at FROM roadmaps ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        roadmap_state = db.execute(
            "SELECT roadmap_json FROM roadmap_state WHERE id = 1"
        ).fetchone()
        activities = db.execute(
            "SELECT kind, label, created_at FROM activities ORDER BY id DESC LIMIT 8"
        ).fetchall()
        counts = {
            "resumes": len(resumes),
            "reviews": db.execute("SELECT COUNT(*) FROM analyses").fetchone()[0],
            "matches": db.execute("SELECT COUNT(*) FROM matches").fetchone()[0],
            "roadmaps": db.execute("SELECT COUNT(*) FROM roadmaps").fetchone()[0],
            "interview_answers": db.execute("SELECT COUNT(*) FROM interview_practice").fetchone()[0],
        }
    return {
        "counts": counts,
        "resumes": [
            {
                "id": item["id"],
                "filename": item["filename"],
                "profile": json.loads(item["profile_json"]),
                "created_at": item["created_at"],
            }
            for item in resumes
        ],
        "latest_analysis": json.loads(analysis["result_json"]) if analysis else None,
        "latest_match": (
            {
                "result": json.loads(match["result_json"]),
                "job_title": match["job_title"],
                "created_at": match["created_at"],
            }
            if match
            else None
        ),
        "latest_roadmap": (
            json.loads(roadmap_state["roadmap_json"])
            if roadmap_state
            else json.loads(roadmap["roadmap_json"]) if roadmap else None
        ),
        "activity": [dict(item) for item in activities],
    }


def save_roadmap_state(roadmap: dict[str, Any], resume_id: str | None = None) -> None:
    with _connect() as db:
        db.execute("PRAGMA foreign_keys = ON")
        if resume_id:
            db.execute(
                "INSERT INTO roadmap_state (id, resume_id, roadmap_json, updated_at) "
                "VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                "resume_id = excluded.resume_id, roadmap_json = excluded.roadmap_json, "
                "updated_at = excluded.updated_at",
                (resume_id, json.dumps(roadmap), now_iso()),
            )
        else:
            db.execute(
                "INSERT INTO roadmap_state (id, resume_id, roadmap_json, updated_at) "
                "VALUES (1, NULL, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                "resume_id = NULL, roadmap_json = excluded.roadmap_json, "
                "updated_at = excluded.updated_at",
                (json.dumps(roadmap), now_iso()),
            )


def save_interview_progress(
    resume_id: str | None, scores: dict[str, int]
) -> None:
    with _connect() as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.execute(
            "INSERT INTO interview_practice (resume_id, scores_json, created_at) "
            "VALUES (?, ?, ?)",
            (resume_id, json.dumps(scores), now_iso()),
        )
        record_activity(
            db, "interview", "Completed a mock interview answer", resume_id
        )


def delete_resume(resume_id: str) -> bool:
    with _connect() as db:
        db.execute("PRAGMA foreign_keys = ON")
        result = db.execute("DELETE FROM resumes WHERE id = ?", (resume_id,))
        if result.rowcount:
            record_activity(db, "privacy", "Deleted resume and associated career records")
            return True
        return False


def delete_all_data() -> None:
    with _connect() as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.execute("DELETE FROM interview_practice")
        db.execute("DELETE FROM roadmaps")
        db.execute("DELETE FROM matches")
        db.execute("DELETE FROM analyses")
        db.execute("DELETE FROM roadmap_state")
        db.execute("DELETE FROM resumes")
        db.execute("DELETE FROM activities")
