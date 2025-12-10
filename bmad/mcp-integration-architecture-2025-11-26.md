# MCP Integration Architecture
**Holokai Desktop - Integration Ecosystem**

**Date:** 2025-11-26
**Version:** 1.0
**Status:** Design Specification
**Component:** MCP (Model Context Protocol) Integration

---

## 1. Overview

### 1.1 Purpose

The MCP Integration system enables Holokai Desktop to access 257+ community-built integrations via the Model Context Protocol, plus organizational control over which servers are enabled, configured, and supported.

**Key Value Proposition:**
- **257+ integrations** available via MCP community ecosystem
- **Organizational control** via Moku API (IT admin enables/disables servers per org)
- **Holo support** for officially supported MCP servers (monitoring, updates, troubleshooting)
- **Zero Desktop code changes** to add new integrations (MCP servers are external processes)

### 1.2 MCP Protocol Overview

**Model Context Protocol (MCP):**
- Open protocol for LLM integrations
- MCP servers expose tools/resources via stdio communication
- Desktop app acts as MCP client
- Each server runs as isolated child process

**Example MCP Servers:**
- **Google Drive:** Read/write files, search, share
- **Slack:** Send messages, read channels, upload files
- **GitHub:** Create issues, PRs, search repos
- **Salesforce:** Query/update records, run SOQL
- **PostgreSQL:** Query databases, run SQL
- **Filesystem:** Read/write local files
- **Puppeteer:** Web scraping, browser automation

### 1.3 Architecture Goals

| Goal | Requirement | Rationale |
|------|-------------|-----------|
| **Organizational Control** | Moku API manages which MCP servers are enabled per org | IT admins control integration surface area |
| **Sandboxed Execution** | Each MCP server runs in isolated process with resource limits | Security: prevent malicious servers from compromising Desktop |
| **Credential Management** | Moku API stores credentials; Desktop fetches & injects into MCP servers | Security: credentials never stored locally |
| **Health Monitoring** | Desktop monitors MCP server health; Holo monitors org-wide usage | Reliability: auto-restart crashed servers, alert IT on issues |
| **Versioning & Updates** | Holo manages MCP server versions; Desktop auto-updates | Maintenance: fix bugs, add features without Desktop updates |
| **Minimal Desktop Changes** | Adding new MCP server = configuration change (no code) | Scalability: community can add servers without Holokai involvement |

---

## 2. System Architecture

