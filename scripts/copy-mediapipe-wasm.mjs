import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const destination = resolve(root, 'apps/extension/public/mediapipe/wasm');

await mkdir(destination, { recursive: true });
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  await copyFile(resolve(source, name), resolve(destination, name));
}
