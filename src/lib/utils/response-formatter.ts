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
        const parsed = JSON.parse(content) as unknown;
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
      .filter((item): item is { type: string; text: string } => {
        if (typeof item !== 'object' || item === null) {
          return false;
        }
        const obj = item as Record<string, unknown>;
        return (
          'type' in obj && obj.type === 'text' && 'text' in obj && typeof obj.text === 'string'
        );
      })
      .map((item) => item.text)
      .join('\n\n');
  }

  // Handle full Anthropic API response object with content array
  if (content !== null && typeof content === 'object' && 'content' in content) {
    const obj = content as { content: unknown };
    return formatAnthropicResponse(obj.content); // Recursively format the content field
  }

  // Handle single content object with text property
  if (content !== null && typeof content === 'object' && 'text' in content) {
    return String((content as { text: string }).text);
  }

  // Fallback: if we got here with an object, stringify it to see what it contains
  if (content !== null && typeof content === 'object') {
    console.warn('[response-formatter] Unexpected object format:', content);
    return JSON.stringify(content);
  }

  // At this point, content is a primitive (string, number, boolean, null, undefined)
  if (content === null || content === undefined) {
    return '';
  }

  // Content must be a number or boolean at this point
  return String(content as string | number | boolean);
}

/**
 * Format response content based on provider and model ID
 * @param content - Raw content from API response
 * @param provider - Provider name (claude, anthropic, openai, etc.)
 * @param modelId - Optional model ID to help identify the provider
 * @returns Formatted text content
 */
export function formatResponseContent(
  content: unknown,
  provider: string,
  modelId?: string,
): string {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModelId = (modelId ?? '').toLowerCase();

  let result: string;

  // Check if this is a Claude/Anthropic model
  const isclaudeModel =
    normalizedProvider === 'claude' ||
    normalizedProvider === 'anthropic' ||
    normalizedModelId.includes('claude-');

  if (isclaudeModel) {
    result = formatAnthropicResponse(content);
  } else if (typeof content === 'string') {
    result = content;
  } else if (content === null || content === undefined) {
    result = '';
  } else if (typeof content === 'object') {
    result = JSON.stringify(content);
  } else {
    result = String(content as string | number | boolean);
  }

  return result;
}
