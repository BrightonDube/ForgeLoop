
export enum ThinkingLevel {
  OBSERVE = 1,   // Capture reality
  DIAGNOSE = 2,  // Explain cause
  PLAN = 3,      // Propose change
  VERIFY = 4,    // Test change
  REFLECT = 5    // Decide next iteration
}

export enum AgentPhase {
  // Mapping ThinkingLevels to UI phases for backward compatibility with frontend
  IDLE = 'IDLE',
  BOOTING = 'BOOTING',
  OBSERVING = 'OBSERVING',
  DIAGNOSING = 'DIAGNOSING',
  PLANNING = 'PLANNING',
  VERIFYING = 'VERIFYING',
  REFLECTING = 'REFLECTING',
  APPROVAL = 'APPROVAL',
  DELIVERY = 'DELIVERY',
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
  THOUGHT = 'THOUGHT',
}

export type LogSubsystem = 'CORE' | 'PERCEPTION' | 'EXECUTION' | 'VERIFICATION' | 'MEMORY' | 'GITHUB';

// --- Thought Store (PRD Part 1) ---

export interface ThoughtSignature {
  id: string;                 // UUID
  runId: string;
  thinkingLevel: ThinkingLevel;
  hypothesis: string;         // Testable claim
  decision: string | null;    // Action chosen
  outcome: 'confirmed' | 'refuted' | 'inconclusive' | null;
  confidence: number;         // 0.0 -> 1.0
  evidenceRefs: string[];     // IDs of artifacts
  createdAt: string;          // ISO Date
  summary: string;            // Human readable thought
}

export interface VerificationArtifact {
  id: string;
  runId: string;
  type: 'screenshot' | 'test-report' | 'dom-snapshot' | 'console-log';
  data: any; // Raw data or link
  summary: string;
  createdAt: number;
}

export interface ConfidenceEvent {
  id: string;
  thoughtId: string;
  signal: 'test_pass' | 'test_fail' | 'visual_regression' | 'visual_improvement' | 'error_removed' | 'error_introduced';
  weight: number;
}

// --- Runtime State ---

export interface Run {
  id: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  currentPhase: AgentPhase; // UI projection of ThinkingLevel
  currentConfidence: number; // Real-time confidence
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
  type: 'pr' | 'diff' | 'memory' | 'vision_analysis';
  data: any;
  createdAt: number;
}

export interface RepoFile {
  path: string;
  content: string;
  sha: string;
  isPatched?: boolean;
}

export interface Issue {
  id: string;
  runId: string;
  title: string;
  description: string;
  filepath: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  status: 'OPEN' | 'RESOLVED';
}

export interface CodeDiffState {
  filePath: string;
  original: string;
  modified: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface VisionResult {
  timestamp: number;
  screenshotUrl: string;
  base64Data?: string;
  analysis?: string;
}

export interface ExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RepoSummary {
  description: string;
  language: string;
  topics?: string[];
}
