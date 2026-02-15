#!/usr/bin/env node

/**
 * Manually mark a GitHub release as mandatory
 * Usage: node scripts/mark-mandatory.js <version>
 * Example: node scripts/mark-mandatory.js 1.0.7
 */

const version = process.argv[2];

if (!version) {
  console.error('❌ Error: Version required');
  console.error('\nUsage: node scripts/mark-mandatory.js <version>');
  console.error('Example: node scripts/mark-mandatory.js 1.0.7');
  process.exit(1);
}

if (!process.env.GH_TOKEN) {
  console.error('❌ Error: GH_TOKEN environment variable not set');
  console.error('\nSet it with:');
  console.error('  macOS: launchctl setenv GH_TOKEN your_token_here');
  console.error('  Windows: setx GH_TOKEN "your_token_here"');
  console.error('  Linux: export GH_TOKEN=your_token_here');
  process.exit(1);
}

const tagName = `v${version}`;
const apiUrl = `https://api.github.com/repos/holok-ai/desktop_updates/releases/tags/${tagName}`;

console.log(`📝 Marking release ${tagName} as mandatory...\n`);

try {
  // First, get the current release
  const getResponse = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${process.env.GH_TOKEN}`,
    },
  });

  if (!getResponse.ok) {
    if (getResponse.status === 404) {
      console.error(`❌ Release ${tagName} not found`);
      console.error(`   Check: https://github.com/holok-ai/desktop_updates/releases`);
    } else {
      console.error(`❌ Error: HTTP ${getResponse.status}`);
      const errorText = await getResponse.text();
      console.error(`   ${errorText}`);
    }
    process.exit(1);
  }

  const release = await getResponse.json();
  const currentBody = release.body || '';

  // Check if already marked as mandatory
  if (currentBody.toLowerCase().includes('[mandatory]')) {
    console.log('✅ Release is already marked as mandatory');
    console.log(`\nRelease notes preview:`);
    console.log('─'.repeat(60));
    console.log(currentBody.substring(0, 200));
    if (currentBody.length > 200) {
      console.log('...');
    }
    console.log('─'.repeat(60));
    process.exit(0);
  }

  // Prepend [MANDATORY] to release notes
  const updatedBody = `[MANDATORY]\n\n${currentBody}`;

  // Update the release
  const updateResponse = await fetch(apiUrl, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${process.env.GH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: updatedBody,
    }),
  });

  if (updateResponse.ok) {
    console.log('✅ Release marked as mandatory successfully!');
    console.log(`\nView release: ${release.html_url}`);
  } else {
    const errorText = await updateResponse.text();
    console.error(`❌ Error: Could not update release notes (HTTP ${updateResponse.status})`);
    console.error(`   ${errorText}`);
    console.error(`\nPlease manually add [MANDATORY] to the release notes at:`);
    console.error(`   ${release.html_url}`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
