# Логика игр ActQuest

## Типы игр

### classic (автоквест)
- Команды ищут коды на локациях в реальном времени
- Результат: места по времени прохождения
- Поля: `tasks[].codes`, `tasks[].clues`, `tasks[].subTasks`
- Настройки: `taskDuration`, `cluesDuration`, `breakDuration`

### photo (фотоквест)
- Команды отправляют фото в заданиях через web-интерфейс
- Результат: места по сумме баллов (проверка модератором)
- Поля: `tasks[].photos`, `photos[].checks`
- Проверка: `/cabinet/admin/photo-review`
- Важно: считать по баллам, НЕ по времени

### story (сюжетный квест)
Подробнее в [docs/story-engine.md](story-engine.md)

## База данных (краткий обзор)

### Основные коллекции

**Games** (`gamesSchema.js`)
- Ключевые поля: `name`, `type` (classic/photo/story), `status`, `location`, `seasonId`
- Временные: `dateStart`, `dateStartFact`, `dateEndFact`
- Настройки игры: `taskDuration`, `cluesDuration`, `breakDuration`
- Результат: `result` (object с snapshots и computed)
- Скрытие/рейтинг: `hidden`, `isRated`, `hideResult`
- Корпоративные: `orderType` (public/private/corporate), `sourceOrderId`, `clientName`, `clientContact`
- Модераторы: `moderators` (Array of ObjectId → Users)

**Teams** (`teamsSchema.js`)
- `name`, `name_lowered` (для поиска), `description`, `image`
- `open` (открыта для вступления), `location`, `carSkin`
- Рейтинг: `rating`, `ratingsByLocation`
- Статистика: `gameStats`

**Users** (`usersSchema.js`)
- Аутентификация: `telegramId`, `vkId`, `phone`, `passwordHash`, `authMethod`
- Локация: `currentLocation` (основное), `accountLocation` (совместимость), `location` (geo-объект, legacy)
- Профиль: `name`, `username`, `photoUrl`, `about`, `languageCode`, `isPremium`
- Рейтинг: `rating`, `ratingsByLocation`
- Статистика: `gameStats`, `bonusBalance`
- Push: `pushSubscriptions` (Web Push)
- Роль: `role` (client/moder/admin/dev)
- Глобальный ID: `globalUserId`

**TeamsUsers** (`teamsUsersSchema.js`)
- Связь пользователя с командой: `teamId`, `userId` (или `userTelegramId`)
- Роль в команде: `role` (captain/participant)

**GamesTeams** (`gamesTeamsSchema.js`)
- Регистрация команды на игру: `gameId`, `teamId`, `outOfCompetition`
- Процесс игры: `activeNum` (текущее задание), `startTime[]`, `endTime[]`
- Коды: `findedCodes[]`, `wrongCodes[]`, `findedBonusCodes[]`, `findedPenaltyCodes[]`
- Photo: `photos[taskIndex].photos`, `photos[taskIndex].checks`
- Story: `storyProgress` (status, inventory, history)

### Связи в БД

```
Games
  ├── result.teams[] — snapshot команд (при СТОП ИГРА)
  ├── result.gameTeams[] — связь игры с командами (snapshot)
  └── result.teamsUsers[] — участники команд (snapshot, важно!)

GamesTeams (текущие регистрации)
  └── gameId -> teamId (активные связи)

Teams
  ├── id
  ├── name
  └── members (через TeamsUsers)

TeamsUsers (члены команды - текущие)
  └── userId/userTelegramId -> teamId -> role
```

## Ключевая бизнес-логика игр

### Статусы и переходы

- Разрешенные статусы: `active`, `started`, `finished`, `closed`, `canceled`.
- `started` ставится только через запуск игры (не вручную в редакторе).
- `finished` — итог `СТОП ИГРА`.
- `closed` — финальное закрытие после проведения.
- Нельзя закрывать игру, если она не была проведена.
- При `reopen`:
  - если есть snapshots результата (`result.teams/gameTeams/teamsUsers`) -> `finished`,
  - иначе -> `active`.

### Результаты игры

- Источник истины для пересборки результата: `result.teams`, `result.gameTeams`, `result.teamsUsers`.
- `teamsPlaces` и `computed` должны строиться из snapshot'ов через:
  - `server/buildGameResultComputed.js`.
- Кнопка/доступ к результатам в кабинете ориентируется на наличие `result.computed`.
- Доступ к кнопке "Результаты" в `GamesPageClient.js`:
  - для `admin/dev` и модераторов игры (проверка `canManageGameStatus`) — кнопка доступна всегда, если игра `finished|closed` и есть `result.computed`,
  - для обычного пользователя — только если игра `finished|closed`, есть `result.computed` и `hideResult !== true`.
