# Release Process for Holokai Desktop

## Quick Release (Both Mac & Windows)

```bash
# Set your GitHub token
export GH_TOKEN=your_token_here

# Run release script (automates everything)
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
export GH_TOKEN=your_token_here
npm run package:publish:all
```

## GitHub Actions (Recommended for Windows → Mac)

For automated cross-platform builds, set up GitHub Actions:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build:prod
      - run: npx electron-builder --${{ matrix.os == 'macos-latest' && 'mac' || 'win' }} --publish=always
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

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
- Set it: `export GH_TOKEN=your_token_here`
- Or use: `GH_TOKEN=your_token npm run release 1.0.1`

