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
- No unused variables prefixed with `_` to silence linters, remove the variable.
- ASCII only in source and docs. No em dash, no accented or other non-ASCII characters (CI compliance blocks them).

## Security

- Never hardcode secrets, tokens, API keys, or credentials.
- Never log sensitive data (passwords, tokens, PII).
- If a vulnerability is introduced (XSS, SQL injection, command injection, etc.), fix it immediately before proceeding.
- If a pre-existing vulnerability is found in adjacent code (not introduced by the current change), do not touch it, emit a loud warning to the user in the chat (bold, clearly marked as a security issue) and continue with the requested scope.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/), same rules as in [CONTRIBUTING.md](CONTRIBUTING.md).

- Subject 50 characters or fewer.
- No `Co-Authored-By` lines.
- Body only when the "why" is not obvious from the diff.
- The **PR title** is the gate validated by CI (squash merge uses it), so it must be a valid Conventional Commit, not just the individual commits.

## Dependencies

- Do not add a dependency without a clear need; prefer existing ones.
- New dependencies must not introduce high or critical advisories (`npm audit --audit-level=high` blocks CI).

## Before proposing changes

Run the same gates CI enforces, in this order:

- Lint with zero warnings: `npm run lint -- --max-warnings 0`.
- Type check: `npx tsc --noEmit`.
- Validate the Prisma schema when `prisma/` changes: `npx prisma validate`.
- Confirm the build passes without real secrets: `npm run build`.

Also:

- Respect the existing Prettier config, do not reformat unrelated lines.
- Do not push to remote unless explicitly asked.
- Do not open, close, or comment on issues or pull requests unless explicitly asked.
