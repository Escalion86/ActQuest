# Troubleshooting и диагностика

## Изолированный прогон локальной classic-игры

`node --no-warnings scripts/verifyLocalGameRun.mjs <gameId>` проверяет предстоящую
classic-игру с первым случайным блоком `[1,2,3]`. Подключение берётся из локального
окружения; разрешена только MongoDB на `localhost`/`127.0.0.1`.

Скрипт копирует игру и регистрации в уникальную временную БД, запускает реальные
серверные функции старта, web-прохождения, Game Control и расчёта результатов.
Время ускоряется, вместо реальных участников используется тестовый капитан,
Telegram/push-уведомления отключены. Проверяются полный проход всех команд,
шесть перестановок первых заданий, таймауты, чужие коды и конкурентные ответы.
Исходная БД только читается; в конце сверяются исходные документы, временная БД
удаляется. Это не браузерный тест и не проверка production-нагрузки.

В отчёте `startCounts` показывает число команд на первых трёх стартовых точках,
`startCountsByStep` — баланс каждого из трёх шагов. Скрипт проверяет также ручное
распределение всех команд и одной команды. Для одинаковых шаблонов распределение
с нуля должно давать разницу не больше одной команды на каждом шаге.

## Системы логирования и debug-флаги

### Session/Auth debug

- Префикс: `[session-debug]`.
- Клиент: `components/cabinet/CabinetLayout.js`, `helpers/requestApiJson.js`.
- Сервер: `server/auth/authOptions.js`, `helpers/getSessionSafe.js`, `app/api/cabinet/games-list/route.js`.
- Включение:
  - сервер: `SESSION_DEBUG=1`,
  - клиент: `NEXT_PUBLIC_SESSION_DEBUG=1`.

### Принудительный выбор города

- Префиксы:
  - клиент: `[force-location][client]` (`components/cabinet/CabinetLayout.js`),
  - сервер: `[force-location][server]` (`app/api/cabinet/users/location/route.js`).
- Включение:
  - сервер: `FORCE_LOCATION_DEBUG=1` (или `SESSION_DEBUG=1`),
  - клиент: `NEXT_PUBLIC_FORCE_LOCATION_DEBUG=1` (или `NEXT_PUBLIC_SESSION_DEBUG=1`).
- Ключевые события: `state`, `submit_start`, `submit_response`, `forced_location_set`, `session_update_success/error`, `submit_finish`, `request_received`, `try_filter`, `updated_by_filter`.

### Ошибки (error-level)

- Ошибки пишутся через `console.error` в auth/session/location-цепочке:
  - `server/auth/authOptions.js`
  - `helpers/getSessionSafe.js`
  - `app/api/cabinet/users/location/route.js`
  - `components/cabinet/CabinetLayout.js`
- Для production-анализа собирать stdout/stderr процесса Next.js (PM2/systemd/docker logging driver).

## Troubleshooting (быстрая диагностика)

### 1. Симптом: нельзя редактировать активную игру (поля не вводятся)

- Проверить: `components/cabinet/app-router/GamesPageClient.js` -> `canEditSelectedGame`, роль пользователя, `editingGame`.
- Проверить, что `editingGame` не сбрасывается эффектом на `selectedGameId` при открытой модалке.

### 2. Симптом: в прошедших играх "пусто", но после refresh игры появляются/пропадают

- Проверить: гидрацию фильтра города в `components/cabinet/app-router/GamesPageClient.js` (`isGamesFilterLocationHydrated`).
- Проверить API-фильтрацию: `app/api/cabinet/games-list/route.js`, `helpers/fetchGamesForCabinet.js`.
- Проверить текущий `location` фильтр и роль (hidden-игры доступны не всем).

### 3. Симптом: у игры нет кнопки "Результаты"

- Проверить: наличие `result.computed` (именно это признак сформированного результата в кабинете).
- Проверить snapshots: `result.teams`, `result.gameTeams`, `result.teamsUsers`.
- Пересобрать через `buildGameResultComputed`/dev-пересчет.

