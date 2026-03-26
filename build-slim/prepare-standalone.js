const fs = require('fs');
const path = require('path');

const root = process.cwd();
const nextDir = path.join(root, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const standaloneStaticDir = path.join(standaloneDir, '.next', 'static');
const sourceStaticDir = path.join(nextDir, 'static');
const sourcePublicDir = path.join(root, 'public');
const targetPublicDir = path.join(standaloneDir, 'public');

if (!fs.existsSync(standaloneDir)) {
  throw new Error(`Missing standalone output: ${standaloneDir}`);
}

if (!fs.existsSync(sourceStaticDir)) {
  throw new Error(`Missing Next static output: ${sourceStaticDir}`);
}

fs.mkdirSync(path.dirname(standaloneStaticDir), { recursive: true });
fs.rmSync(standaloneStaticDir, { recursive: true, force: true });
fs.cpSync(sourceStaticDir, standaloneStaticDir, { recursive: true });

if (fs.existsSync(sourcePublicDir)) {
  fs.rmSync(targetPublicDir, { recursive: true, force: true });
  fs.cpSync(sourcePublicDir, targetPublicDir, { recursive: true });
}

console.log('[prepare-standalone] OK');
