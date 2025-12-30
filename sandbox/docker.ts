import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';
import type { ExecutionResult } from '../types';

export interface ContainerConfig {
  name?: string;
  image?: string;
  repoPath: string;
  workdir?: string;
  env?: Record<string, string>;
  ports?: Array<{ containerPort: number; hostPort?: number }>; // TCP
  memoryBytes?: number;
  cpuShares?: number;
}

type ExecResult = ExecutionResult;

export class DockerManager {
  private readonly docker: Docker;
  private readonly defaultImage: string;

  constructor(opts?: { docker?: Docker; defaultImage?: string }) {
    this.docker = opts?.docker ?? new Docker();
    this.defaultImage = opts?.defaultImage ?? 'node:20-alpine';
  }

  async createContainer(config: ContainerConfig): Promise<string> {
    const image = config.image ?? this.defaultImage;
    await this.ensureImage(image);

    const repoPathAbs = path.resolve(config.repoPath);
    if (!fs.existsSync(repoPathAbs)) {
      throw new Error(`repoPath does not exist: ${repoPathAbs}`);
    }

    const workdir = config.workdir ?? '/workspace';

    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    const exposedPorts: Record<string, {}> = {};
    for (const p of config.ports ?? []) {
      const key = `${p.containerPort}/tcp`;
      exposedPorts[key] = {};
      portBindings[key] = [{ HostPort: String(p.hostPort ?? 0) }];
    }

    const container = await this.docker.createContainer({
      name: config.name,
      Image: image,
      WorkingDir: workdir,
      Tty: false,
      OpenStdin: false,
      Env: this.toEnvArray(config.env),
      ExposedPorts: Object.keys(exposedPorts).length ? exposedPorts : undefined,
      HostConfig: {
        Binds: [`${repoPathAbs}:${workdir}`],
        PortBindings: Object.keys(portBindings).length ? portBindings : undefined,
        Memory: config.memoryBytes,
        CpuShares: config.cpuShares,
        NetworkMode: 'bridge',
      },
    });

    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    await this.getContainer(containerId).start();
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.getContainer(containerId).stop({ t: 10 });
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.getContainer(containerId).remove({ force: true, v: true });
  }

  async executeCommand(containerId: string, cmd: string[]): Promise<ExecResult> {
    const startedAt = Date.now();

    const container = this.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    container.modem.demuxStream(stream, stdoutStream, stderrStream);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    stdoutStream.on('data', (c: Buffer) => stdoutChunks.push(c));
    stderrStream.on('data', (c: Buffer) => stderrChunks.push(c));

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const inspect = await exec.inspect();

    return {
      command: cmd.join(' '),
      exitCode: inspect.ExitCode ?? -1,
      stdout: Buffer.concat(stdoutChunks).toString('utf8'),
      stderr: Buffer.concat(stderrChunks).toString('utf8'),
      durationMs: Date.now() - startedAt,
    };
  }

