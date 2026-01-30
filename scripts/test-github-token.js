#!/usr/bin/env node

/**
 * Test GitHub Personal Access Token
 * 
 * Usage:
 *   GH_TOKEN=your_token node scripts/test-github-token.js
 * 
 * Or set it in your environment:
 *   export GH_TOKEN=your_token
 *   node scripts/test-github-token.js
 */

const token = process.env.GH_TOKEN;
console.log('GH_TOKEN:', token);

if (!token) {
  console.error('❌ Error: GH_TOKEN environment variable not set');
  console.error('\nSet it with:');
  console.error('  export GH_TOKEN=your_token_here');
  console.error('\nOr run:');
  console.error('  GH_TOKEN=your_token node scripts/test-github-token.js');
  process.exit(1);
}

const repo = 'holok-ai/desktop';

async function testToken() {
  try {
    console.log('🔍 Testing GitHub token access...');
    console.log(`Repository: ${repo}`);
    console.log(`Token length: ${token.length} characters\n`);

    // Test 1: Check repo access
    console.log('Test 1: Checking repository access...');
    const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'holokai-desktop'
      }
    });

    if (repoResponse.ok) {
      const repoData = await repoResponse.json();
      console.log('✅ Repository access: SUCCESS');
      console.log(`   Name: ${repoData.name}`);
      console.log(`   Private: ${repoData.private}`);
      console.log(`   Default branch: ${repoData.default_branch}\n`);
    } else {
      const error = await repoResponse.text();
      console.log(`❌ Repository access: FAILED (${repoResponse.status})`);
      console.log(`   ${error}\n`);
      process.exit(1);
    }

    // Test 2: Check releases access
    console.log('Test 2: Checking releases access...');
    const releasesResponse = await fetch(`https://api.github.com/repos/${repo}/releases`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'holokai-desktop'
      }
    });

    if (releasesResponse.ok) {
      const releases = await releasesResponse.json();
      console.log('✅ Releases access: SUCCESS');
      console.log(`   Found ${releases.length} existing release(s)\n`);
      
      if (releases.length > 0) {
        console.log('   Recent releases:');
        releases.slice(0, 3).forEach((release, i) => {
          console.log(`   ${i + 1}. ${release.tag_name} - ${release.name || release.tag_name}`);
        });
        console.log('');
      }
    } else {
      const error = await releasesResponse.text();
      console.log(`❌ Releases access: FAILED (${releasesResponse.status})`);
      console.log(`   ${error}\n`);
      process.exit(1);
    }

    // Test 3: Check token permissions
    console.log('Test 3: Checking token permissions...');
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'holokai-desktop'
      }
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ Token authentication: SUCCESS');
      console.log(`   Authenticated as: ${userData.login}\n`);
    } else {
      console.log(`❌ Token authentication: FAILED (${userResponse.status})\n`);
      process.exit(1);
    }

    console.log('✅ All tests passed! Your token has the necessary permissions.');
    console.log('\nYou can now publish releases with:');
    console.log('  GH_TOKEN=your_token npm run package -- --publish=always');
    console.log('\nOr set GH_TOKEN in your environment and run:');
    console.log('  npm run package -- --publish=always');

  } catch (error) {
    console.error('❌ Error testing token:', error.message);
    process.exit(1);
  }
}

testToken();

