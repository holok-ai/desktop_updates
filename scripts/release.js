#!/usr/bin/env node

/**
 * Release Script for Holokai Desktop
 *
 * Automates the process of:
 * 1. Updating version in package.json
 * 2. Committing and tagging
 * 3. Pushing to GitHub
 * 4. Building and publishing to GitHub releases
 * 5. Optionally marking release as mandatory
 *
 * Usage:
 *   node scripts/release.js [version] [--mandatory]
 *
 * Examples:
 *   node scripts/release.js 1.0.1          # Optional release
 *   node scripts/release.js 1.0.1 --mandatory  # Mandatory release
 *   node scripts/release.js 1.1.0          # Minor release
 *   node scripts/release.js 2.0.0          # Major release
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

// Parse command line arguments
const args = process.argv.slice(2);
const newVersion = args.find((arg) => !arg.startsWith('--'));
const isMandatory = args.includes('--mandatory');

if (!newVersion) {
  console.error('❌ Error: Version required');
  console.error('\nUsage:');
  console.error('  node scripts/release.js <version> [--mandatory]');
  console.error('\nExamples:');
  console.error('  node scripts/release.js 1.0.1');
  console.error('  node scripts/release.js 1.0.1 --mandatory');
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

// Check if tag exists remotely in desktop-updates repo (for multi-platform builds)
const tagName = `v${newVersion}`;
const desktopUpdatesRepo = 'holok-ai/desktop-updates';
const desktopUpdatesUrl = `https://github.com/${desktopUpdatesRepo}.git`;
let tagExistsRemotely = false;

// Check if tag exists in desktop-updates repo using git ls-remote
try {
  const result = execSync(`git ls-remote --tags ${desktopUpdatesUrl} ${tagName}`, {
    cwd: rootDir,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.trim()) {
    tagExistsRemotely = true;
    console.log(`ℹ️  Found tag ${tagName} in desktop-updates repository`);
  }
} catch {
  // Tag doesn't exist remotely or git command failed
}

// If tag exists remotely, skip version check (this is a second platform build)
if (tagExistsRemotely) {
  // Tag exists remotely, this is a second platform build
  console.log(`ℹ️  Tag ${tagName} already exists on remote.`);
  console.log('   This appears to be a multi-platform build.');
  console.log('   Skipping version update and tag creation.\n');
} else {
  // Check if version changed (only if tag doesn't exist)
  if (newVersion === currentVersion) {
    console.error(`❌ Error: Version ${newVersion} is already the current version`);
    console.error(
      'If you want to publish for another platform, make sure the tag exists on remote first.',
    );
    process.exit(1);
  }
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
console.log(`New version: ${newVersion}`);
if (isMandatory) {
  console.log('⚠️  This will be marked as a MANDATORY update\n');
} else {
  console.log('');
}

try {
  // Step 1: Prepare tag (only if tag doesn't exist remotely)
  if (!tagExistsRemotely) {
    console.log('📝 Step 1: Preparing release...');
    console.log('   (Version will be updated after successful build)\n');
  } else {
    console.log('📝 Step 1: Skipping version update (tag already exists)\n');
  }

  // Step 2: Prepare tag (only if tag exists remotely, fetch it)
  if (tagExistsRemotely) {
    console.log(`🏷️  Step 2: Fetching tag from desktop-updates...`);
    const desktopUpdatesUrl = `https://github.com/${desktopUpdatesRepo}.git`;

    // Check if tag exists locally
    let tagExistsLocally = false;
    try {
      execSync(`git rev-parse -q --verify "refs/tags/${tagName}"`, { cwd: rootDir, stdio: 'pipe' });
      tagExistsLocally = true;
    } catch {
      // Tag doesn't exist locally
    }

    if (!tagExistsLocally) {
      try {
        let updatesRemoteExists = false;
        try {
          execSync('git remote get-url updates', { cwd: rootDir, stdio: 'pipe' });
          updatesRemoteExists = true;
        } catch {
          execSync(`git remote add updates ${desktopUpdatesUrl}`, {
            cwd: rootDir,
            stdio: 'pipe',
          });
        }

        execSync(`git fetch updates tag ${tagName}`, {
          cwd: rootDir,
          stdio: 'inherit',
        });
        console.log('✅ Tag fetched\n');
      } catch (error) {
        console.warn(`⚠️  Warning: Could not fetch tag from desktop-updates: ${error.message}`);
        console.warn('   You may need to create the tag manually.\n');
      }
    } else {
      console.log('✅ Tag already exists locally\n');
    }
  } else {
    console.log('🏷️  Step 2: Tag will be created after successful build\n');
  }

  // Step 3/4/5: Build first (before updating version)
  const buildStepNumber = tagExistsRemotely ? 'Step 3' : 'Step 3';
  console.log(`🔨 ${buildStepNumber}: Building application...`);

  // Check if GH_TOKEN is set (needed for publishing, even for public repos)
  if (!process.env.GH_TOKEN) {
    console.error('❌ Error: GH_TOKEN environment variable not set');
    console.error(
      '\nGH_TOKEN is required to publish releases to GitHub, even for public repositories.',
    );
    console.error('It is used to authenticate API requests when uploading release artifacts.\n');
    console.error('Set it with:');
    console.error('  macOS: launchctl setenv GH_TOKEN your_token_here');
    console.error('  Windows: setx GH_TOKEN "your_token_here"');
    console.error('  Linux: export GH_TOKEN=your_token_here');
    process.exit(1);
  }

  // Check platform
  const platform = process.platform;
  console.log(`Current platform: ${platform}\n`);

  // Build with current version first
  console.log('📦 Building application (this may take a few minutes)...\n');
  execSync('npm run build:prod', { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Build successful!\n');

  // Only update version AFTER successful build
  if (!tagExistsRemotely) {
    console.log('📝 Step 4: Updating version in package.json...');
    const currentPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    currentPackageJson.version = newVersion;
    writeFileSync(packageJsonPath, JSON.stringify(currentPackageJson, null, 2) + '\n');
    console.log('✅ Version updated\n');

    console.log('📦 Step 5: Committing version change...');
    execSync(`git add package.json`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`git commit -m "v${newVersion}"`, { cwd: rootDir, stdio: 'inherit' });
    console.log('✅ Committed\n');

    // Create tag if it doesn't exist locally
    let tagExistsLocally = false;
    try {
      execSync(`git rev-parse -q --verify "refs/tags/${tagName}"`, { cwd: rootDir, stdio: 'pipe' });
      tagExistsLocally = true;
    } catch {
      // Tag doesn't exist locally
    }

    if (!tagExistsLocally) {
      execSync(`git tag ${tagName}`, { cwd: rootDir, stdio: 'inherit' });
      console.log('✅ Tag created\n');
    }

    // Push commits and tags
    console.log('📤 Step 6: Pushing to GitHub...');
    execSync('git push', { cwd: rootDir, stdio: 'inherit' });

    // Push tags to desktop-updates repo
    console.log(`📤 Pushing tag to desktop-updates repository...`);
    const desktopUpdatesUrl = `https://github.com/${desktopUpdatesRepo}.git`;
    try {
      let updatesRemoteExists = false;
      try {
        execSync('git remote get-url updates', { cwd: rootDir, stdio: 'pipe' });
        updatesRemoteExists = true;
      } catch {
        // Remote doesn't exist
      }

      if (!updatesRemoteExists) {
        execSync(`git remote add updates ${desktopUpdatesUrl}`, {
          cwd: rootDir,
          stdio: 'pipe',
        });
      }

      const pushUrl = process.env.GH_TOKEN
        ? `https://${process.env.GH_TOKEN}@github.com/${desktopUpdatesRepo}.git`
        : desktopUpdatesUrl;
      execSync(`git push ${pushUrl} ${tagName}`, {
        cwd: rootDir,
        stdio: 'inherit',
      });
      console.log('✅ Tag pushed to desktop-updates\n');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not push tag to desktop-updates: ${error.message}`);
      console.warn('   Tag exists locally and will be used by electron-builder.');
      console.warn('   You may need to manually push the tag to desktop-updates.\n');
    }
  } else {
    // Tag exists remotely, ensure package.json has correct version
    const currentPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (currentPackageJson.version !== newVersion) {
      console.log(
        `⚠️  Warning: package.json version is ${currentPackageJson.version}, updating to ${newVersion}...`,
      );
      currentPackageJson.version = newVersion;
      writeFileSync(packageJsonPath, JSON.stringify(currentPackageJson, null, 2) + '\n');
      console.log('✅ Version updated\n');
    }
  }

  // Step 6/7: Publish release
  const publishStepNumber = tagExistsRemotely ? 'Step 4' : 'Step 7';
  console.log(`🚀 ${publishStepNumber}: Publishing to GitHub releases...`);

  if (platform === 'darwin') {
    console.log('\n📦 Building for macOS...');
    console.log(`   - Version: ${newVersion}`);
    console.log('   - macOS: DMG and ZIP files\n');
    execSync(`npx electron-builder --mac --publish=always`, {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
    });
    console.log('\n⚠️  Note: Windows builds should be done on a Windows machine');
    console.log('   Build Windows installer separately and upload to the same release');
  } else if (platform === 'win32') {
    console.log('\n📦 Building for Windows...');
    console.log(`   - Version: ${newVersion}`);
    console.log('   - Windows: NSIS installer (x64)\n');
    execSync('npx electron-builder --win --x64 --publish=always', {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
    });
    console.log('\n⚠️  Note: macOS builds should be done on a macOS machine');
    console.log('   Build macOS installer separately and upload to the same release');
  } else {
    console.log('\n📦 Building for current platform...');
    console.log(`   - Version: ${newVersion}\n`);
    execSync('npx electron-builder --publish=always', {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
    });
  }

  console.log('\n✅ Release published successfully!');

  // Update release notes if mandatory flag is set
  if (isMandatory) {
    console.log('\n📝 Updating release notes to mark as mandatory...');
    try {
      const tagName = `v${newVersion}`;
      const apiUrl = `https://api.github.com/repos/holok-ai/desktop-updates/releases/tags/${tagName}`;

      // First, get the current release
      const getResponse = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${process.env.GH_TOKEN}`,
        },
      });

      if (!getResponse.ok) {
        console.warn(
          `⚠️  Warning: Could not fetch release (${getResponse.status}). You may need to manually add [MANDATORY] to the release notes.`,
        );
      } else {
        const release = await getResponse.json();
        const currentBody = release.body || '';

        // Check if already marked as mandatory
        if (currentBody.toLowerCase().includes('[mandatory]')) {
          console.log('✅ Release already marked as mandatory');
        } else {
          // Prepend [MANDATORY] to release notes
          const updatedBody = `[MANDATORY]\n\n${currentBody}`;

          // Update the release
          const updateResponse = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
              Accept: 'application/vnd.github.v3+json',
              Authorization: `token ${process.env.GH_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              body: updatedBody,
            }),
          });

          if (updateResponse.ok) {
            console.log('✅ Release marked as mandatory');
          } else {
            const errorText = await updateResponse.text();
            console.warn(`⚠️  Warning: Could not update release notes (${updateResponse.status}).`);
            console.warn(`   Error: ${errorText}`);
            console.warn(`   Please manually add [MANDATORY] to the release notes at:`);
            console.warn(
              `   https://github.com/holok-ai/desktop-updates/releases/tag/v${newVersion}`,
            );
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Error updating release notes: ${error.message}`);
      console.warn(`   Please manually add [MANDATORY] to the release notes at:`);
      console.warn(`   https://github.com/holok-ai/desktop-updates/releases/tag/v${newVersion}`);
    }
  }

  console.log(`\n🎉 Version ${newVersion} is now available at:`);
  console.log(`   https://github.com/holok-ai/desktop-updates/releases/tag/v${newVersion}`);
} catch (error) {
  console.error('\n❌ Error during release process:', error.message);
  console.error('\n⚠️  Note: Version in package.json has been updated.');
  console.error('You may need to revert it manually if the release failed.');
  process.exit(1);
}
