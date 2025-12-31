import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';

export class VideoRecorder {
  private page: Page | null = null;
  private outputPath: string | null = null;
  private recording = false;

  async startRecording(page: Page, outputPath: string): Promise<void> {
    // Playwright only records video when the BrowserContext was created with recordVideo.
    // In that case, page.video() will be defined.
    const video = page.video();
    if (!video) {
      throw new Error(
        'Page does not have video recording enabled. Create the BrowserContext with recordVideo enabled before opening the page.'
      );
    }

    this.page = page;
    this.outputPath = path.resolve(outputPath);
    this.recording = true;

    // If the page closes externally, consider the recording stopped.
    page.once('close', () => {
      this.recording = false;
    });
  }

  async stopRecording(): Promise<string> {
    if (!this.page) throw new Error('No active page recording');

    const page = this.page;
    const outputPath = this.outputPath;
    const video = page.video();
    if (!video) throw new Error('Video recording was not enabled for this page');

    // Video files are finalized when the page is closed.
    if (!page.isClosed()) {
      await page.close();
    }

    let finalPath: string;
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      // saveAs waits for the video to be ready.
      await video.saveAs(outputPath);
      finalPath = outputPath;
    } else {
      finalPath = await video.path();
    }

    this.page = null;
    this.outputPath = null;
    this.recording = false;

    return finalPath;
  }

  isRecording(): boolean {
    return this.recording;
  }

  getRecordingPath(): string {
    if (!this.outputPath) throw new Error('No recording path set');
    return this.outputPath;
  }
}
