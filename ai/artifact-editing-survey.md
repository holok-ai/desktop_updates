# Artifact Editing Survey: Claude, ChatGPT Canvas, and Gemini Canvas

A survey of how the three major AI platforms handle document/artifact editing, based on leaked system prompts and reverse engineering.

---

## 1. Claude Artifacts (`<antArtifact>` tags)

**Mechanism:** Inline XML tags in the response text. No tool calls.

The model wraps content in `<antArtifact>` tags with a persistent `identifier` for versioning. Updates reuse the same identifier; new artifacts get a fresh one. The model is instructed to think first in `<antThinking>` tags about whether content warrants an artifact.

**Tag format:**
```xml
<antArtifact identifier="saba-travel-guide" type="text/markdown" title="Saba Travel Guide">
# Saba
Full document content here...
</antArtifact>
```

**Update strategy:** Full rewrite. The entire content is replaced each time. No diffing, no partial updates.

**When to use:** Substantial content (>15 lines), self-contained, likely to be modified or reused.

**Rendering:** Content is rendered in a sandboxed iframe on `claudeusercontent.com` using a Next.js app with DOMPurify, React Runner, and window.postMessage for parent-iframe communication.

**Versioning:** The UI silently saves each version. Users toggle between versions via arrows.

**Sources:**
- System prompt: https://gist.github.com/dedlim/6bf6d81f77c19e20cd40594aa09e3ecd
- Reverse engineering: https://www.reidbarber.com/blog/reverse-engineering-claude-artifacts
- Leaked prompt repo: https://github.com/jujumilk3/leaked-system-prompts/blob/main/claude-artifacts_20240620.md

---

## 2. ChatGPT Canvas (`canmore` tool namespace)

**Mechanism:** Dedicated tool calls in a `canmore` namespace. Three functions.

This is the most deterministic approach because the model's output is constrained by tool call JSON schemas. The three tools are:

- **`canmore.create_textdoc`** — Creates a new document: `{name, type, content}`
- **`canmore.update_textdoc`** — Updates via regex patterns: `{updates: [{pattern, replacement, multiple}]}`
- **`canmore.comment_textdoc`** — Adds inline comments without modifying content

**Create example:**
```json
canmore.create_textdoc({
  "name": "Saba Travel Guide",
  "type": "document",
  "content": "# Saba\nFull document content here..."
})
```

**Update example:**
```json
canmore.update_textdoc({
  "updates": [{
    "pattern": ".*",
    "multiple": false,
    "replacement": "# Saba\nUpdated full document content here..."
  }]
})
```

**Update strategy:** Regex-based updates using Python `re.finditer` and `re.Match.expand`. However, the system prompt instructs: "rewrite the entire document (using `.*`) for most changes." Targeted edits (matching a specific section) are reserved for when the user selects a specific small section of text.

**When to use:** Substantial content (>10 lines), user-owned deliverables, iterative editing. The prompt explicitly says to "lean towards NOT triggering `create_textdoc` as it can be surprising for users."

**Sources:**
- System prompt: https://gist.github.com/dg/72bc9f585a068d2e9c4edc5ae4c6d9ee
- System prompt (alt): https://github.com/LouisShark/chatgpt_system_prompt/blob/main/prompts/official-product/openai/gpt40_with_canvas.md
- Technical details: https://medium.com/@dave1010/chatgpts-canvas-beta-feature-internal-details-a7c1e2477149

---

## 3. Gemini Canvas (`<immersive>` tags)

**Mechanism:** Inline tags in the response text, similar to Claude. No tool calls.

The model wraps content in `<immersive>` tags with an `id` for tracking and a `type` for content classification. Updates reuse the same `id`; new documents get a new `id`.

**Tag format (text/markdown):**
```xml
<immersive> id="saba-travel-guide" type="text/markdown" title="Saba Travel Guide">
# Saba
Full document content here...
</immersive>
```

**Tag format (code):**
```xml
<immersive> id="saba-app" type="code" title="Saba Explorer App">
```html
<!DOCTYPE html>
<html>...</html>
```
</immersive>
```

**Update strategy:** Full rewrite. "Respond with a new document using the same `id` and updated content." The model is instructed to "preserve user edits from the user block unless explicitly told otherwise."

**Response structure:** The model must follow a three-part structure:
1. **Introduction** — brief conversational intro (no code, no formatting details)
2. **Document** — the actual content inside `<immersive>` tags
3. **Conclusion** — short summary of changes, suggest next steps

**When to use:** Lengthy text (>10 lines), iterative editing, all code, web apps/games. Short factual answers stay in chat.

**Mandatory rules:** All code must be in immersives. Content must be self-contained and runnable. Never mention "Immersive" to the user (they see it as "Canvas" or "Documents").

**Sources:**
- System prompt: https://github.com/elder-plinius/CL4R1T4S/blob/main/GOOGLE/Gemini-2.5-Pro-04-18-2025.md
- Google blog: https://blog.google/products-and-platforms/products/gemini/gemini-collaboration-features/

---

## Key Takeaway: Full Rewrite vs. Partial Diffs

All three platforms converge on **full document rewrites** rather than partial diffs:

| Platform | Mechanism | Update Strategy |
|----------|-----------|-----------------|
| Claude | `<antArtifact>` tags | Full rewrite (same identifier) |
| ChatGPT Canvas | `canmore` tool calls | Regex `.*` full rewrite (default) |
| Gemini Canvas | `<immersive>` tags | Full rewrite (same id) |

**Why full rewrites win over partial diffs:**

1. **Reliability.** Diffs are fragile. Unified diffs require exact line matching; a single context line mismatch causes patch failure. Models don't reliably produce syntactically correct diffs, especially for large documents. Full rewrites always apply cleanly.

2. **Simplicity.** The model outputs the document as it should look. No intermediate format to parse, validate, or apply. The system just stores the new version. Diffing can be computed after the fact by the system (not the model) for display purposes.

3. **Model capability.** Models are trained to generate text, not to generate precise diffs with correct line numbers and context windows. Even ChatGPT Canvas, which supports regex-based targeted edits, defaults to full rewrites (`pattern: ".*"`) for most changes. The regex targeting is reserved for when the user explicitly highlights a small section.

4. **Version management becomes trivial.** Each version is a complete snapshot. Comparison and rollback are straightforward — compute the diff for display, but store the full content. This is the approach all three platforms take.

5. **User edits are preserved naturally.** When the user edits the document directly, the system stores their version. When the model updates, it receives the current document (with user edits) and outputs a new complete version. No merge conflicts, no three-way diffs.

**The implication for our architecture:** The structured diff approach (asking the model to produce unified diffs) is fighting against the grain of how every major platform handles this. The model should output the full updated document, and the system should compute diffs between versions for the review UI. This decouples model output (which must be reliable) from diff presentation (which is a pure computation).
