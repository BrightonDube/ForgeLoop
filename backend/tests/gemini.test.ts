import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiService } from '../src/services/gemini.js';

// Mock the Google Generative AI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            issues: [
              {
                title: 'Test Issue',
                description: 'Test description',
                filepath: 'test.ts',
                priority: 'HIGH',
                confidence: 90,
                suggestedFix: 'Fix the issue'
              }
            ],
            summary: 'Test summary',
            recommendations: ['Recommendation 1']
          })
        }
      })
    })
  }))
}));

describe('GeminiService', () => {
  describe('isConfigured', () => {
    it('should return false when no API key is provided', () => {
      const service = new GeminiService('');
      expect(service.isConfigured()).toBe(false);
    });

    it('should return true when API key is provided', () => {
      const service = new GeminiService('test-api-key');
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('analyzeCode', () => {
    it('should throw error when not configured', async () => {
      const service = new GeminiService('');
      await expect(service.analyzeCode([])).rejects.toThrow('Gemini API key not configured');
    });

    it('should return analysis result when configured', async () => {
      const service = new GeminiService('test-api-key');
      const files = [
        { path: 'test.ts', content: 'const x = 1;', language: 'typescript', size: 12, sha: 'abc' }
      ];
      
      const result = await service.analyzeCode(files);
      
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should throw error when not configured', async () => {
      const service = new GeminiService('');
      await expect(service.chat('hello', '')).rejects.toThrow('Gemini API key not configured');
    });
  });

  describe('summarize', () => {
    it('should throw error when not configured', async () => {
      const service = new GeminiService('');
      await expect(service.summarize([])).rejects.toThrow('Gemini API key not configured');
    });
  });
});
