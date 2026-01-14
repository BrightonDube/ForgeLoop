import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db.js';
import { AgentPhase, LogLevel } from '../src/types.js';

describe('Database', () => {
  beforeEach(() => {
    db.clear();
  });

  describe('Runs', () => {
    it('should create a new run', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      
      expect(run.id).toBeDefined();
      expect(run.repoUrl).toBe('https://github.com/owner/repo');
      expect(run.repoOwner).toBe('owner');
      expect(run.repoName).toBe('repo');
      expect(run.status).toBe('running');
      expect(run.currentPhase).toBe(AgentPhase.INGESTION);
    });

    it('should get a run by id', () => {
      const created = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      const retrieved = db.getRun(created.id);
      
      expect(retrieved).toEqual(created);
    });

    it('should update a run', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      const updated = db.updateRun(run.id, { status: 'completed' });
      
      expect(updated?.status).toBe('completed');
    });

    it('should return undefined for non-existent run', () => {
      const run = db.getRun('non-existent');
      expect(run).toBeUndefined();
    });
  });

  describe('Logs', () => {
    it('should create and retrieve logs', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      
      db.createLog(run.id, 'SYSTEM', 'Test message', LogLevel.INFO);
      db.createLog(run.id, 'BRAIN', 'Another message', LogLevel.SUCCESS);
      
      const logs = db.getLogs(run.id);
      
      expect(logs).toHaveLength(2);
      expect(logs[0].subsystem).toBe('SYSTEM');
      expect(logs[1].subsystem).toBe('BRAIN');
    });

    it('should return empty array for run with no logs', () => {
      const logs = db.getLogs('non-existent');
      expect(logs).toEqual([]);
    });
  });

  describe('Issues', () => {
    it('should create and retrieve issues', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      
      const issue = db.createIssue(run.id, {
        title: 'Test Issue',
        description: 'Description',
        filepath: 'test.ts',
        priority: 'HIGH',
        confidence: 90,
        status: 'OPEN',
      });
      
      expect(issue.id).toBeDefined();
      expect(issue.runId).toBe(run.id);
      expect(issue.title).toBe('Test Issue');
      
      const issues = db.getIssues(run.id);
      expect(issues).toHaveLength(1);
    });

    it('should update an issue', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      const issue = db.createIssue(run.id, {
        title: 'Test Issue',
        description: 'Description',
        filepath: 'test.ts',
        priority: 'HIGH',
        confidence: 90,
        status: 'OPEN',
      });
      
      const updated = db.updateIssue(run.id, issue.id, { status: 'RESOLVED' });
      
      expect(updated?.status).toBe('RESOLVED');
    });
  });

  describe('Files', () => {
    it('should set and get files', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      
      const files = [
        { path: 'file1.ts', content: 'content1', language: 'typescript', size: 100, sha: 'abc' },
        { path: 'file2.ts', content: 'content2', language: 'typescript', size: 200, sha: 'def' },
      ];
      
      db.setFiles(run.id, files);
      const retrieved = db.getFiles(run.id);
      
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].path).toBe('file1.ts');
    });
  });

  describe('Cleanup', () => {
    it('should delete a run and all associated data', () => {
      const run = db.createRun('https://github.com/owner/repo', 'owner', 'repo');
      db.createLog(run.id, 'SYSTEM', 'Test', LogLevel.INFO);
      db.createIssue(run.id, {
        title: 'Issue',
        description: 'Desc',
        filepath: 'test.ts',
        priority: 'LOW',
        confidence: 50,
        status: 'OPEN',
      });
      
      const deleted = db.deleteRun(run.id);
      
      expect(deleted).toBe(true);
      expect(db.getRun(run.id)).toBeUndefined();
      expect(db.getLogs(run.id)).toEqual([]);
      expect(db.getIssues(run.id)).toEqual([]);
    });
  });
});