### 2.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIER 1: HOLO PLATFORM (Support & Monitoring)        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ MCP Server Registry (Holo Managed)                                 │     │
│  │                                                                      │     │
│  │ • Official MCP servers (20+ supported by Holo)                     │     │
│  │ • Version management (server packages, npm/pip)                    │     │
│  │ • Health monitoring (usage metrics, error rates across orgs)       │     │
│  │ • Update distribution (push new versions to orgs)                  │     │
│  │                                                                      │     │
│  │ Supported Servers:                                                  │     │
│  │ - @modelcontextprotocol/server-google-drive                        │     │
│  │ - @modelcontextprotocol/server-slack                               │     │
│  │ - @modelcontextprotocol/server-github                              │     │
│  │ - @modelcontextprotocol/server-postgres                            │     │
│  │ - ... (20 total official servers)                                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Registry sync (daily)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  TIER 2: MOKU API (Organizational Control)                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ Organization MCP Configuration                                      │     │
│  │                                                                      │     │
│  │ Database Tables:                                                    │     │
│  │ ┌──────────────────────────────────────────────────────────┐       │     │
│  │ │ organization_mcp_servers                                  │       │     │
│  │ │ - organization_id                                         │       │     │
│  │ │ - server_id (e.g., "google-drive")                       │       │     │
│  │ │ - enabled (boolean)                                       │       │     │
│  │ │ - version (e.g., "1.2.3")                                │       │     │
│  │ │ - config (JSONB: custom org settings)                    │       │     │
│  │ │ - enabled_by (userId who enabled)                        │       │     │
│  │ │ - enabled_at (timestamp)                                 │       │     │
│  │ └──────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │ ┌──────────────────────────────────────────────────────────┐       │     │
│  │ │ user_mcp_credentials                                      │       │     │
│  │ │ - user_id                                                 │       │     │
│  │ │ - server_id                                               │       │     │
│  │ │ - encrypted_credentials (AES-256-GCM)                    │       │     │
│  │ │ - expires_at                                              │       │     │
│  │ │ - last_used                                               │       │     │
│  │ └──────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │ API Endpoints:                                                      │     │
│  │ • GET  /mcp/servers (list enabled servers for org)                 │     │
│  │ • POST /mcp/servers/:id/enable (IT admin enables server)           │     │
│  │ • POST /mcp/servers/:id/disable (IT admin disables server)         │     │
│  │ • GET  /mcp/servers/:id/credentials/:userId (get user credentials) │     │
│  │ • POST /mcp/servers/:id/credentials (store user credentials)       │     │
│  │ • GET  /mcp/registry (list all available MCP servers from Holo)    │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP API (per-user requests)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   TIER 3: DESKTOP APP (MCP Client & Orchestration)           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    MAIN PROCESS (MCP Orchestration)                 │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ MCPOrchestrator (Central Manager)                        │       │     │
│  │  │                                                           │       │     │
│  │  │ • Fetch enabled servers from Moku on app startup        │       │     │
│  │  │ • Start MCP servers (spawn child processes)             │       │     │
│  │  │ • Monitor health (restart on crash)                     │       │     │
│  │  │ • Route tool calls to appropriate server                │       │     │
│  │  │ • Report usage metrics to Moku                          │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ MCPServerManager (Lifecycle & Sandboxing)                │       │     │
│  │  │                                                           │       │     │
│  │  │ • spawn(serverId, config) → ChildProcess                │       │     │
│  │  │ • stop(serverId)                                         │       │     │
│  │  │ • restart(serverId)                                      │       │     │
│  │  │ • getHealth(serverId) → HealthStatus                    │       │     │
│  │  │                                                           │       │     │
│  │  │ Resource Limits (per server):                            │       │     │
│  │  │ • 512MB RAM max                                          │       │     │
│  │  │ • 1 CPU core max                                         │       │     │
│  │  │ • 60-second timeout per tool invocation                 │       │     │
│  │  │ • Network: allowlist domains only                       │       │     │
│  │  │ • Filesystem: no access except /tmp (write-only)        │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ MCPClient (MCP Protocol Implementation)                  │       │     │
│  │  │                                                           │       │     │
│  │  │ • connect(server: ChildProcess) → MCPConnection         │       │     │
│  │  │ • listTools(serverId) → Tool[]                          │       │     │
│  │  │ • listResources(serverId) → Resource[]                  │       │     │
│  │  │ • callTool(serverId, toolName, params) → Result         │       │     │
│  │  │ • readResource(serverId, uri) → Content                 │       │     │
│  │  │                                                           │       │     │
│  │  │ Communication: stdio (JSON-RPC over stdin/stdout)       │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ MCPCredentialService (Credential Injection)              │       │     │
│  │  │                                                           │       │     │
│  │  │ • getCredentials(serverId, userId) → Credentials        │       │     │
│  │  │   → Calls Moku API                                      │       │     │
│  │  │   → Decrypts credentials                                │       │     │
│  │  │   → Injects as env vars into MCP server process        │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ MCPActionRegistry (Tool Discovery)                       │       │     │
│  │  │                                                           │       │     │
│  │  │ • discoverTools(serverId) → ActionDefinition[]          │       │     │
│  │  │ • getToolSchema(serverId, toolName) → JSONSchema       │       │     │
│  │  │ • searchTools(query) → ActionDefinition[]               │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                             │ stdio (JSON-RPC)                               │
│                             ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                 MCP SERVERS (Sandboxed Child Processes)             │     │
│  │                                                                      │     │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │     │
│  │  │  Google   │ │   Slack   │ │  GitHub   │ │Salesforce │           │     │
│  │  │  Drive    │ │           │ │           │ │           │           │     │
│  │  │  Server   │ │  Server   │ │  Server   │ │  Server   │  ...      │     │
│  │  │           │ │           │ │           │ │           │  (20+)    │     │
│  │  │ Node.js   │ │ Node.js   │ │ Python    │ │ Node.js   │           │     │
│  │  │ Process   │ │ Process   │ │ Process   │ │ Process   │           │     │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │     │
│  │                                                                      │     │
│  │  Each server:                                                        │     │
│  │  • Isolated child process (sandboxed)                               │     │
│  │  • Credentials injected as env vars (GOOGLE_API_KEY, etc.)          │     │
│  │  • Resource limits enforced by OS (ulimit/setrlimit)                │     │
│  │  • Network restricted to allowlisted domains                        │     │
│  │  • Exposes tools via MCP protocol (stdio JSON-RPC)                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. MCP Server Lifecycle Management

### 3.1 Server Discovery & Initialization

**On Desktop App Startup:**

