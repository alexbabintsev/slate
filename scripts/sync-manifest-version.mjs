// Sync manifest.json version to package.json version.
// Invoked by `npm version` via the "version" lifecycle script.

import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifestPath = 'manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.version === pkg.version) {
  console.log(`manifest.json already at v${pkg.version}`);
  process.exit(0);
}

const old = manifest.version;
manifest.version = pkg.version;

// Preserve trailing newline + 2-space indent (matches existing file)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`manifest.json: v${old} → v${pkg.version}`);

// Stage the change so `npm version` includes it in the version commit
import('node:child_process').then(({ execSync }) => {
  execSync('git add manifest.json', { stdio: 'inherit' });
});