- Если snapshot'ов нет, результат пересобрать нельзя (игра пропускается в таких операциях).

### Когда формировать snapshots

- Snapshot результата нужно фиксировать на `СТОП ИГРА` (`finished`), чтобы сохранить исторический состав команд/участников.

### Структура `result` в Documents Games (БД)

`result` — это объект в документе Game, который хранит:

- **Снимки состояния** (snapshots): команды, участники, результаты на момент `СТОП ИГРА`
- **Вычисленные метрики**: места команд, итоговые баллы, тайм-коды

```javascript
result: {
  // === SNAPSHOTS (сохраняются при СТОП ИГРА) ===
  teams: [
    // Массив команд, участвовавших в игре (на момент завершения)
    { id, name, captainId, price, ... }
  ],
  gameTeams: [
    // Связь game->teams, фиксирует состояние регистрации команд
    { gameId, teamId, status, joinedAt, ... }
  ],
  teamsUsers: [
    // Участники в командах (на момент завершения игры)
    // КРИТИЧНО: эти данные остаются даже если пользователь позже вышел из команды
    { userId, userTelegramId, teamId, role, ... }
  ],

  // === COMPUTED (строятся из snapshots) ===
  teamsPlaces: {
    // Map/Object: teamId -> место в таблице (1, 2, 3, ...)
    "team_id_1": 1,
    "team_id_2": 2,
  },
  computed: {
    // Полный результат с вычислениями:
    // - для classic: места по времени прохождения
    // - для photo: места по сумме баллов
    // Структура:
    {
      teamsStats: [
        {
          teamId,
          place,
          time, // для classic
          score, // для photo
          penalties,
          ...
        }
      ],
      // ... другие вычисленные метрики
    }
  }
}
```

### Ключевые нюансы работы с `result`

1. **Snapshots — источник правды:**
   - `result.teamsUsers` сохраняет ВСЕ участников на момент завершения
   - Даже если пользователь позже вышел из команды, он остается в snapshot'е
   - Это позволяет корректно отображать игры в кабинете пользователя, даже если он уже не в команде

2. **Получение мест пользователя:**
   - При загрузке игр в `fetchGamesForCabinet.js`:
     - Сначала ищем места через текущее членство пользователя (GamesTeams + TeamsUsers)
     - Если места нет (пользователь вышел из команды), ищем в `result.teamsUsers`
     - Место берется из `result.teamsPlaces` по ID команды
     - **Fallback**: если `result.teamsPlaces` пусто для старых игр, используем кол-во команд в `result.teams` или 1

3. **Отображение в Обзоре (Overview):**
   - На странице `/cabinet` показываются сыгранные игры из `pastGames`
   - Фильтруются по `userTeamPlace > 0`
   - **ВАЖНО**: Если `userTeamPlace` не заполнен (null), игра не отобразится!
   - Решение: гарантировать, что `userTeamPlace` ВСЕГДА имеет значение, даже если snapshot'ы неполные

4. **Когда формируются snapshots:**
   - На `СТОП ИГРА` (`finished` status) через `buildGameResultComputed.js`
   - Включает: teams, gameTeams, teamsUsers, teamsPlaces
   - `computed` строится из этих snapshot'ов
   - Если snapshot'ов нет → результат не сформирован → нельзя пересчитывать

5. **Для `photo` игр:**
   - `result.computed` содержит `photos` массив с проверками и баллами
   - Места считаются по `score`, а не по времени
   - `timeAddings` — корректировки очков, не время прохождения

## Рейтинг и статистика

- Основные файлы:
  - `server/updateParticipantsRatings.js`
  - `server/updateParticipantsClosedStats.js`
  - `app/api/cabinet/dev/recalculate-ratings/route.js`
- В рейтинге учитываются только `closed` + `isRated !== false`.
- Для Dev-пересчета: перед метриками нужно пересобирать `teamsPlaces` и `computed` (если есть snapshots).
- Глобальный рейтинг: без разделения по городам (location в snapshot может быть `null`).
- При равном `finalScore` место должно быть одинаковым (tie rank).
- Пропуски считаются по сезонам:
  - если участник играл в сезоне хотя бы одну игру, пропущенные игры этого сезона дают miss,
  - если не играл в сезоне ни разу, miss за сезон не начисляется.

## Частые нюансы при работе с историческими snapshot'ами

1. **Если `result.teamsUsers` пусто:**
   - Это старая игра без сохраненного snapshot'а, результат неполный
   - Игра может не отобразиться в истории пользователя
   - Нужно пересобрать результат через dev-операцию или перепроверить логику сохранения

