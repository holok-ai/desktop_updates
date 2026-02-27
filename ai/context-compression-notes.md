# Chat Summary: Context Compression for LLM Chat Sessions

## Topic

Designing a policy-based context compression system for Holokai’s AI proxy layer, covering theory, prompt design, software architecture, and token economics.

-----

## 1. Should Compression Include Both Prompts and Responses?

**Answer: Yes, both are required.**

LLMs are stateless — every request must contain the full conversation. Without the assistant’s prior responses, the model can’t maintain coherence, and the API’s alternating user/assistant role structure would break. Four compression strategies were discussed:

- **Summarize older turns** — replace early history with a system-level summary, keep recent turns intact
- **Sliding window** — keep the last N full turns, drop or summarize the rest
- **Selective pruning** — drop irrelevant turns as pairs (prompt + response together)
- **Hybrid** — rolling summary as a system message + last few verbatim turns

-----

## 2. Meta-Summary Prompt Design

A sample summarization prompt was provided with two variants:

**Initial summary prompt** — takes a full conversation and produces a structured summary with sections: Topic, Key Context, Current State, and Open Items.

**Incremental summary prompt** — takes an existing summary plus new turns and merges them, dropping superseded details. This avoids re-summarizing the entire history each time.

**Production tips:**

- Use a cheaper/faster model (e.g., Haiku) for generating summaries
- Trigger compression at ~60–70% of context window capacity
- Keep the last 4–6 turns verbatim to preserve immediate conversational flow

-----

## 3. Compressing Long Individual Responses

**Answer: Yes, you can selectively compress individual long responses** while keeping shorter messages intact. Three approaches:

- **Summarize in-place** — send the long response to an LLM with instructions to preserve decisions, code, and values while dropping verbose explanations
- **Threshold-based** — only compress messages exceeding a token limit, skip recent messages entirely
- **Hybrid code/prose** — keep active code blocks intact, summarize surrounding prose

Compression doesn’t have to be all-or-nothing. Different strategies can apply to different age ranges of the conversation simultaneously.

-----

## 4. Policy-Based Software Architecture

A full TypeScript implementation was designed with a **pipeline pattern** where policies compose rather than being mutually exclusive.

### Why Single-Policy-Per-Message Doesn’t Work

A message can be old AND long. A message might contain code that’s still referenced. Protection and compression are orthogonal concerns that need to layer.

### Pipeline Design

Policies execute in priority order, with early-exit when under budget:

|Priority|Policy                 |LLM Call?        |Purpose                                             |
|--------|-----------------------|-----------------|----------------------------------------------------|
|0       |`KeepRecentTurns`      |No               |Marks last N turns as protected                     |
|10      |`ProtectReferencedCode`|No               |Protects old messages whose code is still referenced|
|150     |`DropRedundantMessages`|No               |Removes low-value messages (“ok”, “thanks”)         |
|200     |`CompressLongResponses`|Yes (per message)|Summarizes individual oversized messages            |
|300     |`SummarizeOldTurns`    |Yes (one call)   |Collapses old unprotected turns into a meta-summary |
|400     |`AggressiveDropOldest` |No               |Last resort — drops oldest unprotected messages     |

### Key Design Decisions

- Policies operate on the **full message list**, not individual messages — enabling range-based operations
- Earlier policies influence later ones (protection flags prevent compression)
- Cheap regex-based policies run first; LLM-powered policies only run if still over budget
- Pipeline stops early once under token budget
- Messages are always dropped/summarized in user+assistant pairs to maintain role alternation

### Files Created

- `types.ts` — Core interfaces (Message, MessageMeta, CompressionPolicy, CompressionContext)
- `pipeline.ts` — CompressionPipeline orchestrator with logging and early exit
- 6 policy classes, each in its own file
- `example-usage.ts` — Integration example with Holokai proxy, including a custom policy example

-----

## 5. LLM Calls Per Compression Pass

Not every policy requires an LLM call. The cost breakdown:

- **3 policies** are free (in-memory flag setting, regex matching, array filtering)
- **1 policy** makes one LLM call per oversized message (`CompressLongResponses`)
- **1 policy** makes one LLM call total for batch summarization (`SummarizeOldTurns`)
- **1 policy** is free but destructive (`AggressiveDropOldest`)

Worst case: ~4 LLM calls (3 long messages + 1 summary). Best case: 0 calls if cheap policies solve the problem.

-----

## 6. Useful Metadata for Compression

Beyond the provider-returned token counts, recommended metadata fields:

**From provider:** `tokenCount`, `model`

**Computed once, used by many policies:** `turnIndex`, `messageType` (code/explanation/question/ack/mixed), `hasCodeBlock`

**Set during compression:** `protected`, `compressedBy`, `originalTokenCount`, `originalMessageCount`, `compressionRound`

**For smarter decisions:** `semanticWeight` (information density score), `userReferenceCount` (how often later messages reference this one)

The `messageType` classification was highlighted as the highest-value addition — cheap to compute with regex, enables very different strategies per type.

-----

## 7. Prompt Tokens vs. Completion Tokens

- **Prompt tokens** — everything sent TO the model (system prompt + full conversation history + new user message). Re-counted on every request.
- **Completion tokens** — everything the model generates back (the new assistant response).

**Critical insight for compression:** A previous assistant response becomes prompt tokens on every subsequent request. A 2,000-token response in turn 1 costs 2,000 prompt tokens on every future turn. This is why compressing long responses has a compounding payoff.

Prompt tokens are typically 3–5x cheaper than completion tokens since generation requires more compute than reading.