### 4. Симптом: рейтинг пересчитан, но карточки/места выглядят неверно

- Проверить, что игра `closed` и `isRated !== false`.
- Проверить, что `teamsPlaces` и `computed` были пересобраны из snapshots.
- Проверить, что в расчет не попали игры без snapshots результата.

### 5. Симптом: фотоквест имеет "странные" места/рейтинг

- Проверить ветку `photo` в `server/buildGameResultComputed.js`.
- Убедиться, что расчет идет по баллам `photos[].checks`, а не по времени.
- Проверить корректность `timeAddings` и штрафов/бонусов.

### 6. Симптом: закрытие игры не обновляет `gameStats`/`rating`

- Проверить `app/api/[location]/games/[id]/route.js` (ветка перехода в `closed`).
- Проверить вызовы `updateParticipantsClosedStats` и `updateParticipantsRatings`.
- Проверить, что `teamsPlaces` присутствует после пересборки результата.
- Для глобального исправления только `gameStats` сначала запустить
  `npm run backfill:participation-stats`, проверить unresolved-ссылки и затем
  применить с `--apply --confirm-db=<имя базы>`.

### 7. Симптом: на Обзоре пользователь видит только 1 сыгранную игру, хотя играл во многих

- **ПРИЧИНА**: пользователь вышел из команды, перешёл в другую команду либо
  завершённая игра осталась в статусе `finished`.
- **РЕШЕНИЕ**: проверить `result.teamsUsers` и `result.teamsPlaces` у игр в
  статусах `finished|closed`.
- Убедиться, что в `fetchGamesForCabinet.js` `userTeamPlace` заполняется из
  snapshot'а; для завершённой игры snapshot авторитетнее текущего членства.
- Проверить, что `userTeamPlace` НЕ `null` — если null, игра отфильтруется в Обзоре.
- **Fallback**: при пустом `result.teamsPlaces` место должно быть = кол-во команд или 1.
- Не сравнивать обычное число сыгранных игр с `rating.playedGames`: рейтинг
  намеренно учитывает только закрытые рейтинговые игры.

### 8. Симптом: модалка обязательного выбора города не закрывается после нажатия "Продолжить"

- Проверить `POST /api/cabinet/users/location` (статус/`ok`, payload).
- Включить debug:
  - клиент: `NEXT_PUBLIC_FORCE_LOCATION_DEBUG=1`,
  - сервер: `FORCE_LOCATION_DEBUG=1`.
- Проверить, что город в профиле/сессии — строковый city key (`krsk`, `nsk`, ...), а не geo-объект.
- Проверить, что резолв города в auth/session идёт через `helpers/resolveUserCityKey.js`.

### 9. Симптом: капитан не видит приквел

- Проверить, что `game.prequel.enabled === true`.
- Проверить, что команда зарегистрирована на игру и пользователь имеет роль `captain` в `TeamsUsers`.
- Проверить, что у игры ещё нет `dateStartFact`.
- Проверить payload страницы `/game/[id]`: в нём должен быть `participantTeams[].gameTeamId`.

### 10. Симптом: штрафы за неверные коды приквела считаются неверно

- Проверить `Games.prequel.wrongAttemptsLimit` и `wrongAttemptsPenalty`.
- Проверить `GamesTeams.prequelProgress.wrongCodes`.
- Проверить `GamesTeams.prequelProgress.wrongPenaltyAppliedCount`.
- Проверить, что штраф начисляется пакетно, а не один раз навсегда.

### 11. Симптом: результат игры не учитывает приквел

- Проверить `GamesTeams.prequelProgress.appliedAdjustments`.
- Проверить `server/buildGameResultComputed.js` и наличие блока `team.prequel` в `result.computed`.
- Для `story` проверить `prequelProgress.appliedStoryEffects` и инициализацию `storyProgress` в `app/api/cabinet/_lib/storyApi.js`.

## Практические задачи и решения

### Задача: Показать кнопку просмотра команд обычным пользователям

**Решение:**

