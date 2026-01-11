import React, { useState } from 'react';
import { Download, FileJson, FileText, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Run, LogEntry, Issue, RepoFile } from '../types';

interface ExportData {
  run: Run | null;
  logs: LogEntry[];
  issues: Issue[];
  files: RepoFile[];
}

interface ExportButtonProps {
  data: ExportData;
  disabled?: boolean;
}

type ExportFormat = 'json' | 'markdown' | 'csv';

function generateMarkdown(data: ExportData): string {
  const { run, logs, issues, files } = data;
  
  if (!run) return '# No analysis data available';
  
  let md = `# ForgeLoop Analysis Report

## Repository
- **URL**: ${run.repoUrl}
- **Status**: ${run.status}
- **Phase**: ${run.currentPhase}
- **Created**: ${new Date(run.createdAt).toISOString()}

## Issues Found (${issues.length})

`;

  if (issues.length > 0) {
    md += '| Priority | Title | File | Confidence | Status |\n';
    md += '|----------|-------|------|------------|--------|\n';
    issues.forEach(issue => {
      md += `| ${issue.priority} | ${issue.title} | ${issue.filepath} | ${issue.confidence}% | ${issue.status} |\n`;
    });
  } else {
    md += 'No issues detected.\n';
  }

  md += `\n## Files Analyzed (${files.length})\n\n`;
  files.forEach(file => {
    md += `- \`${file.path}\` (${file.language})\n`;
  });

  md += `\n## Execution Log (${logs.length} entries)\n\n`;
  md += '```\n';
  logs.slice(-50).forEach(log => {
    md += `[${log.timestamp}] [${log.subsystem}] ${log.message}\n`;
  });
  md += '```\n';

  return md;
}

function generateCSV(issues: Issue[]): string {
  if (issues.length === 0) return 'No issues found';
  
  const headers = ['Priority', 'Title', 'Description', 'File', 'Confidence', 'Status'];
  const rows = issues.map(issue => [
    issue.priority,
    `"${issue.title.replace(/"/g, '""')}"`,
    `"${issue.description.replace(/"/g, '""')}"`,
    issue.filepath,
    issue.confidence.toString(),
    issue.status,
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export function ExportButton({ data, disabled }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = (format: ExportFormat) => {
    let content: string;
    let filename: string;
    let mimeType: string;

    const repoName = data.run?.repoUrl.replace(/[^a-zA-Z0-9]/g, '-') || 'analysis';
    const timestamp = new Date().toISOString().split('T')[0];

    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = `forgeloop-${repoName}-${timestamp}.json`;
        mimeType = 'application/json';
        break;
      case 'markdown':
        content = generateMarkdown(data);
        filename = `forgeloop-${repoName}-${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
      case 'csv':
        content = generateCSV(data.issues);
        filename = `forgeloop-issues-${repoName}-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      const markdown = generateMarkdown(data);
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: show alert
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || !data.run}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          disabled || !data.run
            ? 'bg-ocean-800 text-ocean-600 cursor-not-allowed'
            : 'bg-ocean-800 hover:bg-ocean-700 text-ocean-200 border border-ocean-600'
        )}
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-ocean-800 border border-ocean-600 rounded-md shadow-lg overflow-hidden">
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ocean-200 hover:bg-ocean-700 transition-colors"
            >
              <FileJson className="w-4 h-4" />
              Export as JSON
            </button>
            <button
              onClick={() => handleExport('markdown')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ocean-200 hover:bg-ocean-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export as Markdown
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ocean-200 hover:bg-ocean-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export Issues (CSV)
            </button>
            <div className="border-t border-ocean-600" />
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ocean-200 hover:bg-ocean-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-neon-green" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
