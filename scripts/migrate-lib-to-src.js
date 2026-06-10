#!/usr/bin/env node

/**
 * Migration Script: Move lib/ to src/lib/
 *
 * This script automates the migration of lib/ directory to src/lib/
 * while preserving git history and updating all necessary imports.
 *
 * Usage:
 *   node scripts/migrate-lib-to-src.js [--dry-run] [--verbose]
 *
 * Flags:
 *   --dry-run   Preview changes without modifying files
 *   --verbose   Show detailed logging
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const LIB_DIR = path.join(ROOT_DIR, 'lib');
const SRC_DIR = path.join(ROOT_DIR, 'src');
// SRC_LIB_DIR is the target for migration (used implicitly by git mv)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SRC_LIB_DIR = path.join(SRC_DIR, 'lib');
const TSCONFIG_PATH = path.join(ROOT_DIR, 'tsconfig.json');

// Script files that need relative import updates
const SCRIPT_FILES_TO_UPDATE = [
  'scripts/seed.ts',
  'scripts/seed-config.ts',
  'scripts/seed-teacher.ts',
  'scripts/ensure-test-users.ts',
  'e2e/ensure-test-users.ts',
  'e2e/global-setup.ts'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function verbose(message) {
  if (isVerbose) {
    log(`  ${message}`, colors.blue);
  }
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function warning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

/**
 * Check if lib/ directory exists
 */
function checkLibExists() {
  if (!fs.existsSync(LIB_DIR)) {
    error('lib/ directory does not exist!');
    process.exit(1);
  }
  verbose('lib/ directory found');
}

/**
 * Count files in lib/ directory
 */
