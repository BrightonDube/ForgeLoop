import { db } from './db';
import { VisionResult } from '../types';

/**
 * The Vision System ("The Eyes").
 * Simulates a Headless Browser (Playwright) capturing screenshots.
 * In this environment, it determines the visual state by inspecting the code in the virtual DB.
 */
export class VisionSystem {
  private runId: string;

  constructor(runId: string) {
    this.runId = runId;
  }

  /**
   * Captures a screenshot of the current state of the application.
   * Returns a URL and Base64 data for Gemini.
   */
  public async capture(url: string): Promise<VisionResult> {
    // Artificial latency for "Browser Launch + Screenshot"
    await new Promise(r => setTimeout(r, 1200));

    // Determine state based on filesystem
    const files = db.getFiles(this.runId);
    const headerFile = files.find(f => f.path === 'src/components/Header.tsx');
    
    const isFixed = headerFile && (
        headerFile.content.includes('z-50') || 
        headerFile.content.includes('z-index')
    );

    // Using placehold.co to generate dynamic images that act as our "Screen"
    // We add specific text cues that Gemini Vision can read.
    if (isFixed) {
      return {
        timestamp: Date.now(),
        screenshotUrl: 'https://placehold.co/800x600/10b981/ffffff/png?text=UI+STATE%3A+FIXED%0A%0AHeader+z-index%3A+50%0AHero+Visible&font=roboto',
        base64Data: await this.urlToBase64('https://placehold.co/800x600/10b981/ffffff/png?text=UI+STATE%3A+FIXED%0A%0AHeader+z-index%3A+50%0AHero+Visible&font=roboto')
      };
    } else {
      return {
        timestamp: Date.now(),
        screenshotUrl: 'https://placehold.co/800x600/ef4444/ffffff/png?text=UI+STATE%3A+BROKEN%0A%0AHeader+Overlap+Detected%0AHero+Obscured&font=roboto',
        base64Data: await this.urlToBase64('https://placehold.co/800x600/ef4444/ffffff/png?text=UI+STATE%3A+BROKEN%0A%0AHeader+Overlap+Detected%0AHero+Obscured&font=roboto')
      };
    }
  }

  // Helper to get base64 from the placeholder service so we can actually send it to Gemini
  private async urlToBase64(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove data:image/png;base64, prefix
                resolve(base64.split(',')[1]);
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to fetch screenshot blob", e);
        return "";
    }
  }
}