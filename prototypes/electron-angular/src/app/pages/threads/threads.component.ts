import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ThreadService } from '../../core/services/thread.service';
import { Thread } from '../../../../src-electron/preload';
import { Subscription } from 'rxjs';

/**
 * Threads Component
 * 
 * This component demonstrates the complete IPC architecture:
 * - Component -> Service -> ElectronService -> Context Bridge -> IPC -> Main Process
 * - Real-time updates via event broadcasting
 * - CRUD operations for threads
 * - Reactive state management with RxJS
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ToastModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './threads.component.html',
  styleUrls: ['./threads.component.css']
})
export class ThreadsComponent implements OnInit, OnDestroy {
  threads: Thread[] = [];
  loading = false;
  error: string | null = null;

  // Dialog state
  displayDialog = false;
  isEditMode = false;
  selectedThread: Thread | null = null;

  // Form data
  threadForm = {
    title: '',
    description: '',
    status: 'active' as 'active' | 'archived' | 'deleted'
  };

  statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' },
    { label: 'Deleted', value: 'deleted' }
  ];

  private subscriptions = new Subscription();

  constructor(
    private threadService: ThreadService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // Subscribe to threads observable
    this.subscriptions.add(
      this.threadService.threads$.subscribe(threads => {
        this.threads = threads;
      })
    );

    // Subscribe to loading state
    this.subscriptions.add(
      this.threadService.loading$.subscribe(loading => {
        this.loading = loading;
      })
    );

    // Subscribe to errors
    this.subscriptions.add(
      this.threadService.error$.subscribe(error => {
        this.error = error;
        if (error) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error
          });
        }
      })
    );

    // Listen for menu commands from Electron
    if ((window as any).electronAPI) {
      this.setupMenuListeners();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Setup listeners for Electron menu commands
   */
  private setupMenuListeners(): void {
    // Listen for "New Thread" menu command
    const cleanupNewThread = (window as any).electronAPI.onMenuCommand('menu:new-thread', () => {
      this.openCreateDialog();
    });
    this.subscriptions.add({ unsubscribe: cleanupNewThread });

    // Listen for "Refresh" menu command
    const cleanupRefresh = (window as any).electronAPI.onMenuCommand('menu:refresh', () => {
      this.refreshThreads();
    });
    this.subscriptions.add({ unsubscribe: cleanupRefresh });
  }

  /**
   * Open dialog to create a new thread
   */
  openCreateDialog(): void {
    this.isEditMode = false;
    this.selectedThread = null;
    this.threadForm = {
      title: '',
      description: '',
      status: 'active'
    };
    this.displayDialog = true;
  }

  /**
   * Open dialog to view a thread (read-only)
   */
  viewThread(thread: Thread): void {
    // For now, just open edit dialog in view mode
    // In a real app, you might have a separate view-only dialog
    this.openEditDialog(thread);
  }

  /**
   * Open dialog to edit an existing thread
   */
  openEditDialog(thread: Thread): void {
    this.isEditMode = true;
    this.selectedThread = thread;
    this.threadForm = {
      title: thread.title,
      description: thread.description,
      status: thread.status
    };
    this.displayDialog = true;
  }

  /**
   * Save thread (create or update)
   */
  async saveThread(): Promise<void> {
    try {
      if (this.isEditMode && this.selectedThread) {
        // Update existing thread
        await this.threadService.updateThread(this.selectedThread.id, this.threadForm);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Thread updated successfully'
        });
      } else {
        // Create new thread
        await this.threadService.createThread(this.threadForm);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Thread created successfully'
        });
      }
      this.displayDialog = false;
    } catch (error) {
      console.error('Error saving thread:', error);
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(thread: Thread): Promise<void> {
    if (confirm(`Are you sure you want to delete "${thread.title}"?`)) {
      try {
        await this.threadService.deleteThread(thread.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Thread deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting thread:', error);
      }
    }
  }

  /**
   * Refresh threads from main process
   */
  async refreshThreads(): Promise<void> {
    await this.threadService.loadThreads();
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'archived':
        return 'status-archived';
      case 'deleted':
        return 'status-deleted';
      default:
        return '';
    }
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }
}
