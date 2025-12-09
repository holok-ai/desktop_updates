import type { ToolDefinition } from '../../file-tools.service.js';

export function formatToolDescriptions(tools: ToolDefinition[]): string {
  return tools
    .map((tool) => {
      const params =
        tool.input_schema?.properties && Object.keys(tool.input_schema.properties).length > 0
          ? JSON.stringify(tool.input_schema.properties, null, 2)
          : '{}';
      return `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${params}`;
    })
    .join('\n\n');
}

export function buildToolInstructionPrompt(toolDescriptions: string): string {
  return [
    'You can inspect and modify project files using special tools.',

    'CRITICAL RULES:',
    '1. When user asks to create/read/modify a file, IMMEDIATELY call the tool - do NOT ask for permission first',
    '2. For file content: Generate the COMPLETE, ACTUAL content that should be written to the file',
    '   - CRITICAL: Put the FULL content in the "content" field of the tool call JSON, NOT in your response text',
    '   - Generate the actual content based on what the user requests - if they ask for specific content, include it all',
    '   - NEVER use placeholders like "...", "etc", or "and so on" in the "content" field',
    '   - The "content" field must contain the EXACT text that should be in the file',
    '   - Generate complete, usable content - do not summarize or truncate the actual content',
    '3. When you need to use a tool, respond ONLY with JSON in this shape:',
    '   {"tool": "tool_name", "input": { ... }}',
    '   Do not add any text outside this JSON.',
    '4. After calling a tool, you will receive a result starting with:',
    '   - "TOOL SUCCEEDED" - operation worked',
    '   - "TOOL FAILED" - operation failed',
    '',
    '- NEVER explain how tools work.',
    '- NEVER include tool-related text in your response unless a tool operation fails.',
    '- For non-file questions, respond normally without using any tools.',
    '',
    'Response rules after receiving tool result:',
    '1. CRITICAL: Only say "I\'ve created the file" if you see "TOOL SUCCEEDED"',
    '   - If you see "TOOL SUCCEEDED - File created successfully at [path]":',
    '     → Tell user: "I\'ve created the file [exact path from result]"',
    '   - If you see "TOOL FAILED", NEVER say the file was created',
    '2. If you see "TOOL FAILED - File already exists: [path] already exists":',
    '   → Tell user: "The file [exact path from result] already exists. Would you like me to overwrite it?"',
    '   → You MUST include the full file path in your response',
    '   → Do NOT just say "Would you like me to overwrite the file?" without mentioning which file',
    '   → Do NOT create the file again without user confirmation',
    '3. If you see any other "TOOL FAILED":',
    '   → Tell user exactly what failed (use exact error message)',
    '4. NEVER ask for permission before calling a tool',
    '5. NEVER say "Would you like me to proceed with creating" - just call the tool',
    '6. CRITICAL: NEVER include JSON in your response to the user',
    '   - Do NOT show {"tool": "...", "path": "...", "content": "..."}',
    '   - Do NOT show any JSON objects in your natural language response',
    '   - Your response must be ONLY natural language text',
    '7. Use EXACT file paths from tool results, never guess',
    '8. Respond in natural language (not JSON) after tool results',
    '9. Continue the conversation naturally after finishing the action',
    toolDescriptions ? `Available tools:\n\n${toolDescriptions}` : 'No tools available.',
  ].join('\n\n');
}

