import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RunHistory } from '../components/RunHistory';
import { AgentPhase } from '../types';

describe('RunHistory', () => {
  const mockRuns = [
    {
      id: '1',
      repoUrl: 'facebook/react',
      status: 'completed' as const,
      currentPhase: AgentPhase.DELIVERY,
      createdAt: Date.now() - 3600000, // 1 hour ago
    },
    {
      id: '2',
      repoUrl: 'https://github.com/vercel/next.js',
      status: 'running' as const,
      currentPhase: AgentPhase.EXECUTION,
      createdAt: Date.now() - 60000, // 1 minute ago
    },
    {
      id: '3',
      repoUrl: 'microsoft/typescript',
      status: 'failed' as const,
      currentPhase: AgentPhase.PLANNING,
      createdAt: Date.now() - 86400000, // 1 day ago
    },
  ];

  it('should render empty state when no runs', () => {
    const onSelectRun = vi.fn();
    render(<RunHistory runs={[]} currentRunId={null} onSelectRun={onSelectRun} />);
    
    expect(screen.getByText(/No analysis history yet/i)).toBeInTheDocument();
  });

  it('should render list of runs', () => {
    const onSelectRun = vi.fn();
    render(<RunHistory runs={mockRuns} currentRunId={null} onSelectRun={onSelectRun} />);
    
    expect(screen.getByText('facebook/react')).toBeInTheDocument();
    expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    expect(screen.getByText('microsoft/typescript')).toBeInTheDocument();
  });

  it('should call onSelectRun when clicking a run', () => {
    const onSelectRun = vi.fn();
    render(<RunHistory runs={mockRuns} currentRunId={null} onSelectRun={onSelectRun} />);
    
    fireEvent.click(screen.getByText('facebook/react'));
    expect(onSelectRun).toHaveBeenCalledWith('1');
  });

  it('should show delete button for non-running runs', () => {
    const onSelectRun = vi.fn();
    const onDeleteRun = vi.fn();
    render(
      <RunHistory 
        runs={mockRuns} 
        currentRunId={null} 
        onSelectRun={onSelectRun}
        onDeleteRun={onDeleteRun}
      />
    );
    
    // Should have delete buttons for completed and failed runs (not running)
    const deleteButtons = screen.getAllByTitle('Delete run');
    expect(deleteButtons).toHaveLength(2);
  });

  it('should call onDeleteRun when clicking delete', () => {
    const onSelectRun = vi.fn();
    const onDeleteRun = vi.fn();
    render(
      <RunHistory 
        runs={mockRuns} 
        currentRunId={null} 
        onSelectRun={onSelectRun}
        onDeleteRun={onDeleteRun}
      />
    );
    
    const deleteButtons = screen.getAllByTitle('Delete run');
    fireEvent.click(deleteButtons[0]);
    
    expect(onDeleteRun).toHaveBeenCalled();
    // Should not trigger select
    expect(onSelectRun).not.toHaveBeenCalled();
  });
});
