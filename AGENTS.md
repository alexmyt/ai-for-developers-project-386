# ai-for-developers-project-386

Учебный проект Хекслета: сервис для бронирования календаря.

## Команды

```bash
mise run setup     # первый запуск: инструменты, зависимости, git-хуки, браузер e2e
mise run check     # все проверки: формат, линтер, типы, тесты, сборка, контракт, SDK, e2e
mise run generate  # TypeSpec → openapi.json → SDK одной командой
pnpm dev           # API на :3000 и Vite на :5173
pnpm check         # то же, что mise run check
pnpm test          # только тесты (Vitest)
pnpm lint          # только ESLint
```

Точечно: `pnpm format`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (браузерный сценарий отдельно), `pnpm e2e:container`.

## Устройство

- `apps/api` — бэкенд на NestJS, состояние в памяти, отдаёт `/api` и статику.
- `apps/web` — фронтенд на React + Vite, SPA гостя и владельца.
- `packages/contract` — TypeSpec, источник истины; из него генерируется `openapi.json`.
- `packages/sdk` — клиент для фронтенда, сгенерированный из `openapi.json`.

Монорепо на pnpm workspaces, контракт-first: сначала TypeSpec, потом API и SDK.
Решения — в `docs/adr/`, правила календаря — в `docs/spec/`, термины — в `GLOSSARY.md`.

### Генерируемые файлы

Эти пути создаются командой `mise run generate` и руками не редактируются:

- `packages/contract/openapi.json` — компилируется из `packages/contract/*.tsp`;
- `packages/sdk/src/**` — генерируется `@hey-api/openapi-ts` из `openapi.json`.

`CHANGELOG.md` ведёт release-please в release-PR — руками его тоже не правим,
форматтеры его игнорируют.

`pnpm check` перегенерирует оба артефакта и падает на `git diff`, если файл
в репозитории устарел; то же делает CI (ADR-0002).

## Коммиты

Сообщения следуют [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

- **Типы**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
- **Scope**: затронутая область — `(docs/agents)`, `(workflow)`; для изменений по всему репозиторию опускается.
- **Subject**: повелительное наклонение, строчная буква, без точки; что изменилось, а не почему.
- **Body**: почему, строки до 72 символов; футер `Refs: #NN` — ссылка на тикет реализации (для новых коммитов; историю не переписываем).
- **Footer**: `BREAKING CHANGE:` для несовместимых изменений и `!` после типа или scope.

Формат проверяет хук `commit-msg`, который ставит `mise run setup`.

## Правила работы

- Общайся в сессиях на русском — основном языке проекта и документации.
- Предпочитай зрелые, поддерживаемые библиотеки самописным реализациям.
- Исправляй причину, а не следствие.
- Проверяй утверждения по первоисточникам — документации и коду; знания из обучения могут быть устаревшими.
- Явно называй допущения, которые меняют поведение решения.
- Сообщай, что проверено и что проверить не удалось.

## Для агентов

- Задачи и спецификации — в GitHub issues через `gh`: `docs/agents/issue-tracker.md`.
- Метки триажа: `docs/agents/triage-labels.md`.
- Доменные документы: `docs/agents/domain.md`.
