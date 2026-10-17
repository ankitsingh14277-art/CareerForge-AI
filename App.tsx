import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3,
  BriefcaseBusiness, Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardCheck,
  CloudUpload, FileText, Gauge, Github, GraduationCap, HeartHandshake, LayoutDashboard,
  LoaderCircle, LockKeyhole, Menu, MessageCircle, MoreHorizontal, Pencil, Plus, Send,
  Settings, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, Upload, WandSparkles,
  X, Zap,
} from "lucide-react";
import { api, API_URL, DashboardData, jsonBody, Resume } from "./api";

type PageKey = "Dashboard" | "Resume Analyzer" | "Job Matcher" | "Resume Builder" | "Interview Coach" | "Skill Roadmap" | "Career Assistant" | "Settings";
type Alert = { kind: "error" | "success" | "info"; message: string } | null;
type Result = Record<string, unknown>;

const nav: { label: PageKey; icon: typeof LayoutDashboard; group: string }[] = [
  { label: "Dashboard", icon: LayoutDashboard, group: "Workspace" },
  { label: "Resume Analyzer", icon: FileText, group: "Workspace" },
  { label: "Job Matcher", icon: Target, group: "Workspace" },
  { label: "Resume Builder", icon: Pencil, group: "Workspace" },
  { label: "Interview Coach", icon: MessageCircle, group: "Practice" },
  { label: "Skill Roadmap", icon: GraduationCap, group: "Practice" },
  { label: "Career Assistant", icon: Sparkles, group: "Practice" },
];

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

