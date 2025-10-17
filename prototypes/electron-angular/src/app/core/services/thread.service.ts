import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { ElectronService } from './electron.service';
import { Thread } from '../../../../src-electron/preload';

/**
 * Thread Service
 * 
 * This service demonstrates the pattern for creating renderer services that
 * communicate with the main process via IPC. It provides:
 * 
 * 1. Type-safe IPC communication using the ElectronService
 * 2. Observable-based state management for reactive UI updates
 * 3. Event subscription handling with proper cleanup
 * 4. CRUD operations for threads
 * 
 * Architecture Pattern:
 * Component -> Service -> ElectronService -> Context Bridge -> IPC -> Main Process
 */
@Injectable({
  providedIn: 'root'
})
export class ThreadService implements OnDestroy {
  // State management using BehaviorSubject for reactive updates
  private threadsSubject = new BehaviorSubject<Thread[]>([]);
  public threads$ = this.threadsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // Event subscription cleanup functions
  private cleanupFunctions: Array<() => void> = [];

  constructor(private electronService: ElectronService) {
    // Subscribe to thread events from main process
    this.setupEventListeners();
    
    // Load initial data
    this.loadThreads();
  }

  /**
   * Setup event listeners for real-time updates from main process
   */
  private setupEventListeners(): void {
    if (!this.electronService.isElectron) {
      console.warn('Not in Electron, skipping event listeners');
      return;
    }

    // Listen for thread creation events
    const cleanupCreated = this.electronService.api.thread.onThreadCreated((thread) => {
      console.log('Thread created event received:', thread);
      const currentThreads = this.threadsSubject.value;
      
      // Check if thread already exists (to avoid duplicates)
      if (!currentThreads.find(t => t.id === thread.id)) {
        this.threadsSubject.next([...currentThreads, thread]);
      }
    });
    this.cleanupFunctions.push(cleanupCreated);

    // Listen for thread update events
    const cleanupUpdated = this.electronService.api.thread.onThreadUpdated((thread) => {
      console.log('Thread updated event received:', thread);
      const currentThreads = this.threadsSubject.value;
      const updatedThreads = currentThreads.map(t => 
        t.id === thread.id ? thread : t
      );
      this.threadsSubject.next(updatedThreads);
    });
    this.cleanupFunctions.push(cleanupUpdated);

    // Listen for thread deletion events
    const cleanupDeleted = this.electronService.api.thread.onThreadDeleted((threadId) => {
      console.log('Thread deleted event received:', threadId);
      const currentThreads = this.threadsSubject.value;
      const filteredThreads = currentThreads.filter(t => t.id !== threadId);
      this.threadsSubject.next(filteredThreads);
    });
    this.cleanupFunctions.push(cleanupDeleted);
  }

  /**
   * Load all threads from the main process
   */
  public async loadThreads(): Promise<void> {
    if (!this.electronService.isElectron) {
      this.errorSubject.next('Not running in Electron environment');
      return;
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const threads = await this.electronService.api.thread.getAll();
      this.threadsSubject.next(threads);
    } catch (error) {
      console.error('Error loading threads:', error);
      this.errorSubject.next('Failed to load threads');
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Get a thread by ID
   */
  public getThreadById(id: string): Observable<Thread | null> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    return from(this.electronService.api.thread.getById(id));
  }

  /**
   * Create a new thread
   */
  public async createThread(
    threadData: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Thread> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const newThread = await this.electronService.api.thread.create(threadData);
      
      // Note: The thread will be added to the list via the event listener
      // This demonstrates how events keep multiple windows in sync
      
      return newThread;
    } catch (error) {
      console.error('Error creating thread:', error);
      this.errorSubject.next('Failed to create thread');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Update a thread
   */
  public async updateThread(id: string, updates: Partial<Thread>): Promise<Thread> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const updatedThread = await this.electronService.api.thread.update(id, updates);
      
      // Note: The thread will be updated in the list via the event listener
      
      return updatedThread;
    } catch (error) {
      console.error('Error updating thread:', error);
      this.errorSubject.next('Failed to update thread');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Delete a thread
   */
  public async deleteThread(id: string): Promise<boolean> {
    if (!this.electronService.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const deleted = await this.electronService.api.thread.delete(id);
      
      // Note: The thread will be removed from the list via the event listener
      
      return deleted;
    } catch (error) {
      console.error('Error deleting thread:', error);
      this.errorSubject.next('Failed to delete thread');
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Cleanup subscriptions when service is destroyed
   */
  ngOnDestroy(): void {
    this.cleanupFunctions.forEach(cleanup => cleanup());
  }
}
