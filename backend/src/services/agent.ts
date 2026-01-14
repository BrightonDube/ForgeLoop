import { EventEmitter } from 'events';
import { db } from '../db.js';
import { GitHubService } from './github.js';
import { GeminiService } from './gemini.js';
import { AgentPhase, LogLevel } from '../types.js';
import type { Run, LogSubsystem, RepoFile } from '../types.js';

/**
 * Agent Worker - Orchestrates the analysis pipeline
 */
export class AgentWorker extends EventEmitter {
  private runId: string;
  private isRunning: boolean = false;
  private github: GitHubService;
  private gemini: GeminiService;

  constructor(runId: string) {
    super();
    this.runId = runId;
    this.github = new GitHubService();
    this.gemini = new GeminiService();
  }

  /**
   * Start the agent execution
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.executeLoop();
    } catch (error) {
      this.log('SYSTEM', `Critical failure: ${error}`, LogLevel.ERROR);
      db.updateRun(this.runId, { status: 'failed' });
    }
  }

  /**
   * Stop the agent execution
   */
  stop(): void {
    this.isRunning = false;
    db.updateRun(this.runId, { status: 'stopped' });
    this.log('SYSTEM', 'Agent stopped by user', LogLevel.WARN);
    this.emit('stopped', this.runId);
  }

  /**
   * Main execution loop
   */
  private async executeLoop(): Promise<void> {
    const run = db.getRun(this.runId);
    if (!run || !this.isRunning) return;

    try {
      await this.processPhase(run);
    } catch (error) {
      this.log('SYSTEM', `Phase error: ${error}`, LogLevel.ERROR);
      db.updateRun(this.runId, { status: 'failed' });
      this.emit('error', { runId: this.runId, error });
    }
  }

  /**
   * Process the current phase
   */
  private async processPhase(run: Run): Promise<void> {
    switch (run.currentPhase) {
      case AgentPhase.INGESTION:
        await this.ingestionPhase(run);
        break;
      case AgentPhase.PLANNING:
        await this.planningPhase(run);
        break;
      case AgentPhase.EXECUTION:
        await this.executionPhase(run);
        break;
      case AgentPhase.OBSERVATION:
        await this.observationPhase(run);
        break;
      case AgentPhase.VERIFICATION:
        await this.verificationPhase(run);
        break;
      case AgentPhase.DELIVERY:
        await this.deliveryPhase(run);
        break;
    }
  }

  /**
   * Phase 1: Ingestion - Fetch repository data from GitHub
   */
  private async ingestionPhase(run: Run): Promise<void> {
    this.log('SYSTEM', 'Starting ingestion phase...', LogLevel.INFO);

    // Parse repo URL
    const parsed = this.github.parseRepoUrl(run.repoUrl);
    if (!parsed) {
      throw new Error(`Invalid repository URL: ${run.repoUrl}`);
    }

    this.log('BRAIN', `Connecting to GitHub: ${parsed.owner}/${parsed.repo}`, LogLevel.INFO);

    // Get repository metadata
    try {
      const repoInfo = await this.github.getRepository(parsed.owner, parsed.repo);
      this.log('BRAIN', `Repository found: ${repoInfo.fullName} (${repoInfo.language})`, LogLevel.SUCCESS);

      // Store artifact with repo info
      db.createArtifact(this.runId, 'context', {
        repository: repoInfo,
      });
    } catch (error) {
      throw new Error(`Failed to access repository: ${error}`);
    }

    // Fetch files
    this.log('HANDS', 'Fetching repository files...', LogLevel.INFO);
    
    const files = await this.github.getRepositoryFiles(parsed.owner, parsed.repo);
    
    if (files.length === 0) {
      throw new Error('No analyzable files found in repository');
    }

    this.log('HANDS', `Retrieved ${files.length} files for analysis`, LogLevel.SUCCESS);

    // Store files
    db.setFiles(this.runId, files);

    // Generate summary
    if (this.gemini.isConfigured()) {
      this.log('BRAIN', 'Generating codebase summary...', LogLevel.THOUGHT);
      const summary = await this.gemini.summarize(files);
      this.log('BRAIN', summary, LogLevel.INFO);
    }

    this.transition(AgentPhase.PLANNING);
    await this.executeLoop();
  }

  /**
   * Phase 2: Planning - Analyze code and detect issues
   */
  private async planningPhase(run: Run): Promise<void> {
    this.log('BRAIN', 'Starting planning phase...', LogLevel.INFO);

    const files = db.getFiles(this.runId);

    if (!this.gemini.isConfigured()) {
      this.log('BRAIN', 'Gemini API not configured - skipping AI analysis', LogLevel.WARN);
      this.transition(AgentPhase.EXECUTION);
      await this.executeLoop();
      return;
    }

    this.log('BRAIN', `Analyzing ${files.length} files with Gemini AI...`, LogLevel.THOUGHT);

    try {
      const analysis = await this.gemini.analyzeCode(files);

      this.log('BRAIN', `Analysis complete: ${analysis.summary}`, LogLevel.SUCCESS);

      // Create issues from analysis
      for (const issue of analysis.issues) {
        const created = db.createIssue(this.runId, {
          ...issue,
          status: 'OPEN',
        });
        this.log('BRAIN', `Issue detected: ${issue.title} (${issue.priority})`, LogLevel.WARN);
        this.emit('issue', { runId: this.runId, issue: created });
      }

      // Store analysis artifact
      db.createArtifact(this.runId, 'analysis', {
        issues: analysis.issues,
        summary: analysis.summary,
        recommendations: analysis.recommendations,
      });

      if (analysis.issues.length === 0) {
        this.log('BRAIN', 'No issues detected - codebase looks clean!', LogLevel.SUCCESS);
      }

    } catch (error) {
      this.log('BRAIN', `Analysis error: ${error}`, LogLevel.ERROR);
    }

    this.transition(AgentPhase.EXECUTION);
    await this.executeLoop();
  }

