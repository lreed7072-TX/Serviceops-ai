# Repository Guidelines

## Project Structure & Module Organization
This repository currently contains a single file: `Untitled.rtf` at the repo root. There is no established source tree yet. As the project grows, prefer a clear layout such as `src/` for application code, `tests/` for automated tests, `docs/` for documentation, and `assets/` for static files. Keep top-level files limited to essentials (README, license, configs).

## Build, Test, and Development Commands
No build or test tooling is configured yet. When adding tooling, document the exact commands in this section (for example, `npm run build`, `npm test`, or `make dev`) and keep them runnable from the repo root. Ensure commands are deterministic and list any required environment variables in `README` or a `.env.example`.

## Coding Style & Naming Conventions
No language or formatter is established. When introducing code, pick one formatter/linter and apply it consistently (for example, `prettier` for JS/TS or `black` for Python). Use 2-space or 4-space indentation consistently within each language. Prefer descriptive, lowercase directory names (`src/services/`) and use language-idiomatic naming for modules and classes.

## Testing Guidelines
No testing framework is defined. When adding tests, colocate them in a dedicated `tests/` directory or alongside source files with a clear suffix (for example, `*.test.ts`, `*_test.py`). Document how to run unit tests and any coverage thresholds once established.

## Commit & Pull Request Guidelines
No commit history or conventions are present. Until conventions are defined, use clear, imperative commit messages (for example, `Add billing service`) or adopt Conventional Commits (`feat:`, `fix:`) for consistency. Pull requests should include a concise description, linked issue/ticket when applicable, and screenshots or logs for user-facing changes.

## Security & Configuration Tips
Do not commit secrets. If the project needs configuration, add a `.env.example` and document required variables. Keep credentials and local data out of version control.

## Agent-Specific Instructions
Keep changes focused and avoid introducing new tooling without documenting it here. Prefer ASCII in docs and code unless non-ASCII is required.
