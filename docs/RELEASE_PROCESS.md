# Release Process for Holokai Desktop

## Quick Release (Both Mac & Windows)

### Overview

The release process supports building on separate platforms:
- **macOS**: Builds and publishes DMG/ZIP files
- **Windows**: Builds and publishes EXE installer
- **Both upload to the same GitHub release automatically**

### Setting GH_TOKEN

**macOS/Linux:**
```bash
# Temporary (current session only)
export GH_TOKEN=your_token_here

# Permanent (add to ~/.zshrc or ~/.bashrc)
echo 'export GH_TOKEN=your_token_here' >> ~/.zshrc
source ~/.zshrc
```

**Windows:**

**Command Prompt (temporary):**
```cmd
set GH_TOKEN=your_token_here
```

**PowerShell (temporary):**
```powershell
$env:GH_TOKEN="your_token_here"
```

**Windows (permanent - recommended):**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to "Advanced" tab → Click "Environment Variables"
3. Under "User variables", click "New"
4. Variable name: `GH_TOKEN`
5. Variable value: `your_token_here`
6. Click OK on all dialogs
7. Restart terminal/IDE

**Or via PowerShell (permanent):**
```powershell
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'your_token_here', 'User')
```

**Or via Command Prompt (permanent):**
```cmd
setx GH_TOKEN "your_token_here"
```

### Running the Release

**Step 1: On macOS (creates release and uploads macOS files)**
```bash
# Make sure you have the latest code
git pull

# Set GH_TOKEN if not already set
export GH_TOKEN=your_token_here

# Run release script
npm run release 1.0.1
```

This will:
1. ✅ Update version in package.json
2. ✅ Commit and tag the release (`v1.0.1`)
3. ✅ Push to GitHub
4. ✅ Build macOS DMG and ZIP files
5. ✅ Create GitHub release and upload macOS files

**Step 2: On Windows (uploads Windows files to same release)**
```cmd
# Make sure you have the latest code
git pull

# Set GH_TOKEN if not already set
set GH_TOKEN=your_token_here

# Run release script (same version)
npm run release 1.0.1
```

This will:
1. ✅ Detect existing tag `v1.0.1` on remote
2. ✅ Fetch the tag locally
3. ✅ Build Windows EXE installer
4. ✅ Find existing GitHub release and upload Windows file

**Result:** One GitHub release with both macOS (DMG/ZIP) and Windows (EXE) files.

### Important Notes

- ✅ **Both platforms can run independently** - The script automatically handles existing tags
- ✅ **Same version number** - Use the exact same version (e.g., `1.0.1`) on both platforms
- ✅ **Order doesn't matter** - You can run Windows first, then macOS, or vice versa
- ✅ **Automatic release creation** - First platform creates the release, second adds to it
- ✅ **No manual upload needed** - Everything is automated

## Platform-Specific Builds

### Build for Current Platform Only

```bash
# Build for your current platform (Mac or Windows)
npm run package
```

### Build for Specific Platform

```bash
# Build only for macOS
npm run package:mac

# Build only for Windows
npm run package:win

# Build for both platforms
npm run package:all
```

### Publish Specific Platform

```bash
# Publish current platform only
npm run package:publish

# Publish both Mac and Windows
npm run package:publish:all
```

## Cross-Platform Building

### Recommended Approach: Build on Native Platforms

We build on separate platforms to ensure proper code signing and avoid integrity errors:

**macOS builds:**
- Run `npm run release 1.0.1` on your Mac
- Creates release and uploads DMG/ZIP files

**Windows builds:**
- Run `npm run release 1.0.1` on a Windows machine/VM
- Uploads EXE file to the same release automatically

**Benefits:**
- ✅ Proper code signing on each platform
- ✅ No integrity check errors
- ✅ No CI/CD costs or limitations
- ✅ Full control over build process

### Building Windows on macOS (Not Recommended)

⚠️ **Possible but not recommended** - electron-builder can build Windows installers on macOS, but:
- May have integrity check errors
- Code signing may not work properly
- Users might see warnings

**If you must build Windows on macOS:**
```bash
brew install wine-stable  # Optional, for some features
npm run package:win
```

### Building macOS on Windows

❌ **Not supported** - You cannot build macOS DMG files on Windows

**Solutions:**
1. Use a macOS machine or VM (recommended)
2. Use free CI/CD services (Azure Pipelines, GitLab CI, AppVeyor)
3. Use a cloud macOS service

## Manual Release Process

If you prefer to do it step-by-step:

```bash
# 1. Update version in package.json
# Change "version": "1.0.0" to "1.0.1"

# 2. Commit and tag
git add package.json
git commit -m "v1.0.1"
git tag v1.0.1

# 3. Push to GitHub
git push
git push --tags

# 4. Build and publish
# macOS/Linux:
export GH_TOKEN=your_token_here
# Windows (CMD):
set GH_TOKEN=your_token_here
# Windows (PowerShell):
$env:GH_TOKEN="your_token_here"

npm run package:publish:all
```

## Alternative: Free CI/CD Services

If you prefer automated builds instead of building on separate platforms:

**Azure Pipelines** (1,800 free minutes/month):
- Supports Windows, macOS, Linux
- Good alternative to GitHub Actions

**GitLab CI/CD** (400 free minutes/month):
- Supports Windows runners
- Similar workflow to GitHub Actions

**AppVeyor** (Free for open source):
- Unlimited builds for open source
- Native Windows support

See `docs/BUILDING_WINDOWS.md` for detailed CI/CD setup instructions.

## Release Artifacts

After publishing from both platforms, the GitHub release will contain:

**macOS files (from Mac build):**
- `Holokai Desktop-1.0.1-arm64.dmg` (Apple Silicon)
- `Holokai Desktop-1.0.1-arm64.zip` (Apple Silicon - for auto-updates)
- `Holokai Desktop-1.0.1-x64.dmg` (Intel Mac, if built)
- `Holokai Desktop-1.0.1-x64.zip` (Intel Mac - for auto-updates)

**Windows files (from Windows build):**
- `Holokai Desktop Setup 1.0.1.exe` (NSIS installer)

All files are automatically uploaded to the same GitHub release.

## Version Format

- Must follow [SemVer](https://semver.org/): `X.Y.Z`
- Examples: `1.0.1`, `1.1.0`, `2.0.0`
- Tag format: `v1.0.1` (automatically prefixed with `v`)

## Troubleshooting

**"Tag already exists" error when running on second platform:**
- This is now handled automatically by the release script
- The script detects existing tags and skips creation
- Just run `npm run release 1.0.1` on both platforms - it will work

**"Cannot build Windows on macOS" error:**
- Build Windows installers on a Windows machine/VM
- This ensures proper code signing and no integrity errors

**"Cannot build macOS on Windows" error:**
- Build macOS installers on a macOS machine
- This ensures proper code signing

**"GH_TOKEN not set" error:**
- **macOS/Linux:** `export GH_TOKEN=your_token_here`
- **Windows (CMD):** `set GH_TOKEN=your_token_here`
- **Windows (PowerShell):** `$env:GH_TOKEN="your_token_here"`
- Or set it permanently using System Properties (see "Setting GH_TOKEN" section above)
- For packaged app updates, set GH_TOKEN as a system/user environment variable so it's available to all applications

