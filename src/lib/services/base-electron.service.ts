/**
 * Base class for Electron IPC services
 * Provides common functionality for event listener management and singleton pattern
 */
export abstract class BaseElectronService {
  private static instances: Map<string, BaseElectronService> = new Map();
  protected unsubscribes: (() => void)[] = [];

  /**
   * Protected constructor enforces singleton pattern
   * Subclasses must implement initializeEventListeners()
   */
  protected constructor() {
    this.initializeEventListeners();
  }

  /**
   * Get or create singleton instance of the service
   * Uses class name as key to support multiple service types
   */
  protected static getSingletonInstance<T extends BaseElectronService>(this: new () => T): T {
    const className = this.name;

    if (!BaseElectronService.instances.has(className)) {
      BaseElectronService.instances.set(className, new this());
    }

    return BaseElectronService.instances.get(className) as T;
  }

  /**
   * Initialize event listeners for this service
   * Must be implemented by subclasses
   */
  protected abstract initializeEventListeners(): void;

  /**
   * Clean up all event listener subscriptions
   * Call this when the service is no longer needed (e.g., app shutdown)
   */
  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
  }

  /**
   * Register an unsubscribe function for cleanup
   * @param unsub Function to call during cleanup
   */
  protected registerCleanup(unsub: () => void): void {
    this.unsubscribes.push(unsub);
  }
}