function countLibFiles() {
  const files = getAllFiles(LIB_DIR);
  log(`\nFound ${files.length} files in lib/`, colors.bright);

  if (isVerbose) {
    files.forEach(file => {
      const relativePath = path.relative(LIB_DIR, file);
      verbose(`  - ${relativePath}`);
    });
  }

  return files;
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * Move lib/ to src/lib/ using git mv
 */
function moveFiles() {
  log('\n📦 Moving lib/ to src/lib/...', colors.bright);

  if (isDryRun) {
    warning('DRY RUN: Would execute: git mv lib src/lib');
    return;
  }

  try {
    // Ensure src/ directory exists
    if (!fs.existsSync(SRC_DIR)) {
      fs.mkdirSync(SRC_DIR, { recursive: true });
      verbose('Created src/ directory');
    }

    // Use git mv to preserve history
    execSync('git mv lib src/lib', {
      cwd: ROOT_DIR,
      stdio: isVerbose ? 'inherit' : 'pipe'
    });

    success('Files moved successfully');
  } catch (moveErr) {
    error(`Failed to move files: ${moveErr.message}`);
    process.exit(1);
  }
}

/**
 * Update tsconfig.json path alias
 */
function updateTsConfig() {
  log('\n⚙️  Updating tsconfig.json...', colors.bright);

  try {
    const tsconfigContent = fs.readFileSync(TSCONFIG_PATH, 'utf8');
    const tsconfig = JSON.parse(tsconfigContent);

    // Update path alias
    if (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) {
      const oldPath = tsconfig.compilerOptions.paths['@/lib/*'];
      tsconfig.compilerOptions.paths['@/lib/*'] = ['./src/lib/*'];

      verbose(`Changed: "@/lib/*": ${JSON.stringify(oldPath)} → ["./src/lib/*"]`);

      if (isDryRun) {
        warning('DRY RUN: Would update tsconfig.json');
        return;
      }

      // Write updated tsconfig
      fs.writeFileSync(
        TSCONFIG_PATH,
        JSON.stringify(tsconfig, null, 2) + '\n',
        'utf8'
      );

      success('tsconfig.json updated');
    } else {
      warning('No path aliases found in tsconfig.json');
    }
  } catch (err) {
    error(`Failed to update tsconfig.json: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Update relative imports in script files
 */
function updateScriptImports() {
  log('\n📝 Updating script imports...', colors.bright);

  let updatedCount = 0;

  SCRIPT_FILES_TO_UPDATE.forEach(scriptPath => {
    const fullPath = path.join(ROOT_DIR, scriptPath);

    if (!fs.existsSync(fullPath)) {
      verbose(`Skipping ${scriptPath} (not found)`);
      return;
    }

    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      const originalContent = content;

      // Replace ../lib/ with ../src/lib/
      content = content.replace(
        /from\s+['"](\.\.\/)+lib\//g,
        (match) => match.replace(/lib\//, 'src/lib/')
      );

      if (content !== originalContent) {
        if (isDryRun) {
          warning(`DRY RUN: Would update ${scriptPath}`);
        } else {
          fs.writeFileSync(fullPath, content, 'utf8');
          success(`Updated ${scriptPath}`);
        }
        updatedCount++;
      } else {
        verbose(`No changes needed in ${scriptPath}`);
      }
    } catch (err) {
      error(`Failed to update ${scriptPath}: ${err.message}`);
    }
  });

  if (updatedCount > 0) {
    success(`Updated ${updatedCount} script file(s)`);
  } else {
    log('No script files needed updates');
  }
}

/**
 * Validate TypeScript compilation
 */
function validateTypeScript() {
  log('\n🔍 Validating TypeScript compilation...', colors.bright);

  if (isDryRun) {
    warning('DRY RUN: Skipping TypeScript validation');
    return;
  }

  try {
    execSync('npx tsc --noEmit', {
      cwd: ROOT_DIR,
      stdio: isVerbose ? 'inherit' : 'pipe'
    });

    success('TypeScript compilation passed');
  } catch {
    error('TypeScript compilation failed!');
    error('Run "npx tsc --noEmit" to see errors');

    log('\n⚠️  ROLLBACK INSTRUCTIONS:', colors.yellow);
    log('  git reset --hard HEAD', colors.yellow);

    process.exit(1);
  }
}

/**
 * Run test suite
 */
function runTests() {
  log('\n🧪 Running test suite...', colors.bright);

  if (isDryRun) {
    warning('DRY RUN: Skipping tests');
    return;
  }

  try {
    execSync('npm run test', {
      cwd: ROOT_DIR,
      stdio: isVerbose ? 'inherit' : 'pipe'
    });

    success('All tests passed');
  } catch {
    error('Tests failed!');
    error('Run "npm run test" to see failures');

    log('\n⚠️  ROLLBACK INSTRUCTIONS:', colors.yellow);
    log('  git reset --hard HEAD', colors.yellow);

    process.exit(1);
  }
}

/**
 * Display summary
 */
function displaySummary(fileCount) {
  log('\n' + '='.repeat(60), colors.bright);
  log('MIGRATION SUMMARY', colors.bright);
  log('='.repeat(60), colors.bright);

  log(`\n📊 Files moved: ${fileCount}`);
  log('📝 Updated: tsconfig.json');
  log(`📝 Updated: ${SCRIPT_FILES_TO_UPDATE.length} script files`);

  if (isDryRun) {
    log('\n⚠️  This was a DRY RUN - no changes were made', colors.yellow);
    log('Run without --dry-run to execute the migration', colors.yellow);
  } else {
    log('\n✅ Migration completed successfully!', colors.green);
    log('\nNext steps:', colors.bright);
    log('  1. Review changes: git status');
    log('  2. Test manually: npm run dev');
    log('  3. Commit: git add . && git commit -m "refactor: migrate lib/ to src/lib/"');
  }

  log('');
}

/**
 * Main execution
 */
function main() {
  log('\n' + '='.repeat(60), colors.bright);
  log('LIB → SRC/LIB MIGRATION SCRIPT', colors.bright);
  log('='.repeat(60), colors.bright);

  if (isDryRun) {
    log('\n⚠️  Running in DRY RUN mode (no changes will be made)', colors.yellow);
  }

  // Phase 1: Pre-flight checks
  log('\n📋 Phase 1: Pre-flight checks', colors.bright);
  checkLibExists();
  const fileCount = countLibFiles();

  // Phase 2: Move files
  log('\n📦 Phase 2: Moving files', colors.bright);
  moveFiles();

  // Phase 3: Update configurations
  log('\n⚙️  Phase 3: Updating configurations', colors.bright);
  updateTsConfig();
  updateScriptImports();

  // Phase 4: Validation (skip in dry-run)
  if (!isDryRun) {
    log('\n✅ Phase 4: Validation', colors.bright);
    validateTypeScript();
    runTests();
  }

  // Summary
  displaySummary(fileCount);
}

// Execute
try {
  main();
} catch (err) {
  error(`\n💥 Migration failed: ${err.message}`);

  if (!isDryRun) {
    log('\n⚠️  ROLLBACK INSTRUCTIONS:', colors.yellow);
    log('  git reset --hard HEAD', colors.yellow);
  }

  process.exit(1);
}
