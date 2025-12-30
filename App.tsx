import React, { useState, useEffect } from 'react';
import { LogTerminal } from './components/LogTerminal';
import { VisualDiffViewer } from './components/VisualDiffViewer';
import { PhaseTracker } from './components/PhaseTracker';
import { ChatInterface } from './components/ChatInterface';
import { FileExplorer } from './components/FileExplorer'; 
import { IssueList } from './components/IssueList';
import { api } from './server/api';
import { AgentPhase, LogEntry, Run, RepoFile, Issue, CodeDiffState, VisionResult } from './types';
import { Play, Square, Github, MessageSquare, Activity, Cpu, Code2, Terminal, AlertCircle, KeyRound, ArrowRight, CheckCircle, ShieldCheck, XCircle } from 'lucide-react';
import clsx from 'clsx';

function App() {
  // Config State
  const [config, setConfig] = useState({ owner: '', repo: '', token: '' });
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  // Application State
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runData, setRunData] = useState<Run | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<RepoFile[]>([]); 
  const [issues, setIssues] = useState<Issue[]>([]);
  const [diff, setDiff] = useState<CodeDiffState | null>(null);
  const [pr, setPr] = useState<{url: string} | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'logs' | 'files' | 'issues'>('logs');

  // Load credentials on mount (Simulating Session Check)
  useEffect(() => {
    const savedConfig = localStorage.getItem('forgeloop_config');
    if (savedConfig) {
        try {
            const parsed = JSON.parse(savedConfig);
            if (parsed.token) {
                setConfig(parsed);
                // Attempt silent login
                api.login(parsed).then(success => {
                    if (success) {
                        // Don't auto-start, just prep UI
                        // setRememberMe(true);
                    }
                });
            }
        } catch (e) {
            console.error("Failed to load saved config");
        }
    }
  }, []);

  // Polling Mechanism
  useEffect(() => {
    if (!activeRunId) return;

    const tick = async () => {
        try {
            const state = await api.getRunState(activeRunId);
            setRunData(state.run);
            setLogs(state.logs);
            setFiles(state.files || []);
            setIssues(state.issues || []);
            setDiff(state.diff || null);
            setPr(state.pr || null);
            setVision(state.vision || null);
        } catch (e) {
            console.error("Failed to fetch state", e);
        }
    };

    const interval = setInterval(tick, 1000);
    tick(); 
    return () => clearInterval(interval);
  }, [activeRunId]);

  const handleInitialize = async () => {
    // 1. Login to Server
    const success = await api.login({
        token: config.token.trim(),
        owner: config.owner.trim(),
        repo: config.repo.trim()
    });

    if (!success) {
        alert("Invalid Configuration");
        return;
    }

    // 2. Persist to LocalStorage if requested (Encrypted in real app, raw here for demo)
    if (rememberMe) {
        localStorage.setItem('forgeloop_config', JSON.stringify(config));
    } else {
        localStorage.removeItem('forgeloop_config');
    }

    // 3. Clear UI Config State (Security)
    // We do NOT clear `config` state variable immediately because we need it to render the header
    // but in a real app, `config` would be derived from the session check.
    
    setIsConfiguring(false);
    
    // 4. Start Run
    const newRun = await api.startRun();
    setRunData(newRun);
    setActiveRunId(newRun.id);
    setLeftTab('logs');
  };

  const handleStop = async () => {
    if (activeRunId) {
        await api.stopRun(activeRunId);
    }
  };

  const handleApprove = async () => {
      if (activeRunId) {
          await api.approveFix(activeRunId);
      }
  };

  const handleReject = async () => {
      if (activeRunId) {
          await api.rejectFix(activeRunId);
      }
  };

  const handleRestart = async () => {
      // Logic to start a fresh run with same config
      const newRun = await api.startRun();
      setRunData(newRun);
      setActiveRunId(newRun.id);
      setLeftTab('logs');
      // Clear legacy state
      setDiff(null);
      setPr(null);
      setVision(null);
      setIssues([]);
      setFiles([]);
      setLogs([]);
  };

  const isRunning = runData?.status === 'running' || runData?.status === 'paused';
  const currentPhase = runData?.currentPhase || AgentPhase.IDLE;
  
  // CRITICAL FIX: Only show approval overlay if the system is PAUSED.
  // If user rejects, status becomes 'failed', and overlay disappears.
  const isApprovalOverlayVisible = currentPhase === AgentPhase.APPROVAL && runData?.status === 'paused';

  if (isConfiguring) {
      return (
          <div className="min-h-screen bg-ocean-900 flex items-center justify-center p-6 font-sans text-ocean-100">
              <div className="w-full max-w-md bg-ocean-800 border border-ocean-700 rounded-xl p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg shadow-neon-blue/20">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold">ForgeLoop</h1>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-mono text-ocean-400 mb-1">GitHub Personal Access Token</label>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-ocean-500" />
                            <input 
                                type="password" 
                                value={config.token}
                                onChange={e => setConfig({...config, token: e.target.value})}
                                placeholder="ghp_..."
                                className="w-full bg-ocean-900 border border-ocean-700 rounded p-2 pl-9 focus:border-neon-blue focus:outline-none text-sm"
                            />
                          </div>
                          <p className="text-[10px] text-ocean-500 mt-1">
                            Generate a <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-neon-blue hover:underline">Classic Token</a> with <code>repo</code> scope.
                          </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-mono text-ocean-400 mb-1">Owner</label>
                            <input 
                                type="text" 
                                value={config.owner}
                                onChange={e => setConfig({...config, owner: e.target.value})}
                                placeholder="facebook"
                                className="w-full bg-ocean-900 border border-ocean-700 rounded p-2 focus:border-neon-blue focus:outline-none text-sm"
                            />
                            <p className="text-[10px] text-ocean-500 mt-1 truncate">
                              github.com/<span className="text-neon-blue font-bold">owner</span>/repo
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-mono text-ocean-400 mb-1">Repo</label>
                            <input 
                                type="text" 
                                value={config.repo}
                                onChange={e => setConfig({...config, repo: e.target.value})}
                                placeholder="react"
                                className="w-full bg-ocean-900 border border-ocean-700 rounded p-2 focus:border-neon-blue focus:outline-none text-sm"
                            />
                            <p className="text-[10px] text-ocean-500 mt-1 truncate">
                              github.com/owner/<span className="text-neon-blue font-bold">repo</span>
                            </p>
                          </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                          <input 
                            type="checkbox" 
                            id="remember-me"
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-ocean-600 bg-ocean-900 text-neon-blue"
                          />
                          <label htmlFor="remember-me" className="text-xs text-ocean-400 cursor-pointer">
                            Remember configuration
                          </label>
                      </div>

                      <button 
                        onClick={handleInitialize}
                        disabled={!config.token || !config.owner || !config.repo}
                        className="w-full bg-neon-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition-colors flex items-center justify-center gap-2 mt-4"
                      >
                          Initialize Orchestrator <ArrowRight className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          </div>
      );
  }

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
                <p className="text-xs text-ocean-400 font-mono">Multi-Agent System</p>
            </div>
        </div>

        <div className="flex items-center gap-4 bg-ocean-800 py-1.5 px-3 rounded-full border border-ocean-700">
            <Github className="w-4 h-4 text-ocean-500" />
            <span className="text-xs text-ocean-300 font-mono">{config.owner}/{config.repo}</span>
            <div className="h-4 w-px bg-ocean-600"></div>
            <span className={clsx("text-xs font-bold", isRunning ? "text-neon-green animate-pulse" : "text-ocean-500")}>
                {runData?.status === 'paused' ? 'WAITING FOR APPROVAL' : isRunning ? "LIVE" : "STANDBY"}
            </span>
        </div>

        <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={clsx(
                    "p-2 rounded-md transition-all border",
                    isChatOpen ? "bg-neon-purple/10 border-neon-purple text-neon-purple" : "bg-ocean-800 border-ocean-700 hover:border-ocean-500 text-ocean-300"
                )}
             >
                <MessageSquare className="w-4 h-4" />
            </button>
            <div className="h-6 w-px bg-ocean-700 mx-1"></div>
            {isRunning || runData?.status === 'paused' ? (
                 <button 
                    onClick={handleStop}
                    className="flex items-center gap-2 bg-ocean-800 hover:bg-ocean-700 text-neon-red border border-ocean-700 hover:border-neon-red px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                >
                    <Square className="w-4 h-4 fill-current" />
                    Stop
                </button>
            ) : (
                <button 
                    onClick={() => setIsConfiguring(true)}
                    className="flex items-center gap-2 bg-ocean-800 text-ocean-300 border border-ocean-700 px-4 py-1.5 rounded-md text-sm font-medium hover:text-white transition-colors"
                >
                    New Session
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 pb-6 h-screen flex flex-col gap-6">
        
        <div className="shrink-0">
            <PhaseTracker currentPhase={currentPhase} runStatus={runData?.status} />
        </div>

        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
            
            {/* Left Column */}
            <div className="col-span-5 h-full flex flex-col min-h-0 gap-2">
                <div className="flex gap-2 border-b border-ocean-700/50">
                    <button onClick={() => setLeftTab('logs')} className={clsx("flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors", leftTab === 'logs' ? "bg-ocean-800 text-white border-t border-x border-ocean-700" : "text-ocean-500 hover:text-ocean-300")}>
                        <Terminal className="w-3.5 h-3.5" /> Live Logs
                    </button>
                    <button onClick={() => setLeftTab('files')} className={clsx("flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors", leftTab === 'files' ? "bg-ocean-800 text-white border-t border-x border-ocean-700" : "text-ocean-500 hover:text-ocean-300")}>
                        <Code2 className="w-3.5 h-3.5" /> Source
                    </button>
                    <button onClick={() => setLeftTab('issues')} className={clsx("flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors", leftTab === 'issues' ? "bg-ocean-800 text-white border-t border-x border-ocean-700" : "text-ocean-500 hover:text-ocean-300")}>
                        <AlertCircle className="w-3.5 h-3.5" /> Findings
                    </button>
                </div>
                
                <div className="flex-1 min-h-0">
                    {leftTab === 'logs' && <LogTerminal logs={logs} />}
                    {leftTab === 'files' && <FileExplorer files={files} />}
                    {leftTab === 'issues' && <IssueList issues={issues} />}
                </div>
            </div>

            {/* Right Column */}
            <div className="col-span-7 h-full flex flex-col gap-6 min-h-0 relative">
                
                {/* Visual Diff / Approval / Success */}
                <div className="flex-1 min-h-0 relative">
                    {isApprovalOverlayVisible ? (
                         <div className="absolute inset-0 bg-ocean-800/95 backdrop-blur-sm z-50 rounded-lg flex flex-col items-center justify-center p-8 border border-neon-blue/50 shadow-2xl animate-in fade-in duration-300">
                            <ShieldCheck className="w-16 h-16 text-neon-blue mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">Human Approval Required</h2>
                            <p className="text-ocean-300 text-center max-w-md mb-6">
                                Review the fix below. You can analyze the changeset and the Agent's visual verification snapshot before proceeding.
                            </p>
                            
                            <div className="w-full max-w-2xl bg-ocean-900 rounded border border-ocean-700 p-4 mb-6 max-h-[400px] overflow-auto custom-scroll shadow-inner">
                                <h3 className="text-xs font-bold text-ocean-400 uppercase mb-2 sticky top-0 bg-ocean-900 pb-2 z-10 border-b border-ocean-800">Review Changeset</h3>
                                <VisualDiffViewer diff={diff} vision={vision} />
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={handleReject}
                                    className="bg-ocean-800 hover:bg-red-900/30 text-red-400 border border-red-900/50 font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Reject Fix
                                </button>
                                <button 
                                    onClick={handleApprove}
                                    className="bg-neon-blue hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-neon-blue/20 transition-transform transform hover:scale-105 flex items-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Approve & Deploy
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <VisualDiffViewer diff={diff} prUrl={pr?.url} vision={vision} onRestart={handleRestart} status={runData?.status} />
                </div>

                {/* System Stats */}
                <div className="h-32 grid grid-cols-3 gap-4">
                    <div className="bg-ocean-800 rounded-lg p-4 border border-ocean-700 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-ocean-400">
                            <span className="text-xs font-mono uppercase">Context</span>
                            <Cpu className="w-4 h-4" />
                        </div>
                        <div className="text-2xl font-mono text-neon-green">
                            {files.reduce((acc, f) => acc + f.content.length, 0).toLocaleString()} <span className="text-sm text-ocean-500">chars</span>
                        </div>
                        <div className="text-xs text-ocean-500">Knowledge Graph Size</div>
                    </div>

                     <div className="bg-ocean-800 rounded-lg p-4 border border-ocean-700 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-ocean-400">
                            <span className="text-xs font-mono uppercase">Analyst</span>
                            <AlertCircle className="w-4 h-4 text-neon-yellow" />
                        </div>
                        <div className="text-lg font-mono text-white truncate">
                             {issues.length > 0 ? `${issues.length} Issues` : 'Scanning...'}
                        </div>
                        <div className="text-xs text-ocean-500">Pending Resolutions</div>
                    </div>

                    <div className="bg-ocean-800 rounded-lg p-4 border border-ocean-700 flex flex-col justify-between group cursor-pointer hover:border-neon-blue transition-colors">
                        <div className="flex items-center justify-between text-ocean-400">
                            <span className="text-xs font-mono uppercase">Delivery</span>
                            <Github className="w-4 h-4" />
                        </div>
                         <div className="text-lg font-mono text-neon-blue group-hover:underline truncate">
                            {pr ? "PR Created" : "Pending"}
                        </div>
                        <div className="text-xs text-ocean-500">Automated Pull Request</div>
                    </div>
                </div>
            </div>
        </div>
      </main>

      <ChatInterface logs={logs} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}

export default App;