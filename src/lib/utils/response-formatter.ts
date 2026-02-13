/**
 * Response Formatter Utility
 *
 * Formats API responses from different providers to extract clean text content
 * for display in the chat UI.
 */

/**
 * Format Claude/Anthropic API response content
 * Claude returns content as an array of objects with type and text fields
 * Example: [{"type":"text","text":"Hello world"}]
 * We extract just the text value from the content array
 */
function formatAnthropicResponse(content: unknown): string {
  // If it's already a plain string, return it
  if (typeof content === 'string') {
    // Check if the string is actually JSON that needs parsing
    if (content.startsWith('[') || content.startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        return formatAnthropicResponse(parsed); // Recursively format the parsed content
      } catch {
        // Not valid JSON, return as-is
        return content;
      }
    }
    return content;
  }

  // Handle array of content blocks
  if (Array.isArray(content)) {
    return content
      .filter((item) => item && item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n\n');
  }

  // Handle full Anthropic API response object with content array
  if (content && typeof content === 'object' && 'content' in content) {
    const obj = content as { content: unknown };
    return formatAnthropicResponse(obj.content); // Recursively format the content field
  }

  // Handle single content object with text property
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as { text: string }).text);
  }

  // Fallback: if we got here with an object, stringify it to see what it contains
  if (content && typeof content === 'object') {
    console.warn('[response-formatter] Unexpected object format:', content);
    return JSON.stringify(content);
  }

  return String(content || '');
}

/**
 * Format response content based on provider and model ID
 * @param content - Raw content from API response
 * @param provider - Provider name (claude, anthropic, openai, etc.)
 * @param modelId - Optional model ID to help identify the provider
 * @returns Formatted text content
 */
export function formatResponseContent(content: unknown, provider: string, modelId?: string): string {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModelId = (modelId || '').toLowerCase();

  // Check if this is a Claude/Anthropic model
  const isClaudeModel =
    normalizedProvider === 'claude' ||
    normalizedProvider === 'anthropic' ||
    normalizedModelId.includes('claude-');

  if (isClaudeModel) {
    return formatAnthropicResponse(content);
  }

  // Default: pass through as-is (convert to string if needed)
  if (typeof content === 'string') {
    return content;
  }
  return String(content || '');
}
