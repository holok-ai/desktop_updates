# Brainstorming Session Results

**Session Date:** 2025-11-25
**Facilitator:** BMad Brainstorming Facilitator
**Participant:** Peter

## Session Start

**Approach Selected:** AI-Recommended Techniques

**Techniques Planned:**
1. Six Thinking Hats (structured) - Comprehensive perspective analysis
2. Assumption Reversal (deep) - Challenge core design assumptions
3. SCAMPER Method (structured) - Iterative design refinement (skipped - sufficient insights from first two)

**Rationale:** Start with comprehensive analysis, challenge fundamentals, then refine the design.

## Executive Summary

**Topic:** Unified Tool Orchestration Layer for Holokai Desktop

**Session Goals:** Design a robust orchestration layer that aggregates tools from multiple sources (native tools, MCP servers) into a unified interface for chat providers.

**Starting Design Concept:**
- Tool Orchestrator (central component)
- Native Tool Manager (built-in tools)
- MCP Server Manager (MCP-compliant servers)
- Tool Registry (catalog and capabilities)

**Known Trade-offs:**
- Benefits: Single integration point, consistent handling, easy expansion
- Concerns: Single point of failure, potential bottleneck, complexity

**Techniques Used:** Six Thinking Hats, Assumption Reversal

**Total Ideas Generated:** 27

### Key Themes Identified:

1. **Centralized Definition, Flexible Consumption** - Tools/MCPs defined and secured centrally, but providers can integrate differently
2. **User Control & Safety** - Plan preview, tiered execution modes, reversibility metadata, audit trails
3. **Workflow as First-Class Citizen** - Natural language → workflows → reusable tools → shareable assets
4. **Local Execution, Enterprise Storage** - Workflows in project repo, execution local via Holo API for security

## Technique Sessions

### Six Thinking Hats

#### ⚪ WHITE HAT - Facts
| Dimension | Current State | Target State |
|-----------|---------------|--------------|
| Native Tools | 1 (FileToolService with 2 functions) | 10-25 tools |
| MCP Servers | 0 | 20-50 servers |
| Initial MVP | - | 3 tools + 5 MCP servers |
| Tool Invocation | ~every 5th prompt | High frequency |
| MCP Transports | - | stdio or SSE |
| Tool Schema | - | Single composite JSON → provider-specific |
| Permissions | - | Binary allow/disallow per user |

**Planned Native Tools:** File system, command shell, GitHub API, Azure DevOps API

**Planned MCP Servers:** Databases, SAP, ServiceNow, GitHub, SonarQube, others

#### 🔴 RED HAT - Feelings
- Orchestrator approach feels right - single master class, minimal provider impact
- Not worried about single point of failure (can test into reliability)
- MCP startup time is a concern → background loading
- Future vision: Enterprise MCP service (out of process, provided by Holo)

#### 🟡 YELLOW HAT - Benefits
**Killer Workflows Identified:**

1. **Sequential Chains (Code Review)**
   > "Review the code for ticket 202 in my desktop repository"
   - GitHub MCP → lookup ticket, find branch/PR
   - Tool → create folder
   - GitHub MCP → pull code
   - Tool → run review prompt
   - Tool → save results
   - Display → pretty markdown

2. **Parallel Fan-out (Comparison Mode)**
   > "Give me 5 design options for implementing SSO"
   - Generate multiple options in parallel
   - Aggregate into structured comparison table
   - Decision-ready format, not walls of text

3. **Collaborative Workflows**
   > Build and share AI workflows across enterprise
   - Multi-user editing
   - Version control
   - Enterprise sharing
   - Workflows = reusable assets

#### ⚫ BLACK HAT - Risks
**Top Concern: Agentic Autonomy**

| Risk | Mitigation |
|------|------------|
| AI hallucinates wrong ticket | Plan preview before execution |
| Wrong customer contacted | Trust mode (opt-in per workflow) |
| Data corruption | Audit trail visible to user |
| Irreversible damage | `isReversible` metadata + always confirm irreversible |
| | Undo step or sequence |

**Security:** Binary allow/disallow sufficient for now.

#### 🟢 GREEN HAT - Creative Ideas
| Idea | Priority |
|------|----------|
| Natural Language Workflow Builder | **Must have (MVP)** |
| Plan Negotiation (modify on the fly) | Moonshot |
| Workflow Marketplace | Later |

#### 🔵 BLUE HAT - Synthesis
Architecture evolved from 4 components to 8:
1. Tool Orchestrator
2. Native Tool Manager
3. MCP Server Manager
4. Tool & Workflow Registry
5. Workflow Planner
6. Execution Engine
7. Audit & Undo Engine
8. Schema Translator

### Assumption Reversal

| Assumption | Challenge | Outcome |
|------------|-----------|---------|
| Centralization is best | Could providers integrate differently? | ✅ Centralize definition/policy, allow varied consumption |
| Tools & MCPs unified | Should source be hidden? | ✅ Definition unified, integration can vary |
| Desktop owns orchestration | Should it be cloud? | ✅ Workflows in enterprise repo, execution local for security via Holo API |
| Users want autonomy | What about newbies? | ✅ Tiered modes: step-by-step / plan review / trust mode |

