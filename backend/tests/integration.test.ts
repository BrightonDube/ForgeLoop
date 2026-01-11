import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/db.js';
import { AgentPhase, LogLevel } from '../src/types.js';

describe('Agent Integration', () => {
  beforeEach(() => {
    db.clear();
  });

  afterEach(() => {
    db.clear();
  });

  describe('Full Run Lifecycle', () => {
    it('should create a run with correct initial state', () => {
      const run = db.createRun('https://github.com/test/repo', 'test', 'repo');
      
      expect(run.status).toBe('running');
      expect(run.currentPhase).toBe(AgentPhase.INGESTION);
      expect(run.repoOwner).toBe('test');
      expect(run.repoName).toBe('repo');
    });

    it('should track run through all phases', () => {
      const run = db.createRun('https://github.com/test/repo', 'test', 'repo');
      
      // Simulate phase transitions
      db.updateRun(run.id, { currentPhase: AgentPhase.PLANNING });
      expect(db.getRun(run.id)?.currentPhase).toBe(AgentPhase.PLANNING);
      
      db.updateRun(run.id, { currentPhase: AgentPhase.EXECUTION });
      expect(db.getRun(run.id)?.currentPhase).toBe(AgentPhase.EXECUTION);
      
      db.updateRun(run.id, { currentPhase: AgentPhase.OBSERVATION });
      expect(db.getRun(run.id)?.currentPhase).toBe(AgentPhase.OBSERVATION);
      
      db.updateRun(run.id, { currentPhase: AgentPhase.VERIFICATION });
      expect(db.getRun(run.id)?.currentPhase).toBe(AgentPhase.VERIFICATION);
      
      db.updateRun(run.id, { currentPhase: AgentPhase.DELIVERY });
      expect(db.getRun(run.id)?.currentPhase).toBe(AgentPhase.DELIVERY);
      
      db.updateRun(run.id, { status: 'completed' });
      expect(db.getRun(run.id)?.status).toBe('completed');
    });

    it('should track logs throughout run', () => {
      const run = db.createRun('https://github.com/test/repo', 'test', 'repo');
      
      db.createLog(run.id, 'SYSTEM', 'Starting ingestion', LogLevel.INFO);
      db.createLog(run.id, 'BRAIN', 'Analyzing code', LogLevel.THOUGHT);
      db.createLog(run.id, 'HANDS', 'Executing command', LogLevel.INFO);
      db.createLog(run.id, 'EYES', 'Taking screenshot', LogLevel.INFO);
      
      const logs = db.getLogs(run.id);
      expect(logs).toHaveLength(4);
      expect(logs.map(l => l.subsystem)).toEqual(['SYSTEM', 'BRAIN', 'HANDS', 'EYES']);
    });

    it('should track issues detected during analysis', () => {
      const run = db.createRun('https://github.com/test/repo', 'test', 'repo');
      
      db.createIssue(run.id, {
        title: 'Security Vulnerability',
        description: 'SQL injection risk',
        filepath: 'src/db.ts',
        priority: 'HIGH',
        confidence: 95,
        status: 'OPEN',
      });
      
      db.createIssue(run.id, {
        title: 'Code Style',
        description: 'Missing semicolons',
        filepath: 'src/utils.ts',
        priority: 'LOW',
        confidence: 80,
        status: 'OPEN',
      });
      
      const issues = db.getIssues(run.id);
      expect(issues).toHaveLength(2);
      expect(issues.filter(i => i.priority === 'HIGH')).toHaveLength(1);
    });

    it('should handle run failure gracefully', () => {
      const run = db.createRun('https://github.com/test/repo', 'test', 'repo');
      
      db.createLog(run.id, 'SYSTEM', 'Error occurred', LogLevel.ERROR);
      db.updateRun(run.id, { status: 'failed' });
      
      const failedRun = db.getRun(run.id);
      expect(failedRun?.status).toBe('failed');
    });

    it('should handle run stop by user', () => {
      const run = db.createRun('https://github.com/test/repo', 'test', 'repo');
      
      db.updateRun(run.id, { status: 'stopped' });
      
      const stoppedRun = db.getRun(run.id);
      expect(stoppedRun?.status).toBe('stopped');
    });
  });

  describe('Multiple Runs', () => {
    it('should handle multiple concurrent runs', () => {
      const run1 = db.createRun('https://github.com/test/repo1', 'test', 'repo1');
      const run2 = db.createRun('https://github.com/test/repo2', 'test', 'repo2');
      
      db.createLog(run1.id, 'SYSTEM', 'Run 1 log', LogLevel.INFO);
      db.createLog(run2.id, 'SYSTEM', 'Run 2 log', LogLevel.INFO);
      
      expect(db.getLogs(run1.id)).toHaveLength(1);
      expect(db.getLogs(run2.id)).toHaveLength(1);
      expect(db.getAllRuns()).toHaveLength(2);
    });
  });
});
