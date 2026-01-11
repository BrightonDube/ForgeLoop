import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import type { GitHubRepo, GitHubFileContent, RepoFile } from '../types.js';

/**
 * GitHub Service for interacting with GitHub API
 */
export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || config.githubToken,
    });
  }

  /**
   * Parse a GitHub URL to extract owner and repo name
   */
  parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Handle various URL formats:
    // https://github.com/owner/repo
    // github.com/owner/repo
    // owner/repo
    
    const patterns = [
      /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)/,
      /^([^\/]+)\/([^\/]+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
        };
      }
    }

    return null;
  }

  /**
   * Get repository metadata
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    const { data } = await this.octokit.repos.get({ owner, repo });

    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      language: data.language,
      stargazers: data.stargazers_count,
      url: data.html_url,
    };
  }

  /**
   * Get repository file tree
   */
  async getFileTree(owner: string, repo: string, path: string = ''): Promise<string[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (!Array.isArray(data)) {
        return [path];
      }

      const files: string[] = [];
      
      for (const item of data) {
        if (item.type === 'file') {
          files.push(item.path);
        } else if (item.type === 'dir') {
          // Recursively get files in subdirectories
          const subFiles = await this.getFileTree(owner, repo, item.path);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      console.error(`Error getting file tree for ${path}:`, error);
      return [];
    }
  }

  /**
   * Get file content
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<GitHubFileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      // Decode base64 content
      const content = data.encoding === 'base64' && data.content
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : '';

      return {
        path: data.path,
        content,
        sha: data.sha,
        size: data.size,
        encoding: data.encoding || 'none',
      };
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error);
      return null;
    }
  }

  /**
   * Get multiple files from a repository
   */
  async getRepositoryFiles(
    owner: string,
    repo: string,
    options: { maxFiles?: number; maxFileSize?: number; extensions?: string[] } = {}
  ): Promise<RepoFile[]> {
    const {
      maxFiles = config.maxFilesPerRepo,
      maxFileSize = config.maxFileSizeBytes,
      extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html'],
    } = options;

    // Get file tree
    const allFiles = await this.getFileTree(owner, repo);
    
    // Filter by extension and limit
    const filteredFiles = allFiles
      .filter(path => {
        // Skip common non-code directories
        if (path.includes('node_modules/') || 
            path.includes('.git/') || 
            path.includes('dist/') ||
            path.includes('build/') ||
            path.includes('.next/')) {
          return false;
        }
        
        // Check extension
        return extensions.some(ext => path.endsWith(ext));
      })
      .slice(0, maxFiles);

    // Fetch content for each file
    const files: RepoFile[] = [];
    
    for (const path of filteredFiles) {
      const content = await this.getFileContent(owner, repo, path);
      
      if (content && content.size <= maxFileSize) {
        files.push({
          path: content.path,
          content: content.content,
          language: this.detectLanguage(content.path),
          size: content.size,
          sha: content.sha,
        });
      }
    }

    return files;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      md: 'markdown',
      css: 'css',
      html: 'html',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
    };

    return languageMap[ext] || 'plaintext';
  }
}

// Export singleton instance
export const githubService = new GitHubService();
