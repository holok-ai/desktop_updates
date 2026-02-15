#!/usr/bin/env node

/**
 * Check if a GitHub release is marked as mandatory
 * Usage: node scripts/check-mandatory.js <version>
 * Example: node scripts/check-mandatory.js 1.0.7
 */

const version = process.argv[2];

if (!version) {
  console.error('❌ Error: Version required');
  console.error('\nUsage: node scripts/check-mandatory.js <version>');
  console.error('Example: node scripts/check-mandatory.js 1.0.7');
  process.exit(1);
}

const tagName = `v${version}`;
const apiUrl = `https://api.github.com/repos/holok-ai/desktop_updates/releases/tags/${tagName}`;

console.log(`🔍 Checking if release ${tagName} is marked as mandatory...\n`);

try {
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      console.error(`❌ Release ${tagName} not found`);
      console.error(`   Check: https://github.com/holok-ai/desktop_updates/releases`);
    } else {
      console.error(`❌ Error: HTTP ${response.status}`);
    }
    process.exit(1);
  }

  const release = await response.json();
  const releaseNotes = release.body || '';

  // Check for mandatory indicators (same logic as auto-updater)
  const normalized = releaseNotes.toLowerCase();
  const isMandatory =
    normalized.includes('[mandatory]') ||
    normalized.includes('mandatory: true') ||
    normalized.includes('"mandatory": true') ||
    normalized.includes('mandatory update') ||
    normalized.includes('critical security') ||
    normalized.includes('security update');

  console.log(`Release: ${tagName}`);
  console.log(`Published: ${release.published_at}`);
  console.log(`URL: ${release.html_url}\n`);

  if (isMandatory) {
    console.log('✅ Status: MANDATORY');
    console.log('\nRelease notes preview:');
    console.log('─'.repeat(60));
    console.log(releaseNotes.substring(0, 500));
    if (releaseNotes.length > 500) {
      console.log('...');
    }
    console.log('─'.repeat(60));
  } else {
    console.log('❌ Status: OPTIONAL (not marked as mandatory)');
    console.log('\nTo mark as mandatory, add [MANDATORY] to the release notes.');
    console.log(`Edit at: ${release.html_url}`);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