```typescript
// src-electron/services/mcp/mcp-orchestrator.service.ts

class MCPOrchestrator {
  private servers: Map<string, MCPServerInstance> = new Map();
  private serverManager: MCPServerManager;
  private client: MCPClient;
  private credentialService: MCPCredentialService;

  async initialize(userId: string, organizationId: string): Promise<void> {
    // 1. Fetch enabled MCP servers for organization from Moku API
    const enabledServers = await this.mokuAPI.get(`/mcp/servers`, {
      params: { organizationId }
    });

    // enabledServers = [
    //   { serverId: "google-drive", version: "1.2.3", config: {...} },
    //   { serverId: "slack", version: "2.1.0", config: {...} },
    //   ...
    // ]

    // 2. Start each enabled server
    for (const serverConfig of enabledServers) {
      await this.startServer(serverConfig, userId);
    }

    // 3. Discover tools from all servers
    await this.discoverAllTools();

    console.log(`MCP Orchestrator initialized with ${this.servers.size} servers`);
  }

  private async startServer(
    serverConfig: {
      serverId: string;
      version: string;
      config: any;
    },
    userId: string
  ): Promise<void> {
    try {
      // 1. Get server manifest (installation details)
      const manifest = await this.getServerManifest(serverConfig.serverId);

      // manifest = {
      //   serverId: "google-drive",
      //   executable: "node",
      //   args: ["node_modules/@modelcontextprotocol/server-google-drive/dist/index.js"],
      //   env: ["GOOGLE_API_KEY"],
      //   allowedDomains: ["googleapis.com", "google.com"],
      //   resourceLimits: { maxMemoryMB: 512, maxCPU: 1, timeoutSeconds: 60 }
      // }

      // 2. Get user credentials for this server (from Moku API)
      const credentials = await this.credentialService.getCredentials(
        serverConfig.serverId,
        userId
      );

      // credentials = { GOOGLE_API_KEY: "..." }

      // 3. Spawn server process (with credentials as env vars)
      const process = await this.serverManager.spawn(
        serverConfig.serverId,
        manifest,
        credentials
      );

      // 4. Connect MCP client to server (stdio)
      const connection = await this.client.connect(process);

      // 5. Store server instance
      this.servers.set(serverConfig.serverId, {
        serverId: serverConfig.serverId,
        process,
        connection,
        manifest,
        health: 'healthy',
        startedAt: Date.now()
      });

      console.log(`Started MCP server: ${serverConfig.serverId}`);
    } catch (error) {
      console.error(`Failed to start MCP server ${serverConfig.serverId}:`, error);
      // Report error to Moku for monitoring
      await this.reportServerError(serverConfig.serverId, error);
    }
  }

  private async getServerManifest(serverId: string): Promise<MCPServerManifest> {
    // Read from local manifest file (bundled with Desktop app)
    // OR fetch from Moku API (dynamic server registry)
    const manifestPath = path.join(
      app.getPath('userData'),
      'mcp-servers',
      serverId,
      'manifest.json'
    );

    return JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  }
}

interface MCPServerInstance {
  serverId: string;
  process: ChildProcess;
  connection: MCPConnection;
  manifest: MCPServerManifest;
  health: 'healthy' | 'unhealthy' | 'crashed';
  startedAt: number;
  lastToolCall?: number;
  errorCount: number;
}

interface MCPServerManifest {
  serverId: string;
  name: string;
  description: string;
  version: string;
  executable: string; // "node" | "python3" | "deno"
  args: string[]; // ["path/to/server.js"]
  env: string[]; // ["GOOGLE_API_KEY", "GOOGLE_CLIENT_ID"]
  allowedDomains: string[]; // ["googleapis.com"]
  resourceLimits: {
    maxMemoryMB: number; // 512
    maxCPU: number; // 1
    timeoutSeconds: number; // 60
  };
  installCommand?: string; // "npm install @modelcontextprotocol/server-google-drive"
}
```

### 3.2 Server Process Management

```typescript
// src-electron/services/mcp/mcp-server-manager.service.ts

class MCPServerManager {
  private processes: Map<string, ChildProcess> = new Map();

  /**
   * Spawn MCP server as sandboxed child process
   */
  async spawn(
    serverId: string,
    manifest: MCPServerManifest,
    credentials: Record<string, string>
  ): Promise<ChildProcess> {
    const serverPath = this.getServerExecutablePath(serverId, manifest);

    // Build environment variables
    const env = {
      ...process.env,
      ...credentials, // Inject API keys
      MCP_SERVER_ID: serverId,
      NODE_ENV: 'production'
    };

    // Spawn child process
    const child = spawn(manifest.executable, manifest.args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
      cwd: path.dirname(serverPath),
      // Resource limits (Unix/Linux)
      ...(process.platform !== 'win32' && {
        uid: process.getuid(), // Run as same user (not root)
        gid: process.getgid()
      })
    });

    // Apply resource limits (Node.js v8+ only on Unix/Linux)
    if (process.platform !== 'win32') {
      try {
        // Set memory limit (512MB = 512 * 1024 * 1024 bytes)
        process.setrlimit('rss', manifest.resourceLimits.maxMemoryMB * 1024 * 1024);

        // Set CPU time limit (60 seconds)
        process.setrlimit('cpu', manifest.resourceLimits.timeoutSeconds);
      } catch (error) {
        console.warn('Failed to set resource limits:', error);
      }
    }

    // Monitor process health
    child.on('exit', (code, signal) => {
      console.log(`MCP server ${serverId} exited with code ${code}, signal ${signal}`);
      this.handleServerExit(serverId, code, signal);
    });

    child.on('error', (error) => {
      console.error(`MCP server ${serverId} error:`, error);
      this.handleServerError(serverId, error);
    });

    // Log stderr for debugging
    child.stderr?.on('data', (data) => {
      console.error(`[${serverId}] ${data.toString()}`);
    });

    this.processes.set(serverId, child);
    return child;
  }

  /**
   * Stop MCP server gracefully
   */
  async stop(serverId: string): Promise<void> {
    const process = this.processes.get(serverId);
    if (!process) {
      throw new Error(`Server not running: ${serverId}`);
    }

    // Send SIGTERM for graceful shutdown
    process.kill('SIGTERM');

    // Wait up to 5 seconds for graceful shutdown
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if not exited
        if (!process.killed) {
          process.kill('SIGKILL');
        }
        resolve(null);
      }, 5000);

      process.on('exit', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    this.processes.delete(serverId);
  }

  /**
   * Restart MCP server (after crash or update)
   */
  async restart(serverId: string): Promise<void> {
    await this.stop(serverId);
    // Orchestrator will handle re-spawning
  }

  /**
   * Get server health status
   */
  getHealth(serverId: string): 'healthy' | 'unhealthy' | 'crashed' {
    const process = this.processes.get(serverId);
    if (!process) {
      return 'crashed';
    }

    if (process.killed || process.exitCode !== null) {
      return 'crashed';
    }

    // Check if process is responsive (last tool call <5 min ago)
    // This would be tracked by MCPOrchestrator
    return 'healthy';
  }

  private handleServerExit(
    serverId: string,
    code: number | null,
    signal: string | null
  ): void {
    this.processes.delete(serverId);

    // Auto-restart on crash (up to 3 attempts)
    const restartCount = this.getRestartCount(serverId);
    if (restartCount < 3) {
      console.log(`Auto-restarting ${serverId} (attempt ${restartCount + 1}/3)`);
      setTimeout(() => {
        // Orchestrator will handle restart
        this.emit('serverCrashed', { serverId, code, signal, restartCount });
      }, 1000 * Math.pow(2, restartCount)); // Exponential backoff: 1s, 2s, 4s
    } else {
      console.error(`Server ${serverId} failed to start after 3 attempts`);
      this.emit('serverFailed', { serverId, code, signal });
    }
  }

  private getRestartCount(serverId: string): number {
    // Track restart attempts in memory (reset after 1 hour)
    // Implementation details omitted for brevity
    return 0;
  }

  private getServerExecutablePath(serverId: string, manifest: MCPServerManifest): string {
    // MCP servers installed in userData/mcp-servers/{serverId}/
    return path.join(
      app.getPath('userData'),
      'mcp-servers',
      serverId,
      manifest.args[0]
    );
  }
}
```

