const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

const safeRequire = (targetPath) => {
  try {
    return require(targetPath);
  } catch (err) {
    return null;
  }
};

const mainPkg = safeRequire(path.join(projectRoot, 'packages/main/package.json')) || {};
const lockFile = safeRequire(path.join(projectRoot, 'package-lock.json'));
const lockPackages = lockFile && lockFile.packages ? lockFile.packages : null;

const BUNDLE_PACKAGES = new Set(['uid']);
const BASE_RUNTIME_DEPS = [
  '@prisma/client',
  '.prisma/client',
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/microservices',
  '@nestjs/platform-express',
  'reflect-metadata',
  'rxjs',
  'tslib',
  'uid',
  'express',
  'iterare',
];

const WORKSPACE_LOCK_KEY = 'packages/main';

const filterRuntimeName = (name) => name && !name.startsWith('@types/') && name !== 'main';

const findLockEntryKey = (pkgName, parentKey = null) => {
  if (!lockPackages) return null;
  const directKey = `node_modules/${pkgName}`;
  if (lockPackages[directKey]) return directKey;
  if (parentKey) {
    const candidate = `${parentKey.replace(/\/$/, '')}/node_modules/${pkgName}`;
    if (lockPackages[candidate]) return candidate;
    let cursor = parentKey;
    while (cursor.includes('/node_modules/')) {
      cursor = cursor.slice(0, cursor.lastIndexOf('/node_modules/'));
      const retry = `${cursor}/node_modules/${pkgName}`;
      if (lockPackages[retry]) return retry;
    }
  }
  return null;
};

const collectRuntimePackages = () => {
  const runtime = new Set(BASE_RUNTIME_DEPS);
  const mainDeps = Object.keys(mainPkg.dependencies || {}).filter(filterRuntimeName);
  mainDeps.forEach((name) => runtime.add(name));

  if (!lockPackages || !lockPackages[WORKSPACE_LOCK_KEY]) {
    return Array.from(runtime).filter(filterRuntimeName);
  }

  const initialDeps = Object.keys(lockPackages[WORKSPACE_LOCK_KEY].dependencies || {}).filter(filterRuntimeName);
  const stack = initialDeps.map((name) => ({ name, parentKey: WORKSPACE_LOCK_KEY }));

  while (stack.length > 0) {
    const { name, parentKey } = stack.pop();
    if (!filterRuntimeName(name)) continue;
    if (BUNDLE_PACKAGES.has(name) || runtime.has(name)) continue;

    const entryKey = findLockEntryKey(name, parentKey);
    const entry = entryKey ? lockPackages[entryKey] : null;
    if (entry && entry.dev === true) continue;

    runtime.add(name);

    const childDeps = entry && entry.dependencies ? Object.keys(entry.dependencies) : [];
    for (const child of childDeps) {
      if (!filterRuntimeName(child)) continue;
      if (runtime.has(child) || BUNDLE_PACKAGES.has(child)) continue;
      stack.push({ name: child, parentKey: entryKey || parentKey });
    }
  }

  return Array.from(runtime).filter(filterRuntimeName);
};

const RUNTIME_PACKAGES = collectRuntimePackages();

const resolveModulePath = (root, pkg) => {
  if (pkg.startsWith('.')) {
    return path.resolve(root, pkg);
  }
  const segments = pkg.split('/');
  return path.join(root, ...segments);
};

const getRuntimePackages = () => Array.from(RUNTIME_PACKAGES);

const ensureRuntimeDepsInRoots = (roots, options = {}) => {
  const runtimePackages = getRuntimePackages();
  const missing = [];
  for (const pkg of runtimePackages) {
    if (BUNDLE_PACKAGES.has(pkg)) continue;
    const found = roots.some((root) => {
      if (!root) return false;
      if (!fs.existsSync(root)) return false;
      const target = resolveModulePath(root, pkg);
      return fs.existsSync(target);
    });
    if (!found) {
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    const label = options.label || 'runtime';
    throw new Error(`Missing runtime modules for ${label}: ${missing.join(', ')}`);
  }
};

const ensureRuntimeDepsInstalled = () => {
  const roots = [
    path.resolve(projectRoot, 'packages/main/node_modules'),
    path.resolve(projectRoot, 'node_modules'),
  ];
  ensureRuntimeDepsInRoots(roots, { label: 'workspace install' });
};

const ensureRuntimeDepsPackaged = (arch = 'x64') => {
  const roots = [
    path.resolve(projectRoot, '.webpack/main/node_modules'),
    path.resolve(projectRoot, `.webpack/${arch}/main/node_modules`),
  ];
  ensureRuntimeDepsInRoots(roots, { label: `packaged main process (${arch})` });
};

module.exports = {
  BUNDLE_PACKAGES,
  getRuntimePackages,
  ensureRuntimeDepsInstalled,
  ensureRuntimeDepsPackaged,
  ensureRuntimeDepsInRoots,
  RUNTIME_PACKAGES,
};

if (require.main === module) {
  try {
    ensureRuntimeDepsInstalled();
    console.log('[runtime-deps] runtime dependencies verified');
  } catch (err) {
    console.error('[runtime-deps] runtime dependency check failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
