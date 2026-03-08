/**
 * Monitored fetch wrapper for Moku API calls.
 *
 * Drop-in replacement for `fetch()` that records success/failure
 * to the Moku API InterfaceMonitor via the InterfaceStatusRegistry.
 *
 * Usage: replace `fetch(url, init)` with `mokuFetch(url, init)` in Moku API services.
 */

import { interfaceStatusRegistry } from './interface-status-registry.js';

export async function mokuFetch(
  url: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  let monitor;
  try {
    monitor = interfaceStatusRegistry.getMonitor('moku-api');
  } catch {
    // Registry not yet initialized (e.g., during early startup). Fall through to native fetch.
    return fetch(url, init);
  }

  try {
    const response = await fetch(url, init);
    if (response.ok) {
      monitor.recordSuccess();
    } else {
      monitor.recordError(response.status, `HTTP ${response.status}`);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    monitor.recordError(-1, message);
    throw error;
  }
}