## Idea Categorization

### Immediate Opportunities (MVP)

_18 items for initial implementation_

**Architecture:**
1. Tool Orchestrator (central coordinator)
2. Native Tool Manager
3. MCP Server Manager
4. Tool & Workflow Registry
5. Workflow Planner (natural language → plan)
6. Execution Engine (sequential, parallel, fan-out)
7. Audit & Undo Engine
8. Schema Translator (composite → provider-specific)

**Tool Metadata & Permissions:**
9. `isReversible: yes | no | unknown` per tool/function
10. User allow/disallow permissions
11. Composite JSON schema for tool definitions

**Execution:**
12. Sequential chains (code review workflow)
15. Plan preview before execution
19. Audit trail visible to user

**Enterprise Integration:**
21. Workflows stored in project repository
22. Local execution for security
23. Holo API for model + prompt monitoring
24. Background MCP loading (already enabled)

### Future Innovations

_6 items for post-MVP_

13. Parallel fan-out + aggregation (comparison mode)
14. Workflow-as-tool (saved workflows become reusable)
17. Tiered execution modes (step-by-step / plan review / trust)
18. Irreversible actions always confirm
20. Undo step or sequence
26. Workflow marketplace

### Moonshots

_3 long-term vision items_

16. Plan negotiation (modify steps mid-conversation)
25. Enterprise MCP service (out of process)
27. Adaptive trust (earned over time)

### Insights and Learnings

_Key realizations from the session_

1. **Orchestrator validates** - Central orchestration is the right approach; single point of failure is testable, not a real risk
2. **Reversibility is key metadata** - Each tool function needs `isReversible` flag to drive confirmation logic
3. **Plan preview unlocks trust** - Showing the plan before execution addresses both power user and newbie concerns
4. **Workflows are the product** - Natural language → workflow → reusable tool → shared asset is the value chain
5. **Local execution non-negotiable** - Security requires local execution; Holo API provides monitoring layer

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Tool Orchestrator + Registry

- **Rationale:** Foundation - everything else builds on this
- **Next steps:**
  1. Define core TypeScript interfaces (`ITool`, `IToolRegistry`, `IOrchestrator`)
  2. Create composite JSON schema for tool definitions (including `isReversible`)
  3. Refactor existing FileToolService to implement new `ITool` interface
  4. Build ToolRegistry with add/remove/query capabilities
  5. Create ToolOrchestrator shell that routes to Native Tool Manager
  6. Add first MCP server connection (stdio transport) to validate pattern
- **Resources needed:**
  - MCP SDK/documentation for stdio transport
  - Decision on where to store tool definitions (config file? code?)

#### #2 Priority: Workflow Planner (Natural Language → Plan)

- **Rationale:** Core differentiator, must-have for product viability
- **Next steps:**
  1. Define WorkflowPlan schema (steps, tool references, parameters)
  2. Create prompt template that generates plans from natural language
  3. Build plan preview UI component (show steps before execution)
  4. Implement basic plan executor (sequential only for MVP)
  5. Wire plan preview into chat flow (intercept before execution)
- **Resources needed:**
  - UI design for plan preview component
  - Decision on plan storage format

#### #3 Priority: Schema Translator

- **Rationale:** Unblocks multi-provider support
- **Next steps:**
  1. Document Claude tool schema format
  2. Document OpenAI tool schema format
  3. Document Ollama tool schema format
  4. Document Perplexity tool schema format
  5. Define composite schema superset
  6. Build translator: composite → Claude format
  7. Build translator: composite → OpenAI format
  8. Build translator: composite → Ollama format
  9. Build translator: composite → Perplexity format
  10. Test with FileToolService and new ShellToolService across all providers
- **Resources needed:**
  - Claude, OpenAI, Ollama, and Perplexity API docs for tool schemas
  - Test accounts/instances for all providers

## Reflection and Follow-up

### What Worked Well

- **Six Thinking Hats** provided comprehensive coverage from all angles
- **Assumption Reversal** validated core decisions and refined the architecture
- Session evolved design from 4 components to 8 with clear rationale
- Killer workflow examples (code review, comparison mode, collaboration) grounded the design in real use cases

### Areas for Further Exploration

1. **File Storage Architecture** - Need to solidify system-wide file storage concept before orchestrator implementation
2. **Integration with existing patterns** - Review current codebase documentation to ensure alignment
3. **Existing FileToolService** - Understand current implementation before refactoring

### Recommended Follow-up Techniques

- **First Principles Thinking** for file storage architecture
- **SCAMPER** on existing FileToolService to evolve it

### Questions That Emerged

1. How does orchestrator interact with existing chat provider architecture?
2. Where should tool definitions be stored? (config file vs code vs database)
3. How does file storage relate to workflow storage and audit logs?
4. What existing patterns from the codebase should the orchestrator follow?

### Next Session Planning

- **Suggested topic:** File Storage Architecture - solidify concept before orchestrator work
- **Preparation needed:** Review existing file storage documentation and patterns in codebase

---

_Session facilitated using the BMAD CIS brainstorming framework_
