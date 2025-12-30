import React, { useEffect, useRef } from 'react';
import { LogEntry, LogLevel } from '../types';
import { Terminal, Brain, Eye, Hammer, Cpu, GitBranch, ShieldCheck, UserCog } from 'lucide-react';
import clsx from 'clsx';

interface LogTerminalProps {
  logs: LogEntry[];
}

const getIcon = (subsystem: string) => {
  switch (subsystem) {
    case 'ORCHESTRATOR': return <Brain className="w-4 h-4 text-neon-purple" />;
    case 'ANALYST': return <Eye className="w-4 h-4 text-neon-blue" />;
    case 'CODER': return <Hammer className="w-4 h-4 text-neon-yellow" />;
    case 'QA': return <ShieldCheck className="w-4 h-4 text-neon-green" />;
    case 'GITHUB': return <GitBranch className="w-4 h-4 text-white" />;
    case 'SYSTEM': return <Cpu className="w-4 h-4 text-ocean-400" />;
    default: return <Terminal className="w-4 h-4" />;
  }
};

const getLevelColor = (level: LogLevel) => {
  switch (level) {
    case LogLevel.ERROR: return 'text-neon-red';
    case LogLevel.WARN: return 'text-neon-yellow';
    case LogLevel.SUCCESS: return 'text-neon-green';
    case LogLevel.THOUGHT: return 'text-neon-purple italic';
    default: return 'text-ocean-300';
  }
};

export const LogTerminal: React.FC<LogTerminalProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-ocean-900 rounded-lg border border-ocean-700 overflow-hidden font-mono text-sm shadow-xl">
      <div className="bg-ocean-800 p-3 flex items-center justify-between border-b border-ocean-700">
        <div className="flex items-center gap-2 text-ocean-300">
          <Terminal className="w-4 h-4" />
          <span className="font-semibold">Agent Thought Stream</span>
        </div>
        <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
        {logs.length === 0 && (
            <div className="text-ocean-500 text-center mt-10 italic">Waiting for connection...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300 items-start">
            <div className="text-ocean-500 text-xs w-16 shrink-0 pt-0.5 whitespace-nowrap">{log.timestamp}</div>
            <div className="shrink-0 pt-0.5 opacity-70 group-hover:opacity-100 transition-opacity" title={log.subsystem}>
                {getIcon(log.subsystem)}
            </div>
            <div className="flex-1 min-w-0">
                <span className={clsx("block whitespace-pre-wrap break-words", getLevelColor(log.level))}>
                    {log.message}
                </span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};