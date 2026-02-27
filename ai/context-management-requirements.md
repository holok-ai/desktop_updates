# Context Management Requirements

Context management defines how Holokai prepares and delivers conversation history to AI models, ensuring responses remain coherent as threads grow beyond model token limits. It comprises three subareas: Context Display, Context Compression, and Context Assembly.

---

## Context Display 
#### calculate and show context details per thread

| Category | Requirements |
|---|---|
| Visibility | User can see current thread token usage as a percentage of model max, shown in the thread header; detailed breakdown available on demand via tooltip |
| Currency | Usage recalculates after every completed response and on thread open |
| Breakdown | Tooltip shows percentage of tokens by category: user messages and response messages (future: tool definitions, tool calls, generated media, attached files); if compression has run, shows date/time of last run and tokens before/after with percentage reduction |
| Architecture | Calculation runs as a background observer task; result held in reactive store keyed by thread ID; token counts sourced from moku API `tokens` field per message; model max sourced from static lookup on model name (future: dynamic lookup when provider API supports it) |
| Message Analysis | Populate discrete token count fields per message for: request, response, code block, tool definition, and tool call. Set tags on each message to indicate: Guard message, Pass Guard, Error response, Code Block, Long Response. Assign one or more topics to each request using a non-LLM method (e.g. keyword/regex classification). |
| Future | Desktop token histogram for current user, by provider, by topic, by model, by compression etc |
| **Status** | **Implemented** |

---

## Context Compression  
#### policy-based compression of messages

| Category | Requirements |
|---|---|
| Scope & Lifecycle | Thread-scoped; originals messages persisted in DB; compression output ephemeral (recomputed on thread load) |
| Triggers | Triggered when compression task conditions are met: thread crosses token threshold OR individual response exceeds long-response threshold |
| Token Budget | Compression target: app setting, default 85% of model max; recent turns N: app setting, default 8 (always verbatim, never compressed) |
| Pipeline | Policy-based pipeline; policies run in priority order with early exit when under budget; cheap/free policies run before LLM-powered policies; messages always dropped/summarized in user+assistant pairs |
| Message Handling | Tool/function call pairs treated as assistant turns; files stripped and replaced with descriptive tag before pipeline; compression output tracks source message IDs for precise ID-based substitution during assembly |
| Failure Mode | A compression is considered in failure mode when, after the pipeline is run, the compressed tokens still exceed the context threshold. Failure compression mode: remove (1) tool turn data, (2) oldest unprotected middle turns, (3) oldest recent protected turns. Failure mode target = 4 × (100 − threshold)%. Hard constraint: always preserve headroom for user prompt entry |
| Quality Measurement | Required: compression ratio, policy depth, LLM calls per pass, compression latency, role alternation violation errors. Candidate: offline faithfulness scoring via judge model on sampled threads; encrypt and save context for offline judge evaluation |
| **Status** | **Designing** |

### Pipeline Design

Policies execute in priority order, with early-exit when under budget:

|Priority|Policy                 |LLM Call?        |Purpose                                             |
|--------|-----------------------|-----------------|----------------------------------------------------|
|0       |`KeepRecentTurns`      |No               |Marks last N turns as protected                     |
|10      |`ProtectReferencedCode`|No               |Protects old messages whose code is still referenced|
|150     |`DropRedundantMessages`|No               |Removes low-value messages ("ok", "thanks")         |
|200     |`CompressLongResponses`|Yes (per message)|Summarizes individual oversized messages            |
|300     |`SummarizeOldTurns`    |Yes (one call)   |Collapses old unprotected turns into a meta-summary |
|400     |`AggressiveDropOldest` |No               |Last resort — drops oldest unprotected messages     |

### Key Design Decisions

- Policies operate on the **full message list**, not individual messages — enabling range-based operations
- Earlier policies influence later ones (protection flags prevent compression)
- Cheap regex-based policies run first; LLM-powered policies only run if still over budget
- Pipeline stops early once under token budget
- Messages are always dropped/summarized in user+assistant pairs to maintain role alternation

---

## Context Assembly
#### replace thread messages with compressed content prior to submitting prompt

| Category | Requirements |
|---|---|
| Assembly Purpose | Generates context for a user request that reduces the total tokens by replacing previous messages in a thread with compressed versions |
| Substitute Using Message IDs | Original messages are replaced by compressed content based on message ID; compressed context will replace either one or multiple message IDs in the thread (e.g. a summary element replaces multiple thread messages); message compression includes summary element, long response summarization, pleasantry removal, and others |
| Pre-send Validation | Final assembled token count validated against model max before sending; surfaces error if still over limit rather than silently truncating. Validate the following: no empty compressed content; no orphaned message IDs; no duplicate message IDs |
| **Status** | **Not Started** |
