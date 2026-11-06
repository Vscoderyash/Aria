import { copyFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'apps/extension/.output');
const archives = (await readdir(output)).filter((name) => name.endsWith('-chrome.zip'));

if (archives.length !== 1) {
  throw new Error(`Expected one WXT Chromium archive in ${output}, found ${archives.length}.`);
}

const destination = resolve(root, 'jarvis-extension.zip');
await copyFile(resolve(output, archives[0]), destination);
console.log(`Updated ${destination}`);
