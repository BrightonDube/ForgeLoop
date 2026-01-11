import { describe, it, expect } from 'vitest';
import { GitHubService } from '../src/services/github.js';

describe('GitHubService', () => {
  const github = new GitHubService();

  describe('parseRepoUrl', () => {
    it('should parse full HTTPS URL', () => {
      const result = github.parseRepoUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL without protocol', () => {
      const result = github.parseRepoUrl('github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse owner/repo format', () => {
      const result = github.parseRepoUrl('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle .git suffix', () => {
      const result = github.parseRepoUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should return null for invalid URL', () => {
      const result = github.parseRepoUrl('invalid-url');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = github.parseRepoUrl('');
      expect(result).toBeNull();
    });
  });
});
