import { v4 as uuidv4 } from 'uuid';
import type { Run, LogEntry, Artifact, RepoFile, Issue, AgentPhase, LogLevel, LogSubsystem, ArtifactData } from './types.js';

/**
 * In-memory database for storing run data
 * In production, this would be replaced with a real database
 */
class Database {
  private runs: Map<string, Run> = new Map();
  private logs: Map<string, LogEntry[]> = new Map();
  private artifacts: Map<string, Artifact[]> = new Map();
  private files: Map<string, RepoFile[]> = new Map();
  private issues: Map<string, Issue[]> = new Map();

  // --- Runs ---
  
  createRun(repoUrl: string, owner: string, name: string): Run {
    const run: Run = {
      id: uuidv4(),
      repoUrl,
      repoOwner: owner,
      repoName: name,
      status: 'running',
      currentPhase: 'INGESTION' as AgentPhase,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.runs.set(run.id, run);
    this.logs.set(run.id, []);
    this.artifacts.set(run.id, []);
    this.files.set(run.id, []);
    this.issues.set(run.id, []);
    
    return run;
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }

  updateRun(id: string, updates: Partial<Run>): Run | undefined {
    const run = this.runs.get(id);
    if (!run) return undefined;
    
    const updated = { ...run, ...updates, updatedAt: Date.now() };
    this.runs.set(id, updated);
    return updated;
  }

  getAllRuns(): Run[] {
    return Array.from(this.runs.values());
  }

  // --- Logs ---
  
  createLog(runId: string, subsystem: LogSubsystem, message: string, level: LogLevel): LogEntry {
    const log: LogEntry = {
      id: uuidv4(),
      runId,
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      message,
    };
    
    const logs = this.logs.get(runId) || [];
    logs.push(log);
    this.logs.set(runId, logs);
    
    return log;
  }

  getLogs(runId: string): LogEntry[] {
    return this.logs.get(runId) || [];
  }

  // --- Artifacts ---
  
  createArtifact(runId: string, type: Artifact['type'], data: ArtifactData): Artifact {
    const artifact: Artifact = {
      id: uuidv4(),
      runId,
      type,
      data,
      createdAt: Date.now(),
    };
    
    const artifacts = this.artifacts.get(runId) || [];
    artifacts.push(artifact);
    this.artifacts.set(runId, artifacts);
    
    return artifact;
  }

  getArtifacts(runId: string): Artifact[] {
    return this.artifacts.get(runId) || [];
  }

  // --- Files ---
  
  setFiles(runId: string, files: RepoFile[]): void {
    this.files.set(runId, files);
  }

  getFiles(runId: string): RepoFile[] {
    return this.files.get(runId) || [];
  }

  // --- Issues ---
  
  createIssue(runId: string, issue: Omit<Issue, 'id' | 'runId'>): Issue {
    const newIssue: Issue = {
      id: uuidv4(),
      runId,
      ...issue,
    };
    
    const issues = this.issues.get(runId) || [];
    issues.push(newIssue);
    this.issues.set(runId, issues);
    
    return newIssue;
  }

  getIssues(runId: string): Issue[] {
    return this.issues.get(runId) || [];
  }

  updateIssue(runId: string, issueId: string, updates: Partial<Issue>): Issue | undefined {
    const issues = this.issues.get(runId) || [];
    const index = issues.findIndex(i => i.id === issueId);
    if (index === -1) return undefined;
    
    issues[index] = { ...issues[index], ...updates };
    this.issues.set(runId, issues);
    return issues[index];
  }

  // --- Cleanup ---
  
  deleteRun(id: string): boolean {
    this.logs.delete(id);
    this.artifacts.delete(id);
    this.files.delete(id);
    this.issues.delete(id);
    return this.runs.delete(id);
  }

  clear(): void {
    this.runs.clear();
    this.logs.clear();
    this.artifacts.clear();
    this.files.clear();
    this.issues.clear();
  }
}

// Export singleton instance
export const db = new Database();
