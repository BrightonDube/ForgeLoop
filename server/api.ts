import { db } from "./db";
import { Orchestrator } from "./agent";
import { GitHubConfig } from "../types";

// "Server-Side" Memory Store
let activeOrchestrator: Orchestrator | null = null;
let currentRunId: string | null = null;

// Secure Session Store (Simulated)
// In a real app, this would be an encrypted Redis/DB session.
const sessionStore = {
  config: null as GitHubConfig | null,
  isAuthenticated: false
};

export const api = {
  // Login: Stores creds in "server" memory, returns success bool
  login: async (config: GitHubConfig) => {
    // Validate minimally
    if (!config.token || !config.owner || !config.repo) return false;
    
    sessionStore.config = config;
    sessionStore.isAuthenticated = true;
    return true;
  },

  checkSession: async () => {
      return { 
          isAuthenticated: sessionStore.isAuthenticated,
          // meaningful info for UI without leaking token
          repo: sessionStore.config ? `${sessionStore.config.owner}/${sessionStore.config.repo}` : null 
      };
  },

  startRun: async () => {
    if (!sessionStore.isAuthenticated || !sessionStore.config) {
        throw new Error("Unauthorized: No active session.");
    }

    if (activeOrchestrator) activeOrchestrator.stop();

    const run = db.createRun(sessionStore.config.owner, sessionStore.config.repo);
    currentRunId = run.id;
    
    // Initialize the Multi-Agent Orchestrator
    activeOrchestrator = new Orchestrator(run.id, sessionStore.config);
    activeOrchestrator.start();
    
    return run;
  },

  approveFix: async (runId: string) => {
      if (activeOrchestrator) {
          await activeOrchestrator.humanApprovalReceived();
      }
  },

  rejectFix: async (runId: string) => {
      if (activeOrchestrator) {
          await activeOrchestrator.humanRejectionReceived();
      }
  },

  stopRun: async (runId: string) => {
    if (activeOrchestrator) {
        activeOrchestrator.stop();
        activeOrchestrator = null;
    }
    return db.updateRun(runId, { status: 'stopped' });
  },

  getRunState: async (runId: string) => {
    const run = runId ? db.getRun(runId) : null;
    const logs = runId ? db.getLogs(runId) : [];
    const artifacts = runId ? db.getArtifacts(runId) : [];
    const files = runId ? db.getFiles(runId) : [];
    const issues = runId ? db.getIssues(runId) : [];
    
    // Process diffs
    const diffArtifact = artifacts.find(a => a.type === 'diff');
    const diff = diffArtifact ? diffArtifact.data : null;
    
    // Process PR
    const prArtifact = artifacts.find(a => a.type === 'pr');
    const pr = prArtifact ? prArtifact.data : null;

    // Process Vision
    const visionArtifact = artifacts.find(a => a.type === 'vision_analysis');
    const vision = visionArtifact ? visionArtifact.data : null;

    return {
      run,
      logs,
      files,
      issues,
      diff,
      pr,
      vision
    };
  },

  updateFile: async (path: string, content: string) => {
    if (currentRunId) {
        const files = db.getFiles(currentRunId);
        const file = files.find(f => f.path === path);
        if (file) {
             db.upsertFile(currentRunId, { ...file, content, isPatched: true });
        }
    }
  }
};