function App() {
  const [page, setPage] = useState<PageKey>("Dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [alert, setAlert] = useState<Alert>(null);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<Resume | null>(null);
  const [jobText, setJobText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [savedRoadmap, setSavedRoadmap] = useState<Result | null>(() => {
    try { return JSON.parse(localStorage.getItem("careerforge-roadmap") ?? "null") as Result | null; }
    catch { return null; }
  });

  const refreshDashboard = async () => {
    try {
      const data = await api<DashboardData>("/dashboard");
      setDashboard(data);
      if (!resume && data.resumes[0]) setResume(data.resumes[0]);
    } catch (error) {
      setAlert({ kind: "error", message: error instanceof Error ? error.message : "Could not load dashboard." });
    }
  };
  useEffect(() => {
    void refreshDashboard();
    void api<{ ai_configured: boolean }>("/health").then((health) => setAiReady(health.ai_configured)).catch(() => setAiReady(null));
  }, []);
  useEffect(() => {
    const onUpdated = (event: Event) => setResume((event as CustomEvent<Resume>).detail);
    const onDeleted = (event: Event) => {
      const deletedId = (event as CustomEvent<string>).detail;
      setResume((current) => current?.id === deletedId ? null : current);
      setSavedRoadmap(null);
    };
    const onAllDataDeleted = () => { setJobText(""); setJobTitle(""); };
    window.addEventListener("careerforge-resume-updated", onUpdated);
    window.addEventListener("careerforge-resume-deleted", onDeleted);
    window.addEventListener("careerforge-all-data-deleted", onAllDataDeleted);
    return () => {
      window.removeEventListener("careerforge-resume-updated", onUpdated);
      window.removeEventListener("careerforge-resume-deleted", onDeleted);
      window.removeEventListener("careerforge-all-data-deleted", onAllDataDeleted);
    };
  }, []);

  const run = async <T,>(work: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true);
    setAlert(null);
    try {
      const result = await work();
      if (success) setAlert({ kind: "success", message: success });
      await refreshDashboard();
      return result;
    } catch (error) {
      setAlert({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong. Please try again." });
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const chooseResume = (selected: Resume) => {
    setResume(selected);
    setAlert({ kind: "info", message: `${selected.filename} is selected for your career tools.` });
  };

  const content = useMemo(() => {
    const common = { dashboard, resume, chooseResume, busy, run, setPage, setAlert, jobText, jobTitle, setJobText, setJobTitle, savedRoadmap, setSavedRoadmap };
    switch (page) {
      case "Dashboard": return <Dashboard {...common} aiReady={aiReady} />;
      case "Resume Analyzer": return <ResumeAnalyzer {...common} setResume={setResume} />;
      case "Job Matcher": return <JobMatcher {...common} />;
      case "Resume Builder": return <ResumeBuilder {...common} />;
      case "Interview Coach": return <InterviewCoach {...common} />;
      case "Skill Roadmap": return <SkillRoadmap {...common} />;
      case "Career Assistant": return <CareerAssistant {...common} />;
      case "Settings": return <SettingsPage {...common} aiReady={aiReady} refresh={refreshDashboard} />;
    }
  }, [page, dashboard, resume, busy, jobText, jobTitle, savedRoadmap, aiReady, run, refreshDashboard]);

  const setPageAndClose = (next: PageKey) => { setPage(next); setMobileNav(false); };
  const groups = ["Workspace", "Practice"];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <button type="button" className="brand" onClick={() => setPageAndClose("Dashboard")}><div className="brand-mark"><Sparkles size={18} /></div><span>careerforge<span className="brand-ai">.ai</span></span></button>
        <button type="button" className="workspace-switch" onClick={() => setPageAndClose("Settings")}><div className="workspace-avatar">C</div><div className="workspace-copy"><strong>Career workspace</strong><span>Personal</span></div><ChevronDown size={15} /></button>
        <nav className="side-nav" aria-label="Main navigation">
          {groups.map((group) => <div key={group}>
            <div className="nav-label">{group}</div>
            {nav.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
              <button className={`nav-item ${page === label ? "active" : ""}`} key={label} onClick={() => setPageAndClose(label)}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                {label === "Resume Analyzer" && resume && <span className="nav-dot" />}
              </button>
            ))}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Zap size={16} /></div><strong>Your next opportunity starts here</strong><p>Keep building momentum. Small improvements add up.</p><button onClick={() => setPageAndClose("Skill Roadmap")}>Explore your roadmap <ArrowRight size={14} /></button></div>
          <button className={`nav-item ${page === "Settings" ? "active" : ""}`} onClick={() => setPageAndClose("Settings")}><Settings size={17} /><span>Settings</span></button>
          <div className="profile-mini"><div className="profile-avatar">{resume?.profile.name?.toString().charAt(0).toUpperCase() || "Y"}</div><div><strong>{resume?.profile.name || "Your workspace"}</strong><span>Local account</span></div><button type="button" className="profile-more" title="Settings" onClick={() => setPageAndClose("Settings")}><MoreHorizontal size={17} /></button></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav((value) => !value)} aria-label="Toggle navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Career workspace</span><span className="crumb-divider">/</span><strong>{page}</strong></div>
          <div className="top-actions">          <div className={`ai-status ${aiReady ? "online" : "offline"}`}><span />{aiReady === null ? "Checking AI" : aiReady ? "AI configured" : "AI not configured"}</div><button className="icon-button help-button" title="Help" onClick={() => setPage("Career Assistant")}><CircleHelp size={18} /></button><button className="top-avatar" title="Settings" onClick={() => setPage("Settings")}>{resume?.profile.name?.toString().charAt(0).toUpperCase() || "Y"}</button></div>
        </header>
        {alert && <div className={`global-alert ${alert.kind}`} role="status"><span>{alert.message}</span><button aria-label="Dismiss" onClick={() => setAlert(null)}><X size={15} /></button></div>}
        <div className="page-content">{content}</div>
        <footer className="app-footer"><span>CareerForge AI <span className="footer-dot">·</span> Career growth, thoughtfully built.</span><span><ShieldCheck size={13} /> Your documents stay in your local app database</span></footer>
      </main>
    </div>
  );
}

type CommonProps = {
  dashboard: DashboardData | null; resume: Resume | null; chooseResume: (resume: Resume) => void;
  busy: boolean; run: <T,>(work: () => Promise<T>, success?: string) => Promise<T | undefined>;
  setPage: (page: PageKey) => void; setAlert: (alert: Alert) => void;
  jobText: string; jobTitle: string; setJobText: (value: string) => void; setJobTitle: (value: string) => void;
  savedRoadmap: Result | null; setSavedRoadmap: (roadmap: Result | null) => void;
};
type PageProps = CommonProps & { setResume?: (resume: Resume) => void };

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function PanelTitle({ icon: Icon, title, subtitle, action }: { icon: typeof Activity; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="panel-title"><div className="panel-title-icon"><Icon size={17} /></div><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="panel-title-action">{action}</div>}</div>;
}
function Button({ children, onClick, variant = "primary", disabled = false, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet"; disabled?: boolean; type?: "button" | "submit" }) {
  return <button type={type} className={`button button-${variant}`} disabled={disabled} onClick={onClick}>{children}</button>;
}
function LoadingButton({ children, busy, onClick }: { children: ReactNode; busy: boolean; onClick: () => void }) {
  return <Button onClick={onClick} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} /> Working…</> : children}</Button>;
}
function StatCard({ label, value, hint, icon: Icon, color }: { label: string; value: number | string; hint: string; icon: typeof FileText; color: string }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={18} /></div><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-hint">{hint}</span></div>;
}
function EmptyState({ icon: Icon, title, description, action }: { icon: typeof FileText; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{description}</p>{action}</div>;
}
function Dashboard({ dashboard, resume, setPage, aiReady, savedRoadmap }: CommonProps & { aiReady: boolean | null }) {
  const counts = dashboard?.counts;
  const latestAnalysis = dashboard?.latest_analysis;
  const latestMatch = dashboard?.latest_match;
  const roadmap = savedRoadmap ?? dashboard?.latest_roadmap ?? null;
  const weeks = Array.isArray(roadmap?.weeks) ? roadmap.weeks as Result[] : [];
  const done = weeks.filter((week) => week.completed).length;
  return <>
    <PageHeading eyebrow="Your career command center" title={`${greeting()}${resume?.profile.name ? `, ${String(resume.profile.name).split(" ")[0]}` : ""}`} subtitle="A focused space to make your next career move with confidence." action={<Button onClick={() => setPage("Resume Analyzer")}><Plus size={16} /> Add your resume</Button>} />
    <div className="welcome-banner"><div className="welcome-art"><div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" /><div className="welcome-spark"><Sparkles size={23} /></div></div><div className="welcome-copy"><span className="banner-kicker">YOUR CAREER, IN FOCUS</span><h2>Build a Stronger Resume.<br /><em>Prepare Smarter. Get Career Ready.</em></h2><p>Review your resume, explore a role, and turn your goals into a plan.</p><button className="text-link light-link" onClick={() => setPage(resume ? "Job Matcher" : "Resume Analyzer")}>{resume ? "Explore job matching" : "Start with your resume"} <ArrowRight size={15} /></button></div><div className="banner-stats"><div><strong>{counts?.reviews ?? "—"}</strong><span>resume reviews</span></div><div><strong>{counts?.matches ?? "—"}</strong><span>role comparisons</span></div><div><strong>{counts?.roadmaps ?? "—"}</strong><span>roadmaps made</span></div></div></div>
    <div className="section-row"><div><h2>Your progress</h2><p>Real activity from your workspace</p></div><span className="muted-chip"><Activity size={13} /> Live workspace data</span></div>
    <div className="stats-grid">
      <StatCard label="Resume reviews" value={counts?.reviews ?? "—"} hint={latestAnalysis ? `Latest score: ${String(latestAnalysis.score)} / 100` : dashboard ? "No reviews yet" : "Workspace unavailable"} icon={ClipboardCheck} color="indigo" />
      <StatCard label="Role matches" value={counts?.matches ?? "—"} hint={latestMatch ? `${String(latestMatch.result.score ?? "—")}% · ${latestMatch.job_title}` : dashboard ? "Compare your first role" : "Workspace unavailable"} icon={Target} color="blue" />
      <StatCard label="Interview practices" value={counts?.interview_answers ?? "—"} hint={dashboard ? "Answers reviewed" : "Workspace unavailable"} icon={MessageCircle} color="indigo" />
      <StatCard label="Roadmap progress" value={weeks.length ? `${done}/${weeks.length}` : dashboard ? "—" : "—"} hint={weeks.length ? "Milestones complete" : dashboard ? "No roadmap yet" : "Workspace unavailable"} icon={TrendingUp} color="green" />
      <StatCard label="Resume on file" value={counts?.resumes ?? "—"} hint={resume?.filename ?? (dashboard ? "Upload a PDF or DOCX" : "Workspace unavailable")} icon={FileText} color="amber" />
    </div>
    <section className="panel skill-insights"><PanelTitle icon={Target} title="Skills in focus" subtitle={latestMatch ? `From your latest comparison with ${latestMatch.job_title}` : "Skills grounded in a resume-to-role comparison"} />{latestMatch ? <div className="skill-insight-grid"><SkillInsight title="Already evidenced" skills={Array.isArray(latestMatch.result.matching_skills) ? latestMatch.result.matching_skills as unknown[] : []} positive /><SkillInsight title="To explore or substantiate" skills={Array.isArray(latestMatch.result.missing_keywords) ? latestMatch.result.missing_keywords as unknown[] : Array.isArray(latestMatch.result.missing_skills) ? latestMatch.result.missing_skills as unknown[] : []} positive={false} /></div> : <p className="small-note">Compare your resume with a job description to see demonstrated skills and potential gaps.</p>}</section>
    <div className="dashboard-columns">
      <section className="panel progress-panel"><PanelTitle icon={BarChart3} title="Career readiness" subtitle="A snapshot based on work you've done here" /><div className="readiness-content">{counts?.resumes ? <><div className="readiness-ring" style={{ "--progress": `${Math.min(100, (counts.reviews * 20 + counts.matches * 20 + done * 10))}%` } as React.CSSProperties}><div><strong>{Math.min(100, counts.reviews * 20 + counts.matches * 20 + done * 10)}%</strong><span>activity</span></div></div><div className="readiness-copy"><h4>Every step builds momentum</h4><p>This indicator reflects completed workspace activities—not your employability or hiring outcome.</p><ul><li><CheckCircle2 size={15} className={counts.reviews ? "check-active" : ""} /> Review a resume</li><li><CheckCircle2 size={15} className={counts.matches ? "check-active" : ""} /> Compare a target role</li><li><CheckCircle2 size={15} className={done ? "check-active" : ""} /> Complete a learning milestone</li></ul></div></> : dashboard ? <EmptyState icon={Gauge} title="Your journey starts here" description="Upload a resume to see a personalized workspace snapshot." action={<Button variant="secondary" onClick={() => setPage("Resume Analyzer")}>Upload a resume <ArrowRight size={15} /></Button>} /> : <EmptyState icon={Gauge} title="Workspace data unavailable" description="Reconnect the backend to load your saved career records." />}</div></section>
      <section className="panel"><PanelTitle icon={Activity} title="Recent activity" subtitle="What you've worked on recently" /><div className="activity-list">{dashboard?.activity.length ? dashboard.activity.slice(0, 5).map((item, index) => <div className="activity-item" key={`${item.created_at}-${index}`}><div className={`activity-icon activity-${item.kind}`}><Activity size={14} /></div><div><strong>{item.label}</strong><span>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div></div>) : <EmptyState icon={Activity} title={dashboard ? "No activity yet" : "Workspace data unavailable"} description={dashboard ? "Your work will show up here as you use CareerForge." : "Reconnect the backend to load your saved career records."} />}</div></section>
    </div>
    <section className="panel next-steps"><PanelTitle icon={Zap} title="A simple path forward" subtitle="Add your resume, explore a target role, then practice and build the skills you need" /><div className="next-step-grid"><NextStep icon={FileText} title="1. Review your resume" text="Get a practical, transparent review of your experience." onClick={() => setPage("Resume Analyzer")} /><NextStep icon={BriefcaseBusiness} title="2. Explore a role" text="Compare your resume with a job description." onClick={() => setPage("Job Matcher")} /><NextStep icon={HeartHandshake} title="3. Prepare your next step" text="Practice for an interview or build a learning roadmap." onClick={() => setPage("Interview Coach")} /></div></section>
    <div className="privacy-note"><LockKeyhole size={15} /><span>Resume text is stored in your local app database. Delete it anytime in Settings. AI features send relevant content to Google Gemini.</span><button className="text-link" onClick={() => setPage("Settings")}>Privacy settings <ArrowUpRight size={13} /></button></div>
    {aiReady === false && <div className="setup-nudge"><Sparkles size={16} /><span>Gemini AI is not configured. Heuristic resume review and job matching work now; add your API key in <strong>backend/.env</strong> to enable tailored AI tools.</span></div>}
  </>;
}
function NextStep({ icon: Icon, title, text, onClick }: { icon: typeof FileText; title: string; text: string; onClick: () => void }) {
  return <button className="next-step" onClick={onClick}><div className="next-icon"><Icon size={18} /></div><div><strong>{title}</strong><p>{text}</p></div><ArrowRight size={16} /></button>;
}
function SkillInsight({ title, skills, positive }: { title: string; skills: unknown[]; positive: boolean }) {
  return <div className="skill-insight"><strong>{title}</strong>{skills.length ? <div className="skill-tags">{skills.slice(0, 12).map((skill, index) => <span className={`skill-tag ${positive ? "" : "skill-gap"}`} key={`${String(skill)}-${index}`}>{String(skill)}</span>)}</div> : <span className="small-note">{positive ? "No direct skill matches detected yet." : "No missing keywords to highlight."}</span>}</div>;
}

function ResumeAnalyzer({ resume, dashboard, busy, run, setResume, setAlert, setPage }: PageProps) {
  const [result, setResult] = useState<Result | null>(null);
  const [role, setRole] = useState("");
  const [dragging, setDragging] = useState(false);
  const upload = async (file: File) => {
    const form = new FormData(); form.append("file", file);
    const created = await run(() => api<Resume>("/resumes/upload", { method: "POST", body: form }), "Resume uploaded and parsed. Review the extracted details before using AI.");
    if (created) { setResume?.(created); setResult(null); }
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void upload(file); };
  const analyze = async (useAi: boolean) => {
    if (!resume) { setAlert({ kind: "error", message: "Upload a resume first." }); return; }
    const data = await run(() => api<Result>(`/resumes/${resume.id}/analyze`, jsonBody({ target_role: role, use_ai: useAi })), useAi ? "AI resume review completed." : "Heuristic resume review completed.");
    if (data) setResult(data);
  };
  const current = result;
  return <>
    <PageHeading eyebrow="Understand your story" title="Resume analyzer" subtitle="A grounded review of what's clear, what's missing, and how to make your experience easier to see." />
    <div className="analyzer-layout">
      <div className="analyzer-main">
        <section className="panel upload-panel"><PanelTitle icon={CloudUpload} title={resume ? "Your resume" : "Start with your resume"} subtitle="PDF or DOCX · Maximum 8 MB" />
          <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <input id="resume-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFile} />
            <div className="upload-icon"><Upload size={20} /></div><strong>{resume ? resume.filename : "Drop your resume here"}</strong><span>{resume ? "Upload a new version to replace this selection" : "or click to browse your files"}</span><label htmlFor="resume-file" className="button button-secondary">Choose file</label>
          </div>
          {resume && <div className="resume-file-row"><div className="file-type-icon"><FileText size={18} /></div><div><strong>{resume.filename}</strong><span>Parsed {new Date(resume.created_at).toLocaleDateString()}</span></div><span className="file-state"><Check size={14} /> Ready</span></div>}
          <div className="privacy-inline"><LockKeyhole size={14} /> Resume text is stored locally. Gemini receives resume content only when you choose AI review.</div>
        </section>
        <section className="panel review-panel"><PanelTitle icon={WandSparkles} title="Resume review" subtitle="Choose an evidence-based review method" />
          <label className="field-label" htmlFor="target-role">Target role <span>optional, for focused suggestions</span></label><input id="target-role" className="text-input" value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Junior frontend developer" />
          <div className="review-actions"><LoadingButton busy={busy} onClick={() => void analyze(false)}><Gauge size={16} /> Run transparent checklist</LoadingButton><LoadingButton busy={busy} onClick={() => void analyze(true)}><Sparkles size={16} /> Get Gemini review</LoadingButton></div>
          {current && <ReviewResults result={current} />}
        </section>
        {resume && <section className="panel"><PanelTitle icon={ClipboardCheck} title="Extracted content" subtitle="Parsing is a best-effort starting point. Correct anything that's inaccurate in the builder." action={<Button variant="quiet" onClick={() => setPage("Resume Builder")}><Pencil size={14} /> Edit profile</Button>} /><ProfileSummary profile={resume.profile} /></section>}
      </div>
      <div className="analyzer-aside">
        <section className="panel guidance-panel"><div className="guidance-icon"><ShieldCheck size={18} /></div><h3>Truthful by design</h3><p>Recommendations should reflect your real work. Review every suggested edit and only use claims you can support.</p></section>
        <section className="panel"><PanelTitle icon={CheckCircle2} title="What we look for" /><ul className="checklist"><li><CheckCircle2 size={15} /> Section completeness</li><li><CheckCircle2 size={15} /> Skills and keywords</li><li><CheckCircle2 size={15} /> Measurable outcomes</li><li><CheckCircle2 size={15} /> Readability and structure</li></ul><p className="small-note">Our review score is heuristic—not an employer ATS score or hiring prediction.</p></section>
        {dashboard?.latest_analysis && !current && <div className="last-result-chip"><ClipboardCheck size={15} /><span>Previous review is on your dashboard</span></div>}
      </div>
    </div>
  </>;
}

function ProfileSummary({ profile }: { profile: Record<string, string | string[]> }) {
  const sections = [["summary", "Summary"], ["education", "Education"], ["experience", "Experience"], ["projects", "Projects"], ["skills", "Skills"], ["certifications", "Certifications"], ["achievements", "Achievements"]];
  return <div className="profile-summary">{sections.map(([key, title]) => <div key={key}><span>{title}</span><p>{Array.isArray(profile[key]) ? profile[key].join(", ") : profile[key] || "Not detected"}</p></div>)}</div>;
}
function ReviewResults({ result }: { result: Result }) {
  const items = (key: string) => Array.isArray(result[key]) ? result[key] as unknown[] : [];
  const checks = typeof result.section_checks === "object" && result.section_checks ? Object.entries(result.section_checks as Record<string, boolean>) : [];
  return <div className="result-block"><div className="score-summary"><div className="score-ring" style={{ "--progress": `${Number(result.score ?? 0)}%` } as React.CSSProperties}><div><strong>{String(result.score ?? 0)}</strong><span>/ 100</span></div></div><div><span className="result-label">{String(result.score_label ?? "Review score")}</span><p>{String(result.score_explanation ?? "This score reflects document evidence, not hiring probability.")}</p><span className="source-label"><Sparkles size={12} /> {result.source === "gemini" ? "Gemini-supported feedback" : "Local heuristic review"}</span></div></div>
    {checks.length > 0 && <div className="checks-wrap">{checks.map(([name, ok]) => <span className={`check-tag ${ok ? "passed" : ""}`} key={name}>{ok ? <Check size={12} /> : <X size={12} />}{name}</span>)}</div>}
    <ResultList title="What's working" items={items(result.source === "gemini" ? "ai_strengths" : "strengths")} positive />
    <ResultList title="Opportunities to improve" items={items(result.source === "gemini" ? "ai_suggestions" : "suggestions")} />
    {items("bullet_rewrites").length > 0 && <div className="result-list"><h4>Optional bullet drafts — verify every detail</h4>{items("bullet_rewrites").map((item, i) => { const rewrite = item as Result; return <div className="rewrite-card" key={i}><span>Original</span><p>{String(rewrite.original)}</p><span>Suggested draft</span><p>{String(rewrite.suggested)}</p></div>; })}</div>}
  </div>;
}
function ResultList({ title, items, positive = false }: { title: string; items: unknown[]; positive?: boolean }) {
  return <div className="result-list"><h4>{title}</h4>{items.length ? <ul>{items.map((item, i) => <li key={i}><span className={positive ? "result-bullet positive" : "result-bullet"}>{positive ? <Check size={12} /> : <ArrowRight size={12} />}</span><span>{typeof item === "string" ? item : JSON.stringify(item)}</span></li>)}</ul> : <p className="small-note">Run a review to see specific feedback here.</p>}</div>;
}

function JobMatcher({ resume, busy, run, jobTitle, setJobTitle, jobText, setJobText, setAlert, setPage }: CommonProps) {
  const [result, setResult] = useState<Result | null>(null);
  const match = async (useAi: boolean) => {
    if (!resume) { setAlert({ kind: "error", message: "Upload a resume before comparing a role." }); return; }
    const data = await run(() => api<Result>("/jobs/match", jsonBody({ resume_id: resume.id, job_title: jobTitle, job_description: jobText, use_ai: useAi })), useAi ? "AI-assisted role comparison completed." : "Heuristic keyword comparison completed.");
    if (data) setResult(data);
  };
  const list = (key: string) => Array.isArray(result?.[key]) ? result[key] as unknown[] : [];
  return <>
    <PageHeading eyebrow="Find the overlap" title="Job matcher" subtitle="Compare the language and requirements in a job description with your resume. No score can predict a hiring outcome." />
    <div className="matcher-grid">
      <section className="panel"><PanelTitle icon={BriefcaseBusiness} title="Target opportunity" subtitle="Paste the role details you'd like to explore" />
        <label className="field-label" htmlFor="job-title">Role title</label><input id="job-title" className="text-input" placeholder="e.g. Product analyst" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
        <label className="field-label gap-top" htmlFor="job-description">Job description <span>at least 50 characters</span></label><textarea id="job-description" className="text-area job-description" placeholder="Paste the responsibilities and qualifications from the job posting…" value={jobText} onChange={(event) => setJobText(event.target.value)} maxLength={12000} /><div className="char-count">{jobText.length.toLocaleString()} / 12,000</div>
        <div className="privacy-inline"><LockKeyhole size={14} /> With Gemini enabled, your resume and pasted job description are sent to Google for this comparison.</div>
        <div className="review-actions"><LoadingButton busy={busy} onClick={() => void match(false)}><Target size={16} /> Compare keywords</LoadingButton><LoadingButton busy={busy} onClick={() => void match(true)}><Sparkles size={16} /> Add AI insights</LoadingButton></div>
        {!resume && <div className="inline-blank"><FileText size={16} /> <span>Upload a resume to get started.</span><button className="text-link" onClick={() => setPage("Resume Analyzer")}>Go to analyzer <ArrowRight size={13} /></button></div>}
      </section>
      <section className="panel match-result-panel"><PanelTitle icon={BarChart3} title="Comparison" subtitle={result ? String(result.job_title ?? "Role overview") : "Your results will appear here"} />
        {result ? <><div className="match-score-row"><div className="score-ring large" style={{ "--progress": `${Number(result.score ?? 0)}%` } as React.CSSProperties}><div><strong>{String(result.score ?? 0)}%</strong><span>coverage</span></div></div><div><span className="result-label">{String(result.score_label ?? "Keyword coverage estimate")}</span><p>{String(result.score_explanation ?? "")}</p></div></div>
          {Array.isArray(result.matching_skills) && <div className="result-list"><h4>Skills listed on your resume</h4><div className="skill-tags">{list("matching_skills").map((skill, i) => <span className="skill-tag" key={i}>{String(skill)}</span>)}</div></div>}
          <ResultList title="Terms found in both" items={list("explicit_matches")} positive />
          <ResultList title="Terms to explore" items={list("missing_keywords").length ? list("missing_keywords") : list("missing_skills")} />
          <ResultList title="Suggested next steps" items={list("recommendations")} />
          <ResultList title="Topics to prepare" items={list("interview_topics")} />
          {list("inferred_skills").length > 0 && <div className="privacy-inline"><Sparkles size={14} /> AI-inferred skills are suggestions, not verified qualifications: {list("inferred_skills").join(", ")}</div>}
          <p className="small-note">{String(result.disclaimer ?? "Keyword overlap does not predict hiring outcomes.")}</p>
        </> : <EmptyState icon={Target} title="A clearer view of your fit" description="Add a job description and select a resume to see evidenced overlap and skill gaps." />}
      </section>
    </div>
  </>;
}

const editFields = [
  { key: "name", label: "Name", multiline: false }, { key: "email", label: "Email", multiline: false }, { key: "phone", label: "Phone", multiline: false },
  { key: "summary", label: "Professional summary", multiline: true }, { key: "education", label: "Education", multiline: true },
  { key: "skills", label: "Skills (separate with commas)", multiline: true }, { key: "experience", label: "Experience", multiline: true },
  { key: "projects", label: "Projects", multiline: true }, { key: "certifications", label: "Certifications", multiline: true }, { key: "achievements", label: "Achievements", multiline: true },
];
function ResumeBuilder({ resume, run, busy, setAlert, setPage }: CommonProps) {
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [originalText, setOriginalText] = useState("");
  useEffect(() => {
    if (!resume) { setOriginalText(""); return; }
    setProfile(Object.fromEntries(editFields.map(({ key }) => [key, Array.isArray(resume.profile[key]) ? (resume.profile[key] as string[]).join(", ") : String(resume.profile[key] ?? "")])));
    if (resume.original_text !== undefined) setOriginalText(resume.original_text);
    else void api<Resume>(`/resumes/${resume.id}`).then((detail) => setOriginalText(detail.original_text ?? "")).catch((error: unknown) => {
      setAlert({ kind: "error", message: error instanceof Error ? error.message : "Could not load the original resume text." });
    });
  }, [resume, setAlert]);
  const update = (key: string, value: string) => setProfile((previous) => ({ ...previous, [key]: value }));
  const save = async () => {
    if (!resume) { setAlert({ kind: "error", message: "Upload a resume before editing its content." }); return; }
    const result = await run(() => api<{ profile: Record<string, string | string[]> }>(`/resumes/${resume.id}/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, skills: profile.skills.split(",").map((skill) => skill.trim()).filter(Boolean) }) }), "Your resume edits were saved.");
    if (result) window.dispatchEvent(new CustomEvent("careerforge-resume-updated", { detail: { ...resume, profile: result.profile } }));
  };
  const download = async () => {
    if (!resume) { setAlert({ kind: "error", message: "Upload or create a resume before exporting." }); return; }
    const result = await run(async () => {
      const response = await fetch(`${API_URL}/resumes/${resume.id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, skills: profile.skills.split(",").map((item) => item.trim()).filter(Boolean) }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "Could not export PDF."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "careerforge-resume.pdf"; link.click(); URL.revokeObjectURL(url);
      return true;
    }, "Your resume PDF was exported.");
    if (!result) return;
  };
  return <>
    <PageHeading eyebrow="Shape your story" title="Resume builder" subtitle="Review and edit extracted information, then export a clean PDF. You stay in control of every change." action={<LoadingButton busy={busy} onClick={() => void download()}><ArrowDownToLine size={16} /> Export PDF</LoadingButton>} />
    {!resume ? <section className="panel"><EmptyState icon={FileText} title="Start with your own experience" description="Upload a resume first, then edit your profile and preview the result here." action={<Button onClick={() => setPage("Resume Analyzer")}>Upload resume <ArrowRight size={15} /></Button>} /></section> :
      <div className="builder-layout"><div className="builder-edit-column"><section className="panel builder-form"><PanelTitle icon={Pencil} title="Your content" subtitle="Edit details before saving or exporting" />
        <div className="editor-grid">{editFields.map(({ key, label, multiline }) => <label className={`editor-field ${multiline ? "wide" : ""}`} key={key}>{label}{multiline ? <textarea value={profile[key] ?? ""} onChange={(event) => update(key, event.target.value)} rows={key === "summary" ? 4 : 5} /> : <input value={profile[key] ?? ""} onChange={(event) => update(key, event.target.value)} />}</label>)}</div>
        <div className="builder-actions"><LoadingButton busy={busy} onClick={() => void save()}><Check size={16} /> Save edits</LoadingButton><Button variant="secondary" onClick={() => window.print()}><ArrowDownToLine size={15} /> Print preview</Button></div>
      </section><details className="panel original-content"><summary><FileText size={14} /> View original extracted text</summary><pre>{originalText || "Loading original text…"}</pre></details></div><section className="panel paper-preview"><div className="preview-label"><span>LIVE PREVIEW</span><span className="preview-dots">•••</span></div><div className="resume-paper"><h2>{profile.name || "Your Name"}</h2><p className="paper-contact">{[profile.email, profile.phone].filter(Boolean).join(" · ") || "Contact information"}</p><div className="paper-line" />{editFields.slice(3).map(({ key, label }) => profile[key] && <section key={key}><h3>{label}</h3><p>{profile[key]}</p></section>)}</div></section></div>}
    <div className="privacy-inline builder-privacy"><ShieldCheck size={15} /> Generated wording is not automatically added. Keep every statement accurate and supportable.</div>
  </>;
}

function InterviewCoach({ resume, busy, run, jobTitle, jobText }: CommonProps) {
  const [category, setCategory] = useState("mixed");
  const [questions, setQuestions] = useState<{ question: string; type: string; focus?: string }[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Result | null>(null);
  const getQuestions = async () => {
    const data = await run(() => api<{ questions: typeof questions }>("/interviews/questions", jsonBody({ role: jobTitle, resume_id: resume?.id ?? null, job_description: jobText, category })), "Your tailored practice set is ready.");
    if (data) { setQuestions(data.questions); setIndex(0); setAnswer(""); setFeedback(null); }
  };
  const submitAnswer = async () => {
    if (!questions[index] || !answer.trim()) return;
    const data = await run(() => api<Result>("/interviews/feedback", jsonBody({ question: questions[index].question, answer, question_type: questions[index].type, resume_id: resume?.id ?? null })), "Feedback is ready. Use it as practice guidance, not a hiring score.");
    if (data) setFeedback(data);
  };
  const scores = feedback?.scores && typeof feedback.scores === "object" ? feedback.scores as Record<string, number> : null;
  const strengths = Array.isArray(feedback?.strengths) ? feedback.strengths : [];
  const improvements = Array.isArray(feedback?.improvements) ? feedback.improvements : [];
  return <>
    <PageHeading eyebrow="Practice with purpose" title="Interview coach" subtitle="One question at a time. Practice a clear, authentic answer and get structured feedback." />
    <div className="interview-layout">
      <section className="panel interview-settings"><PanelTitle icon={MessageCircle} title="Your practice session" subtitle="Make questions relevant to the opportunity" />
        <label className="field-label" htmlFor="category">Question style</label><select id="category" className="text-input" value={category} onChange={(event) => setCategory(event.target.value)}><option value="mixed">Mixed practice</option><option value="behavioral">Behavioral</option><option value="technical">Technical</option><option value="project-based">Project based</option><option value="scenario-based">Scenario based</option></select>
        <div className="context-card"><div className="context-icon"><FileText size={15} /></div><div><strong>{resume ? resume.filename : "No resume selected"}</strong><span>{jobTitle || (jobText ? "Job description added" : "Add role context for tailored practice")}</span></div></div>
        <LoadingButton busy={busy} onClick={() => void getQuestions()}><Sparkles size={15} /> Generate questions</LoadingButton>
        <div className="session-tip"><Sparkles size={15} /><span>Take your time. Strong answers are specific, concise, and true to your experience.</span></div>
      </section>
      <section className="panel question-panel">{questions.length ? <>
        <div className="question-top"><span className="question-count">QUESTION {index + 1} <span>OF {questions.length}</span></span><span className="question-type">{questions[index]?.type ?? "Practice"}</span></div><div className="question-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
        <h2>{questions[index]?.question}</h2>{questions[index]?.focus && <div className="focus-hint"><Target size={14} /> Listen for: {questions[index].focus}</div>}
        {!feedback ? <form onSubmit={(event) => { event.preventDefault(); void submitAnswer(); }}><label className="field-label" htmlFor="interview-answer">Your answer</label><textarea id="interview-answer" className="text-area answer-area" rows={8} maxLength={5000} placeholder="Take a breath and write your answer in your own words…" value={answer} onChange={(event) => setAnswer(event.target.value)} /><div className="answer-actions"><span>{answer.length}/5,000</span><LoadingButton busy={busy} onClick={() => void submitAnswer()}><Send size={14} /> Get feedback</LoadingButton></div></form> :
          <div className="feedback-panel"><div className="feedback-heading"><div className="feedback-check"><Check size={17} /></div><div><h3>Practice feedback</h3><span>Use this as a guide for your next attempt</span></div></div>
            {scores && <div className="score-grid">{Object.entries(scores).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}<small> / 5</small></strong><div className="mini-track"><span style={{ width: `${value * 20}%` }} /></div></div>)}</div>}
            <ResultList title="Strengths" items={strengths} positive /><ResultList title="Try next time" items={improvements} />
            {questions[index]?.type === "behavioral" && <div className="star-box"><strong>Use the STAR framework</strong><span>Situation · Task · Action · Result</span>{Array.isArray(feedback.star_guidance) && <p>{feedback.star_guidance.join(" · ")}</p>}</div>}
            {typeof feedback.model_answer === "string" && feedback.model_answer && <details className="model-answer"><summary>See a generic model answer example</summary><p>{feedback.model_answer}</p><span>This example is not a claim about your personal experience.</span></details>}
            <div className="question-nav"><Button variant="secondary" onClick={() => { setFeedback(null); setAnswer(""); setIndex((current) => Math.max(0, current - 1)); }} disabled={index === 0}>Previous</Button><Button onClick={() => { setFeedback(null); setAnswer(""); setIndex((current) => (current + 1) % questions.length); }}>Next question <ArrowRight size={15} /></Button></div>
          </div>}
      </> : <EmptyState icon={MessageCircle} title="Ready when you are" description="Choose a question style and generate a practice set. The coach will ask one question at a time." />}</section>
    </div>
  </>;
}

function SkillRoadmap({ resume, busy, run, savedRoadmap, setSavedRoadmap, dashboard, jobTitle, setJobTitle, setAlert }: CommonProps) {
  const [missing, setMissing] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const roadmap = createNew ? null : savedRoadmap ?? (dashboard?.latest_roadmap as Result | null);
  const weeks = Array.isArray(roadmap?.weeks) ? roadmap.weeks as Result[] : [];
  const generate = async () => {
    const data = await run(() => api<Result>("/roadmaps", jsonBody({ resume_id: resume?.id ?? null, target_role: jobTitle, skills: resume?.profile.skills ?? [], missing_skills: missing.split(",").map((skill) => skill.trim()).filter(Boolean) })), "A learning roadmap was generated.");
    if (data) { setSavedRoadmap(data); setCreateNew(false); localStorage.setItem("careerforge-roadmap", JSON.stringify(data)); }
  };
  const toggleWeek = (id: string) => {
    if (!roadmap) return;
    const next = { ...roadmap, weeks: weeks.map((week) => week.id === id ? { ...week, completed: !week.completed } : week) };
    setSavedRoadmap(next); localStorage.setItem("careerforge-roadmap", JSON.stringify(next));
    void api("/roadmaps/progress", { ...jsonBody({ roadmap: next, resume_id: resume?.id ?? null }), method: "PUT" }).catch((error: unknown) => setAlert({ kind: "error", message: error instanceof Error ? error.message : "Could not save roadmap progress." }));
  };
  const completed = weeks.filter((week) => week.completed).length;
  return <>
    <PageHeading eyebrow="Learn with intention" title="Skill roadmap" subtitle="Turn role requirements into a practical sequence of skills, projects, and checkpoints." />
    {!weeks.length ? <section className="panel roadmap-start"><div className="roadmap-illustration"><div><GraduationCap size={32} /></div><span /><span /><span /></div><h2>Build a roadmap for where you want to go</h2><p>Tell us your target role and optionally the skills you want to develop. Gemini will outline a practical learning path.</p><form onSubmit={(event) => { event.preventDefault(); void generate(); }} className="roadmap-form"><label className="field-label" htmlFor="roadmap-role">Target role</label><input required id="roadmap-role" className="text-input" placeholder="e.g. Data analyst" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /><label className="field-label gap-top" htmlFor="roadmap-gaps">Skills to work on <span>optional, comma separated</span></label><input id="roadmap-gaps" className="text-input" placeholder="e.g. SQL, data visualization, storytelling" value={missing} onChange={(event) => setMissing(event.target.value)} /><div className="privacy-inline"><Sparkles size={14} /> Current skills from your resume may be sent to Gemini to personalize this plan.</div><LoadingButton busy={busy} onClick={() => void generate()}><WandSparkles size={15} /> Generate my roadmap</LoadingButton></form></section> :
      <><section className="roadmap-overview"><div><div className="eyebrow">YOUR LEARNING PLAN</div><h2>{String(roadmap?.goal ?? `Path to ${jobTitle || "your next role"}`)}</h2><p>Learning-time estimates are approximate and depend on your starting point.</p></div><div className="roadmap-progress"><div className="roadmap-progress-ring" style={{ "--progress": `${weeks.length ? completed / weeks.length * 100 : 0}%` } as React.CSSProperties}><div><strong>{completed}/{weeks.length}</strong><span>complete</span></div></div></div></section>
        <div className="roadmap-list">{weeks.map((week, index) => <section className={`panel roadmap-week ${week.completed ? "week-complete" : ""}`} key={String(week.id ?? index)}><div className="week-index">{week.completed ? <Check size={17} /> : String(index + 1).padStart(2, "0")}</div><div className="week-content"><div className="week-title-row"><div><h3>{String(week.title ?? `Stage ${index + 1}`)}</h3><span>{String(week.estimated_hours ?? "—")} approximate hours</span></div><button className={`check-toggle ${week.completed ? "checked" : ""}`} onClick={() => toggleWeek(String(week.id ?? `week-${index}`))}>{week.completed ? <><Check size={13} /> Completed</> : "Mark complete"}</button></div>
          {(["skills", "topics", "practice_tasks", "project_ideas"] as const).map((key) => Array.isArray(week[key]) && (week[key] as unknown[]).length > 0 && <div className="week-detail" key={key}><span>{({ skills: "PRIORITY SKILLS", topics: "LEARNING TOPICS", practice_tasks: "PRACTICE TASKS", project_ideas: "PROJECT IDEAS" } as Record<string, string>)[key]}</span><ul>{(week[key] as unknown[]).map((item, i) => <li key={i}>{String(item)}</li>)}</ul></div>)}{typeof week.checkpoint === "string" && week.checkpoint && <div className="checkpoint"><ClipboardCheck size={14} /><span><strong>Checkpoint:</strong> {week.checkpoint}</span></div>}</div></section>)}</div>
        <Button variant="secondary" onClick={() => { setSavedRoadmap(null); setCreateNew(true); localStorage.removeItem("careerforge-roadmap"); void run(() => api("/roadmaps/progress", { ...jsonBody({ roadmap: {}, resume_id: resume?.id ?? null }), method: "PUT" })); }}>Create a new roadmap</Button>
      </>}
  </>;
}

type ChatMessage = { role: "user" | "assistant"; text: string; evidence?: string; general?: string };
function CareerAssistant({ resume, jobText, run }: CommonProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const prompts = ["Improve my professional summary.", "Analyze this job description.", "Prepare technical interview questions.", "Suggest projects for my target role.", "Explain my skill gaps."];
  const send = async (text: string) => {
    if (!text.trim()) return;
    setQuestion(""); setMessages((previous) => [...previous, { role: "user", text }]);
    const response = await run(() => api<{ answer: string; grounded_in_documents: boolean; document_evidence: string; general_guidance: string }>("/assistant", jsonBody({ message: text, resume_id: resume?.id ?? null, job_description: jobText })));
    if (response) setMessages((previous) => [...previous, { role: "assistant", text: response.answer, evidence: response.document_evidence, general: response.general_guidance }]);
  };
  return <>
    <PageHeading eyebrow="A thoughtful career companion" title="Career assistant" subtitle="Ask about your resume, role requirements, interviews, projects, or career preparation." />
    <div className="chat-layout"><section className="panel chat-panel"><div className="chat-top"><div className="chat-avatar"><Sparkles size={18} /></div><div><strong>CareerForge assistant</strong><span><span className="online-dot" /> Ready to help</span></div><span className="document-context">{resume ? <><FileText size={13} /> Resume context on</> : "General guidance"}</span></div>
      <div className="chat-messages">{messages.length ? messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><div className="message-avatar">{message.role === "assistant" ? <Sparkles size={14} /> : (resume?.profile.name?.toString().charAt(0).toUpperCase() || "Y")}</div><div className="message-body"><p>{message.text}</p>{message.evidence && <div className="evidence-note"><FileText size={13} /><span><strong>From your documents</strong>{message.evidence}</span></div>}{message.general && <div className="general-note"><CircleHelp size={13} /><span><strong>General guidance</strong>{message.general}</span></div>}</div></div>) : <div className="chat-welcome"><div className="welcome-spark small"><Sparkles size={19} /></div><h2>How can I help you move forward?</h2><p>Ask a question or try one of these starting points.</p><div className="prompt-grid">{prompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt}<ArrowUpRight size={13} /></button>)}</div></div>}</div>
      <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void send(question); }}><input aria-label="Ask a career question" placeholder="Ask anything about your career…" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={3000} /><Button type="submit" disabled={!question.trim()}><Send size={15} /> Send</Button></form><div className="chat-disclaimer"><ShieldCheck size={13} /> AI guidance can be imperfect. Verify important details and keep all resume claims truthful.</div>
    </section><aside className="chat-aside"><section className="panel"><PanelTitle icon={FileText} title="Context in use" /><div className="context-card"><div className="context-icon"><FileText size={15} /></div><div><strong>{resume?.filename ?? "No resume selected"}</strong><span>{resume ? "Locally stored resume" : "General advice only"}</span></div></div><div className="context-card"><div className="context-icon blue-context"><BriefcaseBusiness size={15} /></div><div><strong>{jobText ? "Job description added" : "No job description"}</strong><span>{jobText ? "Used to ground relevant answers" : "Paste one in Job Matcher"}</span></div></div></section><div className="ai-privacy-card"><LockKeyhole size={17} /><strong>Thoughtful use of your data</strong><p>When you send a message, the question and selected resume/job context are sent to Google Gemini for a response.</p></div></aside></div>
  </>;
}

