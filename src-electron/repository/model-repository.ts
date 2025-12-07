import { mokuService } from '../services/mokuapi/moku.service.js';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import log from 'electron-log';

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

  public getModel(provider: string, model: string): ModelConfig | undefined {
    return this.models.find((m) => m.provider === provider && m.id === model);
  }

  public getHoloApiUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuApiUrl();
  }
  
  public async listAll(): Promise<ModelConfig[]> {
    // Fetch applications from Moku and log them
    try {
      const applications = await mokuService.getAllApplications();
      log.info('[ModelRepository] Applications from Moku:');
      applications.forEach((app) => {
        const models = Array.from(app.modelNames).join(', ');
        log.info(`  ${app.providerName}: ${models}`);
      });
    } catch (error) {
      log.error('[ModelRepository] Failed to fetch applications from Moku:', error);
    }

    return [...this.models]; // Return copy
  }
}

// Singleton instance
export const modelRepository = new ModelRepository();
