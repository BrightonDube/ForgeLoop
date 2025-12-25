export enum AgentPhase {
  IDLE = 'IDLE',
  INGESTION = 'INGESTION',
  PLANNING = 'PLANNING',
  EXECUTION = 'EXECUTION',
  OBSERVATION = 'OBSERVATION',
  VERIFICATION = 'VERIFICATION',
  DELIVERY = 'DELIVERY',
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
  THOUGHT = 'THOUGHT',
}

export type LogSubsystem = 'BRAIN' | 'HANDS' | 'EYES' | 'SYSTEM';

// Database Models
export interface Run {
  id: string;
  repoUrl: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  currentPhase: AgentPhase;
  createdAt: number;
}

export interface LogEntry {
  id: string;
  runId: string;
  timestamp: string;
  level: LogLevel;
  subsystem: LogSubsystem;
  message: string;
}

export interface Artifact {
  id: string;
  runId: string;
  type: 'diff' | 'pr' | 'context';
  data: any;
  createdAt: number;
}

export interface RepoFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
  isPatched?: boolean;
}

export interface Issue {
  id: string;
  runId: string;
  title: string;
  description: string;
  filepath: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number; // 0 to 100
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
}

export interface ExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface VisionResult {
  screenshotUrl: string;
  base64Data?: string; // For sending to LLM
  timestamp: number;
}

// Frontend View Models
export interface VisualDiffState {
  beforeUrl: string | null;
  afterUrl: string | null;
  detectedIssues: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}