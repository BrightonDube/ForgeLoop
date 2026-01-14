// Agent Phase States
export enum AgentPhase {
  IDLE = 'IDLE',
  INGESTION = 'INGESTION',
  PLANNING = 'PLANNING',
  EXECUTION = 'EXECUTION',
  OBSERVATION = 'OBSERVATION',
  VERIFICATION = 'VERIFICATION',
  DELIVERY = 'DELIVERY',
}

// Log Levels
export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
  THOUGHT = 'THOUGHT',
}

// Log Subsystems
export type LogSubsystem = 'BRAIN' | 'HANDS' | 'EYES' | 'SYSTEM';

// Database Models
export interface Run {
  id: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  currentPhase: AgentPhase;
  createdAt: number;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  runId: string;
  timestamp: string;
  level: LogLevel;
  subsystem: LogSubsystem;
  message: string;
}

// Artifact data types
export interface DiffArtifactData {
  path?: string;
  original?: string;
  fixed?: string;
  issue?: string;
  beforeUrl?: string;
  afterUrl?: string;
  detectedIssues?: string[];
}

export interface ContextArtifactData {
  repository?: GitHubRepo;
}

export interface AnalysisArtifactData {
  issues: Omit<Issue, 'id' | 'runId' | 'status'>[];
  summary: string;
  recommendations: string[];
}

export interface PRArtifactData {
  number?: number;
  url?: string;
  title?: string;
}

export type ArtifactData = DiffArtifactData | ContextArtifactData | AnalysisArtifactData | PRArtifactData;

export interface Artifact {
  id: string;
  runId: string;
  type: 'diff' | 'pr' | 'context' | 'analysis';
  data: ArtifactData;
  createdAt: number;
}

export interface RepoFile {
  path: string;
  content: string;
  language: string;
  size: number;
  sha: string;
}

export interface Issue {
  id: string;
  runId: string;
  title: string;
  description: string;
  filepath: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  suggestedFix?: string;
}

// GitHub Types
export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stargazers: number;
  url: string;
}

export interface GitHubFileContent {
  path: string;
  content: string;
  sha: string;
  size: number;
  encoding: string;
}

// Gemini Analysis Types
export interface CodeAnalysisResult {
  issues: Omit<Issue, 'id' | 'runId' | 'status'>[];
  summary: string;
  recommendations: string[];
}

// API Request/Response Types
export interface StartRunRequest {
  repoUrl: string;
}

export interface StartRunResponse {
  run: Run;
}

export interface RunStateResponse {
  run: Run;
  logs: LogEntry[];
  files: RepoFile[];
  issues: Issue[];
  artifacts: Artifact[];
}

// WebSocket Message Types
export interface WSMessage {
  type: 'log' | 'phase' | 'status' | 'file' | 'issue' | 'error';
  runId: string;
  data: unknown;
}