- Условие: `canViewGameTeams && !canManageThisGame` (в отдельном блоке, не в admin-only)
- Открыть с `isTeamsModalReadOnly=true` в `GameTeamsModal`
- Скрыть delete-кнопки и "Добавить команду" при readonly

**Файлы:** `GamesPageClient.js`, `GameTeamsModal.js`, `GameModals.js`

### Задача: Пользователь вышел из команды, но игра не показывается

**Диагностика:**

1. Проверить `result.teamsUsers` — есть ли пользователь там?
2. Проверить `result.teamsPlaces` — есть ли места команд?
3. Проверить `fetchGamesForCabinet.js` — заполняется ли `userTeamPlace` из snapshot'ов?

**Решение:**

- Гарантировать fallback в `fetchGamesForCabinet.js`:
  - Если мест нет → `userTeamPlace = resultTeamsCount || 1`
  - Это КРИТИЧНО для visibility на Обзоре

**Файлы:** `helpers/fetchGamesForCabinet.js`, `app/cabinet/_lib/overviewServerData.js`

### Задача: Скрыть приватные данные (контакты пользователя)

**Решение:**

- Вместо `phone` показывать `gamesCount` и `rating?.rank`
- Паттерн: проверить `user.gamesCount !== undefined` перед отображением
- Для rating: только если `user.rating?.isEligible && Number.isFinite(user.rating?.rank)`

**Файлы:** `UserViewModal.js`, `TeamMemberCard.js`

### Задача: Разрешить просмотр команд на всех статусах игры

**Решение:**

```javascript
const canViewGameTeams =
  typeof game?.status === 'string' && game.status !== 'canceled'
```

**Файлы:** `components/cabinet/app-router/GamesPageClient.js` (обновить в обоих блоках: tile и list)

## Pre-merge чеклист (при изменении логики games/teams/users)

1. **Статусы и переходы:**
   - Проверены сценарии `active -> started -> finished -> closed`, `canceled -> active`, `closed -> reopen`.
   - Убедиться, что `started` нельзя выставить вручную в редакторе.

2. **Редактирование игры:**
   - Сценарий "карточка -> редактировать -> ввод в поле -> сохранить" работает.
   - При открытой модалке редактирования не происходит сброса `editingGame`.

3. **Результаты игры:**
   - Для завершенной/закрытой игры при наличии snapshot формируются `result.teamsPlaces` и `result.computed`.
   - Кнопка "Результаты" отображается корректно (если `computed` есть и `hideResult=false`).

4. **Рейтинг и статистика:**
   - При закрытии игры обновляются `gameStats` и `rating` участников/команд.
   - Для `photo` проверен расчет мест по баллам, для `classic` — по времени.

5. **Фильтры и списки:**
   - Проверены `upcoming/past` с фильтром города и сезонным фильтром.
   - В `past` корректно попадают завершенные/закрытые и просроченные активные/запущенные игры.

6. **Техпроверки:**
   - `npm run lint` без ошибок по измененным файлам.
   - Нет временных `console.log`/debug-кода в финальном diff.

## Техдолг и известные проблемы

### Сброс таймера подсказки при случайном порядке заданий

Исправлено 2026-10-24: общий старт в `server/buildGameStartProgressUpdate.js`
записывал время в `startTime[0]`, даже когда команда начинала с другого задания.
Теперь `server/gameStart.js` передаёт порядок команды и единое время запуска;
время сохраняется по индексу первого задания в этом порядке. Регрессионные
проверки включены в `npm run test:classic-game-process`.

Уже повреждённые записи исправлением кода не восстанавливаются. Для команды,
которая ещё находится на первом шаге и не вводила коды, предусмотрен
`scripts/repairInitialTaskStart.mjs --game <gameId> --team <teamId>`:
без `--apply` он только показывает перенос исходного времени, с `--apply`
сохраняет резервную копию в системной временной папке и применяет перенос.
Скрипт использует БД из окружения проекта и отказывается от записи при
несоответствии ожидаемому состоянию. Перезапускать игру для этого не нужно.

