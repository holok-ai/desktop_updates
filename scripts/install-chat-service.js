import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const SOURCE_DIR = join(__dirname, '..', 'packages', 'chat-service');
const TARGET_DIR = join(__dirname, '..', 'node_modules', '@holokai', 'chat-component');

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
console.log('📦 Installing chat-service from packages to node_modules...');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Target: ${TARGET_DIR}`);

try {
  // Check if source exists
  if (!existsSync(SOURCE_DIR)) {
    console.error('❌ Error: packages/chat-service not found!');
    console.error('Please run "npm run build:for-desktop" in the chat-component directory first.');
    process.exit(1);
  }

  // Copy files
  copyRecursive(SOURCE_DIR, TARGET_DIR);

  console.log('✅ Chat service installed successfully!');
} catch (error) {
  console.error('❌ Error installing chat service:', error);
  process.exit(1);
}
