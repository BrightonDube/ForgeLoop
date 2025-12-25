import React, { useState } from 'react';
import { RepoFile } from '../types';
import { Folder, FileCode, File, ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface FileExplorerProps {
  files: RepoFile[];
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ files }) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const selectedFile = files.find(f => f.path === selectedPath);

  // Group files by directory for visual cleanliness if needed, 
  // but for this simple version, a flat list with indentation is easier/faster.
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  if (files.length === 0) {
    return (
        <div className="h-full bg-ocean-900 rounded-lg border border-ocean-700 flex flex-col items-center justify-center text-ocean-500 font-mono text-xs">
            <Folder className="w-8 h-8 mb-2 opacity-50" />
            <p>Repository not ingested yet.</p>
        </div>
    );
  }

  return (
    <div className="flex h-full bg-ocean-900 rounded-lg border border-ocean-700 overflow-hidden font-mono text-sm shadow-xl">
        {/* File List Sidebar */}
        <div className="w-1/3 border-r border-ocean-700 bg-ocean-800/50 flex flex-col">
            <div className="p-3 border-b border-ocean-700 font-semibold text-ocean-300 text-xs uppercase tracking-wider flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Repository
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll p-2">
                {sortedFiles.map(file => (
                    <div 
                        key={file.path}
                        onClick={() => setSelectedPath(file.path)}
                        className={clsx(
                            "cursor-pointer px-2 py-1.5 rounded flex items-center gap-2 transition-colors mb-1",
                            selectedPath === file.path 
                                ? "bg-neon-blue/10 text-neon-blue" 
                                : "text-ocean-400 hover:text-ocean-200 hover:bg-ocean-700"
                        )}
                    >
                        {file.path.endsWith('.tsx') || file.path.endsWith('.ts') ? 
                            <FileCode className="w-3.5 h-3.5" /> : 
                            <File className="w-3.5 h-3.5" />
                        }
                        <span className="truncate">{file.path}</span>
                        {file.isPatched && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-green" title="Modified by Agent"></span>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Code View */}
        <div className="flex-1 flex flex-col bg-ocean-900">
             {selectedFile ? (
                 <>
                    <div className="p-3 border-b border-ocean-700 flex justify-between items-center bg-ocean-800">
                        <span className="text-ocean-200">{selectedFile.path}</span>
                        {selectedFile.isPatched && (
                            <span className="text-[10px] bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20">
                                Modified by Agent
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto custom-scroll p-4">
                        <pre className="text-xs leading-relaxed text-ocean-100 font-mono">
                            <code>{selectedFile.content}</code>
                        </pre>
                    </div>
                 </>
             ) : (
                 <div className="flex-1 flex items-center justify-center text-ocean-600">
                     Select a file to view source
                 </div>
             )}
        </div>
    </div>
  );
};