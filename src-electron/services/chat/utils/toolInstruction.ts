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
    'You can modify files using the write_file tool function.',

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
    toolDescriptions ? `Available tools:\n\n${toolDescriptions}` : 'No tools available.',
  ].join('\n\n');
}

