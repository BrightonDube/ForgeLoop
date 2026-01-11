import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { CodeAnalysisResult, RepoFile, Issue } from '../types.js';

/**
 * Gemini AI Service for code analysis
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || config.geminiApiKey;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
      this.model = this.genAI.getGenerativeModel({ model: config.geminiModel });
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.model !== null;
  }

  /**
   * Analyze code files and detect issues
   */
  async analyzeCode(files: RepoFile[]): Promise<CodeAnalysisResult> {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    // Build context from files
    const fileContext = files
      .map(f => `### File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
      .join('\n\n');

    const prompt = `You are a senior software engineer performing a code review. Analyze the following codebase and identify:

1. **Bugs**: Logic errors, null pointer issues, race conditions
2. **Security Issues**: XSS, SQL injection, authentication problems
3. **Performance Issues**: N+1 queries, memory leaks, inefficient algorithms
4. **Code Quality**: Missing error handling, poor naming, duplicated code
5. **Visual/UI Issues**: Z-index problems, overflow issues, layout bugs

For each issue found, provide:
- A clear title
- A description of the problem
- The file path where it occurs
- Priority (HIGH, MEDIUM, LOW)
- Confidence score (0-100)
- A suggested fix

Respond ONLY with valid JSON in this exact format:
{
  "issues": [
    {
      "title": "Issue title",
      "description": "Description of the problem",
      "filepath": "path/to/file.ts",
      "priority": "HIGH",
      "confidence": 85,
      "suggestedFix": "How to fix this issue"
    }
  ],
  "summary": "Brief summary of the codebase quality",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Codebase to analyze:

${fileContext}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON from response - try to find a complete JSON object
      // First, try to parse the entire response as JSON
      try {
        const parsed = JSON.parse(text) as CodeAnalysisResult;
        return parsed;
      } catch {
        // If that fails, try to extract JSON from markdown code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          const parsed = JSON.parse(codeBlockMatch[1].trim()) as CodeAnalysisResult;
          return parsed;
        }
        
        // Last resort: find the outermost balanced braces
        let depth = 0;
        let start = -1;
        let end = -1;
        
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '{') {
            if (depth === 0) start = i;
            depth++;
          } else if (text[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              end = i + 1;
              break;
            }
          }
        }
        
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(text.slice(start, end)) as CodeAnalysisResult;
          return parsed;
        }
        
        throw new Error('No valid JSON found in response');
      }
    } catch (error) {
      console.error('Error analyzing code with Gemini:', error);
      return {
        issues: [],
        summary: 'Analysis failed',
        recommendations: [],
      };
    }
  }

  /**
   * Generate a fix suggestion for a specific issue
   */
  async generateFix(file: RepoFile, issue: Omit<Issue, 'id' | 'runId'>): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `You are a senior software engineer. Given the following code and issue, provide a fixed version of the code.

Issue: ${issue.title}
Description: ${issue.description}
File: ${file.path}

Current code:
\`\`\`${file.language}
${file.content}
\`\`\`

Provide ONLY the fixed code without any explanation. Return the complete file content with the fix applied.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract code from response
      const codeMatch = text.match(/```[\w]*\n([\s\S]*?)```/);
      return codeMatch ? codeMatch[1].trim() : text.trim();
    } catch (error) {
      console.error('Error generating fix:', error);
      return file.content;
    }
  }

  /**
   * Chat with the AI about the codebase
   */
  async chat(message: string, context: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `You are an AI software architect assistant. You have access to the following context about the current analysis:

${context}

User question: ${message}

Provide a helpful, concise response.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error in chat:', error);
      return 'I encountered an error processing your request.';
    }
  }

  /**
   * Summarize a codebase
   */
  async summarize(files: RepoFile[]): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    const fileList = files.map(f => `- ${f.path} (${f.language}, ${f.size} bytes)`).join('\n');

    const prompt = `Analyze this codebase structure and provide a brief summary (2-3 sentences):

Files:
${fileList}

Describe the project type, main technologies, and architecture.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error summarizing codebase:', error);
      return 'Unable to summarize codebase.';
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
