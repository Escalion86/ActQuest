# Roadmap: единая база пользователей (`actquest_global`)

## Легенда статусов

- [x] Выполнено
- [~] В процессе
- [ ] Не начато

## Последняя проверка

Дата: 2026-04-26

Ключевые файлы-источники статусов:
- `utils/dbConnectGlobal.js`
- `app/api/auth/[...nextauth]/route.js`
- `helpers/getSessionSafe.js`
- `helpers/authenticatePhoneUser.js`
- `helpers/authenticateVkUser.js`
- `helpers/authenticateTelegramUser.js`
- `helpers/registerPhoneUser.js`
- `scripts/migrateAllToGlobalDb.js`
- `scripts/verifyGlobalMigration.js`
- `schemas/usersSchema.js`
- `helpers/fetchAdminUsersForCabinet.js`
- `helpers/fetchGamesForCabinet.js`
- `helpers/fetchTeamsForCabinet.js`
- `app/api/cabinet/users/profile/route.js`
- `app/api/cabinet/users/location/route.js`
- `app/api/cabinet/teams/route.js`
- `app/api/cabinet/teams/[id]/route.js`
- `app/api/cabinet/teams/members/route.js`
- `app/api/cabinet/teams/members/[id]/route.js`
- `app/api/cabinet/games/[gameId]/teams/route.js`
- `app/api/cabinet/games/route.js`
- `app/api/cabinet/game-details/route.js`
- `app/api/cabinet/games/[gameId]/result/route.js`
- `app/api/cabinet/games/[gameId]/push-broadcast/route.js`
- `app/api/cabinet/dev/backfill-game-creators/route.js`

Шаблон обновления:
- Обновить дату в этом блоке.
- Проверить актуальность статусов по ключевым файлам и миграционным скриптам.
- Обновить статусы этапов и Definition of Done:
  - `[x]` — завершено,
  - `[~]` — в процессе,
  - `[ ]` — не начато.
- Если менялся поток данных (auth/session/user APIs), добавить/обновить соответствующие файлы в списке источников.

## Цель
Перевести пользователей из отдельных городских БД в одну глобальную БД (`actquest_global`) без потери доступа, с обратной совместимостью для текущих сценариев.

## Текущее состояние
- [~] Пользователи (`Users`) исторически хранились отдельно в БД каждого города; текущий source of truth для auth/кабинета — global DB.
- Авторизация (`phone`, `vk`, `telegram`) пишет и читает `Users` из `dbConnectGlobal()`.
- Бизнес-данные игр/команд уже логично привязаны к городу и могут оставаться в городских БД.

## Архитектурное решение
- Оставляем городские БД для игровых сущностей (`Games`, `Teams`, `TeamsUsers`, `GamesTeams`, и т.д.).
- Выносим идентичность и профиль пользователя в глобальную БД:
  - `users_global` (основной профиль, методы входа, роль, настройки).
  - `user_locations` (привязки к городам, локальные роли/статусы при необходимости).
  - `legacy_user_links` (связь со старыми `_id`/`telegramId` по городам на период миграции).
- В сессии сохраняем `globalUserId` как первичный идентификатор.

## Этапы
1. Подготовка инфраструктуры (без изменения поведения)
- [x] Добавить `dbConnectGlobal`.
- [x] Добавить аудит/миграционные скрипты консолидации пользователей между городами.
- [x] Описать и реализовать правила merge (приоритет phone > vkId > telegramId, fallback по эвристикам).

2. Миграция данных (dry-run -> write)
- [~] Сгенерировать отчёт по дублям/конфликтам.
- [~] Сформировать коллекцию `users_global` и таблицу соответствий старых id.
- [x] Повторяемая миграция (идемпотентная), чтобы можно было запускать несколько раз.

3. Dual-write в авторизации
- [x] `authenticatePhoneUser`, `authenticateVkUser`, `authenticateTelegramUser`:
  - писать в глобальную БД (источник истины),
  - при необходимости синхронно обновлять legacy-запись в выбранном городе.
- [x] В `next-auth` session/jwt добавить `globalUserId`.

4. Переход чтения на global
- [~] Кабинет и API пользователей читать из глобальной БД.
- [~] Городские API, где нужен пользователь, использовать `globalUserId` + таблицу связей.

5. Удаление legacy-зависимостей
- [x] Убрать жёсткую привязку к `telegramId` как обязательному ключу.
- [~] Убрать чтение/запись `Users` из городских БД там, где это уже не требуется.
- [~] Связки `Users -> TeamsUsers -> Teams` в кабинетных API переведены на `userId` (`Users._id`); fallback по `userTelegramId` в связках отключён, legacy-ветки Telegram/WebApp ещё требуют точечного cleanup.
- [~] Связка `Games -> creator` начала переход на `creatorUserId`: новые игры сохраняют `creatorUserId`, права управления в основных cabinet API проверяются по `creatorUserId`, `creatorTelegramId` оставлен fallback для исторических игр; добавлен dev backfill для заполнения `creatorUserId` у старых игр по однозначному совпадению `creatorTelegramId -> Users.telegramId`.

## Риски и контроль
- Риск неправильного merge дублей.
  - Контроль: dry-run отчёты, белый список ручных конфликтов, повторяемая миграция.
- Риск регрессии авторизации.
  - Контроль: фича-флаг `AUTH_USE_GLOBAL_DB`, поэтапное включение.
- Риск потери ссылочной целостности.
  - Контроль: коллекция `legacy_user_links` и обратная проверка после миграции.

## Критерии готовности (Definition of Done)
- [x] Новый пользователь создаётся только в `actquest_global`.
- [~] Существующий пользователь логинится любым методом и получает один `globalUserId`.
- [~] Кабинет работает без обязательного `telegramId`; membership-связки в кабинетных API идут по `userId`.
- [x] Старые пользователи продолжают входить без ручного вмешательства.

## Приоритеты

- `P1`:
  - Довести до `[x]` сценарий единого `globalUserId` для всех методов входа и всех ключевых API кабинета.
  - Закрыть оставшиеся legacy-зависимости по чтению/записи `Users` вне global-first потока.
- `P2`:
  - Завершить миграционные отчёты по дублям/конфликтам и документировать ручные разрешения конфликтов.
  - Финализировать переход чтения пользовательских данных на global во всех серверных срезах.
- `P3`:
  - Убрать/архивировать временные migration-хаки и подготовить финальный cleanup legacy-кода.
