# AGENTS.md — быстрый онбординг по проекту ActQuest

## Что это за проект

ActQuest — это единый репозиторий с:

- Next.js сайтом (кабинет, админка, страницы игр),
- API-слоем (`/app/api`),
- серверной бизнес-логикой (`/server`),
- Telegram-ботом (`/telegram`).

Проект управляет автоквестами (classic/photo), командами, участниками, результатами и рейтингом.

## Язык

- В ответах и комментариях использовать русский язык.

## Основные папки

- `/app` — UI-страницы Next.js (App Router) и route handlers.
- `/app/api` — API-эндпоинты (route handlers).
- `/components` — React-компоненты.
- `/server` — серверная логика (расчеты, сервисы, обновления метрик).
- `/schemas` — Mongoose-схемы.
- `/helpers`, `/utils` — нормализация, форматирование, утилиты.
- `/telegram` — legacy/бот-флоу.

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
- `teamsPlaces` и `computed` должны строиться из snapshot’ов через:
  - `server/buildGameResultComputed.js`.
- Кнопка/доступ к результатам в кабинете ориентируется на наличие `result.computed`.
- Если snapshot’ов нет, результат пересобрать нельзя (игра пропускается в таких операциях).

### Когда формировать snapshots

- Snapshot результата нужно фиксировать на `СТОП ИГРА` (`finished`), чтобы сохранить исторический состав команд/участников.

## Структура `result` в Documents Games (БД)

### Что такое `result`

`result` — это объект в документе Game, который хранит:

- **Снимки состояния** (snapshots): команды, участники, результаты на момент `СТОП ИГРА`
- **Вычисленные метрики**: места команд, итоговые баллы, тайм-коды

### Состав `result` объекта

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

## Особенности `photo` игр (важно)

- Нельзя считать `photo` как `classic` по времени.
- Для `photo` расчет в `buildGameResultComputed` должен идти по баллам:
  - `photos[taskIndex].checks.accepted` -> `taskBonusForComplite`,
  - принятые subTasks -> бонусы subTasks,
  - штрафы/бонусы по кодам и many-wrong-codes,
  - `timeAddings` интерпретируются как корректировки очков,
  - сортировка мест: по убыванию итоговых баллов.

## UI/Frontend инварианты

- Для страниц с карточкой + модалкой редактирования (`components/cabinet/app-router/GamesPageClient.js`) черновик (`editing*`) хранить отдельно от выбранной карточки (`selected*Id`).
- Нельзя сбрасывать `editing*` в эффектах на `selected*Id`, пока открыта модалка редактирования.
- Перед изменением reset-эффектов проверять сценарий:
  - клик по карточке -> `Редактировать` -> ввод в поле.
- Если есть role preview, используйте только `moder` как роль модератора.

## Практика изменений

- Использовать React functional components.
- Добавлять/обновлять `PropTypes` при изменении контрактов компонентов.
- Следовать существующему стилю именования и Tailwind-паттернам проекта.
- Не создавать бинарные файлы (изображения/аудио и т.п.) в репозитории.

## Работа с roadmap

- Перед началом крупной задачи проверять актуальные roadmap-документы в `docs/` (минимум `docs/roadmap.md`, а также профильные roadmap по теме задачи).
- Если в рамках работы закрыт или существенно продвинут пункт roadmap, обновлять его статус в документе:
  - `[x]` — выполнено,
  - `[~]` — в процессе,
  - `[ ]` — не начато.
- При обновлении статуса кратко синхронизировать формулировку пункта с фактической реализацией (например, актуальные пути API), чтобы roadmap не расходился с кодом.

## Что смотреть в первую очередь при новой задаче

1. `helpers/fetchGamesForCabinet.js` — **КРИТИЧНО** при работе с историей и snapshot'ами:
   - Как заполняется `userTeamPlace` из текущих членств и snapshot'ов
   - Как обрабатываются игры для пользователей, вышедших из команды
   - Fallback логика при пустых `result.teamsPlaces`

