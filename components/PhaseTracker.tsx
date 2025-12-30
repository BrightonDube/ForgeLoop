
import React from 'react';
import { AgentPhase } from '../types';
import { CheckCircle2, Circle, Loader2, BrainCircuit } from 'lucide-react';
import clsx from 'clsx';

interface PhaseTrackerProps {
  currentPhase: AgentPhase;
  runStatus?: string; // Add this prop
}

const phases = [
  { id: AgentPhase.BOOTING, label: 'Boot' },
  { id: AgentPhase.OBSERVING, label: 'Observe' },
  { id: AgentPhase.DIAGNOSING, label: 'Diagnose' },
  { id: AgentPhase.PLANNING, label: 'Plan' },
  { id: AgentPhase.VERIFYING, label: 'Verify' },
  { id: AgentPhase.REFLECTING, label: 'Reflect' },
];

export const PhaseTracker: React.FC<PhaseTrackerProps> = ({ currentPhase, runStatus }) => {
  const currentIndex = phases.findIndex(p => p.id === currentPhase);
  // Only animate if the run is actually running or paused (waiting for approval)
  const isRunning = runStatus === 'running' || runStatus === 'paused';

  return (
    <div className="w-full bg-ocean-800 p-4 rounded-lg border border-ocean-700 overflow-x-auto">
      <div className="flex justify-between items-center mb-4 min-w-[600px]">
         <h3 className="text-sm font-semibold text-ocean-300 uppercase tracking-wider flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-neon-purple" />
            Cognitive State Machine
         </h3>
         <span className="text-xs text-ocean-500 font-mono">Model: Gemini 3 Pro</span>
      </div>
      
      <div className="flex justify-between items-center relative min-w-[600px] px-4">
        {/* Progress Bar Background */}
        <div className="absolute top-1/2 left-4 right-4 h-1 bg-ocean-700 -z-0"></div>
        
        {/* Active Progress Bar */}
        <div 
            className="absolute top-1/2 left-4 h-1 bg-neon-purple transition-all duration-500 -z-0"
            style={{ width: `${(currentIndex / (phases.length - 1)) * 100}%` }}
        ></div>

        {phases.map((phase, idx) => {
            const isActive = phase.id === currentPhase && isRunning; // Stop spinning if stopped
            const isCompleted = currentIndex > idx;
            const isPending = currentIndex < idx;

            // Use the phase icon itself as the indicator if active/done isn't enough? No, standard bubbles are better.

            return (
                <div key={phase.id} className="relative z-10 flex flex-col items-center group">
                    <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-ocean-900",
                        isActive ? "border-neon-purple text-neon-purple scale-110 shadow-[0_0_15px_rgba(139,92,246,0.5)]" : 
                        isCompleted ? "border-neon-purple/50 text-neon-purple/50 bg-ocean-900" : 
                        "border-ocean-600 text-ocean-600"
                    )}>
                        {isActive && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isCompleted && <CheckCircle2 className="w-5 h-5" />}
                        {isPending && <Circle className="w-4 h-4" />}
                        {!isActive && !isCompleted && !isPending && <Circle className="w-4 h-4" />}
                        {/* Fallback for when stopped on current phase */}
                        {phase.id === currentPhase && !isRunning && <CheckCircle2 className="w-5 h-5 text-ocean-400" />}
                    </div>
                    <span className={clsx(
                        "mt-3 text-[10px] font-mono uppercase tracking-wider transition-colors",
                        isActive ? "text-neon-purple font-bold" : 
                        isCompleted ? "text-neon-purple/70" : 
                        "text-ocean-500"
                    )}>
                        {phase.label}
                    </span>
                </div>
            );
        })}
      </div>
    </div>
  );
};
