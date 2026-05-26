# Game Assignment Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** перевести модераторов и агентов игр с глобальных ролей пользователя на отдельные assignment-флаги и сохранить доступ к уже назначенным играм.

**Architecture:** системная роль пользователя ограничивается списком `client/admin/dev/ban`, а игровые права определяются helper-функциями по факту назначения пользователя в `game.moderators` и `game.agents`. UI редакторов пользователя и игры получает новые булевы флаги через admin users API, а production-миграция переводит существующие данные в новую модель.

**Tech Stack:** Next.js App Router, React 19, Mongoose 9, Node test scripts in `scripts/`

---

### Task 1: Зафиксировать доступы чистыми helper-тестами

**Files:**
- Create: `scripts/gameAssignmentAccess.test.js`
- Modify: `scripts/cabinetGameVisibility.test.js`
- Test: `scripts/gameAssignmentAccess.test.js`, `scripts/cabinetGameVisibility.test.js`

- [ ] Добавить failing-тесты на доступ `admin/dev`, доступ модератора игры по `game.moderators`, доступ агента по `game.agents`, и запрет доступа по одному только флагу назначения.
- [ ] Запустить `node --test scripts/gameAssignmentAccess.test.js scripts/cabinetGameVisibility.test.js` и зафиксировать red phase.
- [ ] Реализовать helper-функции минимальным кодом.
- [ ] Повторно запустить `node --test scripts/gameAssignmentAccess.test.js scripts/cabinetGameVisibility.test.js` и убедиться, что green phase достигнута.

### Task 2: Перевести модель пользователя и admin users API

**Files:**
- Modify: `schemas/usersSchema.js`
- Modify: `helpers/userRoles.js`
- Modify: `helpers/userRole.js`
- Modify: `helpers/isUserModer.js`
- Modify: `helpers/ensureRole.js`
- Modify: `helpers/fetchAdminUsersForCabinet.js`
- Modify: `helpers/normalizeUserProfile.js`
- Modify: `app/api/cabinet/admin/users-list/route.js`
- Modify: `app/api/cabinet/admin/users/[id]/route.js`
- Modify: `app/api/cabinet/user-details/route.js`

- [ ] Добавить failing-тесты/проверки на недопустимость сохранения `role=moder|agent` и на возврат новых флагов пользователю.
- [ ] Обновить схему и нормализацию системных ролей до `client/admin/dev/ban`.
- [ ] Добавить `canBeGameModerator` и `canBeGameAgent` в ответы и сохранение admin users API.
- [ ] Добавить фильтрацию users-list по новым query-параметрам assignment-флагов.
- [ ] Запустить точечные node-тесты и проверить, что API-ориентированная нормализация стала консистентной.

### Task 3: Перевести UI редактора пользователей и источник списков для игры

**Files:**
- Modify: `components/cabinet/modals/UserEditModal.js`
- Modify: `components/cabinet/app-router/AdminUsersPageClient.js`
- Modify: `components/cabinet/cards/AdminUserCard.js`
- Modify: `components/cabinet/app-router/GamesPageClient.js`

- [ ] Добавить failing-проверку на то, что UI больше не посылает `moder/agent` как системную роль.
- [ ] Заменить выбор `Модератор`/`Агент` в редакторе пользователя на два чекбокса assignment-флагов.
- [ ] Перевести `GamesPageClient` на загрузку списков модераторов/агентов через новые фильтры users-list.
- [ ] Проверить, что уже выбранные в игре модераторы/агенты продолжают отображаться корректно.

### Task 4: Перевести серверные проверки доступа к играм

**Files:**
- Create: `helpers/gameAssignmentAccess.js`
- Modify: `helpers/cabinetGameVisibility.js`
- Modify: `app/api/cabinet/admin/game-status/route.js`
- Modify: `app/api/cabinet/admin/game-status/action/route.js`
- Modify: `app/api/cabinet/admin/photo-review/route.js`
- Modify: `app/api/cabinet/admin/task-preview/route.js`
- Modify: `app/api/cabinet/agent/games/route.js`
- Modify: `app/api/cabinet/agent/game-status/route.js`
- Modify: `server/agentGameStatus.js`

- [ ] Перевести маршруты на общие helper-функции доступа по назначению в игре.
- [ ] Убрать зависимость от системных ролей `moder` и `agent`.
- [ ] Сохранить bypass только для `admin/dev`.
- [ ] Повторно прогнать node-тесты по доступам и убедиться, что назначенный в игру пользователь проходит, а неназначенный нет.

### Task 5: Ослабить page-level gate и добавить production-миграцию

**Files:**
- Modify: `app/cabinet/agent/page.js`
- Modify: `app/cabinet/agent/game-control/page.js`
- Modify: `app/cabinet/admin/photo-review/page.js`
- Modify: `app/cabinet/admin/task-preview/page.js`
- Create: `scripts/migrateGameAssignmentRoles.js`
- Modify: `package.json`

- [ ] Убрать жёсткие page-level проверки по `moder/agent`, оставив авторизацию и серверный контроль через API.
- [ ] Написать migration script с `--dry-run` и `--apply`.
- [ ] Добавить npm script для запуска миграции.
- [ ] Запустить `node --test ...` для регрессии и `npm run lint`.
- [ ] Зафиксировать, что миграционный скрипт не меняет данные без `--apply`.