2. `components/cabinet/app-router/GamesPageClient.js` — основной сценарий управления играми в кабинете.

3. `app/cabinet/_lib/overviewServerData.js` — загрузка и фильтрация игр для Обзора:
   - Как вычисляется `personalProgressGames` (требует `userTeamPlace > 0`)
   - Как считается средний рейтинг по месткам

4. `app/api/[location]/games/[id]/route.js` — изменение игры и статусные переходы.

5. `server/buildGameResultComputed.js` — расчет `teamsPlaces` + `computed` из snapshot'ов.

6. `server/updateParticipantsRatings.js` и `server/updateParticipantsClosedStats.js` — рейтинг и gameStats.

7. `app/api/cabinet/dev/*/route.js` — dev-операции пересчета/массового закрытия.

## Полезные команды

- `npm run dev` — запуск dev-сервера.
- `npm run lint` — линт.
- `npm run build` — production-сборка.

## Troubleshooting (быстрая диагностика)

1. Симптом: нельзя редактировать активную игру (поля не вводятся).

- Проверить: `components/cabinet/app-router/GamesPageClient.js` -> `canEditSelectedGame`, роль пользователя, `editingGame`.
- Проверить, что `editingGame` не сбрасывается эффектом на `selectedGameId` при открытой модалке.
- Проверить role preview: `helpers/useCabinetRolePreview.js` (поддержка `client/moder/admin/dev`).

2. Симптом: в прошедших играх “пусто”, но после refresh игры появляются/пропадают.

- Проверить: гидрацию фильтра города в `components/cabinet/app-router/GamesPageClient.js` (`isGamesFilterLocationHydrated`).
- Проверить API-фильтрацию: `app/api/cabinet/games-list/route.js`, `helpers/fetchGamesForCabinet.js`.
- Проверить текущий `location` фильтр и роль (hidden-игры доступны не всем).

3. Симптом: у игры нет кнопки “Результаты”.

- Проверить: наличие `result.computed` (именно это признак сформированного результата в кабинете).
- Проверить snapshots: `result.teams`, `result.gameTeams`, `result.teamsUsers`.
- Пересобрать через `buildGameResultComputed`/dev-пересчет.

4. Симптом: рейтинг пересчитан, но карточки/места выглядят неверно.

- Проверить, что игра `closed` и `isRated !== false`.
- Проверить, что `teamsPlaces` и `computed` были пересобраны из snapshots.
- Проверить, что в расчет не попали игры без snapshots результата.

5. Симптом: фотоквест имеет “странные” места/рейтинг.

- Проверить ветку `photo` в `server/buildGameResultComputed.js`.
- Убедиться, что расчет идет по баллам `photos[].checks`, а не по времени.
- Проверить корректность `timeAddings` и штрафов/бонусов.

6. Симптом: закрытие игры не обновляет `gameStats`/`rating`.

- Проверить `app/api/[location]/games/[id]/route.js` (ветка перехода в `closed`).
- Проверить вызовы `updateParticipantsClosedStats` и `updateParticipantsRatings`.
- Проверить, что `teamsPlaces` присутствует после пересборки результата.

7. Симптом: на Обзоре пользователь видит только 1 сыгранную игру, хотя играл в мно́гих.

- **ПРИЧИНА**: Пользователь вышел из команды, с которой играл в прошлых играх.
- **РЕШЕНИЕ**: Проверить `result.teamsUsers` и `result.teamsPlaces` у этих игр.
- Убедиться, что в `fetchGamesForCabinet.js` логика fill `userTeamPlace` из snapshot'ов работает:
  - Она должна работать в обоих блоках: при текущем членстве и при поиске по snapshot'ам.
- Проверить, что `userTeamPlace` НЕ `null` — если null, игра отфильтруется в Обзоре.
- **Fallback**: при пустом `result.teamsPlaces` место должно быть = кол-во команд или 1.

## Частые нюансы при работе с историческими snapshot'ами

