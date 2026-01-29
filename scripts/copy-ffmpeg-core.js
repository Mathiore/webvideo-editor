/**
 * Copies @ffmpeg/core UMD files to public/ffmpeg/ for self-hosted loading.
 * Run after npm install: npm run copy:ffmpeg
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const destDir = path.join(projectRoot, 'public', 'ffmpeg');

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

if (!existsSync(srcDir)) {
  console.warn('scripts/copy-ffmpeg-core.js: @ffmpeg/core not found. Run: npm install');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const file of files) {
  const src = path.join(srcDir, file);
  if (existsSync(src)) {
    copyFileSync(src, path.join(destDir, file));
    console.log('Copied', file, '-> public/ffmpeg/');
  }
}
