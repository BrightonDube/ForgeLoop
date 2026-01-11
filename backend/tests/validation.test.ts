import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'net';
import { 
  validateRepoUrl, 
  validateRunId, 
  validateChatMessage 
} from '../src/middleware/validation.js';

// Mock socket interface for testing
interface MockSocket extends Partial<Socket> {
  remoteAddress?: string;
}

// Mock Express types
function createMockRequest(body: Record<string, unknown> = {}, params: Record<string, string> = {}): Partial<Request> {
  const mockSocket: MockSocket = { remoteAddress: '127.0.0.1' };
  return {
    body,
    params,
    ip: '127.0.0.1',
    socket: mockSocket as Socket,
  };
}

function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    on: vi.fn(),
  };
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('Validation Middleware', () => {
  describe('validateRepoUrl', () => {
    it('should reject missing repoUrl', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Validation error',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-string repoUrl', () => {
      const req = createMockRequest({ repoUrl: 123 });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject too long repoUrl', () => {
      const req = createMockRequest({ repoUrl: 'a'.repeat(501) });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid owner/repo format', () => {
      const req = createMockRequest({ repoUrl: 'facebook/react' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept valid github.com URL', () => {
      const req = createMockRequest({ repoUrl: 'github.com/facebook/react' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should accept valid https URL', () => {
      const req = createMockRequest({ repoUrl: 'https://github.com/facebook/react' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid URL format', () => {
      const req = createMockRequest({ repoUrl: 'invalid-url' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRepoUrl(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateRunId', () => {
    it('should reject missing run ID', () => {
      const req = createMockRequest({}, {});
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRunId(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid UUID format', () => {
      const req = createMockRequest({}, { id: 'invalid-id' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRunId(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid UUID', () => {
      const req = createMockRequest({}, { id: '550e8400-e29b-41d4-a716-446655440000' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateRunId(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateChatMessage', () => {
    it('should reject missing message', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();
      
      validateChatMessage(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-string message', () => {
      const req = createMockRequest({ message: 123 });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateChatMessage(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject too long message', () => {
      const req = createMockRequest({ message: 'a'.repeat(10001) });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateChatMessage(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid message', () => {
      const req = createMockRequest({ message: 'What is the issue?' });
      const res = createMockResponse();
      const next = createMockNext();
      
      validateChatMessage(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
});
