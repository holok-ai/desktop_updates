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

  // Step 3: Create and push tag (skip if already exists remotely)
  console.log('🏷️  Step 3: Checking git tag...');
  const tagName = `v${newVersion}`;
  
  // Check if tag exists locally
  let tagExistsLocally = false;
  try {
    execSync(`git rev-parse -q --verify "refs/tags/${tagName}"`, { cwd: rootDir, stdio: 'pipe' });
    tagExistsLocally = true;
  } catch {
    // Tag doesn't exist locally
  }
  
  // Check if tag exists remotely
  let tagExistsRemotely = false;
  try {
    execSync(`git ls-remote --tags origin ${tagName}`, { cwd: rootDir, stdio: 'pipe' });
    tagExistsRemotely = true;
  } catch {
    // Tag doesn't exist remotely
  }
  
  if (tagExistsRemotely) {
    console.log(`ℹ️  Tag ${tagName} already exists on remote. Skipping tag creation.`);
    console.log('   This is normal when building for multiple platforms.\n');
    
    // Make sure we have the tag locally (for electron-builder to detect version)
    if (!tagExistsLocally) {
      console.log('📥 Fetching tag from remote...');
      execSync(`git fetch origin tag ${tagName}`, { cwd: rootDir, stdio: 'inherit' });
      console.log('✅ Tag fetched\n');
    }
  } else {
    // Tag doesn't exist, create it
    if (!tagExistsLocally) {
      execSync(`git tag ${tagName}`, { cwd: rootDir, stdio: 'inherit' });
      console.log('✅ Tag created\n');
    }
    
    // Step 4: Push commits and tags
    console.log('📤 Step 4: Pushing to GitHub...');
    execSync('git push', { cwd: rootDir, stdio: 'inherit' });
    execSync('git push --tags', { cwd: rootDir, stdio: 'inherit' });
    console.log('✅ Pushed to GitHub\n');
  }

  // Step 5: Build and publish for current platform
  console.log('🔨 Step 5: Building and publishing to GitHub releases...');
  
  // Check platform
  const platform = process.platform;
  console.log(`Current platform: ${platform}\n`);
  
  execSync('npm run build:prod', { cwd: rootDir, stdio: 'inherit' });
  
  if (platform === 'darwin') {
    console.log('\n📦 Building for macOS...');
    console.log('   - macOS: DMG and ZIP files\n');
    execSync('npx electron-builder --mac --publish=always', { 
      cwd: rootDir, 
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN }
    });
    console.log('\n⚠️  Note: Windows builds should be done on a Windows machine');
    console.log('   Build Windows installer separately and upload to the same release');
  } else if (platform === 'win32') {
    console.log('\n📦 Building for Windows...');
    console.log('   - Windows: NSIS installer\n');
    execSync('npx electron-builder --win --publish=always', { 
      cwd: rootDir, 
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN }
    });
    console.log('\n⚠️  Note: macOS builds should be done on a macOS machine');
    console.log('   Build macOS installer separately and upload to the same release');
  } else {
    console.log('\n📦 Building for current platform...\n');
    execSync('npx electron-builder --publish=always', { 
      cwd: rootDir, 
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN }
    });
  }
  
  console.log('\n✅ Release published successfully!');
  console.log(`\n🎉 Version ${newVersion} is now available at:`);
  console.log(`   https://github.com/holok-ai/desktop/releases/tag/v${newVersion}`);

} catch (error) {
  console.error('\n❌ Error during release process:', error.message);
  console.error('\n⚠️  Note: Version in package.json has been updated.');
  console.error('You may need to revert it manually if the release failed.');
  process.exit(1);
}

