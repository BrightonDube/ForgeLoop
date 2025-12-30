import React, { useState, useEffect } from 'react';
import { RepoFile } from '../types';
import { Folder, FileCode, File, Save } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../server/api';

interface FileExplorerProps {
  files: RepoFile[];
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ files }) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  // When files update or selection changes, sync the editor content
  useEffect(() => {
    if (selectedPath) {
        const file = files.find(f => f.path === selectedPath);
        if (file) {
            // Only update editContent if we aren't currently editing (or if we switched files)
            // Ideally we'd need better diff tracking, but for this demo, 
            // we'll reset content when switching files.
            setEditContent(file.content);
            setIsDirty(false);
        }
    }
  }, [selectedPath, files]);

  const handleSave = async () => {
      if (selectedPath) {
          await api.updateFile(selectedPath, editContent);
          setIsDirty(false);
      }
  };

  const selectedFile = files.find(f => f.path === selectedPath);
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  if (files.length === 0) {
    return (
        <div className="h-full bg-ocean-900 rounded-lg border border-ocean-700 flex flex-col items-center justify-center text-ocean-500 font-mono text-xs">
            <Folder className="w-8 h-8 mb-2 opacity-50" />
            <p>Initializing workspace...</p>
        </div>
    );
  }

  return (
    <div className="flex h-full bg-ocean-900 rounded-lg border border-ocean-700 overflow-hidden font-mono text-sm shadow-xl">
        {/* File List Sidebar */}
        <div className="w-1/3 border-r border-ocean-700 bg-ocean-800/50 flex flex-col">
            <div className="p-3 border-b border-ocean-700 font-semibold text-ocean-300 text-xs uppercase tracking-wider flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Workspace
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll p-2">
                {sortedFiles.map(file => (
                    <div 
                        key={file.path}
                        onClick={() => {
                            // If dirty, maybe warn? For now just switch.
                            setSelectedPath(file.path);
                        }}
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

        {/* Code Editor */}
        <div className="flex-1 flex flex-col bg-ocean-900">
             {selectedFile ? (
                 <>
                    <div className="p-2 border-b border-ocean-700 flex justify-between items-center bg-ocean-800">
                        <span className="text-ocean-200 text-xs px-2">{selectedFile.path}</span>
                        <div className="flex items-center gap-2">
                            {selectedFile.isPatched && (
                                <span className="text-[10px] bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20">
                                    Patched by AI
                                </span>
                            )}
                            <button 
                                onClick={handleSave}
                                disabled={!isDirty}
                                className={clsx(
                                    "flex items-center gap-1 text-xs px-3 py-1 rounded transition-all",
                                    isDirty 
                                        ? "bg-neon-blue text-white hover:bg-blue-600 shadow-lg shadow-neon-blue/20" 
                                        : "bg-ocean-700 text-ocean-400 opacity-50 cursor-not-allowed"
                                )}
                            >
                                <Save className="w-3 h-3" />
                                Save
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative group">
                        <textarea
                            value={editContent}
                            onChange={(e) => {
                                setEditContent(e.target.value);
                                setIsDirty(true);
                            }}
                            className="w-full h-full bg-ocean-900 text-ocean-100 font-mono text-xs p-4 resize-none focus:outline-none custom-scroll leading-relaxed"
                            spellCheck={false}
                        />
                    </div>
                 </>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-ocean-600 gap-2">
                     <FileCode className="w-8 h-8 opacity-20" />
                     <p>Select a file to edit</p>
                 </div>
             )}
        </div>
    </div>
  );
};