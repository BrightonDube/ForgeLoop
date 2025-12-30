
import { AgentPhase } from '../types';
import type { Run, LogEntry, Artifact, RepoFile, Issue, RepoSummary, ThoughtSignature, VerificationArtifact, ConfidenceEvent } from '../types';

export class Database {
  private static STORAGE_KEY = 'forgeloop_db_v3';
  
  private data: {
    runs: Run[];
    logs: LogEntry[];
    artifacts: Artifact[];
    files: Record<string, RepoFile[]>; 
    issues: Issue[];
    repoSummaries: Record<string, RepoSummary>;
    
    // PRD: Thought Store Tables
    thoughts: ThoughtSignature[];
    verificationArtifacts: VerificationArtifact[];
    confidenceEvents: ConfidenceEvent[];
  };

  constructor() {
    this.data = this.load();
  }

  private load() {
    return { 
        runs: [], 
        logs: [], 
        artifacts: [], 
        files: {}, 
        issues: [], 
        repoSummaries: {},
        thoughts: [],
        verificationArtifacts: [],
        confidenceEvents: []
    };
  }

  // --- Runs ---
  
  public createRun(owner: string, repo: string): Run {
    const run: Run = {
      id: crypto.randomUUID(),
      repoOwner: owner,
      repoName: repo,
      branch: 'main',
      status: 'running',
      currentPhase: AgentPhase.BOOTING,
      currentConfidence: 0.2, // Base confidence as per PRD
      createdAt: Date.now(),
    };
    this.data.runs = [run]; 
    this.data.files[run.id] = []; 
    return run;
  }

  public getRun(id: string): Run | undefined {
    return this.data.runs.find(r => r.id === id);
  }

  public updateRun(id: string, updates: Partial<Run>) {
    const run = this.getRun(id);
    if (run) Object.assign(run, updates);
    return run;
  }

  // --- Logs (Legacy/UI) ---

  public createLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      ...entry,
    };
    this.data.logs.push(log);
    return log;
  }

  public getLogs(runId: string): LogEntry[] {
    return this.data.logs.filter(l => l.runId === runId);
  }

  // --- Thought Store (PRD) ---

  public createThought(thought: Omit<ThoughtSignature, 'id' | 'createdAt'>): ThoughtSignature {
      const t: ThoughtSignature = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...thought
      };
      this.data.thoughts.push(t);
      return t;
  }

  public getThoughts(runId: string): ThoughtSignature[] {
      return this.data.thoughts.filter(t => t.runId === runId);
  }

  public addVerificationArtifact(artifact: Omit<VerificationArtifact, 'id' | 'createdAt'>): VerificationArtifact {
      const a: VerificationArtifact = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          ...artifact
      };
      this.data.verificationArtifacts.push(a);
      return a;
  }

  public addConfidenceEvent(event: Omit<ConfidenceEvent, 'id'>) {
      this.data.confidenceEvents.push({
          id: crypto.randomUUID(),
          ...event
      });
  }

  // --- Artifacts (Legacy UI mapping) ---

  public createArtifact(artifact: Omit<Artifact, 'id' | 'createdAt'>): Artifact {
    const newArtifact: Artifact = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...artifact
    };
    this.data.artifacts.push(newArtifact);
    return newArtifact;
  }

  public getArtifacts(runId: string): Artifact[] {
    return this.data.artifacts.filter(a => a.runId === runId);
  }

  // --- Files ---

  public upsertFile(runId: string, file: RepoFile) {
    if (!this.data.files[runId]) this.data.files[runId] = [];
    
    const idx = this.data.files[runId].findIndex(f => f.path === file.path);
    if (idx >= 0) {
        this.data.files[runId][idx] = file;
    } else {
        this.data.files[runId][idx] = file; // Wait, push if not found
        this.data.files[runId].push(file);
    }
  }

  public getFiles(runId: string): RepoFile[] {
    return this.data.files[runId] || [];
  }

  // --- Issues ---
  
  public createIssue(issue: Omit<Issue, 'id'>): Issue {
    const newIssue: Issue = {
        id: crypto.randomUUID(),
        ...issue
    };
    this.data.issues.push(newIssue);
    return newIssue;
  }

  public getIssues(runId: string): Issue[] {
    return this.data.issues.filter(i => i.runId === runId);
  }

  public updateIssue(id: string, updates: Partial<Issue>) {
      const issue = this.data.issues.find(i => i.id === id);
      if (issue) Object.assign(issue, updates);
      return issue;
  }

  // --- Repo Summary (Architecture Memory) ---
  public saveRepoSummary(runId: string, summary: RepoSummary) {
      this.data.repoSummaries[runId] = summary;
  }
}

export const db = new Database();
