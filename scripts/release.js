#!/usr/bin/env node

/**
 * Release Script for Holokai Desktop
 * 
 * Automates the process of:
 * 1. Updating version in package.json
 * 2. Committing and tagging
 * 3. Pushing to GitHub
 * 4. Building and publishing to GitHub releases
 * 
 * Usage:
 *   node scripts/release.js [version]
 * 
 * Examples:
 *   node scripts/release.js 1.0.1          # Patch release
 *   node scripts/release.js 1.1.0          # Minor release
 *   node scripts/release.js 2.0.0          # Major release
 *   node scripts/release.js                # Prompts for version
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const packageJsonPath = join(rootDir, 'package.json');

// Read current version
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Get new version from command line or prompt
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ Error: Version required');
  console.error('\nUsage:');
  console.error('  node scripts/release.js <version>');
  console.error('\nExamples:');
  console.error('  node scripts/release.js 1.0.1');
  console.error('  node scripts/release.js 1.1.0');
  console.error(`\nCurrent version: ${currentVersion}`);
  process.exit(1);
}

// Validate version format (semver)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
if (!semverRegex.test(newVersion)) {
  console.error(`❌ Error: Invalid version format: ${newVersion}`);
  console.error('Version must follow semver format: X.Y.Z (e.g., 1.0.1)');
  process.exit(1);
}

// Check if version changed
if (newVersion === currentVersion) {
  console.error(`❌ Error: Version ${newVersion} is already the current version`);
  process.exit(1);
}

// Check if GH_TOKEN is set
if (!process.env.GH_TOKEN) {
  console.error('❌ Error: GH_TOKEN environment variable not set');
  console.error('\nSet it with:');
  console.error('  export GH_TOKEN=your_token_here');
  process.exit(1);
}

// Check if git is clean
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8', cwd: rootDir });
  if (gitStatus.trim()) {
    console.error('❌ Error: Git working directory is not clean');
    console.error('Please commit or stash your changes first.');
    console.error('\nUncommitted changes:');
    console.error(gitStatus);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error: Failed to check git status');
  process.exit(1);
}

console.log('🚀 Starting release process...\n');
console.log(`Current version: ${currentVersion}`);
console.log(`New version: ${newVersion}\n`);

try {
  // Step 1: Update version in package.json
  console.log('📝 Step 1: Updating version in package.json...');
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✅ Version updated\n');

  // Step 2: Commit the change
  console.log('📦 Step 2: Committing version change...');
  execSync(`git add package.json`, { cwd: rootDir, stdio: 'inherit' });
  execSync(`git commit -m "v${newVersion}"`, { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Committed\n');

  // Step 3: Create and push tag
  console.log('🏷️  Step 3: Creating git tag...');
  const tagName = `v${newVersion}`;
  
  // Check if tag already exists
  try {
    execSync(`git rev-parse -q --verify "refs/tags/${tagName}"`, { cwd: rootDir, stdio: 'pipe' });
    console.error(`❌ Error: Tag ${tagName} already exists`);
    console.error('If you want to recreate it, delete it first:');
    console.error(`  git tag -d ${tagName}`);
    console.error(`  git push origin :refs/tags/${tagName}`);
    process.exit(1);
  } catch {
    // Tag doesn't exist, continue
  }

  execSync(`git tag ${tagName}`, { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Tag created\n');

  // Step 4: Push commits and tags
  console.log('📤 Step 4: Pushing to GitHub...');
  execSync('git push', { cwd: rootDir, stdio: 'inherit' });
  execSync('git push --tags', { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Pushed to GitHub\n');

  // Step 5: Build and publish
  console.log('🔨 Step 5: Building and publishing to GitHub releases...');
  console.log('This may take several minutes...\n');
  
  execSync('npm run build:prod', { cwd: rootDir, stdio: 'inherit' });
  execSync('npx electron-builder --publish=always', { 
    cwd: rootDir, 
    stdio: 'inherit',
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN }
  });
  
  console.log('\n✅ Release published successfully!');
  console.log(`\n🎉 Version ${newVersion} is now available at:`);
  console.log(`   https://github.com/holok-ai/desktop/releases/tag/v${newVersion}`);

} catch (error) {
  console.error('\n❌ Error during release process:', error.message);
  console.error('\n⚠️  Note: Version in package.json has been updated.');
  console.error('You may need to revert it manually if the release failed.');
  process.exit(1);
}

