import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // GitHub
  githubToken: process.env.GITHUB_TOKEN || '',
  
  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  
  // Rate limiting
  maxFilesPerRepo: parseInt(process.env.MAX_FILES_PER_REPO || '100', 10),
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '100000', 10),
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.githubToken) {
    errors.push('GITHUB_TOKEN is required for GitHub API access');
  }
  
  if (!config.geminiApiKey) {
    errors.push('GEMINI_API_KEY is required for AI analysis');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