### 3.3 Health Monitoring & Auto-Restart

```typescript
// src-electron/services/mcp/mcp-health-monitor.service.ts

class MCPHealthMonitor {
  private healthChecks: Map<string, HealthCheckResult> = new Map();

  constructor(private orchestrator: MCPOrchestrator) {
    // Run health checks every 60 seconds
    setInterval(() => this.runHealthChecks(), 60 * 1000);
  }

  async runHealthChecks(): Promise<void> {
    for (const [serverId, server] of this.orchestrator.getServers()) {
      const health = await this.checkServerHealth(serverId, server);
      this.healthChecks.set(serverId, health);

      if (health.status === 'unhealthy' || health.status === 'crashed') {
        console.warn(`Server ${serverId} is ${health.status}:`, health.reason);

        // Auto-restart if crashed
        if (health.status === 'crashed') {
          await this.orchestrator.restartServer(serverId);
        }
      }
    }
  }

  private async checkServerHealth(
    serverId: string,
    server: MCPServerInstance
  ): Promise<HealthCheckResult> {
    // 1. Check if process is alive
    if (!server.process || server.process.killed || server.process.exitCode !== null) {
      return {
        status: 'crashed',
        reason: 'Process not running',
        checkedAt: Date.now()
      };
    }

    // 2. Check memory usage
    try {
      const memoryUsage = await this.getProcessMemory(server.process.pid!);
      if (memoryUsage > server.manifest.resourceLimits.maxMemoryMB * 1024 * 1024) {
        return {
          status: 'unhealthy',
          reason: `Memory usage (${memoryUsage / 1024 / 1024}MB) exceeds limit (${server.manifest.resourceLimits.maxMemoryMB}MB)`,
          checkedAt: Date.now()
        };
      }
    } catch (error) {
      // Process might have just exited
      return {
        status: 'crashed',
        reason: 'Failed to check memory usage',
        checkedAt: Date.now()
      };
    }

    // 3. Check responsiveness (ping server)
    try {
      const startTime = Date.now();
      await this.orchestrator.callTool(serverId, 'ping', {});
      const responseTime = Date.now() - startTime;

      if (responseTime > 10000) {
        // >10s response time
        return {
          status: 'unhealthy',
          reason: `Slow response time: ${responseTime}ms`,
          checkedAt: Date.now()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        reason: `Unresponsive: ${error.message}`,
        checkedAt: Date.now()
      };
    }

    return {
      status: 'healthy',
      checkedAt: Date.now()
    };
  }

  private async getProcessMemory(pid: number): Promise<number> {
    // Platform-specific memory check
    if (process.platform === 'win32') {
      // Windows: Use wmic command
      const { stdout } = await exec(`wmic process where processid=${pid} get WorkingSetSize`);
      const lines = stdout.trim().split('\n');
      return parseInt(lines[1]);
    } else {
      // Unix/Linux: Read from /proc/{pid}/status
      const status = await fs.readFile(`/proc/${pid}/status`, 'utf-8');
      const match = status.match(/VmRSS:\s+(\d+)\s+kB/);
      return match ? parseInt(match[1]) * 1024 : 0; // Convert kB to bytes
    }
  }
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'crashed';
  reason?: string;
  checkedAt: number;
}
```

---

## 4. MCP Protocol Communication

### 4.1 MCP Client Implementation

