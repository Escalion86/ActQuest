# Troubleshooting и диагностика

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

### 7. Симптом: на Обзоре пользователь видит только 1 сыгранную игру, хотя играл во многих

- **ПРИЧИНА**: Пользователь вышел из команды, с которой играл в прошлых играх.
- **РЕШЕНИЕ**: Проверить `result.teamsUsers` и `result.teamsPlaces` у этих игр.
- Убедиться, что в `fetchGamesForCabinet.js` логика fill `userTeamPlace` из snapshot'ов работает:
  - Она должна работать в обоих блоках: при текущем членстве и при поиске по snapshot'ам.
- Проверить, что `userTeamPlace` НЕ `null` — если null, игра отфильтруется в Обзоре.
- **Fallback**: при пустом `result.teamsPlaces` место должно быть = кол-во команд или 1.

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
