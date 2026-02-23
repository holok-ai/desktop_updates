#!/bin/bash
# Cleanup script for Holokai Desktop (Electron app)
# Removes the app and all associated data from macOS

APP_NAME="Holokai Desktop"
APP_ID="com.holokai.desktop"
SLUG="holokai-desktop"

echo "🧹 Cleaning up $APP_NAME..."
echo ""

# Application bundle
if [ -d "/Applications/$APP_NAME.app" ]; then
    echo "✓ Removing /Applications/$APP_NAME.app"
    rm -rf "/Applications/$APP_NAME.app"
else
    echo "- App not found in /Applications (already removed?)"
fi

# Application Support
for dir in "$HOME/Library/Application Support/$APP_NAME" \
           "$HOME/Library/Application Support/$SLUG"; do
    if [ -d "$dir" ]; then
        echo "✓ Removing $dir"
        rm -rf "$dir"
    fi
done

# Caches
for dir in "$HOME/Library/Caches/$APP_ID" \
           "$HOME/Library/Caches/$SLUG" \
           "$HOME/Library/Caches/$APP_NAME"; do
    if [ -d "$dir" ]; then
        echo "✓ Removing $dir"
        rm -rf "$dir"
    fi
done

# Preferences
for plist in "$HOME/Library/Preferences/$APP_ID.plist" \
             "$HOME/Library/Preferences/$SLUG.plist"; do
    if [ -f "$plist" ]; then
        echo "✓ Removing $plist"
        rm -f "$plist"
    fi
done

# Saved Application State
for dir in "$HOME/Library/Saved Application State/$APP_ID.savedState" \
           "$HOME/Library/Saved Application State/$SLUG.savedState"; do
    if [ -d "$dir" ]; then
        echo "✓ Removing $dir"
        rm -rf "$dir"
    fi
done

# Electron/Chromium data
for dir in "$HOME/Library/Application Support/$APP_ID" \
           "$HOME/Library/WebKit/$APP_ID"; do
    if [ -d "$dir" ]; then
        echo "✓ Removing $dir"
        rm -rf "$dir"
    fi
done

# Logs
for dir in "$HOME/Library/Logs/$APP_NAME" \
           "$HOME/Library/Logs/$SLUG"; do
    if [ -d "$dir" ]; then
        echo "✓ Removing $dir"
        rm -rf "$dir"
    fi
done

# Crash reports
find "$HOME/Library/Logs/DiagnosticReports" -name "$SLUG*" -o -name "$APP_NAME*" 2>/dev/null | while read f; do
    echo "✓ Removing crash report: $f"
    rm -f "$f"
done

echo ""
echo "✅ Cleanup complete for $APP_NAME"
