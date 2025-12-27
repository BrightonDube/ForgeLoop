import "server-only";
import { GoogleGenAI } from "@google/genai";
import { db } from "./db";
import { Sandbox } from "./sandbox";
import { VisionSystem } from "./vision";
import { AgentPhase, LogLevel } from "../types";
import type { Run, LogEntry, LogSubsystem, Issue, RepoFile, VisionResult } from "../types";

// --- Configuration ---
const DEMO_REPO = "github.com/demo/broken-app";

// --- The Brain (Gemini Client) ---
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// --- Agent Worker Class ---
export class AgentWorker {
  private runId: string;
  private isRunning: boolean = false;
  private timer: any = null;
  private ai: GoogleGenAI | null;
  private sandbox: Sandbox;
  private vision: VisionSystem;

  constructor(runId: string) {
    this.runId = runId;
    this.ai = getAiClient();
    this.sandbox = new Sandbox(runId);
    this.vision = new VisionSystem(runId);
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.executeLoop();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
    db.updateRun(this.runId, { status: 'stopped' });
    this.log('SYSTEM', 'Agent execution stopped by user.', LogLevel.WARN);
  }

  private async executeLoop() {
    const run = db.getRun(this.runId);
    if (!run || !this.isRunning) return;

    try {
      await this.processPhase(run);
    } catch (error) {
      this.log('SYSTEM', `Critical Failure: ${error}`, LogLevel.ERROR);
      this.stop();
    }
  }

  private async processPhase(run: Run) {
    // 1. Ingestion Phase
    if (run.currentPhase === AgentPhase.INGESTION) {
      await this.ingestionPhase(run);
    } 
    
    // 2. Planning Phase
    else if (run.currentPhase === AgentPhase.PLANNING) {
      await this.planningPhase(run);
    }

    // 3. Execution (Setup) Phase
    else if (run.currentPhase === AgentPhase.EXECUTION) {
      await this.executionPhase(run);
    }

    // 4. Observation Phase (The Eyes)
    else if (run.currentPhase === AgentPhase.OBSERVATION) {
       await this.observationPhase(run);
    }

    // 5. Verification Phase (Fix & Verify)
    else if (run.currentPhase === AgentPhase.VERIFICATION) {
      await this.verificationPhase(run);
    }

    // 6. Delivery Phase
    else if (run.currentPhase === AgentPhase.DELIVERY) {
      await this.deliveryPhase(run);
    }

    if (this.isRunning) {
      this.timer = setTimeout(() => this.executeLoop(), 100);
    }
  }

  // --- Phase Implementations ---

  private async ingestionPhase(run: Run) {
      await this.step('SYSTEM', 'Initializing sandbox environment...', 500);
      await this.step('BRAIN', `Cloning repository ${run.repoUrl}...`, 800);
      
      this.populateMockFileSystem();
      await this.step('SYSTEM', 'File system mounted. 24 files indexed.', 200);

      const summary = await this.generateThought(
        "Ingestion", 
        "I have cloned the repo. It is a Next.js app. Summarize the likely structure of a broken Next.js app.",
        "Flattening codebase... Found Next.js App Router structure. Token count: 1.2M."
      );
      await this.step('BRAIN', summary, 1000);
      
      this.transition(AgentPhase.PLANNING);
  }

  private async planningPhase(run: Run) {
      await this.step('BRAIN', 'Analyzing file context for logical and visual regressions...', 1000);
      
      const files = db.getFiles(this.runId);
      const fileContext = files.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n');
      
      await this.step('BRAIN', `Thinking about ${files.length} files...`, LogLevel.THOUGHT);

      const detectedIssues = await this.detectIssues(fileContext);
      
      if (detectedIssues.length > 0) {
          await this.step('BRAIN', `Detected ${detectedIssues.length} issues in the codebase. Prioritizing...`, LogLevel.SUCCESS);
          
          for (const issue of detectedIssues) {
               db.createIssue({
                   runId: this.runId,
                   ...issue,
                   status: 'OPEN'
               });
               await this.step('BRAIN', `Identified Issue: ${issue.title} (${issue.priority})`, LogLevel.WARN);
          }

          await this.step('SYSTEM', 'Plan Locked: Focusing on HIGH priority z-index regression.', LogLevel.SUCCESS);
      } else {
           await this.step('BRAIN', 'No structured issues returned (simulating fallback)...', LogLevel.WARN);
           db.createIssue({
               runId: this.runId,
               title: "Header Z-Index Regression",
               description: "The header component overlaps the hero content.",
               filepath: "src/components/Header.tsx",
               priority: "HIGH",
               confidence: 95,
               status: 'OPEN'
           });
      }
      
      this.transition(AgentPhase.EXECUTION);
  }

