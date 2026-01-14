import { Request, Response, NextFunction } from 'express';

// Constants
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Simple in-memory rate limiter
 * Note: For production, consider using Redis for distributed rate limiting
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  private startCleanup(): void {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      for (const [key, timestamps] of this.requests.entries()) {
        const valid = timestamps.filter(time => time > windowStart);
        if (valid.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, valid);
        }
      }
    }, 5 * 60 * 1000);
  }

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get existing requests for this key
    const requests = this.requests.get(key) || [];
    
    // Filter to only requests within the window
    const recentRequests = requests.filter(time => time > windowStart);
    
    // Update the requests
    this.requests.set(key, recentRequests);
    
    // Check if rate limited
    if (recentRequests.length >= this.maxRequests) {
      return true;
    }
    
    // Add this request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return false;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// Create rate limiter instances
const apiRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute
const analysisRateLimiter = new RateLimiter(60000, 10); // 10 analyses per minute

/**
 * Rate limiting middleware for general API calls
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (apiRateLimiter.isRateLimited(clientIp)) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
      retryAfter: 60,
    });
    return;
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Remaining', apiRateLimiter.getRemainingRequests(clientIp).toString());
  
  next();
}

/**
 * Stricter rate limiting for analysis endpoints
 */
export function analysisRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (analysisRateLimiter.isRateLimited(clientIp)) {
    res.status(429).json({
      error: 'Too many analysis requests',
      message: 'Analysis is resource-intensive. Please wait before starting another.',
      retryAfter: 60,
    });
    return;
  }
  
  next();
}

/**
 * Input validation for repo URL
 */
export function validateRepoUrl(req: Request, res: Response, next: NextFunction): void {
  const { repoUrl } = req.body;
  
  if (!repoUrl) {
    res.status(400).json({
      error: 'Validation error',
      message: 'repoUrl is required',
    });
    return;
  }
  
  if (typeof repoUrl !== 'string') {
    res.status(400).json({
      error: 'Validation error',
      message: 'repoUrl must be a string',
    });
    return;
  }
  
  if (repoUrl.length > 500) {
    res.status(400).json({
      error: 'Validation error',
      message: 'repoUrl is too long',
    });
    return;
  }
  
  // GitHub repository naming rules:
  // - Owner and repo names can contain alphanumeric characters, hyphens, underscores, and periods
  // - Cannot start or end with a period or hyphen
  // - Cannot have consecutive periods
  const validNamePattern = '[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?';
  const validPatterns = [
    new RegExp(`^https?:\\/\\/github\\.com\\/${validNamePattern}\\/${validNamePattern}$`),
    new RegExp(`^github\\.com\\/${validNamePattern}\\/${validNamePattern}$`),
    new RegExp(`^${validNamePattern}\\/${validNamePattern}$`),
  ];
  
  const isValid = validPatterns.some(pattern => pattern.test(repoUrl.trim()));
  
  if (!isValid) {
    res.status(400).json({
      error: 'Validation error',
      message: 'Invalid repository URL format. Use: owner/repo or https://github.com/owner/repo',
    });
    return;
  }
  
  next();
}

/**
 * Validate run ID parameter
 */
export function validateRunId(req: Request, res: Response, next: NextFunction): void {
  const { id } = req.params;
  
  if (!id) {
    res.status(400).json({
      error: 'Validation error',
      message: 'Run ID is required',
    });
    return;
  }
  
  // Use the UUID constant from top of file
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({
      error: 'Validation error',
      message: 'Invalid run ID format',
    });
    return;
  }
  
  next();
}

/**
 * Validate chat message
 */
export function validateChatMessage(req: Request, res: Response, next: NextFunction): void {
  const { message } = req.body;
  
  if (!message) {
    res.status(400).json({
      error: 'Validation error',
      message: 'Message is required',
    });
    return;
  }
  
  if (typeof message !== 'string') {
    res.status(400).json({
      error: 'Validation error',
      message: 'Message must be a string',
    });
    return;
  }
  
  if (message.length > 10000) {
    res.status(400).json({
      error: 'Validation error',
      message: 'Message is too long (max 10000 characters)',
    });
    return;
  }
  
  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`${new Date().toISOString()} | ${method} ${path} | ${statusCode} | ${duration}ms`);
  });
  
  next();
}
