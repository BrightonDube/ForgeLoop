import React, { useState, useEffect, useCallback } from 'react';
import { LogTerminal } from './components/LogTerminal';
import { VisualDiffViewer } from './components/VisualDiffViewer';
import { PhaseTracker } from './components/PhaseTracker';
import { ChatInterface } from './components/ChatInterface';
import { FileExplorer } from './components/FileExplorer'; 
import { IssueList } from './components/IssueList';
import { api as simulatedApi } from './server/api';
import { api as realApi } from './services/realApi';
import { AgentPhase, LogEntry, VisualDiffState, Run, RepoFile, Issue } from './types';
import { Play, Square, Github, MessageSquare, Activity, Cpu, Database as DbIcon, Code2, Terminal, AlertCircle, Loader2, Check, X } from 'lucide-react';
import clsx from 'clsx';

// Configuration
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';
const api = USE_REAL_BACKEND ? realApi : simulatedApi;
const POLL_INTERVAL = 500;

function App() {
  // Application State
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [repoValidation, setRepoValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runData, setRunData] = useState<Run | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<RepoFile[]>([]); 
  const [issues, setIssues] = useState<Issue[]>([]);
  const [visualDiff, setVisualDiff] = useState<VisualDiffState>({ beforeUrl: null, afterUrl: null, detectedIssues: [] });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'logs' | 'files' | 'issues'>('logs');

  // Polling Mechanism (Simulating Socket/Server Push)
  useEffect(() => {
    if (!activeRunId) return;

    const tick = async () => {
        try {
            const state = await api.getRunState(activeRunId);
            setRunData(state.run);
            setLogs(state.logs);
            setFiles(state.files || []);
            setIssues(state.issues || []); // Set issues
            if (state.visualDiff) {
                setVisualDiff(state.visualDiff);
            }
            
            if (state.run.status !== 'running') {
                setActiveRunId(null); 
            }
        } catch (e) {
            console.error("Failed to fetch state", e);
        }
    };

    const interval = setInterval(tick, POLL_INTERVAL);
    tick(); 
    return () => clearInterval(interval);
  }, [activeRunId]);

  const handleStart = async () => {
    if (!repoUrl.trim()) {
      setRepoValidation({ valid: false, message: 'Please enter a repository URL' });
      return;
    }
    
    try {
        setLogs([]);
        setFiles([]);
        setIssues([]);
        setVisualDiff({ beforeUrl: null, afterUrl: null, detectedIssues: [] });
        const targetUrl = repoUrl.trim() || 'github.com/demo/broken-app';
        const newRun = await api.startRun(targetUrl);
        setRunData(newRun);
        setActiveRunId(newRun.id);
        setLeftTab('logs');
    } catch (e) {
        console.error("Failed to start run", e);
        setRepoValidation({ valid: false, message: `Failed to start: ${e}` });
    }
  };

  const handleStop = async () => {
    if (activeRunId) {
        await api.stopRun(activeRunId);
        setActiveRunId(null);
    }
  };

  const isRunning = runData?.status === 'running';
  const currentPhase = runData?.currentPhase || AgentPhase.IDLE;

  return (
    <div className="min-h-screen bg-ocean-900 text-ocean-100 font-sans selection:bg-neon-blue/30">
      
      {/* Header */}
      <header className="h-16 border-b border-ocean-700 bg-ocean-900/80 backdrop-blur-md fixed top-0 w-full z-40 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg shadow-neon-blue/20">
                <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="font-bold text-lg tracking-tight">ForgeLoop</h1>
                <p className="text-xs text-ocean-400 font-mono">
                  {USE_REAL_BACKEND ? 'Real Backend Mode' : 'Simulation Mode'}
                </p>
            </div>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xl mx-6">
            <Github className="w-5 h-5 text-ocean-400 shrink-0" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setRepoValidation(null);
              }}
              placeholder="Enter GitHub repo URL (e.g., owner/repo)"
              disabled={isRunning}
              className={clsx(
                "flex-1 bg-ocean-800 border rounded-md px-3 py-1.5 text-sm font-mono text-ocean-100 placeholder:text-ocean-600 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 transition-all",
                isRunning ? "opacity-50 cursor-not-allowed" : "",
                repoValidation?.valid === false ? "border-neon-red" : "border-ocean-700"
              )}
            />
            {repoValidation && (
              <span className={clsx(
                "text-xs shrink-0",
                repoValidation.valid ? "text-neon-green" : "text-neon-red"
              )}>
                {repoValidation.valid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </span>
            )}
        </div>

        <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={clsx(
                    "p-2 rounded-md transition-all border",
                    isChatOpen ? "bg-neon-purple/10 border-neon-purple text-neon-purple" : "bg-ocean-800 border-ocean-700 hover:border-ocean-500 text-ocean-300"
                )}
                title="Consult Architect"
             >
                <MessageSquare className="w-4 h-4" />
            </button>
            <div className="h-6 w-px bg-ocean-700 mx-1"></div>
            {!isRunning ? (
                <button 
                    onClick={handleStart}
                    disabled={!repoUrl.trim()}
                    className={clsx(
                      "flex items-center gap-2 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-lg",
                      repoUrl.trim() 
                        ? "bg-neon-blue hover:bg-blue-600 shadow-neon-blue/20" 
                        : "bg-ocean-700 cursor-not-allowed opacity-50"
                    )}
                >
                    <Play className="w-4 h-4" />
                    Analyze
                </button>
            ) : (
                <button 
                    onClick={handleStop}
                    className="flex items-center gap-2 bg-ocean-800 hover:bg-ocean-700 text-neon-red border border-ocean-700 hover:border-neon-red px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                >
                    <Square className="w-4 h-4 fill-current" />
                    Stop
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 pb-6 h-screen flex flex-col gap-6">
        
        {/* Top Row: Phase Tracker */}
        <div className="shrink-0">
            <PhaseTracker currentPhase={currentPhase} />
        </div>

        {/* Middle Row: Split View */}
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
            
            {/* Left Column: Logs / File Explorer / Issues (Tabbed) */}
            <div className="col-span-5 h-full flex flex-col min-h-0 gap-2">
                <div className="flex gap-2 border-b border-ocean-700/50">
                    <button 
                        onClick={() => setLeftTab('logs')}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors",
                            leftTab === 'logs' 
                                ? "bg-ocean-800 text-white border-t border-x border-ocean-700" 
                                : "text-ocean-500 hover:text-ocean-300"
                        )}
                    >
                        <Terminal className="w-3.5 h-3.5" />
                        Live Logs
                    </button>
                    <button 
                         onClick={() => setLeftTab('files')}
                         className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors",
                            leftTab === 'files' 
                                ? "bg-ocean-800 text-white border-t border-x border-ocean-700" 
                                : "text-ocean-500 hover:text-ocean-300"
                        )}
                    >
                        <Code2 className="w-3.5 h-3.5" />
                        Repo
                    </button>
                    <button 
                         onClick={() => setLeftTab('issues')}
                         className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors",
                            leftTab === 'issues' 
                                ? "bg-ocean-800 text-white border-t border-x border-ocean-700" 
                                : "text-ocean-500 hover:text-ocean-300"
                        )}
                    >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Issues {issues.length > 0 && `(${issues.length})`}
                    </button>
                </div>
                
                <div className="flex-1 min-h-0">
                    {leftTab === 'logs' && <LogTerminal logs={logs} />}
                    {leftTab === 'files' && <FileExplorer files={files} />}
                    {leftTab === 'issues' && <IssueList issues={issues} />}
                </div>
            </div>

            {/* Right Column: Visuals & Stats (Hands & Eyes) */}
            <div className="col-span-7 h-full flex flex-col gap-6 min-h-0">
                
                {/* Visual Diff Viewer */}
                <div className="flex-1 min-h-0">
                    <VisualDiffViewer diffState={visualDiff} />
                </div>

                {/* System Stats / Mini Dashboard */}
                <div className="h-32 grid grid-cols-3 gap-4">
                    <div className="bg-ocean-800 rounded-lg p-4 border border-ocean-700 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-ocean-400">
                            <span className="text-xs font-mono uppercase">Context</span>
                            <Cpu className="w-4 h-4" />
                        </div>
                        <div className="text-2xl font-mono text-neon-green">
                            {isRunning ? "1.2M" : "0"} <span className="text-sm text-ocean-500">tok</span>
                        </div>
                        <div className="text-xs text-ocean-500">Gemini 3 Pro Active</div>
                    </div>

                     <div className="bg-ocean-800 rounded-lg p-4 border border-ocean-700 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-ocean-400">
                            <span className="text-xs font-mono uppercase">Database</span>
                            <DbIcon className="w-4 h-4 text-neon-yellow" />
                        </div>
                        <div className="text-lg font-mono text-white truncate">Local Persistence</div>
                        <div className="text-xs text-ocean-500">
                            {files.length > 0 ? `${files.length} files tracked` : 'Empty'}
                        </div>
                    </div>

                    <div className="bg-ocean-800 rounded-lg p-4 border border-ocean-700 flex flex-col justify-between group cursor-pointer hover:border-neon-blue transition-colors">
                        <div className="flex items-center justify-between text-ocean-400">
                            <span className="text-xs font-mono uppercase">Pull Request</span>
                            <Github className="w-4 h-4" />
                        </div>
                         <div className="text-lg font-mono text-neon-blue group-hover:underline">
                            {currentPhase === AgentPhase.DELIVERY ? "#42 created" : "--"}
                        </div>
                        <div className="text-xs text-ocean-500">fix/header-z-index</div>
                    </div>
                </div>
            </div>
        </div>
      </main>

      {/* Chat Drawer */}
      <ChatInterface logs={logs} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}

export default App;