/**
 * Composer Content Types
 *
 * Shared types for the Composer document editing feature.
 * Used by both the main (electron) and renderer processes.
 */

/**
 * Parsed content from a <composer> tag in an AI response.
 * Attached to assistant messages after parsing so the composer pane
 * can display the document without re-parsing the raw content.
 */
export interface ComposerContent {
  /** Artifact ID from the id attribute */
  id: string;
  /** Document title / filename from the title attribute */
  title: string;
  /** MIME type of the document content */
  mimeType: string;
  /** The full document content inside the <composer> tags */
  content: string;
  /** 3-7 word summary of the changes or request for this version */
  versionDescription?: string;
  /** Artifact version ID assigned after the version is persisted (for card click navigation) */
  versionId?: number;
}

/**
 * Result of parsing an AI response for <composer> tags.
 */
export interface ComposerParseResult {
  /** The extracted composer content, or null if no <composer> tag found */
  composer: ComposerContent | null;
  /** The message content with the <composer> block removed (summary + description only) */
  strippedContent: string;
}
