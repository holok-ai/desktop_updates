import type { ChatRequest, ChatMessage } from '@holokai/chat-component';
import type { Attachment } from '../../../src-shared/types/attachment.types.js';

/**
 * Desktop-specific chat message with attachment support
 */
export interface DesktopChatMessage extends ChatMessage {
    attachments?: Attachment[];
}

/**
 * Desktop-specific chat request with thread tracking
 * Extends chat-component ChatRequest with desktop-specific fields
 */
export interface DesktopChatRequest extends ChatRequest {
    messages: DesktopChatMessage[];
    thread_id?: string;
    branch_id?: string;
    working_directory?: string; // For file tools operations
}
