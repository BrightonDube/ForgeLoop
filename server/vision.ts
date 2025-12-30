
import { db } from './db';
import { VisionResult } from '../types';
import { GoogleGenAI } from "@google/genai";

/**
 * The Vision System ("The Eyes").
 * Uses Gemini Image Generation to render "Real" screenshots based on the code state.
 */
export class VisionSystem {
  private runId: string;
  private ai: GoogleGenAI | null;

  constructor(runId: string) {
    this.runId = runId;
    const apiKey = process.env.API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  /**
   * Captures a screenshot of the current state of the application.
   * Uses Generative AI to visualize what the code would look like rendered.
   */
  public async capture(url: string): Promise<VisionResult> {
    
    // Smart Context Aggregation
    const files = db.getFiles(this.runId);
    
    // Filter for UI-relevant files to build the prompt context
    const uiFiles = files.filter(f => 
        f.path.endsWith('.tsx') || 
        f.path.endsWith('.jsx') || 
        f.path.endsWith('.css') ||
        f.path.endsWith('html')
    );

    // Create a summarized view of the UI code to save tokens but keep structure
    const uiContext = uiFiles.map(f => {
        // If file is patched, prioritize it
        const prefix = f.isPatched ? "!!! RECENTLY PATCHED !!!\n" : "";
        // Take first 100 lines or full content if small
        const contentSnippet = f.content.length > 3000 ? f.content.substring(0, 3000) + "\n... (truncated)" : f.content;
        return `${prefix}File: ${f.path}\n${contentSnippet}`;
    }).join('\n\n');

    const promptContext = uiContext || "<div>No UI files found. App is empty.</div>";

    if (!this.ai) {
        // Fallback if no API key
        return {
            timestamp: Date.now(),
            screenshotUrl: 'https://placehold.co/800x600/334155/ffffff/png?text=Vision+System+Offline',
            base64Data: "" 
        };
    }

    try {
        // Step 1: Ask Gemini 3 Pro to describe the visual state based on the aggregate UI code
        const descriptionPrompt = `
           You are a Browser Rendering Engine (Chrome 120).
           
           I will provide you with the source code of a web application.
           Your job is to "render" it in your mind and describe the visual output for a screenshot generator.
           
           Pay special attention to files marked "!!! RECENTLY PATCHED !!!".
           
           If the code contains bugs (e.g., conflicting CSS, z-index issues, broken layout), you MUST describe the visual artifacts caused by those bugs.
           If the code looks correct, describe a clean, professional interface.
           
           Code Context:
           ${promptContext}
           
           Output a concise image generation prompt (max 50 words) describing the UI.
        `;

        const descriptionRes = await this.ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: descriptionPrompt
        });
        
        const visualPrompt = descriptionRes.text || "A screenshot of a modern web application.";

        // Step 2: Generate the image based on that description
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: visualPrompt }
                ]
            }
        });

        let base64Data = "";
        
        // Extract image from response
        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Data = part.inlineData.data;
                    break;
                }
            }
        }

        if (base64Data) {
            return {
                timestamp: Date.now(),
                screenshotUrl: `data:image/png;base64,${base64Data}`,
                base64Data: base64Data,
                analysis: visualPrompt // Return the description as analysis metadata
            };
        }
        
        throw new Error("No image generated");

    } catch (e) {
        console.error("Vision Generation Failed:", e);
        return {
             timestamp: Date.now(),
             screenshotUrl: 'https://placehold.co/800x600/334155/ffffff/png?text=Vision+Generation+Error',
             base64Data: ""
        };
    }
  }
}