### Дублирование кода

- `gameProcess.js` и `webGameProcess.js` — 80%+ дублированной логики (~800 строк каждый)
- `GameControlPageClient.js` — существует в `components/cabinet/app-router/` (dashboard) и `components/location-game/` (legacy telegram control) — разные компоненты с одинаковым именем
- `secondsToTime` — реализация в `buildGameResultComputed.js` и `telegram/func/secondsToTime.js`

### Безопасность

- Legacy маршруты `/api/[location]/*` защищены auth для записи (`runLocationLegacyHandler`, `requireAuth: 'write'`)
- `transformQuery` в `server/CRUD.js` имеет whitelist допустимых MongoDB-операторов
- Endpoint `/api/[location]/custom` удалён, заменён на `/api/public/discovery` с ограниченным доступом к данным

### ESLint

- Правила `no-undef` и `no-unused-vars` включены как **warn** (ранее были выключены)
- Линтинг покрывает только `app/` и часть `components/cabinet/` (не server, helpers, telegram)
# Проверка устойчивости игрового процесса — 2026-10-25

При повторной проверке защищено также ручное перераспределение через `/api/cabinet/admin/task-distribution`: оно удерживает блокировки игры и команд, строит маршрут по перечитанному прогрессу и сохраняет уже начатую часть маршрута. Для `finished`/`closed` изменение запрещено. Добавлены проверки конкуренции перераспределения и перехода, отказа после СТОП и отложенной записи после истечения блокировки. Исторические результаты не пересчитываются.

В web/cabinet исправлены семь выявленных проблем:

1. При остановке на перерыве уже выполненное текущее задание получает фактическую длительность `endTime - startTime`, а не полный лимит и штраф за невыполнение.
2. Чтение задания завершённой или закрытой игры не запускает автоматические переходы.
3. Ввод ответа, автопереход, капитанские и админские действия используют общую блокировку команды; запись проверяет токен и срок её действия. После ожидания блокировки статус игры перечитывается.
4. Старт сначала подготавливает команды и только затем публикует `started`. Повторный старт не сбрасывает прогресс. Если подготовка прервана, игра остаётся `active`; запуск можно повторить.
5. СТОП удерживает блокировки команд, сохраняет снимок и статус в одной записи игры. Уже принятый ответ входит в снимок; ожидающий запрос после СТОП не продолжает игру. Повторный СТОП не переснимает результат.
6. В игровом web/cabinet-доступе членство и права организатора проверяются по `userId`. Рейтинг и закрытая статистика используют только `uid:`. Историческая запись с Telegram ID без `userId` вызывает `PARTICIPANT_USER_ID_REQUIRED` до записи статистики: связь нужно восстановить явно, автоматического угадывания по Telegram ID нет. Legacy Telegram-движок не является частью этой миграции.
7. Ответы приквела обрабатываются под блокировкой команды с перечитыванием прогресса, поэтому параллельные правильные ответы не затирают друг друга. Права капитана определяются по `userId`.

Проверки:

```sh
npm run test:classic-game-process
npm run test:telegram-identity
npm run test:game-process-lock
npm run test:game-participation
npm run test:story-engine
npm run verify:api-contracts
npm run verify:critical-security
node --no-warnings scripts/gameProcessMongoSafety.mjs
```

Последняя команда разрешает только локальную MongoDB, создаёт уникальную временную тестовую БД и удаляет только её. Проверяет реальные атомарные записи Mongoose, просроченную блокировку и остановку после принятого ответа.

Для сравнения сохранённых результатов с текущим расчётом без записи:

```sh
node --no-warnings scripts/auditGameResultChanges.mjs
node --no-warnings scripts/auditGameResultChanges.mjs --game GAME_ID
```

На локальной копии проверено 48 результатов, различия обнаружены в 15. Они могут включать накопленные изменения правил расчёта, а не только исправление СТОП на перерыве. Этот скрипт не обновляет места, снимки или рейтинг. Исторические результаты требуют отдельного разбора перед пересчётом.