function SettingsPage({ dashboard, resume, busy, run, aiReady, refresh }: CommonProps & { aiReady: boolean | null; refresh: () => Promise<void> }) {
  const remove = async (item: Resume) => {
    if (!window.confirm(`Delete ${item.filename} and all associated review, match, and roadmap records? This cannot be undone.`)) return;
    const response = await run(() => api<{ message: string }>(`/resumes/${item.id}`, { method: "DELETE" }), "Resume and associated records were deleted.");
    if (response) { localStorage.removeItem("careerforge-roadmap"); await refresh(); window.dispatchEvent(new CustomEvent("careerforge-resume-deleted", { detail: item.id })); }
  };
  const removeAll = async () => {
    if (!window.confirm("Permanently delete all resumes, analyses, job matches, interview progress, roadmaps, and activity from this workspace?")) return;
    const response = await run(() => api<{ message: string }>("/data", { method: "DELETE" }), "All CareerForge records were deleted.");
    if (response) {
      localStorage.removeItem("careerforge-roadmap");
      await refresh();
      window.dispatchEvent(new CustomEvent("careerforge-resume-deleted", { detail: resume?.id }));
      window.dispatchEvent(new Event("careerforge-all-data-deleted"));
    }
  };
  return <>
    <PageHeading eyebrow="Your workspace" title="Settings & privacy" subtitle="Manage local records, integrations, and your document privacy." />
    <div className="settings-layout"><div className="settings-main">
      <section className="panel"><PanelTitle icon={ShieldCheck} title="Privacy & data" subtitle="Your career information should stay in your control." /><div className="privacy-detail"><div className="privacy-detail-icon"><LockKeyhole size={18} /></div><div><strong>Local-first storage</strong><p>Resume text and career records are stored in SQLite on the backend machine. There are no user accounts or cross-user access controls in this single-user demo.</p></div></div><div className="privacy-detail"><div className="privacy-detail-icon purple"><Sparkles size={18} /></div><div><strong>When AI is used</strong><p>AI features send the relevant resume text, job description, question, or skills to the Google Gemini API. Do not upload sensitive information you do not want processed by that provider.</p></div></div>
      <h4 className="settings-subhead">Stored resumes</h4>{dashboard?.resumes.length ? dashboard.resumes.map((item) => <div className="stored-resume" key={item.id}><div className="file-type-icon"><FileText size={17} /></div><div><strong>{item.filename}</strong><span>Added {new Date(item.created_at).toLocaleDateString()}</span></div><button className="delete-button" disabled={busy} onClick={() => void remove(item)}><Trash2 size={15} /> Delete</button></div>) : <div className="empty-settings">{dashboard ? "No resumes stored in this workspace." : "Workspace data unavailable."}</div>}</section>
      <section className="panel"><PanelTitle icon={Settings} title="Workspace data" subtitle="Your dashboard statistics are derived from your actual saved activity." /><div className="data-counts"><div><strong>{dashboard?.counts.resumes ?? "—"}</strong><span>Resumes</span></div><div><strong>{dashboard?.counts.reviews ?? "—"}</strong><span>Reviews</span></div><div><strong>{dashboard?.counts.matches ?? "—"}</strong><span>Role matches</span></div><div><strong>{dashboard?.counts.interview_answers ?? "—"}</strong><span>Interview answers</span></div><div><strong>{dashboard?.counts.roadmaps ?? "—"}</strong><span>Roadmaps</span></div></div><div className="delete-all-row"><span>Remove every saved record, including activity that isn't linked to a resume.</span><Button variant="secondary" onClick={() => void removeAll()} disabled={busy}><Trash2 size={14} /> Delete all workspace data</Button></div></section>
    </div><aside className="settings-aside"><section className="panel"><PanelTitle icon={Zap} title="AI provider" /><div className={`provider-status ${aiReady ? "provider-ok" : "provider-off"}`}><span />{aiReady === null ? "Checking connection…" : aiReady ? "Gemini configured" : "API key not detected"}</div><p className="small-note">Set <code>GEMINI_API_KEY</code> in <code>backend/.env</code>, then restart the backend. The key is never sent to the browser.</p><p className="small-note">Model: Gemini configured by the backend environment.</p></section><section className="panel"><PanelTitle icon={CircleHelp} title="Need a hand?" /><p className="small-note">See the README for local setup, environment configuration, and API details.</p><a className="text-link" href="https://github.com/harshit1400h-cell/AI-Study-Buddy-Pro-Master-Prompt" target="_blank" rel="noreferrer">Project repository <Github size={14} /></a></section><div className="warning-card"><LockKeyhole size={15} /><span>This demo has no authentication. Keep the backend private and do not expose it to the public internet with personal resume data.</span></div></aside></div>
  </>;
}

export default App;
