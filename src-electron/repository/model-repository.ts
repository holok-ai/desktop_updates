interface ModelConfig {
  id: string;
  provider: string;
  title: string;
  available: boolean;
  default?: boolean;
  url?: string;
  createdAt: number;
}

export class ModelRepository {
  private readonly models: ModelConfig[] = [];

  constructor() {
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    this.models.push(
      {
        id: 'llama3:latest',
        provider: 'ollama',
        title: 'llama3:latest (ollama)',
        available: true,
        default: true,
        url: 'http://localhost:11434',
        createdAt: Date.now(),
      },
      {
        id: 'claude-opus-4-5-20251101',
        provider: 'claude',
        title: 'claude-opus-4-5-20251101 (claude)',
        available: true,
        url: 'http://localhost:3000/api/custom/claude/9d13a116/',
        createdAt: Date.now(),
      }
    );
  }

  public listAll(): ModelConfig[] {
    return [...this.models]; // Return copy
  }
}

// Singleton instance
export const modelRepository = new ModelRepository();
