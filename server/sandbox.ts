import { db } from './db';
import { RepoFile, ExecutionResult } from '../types';
import { GoogleGenAI } from "@google/genai";

/**
 * The Sandbox acts as the isolated execution environment ("The Hands").
 * 
 * UPGRADE: This now uses an LLM-based Shell Emulator. 
 * Instead of hardcoded strings, it feeds the virtual filesystem to Gemini
 * and asks "What would the output be?"
 */
export class Sandbox {
  private runId: string;
  private ai: GoogleGenAI | null;

  constructor(runId: string) {
    this.runId = runId;
    const apiKey = process.env.API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  /**
   * Executes a shell command using Generative AI to simulate the OS kernel.
   */
  public async execute(command: string): Promise<ExecutionResult> {
    const start = Date.now();
    
    // 1. Context Loading
    // We pass the file names and structure. For critical commands like 'test', we pass content.
    const files = db.getFiles(this.runId);
    const fileStructure = files.map(f => f.path).join('\n');
    
    // For specific commands, we need file content to give accurate output
    const isTest = command.includes('test') || command.includes('lint') || command.includes('cat');
    const isGit = command.includes('git');
    
    let context = `Current Working Directory: /app\nFiles:\n${fileStructure}`;
    
    if (isTest) {
        // limit content context to avoid token limits, prioritize source and tests
        const relevantContent = files
            .filter(f => f.path.match(/\.(ts|tsx|js|test|spec)/))
            .map(f => `--- ${f.path} ---\n${f.content}`)
            .join('\n');
        context += `\n\nFile Contents:\n${relevantContent}`;
    }

    if (!this.ai) {
        return {
            command,
            exitCode: 1,
            stdout: "",
            stderr: "Sandbox Error: AI Core offline. Cannot simulate shell execution.",
            durationMs: 0
        };
    }

    try {
        // 2. The Shell Emulator Prompt
        const prompt = `
            You are a Linux Shell Emulator (Bash).
            
            Context:
            ${context}
            
            User Command: $ ${command}
            
            Instructions:
            1. Simulate the execution of this command based strictly on the files provided.
            2. If the command checks for specific code (like 'grep' or 'npm test'), analyze the provided FILE CONTENTS to determine success or failure.
            3. Do NOT explain what you are doing. Output ONLY the raw stdout and stderr.
            4. If the command fails (e.g. test failure, syntax error), start the output with [EXIT_CODE:1]. If success, start with [EXIT_CODE:0].
            
            Example Output:
            [EXIT_CODE:0]
            src  package.json  README.md
        `;

        const result = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Speed is key for shell emulation
            contents: prompt,
            config: {
                temperature: 0.2 // Low temperature for deterministic shell behavior
            }
        });

        const rawOutput = result.text || "";
        
        // Parse the Hallucinated Shell Output
        let exitCode = 0;
        let output = rawOutput;

        if (rawOutput.includes('[EXIT_CODE:1]')) {
            exitCode = 1;
            output = rawOutput.replace('[EXIT_CODE:1]', '').trim();
        } else if (rawOutput.includes('[EXIT_CODE:0]')) {
            exitCode = 0;
            output = rawOutput.replace('[EXIT_CODE:0]', '').trim();
        }

        // Split standard out/err roughly (simple heuristic)
        const stderr = exitCode !== 0 ? output : "";
        const stdout = exitCode === 0 ? output : "";

        return {
            command,
            exitCode,
            stdout,
            stderr,
            durationMs: Date.now() - start
        };

    } catch (e: any) {
        return {
            command,
            exitCode: 1,
            stdout: "",
            stderr: `Shell Crash: ${e.message}`,
            durationMs: Date.now() - start
        };
    }
  }
}
