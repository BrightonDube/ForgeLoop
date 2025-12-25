import { AgentPhase } from '../types';
import type { Run, LogEntry, Artifact, RepoFile, Issue } from '../types';

/**
 * Mocks a Relational Database with persistence.
 * Uses LocalStorage to act as the "Disk".
 */
class Database {
  private static STORAGE_KEY = 'code_ocean_db_v3';
  
  private data: {
    runs: Run[];
    logs: LogEntry[];
    artifacts: Artifact[];
    files: Record<string, RepoFile[]>; // runId -> files
    issues: Issue[];
  };

  constructor() {
    this.data = this.load();
  }

  private load() {
    try {
      const stored = localStorage.getItem(Database.STORAGE_KEY);
      return stored ? JSON.parse(stored) : { runs: [], logs: [], artifacts: [], files: {}, issues: [] };
    } catch (e) {
      return { runs: [], logs: [], artifacts: [], files: {}, issues: [] };
    }
  }

  private save() {
    try {
      localStorage.setItem(Database.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error("Database save failed", e);
    }
  }

  // --- Runs Table ---
  
  public createRun(repoUrl: string): Run {
    const run: Run = {
      id: crypto.randomUUID(),
      repoUrl,
      status: 'running',
      currentPhase: AgentPhase.INGESTION,
      createdAt: Date.now(),
    };
    this.data.runs.push(run);
    this.data.files[run.id] = []; // Initialize file store for run
    this.save();
    return run;
  }

  public getRun(id: string): Run | undefined {
    return this.data.runs.find(r => r.id === id);
  }

  public updateRun(id: string, updates: Partial<Run>) {
    const run = this.getRun(id);
    if (run) {
      Object.assign(run, updates);
      this.save();
    }
    return run;
  }

  // --- Logs Table ---

  public createLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      ...entry,
    };
    this.data.logs.push(log);
    this.save();
    return log;
  }

  public getLogs(runId: string): LogEntry[] {
    return this.data.logs.filter(l => l.runId === runId);
  }

  // --- Artifacts Table ---

  public createArtifact(artifact: Omit<Artifact, 'id' | 'createdAt'>): Artifact {
    const newArtifact: Artifact = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...artifact
    };
    this.data.artifacts.push(newArtifact);
    this.save();
    return newArtifact;
  }

  public getArtifacts(runId: string): Artifact[] {
    return this.data.artifacts.filter(a => a.runId === runId);
  }

  // --- Files Table (Virtual File System) ---

  public upsertFile(runId: string, file: Omit<RepoFile, 'lastModified'>) {
    if (!this.data.files[runId]) {
        this.data.files[runId] = [];
    }
    
    const existingIndex = this.data.files[runId].findIndex(f => f.path === file.path);
    const newFile: RepoFile = { ...file, lastModified: Date.now() };

    if (existingIndex >= 0) {
        this.data.files[runId][existingIndex] = newFile;
    } else {
        this.data.files[runId].push(newFile);
    }
    this.save();
  }

  public getFiles(runId: string): RepoFile[] {
    return this.data.files[runId] || [];
  }

  // --- Issues Table ---
  
  public createIssue(issue: Omit<Issue, 'id'>): Issue {
    const newIssue: Issue = {
        id: crypto.randomUUID(),
        ...issue
    };
    this.data.issues.push(newIssue);
    this.save();
    return newIssue;
  }

  public getIssues(runId: string): Issue[] {
    return this.data.issues.filter(i => i.runId === runId);
  }

  public updateIssue(id: string, updates: Partial<Issue>) {
      const issue = this.data.issues.find(i => i.id === id);
      if (issue) {
          Object.assign(issue, updates);
          this.save();
      }
      return issue;
  }

  public clear() {
    this.data = { runs: [], logs: [], artifacts: [], files: {}, issues: [] };
    this.save();
  }
}

export const db = new Database();