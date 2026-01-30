import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const SOURCE_DIR = join(__dirname, '..', 'node_modules', '@holokai', 'chat-component');
const TARGET_DIR = join(__dirname, '..', 'dist-electron', 'node_modules', '@holokai', 'chat-component');

// Recursively copy directory
function copyRecursive(src, dest) {
    mkdirSync(dest, { recursive: true });

    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

// Main execution
console.log('📦 Copying chat-component to dist-electron...');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Target: ${TARGET_DIR}`);

try {
    // Check if source exists
    if (!existsSync(SOURCE_DIR)) {
        console.error('❌ Error: node_modules/@holokai/chat-component not found!');
        console.error('Please run "npm install" first.');
        process.exit(1);
    }

    // Copy files
    copyRecursive(SOURCE_DIR, TARGET_DIR);

    console.log('✅ Chat component copied to dist-electron successfully!');
} catch (error) {
    console.error('❌ Error copying chat component:', error);
    process.exit(1);
}

