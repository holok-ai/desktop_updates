#!/usr/bin/env node

/**
 * Icon Preparation Script
 *
 * Prepares application icons for electron-builder by:
 * 1. Validating source logo (existence, format, dimensions, transparency)
 * 2. Resizing to 1024x1024 with aspect ratio preservation
 * 3. Creating build/icon.png for electron-builder to generate platform-specific icons
 *
 * Requirements:
 * - Source logo must be PNG format
 * - Minimum resolution: 512x512 pixels
 * - Recommended resolution: 1024x1024 pixels
 * - Must have alpha channel (transparency)
 * - Must be square or will be centered on transparent background
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOURCE_LOGO = path.resolve(__dirname, '../src/assets/images/logo-blue.png');
const BUILD_DIR = path.resolve(__dirname, '../build');
const OUTPUT_ICON = path.resolve(BUILD_DIR, 'icon.png');
const TARGET_SIZE = 1024;
const MIN_SIZE = 512;

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_SOURCE_NOT_FOUND = 1;
const EXIT_INVALID_FORMAT = 2;
const EXIT_RESIZE_FAILED = 3;
const EXIT_BUILD_DIR_FAILED = 4;

/**
 * Main execution function
 */
async function prepareIcons() {
  try {
    console.log('🎨 Icon Preparation Script');
    console.log('==========================\n');

    // Step 1: Validate source logo exists
    console.log('📁 Checking source logo...');
    if (!fs.existsSync(SOURCE_LOGO)) {
      console.error(`❌ Error: Source logo not found at ${SOURCE_LOGO}`);
      console.error('   Please ensure the logo file exists before building.');
      process.exit(EXIT_SOURCE_NOT_FOUND);
    }
    console.log(`✓ Source logo found: ${SOURCE_LOGO}\n`);

    // Step 2: Read and validate source logo metadata
    console.log('🔍 Validating source logo...');
    let metadata;
    try {
      metadata = await sharp(SOURCE_LOGO).metadata();
    } catch (error) {
      console.error(`❌ Error: Source logo is not a valid PNG image`);
      console.error(`   ${error.message}`);
      process.exit(EXIT_INVALID_FORMAT);
    }

    // Validate format
    if (metadata.format !== 'png') {
      console.error(`❌ Error: Source logo must be PNG format (found: ${metadata.format})`);
      process.exit(EXIT_INVALID_FORMAT);
    }
    console.log(`✓ Format: ${metadata.format.toUpperCase()}`);

    // Validate dimensions
    const { width, height } = metadata;
    console.log(`✓ Dimensions: ${width}x${height}`);

    if (width < MIN_SIZE || height < MIN_SIZE) {
      console.error(`❌ Error: Source logo must be at least ${MIN_SIZE}x${MIN_SIZE} pixels`);
      console.error(`   Found: ${width}x${height}`);
      console.error(`   Please provide a higher resolution logo.`);
      process.exit(EXIT_RESIZE_FAILED);
    }

    if (width < TARGET_SIZE || height < TARGET_SIZE) {
      console.warn(
        `⚠️  Warning: Source logo is smaller than recommended ${TARGET_SIZE}x${TARGET_SIZE}`,
      );
      console.warn(`   Icons may not be optimal quality at larger sizes.`);
    }

    // Validate transparency
    const hasAlpha = metadata.channels === 4;
    if (hasAlpha) {
      console.log(`✓ Transparency: Yes (RGBA)`);
    } else {
      console.warn(`⚠️  Warning: Source logo does not have transparency (alpha channel)`);
      console.warn(`   Icons may not render correctly on different backgrounds.`);
    }

    // Validate color space
    const colorSpace = metadata.space || 'unknown';
    console.log(`✓ Color space: ${colorSpace}`);
    if (!['srgb', 'rgb'].includes(colorSpace.toLowerCase())) {
      console.warn(`⚠️  Warning: Color space is ${colorSpace}, expected RGB or sRGB`);
    }

    console.log('');

    // Step 3: Create build directory
    console.log('📂 Creating build directory...');
    try {
      if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
        console.log(`✓ Created: ${BUILD_DIR}`);
      } else {
        console.log(`✓ Already exists: ${BUILD_DIR}`);
      }
    } catch (error) {
      console.error(`❌ Error: Cannot create build directory`);
      console.error(`   ${error.message}`);
      console.error(`   Check file system permissions.`);
      process.exit(EXIT_BUILD_DIR_FAILED);
    }
    console.log('');

    // Step 4: Resize and prepare icon
    console.log(`🔧 Preparing icon (${TARGET_SIZE}x${TARGET_SIZE})...`);
    try {
      await sharp(SOURCE_LOGO)
        .resize(TARGET_SIZE, TARGET_SIZE, {
          fit: 'contain', // Maintain aspect ratio, add transparent padding if needed
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png({
          compressionLevel: 9, // Maximum compression
          adaptiveFiltering: true, // Better compression
        })
        .toFile(OUTPUT_ICON);

      console.log(`✓ Icon created: ${OUTPUT_ICON}`);
    } catch (error) {
      console.error(`❌ Error: Failed to resize and save icon`);
      console.error(`   ${error.message}`);
      process.exit(EXIT_RESIZE_FAILED);
    }

    // Step 5: Verify output
    console.log('\n🔍 Verifying output...');
    const outputMetadata = await sharp(OUTPUT_ICON).metadata();
    console.log(`✓ Output dimensions: ${outputMetadata.width}x${outputMetadata.height}`);
    console.log(`✓ Output format: ${outputMetadata.format.toUpperCase()}`);
    console.log(
      `✓ Output channels: ${outputMetadata.channels} (${outputMetadata.channels === 4 ? 'RGBA' : 'RGB'})`,
    );

    const stats = fs.statSync(OUTPUT_ICON);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✓ Output size: ${sizeKB} KB`);

    // Success
    console.log('\n✅ Icon preparation complete!');
    console.log('\nNext steps:');
    console.log('  • electron-builder will automatically generate:');
    console.log('    - build/icon.ico (Windows)');
    console.log('    - build/icon.icns (macOS)');
    console.log('  • Run: npm run package');

    process.exit(EXIT_SUCCESS);
  } catch (error) {
    console.error('\n❌ Unexpected error during icon preparation:');
    console.error(error);
    process.exit(EXIT_RESIZE_FAILED);
  }
}

// Execute
prepareIcons();
