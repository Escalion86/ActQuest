# Game History And Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить для игр полноценную историю изменений с просмотром `before/after`, server-side rollback до выбранной записи и модалкой истории на карточке игры.

**Architecture:** История строится на отдельной коллекции `GameHistoryEntries`, которая хранит actor metadata, summary, diff и rollback snapshot согласованного состояния `Games` + `GamesTeams`. Запись истории встраивается в ключевые mutation-path’ы игр, чтение и rollback выносятся в отдельные кабинетные API, а UI добавляется отдельной модалкой из карточки игры.

**Tech Stack:** Next.js App Router, React 19, Mongoose 9, MongoDB 7, PropTypes, Node test runner (`node:test`), ESLint.

---

### Task 1: Ядро истории и тесты helper’ов

**Files:**
- Create: `schemas/gameHistoryEntriesSchema.js`
- Modify: `utils/dbConnectGlobal.js`
- Create: `server/gameHistory/normalizeGameHistoryState.js`
- Create: `server/gameHistory/buildGameHistoryDiff.js`
- Create: `server/gameHistory/buildGameHistorySummary.js`
- Create: `server/gameHistory/buildGameHistoryWarnings.js`
- Create: `server/gameHistory/buildGameHistoryActor.js`
- Create: `server/gameHistory/recordGameHistoryEntry.js`
- Test: `scripts/gameHistoryState.test.js`
- Test: `scripts/gameHistoryDiff.test.js`

- [ ] Написать failing test для нормализации состояния истории: сериализация `Games`, `GamesTeams`, дат, `ObjectId`-подобных значений и вычищение служебных полей.
- [ ] Запустить `node --test scripts/gameHistoryState.test.js` и убедиться, что тест падает по ожидаемой причине.
- [ ] Реализовать `normalizeGameHistoryState.js` минимально до прохождения теста.
- [ ] Повторно запустить `node --test scripts/gameHistoryState.test.js` и убедиться, что тест проходит.
- [ ] Написать failing test для `buildGameHistoryDiff.js` на сценарии: изменение поля игры, изменение массива тарифов/финансов и изменение списка команд.
- [ ] Запустить `node --test scripts/gameHistoryDiff.test.js` и убедиться, что тест падает по ожидаемой причине.
- [ ] Реализовать минимальные `buildGameHistoryDiff.js`, `buildGameHistorySummary.js`, `buildGameHistoryWarnings.js`, `buildGameHistoryActor.js` и `recordGameHistoryEntry.js`.
- [ ] Повторно запустить `node --test scripts/gameHistoryDiff.test.js` и убедиться, что тест проходит.
- [ ] Добавить схему `GameHistoryEntries` и зарегистрировать модель в `utils/dbConnectGlobal.js`.

### Task 2: Rollback engine и тесты отката

**Files:**
- Create: `server/gameHistory/rollbackGameToHistoryEntry.js`
- Test: `scripts/gameHistoryRollback.test.js`

- [ ] Написать failing test для rollback-движка на сценарии: выбранный snapshot должен восстановить `Games` и точный набор `GamesTeams`, а более новые данные должны исчезнуть.
- [ ] Запустить `node --test scripts/gameHistoryRollback.test.js` и убедиться, что тест падает по ожидаемой причине.
- [ ] Реализовать минимальный rollback engine с восстановлением `Games`, upsert/delete для `GamesTeams` и записью metadata для `rollback_applied`.
- [ ] Повторно запустить `node --test scripts/gameHistoryRollback.test.js` и убедиться, что тест проходит.

### Task 3: Интеграция записи истории в mutation-path’ы

**Files:**
- Modify: `app/api/[location]/games/[id]/route.js`
- Modify: `app/api/cabinet/games/[gameId]/teams/route.js`
- Modify: `app/api/cabinet/games/[gameId]/result/route.js`
- Modify: `app/api/cabinet/admin/story-editor/route.js`
- Modify: `app/api/cabinet/admin/game-status/action/route.js`

- [ ] Встроить запись `game_updated` и `game_status_changed` в `app/api/[location]/games/[id]/route.js` с захватом `before/after` и snapshot.
- [ ] Встроить `team_registered`, `team_unregistered`, `team_adjustments_updated`, `team_out_of_competition_changed` в `app/api/cabinet/games/[gameId]/teams/route.js`.
- [ ] Встроить `results_rebuilt` в `app/api/cabinet/games/[gameId]/result/route.js`.
- [ ] Встроить `game_updated` для story-редактора в `app/api/cabinet/admin/story-editor/route.js`.
- [ ] Добавить запись live-admin действий в `app/api/cabinet/admin/game-status/action/route.js`, только если они реально меняют состояние прохождения и должны попадать в историю игры.

### Task 4: API чтения истории и rollback

**Files:**
- Create: `app/api/cabinet/games/[gameId]/history/route.js`
- Create: `app/api/cabinet/games/[gameId]/history/[entryId]/route.js`
- Create: `app/api/cabinet/games/[gameId]/history/[entryId]/rollback/route.js`
- Create/Modify: helper доступа рядом с существующей permission-логикой, если потребуется отдельный reusable helper

- [ ] Реализовать список истории с проверкой прав `admin/dev`, организатор, модератор.
- [ ] Реализовать endpoint детальной записи с `before`, `after`, `diff`, `warnings`, `canRollback`.
- [ ] Реализовать rollback endpoint с confirm-safe серверной логикой, warnings про `started` и про рассинхрон рейтингов/статистики.

### Task 5: UI истории игры

**Files:**
- Create: `components/modals/GameHistoryModal.js`
- Modify: `components/modals/GameModals.js`
- Modify: `components/cabinet/app-router/GamesPageClient.js`
- Modify: `components/cabinet/CardActionIconButton.js` (если потребуется отдельная иконка)

- [ ] Добавить action-кнопку `История` на карточку игры только для пользователей с доступом управления игрой.
- [ ] Подключить `GameHistoryModal` через `GameModals`.
- [ ] Реализовать загрузку списка истории, раскрытие карточки, показ `before/after/diff` и warnings.
- [ ] Реализовать confirm rollback с красным warning для `started` игры и предупреждением о рейтингах.

### Task 6: Проверка и документация

**Files:**
- Modify: `docs/roadmap.md`
- Verify: `scripts/gameHistoryState.test.js`
- Verify: `scripts/gameHistoryDiff.test.js`
- Verify: `scripts/gameHistoryRollback.test.js`

- [ ] Если реализация заметно продвигает roadmap, обновить `docs/roadmap.md` формулировкой про историю изменений игр.
- [ ] Запустить `node --test scripts/gameHistoryState.test.js scripts/gameHistoryDiff.test.js scripts/gameHistoryRollback.test.js`.
- [ ] Запустить `npm run lint`.
- [ ] Сверить против спеки: запись истории, чтение карточек, rollback, warnings и права доступа.
