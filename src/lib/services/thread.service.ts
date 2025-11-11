import type { Thread } from '../../../src-electron/preload.js';
import { threads } from '../stores/thread.store.js';
import type { Message } from '$lib/types/thread.type.js';

class ThreadService {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for real-time updates
    window.electronAPI.thread.onThreadCreated((thread) => {
      threads.addThread(thread);
    });

    window.electronAPI.thread.onThreadUpdated((thread) => {
      threads.updateThread(thread);
    });

    window.electronAPI.thread.onThreadDeleted((threadId) => {
      threads.deleteThread(threadId);
    });
  }

  async getAll(): Promise<Thread[]> {
    const allThreads = await window.electronAPI.thread.getAll();
    threads.setThreads(allThreads);
    return allThreads;
  }

  async create(data: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>): Promise<Thread> {
    return window.electronAPI.thread.create(data);
  }

  async update(id: string, updates: Partial<Thread>): Promise<Thread> {
    return window.electronAPI.thread.update(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return window.electronAPI.thread.delete(id);
  }

  async softDelete(id: string): Promise<boolean> {
    return window.electronAPI.thread.softDelete(id);
  }

  async getMessages(id: string): Promise<Message[]> {
    return window.electronAPI.thread.getMessages(id);
  }

	async appendMessage(
		threadId: string,
		payload: {
			role: 'user' | 'assistant' | 'system';
			content: string;
			metadata?: Record<string, unknown>;
			clientMessageId?: string;
		},
	): Promise<
		| { success: true; message: { id: string; role: string; content: string; createdAt: number }; thread: Thread }
		| { success: false; status: number; error: string; threadId?: string }
	> {
		type AppendWire = {
			role: 'user' | 'assistant' | 'system';
			content: string;
			metadata?: Record<string, unknown>;
		} & Record<string, unknown>;
		const wirePayload: AppendWire = {
			role: payload.role,
			content: payload.content,
			metadata: payload.metadata,
		};
		if (typeof payload.clientMessageId === 'string' && payload.clientMessageId.length > 0) {
			(wirePayload as Record<string, unknown>).client_message_id = payload.clientMessageId;
		}
		const res: unknown = await window.electronAPI.thread.appendMessage(threadId, wirePayload);
		if (typeof res === 'object' && res !== null && (res as { success?: boolean }).success === true) {
			return res as {
				success: true;
				message: { id: string; role: string; content: string; createdAt: number };
				thread: Thread;
			};
		}
		const failure = res as { status: number; error: string } & Record<string, unknown>;
		let threadIdCamel: string | undefined;
		const maybeThreadId = (failure as Record<string, unknown>).thread_id;
		if (typeof maybeThreadId === 'string') {
			threadIdCamel = maybeThreadId;
		}
		return { success: false, status: failure.status, error: failure.error, threadId: threadIdCamel };
	}

	async updateMessage(
		threadId: string,
		messageId: string,
		newContent: string,
	): Promise<
		| { success: true; message: Message; thread: Thread }
		| { success: false; error: string }
	> {
		const res: unknown = await window.electronAPI.thread.updateMessage(threadId, messageId, newContent);
		return res as
			| { success: true; message: Message; thread: Thread }
			| { success: false; error: string };
	}

	async getMessageVersions(
		threadId: string,
		messageId: string,
	): Promise<
		| { success: true; versions: Array<{ content: string; editedAt: number }> }
		| { success: false; error: string }
	> {
		const res: unknown = await window.electronAPI.thread.getMessageVersions(threadId, messageId);
		return res as
			| { success: true; versions: Array<{ content: string; editedAt: number }> }
			| { success: false; error: string };
	}

	async deleteMessagesAfter(
		threadId: string,
		messageId: string,
	): Promise<
		| { success: true; thread: Thread }
		| { success: false; error: string }
	> {
		const res: unknown = await window.electronAPI.thread.deleteMessagesAfter(threadId, messageId);
		return res as
			| { success: true; thread: Thread }
			| { success: false; error: string };
	}

  async moveToProject(
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ): Promise<Thread> {
    return window.electronAPI.thread.moveToProject(threadId, targetProjectId, options);
  }
}

export const threadService = new ThreadService();
