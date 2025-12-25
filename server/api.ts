import { db } from "./db";
import { AgentWorker } from "./agent";

// Singleton worker for the "Server" process
let activeWorker: AgentWorker | null = null;

export const api = {
  /**
   * POST /runs
   * Starts a new agent run.
   */
  startRun: async (repoUrl: string) => {
    // Stop existing if any
    if (activeWorker) {
      activeWorker.stop();
    }

    const run = db.createRun(repoUrl);
    activeWorker = new AgentWorker(run.id);
    activeWorker.start();
    return run;
  },

  /**
   * POST /runs/:id/stop
   */
  stopRun: async (runId: string) => {
    if (activeWorker) {
        activeWorker.stop();
        activeWorker = null;
    }
    return db.updateRun(runId, { status: 'stopped' });
  },

  /**
   * GET /runs/:id
   */
  getRunState: async (runId: string) => {
    const run = db.getRun(runId);
    if (!run) throw new Error("Run not found");
    
    const logs = db.getLogs(runId);
    const artifacts = db.getArtifacts(runId);
    const files = db.getFiles(runId);
    const issues = db.getIssues(runId);
    
    // Process artifacts into the VisualDiff format the frontend expects
    const latestDiff = artifacts.filter(a => a.type === 'diff').pop();
    const visualDiff = latestDiff ? latestDiff.data : null;

    return {
      run,
      logs,
      visualDiff,
      files,
      issues
    };
  },

  /**
   * GET /health
   */
  getHealth: async () => {
    return { status: 'ok', version: '3.0.0' };
  }
};