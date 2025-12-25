import { db } from './db';
import { RepoFile, ExecutionResult } from '../types';

/**
 * The Sandbox acts as the isolated execution environment ("The Hands").
 * It interacts with the virtual file system in the DB and simulates shell commands.
 */
export class Sandbox {
  private runId: string;
  private processes: Set<string> = new Set();

  constructor(runId: string) {
    this.runId = runId;
  }

  /**
   * Executes a shell command in the sandbox.
   */
  public async execute(command: string): Promise<ExecutionResult> {
    const start = Date.now();
    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    // Simulate network/disk latency
    await new Promise(r => setTimeout(r, Math.random() * 500 + 200));

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case 'npm':
          const npmResult = await this.handleNpm(args);
          exitCode = npmResult.exitCode;
          stdout = npmResult.stdout;
          stderr = npmResult.stderr;
          break;

        case 'ls':
          stdout = this.handleLs(args);
          break;

        case 'cat':
          stdout = this.handleCat(args);
          break;
        
        case 'git':
          const gitResult = this.handleGit(args);
          stdout = gitResult.stdout;
          break;

        default:
          exitCode = 127;
          stderr = `bash: ${cmd}: command not found`;
      }
    } catch (e: any) {
      exitCode = 1;
      stderr = e.message || 'Unknown execution error';
    }

    // Artificial delay for heavier commands
    if (cmd === 'npm' && (args.includes('install') || args.includes('ci'))) {
       await new Promise(r => setTimeout(r, 1500));
    }

    return {
      command,
      exitCode,
      stdout,
      stderr,
      durationMs: Date.now() - start
    };
  }

  // --- Command Handlers ---

  private async handleNpm(args: string[]): Promise<{ exitCode: number, stdout: string, stderr: string }> {
    const sub = args[0];

    if (sub === 'install' || sub === 'ci') {
      return {
        exitCode: 0,
        stdout: `
added 842 packages, and audited 843 packages in 2s

104 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities`,
        stderr: ''
      };
    }

    if (sub === 'run' && args[1] === 'dev') {
      this.processes.add('dev-server');
      return {
        exitCode: 0,
        stdout: `
> demo-app@1.0.0 dev
> next dev

ready - started server on 0.0.0.0:3000, url: http://localhost:3000
event - compiled client and server successfully in 1241 ms (156 modules)
wait  - compiling...
event - compiled successfully
`,
        stderr: ''
      };
    }

    if (sub === 'test') {
      return this.runTests();
    }

    return { exitCode: 1, stdout: '', stderr: `npm ERR! Unknown command: ${sub}` };
  }

  private runTests(): { exitCode: number, stdout: string, stderr: string } {
    // Heuristic: Check if the bug is fixed in the virtual filesystem
    const files = db.getFiles(this.runId);
    const headerFile = files.find(f => f.path === 'src/components/Header.tsx');
    
    if (!headerFile) {
        return { exitCode: 1, stdout: '', stderr: 'FAIL: src/components/Header.tsx not found' };
    }

    // The test logic: Check for z-index
    const hasFix = headerFile.content.includes('z-50') || headerFile.content.includes('z-index');

    if (hasFix) {
      return {
        exitCode: 0,
        stdout: `
PASS src/components/Header.test.tsx
  Header Component
    ✓ should render logo (12 ms)
    ✓ should contain sign up button (5 ms)
    ✓ should be positioned above Hero (8 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        1.245 s
`,
        stderr: ''
      };
    } else {
      return {
        exitCode: 1,
        stdout: `
FAIL src/components/Header.test.tsx
  Header Component
    ✓ should render logo (12 ms)
    ✓ should contain sign up button (5 ms)
    ✕ should be positioned above Hero (24 ms)

  ● Header Component › should be positioned above Hero

    Expected element to be visible, but it was obscured by <div class="hero">.
    Ensure z-index is set correctly.

      22 |     render(<Header />);
      23 |     render(<Hero />);
    > 24 |     expect(screen.getByText('Sign Up')).toBeVisible();
         |                                         ^
      25 |   });

Test Suites: 1 failed, 1 total
Tests:       1 failed, 2 passed, 3 total
Snapshots:   0 total
Time:        1.456 s
`,
        stderr: ''
      };
    }
  }

  private handleLs(args: string[]): string {
      const files = db.getFiles(this.runId);
      // specific dir?
      if (args.length > 0) {
          return files.filter(f => f.path.startsWith(args[0])).map(f => f.path).join('\n');
      }
      return 'src\npackage.json\nnext.config.js\nnode_modules\nREADME.md';
  }

  private handleCat(args: string[]): string {
      if (args.length === 0) return '';
      const files = db.getFiles(this.runId);
      const file = files.find(f => f.path === args[0]);
      return file ? file.content : `cat: ${args[0]}: No such file or directory`;
  }

  private handleGit(args: string[]): { stdout: string } {
      if (args[0] === 'commit') {
          return { stdout: '[fix/header-z-index 8f2a1d] fix(ui): resolve header z-index issue\n 1 file changed, 1 insertion(+), 1 deletion(-)' };
      }
      if (args[0] === 'push') {
          return { stdout: 'To github.com:demo/broken-app.git\n   8f2a1d..9a2b3c  fix/header-z-index -> fix/header-z-index' };
      }
      return { stdout: '' };
  }
}