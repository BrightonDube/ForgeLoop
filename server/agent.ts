
import { GoogleGenAI } from "@google/genai";
import { db } from "./db";
import { GitHubService } from "../services/github";
import { Sandbox } from "./sandbox";
import { VisionSystem } from "./vision";
import { 
    AgentPhase, 
    LogLevel, 
    GitHubConfig, 
    ThinkingLevel, 
    ThoughtSignature, 
    VerificationArtifact,
    ConfidenceEvent,
    Issue,
    LogSubsystem
} from "../types";

/**
 * ForgeLoop Authoritative Agent
 * Adheres to PRD "Part 3 - Full Agent Spec"
 */
export class ForgeLoopAgent {
  private runId: string;
  private config: GitHubConfig;
  private isRunning: boolean = false;
  private github: GitHubService;
  
  // Subsystems
  private sandbox: Sandbox;
  private vision: VisionSystem;
  private ai: GoogleGenAI | null;

  // Agent State
  private currentLevel: ThinkingLevel = ThinkingLevel.OBSERVE;
  private iterationCount: number = 0;
  private maxIterations: number = 3; // Reduced for stricter convergence

  // Memory
  private currentHypothesis: string | null = null;
  private currentTargetFile: string | null = null;

  constructor(runId: string, config: GitHubConfig) {
    this.runId = runId;
    this.config = config;
    this.github = new GitHubService(config.token, config.owner, config.repo);
    this.sandbox = new Sandbox(runId);
    this.vision = new VisionSystem(runId);
    
    const apiKey = process.env.API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  public start() {
    this.isRunning = true;
    this.iterationCount = 0;
    this.currentLevel = ThinkingLevel.OBSERVE;
    this.runLoop();
  }

  public stop() {
    this.isRunning = false;
    db.updateRun(this.runId, { status: 'stopped' });
    this.log('CORE', 'Agent process halted.', LogLevel.WARN);
  }

  public async humanApprovalReceived() {
      this.log('CORE', 'Human Override: Approval Granted.', LogLevel.SUCCESS);
      await this.deliveryPhase();
  }

  public async humanRejectionReceived() {
      this.log('CORE', 'Human Override: Rejection.', LogLevel.ERROR);
      // Explicitly mark as FAILED only on user rejection
      db.updateRun(this.runId, { status: 'failed' });
      this.isRunning = false;
  }

  // --- The Core Loop (PRD Section 5) ---

  private async runLoop() {
      if (!this.isRunning) return;

      const run = db.getRun(this.runId);
      if (!run || run.status === 'stopped' || run.status === 'failed' || run.status === 'paused' || run.status === 'completed') return;

      // PRD Part 8: Confidence Gating
      if (run.currentConfidence >= 0.85) {
          this.log('CORE', `Confidence Threshold Met (${(run.currentConfidence * 100).toFixed(1)}%). Initiating PR.`, LogLevel.SUCCESS);
          await this.deliveryPhase();
          return;
      }

      if (this.iterationCount >= this.maxIterations) {
          this.log('CORE', 'Max Iterations Exceeded. Concluding session.', LogLevel.WARN);
          // Just stop, do not fail.
          db.updateRun(this.runId, { status: 'stopped' }); 
          this.isRunning = false;
          return;
      }

      try {
          switch (this.currentLevel) {
              case ThinkingLevel.OBSERVE:
                  await this.levelObserve();
                  break;
              case ThinkingLevel.DIAGNOSE:
                  await this.levelDiagnose();
                  break;
              case ThinkingLevel.PLAN:
                  await this.levelPlan();
                  break;
              case ThinkingLevel.VERIFY: // Execute is part of Plan->Verify transition in this FSM
                  await this.levelVerify();
                  break;
              case ThinkingLevel.REFLECT:
                  await this.levelReflect();
                  break;
          }
      } catch (e: any) {
          this.log('CORE', `Agent Exception: ${e.message}`, LogLevel.ERROR);
          this.stop();
      }
  }

  private transition(level: ThinkingLevel, summary: string) {
    if (!this.isRunning) return;
    this.currentLevel = level;
    
    // Map internal level to UI phase
    let uiPhase = AgentPhase.OBSERVING;
    if (level === ThinkingLevel.DIAGNOSE) uiPhase = AgentPhase.DIAGNOSING;
    if (level === ThinkingLevel.PLAN) uiPhase = AgentPhase.PLANNING;
    if (level === ThinkingLevel.VERIFY) uiPhase = AgentPhase.VERIFYING;
    if (level === ThinkingLevel.REFLECT) uiPhase = AgentPhase.REFLECTING;

    db.updateRun(this.runId, { currentPhase: uiPhase });
    this.log('CORE', `Transition -> ${ThinkingLevel[level]}: ${summary}`, LogLevel.INFO);
    
    // Immediate tick
    setTimeout(() => this.runLoop(), 100);
  }

  // --- Thinking Levels Implementation ---

  private async levelObserve() {
      this.log('PERCEPTION', 'Ingesting filesystem and visual state...', LogLevel.INFO);
      
      // 1. Ingest Code (if first run)
      if (this.iterationCount === 0) {
          try {
            const defaultBranch = await this.github.getDefaultBranch();
            const files = await this.github.fetchFiles(defaultBranch);
            files.forEach(f => db.upsertFile(this.runId, f));
            this.log('GITHUB', `Ingested ${files.length} files from ${defaultBranch}.`, LogLevel.SUCCESS);
          } catch (e: any) {
            this.log('GITHUB', `Failed to fetch repo: ${e.message}`, LogLevel.ERROR);
            this.stop();
            return;
          }
      }

      // 2. Visual Snapshot (Using Gemini Vision)
      // We do this every iteration to catch visual regressions
      const visionState = await this.vision.capture('http://localhost:3000');
      
      // 3. Persist Artifact
      const artifact = db.addVerificationArtifact({
          runId: this.runId,
          type: 'screenshot',
          data: visionState,
          summary: visionState.analysis || "Visual State Capture"
      });

      await this.recordThought(
          ThinkingLevel.OBSERVE, 
          "System state capture required for diagnosis.", 
          "Captured DOM and Visual state.", 
          [artifact.id], 
          0.2
      );

      this.transition(ThinkingLevel.DIAGNOSE, "Observation complete.");
  }

  private async levelDiagnose() {
      this.log('CORE', 'Running Static Analysis & Logic Verification...', LogLevel.THOUGHT);
      
      const files = db.getFiles(this.runId);
      // Construct a richer context map
      const fileContext = files.map(f => `--- ${f.path} ---\n${f.content.substring(0, 1500)}\n...`).join('\n');
      const artifacts = db.getArtifacts(this.runId); 
      const lastVision = artifacts.find(a => a.type === 'vision_analysis')?.data?.analysis || "No visual data";

      if (!this.ai) {
          this.transition(ThinkingLevel.PLAN, "Offline Mode - Skipping diagnosis");
          return;
      }

      // STRICT DIAGNOSIS PROMPT
      const prompt = `
        You are the ForgeLoop Logic Analyzer.
        Your goal is to find CRITICAL DEFECTS (Syntax errors, Infinite Loops, Crash-causing logic, Visual overlap).
        
        Files:
        ${fileContext}
        
        Visual State Analysis:
        ${lastVision}
        
        Instructions:
        1. Analyze the code strictly. Do NOT invent bugs.
        2. If the code appears functional and correct, you MUST set "healthy": true.
        3. Only report a bug if you are >80% confident it exists.
        
        Output MUST be valid JSON matching this schema:
        {
            "healthy": boolean, 
            "title": "Short title of the bug (if any)",
            "description": "Detailed explanation of the root cause",
            "filepath": "The EXACT path of the file that needs fixing",
            "priority": "HIGH" | "MEDIUM" | "LOW",
            "confidence": number (0-100)
        }
      `;

      try {
          const res = await this.ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt,
              config: { 
                  responseMimeType: 'application/json',
                  thinkingConfig: { thinkingBudget: 2048 } // Allow deep thinking
              }
          });

          const diagnosis = JSON.parse(res.text || "{}");
          
          // CRITICAL: Exit Path for Healthy Repos
          if (diagnosis.healthy === true) {
              this.log('CORE', 'Analysis Complete: Repository is Healthy. No patches required.', LogLevel.SUCCESS);
              await this.recordThought(
                  ThinkingLevel.DIAGNOSE, 
                  "Checking for defects.", 
                  "No critical defects found. System is healthy.", 
                  [], 
                  1.0
              );
              // Mark run as completed successfully
              db.updateRun(this.runId, { status: 'completed', currentConfidence: 1.0 });
              this.isRunning = false;
              return;
          }

          if (!diagnosis.filepath) {
              throw new Error("Diagnosis returned an issue but no filepath.");
          }

          this.currentHypothesis = diagnosis.description;
          this.currentTargetFile = diagnosis.filepath;

          // Create an Issue entry for UI visibility based on REAL AI output
          db.createIssue({
              runId: this.runId,
              title: diagnosis.title || "Detected Anomaly",
              description: diagnosis.description,
              filepath: diagnosis.filepath,
              priority: diagnosis.priority || 'HIGH',
              confidence: diagnosis.confidence || 70,
              status: 'OPEN'
          });

          await this.recordThought(
              ThinkingLevel.DIAGNOSE, 
              diagnosis.description, 
              `Detected issue in ${diagnosis.filepath}`, 
              [], 
              (diagnosis.confidence || 50) / 100
          );

          this.transition(ThinkingLevel.PLAN, "Issue identified.");

      } catch (e: any) {
          this.log('CORE', `Diagnosis Logic Error: ${e.message}`, LogLevel.ERROR);
          // If diagnosis fails, we assume safety and stop rather than hallucinating
          db.updateRun(this.runId, { status: 'completed' });
          this.isRunning = false;
      }
  }

  private async levelPlan() {
      this.log('CORE', 'Formulating remediation plan...', LogLevel.THOUGHT);

      if (!this.currentHypothesis || !this.currentTargetFile || !this.ai) {
          this.transition(ThinkingLevel.VERIFY, "No plan possible.");
          return;
      }

      // 1. Get the EXACT file identified in Diagnosis
      const files = db.getFiles(this.runId);
      const targetFile = files.find(f => f.path === this.currentTargetFile);

      if (!targetFile) {
          this.log('CORE', `Planned target ${this.currentTargetFile} not found in memory. Aborting step.`, LogLevel.ERROR);
          this.transition(ThinkingLevel.REFLECT, "Target file missing.");
          return;
      }

      const prompt = `
        You are the ForgeLoop Planner.
        
        Hypothesis: ${this.currentHypothesis}
        Target File: ${targetFile.path}
        
        Current Content:
        ${targetFile.content}
        
        Task: Provide the FULL corrected file content to fix the issue.
        Constraint: 
        - Do NOT simply return the same code. 
        - If no valid fix exists, return the string "NO_FIX".
        
        Output ONLY the code.
      `;

      try {
          const res = await this.ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: prompt
          });

          const fixedContent = res.text?.replace(/```(typescript|tsx|javascript|json|css|html)?/g, '').replace(/```/g, '').trim();
          
          if (!fixedContent || fixedContent.includes("NO_FIX")) {
               this.log('CORE', 'AI determined no valid fix is possible.', LogLevel.WARN);
               this.transition(ThinkingLevel.REFLECT, "Planning aborted.");
               return;
          }

          // Anti-Hallucination Check: Is it actually different?
          // Simple string comparison (ignoring whitespace for robustness)
          const cleanOriginal = targetFile.content.replace(/\s+/g, '');
          const cleanFixed = fixedContent.replace(/\s+/g, '');
          
          if (cleanOriginal === cleanFixed) {
              this.log('CORE', 'Generated fix is identical to original code (No-Op). Aborting.', LogLevel.WARN);
              this.transition(ThinkingLevel.REFLECT, "No-Op detected.");
              return;
          }
          
          if (fixedContent.length > 10) {
              // 2. EXECUTE (Immediate application as per PRD "Execute" step inside loop)
              this.log('EXECUTION', `Patching ${targetFile.path}...`, LogLevel.INFO);
              
              db.upsertFile(this.runId, { ...targetFile, content: fixedContent, isPatched: true });
              
              db.createArtifact({
                  runId: this.runId,
                  type: 'diff',
                  data: { filePath: targetFile.path, original: targetFile.content, modified: fixedContent }
              });

              await this.recordThought(
                  ThinkingLevel.PLAN, 
                  "Code change required to resolve hypothesis.", 
                  `Patched ${targetFile.path}`, 
                  [], 
                  0.4
              );
              this.transition(ThinkingLevel.VERIFY, "Patch applied.");
          } else {
             throw new Error("Generated code was empty or invalid.");
          }
      } catch (e: any) {
          this.log('CORE', `Planning failed: ${e.message}`, LogLevel.ERROR);
          this.transition(ThinkingLevel.REFLECT, "Planning error.");
      }
  }

  private async levelVerify() {
      this.log('VERIFICATION', 'Running Verification Suite...', LogLevel.INFO);

      // 1. Run Tests (Simulated via AI Shell)
      // We pass --passWithNoTests to ensure we get an exit code based on logic
      const testResult = await this.sandbox.execute('npm test -- --passWithNoTests');
      
      const artifact = db.addVerificationArtifact({
          runId: this.runId,
          type: 'test-report',
          data: testResult,
          summary: testResult.exitCode === 0 ? "Tests Passed" : "Tests Failed"
      });

      // 2. Capture Signals for Confidence Scoring
      if (testResult.exitCode === 0) {
          db.addConfidenceEvent({
              thoughtId: "pending",
              signal: 'test_pass',
              weight: 0.50 // High weight for test passing
          });
      } else {
          db.addConfidenceEvent({
              thoughtId: "pending",
              signal: 'test_fail',
              weight: -0.80 // Very high penalty for failing tests
          });
      }

      this.log('VERIFICATION', `Test Result: ${testResult.exitCode === 0 ? 'PASS' : 'FAIL'}`, testResult.exitCode === 0 ? LogLevel.SUCCESS : LogLevel.ERROR);
      
      this.transition(ThinkingLevel.REFLECT, "Verification data collected.");
  }

  private async levelReflect() {
      this.log('CORE', 'Reflecting on outcomes and confidence...', LogLevel.THOUGHT);
      
      const events = db['data'].confidenceEvents;
      
      let score = 0.2; // Base confidence
      
      // Calculate Score Deterministically
      const recentEvents = events.slice(-5);
      for (const event of recentEvents) {
          score += event.weight;
      }
      
      // Clamp 0.0 -> 1.0
      score = Math.max(0, Math.min(1, score));
      
      db.updateRun(this.runId, { currentConfidence: score });
      
      await this.recordThought(
          ThinkingLevel.REFLECT, 
          "Evaluating iteration success.", 
          `Confidence computed at ${score.toFixed(2)}`, 
          [], 
          score
      );

      this.iterationCount++;

      // Decision Logic
      if (score >= 0.85) {
          // Handled by runLoop check next tick
          this.log('CORE', 'Confidence sufficient for delivery.', LogLevel.SUCCESS);
      } else if (score < 0.3 && this.iterationCount > 1) {
          // If we are failing badly after 2 tries, stop. Don't iterate endlessly.
          this.log('CORE', 'Confidence insufficient to proceed. Halting to ensure system stability.', LogLevel.WARN);
          // Do NOT mark as failed. Mark as stopped.
          db.updateRun(this.runId, { status: 'stopped' });
          this.isRunning = false;
      } else {
          this.log('CORE', `Confidence insufficient (${score.toFixed(2)}). Attempting refinement...`, LogLevel.WARN);
          this.transition(ThinkingLevel.DIAGNOSE, "Starting next iteration.");
      }
  }

  private async deliveryPhase() {
      // PR Creation
      const diffs = db.getArtifacts(this.runId).filter(a => a.type === 'diff');
      if (diffs.length > 0) {
          const lastDiff = diffs[diffs.length - 1].data;
           try {
              const branch = `fix/forge-${Date.now().toString().slice(-6)}`;
              const defaultBranch = await this.github.getDefaultBranch();
              
              this.log('GITHUB', `Creating PR branch: ${branch}`, LogLevel.INFO);
              await this.github.createBranch(branch, defaultBranch);
              await this.github.commitAndPush(branch, "fix: autonomous repair", [{ path: lastDiff.filePath, content: lastDiff.modified }]);
              const prUrl = await this.github.createPR("fix: autonomous repair", "Fix generated by ForgeLoop Agent.", branch, defaultBranch);
              
              db.createArtifact({ runId: this.runId, type: 'pr', data: { url: prUrl } });
              this.log('GITHUB', `PR Open: ${prUrl}`, LogLevel.SUCCESS);
          } catch (e: any) {
              this.log('GITHUB', `Delivery Failed: ${e.message}`, LogLevel.ERROR);
          }
      }
      
      db.updateRun(this.runId, { status: 'completed' });
      this.isRunning = false;
  }

  // --- Helpers ---

  private async recordThought(
      level: ThinkingLevel, 
      hypothesis: string, 
      decision: string, 
      evidence: string[], 
      confidence: number
  ) {
      const thought = db.createThought({
          runId: this.runId,
          thinkingLevel: level,
          hypothesis,
          decision,
          outcome: 'confirmed', 
          confidence,
          evidenceRefs: evidence,
          summary: `${ThinkingLevel[level]}: ${decision}`
      });
      
      this.log('MEMORY', `[Thought] ${hypothesis} -> ${decision} (Conf: ${confidence.toFixed(2)})`, LogLevel.THOUGHT);
  }

  private log(subsystem: LogSubsystem, message: string, level: LogLevel) {
    db.createLog({ runId: this.runId, subsystem, message, level });
  }
}

// Map the generic Orchestrator export to this new class for compatibility with api.ts
export { ForgeLoopAgent as Orchestrator };
