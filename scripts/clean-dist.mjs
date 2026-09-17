import { rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
if (basename(distRoot) !== 'dist' || dirname(distRoot) !== projectRoot) throw new Error(`Refusing to clean unexpected path: ${distRoot}`);
rmSync(distRoot, { recursive: true, force: true });