```typescript
// src-electron/services/mcp/mcp-client.service.ts

import { JSONRPCClient } from 'json-rpc-2.0';

class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();

  /**
   * Connect to MCP server via stdio
   */
  async connect(serverId: string, process: ChildProcess): Promise<MCPConnection> {
    const client = new JSONRPCClient((request) => {
      // Send JSON-RPC request to MCP server via stdin
      process.stdin?.write(JSON.stringify(request) + '\n');
    });

    // Handle JSON-RPC responses from MCP server via stdout
    process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          client.receive(response);
        } catch (error) {
          console.error(`Failed to parse MCP response from ${serverId}:`, error);
        }
      }
    });

    const connection: MCPConnection = {
      serverId,
      client,
      process
    };

    this.connections.set(serverId, connection);
    return connection;
  }

  /**
   * List tools exposed by MCP server
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    const response = await connection.client.request('tools/list', {});
    return response.tools;
  }

  /**
   * Call tool on MCP server
   */
  async callTool(
    serverId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    const startTime = Date.now();
    try {
      const response = await connection.client.request('tools/call', {
        name: toolName,
        arguments: params
      });

      // Report successful tool call to Moku (for usage tracking)
      await this.reportToolCall(serverId, toolName, Date.now() - startTime, 'success');

      return response.content;
    } catch (error) {
      // Report failed tool call
      await this.reportToolCall(serverId, toolName, Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * List resources exposed by MCP server
   */
  async listResources(serverId: string): Promise<MCPResource[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    const response = await connection.client.request('resources/list', {});
    return response.resources;
  }

  /**
   * Read resource from MCP server
   */
  async readResource(serverId: string, uri: string): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    const response = await connection.client.request('resources/read', { uri });
    return response.contents;
  }

  private async reportToolCall(
    serverId: string,
    toolName: string,
    durationMs: number,
    status: 'success' | 'error'
  ): Promise<void> {
    // Report to Moku API for monitoring/analytics
    try {
      await this.mokuAPI.post('/mcp/tool-calls', {
        serverId,
        toolName,
        durationMs,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Don't fail tool call if reporting fails
      console.warn('Failed to report tool call:', error);
    }
  }
}

interface MCPConnection {
  serverId: string;
  client: JSONRPCClient;
  process: ChildProcess;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}
```

---

## 5. Credential Management

### 5.1 Credential Injection Flow

```typescript
// src-electron/services/mcp/mcp-credential.service.ts

class MCPCredentialService {
  constructor(private mokuAPI: MokuAPIClient) {}

  /**
   * Get credentials for MCP server from Moku API
   * Credentials are encrypted in Moku, decrypted server-side, sent to Desktop via HTTPS
   */
  async getCredentials(
    serverId: string,
    userId: string
  ): Promise<Record<string, string>> {
    try {
      const response = await this.mokuAPI.get(
        `/mcp/servers/${serverId}/credentials/${userId}`
      );

      // response = {
      //   credentials: {
      //     GOOGLE_API_KEY: "...",
      //     GOOGLE_CLIENT_ID: "...",
      //     GOOGLE_CLIENT_SECRET: "..."
      //   }
      // }

      return response.data.credentials;
    } catch (error) {
      if (error.response?.status === 404) {
        // User hasn't configured credentials for this server yet
        throw new Error(
          `Credentials not found for ${serverId}. Please configure in Settings.`
        );
      }
      throw error;
    }
  }

  /**
   * Store credentials for MCP server (sent to Moku API for encryption)
   */
  async storeCredentials(
    serverId: string,
    userId: string,
    credentials: Record<string, string>
  ): Promise<void> {
    await this.mokuAPI.post(`/mcp/servers/${serverId}/credentials`, {
      userId,
      credentials
    });
  }

  /**
   * Delete credentials for MCP server
   */
  async deleteCredentials(serverId: string, userId: string): Promise<void> {
    await this.mokuAPI.delete(`/mcp/servers/${serverId}/credentials/${userId}`);
  }

  /**
   * Check if user has configured credentials for server
   */
  async hasCredentials(serverId: string, userId: string): Promise<boolean> {
    try {
      await this.mokuAPI.head(`/mcp/servers/${serverId}/credentials/${userId}`);
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### 5.2 Credential Configuration UI

**User Flow for Configuring MCP Server Credentials:**

```
User navigates to Settings → Integrations
   ↓
Sees list of enabled MCP servers (from Moku API)
   ↓
Clicks "Configure" on Google Drive server
   ↓
Modal opens with instructions:
   "To use Google Drive, you need to provide:"
   1. Google API Key (get from console.cloud.google.com)
   2. OAuth Client ID
   3. OAuth Client Secret
   ↓
User pastes credentials → Clicks "Save"
   ↓
Desktop sends to Moku API (encrypted storage)
   ↓
Confirmation: "✓ Google Drive configured!"
```

---

## 6. Tool Discovery & Action Registry

### 6.1 Action Registry Service

```typescript
// src-electron/services/mcp/mcp-action-registry.service.ts

class MCPActionRegistry {
  private actions: Map<string, ActionDefinition[]> = new Map();

  constructor(
    private client: MCPClient,
    private orchestrator: MCPOrchestrator
  ) {}

  /**
   * Discover tools from all running MCP servers
   */
  async discoverAllTools(): Promise<void> {
    this.actions.clear();

    for (const [serverId, server] of this.orchestrator.getServers()) {
      try {
        const tools = await this.client.listTools(serverId);

        const actions: ActionDefinition[] = tools.map((tool) => ({
          actionId: `${serverId}.${tool.name}`,
          serverId,
          toolName: tool.name,
          displayName: this.formatDisplayName(tool.name),
          description: tool.description,
          inputSchema: tool.inputSchema,
          category: this.categorizeAction(serverId, tool.name)
        }));

        this.actions.set(serverId, actions);
        console.log(`Discovered ${actions.length} tools from ${serverId}`);
      } catch (error) {
        console.error(`Failed to discover tools from ${serverId}:`, error);
      }
    }
  }

  /**
   * Get all available actions (for workflow builder UI)
   */
  getAllActions(): ActionDefinition[] {
    const allActions: ActionDefinition[] = [];
    for (const actions of this.actions.values()) {
      allActions.push(...actions);
    }
    return allActions;
  }

