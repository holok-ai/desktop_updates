# Building Windows Installers

Since GitHub Actions has limited free minutes, here are alternative approaches for building Windows installers with proper code signing.

## Option 1: Build on Windows Machine/VM (Recommended)

**Best for:** Proper code signing, no integrity errors

### Setup

1. **On a Windows machine:**
   ```cmd
   # Clone the repository
   git clone <repo-url>
   cd desktop

   # Install Node.js and dependencies
   npm install

   # Set GitHub token
   set GH_TOKEN=your_token_here

   # Build and publish
   npm run package:win
   ```

2. **Or use Windows VM:**
   - Use Parallels, VMware, or VirtualBox
   - Install Windows 10/11
   - Follow same steps as above

### Benefits
- ✅ Native Windows build = proper code signing
- ✅ No integrity check errors
- ✅ Full control over build process
- ✅ No CI/CD limitations

## Option 2: Use Free CI/CD Alternatives

### GitLab CI/CD (Free tier)
- 400 minutes/month free
- Supports Windows runners
- Similar to GitHub Actions

### CircleCI (Free tier)
- Limited free minutes
- Supports Windows builds

### AppVeyor (Free for open source)
- Unlimited builds for open source projects
- Native Windows support
- Good for Electron apps

### Azure Pipelines (Free tier)
- 1,800 minutes/month free
- Supports Windows, macOS, Linux
- Good alternative to GitHub Actions

## Option 3: Build Locally on macOS (Current Setup)

**Limitations:**
- May have integrity check errors
- Code signing might not work properly
- Users might see warnings

**Current configuration:**
- Builds work but installer integrity check may fail
- Users can still install but may see warnings

## Option 4: Manual Release Process

1. **Build macOS on your Mac:**
   ```bash
   npm run package:mac
   ```

2. **Build Windows on a Windows machine:**
   ```cmd
   npm run package:win
   ```

3. **Manually upload to GitHub releases:**
   - Go to GitHub releases
   - Create/edit release
   - Upload DMG and EXE files manually

## Recommended Approach

For a production setup without paid CI/CD:

1. **Use a Windows VM or spare Windows machine** for Windows builds
2. **Build macOS locally** on your Mac
3. **Use the release script** to automate versioning and tagging
4. **Manually upload** or use a simple script to upload artifacts

### Quick Windows Build Script

Create `scripts/build-windows.ps1`:
```powershell
# Build Windows installer
$env:GH_TOKEN = "your_token_here"
npm run build:prod
npx electron-builder --win --publish=never

# Files will be in release/ directory
# Upload manually to GitHub releases
```

## Code Signing on Windows

If you need proper code signing:

1. **Get a code signing certificate:**
   - Purchase from DigiCert, Sectigo, etc.
   - Or use self-signed for testing

2. **Configure in package.json:**
   ```json
   "win": {
     "target": "nsis",
     "signingHashAlgorithms": ["sha256"],
     "certificateFile": "path/to/certificate.pfx",
     "certificatePassword": "password"
   }
   ```

3. **Or use environment variables:**
   ```cmd
   set CSC_LINK=path/to/certificate.pfx
   set CSC_KEY_PASSWORD=password
   npm run package:win
   ```

## Summary

**Best option without paid CI/CD:**
- Use a Windows VM or machine for Windows builds
- Build macOS locally
- Use release script for versioning
- Manually upload or script the upload process

This gives you:
- ✅ Proper code signing
- ✅ No integrity errors
- ✅ Full control
- ✅ No CI/CD costs

