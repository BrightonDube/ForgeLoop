import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface VisualDiff {
  diffImage: Buffer;
  diffPixels: number;
  totalPixels: number;
  similarity: number; // 0..1
}

export interface DOMDiff {
  changed: boolean;
  similarity: number; // 0..1
  summary: string;
}

export interface Diff {
  kind: 'visual' | 'dom';
  similarity: number;
  summary: string;
}

export interface DiffReport {
  similarity: number;
  diffs: Diff[];
  summary: string;
}

export interface DOMSnapshot {
  url: string;
  html: string;
  styles?: string;
  capturedAt?: string;
}

export class DiffEngine {
  async compareScreenshots(before: Buffer, after: Buffer): Promise<VisualDiff> {
    const beforePng = PNG.sync.read(before);
    const afterPng = PNG.sync.read(after);

    const width = Math.min(beforePng.width, afterPng.width);
    const height = Math.min(beforePng.height, afterPng.height);

    // If dimensions differ, crop to smallest common rectangle.
    const a = this.cropPng(beforePng, width, height);
    const b = this.cropPng(afterPng, width, height);

    const diffPng = new PNG({ width, height });
    const diffPixels = pixelmatch(a.data, b.data, diffPng.data, width, height, {
      threshold: 0.1,
      includeAA: true,
    });

    const totalPixels = width * height;
    const similarity = this.computeVisualSimilarityFromCounts(diffPixels, totalPixels);

    return {
      diffImage: PNG.sync.write(diffPng),
      diffPixels,
      totalPixels,
      similarity,
    };
  }

  async compareDOMSnapshots(before: DOMSnapshot, after: DOMSnapshot): Promise<DOMDiff> {
    const beforeNorm = this.normalizeDom(before.html);
    const afterNorm = this.normalizeDom(after.html);

    if (beforeNorm === afterNorm) {
      return {
        changed: false,
        similarity: 1,
        summary: 'DOM unchanged',
      };
    }

    const similarity = this.computeTextSimilarity(beforeNorm, afterNorm);
    const summary = similarity > 0.95 ? 'Minor DOM changes' : 'DOM changed';

    return {
      changed: true,
      similarity,
      summary,
    };
  }

  computeVisualSimilarity(before: Buffer, after: Buffer): number {
    const beforePng = PNG.sync.read(before);
    const afterPng = PNG.sync.read(after);
    const width = Math.min(beforePng.width, afterPng.width);
    const height = Math.min(beforePng.height, afterPng.height);

    const a = this.cropPng(beforePng, width, height);
    const b = this.cropPng(afterPng, width, height);

    // We don't need an actual diff image for similarity.
    const tmp = new PNG({ width, height });
    const diffPixels = pixelmatch(a.data, b.data, tmp.data, width, height, { threshold: 0.1, includeAA: true });
    return this.computeVisualSimilarityFromCounts(diffPixels, width * height);
  }

  highlightDifferences(diff: VisualDiff): Buffer {
    // diffImage already contains highlighted pixels from pixelmatch
    return diff.diffImage;
  }

  generateDiffReport(diffs: Diff[]): DiffReport {
    const similarity = diffs.length
      ? diffs.reduce((acc, d) => acc + d.similarity, 0) / diffs.length
      : 1;

    const summary = diffs.length
      ? diffs.map((d) => `${d.kind}: ${d.summary} (sim=${d.similarity.toFixed(3)})`).join('\n')
      : 'No diffs';

    return { similarity, diffs, summary };
  }

  private cropPng(input: PNG, width: number, height: number): PNG {
    if (input.width === width && input.height === height) return input;

    const out = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * input.width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        out.data[dstIdx] = input.data[srcIdx];
        out.data[dstIdx + 1] = input.data[srcIdx + 1];
        out.data[dstIdx + 2] = input.data[srcIdx + 2];
        out.data[dstIdx + 3] = input.data[srcIdx + 3];
      }
    }
    return out;
  }

  private computeVisualSimilarityFromCounts(diffPixels: number, totalPixels: number): number {
    if (totalPixels <= 0) return 1;
    const ratio = diffPixels / totalPixels;
    const similarity = 1 - ratio;
    return Math.max(0, Math.min(1, similarity));
  }

  private normalizeDom(html: string): string {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }

  private computeTextSimilarity(a: string, b: string): number {
    // Simple similarity based on common prefix length and size ratio.
    // This is not perfect, but it's deterministic and fast.
    const minLen = Math.min(a.length, b.length);
    let commonPrefix = 0;
    for (let i = 0; i < minLen; i++) {
      if (a.charCodeAt(i) !== b.charCodeAt(i)) break;
      commonPrefix++;
    }

    const sizePenalty = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    const prefixRatio = commonPrefix / Math.max(a.length, b.length);

    const similarity = Math.max(prefixRatio, sizePenalty * 0.5);
    return Math.max(0, Math.min(1, similarity));
  }
}