  /**
   * Search actions by query (for workflow builder)
   */
  searchActions(query: string): ActionDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllActions().filter(
      (action) =>
        action.displayName.toLowerCase().includes(lowerQuery) ||
        action.description.toLowerCase().includes(lowerQuery) ||
        action.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get action definition by ID
   */
  getAction(actionId: string): ActionDefinition | undefined {
    for (const actions of this.actions.values()) {
      const action = actions.find((a) => a.actionId === actionId);
      if (action) return action;
    }
    return undefined;
  }

  /**
   * Execute action (used by workflow engine)
   */
  async executeAction(
    actionId: string,
    params: Record<string, unknown>
  ): Promise<any> {
    const action = this.getAction(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    // Call tool via MCP client
    return await this.client.callTool(action.serverId, action.toolName, params);
  }

  private formatDisplayName(toolName: string): string {
    // Convert snake_case or camelCase to Title Case
    // read_file → Read File
    // sendMessage → Send Message
    return toolName
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private categorizeAction(serverId: string, toolName: string): string {
    // Categorize based on server ID or tool name
    const categoryMap: Record<string, string> = {
      'google-drive': 'Files',
      'slack': 'Communication',
      'github': 'Development',
      'postgres': 'Data',
      'salesforce': 'CRM',
      'filesystem': 'Files',
      'puppeteer': 'Web Automation'
    };

    return categoryMap[serverId] || 'Other';
  }
}

interface ActionDefinition {
  actionId: string; // "google-drive.read_file"
  serverId: string; // "google-drive"
  toolName: string; // "read_file"
  displayName: string; // "Read File"
  description: string;
  inputSchema: JSONSchema;
  category: string; // "Files", "Communication", etc.
}
```

---

## 7. Integration with Workflow Execution Engine

### 7.1 MCP Executor (Workflow Step Type)

```typescript
// src-electron/services/workflows/mcp-executor.service.ts

class MCPExecutor {
  constructor(private actionRegistry: MCPActionRegistry) {}

  /**
   * Execute MCP action as part of workflow
   */
  async execute(
    actionId: string,
    inputs: Record<string, unknown>
  ): Promise<any> {
    // Validate inputs against action schema
    const action = this.actionRegistry.getAction(actionId);
    if (!action) {
      throw new Error(`MCP action not found: ${actionId}`);
    }

    this.validateInputs(action.inputSchema, inputs);

    // Execute action
    try {
      const result = await this.actionRegistry.executeAction(actionId, inputs);
      return result;
    } catch (error) {
      throw new Error(`MCP action failed (${actionId}): ${error.message}`);
    }
  }

  private validateInputs(schema: JSONSchema, inputs: Record<string, unknown>): void {
    // Basic JSON Schema validation
    // Use a library like ajv for full validation
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (propSchema.required && inputs[key] === undefined) {
        throw new Error(`Missing required input: ${key}`);
      }
    }
  }
}
```

### 7.2 Workflow Engine Integration

```typescript
// src-electron/services/domain/workflow-execution.engine.ts (UPDATED)

class WorkflowExecutionEngine {
  constructor(
    private toolExecutor: ToolExecutor,
    private mcpExecutor: MCPExecutor, // NEW
    private promptExecutor: PromptExecutor,
    private mokuAPI: MokuAPIClient,
    private auditService: AuditService
  ) {}

  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
    threadId: string
  ): Promise<void> {
    // ... existing code ...

    let output: unknown;

    switch (step.type) {
      case 'tool':
        output = await this.toolExecutor.execute(step.toolId!, resolvedInputs);
        break;

      case 'mcp': // NEW
        output = await this.mcpExecutor.execute(step.actionId!, resolvedInputs);
        break;

      case 'prompt':
        output = await this.promptExecutor.execute(
          step.promptTemplate!,
          resolvedInputs,
          threadId
        );
        break;

      // ... existing code ...
    }

    // ... rest of method ...
  }
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'tool' | 'mcp' | 'prompt' | 'parallel' | 'condition'; // Added 'mcp'
  order: number;
  actionId?: string; // NEW: for MCP actions (e.g., "google-drive.read_file")
  toolId?: string; // Existing: for native tools
  mcpServer?: string; // DEPRECATED: use actionId instead
  mcpCommand?: string; // DEPRECATED: use actionId instead
  promptTemplate?: string;
  inputs: Record<string, string>;
  outputVariable?: string;
  condition?: string;
  parallelSteps?: WorkflowStep[];
}
```

---

## 8. Organizational Control (Moku API)

### 8.1 Moku API Endpoints

```
# MCP Server Registry
GET  /mcp/registry
Response:
  - Array<MCPServerDefinition> (all available MCP servers from Holo)

# Organization MCP Configuration
GET  /mcp/servers?organizationId={id}
Response:
  - Array<EnabledMCPServer> (enabled servers for org)

POST /mcp/servers/:serverId/enable
Body:
  - organizationId: string
  - config?: Record<string, any>
Response:
  - EnabledMCPServer

POST /mcp/servers/:serverId/disable
Body:
  - organizationId: string
Response:
  - { success: true }

# User Credentials
GET  /mcp/servers/:serverId/credentials/:userId
Response:
  - { credentials: Record<string, string> }

POST /mcp/servers/:serverId/credentials
Body:
  - userId: string
  - credentials: Record<string, string>
Response:
  - { success: true }

DELETE /mcp/servers/:serverId/credentials/:userId
Response:
  - { success: true }

# Usage Tracking (for Holo monitoring)
POST /mcp/tool-calls
Body:
  - serverId: string
  - toolName: string
  - durationMs: number
  - status: 'success' | 'error'
  - timestamp: string
Response:
  - { success: true }
```

### 8.2 Moku API Database Schema

```sql
-- MCP Server Registry (synced from Holo daily)
CREATE TABLE mcp_server_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(255) UNIQUE NOT NULL, -- "google-drive"
  name VARCHAR(255) NOT NULL, -- "Google Drive"
  description TEXT,
  version VARCHAR(50) NOT NULL, -- "1.2.3"
  manifest JSONB NOT NULL, -- Full manifest (executable, args, env, etc.)
  supported_by VARCHAR(50) NOT NULL, -- "holo" | "community"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization MCP Configuration
CREATE TABLE organization_mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  server_id VARCHAR(255) NOT NULL, -- References mcp_server_registry.server_id
  enabled BOOLEAN DEFAULT true,
  version VARCHAR(50) NOT NULL,
  config JSONB, -- Organization-specific config
  enabled_by UUID NOT NULL REFERENCES users(id),
  enabled_at TIMESTAMP DEFAULT NOW(),
  disabled_at TIMESTAMP,
  UNIQUE(organization_id, server_id)
);

