// scripts/init-db-template.js
// Generate a template SQLite database from the current Prisma schema.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(projectRoot, 'packages', 'main', 'prisma', 'schema.prisma');
const resourcesDir = path.join(projectRoot, 'resources', 'db');
const templateDbPath = path.join(resourcesDir, 'template.db');

function main() {
  fs.mkdirSync(resourcesDir, { recursive: true });

  // Normalize path separators for Prisma URL
  const normalized = templateDbPath.replace(/\\/g, '/');
  const env = { ...process.env, DATABASE_URL: `file:${normalized}` };

  console.log(`[init-db-template] Generating template DB at: ${templateDbPath}`);
  // Invoke Prisma CLI directly via local installation to avoid PATH/npx issues
  const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const res = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate'], { stdio: 'inherit', env });

  if (res.status !== 0) {
    throw new Error(`npx prisma db push failed with code ${res.status}`);
  }

  console.log('[init-db-template] Template DB generated successfully');
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (err) {
    console.error('[init-db-template] failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}
