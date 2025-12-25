import React from 'react';
import { Issue } from '../types';
import { AlertTriangle, CheckCircle2, CircleDashed, AlertOctagon } from 'lucide-react';
import clsx from 'clsx';

interface IssueListProps {
  issues: Issue[];
}

export const IssueList: React.FC<IssueListProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
        <div className="h-full bg-ocean-900 rounded-lg border border-ocean-700 flex flex-col items-center justify-center text-ocean-500 font-mono text-xs">
            <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
            <p>No issues detected yet.</p>
        </div>
    );
  }

  // Sort by priority
  const sortedIssues = [...issues].sort((a, b) => {
      const pMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return pMap[b.priority] - pMap[a.priority];
  });

  return (
    <div className="flex flex-col h-full bg-ocean-900 rounded-lg border border-ocean-700 overflow-hidden font-mono text-sm shadow-xl">
         <div className="p-3 border-b border-ocean-700 font-semibold text-ocean-300 text-xs uppercase tracking-wider flex items-center gap-2 bg-ocean-800">
            <AlertOctagon className="w-4 h-4" />
            Detected Issues
            <span className="ml-auto bg-ocean-700 text-ocean-300 px-2 py-0.5 rounded-full text-[10px]">{issues.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-2">
            {sortedIssues.map(issue => (
                <div key={issue.id} className="bg-ocean-800 border border-ocean-700 rounded p-3 hover:border-ocean-600 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                             <span className={clsx(
                                 "text-[10px] px-1.5 py-0.5 rounded font-bold",
                                 issue.priority === 'HIGH' ? "bg-neon-red/10 text-neon-red" :
                                 issue.priority === 'MEDIUM' ? "bg-neon-yellow/10 text-neon-yellow" :
                                 "bg-ocean-600 text-ocean-200"
                             )}>
                                 {issue.priority}
                             </span>
                             <span className="text-ocean-200 font-semibold text-xs truncate max-w-[180px]">{issue.title}</span>
                        </div>
                        {issue.status === 'RESOLVED' ? (
                            <CheckCircle2 className="w-4 h-4 text-neon-green" />
                        ) : (
                            <CircleDashed className={clsx("w-4 h-4", issue.priority === 'HIGH' ? "text-neon-red animate-pulse" : "text-ocean-500")} />
                        )}
                    </div>
                    <p className="text-xs text-ocean-400 leading-relaxed mb-2">{issue.description}</p>
                    <div className="flex justify-between items-center text-[10px] text-ocean-500">
                        <span className="font-mono">{issue.filepath}</span>
                        <span>{issue.confidence}% Conf</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};