2. **Если `result.teamsPlaces` пусто, но `result.teams` есть:**
   - Места не были вычислены (может быть ошибка в `buildGameResultComputed`)
   - Fallback: использовать кол-во команд как последнее место или 1
   - **Не игнорировать игру** — пользователь все равно участвовал

3. **При вышедшем из команды пользователе:**
   - GamesTeams не содержит текущую связь (user -> game)
   - TeamsUsers (текущие) не содержит пользователя
   - **ЧТО СПАСАЕТ**: `result.teamsUsers` в snapshot'е остается
   - Логика поиска идет: текущее членство → backup'ы → snapshot'ы

4. **Получение places для нескольких команд:**
   - Если пользователь участвовал в нескольких командах в одной игре (редко):
   - Используем минимальное место (`Math.min(...places)`)
   - Это правильно, так как рейтинг должен быть лучший из возможных

5. **Формирование `userParticipationTeams`:**
   - Должен содержать массив всех команд пользователя в этой игре
   - Используется для отображения: "Вы участвовали: Команда 1, Команда 2"
   - Заполняется из текущего членства ИЛИ из snapshot'ов, если вышел

### Ключевые различия: Текущее vs Историческое

| Что | Источник | Когда использовать |
| --- | --- | --- |
| **Текущая команда** | `TeamsUsers` (БД) | Проверка текущего членства, редактирование |
| **Историческая команда** | `result.teamsUsers` (snapshot) | Отображение игры, если user вышел (fallback) |
| **Места команд** | `result.teamsPlaces` (snapshot) | Всегда из result (источник истины) |

### Когда ищем команды пользователя в игре

1. **Если есть текущее членство** → берём из `GamesTeams` + `TeamsUsers`
2. **Если нет текущего членства** → ищем в `result.teamsUsers` (fallback для вышедших)
3. **Если нет ничего** → игра не показывается (лучше скрыть, чем показать с ошибкой)

## Количество команд на карточках игр (teamsCount)

- Для `active`/`started`/`canceled` — подсчёт из коллекции `GamesTeams` (текущие регистрации)
- Для `finished`/`closed` — из `result.teams.length` (snapshot)
- Реализация в `fetchGamesForCabinet.js`

## Фильтрация upcoming/past игр

- Фильтр работает на уровне MongoDB-запроса (НЕ в памяти после пагинации!)
- `upcoming`: `{ $or: [{ dateStart: { $gte: now } }, { status: { $in: ['active', 'started'] } }] }`
- `past`: `{ $or: [{ dateStart: { $lt: now } }, { status: { $in: ['finished', 'closed', 'canceled'] } }] }`
- Это гарантирует, что игры без даты, но с активным статусом, попадают в upcoming

## Скрытые игры и видимость

### Логика видимости скрытых игр для обычных участников

- По умолчанию скрытые игры (`hidden: true`) не видны обычным пользователям
- **Исключение:** если пользователь зарегистрирован на скрытую игру (через GamesTeams), она отображается
- Реализация в `fetchGamesForCabinet.js`: через `$and`/`$or` в MongoDB-запросе
- Admin/dev видят все игры включая скрытые

### ID-панель для скрытых игр

- На странице входа в игру (`GameEntryPageClient.js`) показывается панель с ID игры, если `game.hidden === true`
- Позволяет скопировать ID для передачи другим участникам

## Создание игры

### Поведение по умолчанию

- Новая игра **всегда скрыта** (`hidden: true`) — видна только в админке и зарегистрированным участникам
- Новая игра **не рейтинговая** (`isRated: false`) — рейтинговость настраивается в редакторе игры после создания
- Чекбокс «Рейтинговая игра» и выбор сезона **убраны** из модалки создания (`GameCreateModal.js`)
- Вместо них показывается информационный баннер: «Рейтинговость и сезон можно настроить после создания в редакторе игры»

### Файлы

- `components/modals/GameCreateModal.js` — модалка создания игры
- `components/cabinet/app-router/GamesPageClient.js` — payload создания (`isRated: false`, `hidden: true`)
- `app/api/cabinet/games/route.js` — API создания игры (POST)

## Удаление команды

- API: DELETE `/api/cabinet/teams/[id]` — проверяет права, запрещает удаление при наличии upcoming-регистраций
- Удаляет: Teams, TeamsUsers, GamesTeams
- UI: кнопка в `TeamEditModal`, доступна только admin
- Подтверждение через `window.confirm()`

## Корпоративные заказы

- Поле `orderType` в Games: `public` (по умолчанию), `private`, `corporate`
- Для корпоративных заказов: `sourceOrderId`, `clientName`, `clientContact`, `expectedParticipantsCount`
- При конвертации заявки в игру: `type: 'story'`, `hidden: true`, `isPrivate: true`, `isRated: false`, `orderType: 'corporate'`
- См. `docs/story-quest-design.md` для деталей
