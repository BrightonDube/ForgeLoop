import React from 'react';
import { AgentPhase } from '../types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface PhaseTrackerProps {
  currentPhase: AgentPhase;
}

const phases = [
  { id: AgentPhase.INGESTION, label: 'Ingest' },
  { id: AgentPhase.PLANNING, label: 'Plan' },
  { id: AgentPhase.EXECUTION, label: 'Execute' },
  { id: AgentPhase.OBSERVATION, label: 'Observe' },
  { id: AgentPhase.VERIFICATION, label: 'Verify' },
  { id: AgentPhase.DELIVERY, label: 'Deliver' },
];

export const PhaseTracker: React.FC<PhaseTrackerProps> = ({ currentPhase }) => {
  const currentIndex = phases.findIndex(p => p.id === currentPhase);

  return (
    <div className="w-full bg-ocean-800 p-4 rounded-lg border border-ocean-700">
      <h3 className="text-sm font-semibold text-ocean-300 mb-4 uppercase tracking-wider">Control Loop</h3>
      <div className="flex justify-between items-center relative">
        {/* Progress Bar Background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-ocean-700 -z-0"></div>
        
        {/* Active Progress Bar */}
        <div 
            className="absolute top-1/2 left-0 h-1 bg-neon-blue transition-all duration-500 -z-0"
            style={{ width: `${(currentIndex / (phases.length - 1)) * 100}%` }}
        ></div>

        {phases.map((phase, idx) => {
            const isActive = phase.id === currentPhase;
            const isCompleted = currentIndex > idx;
            const isPending = currentIndex < idx;

            return (
                <div key={phase.id} className="relative z-10 flex flex-col items-center group">
                    <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-ocean-900",
                        isActive ? "border-neon-blue text-neon-blue scale-110" : 
                        isCompleted ? "border-neon-green text-neon-green" : 
                        "border-ocean-600 text-ocean-600"
                    )}>
                        {isActive && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isCompleted && <CheckCircle2 className="w-5 h-5" />}
                        {isPending && <Circle className="w-4 h-4" />}
                    </div>
                    <span className={clsx(
                        "mt-2 text-xs font-mono transition-colors",
                        isActive ? "text-neon-blue font-bold" : 
                        isCompleted ? "text-neon-green" : 
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