-- User MCP Credentials
CREATE TABLE user_mcp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  server_id VARCHAR(255) NOT NULL,
  encrypted_credentials TEXT NOT NULL, -- AES-256-GCM encrypted JSON
  expires_at TIMESTAMP,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, server_id)
);

-- MCP Tool Call Tracking (for monitoring)
CREATE TABLE mcp_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  server_id VARCHAR(255) NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  duration_ms INT NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success' | 'error'
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_mcp_servers_org ON organization_mcp_servers(organization_id);
CREATE INDEX idx_user_mcp_creds_user ON user_mcp_credentials(user_id);
CREATE INDEX idx_mcp_tool_calls_org_time ON mcp_tool_calls(organization_id, timestamp DESC);
CREATE INDEX idx_mcp_tool_calls_server ON mcp_tool_calls(server_id, timestamp DESC);
```

---

## 9. Installation & Updates

### 9.1 MCP Server Installation

**Where are MCP servers installed?**

```
{userData}/mcp-servers/
├── google-drive/
│   ├── manifest.json
│   ├── node_modules/
│   └── index.js
├── slack/
│   ├── manifest.json
│   ├── node_modules/
│   └── index.js
├── github/
│   ├── manifest.json
│   ├── venv/
│   └── server.py
└── ...
```

**Installation Methods:**

**Option 1: Pre-bundled with Desktop App (Recommended for Official Servers)**
- 20 official MCP servers bundled with Desktop installer
- Installed to `{userData}/mcp-servers/` on first launch
- No npm/pip installation required (faster, more reliable)

**Option 2: On-Demand Installation (Community Servers)**
- User enables community MCP server in Settings
- Desktop runs install command: `npm install @modelcontextprotocol/server-{name}`
- Installed to `{userData}/mcp-servers/{name}/`
- Progress shown in UI

```typescript
// src-electron/services/mcp/mcp-installer.service.ts

