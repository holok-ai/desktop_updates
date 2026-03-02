#!/usr/bin/env node

/**
 * Check required Moku assistants for E2E tests.
 *
 * Usage:
 *   TEST_API_KEY=your_api_key \
 *   node scripts/check-moku-assistants.js "dsk-ut-ollama,dsk-ut-claude,dsk-ut-openai,dsk-ut-openai-guard"
 *
 * The script reads Desktop settings to get the Moku API URL,
 * exchanges the API key for an access token, fetches the assistants
 * list from Moku, and verifies that all required assistants exist,
 * have a URL slug, and expose at least one model.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolve the Electron appData path in a way that matches Electron's
 * getPath('appData') behaviour for each platform.
 */
function getAppDataPath() {
  const platform = process.platform;

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  if (platform === 'win32') {
    if (process.env.APPDATA) return process.env.APPDATA;
    return path.join(os.homedir(), 'AppData', 'Roaming');
  }

  // Linux and others
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  return path.join(os.homedir(), '.config');
}

function isLocalhostUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  return lower.includes('localhost') || lower.includes('127.0.0.1');
}

function buildErrorResult(errorMessage) {
  return {
    success: false,
    errorMessage,
    assistants: [],
  };
}

async function main() {
  const assistantsArg = process.argv[2];
  const defaultAssistants = 'dsk-ut-ollama,dsk-ut-claude,dsk-ut-openai,dsk-ut-openai-guard';

  const assistantNames = (assistantsArg || defaultAssistants)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const apiKey =
    process.env.TEST_API_KEY || process.env.MOKU_API_KEY || process.env.MOKU_TEST_API_KEY || '';

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    const result = buildErrorResult('Missing or invalid API key');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  // Load Desktop settings written by SettingsService (electron-store)
  const appDataPath = getAppDataPath();
  const configDir = path.join(appDataPath, 'holokai', 'desktop');
  const configPath = path.join(configDir, 'config.json');

  let settings;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    settings = JSON.parse(raw);
  } catch {
    const result = buildErrorResult('Could not open settings');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  const mokuApiUrl = settings.mokuApiUrl;
  const mokuWebUrl = settings.mokuWebUrl;

  if (!mokuApiUrl || typeof mokuApiUrl !== 'string') {
    const result = buildErrorResult('Could not open settings');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  if (isLocalhostUrl(mokuApiUrl) || isLocalhostUrl(mokuWebUrl)) {
    const result = buildErrorResult('Connection URL is using localhost - not allowed');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  // Step 1: exchange apiKey for accessToken (same as MokuService.exchangeApiKeyForAccessToken)
  let accessToken;
  try {
    const refreshResponse = await fetch(`${mokuApiUrl}/api/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    if (!refreshResponse.ok) {
      const text = await refreshResponse.text();
      const message =
        text && text.trim().length > 0
          ? `Could not authenticate with Moku API (${refreshResponse.status} ${text})`
          : `Could not authenticate with Moku API (${refreshResponse.status})`;
      const result = buildErrorResult(message);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }

    const json = await refreshResponse.json();
    accessToken = json.accessToken;
    if (!accessToken || typeof accessToken !== 'string') {
      const result = buildErrorResult('Could not authenticate with Moku API');
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const result = buildErrorResult(`Could not connect to Moku API (${msg})`);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  // Step 2: fetch assistants (agents) list
  let agents;
  try {
    const agentsResponse = await fetch(`${mokuApiUrl}/api/v1/agents`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!agentsResponse.ok) {
      const text = await agentsResponse.text();
      const message =
        text && text.trim().length > 0
          ? `Error getting list of assistants (${agentsResponse.status} ${text})`
          : `Error getting list of assistants (${agentsResponse.status})`;
      const result = buildErrorResult(message);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }

    agents = await agentsResponse.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const result = buildErrorResult(`Could not connect to Moku API (${msg})`);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(agents) || agents.length === 0) {
    const result = buildErrorResult('No assistants were returned');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  const assistants = [];
  const missingNames = [];
  const noModelNames = [];

  for (const name of assistantNames) {
    const agent = agents.find((a) => a && typeof a.name === 'string' && a.name === name);

    if (!agent || !agent.urlSlug) {
      missingNames.push(name);
      continue;
    }

    const modelsArray = Array.isArray(agent.models) ? agent.models : [];
    const modelNames = modelsArray
      .map((m) => (m && typeof m.name === 'string' ? m.name : null))
      .filter(Boolean);

    if (modelNames.length === 0) {
      noModelNames.push(name);
    }

    assistants.push({
      id: agent.id,
      name: agent.name,
      slug: agent.urlSlug,
      models: {
        count: modelNames.length,
        names: modelNames,
      },
    });
  }

  const errorMessages = [];

  if (missingNames.length > 0) {
    errorMessages.push(
      `All required assistants were not found. Missing ones are: ${missingNames.join(', ')}`,
    );
  }

  if (noModelNames.length > 0) {
    errorMessages.push(`All/some Assistants have no available models: ${noModelNames.join(', ')}`);
  }

  const result = {
    success: errorMessages.length === 0,
    errorMessage: errorMessages.join(' | '),
    assistants,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.success) {
    process.exitCode = 1;
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  const result = buildErrorResult(`Unexpected error: ${message}`);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
});
