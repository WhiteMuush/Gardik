# AI Agent Rules

Rules for AI assistants (Claude Code, Codex, Cursor, etc.) contributing to this project.

## Scope discipline

- Fix only what is asked. No adjacent refactors, no "while I'm here" cleanups.
- No premature abstractions. Three similar lines beat a helper that solves a hypothetical.
- No feature flags, no backwards-compatibility shims for removed code.
- No documentation files unless explicitly requested.

## Code style

- No comments unless the WHY is non-obvious (hidden constraint, workaround for a specific bug, surprising invariant).
- No multi-line docstrings or comment blocks.
- No error handling for impossible cases. Trust framework guarantees. Validate only at system boundaries (user input, external APIs).
- No unused variables prefixed with `_` to silence linters — remove the variable.

## Security

- Never hardcode secrets, tokens, API keys, or credentials.
- Never log sensitive data (passwords, tokens, PII).
- If a vulnerability is introduced (XSS, SQL injection, command injection, etc.), fix it immediately before proceeding.
- If a pre-existing vulnerability is found in adjacent code (not introduced by the current change), do not touch it — emit a loud warning to the user in the chat (bold, clearly marked as a security issue) and continue with the requested scope.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/) — same rules as in [CONTRIBUTING.md](CONTRIBUTING.md).

- Subject ≤ 50 characters.
- No `Co-Authored-By` lines.
- Body only when the "why" is not obvious from the diff.

## Before proposing changes

- Verify TypeScript types pass (`npm run typecheck` if available).
- Respect the existing Prettier config — do not reformat unrelated lines.
- Do not push to remote unless explicitly asked.
- Do not open, close, or comment on issues or pull requests unless explicitly asked.
