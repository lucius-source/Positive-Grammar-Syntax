import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(projectRoot, 'dist');
const files = readdirSync(distRoot, { recursive: true })
  .map(entry => join(distRoot, entry))
  .filter(path => path.endsWith('.js') || path.endsWith('.d.ts'));

function compiledSpecifier(fromFile, specifier) {
  if (extname(specifier)) return specifier;
  const target = resolve(dirname(fromFile), specifier);
  if (existsSync(`${target}.js`)) return `${specifier}.js`;
  if (existsSync(join(target, 'index.js'))) return `${specifier}/index.js`;
  throw new Error(`Cannot resolve emitted ESM specifier ${specifier} from ${fromFile}`);
}

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const finalized = source.replace(/(from\s+['"]|import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"])/g, (_match, prefix, specifier, suffix) =>
    `${prefix}${compiledSpecifier(file, specifier)}${suffix}`);
  if (finalized !== source) writeFileSync(file, finalized);
}
