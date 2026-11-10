# ai-for-developers-project-386

Учебный проект Хекслета: сервис для бронирования календаря.

## Команды

```bash
mise run setup   # первый запуск: инструменты, зависимости, git-хуки
pnpm dev         # API на :3000 и Vite на :5173
pnpm check       # все проверки: формат, линтер, типы, тесты, сборка, контракт
pnpm test        # только тесты (Vitest)
pnpm lint        # только ESLint
```

Точечно: `pnpm format`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`.

## Устройство

- `apps/api` — бэкенд на NestJS, состояние в памяти, отдаёт `/api` и статику.
- `apps/web` — фронтенд на React + Vite, SPA гостя и владельца.
- `packages/contract` — TypeSpec, источник истины; из него генерируется `openapi.json`.
- `packages/sdk` — клиент для фронтенда, сгенерированный из `openapi.json`.

Монорепо на pnpm workspaces, контракт-first: сначала TypeSpec, потом API и SDK.
Решения — в `docs/adr/`, правила календаря — в `docs/spec/`, термины — в `GLOSSARY.md`.

## Коммиты

Сообщения следуют [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

- **Типы**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
- **Scope**: затронутая область — `(docs/agents)`, `(workflow)`; для изменений по всему репозиторию опускается.
- **Subject**: повелительное наклонение, строчная буква, без точки; что изменилось, а не почему.
- **Body**: почему, строки до 72 символов; футер `BREAKING CHANGE:` для несовместимых изменений и `!` после типа или scope.

Формат проверяет хук `commit-msg`, который ставит `mise run setup`.

## Для агентов

- Задачи и спецификации — в GitHub issues через `gh`: `docs/agents/issue-tracker.md`.
- Метки триажа: `docs/agents/triage-labels.md`.
- Доменные документы: `docs/agents/domain.md`.