1. **Если `result.teamsUsers` пусто:**
   - Это старая игра без сохраненного snapshot'а, результат неполный
   - Игра может не отобразиться в истории пользователя
   - Нужно пересобрать результат через dev-операцию или перепроверить логику сохранения

2. **Если `result.teamsPlaces` пусто, но `result.teams` есть:**
   - Места не были вычисленены (может быть ошибка в `buildGameResultComputed`)
   - Fallback: использовать кол-во команд как последнее место или 1
   - **Не игнорировать игру** — пользователь все равно участвовал

3. **При вышедшем из команды пользователе:**
   - GamesTeams не содержит текущую связь (user -> game)
   - TeamsUsers (текущие) не содержит пользователя
   - **ЧТО СПАСАЕТ**: `result.teamsUsers` в snapshot'е остается
   - Логика поиска идет: текущее членство → backup'ы → snapshot'ы

4. **Получение places для несколько команд:**
   - Если пользователь участвовал в нескольких команде в одной игре (редко):
   - Используем минимальное место (`Math.min(...places`)
   - Это правильно, так как рейтинг должен быть лучший из возможных

5. **Формирование `userParticipationTeams`:**
   - Должен содержать массив всех команд пользователя в этой игре
   - Используется для отображения: "Вы участвовали: Команда 1, Команда 2"
   - Заполняется из текущего членства ИЛИ из snapshot'ов, если вышел

## Архитектура Games/Teams/Users

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

### Ключевые различия: Текущее vs Историческое

| Что                      | Источник                        | Когда использовать                           |
| ------------------------ | ------------------------------- | -------------------------------------------- |
| **Текущая команда**      | `TeamsUsers` (BD)               | Проверка текущего членства, редактирование   |
| **Историческая команда** | `result.teamsUsers` (snapshot)  | Отображение игры, если user вышел (fallback) |
| **Места команд**         | `result.teamsPlaces` (snapshot) | Всегда из result (источник истины)           |

### Когда ищем команды пользователя в игре

1. **Если есть текущее членство** → берём из `GamesTeams` + `TeamsUsers`
2. **Если нет текущего членства** → ищем в `result.teamsUsers` (fallback для вышедших)
3. **Если нет ничего** → игра не показывается (лучше скрыть, чем показать с ошибкой)

## Ключевые компоненты UI для работы с играми

### GamesPageClient.js

- Главный компонент управления играми в кабинете
- Логика: `canViewGameTeams`, `canManageThisGame`, `isTeamsModalReadOnly`
- Отображает окна в виде плиток (tile) или списка (list)
- `handleManageTeamsFromList(game, isReadOnly)` — открывает модаль командам

### GameTeamsModal.js

- Модаль просмотра/управления командами игры
- Параметр `isReadOnly=true` — режим просмотра для обычных пользователей
- При readonly скрывает кнопки удаления и "Добавить команду"

### UserViewModal.js & TeamMemberCard.js

- Отображают информацию о пользователе/члене команды
- **ВМЕСТО КОНТАКТОВ**: показывают `gamesCount` и `rating?.rank`
- Приватные данные скрывают

### overviewServerData.js

- Загружает данные для страницы `/cabinet` (Обзор)
- Вычисляет `personalProgressGames` — отфильтрованные сыгранные игры
- Требует `userTeamPlace > 0` для каждой игры (иначе отфильтруется)

## Стандарты модальных окон

- Для кабинетных и админских экранов использовать только общий компонент `components/Modal.js`.
- Не делать кастомные `fixed inset-0` оверлеи и ручные контейнеры модалок там, где можно использовать `Modal`.
- Закрытие модалки должно идти через `onClose` у `Modal` (крестик, `Esc`, клик по backdrop обрабатываются общим компонентом).
- Кнопки в footer оформлять через общие классы:
  - основная: `aq-modal-btn aq-modal-btn-primary`
  - вторичная: `aq-modal-btn aq-modal-btn-secondary`
