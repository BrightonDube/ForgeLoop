import * as fs from 'fs';
import * as path from 'path';
import { DockerManager } from './docker';
import type { ExecutionResult } from '../types';

export interface TestResult {
  ok: boolean;
  exec: ExecutionResult;
}

export interface LintResult {
  ok: boolean;
  exec: ExecutionResult;
}

export class SandboxRunner {
  private readonly docker: DockerManager;
  private repoPath: string | null = null;
  private containerId: string | null = null;
  private serverUrl: string | null = null;
  private serverPort: number | null = null;

  constructor(docker?: DockerManager) {
    this.docker = docker ?? new DockerManager();
  }

  async initialize(repoPath: string): Promise<void> {
    this.repoPath = path.resolve(repoPath);

    const containerId = await this.docker.createContainer({
      repoPath: this.repoPath,
      workdir: '/workspace',
      ports: [{ containerPort: 5173 }],
    });

    this.containerId = containerId;
    await this.docker.startContainer(containerId);
  }

  async installDependencies(): Promise<ExecutionResult> {
    const pm = this.detectPackageManager();
    const corepack = pm !== 'npm';

    if (corepack) {
      await this.execShell(['corepack enable']);
    }

    if (pm === 'npm') {
      return this.execShell(['npm ci || npm install']);
    }

    if (pm === 'yarn') {
      return this.execShell(['yarn install --immutable || yarn install']);
    }

    return this.execShell(['pnpm install']);
  }

  async startDevServer(): Promise<{ url: string; port: number }> {
    const devCmd = this.detectDevServerCommand();
    const containerPort = 5173;

    await this.execDetachedShell([`${devCmd} --host 0.0.0.0 --port ${containerPort}`]);

    const id = this.requireContainerId();
    const mapped = await this.docker.getMappedHostPort(id, containerPort);
    if (!mapped) {
      throw new Error(`Failed to resolve host port mapping for ${containerPort}`);
    }

    const url = `http://localhost:${mapped}`;
    this.serverUrl = url;
    this.serverPort = mapped;

    return { url, port: mapped };
  }

  async stopDevServer(): Promise<void> {
    if (!this.containerId) return;
    await this.docker.stopContainer(this.containerId);
    await this.docker.removeContainer(this.containerId);
    this.containerId = null;
    this.serverUrl = null;
    this.serverPort = null;
  }

  async runTests(testCommand?: string): Promise<TestResult> {
    const exec = await this.execShell([testCommand ?? this.detectTestCommand()]);
    return { ok: exec.exitCode === 0, exec };
  }

  async runLinter(): Promise<LintResult> {
    const exec = await this.execShell([this.detectLintCommand()]);
    return { ok: exec.exitCode === 0, exec };
  }

  async executeScript(script: string): Promise<ExecutionResult> {
    return this.execShell([script]);
  }

  getServerUrl(): string {
    if (!this.serverUrl) throw new Error('Server not started');
    return this.serverUrl;
  }

  isServerRunning(): boolean {
    return Boolean(this.containerId && this.serverUrl && this.serverPort);
  }

  private requireContainerId(): string {
    if (!this.containerId) throw new Error('Sandbox container is not initialized');
    return this.containerId;
  }

  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
    const repo = this.requireRepoPath();
    if (fs.existsSync(path.join(repo, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(repo, 'yarn.lock'))) return 'yarn';
    return 'npm';
  }

  private detectDevServerCommand(): string {
    const pm = this.detectPackageManager();
    const pkg = this.readPackageJson();
    const hasDev = Boolean(pkg.scripts?.dev);
    if (hasDev) {
      return pm === 'npm' ? 'npm run dev' : pm === 'yarn' ? 'yarn dev' : 'pnpm dev';
    }

    return 'npx vite';
  }

  private detectTestCommand(): string {
    const pm = this.detectPackageManager();
    const pkg = this.readPackageJson();
    const hasTest = Boolean(pkg.scripts?.test);
    if (!hasTest) return 'node -e "process.exit(0)"';
    return pm === 'npm' ? 'npm test' : pm === 'yarn' ? 'yarn test' : 'pnpm test';
  }

  private detectLintCommand(): string {
    const pm = this.detectPackageManager();
    const pkg = this.readPackageJson();
    const hasLint = Boolean(pkg.scripts?.lint);
    if (!hasLint) return 'node -e "process.exit(0)"';
    return pm === 'npm' ? 'npm run lint' : pm === 'yarn' ? 'yarn lint' : 'pnpm lint';
  }

  private execShell(commands: string[]): Promise<ExecutionResult> {
    const id = this.requireContainerId();
    const cmd = commands.join(' && ');
    return this.docker.executeCommand(id, ['sh', '-lc', `cd /workspace && ${cmd}`]);
  }

  private async execDetachedShell(commands: string[]): Promise<void> {
    const id = this.requireContainerId();
    const cmd = commands.join(' && ');
    await this.docker.executeDetached(id, ['sh', '-lc', `cd /workspace && ${cmd}`]);
  }

  private requireRepoPath(): string {
    if (!this.repoPath) throw new Error('repoPath not initialized');
    return this.repoPath;
  }

  private readPackageJson(): any {
    const repo = this.requireRepoPath();
    const raw = fs.readFileSync(path.join(repo, 'package.json'), 'utf8');
    return JSON.parse(raw);
  }
}
