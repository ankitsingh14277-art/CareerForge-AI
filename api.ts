export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) {
        message = body.detail
          .map((entry: { msg?: unknown }) => typeof entry.msg === "string" ? entry.msg : "")
          .filter(Boolean)
          .join("; ") || message;
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function jsonBody(data: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export type Resume = {
  id: string;
  filename: string;
  profile: Record<string, string | string[]>;
  created_at: string;
  original_text?: string;
};

export type DashboardData = {
  counts: { resumes: number; reviews: number; matches: number; roadmaps: number; interview_answers: number };
  resumes: Resume[];
  latest_analysis: Record<string, unknown> | null;
  latest_match: { result: Record<string, unknown>; job_title: string; created_at: string } | null;
  latest_roadmap: Record<string, unknown> | null;
  activity: { kind: string; label: string; created_at: string }[];
};
