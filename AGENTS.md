# ai-for-developers-project-386

Учебный проект Хекслета: сервис для бронирования календаря.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

- **Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
- **Scope**: the area touched — `(docs/agents)`, `(workflow)` — omitted for repo-wide changes.
- **Subject**: imperative mood, lowercase, no trailing period; what changed, not why.
- **Body**: the why, wrapped at 72 columns; a `BREAKING CHANGE:` footer for incompatible changes, with `!` after the type or scope.

This rule supersedes the plain-sentence style of the existing history.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `alexmyt/ai-for-developers-project-386`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md`, `docs/adr/` and `docs/spec/` at the repo root. See `docs/agents/domain.md`.
