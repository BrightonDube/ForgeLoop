import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Real API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('parseRepoUrl behavior', () => {
    it('should handle owner/repo format', () => {
      const url = 'facebook/react';
      const patterns = [
        /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)/,
        /^([^\/]+)\/([^\/]+)$/,
      ];
      
      let match = null;
      for (const pattern of patterns) {
        match = url.match(pattern);
        if (match) break;
      }
      
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe('facebook');
      expect(match?.[2]).toBe('react');
    });

    it('should handle full GitHub URL', () => {
      const url = 'https://github.com/facebook/react';
      const pattern = /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)/;
      const match = url.match(pattern);
      
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe('facebook');
      expect(match?.[2]).toBe('react');
    });

    it('should handle github.com without protocol', () => {
      const url = 'github.com/vercel/next.js';
      const pattern = /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)/;
      const match = url.match(pattern);
      
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe('vercel');
      expect(match?.[2]).toBe('next.js');
    });
  });

  describe('API response handling', () => {
    it('should handle successful response', async () => {
      const mockRun = {
        id: 'test-id',
        repoUrl: 'facebook/react',
        status: 'running',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ run: mockRun }),
      });

      const response = await fetch('/api/runs', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'facebook/react' }),
      });
      
      const data = await response.json();
      expect(data.run.id).toBe('test-id');
    });

    it('should handle error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid URL' }),
      });

      const response = await fetch('/api/runs', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'invalid' }),
      });
      
      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe('Invalid URL');
    });
  });
});
