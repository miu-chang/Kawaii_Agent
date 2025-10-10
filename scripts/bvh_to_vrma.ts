import fs from 'fs';
import path from 'path';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { convertBVHToVRMAnimation } from '../temp-bvh2vrma/src/lib/bvh-converter/convertBVHToVRMAnimation';

if (typeof (globalThis as any).FileReader === 'undefined') {
  class NodeFileReader {
    public result: any = null;
    public onload: ((event: { target: NodeFileReader }) => void) | null = null;
    public onloadend: ((event: { target: NodeFileReader }) => void) | null = null;
    public onerror: ((err: unknown) => void) | null = null;

    readAsArrayBuffer(blob: Blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          const event = { target: this } as const;
          if (this.onload) this.onload(event);
          if (this.onloadend) this.onloadend(event);
        })
        .catch((err) => {
          if (this.onerror) {
            this.onerror(err);
          } else {
            throw err;
          }
        });
    }

    readAsDataURL(blob: Blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString('base64');
          const mime = blob.type || 'application/octet-stream';
          this.result = `data:${mime};base64,${base64}`;
          const event = { target: this } as const;
          if (this.onload) this.onload(event);
          if (this.onloadend) this.onloadend(event);
        })
        .catch((err) => {
          if (this.onerror) {
            this.onerror(err);
          } else {
            throw err;
          }
        });
    }
  }

  (globalThis as any).FileReader = NodeFileReader;
}

async function convertDirectory(inputDir: string, outputDir: string) {
  const loader = new BVHLoader();
  const entries = await fs.promises.readdir(inputDir);
  console.log('Found entries:', entries.length);
  await fs.promises.mkdir(outputDir, { recursive: true });

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.bvh')) {
      continue;
    }
    console.log('Processing', entry);
    const inputPath = path.join(inputDir, entry);
    const baseName = path.basename(entry, path.extname(entry));
    const outputPath = path.join(outputDir, `${baseName}.vrma`);

    try {
      const text = await fs.promises.readFile(inputPath, 'utf8');
      console.log('  loaded text');
      const bvh = loader.parse(text);
      console.log('  parsed BVH');
      const buffer = await convertBVHToVRMAnimation(bvh, { scale: 0.01 });
      console.log('  converted to VRMA buffer', buffer.byteLength);
      await fs.promises.writeFile(outputPath, Buffer.from(buffer));
      console.log(`[VRMA] ${outputPath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to convert ${entry}:`, error);
    }
  }
}

async function main() {
  console.log('Starting BVH -> VRMA conversion');
  const args = process.argv.slice(2);
  console.log('Args:', args);
  const inputIndex = args.indexOf('--input-dir');
  const outputIndex = args.indexOf('--output-dir');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: node bvh_to_vrma.ts --input-dir <path> --output-dir <path>');
    process.exit(1);
  }

  const inputDir = path.resolve(args[inputIndex + 1]);
  const outputDir = path.resolve(args[outputIndex + 1]);

  await convertDirectory(inputDir, outputDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
