
import React from 'react';
import { CodeDiffState, VisionResult } from '../types';
import { FileDiff, ArrowRight, Github, RotateCcw, AlertTriangle, ShieldCheck, XCircle, CheckCircle2 } from 'lucide-react';

interface CodeDiffViewerProps {
  diff: CodeDiffState | null;
  prUrl?: string;
  vision?: VisionResult | null;
  onRestart?: () => void;
  status?: string;
}

export const VisualDiffViewer: React.FC<CodeDiffViewerProps> = ({ diff, prUrl, vision, onRestart, status }) => {
  
  // 1. Explicit Failure (User Rejected)
  if (status === 'failed') {
      return (
        <div className="h-full bg-ocean-800 rounded-lg border border-ocean-700 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
             <div className="w-24 h-24 bg-neon-red/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <XCircle className="w-12 h-12 text-neon-red" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Fix Rejected</h2>
            <p className="text-ocean-300 mb-8 max-w-md mx-auto leading-relaxed">
                The fix was rejected during manual review. No changes were committed to the remote repository.
            </p>
             <button 
                onClick={onRestart}
                className="bg-ocean-700 hover:bg-ocean-600 text-white font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2"
            >
                <RotateCcw className="w-5 h-5" />
                Start New Session
            </button>
        </div>
      );
  }

  // 2. Stopped / Gave Up (System Limit or Low Confidence)
  if (status === 'stopped') {
      return (
        <div className="h-full bg-ocean-800 rounded-lg border border-ocean-700 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
             <div className="w-24 h-24 bg-neon-yellow/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <AlertTriangle className="w-12 h-12 text-neon-yellow" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Optimization Stopped</h2>
            <p className="text-ocean-300 mb-8 max-w-md mx-auto leading-relaxed">
                The agent concluded the session without applying changes. This usually occurs when a high-confidence fix cannot be verified, or to prevent regression loops.
            </p>
             <button 
                onClick={onRestart}
                className="bg-ocean-700 hover:bg-ocean-600 text-white font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2"
            >
                <RotateCcw className="w-5 h-5" />
                Start New Session
            </button>
        </div>
      );
  }

  // 3. Success: PR Created
  if (prUrl) {
      return (
          <div className="h-full bg-ocean-800 rounded-lg border border-ocean-700 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-neon-green/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <Github className="w-12 h-12 text-neon-green" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Mission Accomplished</h2>
              <p className="text-ocean-300 mb-8 max-w-md mx-auto leading-relaxed">
                ForgeLoop has successfully repaired the codebase, verified the fix, and opened a Pull Request for your review.
              </p>
              
              <div className="flex flex-col gap-4 w-full max-w-sm">
                  <a 
                    href={prUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-neon-green hover:bg-green-600 text-ocean-900 font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 shadow-lg hover:shadow-neon-green/20"
                  >
                      <Github className="w-5 h-5" />
                      Open Pull Request
                      <ArrowRight className="w-5 h-5" />
                  </a>
                  <p className="text-xs text-ocean-500 font-mono break-all mb-4">{prUrl}</p>

                   <button 
                        onClick={onRestart}
                        className="bg-ocean-700 hover:bg-ocean-600 text-ocean-200 py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Analyze Repo Again
                    </button>
              </div>
          </div>
      );
  }

  // 4. Completed but NO PR (Healthy)
  if (status === 'completed' && !prUrl) {
      return (
        <div className="h-full bg-ocean-800 rounded-lg border border-ocean-700 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
             <div className="w-24 h-24 bg-neon-blue/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <ShieldCheck className="w-12 h-12 text-neon-blue" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Repository Healthy</h2>
            <p className="text-ocean-300 mb-8 max-w-md mx-auto leading-relaxed">
                Analysis complete. No critical defects or regressions were detected that required intervention.
            </p>
             <button 
                onClick={onRestart}
                className="bg-ocean-700 hover:bg-ocean-600 text-white font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2"
            >
                <RotateCcw className="w-5 h-5" />
                Start New Session
            </button>
        </div>
      );
  }

  if (!diff) {
    return (
      <div className="h-full bg-ocean-800 rounded-lg border border-ocean-700 border-dashed flex flex-col items-center justify-center text-ocean-500">
        <FileDiff className="w-12 h-12 mb-3 opacity-50" />
        <p>Waiting for code modifications...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
        {/* Screenshot View (If available) */}
        {vision && (
             <div className="h-48 shrink-0 bg-ocean-800 rounded-lg border border-ocean-700 overflow-hidden relative group">
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur text-white text-[10px] px-2 py-1 rounded">
                    Verification Screenshot (Agent View)
                </div>
                <img src={vision.screenshotUrl} alt="Agent Vision" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity" />
             </div>
        )}

        {/* Code Diff View */}
        <div className="flex-1 flex flex-col bg-ocean-800 rounded-lg border border-ocean-700 overflow-hidden font-mono text-xs">
            <div className="p-3 border-b border-ocean-700 bg-ocean-900 flex justify-between items-center">
                <span className="text-ocean-300">Modifying: <span className="text-neon-blue">{diff?.filePath}</span></span>
                <span className="text-xs bg-neon-purple/10 text-neon-purple px-2 py-0.5 rounded">AI Generated Patch</span>
            </div>
            
            <div className="flex-1 grid grid-cols-2 divide-x divide-ocean-700 overflow-hidden">
                <div className="flex flex-col">
                    <div className="bg-red-500/10 text-red-400 p-2 text-center border-b border-red-500/20">Original</div>
                    <div className="flex-1 overflow-auto p-4 whitespace-pre bg-ocean-900/50 custom-scroll text-ocean-400">
                        {diff?.original}
                    </div>
                </div>
                <div className="flex flex-col">
                    <div className="bg-green-500/10 text-green-400 p-2 text-center border-b border-green-500/20">Proposed Fix</div>
                    <div className="flex-1 overflow-auto p-4 whitespace-pre bg-ocean-900/50 custom-scroll text-ocean-100">
                        {diff?.modified}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
