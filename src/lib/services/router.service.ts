import { writable, type Writable } from 'svelte/store';
import { ROUTE } from '../constants/route.constant';

export type RouteEntry = {
  path: string;
  params: URLSearchParams;
};

class HashRouterService {
  public readonly current: Writable<RouteEntry>;
  private started = false;

  constructor() {
    this.current = writable(this.parseLocation());
  }

  public start(): void {
    if (this.started) {
        return;
    };
    this.started = true;

    // Sync initial route
    this.syncInvalidToHome();
    this.current.set(this.parseLocation());

    // Listen for hash changes (back/forward and external changes)
    globalThis.addEventListener('hashchange', () => {
      this.current.set(this.parseLocation());
    });
  }

  public navigate(path: string, params?: Record<string, string>, options?: { replace?: boolean }): void {
    const search = params !== null && params !== undefined && Object.keys(params).length > 0
      ? `?${new URLSearchParams(params).toString()}`
      : '';
    const target = `#${path}${search}`;

    const { hash } = globalThis.location;
    if (typeof hash === 'string' && hash === target) {
      return;
    }

    if (options?.replace === true) {
      globalThis.location.replace(target);
    } else {
      globalThis.location.hash = `${path}${search}`;
    }
  }

  private parseLocation(): RouteEntry {
    const path = this.getPathWithoutHash();
    const [pathPart, query = ''] = path.split('?');
    const params = new URLSearchParams(query);

    // Gracefully handle invalid routes by redirecting to home
    const validPaths = new Set<string>(Object.values(ROUTE));
    const normalizedPath = typeof pathPart === 'string' && pathPart.length > 0 ? pathPart : ROUTE.HOME;
    if (!validPaths.has(normalizedPath)) {
      globalThis.location.replace(`#${ROUTE.HOME}`);
      return { path: ROUTE.HOME, params: new URLSearchParams() };
    }

    return { path: normalizedPath, params };
  }

  private syncInvalidToHome(): void {
    const path = this.getPathWithoutHash();
    const validPaths  = new Set<string>(Object.values(ROUTE));
    if (path.length > 0 && !validPaths.has(path)) {
      globalThis.location.replace(`#${ROUTE.HOME}`);
    }
  }

  private getPathWithoutHash(): string {
    const { hash } = globalThis.location;
    const raw = typeof hash === 'string' ? hash : '';
    const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
    return withoutHash;
  }
}

export const router = new HashRouterService();


