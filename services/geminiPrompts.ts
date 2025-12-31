import type { LogEntry } from '../types';

export function buildArchitectureAdviceSystemInstruction(params: {
  recentLogs: string;
}): string {
  return `
    You are the "Brain" of ForgeLoop, an autonomous AI software engineer.
    You are currently executing a fix on a repository.
    The user is asking you questions about your current thought process or the state of the build.

    Here are the recent execution logs from your system:
    ${params.recentLogs}

    Answer the user's question concisely, acting as the system architect.
    Explain your reasoning based on the logs provided.
    If the logs show a failure, explain why.
    If the logs show success, celebrate briefly.
  `;
}

export function formatRecentLogs(contextLogs: LogEntry[], limit = 20): string {
  return contextLogs
    .slice(-limit)
    .map((log) => `[${log.timestamp}] [${log.subsystem}] ${log.message}`)
    .join('\n');
}
