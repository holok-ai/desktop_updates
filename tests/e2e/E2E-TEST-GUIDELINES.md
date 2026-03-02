# E2E Test Guidelines

Ask your AI assistant to review test code before pushing and submitting them for review.

Keep each test file under 350 total lines unless absolutely necessary.
Setup/teardown must not disturb existing user settings, projects, or threads.
Use the UI for test actions; do not call electronAPI in E2E specs.
Use the designated assistant names (from separate chat) when creating threads.
Use explicit UI expectations with timeouts (visibility/enabled/text), not arbitrary waits.
Avoid duplicate test cases or assertions for the same scenario(s).
Use shared helpers/constants instead of duplicating sequences or strings.
Use unique, clearly prefixed test data and clean up only what you created.
Keep tests focused: one user-visible behavior per test, minimal branching.
Skip or mark unstable tests rather than adding long sleeps or brittle workarounds.

Load these instructions into your instruction file, such as:
CLAUDE.md for claude/anthropic
.cursorrules or /cursor/rules/\*.mdc for Cursor
AGENTS.md for Gemini codex
