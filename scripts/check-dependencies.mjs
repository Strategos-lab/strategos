#!/usr/bin/env node
/**
 * Dependency allow-list check (Phase 2). Reads every package.json in the workspace (root plus the
 * pnpm-workspace globs), and compares production dependencies and devDependencies with
 * config/dependency-allowlist.json, which records a reason for every approved package.
 * Fails (exit 1) on any unapproved addition. Internal @strategos/* workspace packages are allowed.
 * No dependencies of its own: Node built-ins only.
 *
 * Usage: node scripts/check-dependencies.mjs [--root <dir>] [--allowlist <file>]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROD_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/** Workspace package globs: only the simple "dir/*" and "dir" forms used by this repo. */
function workspaceGlobs(root) {
  const f = join(root, 'pnpm-workspace.yaml');
  if (!existsSync(f)) return [];
  return [...readFileSync(f, 'utf8').matchAll(/^\s*-\s*['"]?([^'"\n#]+?)['"]?\s*$/gm)].map((m) => m[1].trim());
}

export function packageFiles(root) {
  const out = [join(root, 'package.json')];
  for (const g of workspaceGlobs(root)) {
    if (g.endsWith('/*')) {
      const dir = join(root, g.slice(0, -2));
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).sort()) {
        const p = join(dir, name, 'package.json');
        if (existsSync(p)) out.push(p);
      }
    } else if (existsSync(join(root, g, 'package.json'))) out.push(join(root, g, 'package.json'));
  }
  return out.filter((p) => existsSync(p));
}

const isInternal = (name, spec) => name.startsWith('@strategos/') && String(spec).startsWith('workspace:');

export function checkDependencies(root, allowlistPath = join(root, 'config', 'dependency-allowlist.json')) {
  const allow = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const prod = allow.dependencies ?? {};
  const dev = allow.devDependencies ?? {};
  const errors = [];
  for (const [list, what] of [[prod, 'dependencies'], [dev, 'devDependencies']]) {
    for (const [name, reason] of Object.entries(list)) {
      if (typeof reason !== 'string' || reason.trim().length < 3) errors.push(`allow-list ${what}.${name}: needs a reason`);
    }
  }
  const files = packageFiles(root);
  for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const rel = relative(root, file) || 'package.json';
    for (const field of PROD_FIELDS) {
      for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
        if (isInternal(name, spec)) continue;
        if (prod[name]) continue;
        errors.push(dev[name]
          ? `${rel}: "${name}" is approved for development only but is listed in ${field}`
          : `${rel}: production dependency "${name}" is not in the allow-list`);
      }
    }
    for (const [name, spec] of Object.entries(pkg.devDependencies ?? {})) {
      if (isInternal(name, spec)) continue;
      if (!dev[name] && !prod[name]) errors.push(`${rel}: dev dependency "${name}" is not in the allow-list`);
    }
  }
  return { files: files.map((f) => relative(root, f) || 'package.json'), errors };
}

function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const root = resolve(arg('--root') ?? join(fileURLToPath(import.meta.url), '..', '..'));
  const { files, errors } = checkDependencies(root, arg('--allowlist') ? resolve(arg('--allowlist')) : undefined);
  if (errors.length) {
    console.error(`Dependency allow-list check failed (${files.length} package.json files):\n- ${errors.join('\n- ')}\nAdd an entry with a reason to config/dependency-allowlist.json only after approval.`);
    process.exit(1);
  }
  console.log(`Dependency allow-list OK (${files.length} package.json files).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