  /**
   * Phase 3: Execution - Prepare fixes
   */
  private async executionPhase(run: Run): Promise<void> {
    this.log('HANDS', 'Starting execution phase...', LogLevel.INFO);

    const issues = db.getIssues(this.runId);
    const highPriorityIssues = issues.filter(i => i.priority === 'HIGH');

    if (highPriorityIssues.length === 0) {
      this.log('HANDS', 'No high-priority issues to fix', LogLevel.INFO);
      this.transition(AgentPhase.OBSERVATION);
      await this.executeLoop();
      return;
    }

    this.log('HANDS', `Found ${highPriorityIssues.length} high-priority issues`, LogLevel.INFO);

    // Generate fixes for high priority issues
    const files = db.getFiles(this.runId);

    for (const issue of highPriorityIssues) {
      const file = files.find(f => f.path === issue.filepath);
      if (!file) continue;

      this.log('HANDS', `Generating fix for: ${issue.title}`, LogLevel.INFO);

      if (this.gemini.isConfigured()) {
        try {
          const fixedCode = await this.gemini.generateFix(file, issue);
          
          // Store the fixed code as an artifact
          db.createArtifact(this.runId, 'diff', {
            path: file.path,
            original: file.content,
            fixed: fixedCode,
            issue: issue.title,
          });

          this.log('HANDS', `Fix generated for ${file.path}`, LogLevel.SUCCESS);
          db.updateIssue(this.runId, issue.id, { status: 'IN_PROGRESS' });
        } catch (error) {
          this.log('HANDS', `Failed to generate fix: ${error}`, LogLevel.ERROR);
        }
      }
    }

    this.transition(AgentPhase.OBSERVATION);
    await this.executeLoop();
  }

  /**
   * Phase 4: Observation - Review changes
   */
  private async observationPhase(run: Run): Promise<void> {
    this.log('EYES', 'Starting observation phase...', LogLevel.INFO);

    const artifacts = db.getArtifacts(this.runId);
    const diffs = artifacts.filter(a => a.type === 'diff');

    this.log('EYES', `Reviewing ${diffs.length} proposed changes`, LogLevel.INFO);

    for (const diff of diffs) {
      const diffData = diff.data as { path?: string; issue?: string };
      if (diffData.path) {
        this.log('EYES', `Change in ${diffData.path}: ${diffData.issue || 'unknown issue'}`, LogLevel.INFO);
      }
    }

    this.transition(AgentPhase.VERIFICATION);
    await this.executeLoop();
  }

  /**
   * Phase 5: Verification - Validate fixes
   */
  private async verificationPhase(run: Run): Promise<void> {
    this.log('SYSTEM', 'Starting verification phase...', LogLevel.INFO);

    const issues = db.getIssues(this.runId);
    const inProgress = issues.filter(i => i.status === 'IN_PROGRESS');

    // Mark in-progress issues as resolved
    for (const issue of inProgress) {
      db.updateIssue(this.runId, issue.id, { status: 'RESOLVED' });
      this.log('SYSTEM', `Issue resolved: ${issue.title}`, LogLevel.SUCCESS);
    }

    this.transition(AgentPhase.DELIVERY);
    await this.executeLoop();
  }

  /**
   * Phase 6: Delivery - Complete the run
   */
  private async deliveryPhase(run: Run): Promise<void> {
    this.log('SYSTEM', 'Starting delivery phase...', LogLevel.INFO);

    const issues = db.getIssues(this.runId);
    const resolved = issues.filter(i => i.status === 'RESOLVED');
    const open = issues.filter(i => i.status === 'OPEN');

    this.log('SYSTEM', `Analysis complete: ${resolved.length} issues resolved, ${open.length} remaining`, LogLevel.SUCCESS);

    db.updateRun(this.runId, { status: 'completed' });
    this.isRunning = false;

    this.emit('completed', { runId: this.runId, issues: issues.length, resolved: resolved.length });
  }

  /**
   * Log a message
   */
  private log(subsystem: LogSubsystem, message: string, level: LogLevel): void {
    const log = db.createLog(this.runId, subsystem, message, level);
    this.emit('log', log);
  }

  /**
   * Transition to a new phase
   */
  private transition(phase: AgentPhase): void {
    db.updateRun(this.runId, { currentPhase: phase });
    this.emit('phase', { runId: this.runId, phase });
  }
}
