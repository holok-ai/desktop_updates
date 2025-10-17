import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

/**
 * Menu Navigation Service
 * 
 * Centralizes all menu command handling, acting as an "interceptor" between
 * Electron menu events and Angular Router navigation. This service ensures
 * that components remain menu-agnostic and only need to handle route-based
 * activation.
 * 
 * Key Responsibilities:
 * - Listen to all menu events from main process
 * - Translate menu commands into router navigation
 * - Decide whether to navigate or refresh current route
 * - Pass state to components via router state when needed
 * 
 * Pattern: Components never listen to menu events directly. The
 * MenuNavigationService handles all menu logic, and components simply
 * respond to route activation (ngOnInit).
 */
@Injectable({ providedIn: 'root' })
export class MenuNavigationService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private router: Router) {
    console.log('MenuNavigationService: Initializing menu handlers');
    this.initializeAllMenuHandlers();
  }

  /**
   * Initialize all menu event handlers
   * Called once at app startup via APP_INITIALIZER
   */
  private initializeAllMenuHandlers(): void {
    this.setupFileMenuHandlers();
    this.setupEditMenuHandlers();
    this.setupViewMenuHandlers();
    this.setupNavigationHandlers();
  }

  /**
   * File Menu Handlers
   * Handles: New, Open, Get Threads, Settings, etc.
   */
  private setupFileMenuHandlers(): void {
    // Note: In prototype, menu events are simulated
    // In production, these would come from:
    // window.electron.menu.onGetThreads(() => { ... });

    console.log('MenuNavigationService: File menu handlers registered');
    
    // Example implementation would be:
    // window.electron.menu.onGetThreads(() => {
    //   this.navigateOrRefresh('/threads');
    // });
    
    // window.electron.menu.onNewThread(() => {
    //   this.router.navigate(['/threads'], {
    //     state: { openCreateDialog: true }
    //   });
    // });
    
    // window.electron.menu.onSettings(() => {
    //   this.router.navigate(['/settings']);
    // });
  }

  /**
   * Edit Menu Handlers
   * Handles: Copy, Paste, etc.
   */
  private setupEditMenuHandlers(): void {
    console.log('MenuNavigationService: Edit menu handlers registered');
    
    // Example:
    // window.electron.menu.onCopy(() => {
    //   document.execCommand('copy');
    // });
  }

  /**
   * View Menu Handlers
   * Handles: Refresh, Toggle views, etc.
   */
  private setupViewMenuHandlers(): void {
    console.log('MenuNavigationService: View menu handlers registered');
    
    // Example:
    // window.electron.menu.onRefresh(() => {
    //   this.reloadCurrentRoute();
    // });
  }

  /**
   * Navigation Handlers
   * Handles: Generic navigate commands from menu
   */
  private setupNavigationHandlers(): void {
    console.log('MenuNavigationService: Navigation handlers registered');
    
    // Example:
    // window.electron.menu.onNavigate((path: string) => {
    //   this.router.navigateByUrl(path);
    // });
  }

  /**
   * Navigate to route or refresh if already there
   * 
   * Pattern: This method implements smart navigation logic:
   * - If already on the target route, reload it (triggers ngOnInit again)
   * - If on different route, navigate normally
   * 
   * @param path The route path to navigate to
   */
  private navigateOrRefresh(path: string): void {
    if (this.router.url === path) {
      console.log(`MenuNavigationService: Already on ${path}, reloading...`);
      this.reloadCurrentRoute();
    } else {
      console.log(`MenuNavigationService: Navigating to ${path}`);
      this.router.navigate([path]);
    }
  }

  /**
   * Reload the current route
   * 
   * Pattern: This forces Angular to re-instantiate the component,
   * triggering ngOnInit and resolvers to run again.
   * 
   * Implementation:
   * 1. Navigate to empty route (skipLocationChange prevents URL change)
   * 2. Navigate back to original route
   * 3. Component is destroyed and recreated
   */
  private reloadCurrentRoute(): void {
    const currentUrl = this.router.url;
    console.log(`MenuNavigationService: Reloading route ${currentUrl}`);
    
    this.router.navigateByUrl('/', { skipLocationChange: true })
      .then(() => {
        this.router.navigateByUrl(currentUrl);
      });
  }

  /**
   * Navigate with state
   * Useful for passing data to component without route params
   * 
   * @param path Route path
   * @param state State object to pass to component
   */
  private navigateWithState(path: string, state: any): void {
    console.log(`MenuNavigationService: Navigating to ${path} with state`, state);
    this.router.navigate([path], { state });
  }

  /**
   * Public API for programmatic menu actions
   * These can be called by components if needed (rare)
   */

  /**
   * Programmatically trigger "Get Threads" action
   * Used if component needs to simulate menu action
   */
  public triggerGetThreads(): void {
    this.navigateOrRefresh('/threads');
  }

  /**
   * Programmatically trigger "Refresh" action
   */
  public triggerRefresh(): void {
    this.reloadCurrentRoute();
  }

  /**
   * Get current route URL
   * Useful for menu state synchronization
   */
  public getCurrentRoute(): string {
    return this.router.url;
  }

  ngOnDestroy(): void {
    console.log('MenuNavigationService: Cleaning up');
    this.destroy$.next();
    this.destroy$.complete();
  }
}
