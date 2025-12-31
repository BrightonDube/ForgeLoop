import * as fs from 'fs';
import * as path from 'path';
import type { Page, ScreenshotOptions, ConsoleMessage } from 'playwright';

export interface DOMSnapshot {
  url: string;
  html: string;
  styles: string;
  capturedAt: string;
}

export interface ConsoleEntry {
  type: string;
  text: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
  timestamp: string;
}

export class CaptureService {
  private readonly artifactsDir: string;
  private readonly consoleBuffers = new WeakMap<Page, ConsoleEntry[]>();

  constructor(opts?: { artifactsDir?: string }) {
    this.artifactsDir = opts?.artifactsDir ?? path.resolve(process.cwd(), 'artifacts');
  }

  async captureScreenshot(page: Page, options?: ScreenshotOptions): Promise<Buffer> {
    const buf = (await page.screenshot({ type: 'png', ...options })) as Buffer;
    return buf;
  }

  async captureFullPage(page: Page): Promise<Buffer> {
    return this.captureScreenshot(page, { fullPage: true });
  }

  async captureElement(page: Page, selector: string): Promise<Buffer> {
    const locator = page.locator(selector);
    const buf = (await locator.screenshot({ type: 'png' })) as Buffer;
    return buf;
  }

  async captureDOMSnapshot(page: Page): Promise<DOMSnapshot> {
    const url = page.url();

    const html = await page.content();
    const styles = await page.evaluate(() => {
      const styleTags = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent ?? '')
        .join('\n');

      const inlineStyles = Array.from(document.querySelectorAll('[style]'))
        .slice(0, 500)
        .map((el) => {
          const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
          const cls = (el as HTMLElement).className ? `.${String((el as HTMLElement).className).split(' ').join('.')}` : '';
          return `${el.tagName.toLowerCase()}${id}${cls} { ${(el as HTMLElement).getAttribute('style') ?? ''} }`;
        })
        .join('\n');

      return `${styleTags}\n\n/* inline styles (sampled) */\n${inlineStyles}`;
    });

    return {
      url,
      html,
      styles,
      capturedAt: new Date().toISOString(),
    };
  }

  async captureConsoleLog(page: Page): Promise<ConsoleEntry[]> {
    this.ensureConsoleCapture(page);
    return [...(this.consoleBuffers.get(page) ?? [])];
  }

  async saveArtifact(data: Buffer, type: string, runId: string): Promise<string> {
    const dir = path.join(this.artifactsDir, runId);
    fs.mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${type}.png`;
    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, data);
    return filePath;
  }

  private ensureConsoleCapture(page: Page): void {
    if (this.consoleBuffers.has(page)) return;
    this.consoleBuffers.set(page, []);

    const push = (entry: ConsoleEntry) => {
      const buf = this.consoleBuffers.get(page);
      if (!buf) return;
      buf.push(entry);
      if (buf.length > 500) buf.splice(0, buf.length - 500);
    };

    const onConsole = (msg: ConsoleMessage) => {
      push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString(),
      });
    };

    page.on('console', onConsole);
    page.on('pageerror', (err) => {
      push({
        type: 'pageerror',
        text: err.message,
        timestamp: new Date().toISOString(),
      });
    });
  }
}
