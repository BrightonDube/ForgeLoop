import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private consoleErrors: string[] = [];
  private requestFailures: string[] = [];

  async launch(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
  }

  async close(): Promise<void> {
    try {
      await this.page?.close();
    } finally {
      this.page = null;
    }

    try {
      await this.context?.close();
    } finally {
      this.context = null;
    }

    try {
      await this.browser?.close();
    } finally {
      this.browser = null;
    }
  }

  async newPage(): Promise<Page> {
    await this.launch();
    if (!this.context) throw new Error('Browser context not initialized');

    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    this.consoleErrors = [];
    this.requestFailures = [];

    const page = await this.context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      this.consoleErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      const failure = req.failure();
      const reason = failure?.errorText ?? 'unknown failure';
      this.requestFailures.push(`${req.method()} ${req.url()} - ${reason}`);
    });

    // Keep a simple "interception" hook for future policy enforcement.
    await page.route('**/*', async (route) => {
      await route.continue();
    });

    this.page = page;
    return page;
  }

  async goto(url: string): Promise<void> {
    const page = this.getPage();
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await this.waitForLoad();
        return;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await page.waitForTimeout(500 * attempt);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async waitForLoad(): Promise<void> {
    const page = this.getPage();
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
  }

  getPage(): Page {
    if (!this.page) throw new Error('Page not initialized. Call newPage() first.');
    return this.page;
  }

  setViewport(width: number, height: number): void {
    const page = this.getPage();
    void page.setViewportSize({ width, height });
  }

  async clearCache(): Promise<void> {
    if (!this.context) return;
    await this.context.clearCookies();
    await this.context.clearPermissions();

    if (this.page) {
      await this.page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // ignore
        }
      });
    }
  }

  getConsoleErrors(): string[] {
    return [...this.consoleErrors, ...this.requestFailures];
  }
}
