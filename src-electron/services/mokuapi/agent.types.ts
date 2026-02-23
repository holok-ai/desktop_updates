import { ModelReference } from './application.types.js';

export interface AgentListItem {
  id: string; // UUID
  name: string; // Application name
  description: string; // Auto-generated: "Chat application powered by {provider}"
  urlSlug: string; // URL slug for the application
  provider: string; // Provider name (e.g., "OpenAI", "Anthropic")
  model: string; // API model identifier (e.g., "gpt-4", "claude-3-opus-20240229")
  models: ModelReference[];
  systemPromptName: string | null; // System prompt name
  teamName: string | null; // Team name
  active: boolean; // Whether the agent is active
}

// export interface AgentChatConfig {
//   id: string; // UUID
//   name: string; // Application name
//   url: string; // Full agent URL for API calls
//   provider: string; // Provider type (lowercase: "openai", "anthropic")
//   model: string; // API model identifier (e.g., "gpt-4")
//   systemPrompt: string; // Full system prompt text
//   apiKey: string; // JWT token for authentication
// }
