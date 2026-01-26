# Release Process for Holokai Desktop

## Quick Release (Both Mac & Windows)

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

```bash
# After setting GH_TOKEN, run:
npm run release 1.0.1
```

This will:
1. ✅ Update version in package.json
2. ✅ Commit and tag the release
3. ✅ Push to GitHub
4. ✅ Build for **both macOS and Windows**
5. ✅ Publish to GitHub releases

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

### Building Windows on macOS

✅ **Supported** - electron-builder can build Windows installers on macOS

**Requirements:**
- No additional setup needed for basic builds
- For advanced features, you may need Wine (optional):
  ```bash
  brew install wine-stable
  ```

### Building macOS on Windows

❌ **Not directly supported** - You cannot build macOS DMG files on Windows

**Solutions:**
1. Use GitHub Actions CI/CD (recommended)
2. Use a macOS machine or VM
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

## GitHub Actions (Recommended for Cross-Platform Builds)

For automated cross-platform builds with proper code signing, use GitHub Actions.

### Setup

1. **Create GitHub Secret:**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GH_TOKEN`
   - Value: Your GitHub Personal Access Token (with `repo` scope)
   - Click "Add secret"

2. **Workflow File:**
   The workflow file is already created at `.github/workflows/release.yml`

### How It Works

When you push a tag (e.g., `v1.0.1`), GitHub Actions will:
- ✅ Build macOS installers on macOS runners (with proper code signing)
- ✅ Build Windows installers on Windows runners (with proper code signing)
- ✅ Publish both to GitHub releases automatically

### Usage

```bash
# 1. Update version in package.json
# 2. Commit and tag
git add package.json
git commit -m "v1.0.1"
git tag v1.0.1

# 3. Push (this triggers GitHub Actions)
git push
git push --tags

# GitHub Actions will automatically build and publish both platforms
```

### Workflow Details

The workflow (`.github/workflows/release.yml`) includes:
- **macOS job**: Builds DMG and ZIP files on macOS
- **Windows job**: Builds NSIS installer on Windows
- Both jobs run in parallel for faster builds
- Both publish to the same GitHub release

### Benefits

- ✅ Native builds = proper code signing
- ✅ No integrity check errors
- ✅ Faster builds (parallel execution)
- ✅ Automatic publishing
- ✅ No need for Wine or cross-compilation

## Release Artifacts

After publishing, you'll have:

**macOS:**
- `Holokai Desktop-1.0.1-arm64.dmg` (Apple Silicon)
- `Holokai Desktop-1.0.1-x64.dmg` (Intel Mac, if built)

**Windows:**
- `Holokai Desktop Setup 1.0.1.exe` (NSIS installer)

All files are automatically uploaded to the GitHub release.

## Version Format

- Must follow [SemVer](https://semver.org/): `X.Y.Z`
- Examples: `1.0.1`, `1.1.0`, `2.0.0`
- Tag format: `v1.0.1` (automatically prefixed with `v`)

## Troubleshooting

**"Cannot build Windows on macOS" error:**
- Install Wine: `brew install wine-stable`
- Or use GitHub Actions for Windows builds

**"Cannot build macOS on Windows" error:**
- Use GitHub Actions or a macOS machine
- Or build only for Windows: `npm run package:win`

**"GH_TOKEN not set" error:**
- **macOS/Linux:** `export GH_TOKEN=your_token_here`
- **Windows (CMD):** `set GH_TOKEN=your_token_here`
- **Windows (PowerShell):** `$env:GH_TOKEN="your_token_here"`
- Or set it permanently using System Properties (see "Setting GH_TOKEN" section above)
- For packaged app updates, set GH_TOKEN as a system/user environment variable so it's available to all applications

**"Installer integrity check has failed" error (Windows EXE built on macOS):**
- This is a common issue when building Windows installers on macOS
- **Solution (Recommended):** Use GitHub Actions to build Windows installers natively on Windows
  - The workflow file `.github/workflows/release.yml` is already configured
  - Just push a tag and GitHub Actions will build on Windows automatically
  - This ensures proper code signing and no integrity errors
- **Alternative:** Build Windows installers on a Windows machine or VM
- **Note:** Code signing certificates are Windows-specific and cannot be used on macOS