  async executeDetached(containerId: string, cmd: string[]): Promise<void> {
    const container = this.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: false,
      AttachStderr: false,
      Detach: true,
    });

    await exec.start({ hijack: false, stdin: false, Detach: true });
  }

  async copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    const srcAbs = path.resolve(sourcePath);
    const stats = fs.statSync(srcAbs);

    const archive = this.buildSingleEntryTarStream({
      entryPath: stats.isDirectory() ? path.basename(srcAbs) : path.basename(srcAbs),
      sourcePath: srcAbs,
      isDirectory: stats.isDirectory(),
    });

    await this.getContainer(containerId).putArchive(archive, { path: destPath });
  }

  async copyFromContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    const container = this.getContainer(containerId);
    const stream = await container.getArchive({ path: sourcePath });

    const destAbs = path.resolve(destPath);
    fs.mkdirSync(destAbs, { recursive: true });

    // Minimal extractor: only supports a single regular file entry.
    // If you need directories or multiple files, we can add a full tar parser later.
    const extracted = await this.extractSingleFileFromTarStream(stream);
    fs.writeFileSync(path.join(destAbs, extracted.name), extracted.data);
  }

  async getContainerLogs(containerId: string): Promise<string> {
    const buf = (await this.getContainer(containerId).logs({
      stdout: true,
      stderr: true,
      timestamps: true,
    })) as unknown;

    if (Buffer.isBuffer(buf)) return buf.toString('utf8');

    // dockerode can return a stream depending on options; fall back to collecting it.
    const stream = buf as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    return Buffer.concat(chunks).toString('utf8');
  }

  async getMappedHostPort(containerId: string, containerPort: number): Promise<number | null> {
    const inspect = await this.getContainer(containerId).inspect();
    const key = `${containerPort}/tcp`;
    const ports = inspect?.NetworkSettings?.Ports as
      | Record<string, Array<{ HostIp: string; HostPort: string }> | null>
      | undefined;

    const bindings = ports?.[key];
    if (!bindings || bindings.length === 0) return null;
    const hostPort = bindings[0]?.HostPort;
    if (!hostPort) return null;
    const parsed = Number(hostPort);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async healthCheck(containerId: string): Promise<boolean> {
    const inspect = await this.getContainer(containerId).inspect();
    return Boolean(inspect?.State?.Running) && inspect?.State?.Status === 'running';
  }

  private getContainer(containerId: string): Docker.Container {
    return this.docker.getContainer(containerId);
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
      return;
    } catch {
      // fallthrough
    }

    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private toEnvArray(env?: Record<string, string>): string[] | undefined {
    if (!env) return undefined;
    return Object.entries(env).map(([k, v]) => `${k}=${v}`);
  }

  private buildSingleEntryTarStream(params: {
    entryPath: string;
    sourcePath: string;
    isDirectory: boolean;
  }): NodeJS.ReadableStream {
    // Very small tar implementation for a single entry. Enough for simple file pushes.
    // Tar header: 512 bytes.
    const out = new PassThrough();
    const name = params.entryPath.replace(/\\/g, '/');

    const writeHeader = (size: number, typeFlag: '0' | '5') => {
      const header = Buffer.alloc(512, 0);
      header.write(name, 0, Math.min(100, Buffer.byteLength(name)), 'utf8');
      header.write('0000777\0', 100, 8, 'ascii');
      header.write('0000000\0', 108, 8, 'ascii');
      header.write('0000000\0', 116, 8, 'ascii');
      header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
      header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii');
      header.fill(' ', 148, 156);
      header.write(typeFlag, 156, 1, 'ascii');
      header.write('ustar\0', 257, 6, 'ascii');
      header.write('00', 263, 2, 'ascii');

      let sum = 0;
      for (const b of header) sum += b;
      header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
      out.write(header);
    };

    if (params.isDirectory) {
      writeHeader(0, '5');
      out.write(Buffer.alloc(1024, 0));
      out.end();
      return out;
    }

    const data = fs.readFileSync(params.sourcePath);
    writeHeader(data.length, '0');
    out.write(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) out.write(Buffer.alloc(pad, 0));
    out.write(Buffer.alloc(1024, 0));
    out.end();
    return out;
  }

  private async extractSingleFileFromTarStream(
    stream: NodeJS.ReadableStream
  ): Promise<{ name: string; data: Buffer }> {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const buf = Buffer.concat(chunks);
    if (buf.length < 512) throw new Error('Invalid tar: too small');

    const nameRaw = buf.subarray(0, 100);
    const name = nameRaw.toString('utf8').replace(/\0+$/, '');

    const sizeOct = buf.subarray(124, 136).toString('ascii').replace(/\0/g, '').trim();
    const size = parseInt(sizeOct || '0', 8);

    const dataStart = 512;
    const dataEnd = dataStart + size;
    if (dataEnd > buf.length) throw new Error('Invalid tar: declared size exceeds buffer');

    return { name: path.basename(name), data: buf.subarray(dataStart, dataEnd) };
  }
}
