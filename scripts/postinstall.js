#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

function hasTypeScript() {
  try {
    require.resolve('typescript');
    return true;
  } catch (error) {
    return false;
  }
}

if (!hasTypeScript()) {
  console.log('[postinstall] TypeScript not found. Skipping compilation.');
  process.exit(0);
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['run', 'compile'], { stdio: 'inherit', shell: true });

if (result.error) {
  console.error('[postinstall] Failed to launch TypeScript compiler:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
