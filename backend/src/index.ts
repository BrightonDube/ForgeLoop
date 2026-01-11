import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { config, validateConfig } from './config.js';
import { db } from './db.js';
import { AgentWorker } from './services/agent.js';
import { GitHubService } from './services/github.js';
import { GeminiService } from './services/gemini.js';
import { 
  rateLimitMiddleware, 
  analysisRateLimitMiddleware, 
  validateRepoUrl, 
  validateRunId, 
  validateChatMessage,
  requestLogger 
} from './middleware/validation.js';
import type { StartRunRequest, RunStateResponse, WSMessage } from './types.js';

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(rateLimitMiddleware);

// Active workers map
const activeWorkers: Map<string, AgentWorker> = new Map();

// WebSocket clients map
const wsClients: Map<string, Set<WebSocket>> = new Map();

// --- Health Check ---
app.get('/api/health', (_req: Request, res: Response) => {
  const configStatus = validateConfig();
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      github: !!config.githubToken,
      gemini: !!config.geminiApiKey,
    },
    warnings: configStatus.errors,
  });
});

// --- Runs API ---

// Start a new run
app.post('/api/runs', validateRepoUrl, analysisRateLimitMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repoUrl } = req.body as StartRunRequest;

    // Parse repo URL (already validated by middleware)
    const github = new GitHubService();
    const parsed = github.parseRepoUrl(repoUrl);

    if (!parsed) {
      res.status(400).json({ error: 'Invalid GitHub repository URL' });
      return;
    }

    // Create run
    const run = db.createRun(repoUrl, parsed.owner, parsed.repo);

    // Create and start worker
    const worker = new AgentWorker(run.id);
    activeWorkers.set(run.id, worker);

    // Set up event handlers
    worker.on('log', (log) => {
      broadcastToRun(run.id, { type: 'log', runId: run.id, data: log });
    });

    worker.on('phase', (data) => {
      broadcastToRun(run.id, { type: 'phase', runId: run.id, data });
    });

    worker.on('issue', (data) => {
      broadcastToRun(run.id, { type: 'issue', runId: run.id, data });
    });

    worker.on('completed', () => {
      activeWorkers.delete(run.id);
      broadcastToRun(run.id, { type: 'status', runId: run.id, data: { status: 'completed' } });
    });

    worker.on('error', (data) => {
      activeWorkers.delete(run.id);
      broadcastToRun(run.id, { type: 'error', runId: run.id, data });
    });

    // Start async
    worker.start();

    res.status(201).json({ run });
  } catch (error) {
    next(error);
  }
});

// Get run state
app.get('/api/runs/:id', validateRunId, (req: Request, res: Response) => {
  const { id } = req.params;
  const run = db.getRun(id);

  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  const response: RunStateResponse = {
    run,
    logs: db.getLogs(id),
    files: db.getFiles(id),
    issues: db.getIssues(id),
    artifacts: db.getArtifacts(id),
  };

  res.json(response);
});

// Stop a run
app.post('/api/runs/:id/stop', validateRunId, (req: Request, res: Response) => {
  const { id } = req.params;
  const worker = activeWorkers.get(id);

  if (worker) {
    worker.stop();
    activeWorkers.delete(id);
  }

  const run = db.updateRun(id, { status: 'stopped' });
  
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  res.json({ run });
});

// List all runs
app.get('/api/runs', (_req: Request, res: Response) => {
  const runs = db.getAllRuns();
  res.json({ runs });
});

// Delete a run
app.delete('/api/runs/:id', validateRunId, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Stop if running
    const worker = activeWorkers.get(id);
    if (worker) {
      worker.stop();
      activeWorkers.delete(id);
    }
    
    const deleted = db.deleteRun(id);
    
    if (!deleted) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting run:', error);
    res.status(500).json({ error: 'Failed to delete run' });
  }
});

// --- Chat API ---

app.post('/api/chat', validateChatMessage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, runId } = req.body;

    const gemini = new GeminiService();
    
    if (!gemini.isConfigured()) {
      res.status(503).json({ error: 'Gemini API not configured' });
      return;
    }

    // Build context from run if provided
    let context = 'No specific context available.';
    if (runId) {
      const logs = db.getLogs(runId);
      const issues = db.getIssues(runId);
      context = `
Recent logs:
${logs.slice(-10).map(l => `[${l.subsystem}] ${l.message}`).join('\n')}

Detected issues:
${issues.map(i => `- ${i.title} (${i.priority})`).join('\n')}
      `;
    }

    const response = await gemini.chat(message, context);
    res.json({ response });
  } catch (error) {
    next(error);
  }
});

// --- Validation Endpoint ---

app.post('/api/validate/repo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      res.status(400).json({ error: 'repoUrl is required' });
      return;
    }

    const github = new GitHubService();
    const parsed = github.parseRepoUrl(repoUrl);

    if (!parsed) {
      res.status(400).json({ error: 'Invalid GitHub repository URL', valid: false });
      return;
    }

    try {
      const repo = await github.getRepository(parsed.owner, parsed.repo);
      res.json({
        valid: true,
        repository: repo,
      });
    } catch {
      res.status(404).json({
        valid: false,
        error: 'Repository not found or not accessible',
      });
    }
  } catch (error) {
    next(error);
  }
});

// --- Error Handler ---

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// --- WebSocket Setup ---

function broadcastToRun(runId: string, message: WSMessage): void {
  const clients = wsClients.get(runId);
  if (!clients) return;

  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// --- Server Startup ---

export function startServer(): void {
  const server = createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Extract runId from query params
    // Use request host header if available, fallback to localhost
    const host = req.headers.host || `localhost:${config.port}`;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const url = new URL(req.url || '', `${protocol}://${host}`);
    const runId = url.searchParams.get('runId');

    if (runId) {
      // Add to clients for this run
      if (!wsClients.has(runId)) {
        wsClients.set(runId, new Set());
      }
      wsClients.get(runId)!.add(ws);

      ws.on('close', () => {
        wsClients.get(runId)?.delete(ws);
      });
    }

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message:', message);
      } catch {
        console.error('Invalid WebSocket message');
      }
    });
  });

  server.listen(config.port, () => {
    console.log(`
🚀 ForgeLoop Backend Server
   ━━━━━━━━━━━━━━━━━━━━━━━━━
   Port:     ${config.port}
   Mode:     ${config.nodeEnv}
   GitHub:   ${config.githubToken ? '✓ Configured' : '✗ Not configured'}
   Gemini:   ${config.geminiApiKey ? '✓ Configured' : '✗ Not configured'}
   
   API:      http://localhost:${config.port}/api
   WebSocket: ws://localhost:${config.port}/ws
    `);
  });
}

// Start if run directly
startServer();