- Если нужен кастомный footer, передавать его через prop `footer`, а не рисовать отдельную нижнюю панель вручную.
- Для мобильной компактной версии использовать `compactMobile` у `Modal`, а не дублировать стили контейнера.
- Исключения (нестандартные маркетинговые/публичные спец-экраны) допускаются только вне кабинетного UI и должны быть явно обоснованы.

## Pre-merge чеклист (при изменении логики games/teams/users)

1. Статусы и переходы

- Проверены сценарии `active -> started -> finished -> closed`, `canceled -> active`, `closed -> reopen`.
- Убедиться, что `started` нельзя выставить вручную в редакторе.

2. Редактирование игры

- Сценарий “карточка -> редактировать -> ввод в поле -> сохранить” работает.
- При открытой модалке редактирования не происходит сброса `editingGame`.

3. Результаты игры

- Для завершенной/закрытой игры при наличии snapshot формируются `result.teamsPlaces` и `result.computed`.
- Кнопка “Результаты” отображается корректно (если `computed` есть и `hideResult=false`).

4. Рейтинг и статистика

- При закрытии игры обновляются `gameStats` и `rating` участников/команд.
- Для `photo` проверен расчет мест по баллам, для `classic` — по времени.

5. Фильтры и списки

- Проверены `upcoming/past` с фильтром города и сезонным фильтром.
- В `past` корректно попадают завершенные/закрытые и просроченные активные/запущенные игры.

6. Техпроверки

- `npm run lint` без ошибок по измененным файлам.
- Нет временных `console.log`/debug-кода в финальном diff.

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

## Контроль хода игры (Game Control)

### Общее описание

Страница мониторинга запущенной (`started`) игры в реальном времени, аналог команды `/gamestatus` из Telegram-бота.

### Архитектура

```
app/cabinet/admin/game-control/page.js          — серверная страница (auth + admin check)
components/cabinet/app-router/GameControlPageClient.js — клиентский компонент
app/api/cabinet/admin/game-status/route.js       — API-эндпоинт (GET, query: gameId)
components/cabinet/CardActionIconButton.js       — содержит GameControlCardIcon
```

### API-эндпоинт `game-status`

- **Метод:** GET, параметр `?gameId=...`
- **Доступ:** admin/dev или модератор, включённый в `game.moderators`
- **Ограничение:** только для игр в статусе `started`
- **Данные ответа:** `data.teams[]` — массив команд с полями:
  - `teamId`, `teamName`, `activeTaskIndex`, `startedTasks`
  - `findedCodesCount`, `wrongCodesCount`, `bonusCodesCount`, `penaltyCodesCount`
  - `isTeamFinished`, `isTeamOnBreak`, `isActiveTaskFinished`, `isActiveTaskFailed`
  - `sumTimeSeconds`, `currentTaskSeconds`, `breakTimeLeftSeconds`
  - `cluesReceived`, `currentPhotosCount` (для photo-квестов)
- **Сортировка:** по `activeTaskIndex` DESC → финишировавшие первыми → на перерыве → по кодам DESC
- **Источник данных:** коллекции `Games`, `GamesTeams`, `Teams`

### Клиентский компонент `GameControlPageClient`

- Авто-обновление каждые 15 сек (переключаемый чекбокс «Авто»)
- Сводка: всего команд, финишировали, в игре, на перерыве
- Карточки команд с цветовой индикацией статуса:
  - Зелёный — финиш, Жёлтый — перерыв, Красный — время вышло, Голубой — в игре
- Отображает: задание, коды, общее время, время на задании, бонусы/штрафы, подсказки

### Кнопка на карточках игр

- Добавлена в оба вида (list + tile) в `GamesPageClient.js`
- **Условие показа:** `isGameInProgressStatus(game.status) && canManageThisGame`
  - `canManageThisGame` = `canManageGameStatus(game)` проверяет: admin/dev ИЛИ создатель ИЛИ модератор игры
  - `isGameInProgressStatus` = `status === 'started'`