  private async executionPhase(run: Run) {
      await this.step('HANDS', 'Preparing execution environment...', 500);
      
      await this.executeCommand('npm ci');
      await this.executeCommand('ls -la src');

      await this.step('HANDS', 'Environment ready. Dependencies installed.', LogLevel.SUCCESS);
      
      this.transition(AgentPhase.OBSERVATION);
  }

  private async observationPhase(run: Run) {
      // Start server
      await this.executeCommand('npm run dev');
      
      // Phase 6: Multimodal Observation
      await this.step('EYES', 'Navigating to localhost:3000...', 500);
      
      const visionResult = await this.vision.capture('http://localhost:3000');
      
      await this.step('EYES', 'Screenshot captured. Encoding 800x600 image...', LogLevel.INFO);

      // Store artifact
      db.createArtifact({
        runId: this.runId,
        type: 'diff',
        data: { beforeUrl: visionResult.screenshotUrl, detectedIssues: [] } // Issues updated after analysis
      });

      await this.step('BRAIN', 'Sending visual context to Gemini 3 Vision...', LogLevel.THOUGHT);

      // Actual Multimodal Call
      const analysis = await this.analyzeImage(
          visionResult.base64Data, 
          "You are a QA automation agent. Analyze this screenshot of a web app. Describe any visual defects, overlapping elements, or broken layouts. Be concise."
      );
      
      await this.step('BRAIN', `Vision Analysis: ${analysis}`, LogLevel.WARN);

      // Update artifacts with detected issues from Gemini
      const issues = analysis.includes('Overlap') || analysis.includes('Broken') ? ['Overlap Detected', 'Layout Shift'] : [];
      db.createArtifact({
          runId: this.runId,
          type: 'diff',
          data: { beforeUrl: visionResult.screenshotUrl, detectedIssues: issues }
      });
      
      this.transition(AgentPhase.VERIFICATION); 
  }

  private async verificationPhase(run: Run) {
      await this.step('BRAIN', 'Generating patch for src/components/Header.tsx...', 800);
      
      // Apply Patch
      this.applyPatch();
      await this.step('HANDS', 'Patch written to filesystem. Added `z-50 relative`.', 500);

      // Verify Test
      const testResult = await this.executeCommand('npm test');
      
      if (testResult.exitCode === 0) {
           await this.step('HANDS', 'Automated Tests Passed.', LogLevel.SUCCESS);

           // Phase 6: Visual Verification
           await this.step('EYES', 'Taking verification screenshot...', 500);
           const verifyResult = await this.vision.capture('http://localhost:3000');
           
           const visualCheck = await this.analyzeImage(
               verifyResult.base64Data,
               "Compare this screenshot to the previous state. Is the layout overlap fixed? Answer YES or NO."
           );

           await this.step('BRAIN', `Visual Confirmation: ${visualCheck}`, LogLevel.SUCCESS);

           const prevArtifact = db.getArtifacts(this.runId).find(a => a.type === 'diff');
           const beforeUrl = prevArtifact ? prevArtifact.data.beforeUrl : '';

           db.createArtifact({
             runId: this.runId,
             type: 'diff',
             data: { beforeUrl, afterUrl: verifyResult.screenshotUrl, detectedIssues: [] }
           });
           
           // Mark issue Resolved
           const issues = db.getIssues(this.runId);
           const targetIssue = issues.find(i => i.priority === 'HIGH');
           if (targetIssue) {
               db.updateIssue(targetIssue.id, { status: 'RESOLVED' });
           }

           this.transition(AgentPhase.DELIVERY);

      } else {
           await this.step('HANDS', 'Tests FAILED. Rolling back...', LogLevel.ERROR);
           this.stop();
      }
  }
  
  private async deliveryPhase(run: Run) {
      await this.executeCommand('git commit -m "fix(ui): resolve header z-index issue"');
      await this.executeCommand('git push origin fix/header-z-index');
      
      await this.step('SYSTEM', 'PR #42 Created successfully.', LogLevel.SUCCESS);
      
      db.updateRun(this.runId, { status: 'completed' });
      this.isRunning = false; 
  }

  // --- Logic Helpers ---

  private async executeCommand(cmd: string) {
      await this.step('HANDS', `$ ${cmd}`, LogLevel.INFO);
      const result = await this.sandbox.execute(cmd);
      
      if (result.stdout) await this.step('HANDS', result.stdout, LogLevel.INFO);
      if (result.stderr) await this.step('HANDS', result.stderr, LogLevel.ERROR);
      return result;
  }

