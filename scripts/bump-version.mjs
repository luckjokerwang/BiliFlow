#!/usr/bin/env node

/**
 * BiliFlow Version Bump Script
 * Usage:
 *   node scripts/bump-version.mjs [patch|minor|major|<explicit-version>] [--dry-run]
 * 
 * Target files updated:
 *   - package.json
 *   - package-lock.json (if exists)
 *   - wxt.config.ts
 *   - README.md (version badge)
 *   - src/entrypoints/options/App.tsx (version badge)
 *   - src/entrypoints/popup/App.tsx (version badge)
 *   - CHROMEWEBSTORE.md (if exists)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const typeOrVersion = args.find(arg => !arg.startsWith('-')) || 'patch';

// 1. Read current version from package.json
const pkgPath = path.join(ROOT_DIR, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('❌ Error: package.json not found at', pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version;

if (!currentVersion) {
  console.error('❌ Error: Could not determine current version from package.json');
  process.exit(1);
}

// 2. Calculate new version
function bumpVersion(current, type) {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    if (type === 'patch' || type === 'minor' || type === 'major') {
      throw new Error(`Current version "${current}" does not match semver x.y.z format.`);
    }
    return type;
  }

  let [, major, minor, patch, extra] = match;
  major = parseInt(major, 10);
  minor = parseInt(minor, 10);
  patch = parseInt(patch, 10);

  switch (type) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      if (/^\d+\.\d+\.\d+.*$/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version or bump type: "${type}". Expected 'patch', 'minor', 'major', or 'x.y.z'.`);
  }
}

let nextVersion;
try {
  nextVersion = bumpVersion(currentVersion, typeOrVersion);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

console.log(`\n🚀 BiliFlow Version Bump: v${currentVersion} -> v${nextVersion} ${isDryRun ? '(DRY RUN)' : ''}\n`);

// 3. List of target file transformers
const targets = [
  {
    name: 'package.json',
    file: path.join(ROOT_DIR, 'package.json'),
    transform: (content) => {
      const data = JSON.parse(content);
      data.version = nextVersion;
      return JSON.stringify(data, null, 2) + '\n';
    }
  },
  {
    name: 'package-lock.json',
    file: path.join(ROOT_DIR, 'package-lock.json'),
    optional: true,
    transform: (content) => {
      const data = JSON.parse(content);
      data.version = nextVersion;
      if (data.packages && data.packages['']) {
        data.packages[''].version = nextVersion;
      }
      return JSON.stringify(data, null, 2) + '\n';
    }
  },
  {
    name: 'wxt.config.ts',
    file: path.join(ROOT_DIR, 'wxt.config.ts'),
    transform: (content) => {
      return content.replace(/version:\s*['"][^'"]+['"]/, `version: '${nextVersion}'`);
    }
  },
  {
    name: 'README.md',
    file: path.join(ROOT_DIR, 'README.md'),
    transform: (content) => {
      return content.replace(/badge\/version-[^-\s]+-/, `badge/version-${nextVersion}-`);
    }
  },
  {
    name: 'src/entrypoints/options/App.tsx',
    file: path.join(ROOT_DIR, 'src/entrypoints/options/App.tsx'),
    transform: (content) => {
      return content.replace(
        /(<span className="text-\[10px\] font-mono font-medium px-1\.5 py-0\.2 rounded-full [^>]*>\s*)v[\d.]+(\s*<\/span>)/,
        `$1v${nextVersion}$2`
      );
    }
  },
  {
    name: 'src/entrypoints/popup/App.tsx',
    file: path.join(ROOT_DIR, 'src/entrypoints/popup/App.tsx'),
    transform: (content) => {
      return content.replace(
        /(<span className="text-\[10px\] font-mono font-medium px-1\.5 py-0\.2 rounded-full [^>]*>\s*)v[\d.]+(\s*<\/span>)/,
        `$1v${nextVersion}$2`
      );
    }
  },
  {
    name: 'CHROMEWEBSTORE.md',
    file: path.join(ROOT_DIR, 'CHROMEWEBSTORE.md'),
    optional: true,
    transform: (content) => {
      return content.replace(
        /(\*\*Version\*\*:\s*)[\d.]+/,
        `$1${nextVersion}`
      );
    }
  }
];

let updatedCount = 0;
for (const target of targets) {
  if (!fs.existsSync(target.file)) {
    if (!target.optional) {
      console.warn(`⚠️ Warning: ${target.name} not found at ${target.file}`);
    }
    continue;
  }

  const original = fs.readFileSync(target.file, 'utf-8');
  const modified = target.transform(original);

  if (original === modified) {
    console.log(`ℹ️  [UNCHANGED] ${target.name}`);
  } else {
    if (!isDryRun) {
      fs.writeFileSync(target.file, modified, 'utf-8');
    }
    console.log(`✅ [UPDATED]   ${target.name}`);
    updatedCount++;
  }
}

console.log(`\n🎉 Summary: ${updatedCount} files ${isDryRun ? 'would be updated' : 'successfully updated'} to v${nextVersion}.\n`);