- **Иконка:** `GameControlCardIcon` (таблица/дашборд) из `CardActionIconButton.js`
- **Навигация:** `router.push('/cabinet/admin/game-control?gameId=${game._id}')`

### Поля GamesTeams, используемые для расчёта статуса

```javascript
{
  activeNum,       // индекс текущего задания (0-based)
  startTime[],     // массив дат старта каждого задания
  endTime[],       // массив дат завершения каждого задания
  findedCodes[],   // массив найденных кодов по заданиям
  wrongCodes[],    // массив неверных кодов по заданиям
  findedBonusCodes[],    // бонусные коды
  findedPenaltyCodes[],  // штрафные коды
  photos[],        // для photo-квестов
}
```

### Конфигурация игры (из Games)

- `taskDuration` (по умолчанию 3600) — время на задание в секундах
- `cluesDuration` (по умолчанию 1200) — интервал выдачи подсказок
- `breakDuration` (по умолчанию 0) — перерыв между заданиями

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

## Скрытые игры и видимость

### Логика видимости скрытых игр для обычных участников

- По умолчанию скрытые игры (`hidden: true`) не видны обычным пользователям
- **Исключение:** если пользователь зарегистрирован на скрытую игру (через GamesTeams), она отображается
- Реализация в `fetchGamesForCabinet.js`: через `$and`/`$or` в MongoDB-запросе
- Admin/dev видят все игры включая скрытые

### ID-панель для скрытых игр

- На странице входа в игру (`GameEntryPageClient.js`) показывается панель с ID игры, если `game.hidden === true`
- Позволяет скопировать ID для передачи другим участникам

## Количество команд на карточках игр (teamsCount)

- Для `active`/`started`/`canceled` — подсчёт из коллекции `GamesTeams` (текущие регистрации)
- Для `finished`/`closed` — из `result.teams.length` (snapshot)
- Реализация в `fetchGamesForCabinet.js`

## Фильтрация upcoming/past игр

- Фильтр работает на уровне MongoDB-запроса (НЕ в памяти после пагинации!)
- `upcoming`: `{ $or: [{ dateStart: { $gte: now } }, { status: { $in: ['active', 'started'] } }] }`
- `past`: `{ $or: [{ dateStart: { $lt: now } }, { status: { $in: ['finished', 'closed', 'canceled'] } }] }`
- Это гарантирует, что игры без даты, но с активным статусом, попадают в upcoming

## Удаление команды

- API: DELETE `/api/cabinet/teams/[id]` — проверяет права, запрещает удаление при наличии upcoming-регистраций
- Удаляет: Teams, TeamsUsers, GamesTeams
- UI: кнопка в `TeamEditModal`, доступна только admin
- Подтверждение через `window.confirm()`

## iPhone Push-уведомления

- Safari на iOS не поддерживает Web Push без PWA (Home Screen)
- `usePwaNotifications.js` возвращает `isIOSDevice` и `isStandalone`
- `ProfilePageClient.js` показывает пошаговую инструкцию установки PWA для iOS

## Стек технологий

- **Next.js 16** (App Router, React 19), **Mongoose 9**, **MongoDB 7**
- **State**: Jotai (custom реализация в `lib/jotai/`), React Query v5 (миграция в процессе)
- **CSS**: Tailwind CSS v4, dark mode via `class`
- **Auth**: NextAuth.js (Telegram, VK One Tap, телефон, пароль)
- **Push**: `web-push` (PWA Service Worker)
- **Файлы**: EscalionCloud (внешний сервис загрузки)
- **HTML**: `sanitize-html` — XSS-защита rich-text контента
- **Тесты**: отсутствуют (только smoke-скрипты в `scripts/`)

## State Management — текущее состояние

- **Jotai** v2.19 — state для UI (модалки, сессия, роли); atoms в `state/`
- **React Query** — data fetching (Phase 1 завершена: admin модалки)

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