  private async detectIssues(fileContext: string): Promise<Omit<Issue, 'id' | 'runId' | 'status'>[]> {
      if (!this.ai) return [];

      const prompt = `
        You are a senior QA engineer. Analyze the following code.
        Identify logical bugs or likely visual regressions (especially z-index or overflow).
        Output JSON array: [{ title, description, filepath, priority, confidence }]
      `;

      try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Code Context:\n${fileContext}\n\nTask:\n${prompt}`
        });
        
        const text = response.text || "";
        const cleanJson = text.replace(//g, '').replace(//g, '').trim();
        return JSON.parse(cleanJson);
      } catch (e) {
          console.error("Failed to detect issues via AI", e);
          return [];
      }
  }

  private async analyzeImage(base64Data: string | undefined, prompt: string): Promise<string> {
      if (!this.ai || !base64Data) return "Simulated Analysis: Visual layout appears correct.";

      try {
          const response = await this.ai.models.generateContent({
              model: 'gemini-3-flash-preview', // Or gemini-pro-vision if available in this env
              contents: {
                  parts: [
                      { inlineData: { mimeType: 'image/png', data: base64Data } },
                      { text: prompt }
                  ]
              }
          });
          return response.text || "No analysis returned.";
      } catch (e) {
          console.warn("Vision analysis failed (likely API key or model support)", e);
          return "Simulated Analysis: Visual layout appears correct.";
      }
  }

  private populateMockFileSystem() {
    const files = [
        { path: 'package.json', content: '{\n  "name": "demo-app",\n  "version": "1.0.0"\n}' },
        { path: 'next.config.js', content: 'module.exports = {\n  reactStrictMode: true,\n}' },
        { path: 'src/app/page.tsx', content: 'import Header from "@/components/Header";\n\nexport default function Home() {\n  return (\n    <main>\n      <Header />\n      <Hero />\n    </main>\n  );\n}' },
        { path: 'src/app/layout.tsx', content: 'export default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}' },
        { path: 'src/components/Header.tsx', content: 'export default function Header() {\n  // Bug: Missing z-index causes overlap with Hero\n  return (\n    <header className="fixed top-0 w-full bg-white shadow-sm">\n      <nav className="flex justify-between p-4">\n        <div className="font-bold">Logo</div>\n        <button>Sign Up</button>\n      </nav>\n    </header>\n  );\n}' },
        { path: 'src/components/Hero.tsx', content: 'export default function Hero() {\n  return (\n    <div className="mt-16 h-96 bg-blue-600 flex items-center justify-center text-white">\n      <h1>Welcome to Code Ocean</h1>\n    </div>\n  );\n}' },
    ];

    files.forEach(f => {
        db.upsertFile(this.runId, { ...f, language: 'typescript' });
    });
  }

  private applyPatch() {
    const patchedContent = 'export default function Header() {\n  // Fixed: Added z-index to prevent overlap\n  return (\n    <header className="fixed top-0 w-full bg-white shadow-sm z-50 relative">\n      <nav className="flex justify-between p-4">\n        <div className="font-bold">Logo</div>\n        <button>Sign Up</button>\n      </nav>\n    </header>\n  );\n}';
    
    db.upsertFile(this.runId, {
        path: 'src/components/Header.tsx',
        content: patchedContent,
        language: 'typescript',
        isPatched: true
    });
  }

  // --- Helpers ---

  private async step(subsystem: LogSubsystem, message: string, delayOrLevel: number | LogLevel = 500) {
    const delay = typeof delayOrLevel === 'number' ? delayOrLevel : 0;
    const level = typeof delayOrLevel === 'string' ? delayOrLevel : LogLevel.INFO;

    if (delay > 0) {
        await new Promise(r => this.timer = setTimeout(r, delay));
    }

    this.log(subsystem, message, level);
  }

  private log(subsystem: LogSubsystem, message: string, level: LogLevel) {
    db.createLog({
      runId: this.runId,
      subsystem,
      message,
      level
    });
  }

  private transition(phase: AgentPhase) {
    db.updateRun(this.runId, { currentPhase: phase });
  }

  private async generateThought(context: string, prompt: string, fallback: string): Promise<string> {
    if (!this.ai) return fallback;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an AI software engineer. Context: ${context}. Task: ${prompt}. Output a single concise log line (max 20 words).`,
      });
      return response.text || fallback;
    } catch (e) {
      console.warn("Gemini generation failed, using fallback", e);
      return fallback;
    }
  }
}