import React, { useState } from 'react';
import { VisualDiffState } from '../types';
import { ImageIcon, AlertCircle, CheckCircle } from 'lucide-react';

interface VisualDiffViewerProps {
  diffState: VisualDiffState;
}

export const VisualDiffViewer: React.FC<VisualDiffViewerProps> = ({ diffState }) => {
  const [mode, setMode] = useState<'side-by-side' | 'overlay'>('side-by-side');

  if (!diffState.beforeUrl && !diffState.afterUrl) {
    return (
      <div className="h-full bg-ocean-800 rounded-lg border border-ocean-700 border-dashed flex flex-col items-center justify-center text-ocean-500">
        <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
        <p>No visual artifacts captured yet.</p>
        <p className="text-xs">Waiting for Eyes subsystem...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-ocean-800 rounded-lg border border-ocean-700 overflow-hidden">
      <div className="p-3 border-b border-ocean-700 flex justify-between items-center bg-ocean-800">
        <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ocean-200">Visual Verification</h3>
            {diffState.detectedIssues.length > 0 && !diffState.afterUrl && (
                <span className="text-xs bg-neon-red/10 text-neon-red px-2 py-0.5 rounded-full border border-neon-red/20 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Issues Detected
                </span>
            )}
             {diffState.afterUrl && (
                <span className="text-xs bg-neon-green/10 text-neon-green px-2 py-0.5 rounded-full border border-neon-green/20 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Fixed
                </span>
            )}
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setMode('side-by-side')}
                className={`text-xs px-2 py-1 rounded transition-colors ${mode === 'side-by-side' ? 'bg-ocean-600 text-white' : 'text-ocean-400 hover:bg-ocean-700'}`}
            >
                Side-by-Side
            </button>
            <button 
                onClick={() => setMode('overlay')}
                className={`text-xs px-2 py-1 rounded transition-colors ${mode === 'overlay' ? 'bg-ocean-600 text-white' : 'text-ocean-400 hover:bg-ocean-700'}`}
            >
                Diff Overlay
            </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center p-4">
        {mode === 'side-by-side' ? (
            <div className="grid grid-cols-2 gap-4 w-full h-full">
                <div className="relative border border-ocean-600 rounded overflow-hidden group">
                    <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10 backdrop-blur-sm">Before</span>
                    {diffState.beforeUrl ? (
                        <img src={diffState.beforeUrl} alt="Before" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-ocean-600">No Image</div>
                    )}
                </div>
                <div className="relative border border-ocean-600 rounded overflow-hidden group">
                    <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10 backdrop-blur-sm">After</span>
                    {diffState.afterUrl ? (
                        <img src={diffState.afterUrl} alt="After" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                         <div className="w-full h-full flex items-center justify-center bg-ocean-900/50 text-ocean-500 text-xs">Processing Fix...</div>
                    )}
                </div>
            </div>
        ) : (
            <div className="relative w-full h-full max-w-lg aspect-video border border-ocean-600 rounded overflow-hidden">
                {diffState.beforeUrl && <img src={diffState.beforeUrl} className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-difference" alt="Diff Base" />}
                {diffState.afterUrl && <img src={diffState.afterUrl} className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-difference" alt="Diff Top" />}
                <div className="absolute bottom-2 right-2 bg-black/80 text-xs px-2 py-1 rounded">Difference Mode</div>
            </div>
        )}
      </div>
      
      {diffState.detectedIssues.length > 0 && (
          <div className="bg-ocean-900 border-t border-ocean-700 p-2">
              <p className="text-xs text-ocean-400 mb-1">Gemini Vision Findings:</p>
              <div className="flex flex-wrap gap-2">
                  {diffState.detectedIssues.map((issue, i) => (
                      <span key={i} className="text-xs text-neon-red bg-neon-red/5 px-2 py-0.5 rounded border border-neon-red/20">{issue}</span>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};