import React from 'react';
import { Clock, CheckCircle, XCircle, StopCircle, Loader2, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Run } from '../types';

interface RunHistoryProps {
  runs: Run[];
  currentRunId: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun?: (runId: string) => void;
}

const statusIcons = {
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  stopped: StopCircle,
};

const statusColors = {
  running: 'text-neon-blue',
  completed: 'text-neon-green',
  failed: 'text-neon-red',
  stopped: 'text-ocean-400',
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function extractRepoName(url: string): string {
  // Handle various URL formats
  const patterns = [
    /github\.com\/([^\/]+\/[^\/]+)/,
    /^([^\/]+\/[^\/]+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return url;
}

export function RunHistory({ runs, currentRunId, onSelectRun, onDeleteRun }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <div className="p-4 text-center text-ocean-500 text-sm">
        No analysis history yet.
        <br />
        <span className="text-ocean-600">Enter a repo URL to start.</span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-ocean-800">
      {runs.map((run) => {
        const StatusIcon = statusIcons[run.status];
        const isActive = run.id === currentRunId;
        
        return (
          <div
            key={run.id}
            onClick={() => onSelectRun(run.id)}
            className={clsx(
              'flex items-center gap-3 p-3 cursor-pointer transition-colors',
              isActive
                ? 'bg-ocean-800/50 border-l-2 border-neon-blue'
                : 'hover:bg-ocean-800/30 border-l-2 border-transparent'
            )}
          >
            <StatusIcon
              className={clsx(
                'w-4 h-4 shrink-0',
                statusColors[run.status],
                run.status === 'running' && 'animate-spin'
              )}
            />
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono text-ocean-200 truncate">
                {extractRepoName(run.repoUrl)}
              </div>
              <div className="flex items-center gap-2 text-xs text-ocean-500">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(run.createdAt)}
              </div>
            </div>
            
            {onDeleteRun && run.status !== 'running' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRun(run.id);
                }}
                className="p-1 text-ocean-600 hover:text-neon-red transition-colors"
                title="Delete run"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
