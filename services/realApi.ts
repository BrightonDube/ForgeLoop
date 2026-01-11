// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

// Types
import type { Run, LogEntry, RepoFile, Issue, Artifact, VisualDiffState } from '../types';

interface RunStateResponse {
  run: Run;
  logs: LogEntry[];
  files: RepoFile[];
  issues: Issue[];
  artifacts: Artifact[];
}

interface StartRunResponse {
  run: Run;
}

interface HealthResponse {
  status: string;
  version: string;
  services: {
    github: boolean;
    gemini: boolean;
  };
  warnings: string[];
}

interface ValidateRepoResponse {
  valid: boolean;
  repository?: {
    fullName: string;
    description: string | null;
    language: string | null;
  };
  error?: string;
}

interface ChatResponse {
  response: string;
}

/**
 * Real API client for connecting to the backend server
 */
class ApiClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.wsUrl = WS_BASE_URL;
  }

  // --- HTTP Methods ---

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // --- Health ---

  async getHealth(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>('/api/health');
  }

  // --- Runs ---

  async startRun(repoUrl: string): Promise<Run> {
    const response = await this.fetch<StartRunResponse>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ repoUrl }),
    });
    
    // Connect WebSocket for this run
    this.connectWebSocket(response.run.id);
    
    return response.run;
  }

  async stopRun(runId: string): Promise<Run> {
    const response = await this.fetch<{ run: Run }>(`/api/runs/${runId}/stop`, {
      method: 'POST',
    });
    
    // Disconnect WebSocket
    this.disconnectWebSocket();
    
    return response.run;
  }

  async getRunState(runId: string): Promise<RunStateResponse & { visualDiff: VisualDiffState | null }> {
    const response = await this.fetch<RunStateResponse>(`/api/runs/${runId}`);
    
    // Process artifacts into visualDiff format
    const diffs = response.artifacts?.filter(a => a.type === 'diff') || [];
    const latestDiff = diffs[diffs.length - 1];
    
    const visualDiff: VisualDiffState | null = latestDiff ? {
      beforeUrl: (latestDiff.data as Record<string, unknown>).beforeUrl as string || null,
      afterUrl: (latestDiff.data as Record<string, unknown>).afterUrl as string || null,
      detectedIssues: (latestDiff.data as Record<string, unknown>).detectedIssues as string[] || [],
    } : null;
    
    return {
      ...response,
      visualDiff,
    };
  }

  async getAllRuns(): Promise<Run[]> {
    const response = await this.fetch<{ runs: Run[] }>('/api/runs');
    return response.runs;
  }

  // --- Validation ---

  async validateRepo(repoUrl: string): Promise<ValidateRepoResponse> {
    return this.fetch<ValidateRepoResponse>('/api/validate/repo', {
      method: 'POST',
      body: JSON.stringify({ repoUrl }),
    });
  }

  // --- Chat ---

  async chat(message: string, runId?: string): Promise<string> {
    const response = await this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, runId }),
    });
    return response.response;
  }

  // --- WebSocket ---

  connectWebSocket(runId: string): void {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(`${this.wsUrl}/ws?runId=${runId}`);

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const listeners = this.listeners.get(message.type);
        if (listeners) {
          listeners.forEach(callback => callback(message.data));
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
    };
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onMessage(type: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }
}

// Export singleton instance
export const realApi = new ApiClient();

// Also export a compatibility layer for the existing code
export const api = {
  startRun: (repoUrl: string) => realApi.startRun(repoUrl),
  stopRun: (runId: string) => realApi.stopRun(runId),
  getRunState: (runId: string) => realApi.getRunState(runId),
  getHealth: () => realApi.getHealth(),
};
