# Chat Configuration Guide

## Running Ollama with Docker

### 1. Pull and Run Ollama Docker Container

```bash
# Pull the Ollama image
docker pull ollama/ollama

# Run Ollama container
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

**What this does:**
- `-d`: Runs container in detached mode (background)
- `-v ollama:/root/.ollama`: Creates a volume to persist models
- `-p 11434:11434`: Maps port 11434 (Ollama's default port)
- `--name ollama`: Names the container "ollama"

### 2. Install llama3:latest Model

```bash
# Execute command inside the running container
docker exec -it ollama ollama pull llama3:latest
```

This downloads the llama3:latest model (~4.7GB). The download may take several minutes depending on your internet connection.

### 3. Verify Installation

```bash
# List installed models
docker exec -it ollama ollama list

# Test the model
docker exec -it ollama ollama run llama3:latest "Hello, how are you?"
```

### 4. Stop/Start Container

```bash
# Stop container
docker stop ollama

# Start container
docker start ollama

# View logs
docker logs ollama
```

## How the Desktop App Uses Ollama

### Architecture Overview

```
Desktop App (Electron + Svelte)
    ↓
ChatService (src-electron/services/chat/ChatService.ts)
    ↓
ChatProviderFactory (creates provider based on type)
    ↓
OllamaChatProvider (src-electron/services/chat/providers/OllamaChatProvider.ts)
    ↓
Ollama SDK (ollama npm package)
    ↓
HTTP Request → http://localhost:11434
    ↓
Ollama Docker Container
    ↓
llama3:latest Model
```

### Configuration

The app is currently configured to use:
- **Provider**: Ollama
- **URL**: `http://localhost:11434`
- **Model**: `llama3:latest`
- **API Key**: `"ollama"` (placeholder, not required by Ollama)

These settings are hardcoded in `ChatPane.svelte` (lines 23-29):

```typescript
const result = await window.electronAPI.chat.createProvider(
  'ollama',
  {
    url: 'http://localhost:11434',
    apiKey: 'ollama',
    model: 'llama3:latest'
  }
);
```

### Streaming Flow

1. **User sends message** via Composer component
2. **ChatPane.sendMessage()** called with user input
3. **IPC call** to main process: `window.electronAPI.chat.chat(request)`
4. **Main process** (chat-handler.ts) forwards to ChatService
5. **ChatService** calls OllamaChatProvider with streaming enabled
6. **OllamaChatProvider** uses Ollama SDK to stream tokens
7. **Tokens stream back** through IPC: `event.sender.send('chat:token', token)`
8. **Renderer receives tokens** via `window.electronAPI.chat.onToken(callback)`
9. **UI updates** in real-time as each token arrives

### Key Files

- **Chat Service**: `src-electron/services/chat/ChatService.ts`
- **Ollama Provider**: `src-electron/services/chat/providers/OllamaChatProvider.ts`
- **IPC Handlers**: `src-electron/ipc-handlers/chat-handler.ts`
- **Preload API**: `src-electron/preload.ts` (ChatAPI interface)
- **UI Components**:
  - `src/lib/components/ChatPane.svelte` (message display + streaming)
  - `src/lib/components/Composer.svelte` (input)

### Testing

Unit tests for the chat service are available at:
- `tests/unit/services/chat.service.spec.ts`

Run tests with:
```bash
npm test -- tests/unit/services/chat.service.spec.ts
```

## Changing Models

To use a different Ollama model:

1. **Pull the model** in Docker:
   ```bash
   docker exec -it ollama ollama pull <model-name>
   ```

2. **Update the configuration** in `ChatPane.svelte`:
   ```typescript
   model: '<model-name>'  // e.g., 'llama3.1:latest', 'mistral:latest'
   ```

3. **Rebuild the app**:
   ```bash
   npm run build:electron
   ```

## Troubleshooting

### Ollama Container Not Responding
```bash
# Check container status
docker ps -a

# Restart container
docker restart ollama

# Check logs
docker logs ollama
```

### Connection Refused
- Ensure Ollama container is running: `docker ps`
- Verify port 11434 is accessible: `curl http://localhost:11434`
- Check firewall settings

### Model Not Found
```bash
# List available models
docker exec -it ollama ollama list

# Pull missing model
docker exec -it ollama ollama pull llama3:latest
```

### Slow Responses
- llama3:latest requires significant RAM (8GB+ recommended)
- Consider using smaller models like `llama3:8b` or `mistral:7b`
- Check Docker resource limits in Docker Desktop settings
