# How to Update Holokai Desktop

## For Windows Users

**Simple 1-Click Update:**

1. Navigate to your Holokai desktop folder (where you installed the app)
2. Go to the `scripts` folder
3. Double-click `update-holokai.bat`
4. Wait for it to finish (you'll see "Update Complete!")
5. Close the window
6. Run the app as normal

That's it! The script will automatically:

- Download the latest code from GitHub
- Update all dependencies
- Rebuild the application

## What the Script Does

The update script performs these steps automatically:

1. Pulls the latest changes from GitHub (`git pull`)
2. Installs any new or updated dependencies (`npm install`)
3. Builds the Electron application (`npm run build:electron`)

## Troubleshooting

If you see any errors:

- **"git is not recognized"**: You need Git installed on your computer
- **"npm is not recognized"**: You need Node.js installed on your computer
- **Connection errors**: Check your internet connection

If you encounter any issues, contact your IT support or the person who initially set up the application for you.

## For Mac/Linux Users

Mac and Linux users can use the terminal commands directly:

```bash
cd /path/to/holokai/desktop
git pull origin main
npm install
npm run build:electron
npm run electron
```
