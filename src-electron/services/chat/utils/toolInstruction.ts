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
    'When the user asks to read, create, or modify files, use the appropriate tool.',
    '',
    'Tool calling format:',
    '{"tool": "tool_name", "input": {...}}',
    '',
    'RULES:',
    '- Call tools immediately without asking permission',
    '- For write_file: Put COMPLETE content in the "content" field (no placeholders or "...")',
    '- When calling a tool, respond ONLY with the JSON (nothing else)',
    '- After tool execution, you will receive the result',
    '- Then provide a natural response to the user based on the result',
    '- NEVER mention tools, JSON, or technical details in your user-facing response',
    '- For non-file questions, respond normally',
    '',
    toolDescriptions ? `Tools:\n${toolDescriptions}` : '',
  ].join('\n');
}
