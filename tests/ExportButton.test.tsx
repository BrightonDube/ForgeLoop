import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportButton } from '../components/ExportButton';
import { AgentPhase, LogLevel } from '../types';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

describe('ExportButton', () => {
  const mockData = {
    run: {
      id: '1',
      repoUrl: 'facebook/react',
      status: 'completed' as const,
      currentPhase: AgentPhase.DELIVERY,
      createdAt: Date.now(),
    },
    logs: [
      {
        id: '1',
        runId: '1',
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        subsystem: 'SYSTEM' as const,
        message: 'Test log',
      },
    ],
    issues: [
      {
        id: '1',
        runId: '1',
        title: 'Test Issue',
        description: 'Test description',
        filepath: 'test.ts',
        priority: 'HIGH' as const,
        confidence: 90,
        status: 'OPEN' as const,
      },
    ],
    files: [
      {
        path: 'test.ts',
        content: 'const x = 1;',
        language: 'typescript',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render export button', () => {
    render(<ExportButton data={mockData} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should be disabled when no run data', () => {
    render(<ExportButton data={{ ...mockData, run: null }} />);
    const button = screen.getByText('Export').closest('button');
    expect(button).toBeDisabled();
  });

  it('should open dropdown on click', () => {
    render(<ExportButton data={mockData} />);
    
    fireEvent.click(screen.getByText('Export'));
    
    expect(screen.getByText('Export as JSON')).toBeInTheDocument();
    expect(screen.getByText('Export as Markdown')).toBeInTheDocument();
    expect(screen.getByText('Export Issues (CSV)')).toBeInTheDocument();
  });

  it('should copy to clipboard', async () => {
    render(<ExportButton data={mockData} />);
    
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