class MCPInstallerService {
  async installServer(serverId: string, manifest: MCPServerManifest): Promise<void> {
    const serverDir = path.join(app.getPath('userData'), 'mcp-servers', serverId);

    // Create directory
    await fs.mkdir(serverDir, { recursive: true });

    // Write manifest
    await fs.writeFile(
      path.join(serverDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Run install command
    if (manifest.installCommand) {
      await this.runInstallCommand(manifest.installCommand, serverDir);
    }

    console.log(`Installed MCP server: ${serverId}`);
  }

  private async runInstallCommand(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Install failed: ${stderr}`);
          reject(error);
        } else {
          console.log(`Install output: ${stdout}`);
          resolve();
        }
      });
    });
  }
}
```

### 9.2 MCP Server Updates

**Update Strategy:**

1. **Holo pushes new MCP server versions** to registry (Moku API)
2. **Moku API notifies orgs** of available updates
3. **Desktop checks for updates** on startup (once/day)
4. **Auto-update or manual update** based on org policy

```typescript
// src-electron/services/mcp/mcp-update.service.ts

class MCPUpdateService {
  async checkForUpdates(): Promise<MCPServerUpdate[]> {
    const enabledServers = await this.mokuAPI.get('/mcp/servers', {
      params: { organizationId: this.organizationId }
    });

    const updates: MCPServerUpdate[] = [];

    for (const server of enabledServers) {
      const latestVersion = await this.getLatestVersion(server.serverId);
      if (latestVersion !== server.version) {
        updates.push({
          serverId: server.serverId,
          currentVersion: server.version,
          latestVersion,
          releaseNotes: await this.getReleaseNotes(server.serverId, latestVersion)
        });
      }
    }

    return updates;
  }

  async updateServer(serverId: string, version: string): Promise<void> {
    // 1. Download new version from Holo/npm
    // 2. Stop existing server
    // 3. Replace files
    // 4. Restart server
    // 5. Update Moku API with new version
  }
}
```

---

## 10. UI Components

### 10.1 Settings → Integrations Page

**User sees list of enabled MCP servers:**

```
┌─────────────────────────────────────────────────────────────┐
│ Settings → Integrations                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Enabled Integrations (5)                                    │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 📂 Google Drive                                      │   │
│ │    Access and manage Google Drive files             │   │
│ │    Status: ✓ Configured                             │   │
│ │    [Reconfigure] [Test Connection] [Disable]        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 💬 Slack                                             │   │
│ │    Send messages and read channels                   │   │
│ │    Status: ⚠ Credentials needed                     │   │
│ │    [Configure] [Disable]                             │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [Browse Available Integrations]                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Browse Integrations Modal

**User clicks "Browse Available Integrations":**

```
┌─────────────────────────────────────────────────────────────┐
│ Available Integrations                               [X]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Search...]  [All] [Files] [Communication] [Development]   │
│                                                              │
│ Official (Supported by Holo)                                │
│                                                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│ │📧Gmail  │ │🗓️Calendar│ │📊Sheets │ │📝Docs   │          │
│ │[Enable] │ │[Enable]  │ │[Enable] │ │[Enable] │          │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                              │
│ Community (257+ available)                                  │
│                                                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│ │🐘PostgreSQL│ │🌐Puppeteer│ │📁Filesystem│                │
│ │[Enable] │ │[Enable]  │ │[Enable] │                       │
│ └─────────┘ └─────────┘ └─────────┘                       │
│                                                              │
│ Note: Community integrations are not officially supported.  │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Success Criteria

### 11.1 Functionality Validation

- ✅ Desktop can discover and list enabled MCP servers from Moku API
- ✅ MCP servers spawn successfully with credentials injected
- ✅ Tool calls execute successfully via MCP protocol (JSON-RPC stdio)
- ✅ Resource limits enforced (512MB RAM, 1 CPU, 60s timeout)
- ✅ Auto-restart on crash (up to 3 attempts with exponential backoff)
- ✅ Credentials fetched securely from Moku API (never stored locally)
- ✅ Health monitoring detects crashed/unresponsive servers
- ✅ Tool discovery populates action registry for workflow builder
- ✅ Workflow engine can execute MCP actions as workflow steps

### 11.2 Performance Validation

- ✅ MCP server startup time <5 seconds (per server)
- ✅ Tool call latency <2 seconds (P95)
- ✅ Desktop app startup not delayed by MCP initialization (<10s total)
- ✅ Memory usage per MCP server <512MB (enforced by OS limits)
- ✅ No memory leaks after 1000+ tool calls

### 11.3 Security Validation

- ✅ MCP servers cannot access filesystem except /tmp
- ✅ Network restricted to allowlisted domains (per manifest)
- ✅ Credentials never stored locally (fetched from Moku per-session)
- ✅ Resource limits prevent DoS attacks
- ✅ Process isolation prevents server-to-server communication

### 11.4 User Adoption Metrics

- ✅ 60%+ of workflows use MCP integrations (vs. native integrations)
- ✅ <5% error rate for MCP tool calls
- ✅ <1% user complaints about MCP server crashes
- ✅ Users enable average of 5-8 MCP servers per org

---

## 12. Implementation Timeline

### 12.1 Effort Estimation

| Component | Effort (Days) | Dependencies |
|-----------|---------------|--------------|
| **MCPOrchestrator** | 2-3 days | MokuAPI endpoints |
| **MCPServerManager** | 3-4 days | OS-specific resource limits |
| **MCPClient** | 2-3 days | json-rpc-2.0 library |
| **MCPCredentialService** | 1-2 days | MokuAPI endpoints |
| **MCPActionRegistry** | 2-3 days | MCPClient |
| **MCPHealthMonitor** | 2-3 days | MCPOrchestrator |
| **Workflow Integration** | 1-2 days | MCPExecutor |
| **UI (Settings → Integrations)** | 3-4 days | Svelte components |
| **MCP Server Installation** | 2-3 days | npm/pip/deno CLIs |
| **Testing & Polish** | 3-5 days | All above |

**Total Effort:** 20-30 days (4-6 weeks) with 2 developers

### 12.2 Phased Rollout

**Phase 1 (Week 1-2): Core Infrastructure**
- MCPOrchestrator, MCPServerManager, MCPClient
- Basic tool calling (no credentials yet)
- 3 test servers: filesystem, memory, echo

**Phase 2 (Week 3-4): Credential Management & Security**
- MCPCredentialService
- Sandboxing & resource limits
- Health monitoring & auto-restart

**Phase 3 (Week 5-6): Integration & UI**
- MCPActionRegistry
- Workflow engine integration
- Settings UI for enabling/configuring servers
- 20 official MCP servers bundled

---

## 13. Next Steps

### 13.1 Before Implementation

1. **Moku API Coordination** (3-5 days)
   - Design database schema (3 tables)
   - Implement 8 endpoints
   - Sync MCP registry from Holo (daily cron job)

2. **Holo MCP Registry Setup** (2-3 days)
   - Define 20 official MCP servers to support
   - Create manifests for each server
   - Set up npm packages or bundle with Desktop

3. **External Dependencies** (1 day)
   - Install `json-rpc-2.0` npm package
   - Install MCP SDK (if available)
   - Test MCP servers locally

### 13.2 Documentation Needed

- [ ] User guide: "Enabling & configuring MCP integrations"
- [ ] Developer docs: "Adding a new MCP server"
- [ ] Admin docs: "Managing organizational MCP servers"
- [ ] Holo internal docs: "Supporting MCP servers"

---

_MCP Integration Architecture - Holokai Desktop Enterprise MVP_
EOF