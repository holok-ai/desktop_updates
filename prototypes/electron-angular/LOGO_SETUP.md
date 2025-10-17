# Adding the Holokai Logo

## Logo Files Location

The Holokai logo files are located in the moku\web project:
```
C:\Projects\repos\holokai\moku\web\src\assets\logo\
```

Available logo files:
- `logo-no-text.png` - Icon only (recommended for app icon)
- `logo-full-dark.png` - Full logo with text (dark version)
- `logo-full-light.png` - Full logo with text (light version)
- `logo.png` - Standard logo

## Steps to Add Logo to Desktop App

### 1. Copy Logo Files

**Option A: Manual Copy (Easiest)**
1. Navigate to: `C:\Projects\repos\holokai\moku\web\src\assets\logo\`
2. Copy `logo-no-text.png`
3. Paste it to: `C:\Projects\repos\holokai\desktop-prototypes\electron-angular\src\assets\logo\`

**Option B: Command Line**
```powershell
# From the desktop-prototypes\electron-angular directory
Copy-Item "C:\Projects\repos\holokai\moku\web\src\assets\logo\logo-no-text.png" "src\assets\logo\"
```

### 2. Update Electron App Icon

To set the app icon (shown in taskbar, title bar, etc.):

**Edit `src-electron\main.ts`:**

Find this line in the `createWindow()` function:
```typescript
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
```

Add the icon property:
```typescript
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  icon: path.join(__dirname, '../src/assets/logo/logo-no-text.png'),
```

### 3. Update favicon (Browser Tab Icon)

**Replace `src\favicon.ico` with the Holokai icon:**

You can use an online tool to convert `logo-no-text.png` to `.ico` format:
- https://convertio.co/png-ico/
- https://www.icoconverter.com/

Or copy the favicon from moku\web:
```powershell
Copy-Item "C:\Projects\repos\holokai\moku\web\src\assets\favicon.ico" "src\"
```

### 4. Rebuild and Run

After adding the logo:

```powershell
# Terminal 1
npm start

# Terminal 2
npm run build:electron
npm run electron
```

The Holokai logo will now appear in:
- Windows taskbar
- App title bar
- Alt+Tab switcher
- Browser tab (when running in dev mode)

## For Production Builds

To set icons for installers, update `package.json`:

```json
"build": {
  "appId": "com.holokai.desktop",
  "productName": "Holokai Desktop",
  "win": {
    "icon": "src/assets/logo/logo-no-text.png"
  },
  "mac": {
    "icon": "src/assets/logo/logo-no-text.png"
  },
  "linux": {
    "icon": "src/assets/logo/logo-no-text.png"
  }
}
```

Note: For Windows `.exe`, you may need to convert to `.ico` format.
For macOS, you'll need `.icns` format.
