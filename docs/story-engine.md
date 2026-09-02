# Story Engine (сюжетные квесты)

## Цель и отличия от classic/photo

`story` — отдельный тип игры для сценарных квестов с графом локаций, предметами, баллами, подсказками, действиями и несколькими концовками.

Формат отличается от `classic` и `photo`:
- Нет соревнования по местам (каждая команда проходит независимую копию сценария)
- Команды видят только активные локации
- Скрытые и завершенные локации игрокам не показываются
- Предметы могут открывать локации, выдаваться и тратиться
- Подсказки не привязаны ко времени и списывают баллы
- Итогом является концовка и набранные баллы

## Тип игры и конфигурация

```javascript
{
  type: 'story',
  
  storyConfig: {
    nodeLabel: 'Локация', // название узла по умолчанию
    startMode: 'common' | 'individual', // общий старт или индивидуальный
    hideTotalNodes: true, // скрывать общее кол-во локаций от игроков
    hideTotalItems: true, // скрывать общее кол-во предметов
    showInventory: true, // показывать инвентарь команде
    showScoreToTeam: false, // показывать баллы команде во время игры
    showFinalHistoryToTeam: false, // показывать историю в конце
  },
```

## Story Items (предметы)

```javascript
storyItems: [
  {
    id, // уникальный ID предмета
    title, // название
    image, // изображение
    descriptionRich, // описание (rich-text)
    media: [
      { id, type: 'image' | 'audio' | 'video', url, title, mime, size, duration, path }
    ],
    consumableOnUse: true, // расходуется при использовании
    hiddenUntilObtained: true, // скрыт до получения
  }
]
```

Предмет может быть электронным аналогом физического предмета. Физическое подтверждение организатором не требуется.

## Story Nodes (локации)

```javascript
storyNodes: [
  {
    id,
    title,
    descriptionRich,
    media: [],
    
    coordinates: { latitude, longitude, radius }, // гео-позиция (опционально)
    position: { x, y }, // позиция на canvas редактора
    
    // Видимость локации
    visibility: {
      startVisible: false, // видна сразу при старте
      requiredNodeIds: [], // какие локации должны быть открыты
      requiredItemIds: [], // какие предметы нужны
      hiddenUntilUnlocked: true, // скрыта до открытия
    },
    
    // Баллы за прохождение
    scoring: {
      scoreForComplete: 0,
    },
    
    // Подсказки (списывают баллы при использовании)
    clues: [
      { id, title, contentRich, media: [], scorePenalty: 0 }
    ],
    
    // Коды (могут выдавать предметы, открывать локации, завершать узел)
    codes: [
      {
        id, code,
        type: 'complete' | 'bonus' | 'effect',
        scoreBonus: 0, scorePenalty: 0,
        requiredItemIds: [], // требуются предметы для ввода
        grantsItemIds: [], // выдает предметы
        consumesItemIds: [], // тратит предметы
        unlocksNodeIds: [], // открывает локации
        completesNode: true, // завершает локацию
        repeatable: false, // по умолчанию код можно применить один раз
        endingId: null, // приводит к концовке
        resultMessageRich,
      }
    ],
    
    // Действия (аналогично кодам, но активируются кнопкой)
    actions: [
      {
        id, label, descriptionRich,
        requiredItemIds: [],
        grantsItemIds: [],
        consumesItemIds: [],
        unlocksNodeIds: [],
        scoreBonus: 0, scorePenalty: 0,
        completesNode: false,
        repeatable: false, // разрешить повторное выполнение явно
        endingId: null,
        resultMessageRich,
      }
    ],
  }
]
```

## Story Edges (связи для редактора)

```javascript
storyEdges: [
  {
    id,
    fromNodeId, // от какой локации
    toNodeId, // к какой локации
    type: 'unlock' | 'requires_item' | 'ending',
    itemId: null, // если requires_item
    actionId: null,
    codeId: null,
  }
]
```

`storyEdges` нужны для графического редактора. Источник истины для движка — правила внутри `storyNodes`.

## Story Endings (концовки)

```javascript
storyEndings: [
  {
    id,
    title,
    type: 'success' | 'failed' | 'neutral' | 'secret',
    manualOnly: false, // концовка доступна только организатору
    descriptionRich,
    media: [],
    conditions: {
      minScore: null, // минимальный балл
      requiredItemIds: [], // требуются предметы
      requiredCompletedNodeIds: [], // требуются завершенные локации
    },
  }
]
```

## Прогресс команды (GamesTeams.storyProgress)

```javascript
storyProgress: {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed',
  startedAt, finishedAt,
  currentEndingId: null,
  
  unlockedNodeIds: [], // открытые локации
  completedNodeIds: [], // завершенные локации
  
  inventory: [
    {
      itemId,
      status: 'active' | 'consumed',
      obtainedAt,
      sourceNodeId, // откуда получен
      consumedAt, consumedAtNodeId, consumedByActionId,
    }
  ],
  
  score: 0, // текущие баллы
  usedClueIds: [],
  usedCodeIds: [],
  usedBonusCodeIds: [],
  usedActionIds: [],
  
  history: [ // история событий (для организатора)
    {
      id, type: 'node_completed' | 'clue_used' | 'code_entered' | 'item_obtained' | 'item_consumed' | 'score_changed' | 'ending_reached' | ...,
      at, nodeId, itemId, actionId, codeId, clueId, endingId,
      points, message,
      actor: 'team' | 'admin' | 'system',
    }
  ],
}
```

## Story Engine (server/storyEngine.js)

Основные функции движка:

```javascript
buildInitialStoryProgress(game) // начальное состояние
getAvailableStoryNodes(game, progress) // доступные локации
getActiveStoryInventory(progress) // активные предметы
applyStoryCode({ game, progress, nodeId, code }) // применить код
applyStoryAction({ game, progress, nodeId, actionId }) // применить действие
useStoryClue({ game, progress, nodeId, clueId }) // использовать подсказку
grantStoryItem({ game, progress, itemId, actor }) // выдать предмет (admin)
consumeStoryItem({ game, progress, itemId, actor }) // забрать предмет (admin)
unlockStoryNode({ game, progress, nodeId, actor }) // открыть локацию (admin)
completeStoryNode({ game, progress, nodeId, actor }) // завершить локацию (admin)
changeStoryScore({ progress, points, reason, actor }) // изменить баллы (admin)
reachStoryEnding({ game, progress, endingId, actor }) // достичь концовки
```

Правила:
- UI не применяет правила самостоятельно
- Клиент отправляет намерение: код, действие, подсказка
- Сервер проверяет доступность локации, наличие предметов и применяет эффекты
- Бонусные коды одноразовые на команду
- Все коды и действия одноразовые по умолчанию; повторение разрешается только через `repeatable: true`
- Завершенную локацию в MVP повторно активировать нельзя
- Локация доступна, если она открыта и не завершена
- Эффекты кода или действия применяются атомарно: при невыполненном условии прогресс полностью откатывается
- Игроковые и административные мутации доступны только при `game.status === 'started'`

## Режим расследования

`storyConfig.experienceMode: 'quest' | 'investigation'` выбирает один из двух
совместимых режимов. Классический граф продолжает обслуживать
`server/storyEngine.js`. Расследование работает через
`server/storyInvestigationEngine.js` и использует отдельные справочники:

- `storyInvestigation` — стартовая локация, внутриигровые часы и дедлайн;
- `storyCharacters` и `storyTopics` — открываемые персонажи и темы разговора;
- `storyInteractions` — переходы, вопросы и осмотры с условиями, эффектами и
  стоимостью во внутриигровых минутах;
- `storyEvidence` — улики, которые можно предъявить в финальном обвинении;
- `storyAccusation` и `storyInvestigationOutcomes` — варианты обвинения и
  правила выбора концовки.

В `GamesTeams.storyProgress` для расследования сохраняются `currentMinute`,
`currentLocationId`, открытые локации, персонажи и темы, выполненные
взаимодействия, найденные улики, журнал, обвинение и история. Время меняется
только сервером после перехода или взаимодействия. Достижение дедлайна
считается истечением времени и переводит команду к timeout-концовке.

Ответ игрокового API является белым списком. В него не попадают правильный
подозреваемый, мотив, скрытые улики, условия и эффекты ещё не выполненных
взаимодействий. Мутации проходят через блокировку прогресса команды; эффекты и
время применяются атомарно, а одноразовое взаимодействие нельзя зачесть дважды.

## API для Story

**Игрок:**
- `GET /api/cabinet/games/[gameId]/story-state?teamId=...` — получить состояние
- `POST /api/cabinet/games/[gameId]/story/code` — ввести код
- `POST /api/cabinet/games/[gameId]/story/action` — выполнить действие
- `POST /api/cabinet/games/[gameId]/story/clue` — использовать подсказку
- `POST /api/cabinet/games/[gameId]/story/travel` — перейти в открытую локацию
- `POST /api/cabinet/games/[gameId]/story/interaction` — выполнить вопрос или осмотр
- `POST /api/cabinet/games/[gameId]/story/accusation` — предъявить финальное обвинение

**Организатор:**
- `GET /api/cabinet/admin/story-control?gameId=...` — просмотр команд
- `POST /api/cabinet/admin/story-control/grant-item` — выдать предмет
- `POST /api/cabinet/admin/story-control/consume-item` — забрать предмет
- `POST /api/cabinet/admin/story-control/unlock-node` — открыть локацию
- `POST /api/cabinet/admin/story-control/complete-node` — завершить локацию
- `POST /api/cabinet/admin/story-control/adjust-score` — изменить баллы
- `POST /api/cabinet/admin/story-control/finish` — завершить игру с концовкой
- `POST /api/cabinet/admin/story-control/set-location` — переместить команду
- `POST /api/cabinet/admin/story-control/adjust-time` — изменить внутриигровое время
- `POST /api/cabinet/admin/story-control/unlock-character` — открыть персонажа
- `POST /api/cabinet/admin/story-control/unlock-topic` — открыть тему
- `POST /api/cabinet/admin/story-control/grant-evidence` — выдать улику

**Редактор:**
- `GET /api/cabinet/admin/story-editor?gameId=...` — получить сценарий
- `PATCH /api/cabinet/admin/story-editor` — сохранить сценарий

Графический редактор: `/cabinet/admin/story-editor?gameId=...` (текущая реализация использует собственный canvas; миграция на `@xyflow/react` остаётся возможным улучшением)

Для `experienceMode === 'investigation'` редактор дополнительно показывает
настройки часов и отдельную карту логики расследования. Взаимодействия сгруппированы
по локациям; каждая карточка показывает условия (`required*`) и результаты
(`grants*`, `unlocks*`, flags и ending). Поиск связывает предмет или улику со
всеми местами получения и использования. Выбранное взаимодействие редактируется
в отдельном модальном окне через справочники локаций, персонажей, тем, предметов
и улик без ручной правки JSON. Фильтруемые JSON-секции сохранены как расширенный режим для полного
контракта. Визуальная карта строится непосредственно из `conditions` и `effects`
и не создаёт `storyEdges`, поэтому не меняет семантику investigation-движка.
Сохранение нормализует ссылки, санитизирует HTML и блокируется после запуска
игры так же, как для графового сценария.

Story-поля сохраняются только через `PATCH /api/cabinet/admin/story-editor`.
Обычная форма редактирования игры не включает их в payload, а общий
`PUT /api/[location]/games/[id]` дополнительно удаляет `storyConfig`, граф,
взаимодействия, улики и обвинение из обновления. Это защищает сценарий от
случайной очистки неполной карточкой игры.

Редактор возвращает ошибки сохранённой версии сценария: отсутствующие ссылки,
повторяющиеся идентификаторы, недостижимые локации и концовки. Та же проверка
блокирует запуск некорректной игры. Идентификаторы кодов, действий и подсказок
уникальны во всём сценарии, потому что прогресс команды хранит их глобально.

После перехода игры в `started`, `finished` или `closed` её story-сценарий
становится неизменяемым. Это защищает текущий прогресс и результат от расхождения
с правилами, по которым команда начала прохождение. Для новой редакции создаётся
отдельная игра или копия существующей — это целевая модель без параллельных
draft/published-версий.

## Результаты Story

- `buildGameResultComputed` формирует `scoringMode: 'story'`
- `teamsPlaces` остаётся пустым: команды не получают соревновательные места
- Для команды сохраняются концовка, баллы, длительность, число завершённых локаций, подсказок и предметов
- Публичная страница результата использует отдельное story-представление
- Для расследования результат также содержит затраченное внутриигровое время,
  найденные и выбранные улики и итог обвинения; секрет решения раскрывается
  только при разрешённой настройке результата

## Постоянно доступные прохождения и рекорды

Для story-квеста, который принимает игроков после публикации, используются
связанные настройки игры:

- `storyConfig.startMode: 'individual'` — прогресс и `startedAt` создаются при
  первом входе конкретной команды;
- `registrationOpen: true` — общий ручной переключатель регистрации;
- `allowJoinAfterStart: true` — разрешает регистрацию при статусе `started`;
- `participationMode: 'player'` — создаёт скрытую персональную команду без
  отдельного командного онбординга.

`allowJoinAfterStart` разрешён только при индивидуальном старте. Общая игра
остаётся в `started`, а отдельное прохождение завершается через
`storyProgress.status` и `storyProgress.finishedAt`.

Живая статистика не использует финальный `result.computed`, потому что он
является снимком всей завершённой игры. Endpoint
`GET /api/cabinet/games/[gameId]/records` рассчитывает её по текущим
`GamesTeams.storyProgress`. Настройка `recordsVisibility` принимает значения
`disabled`, `participants`, `public`; `recordsShowNames` управляет раскрытием
названий команд и имён индивидуальных игроков. Рекорды успешных прохождений
сортируются по баллам, времени и использованным подсказкам.

## Эталонный сценарий «Последний эфир»

Сценарий хранится в `data/storyLastBroadcastScenario.js`. Импортёр работает
идемпотентно, по умолчанию показывает preview и не меняет запущенные игры:

```bash
npm run import:story-last-broadcast -- --gameId <GAME_ID>
npm run import:story-last-broadcast -- --gameId <GAME_ID> --apply
```

Проверки движка и основных маршрутов сценария запускаются командой
`npm run test:story-engine`.

## Особенности реализации

### UI игрока
- В `/game/[id]/process/[teamId]` для `type === 'story'` нужен отдельный режим
- Показывать: только активные локации, описание, медиа, подсказки, коды, действия, активный инвентарь
- Не показывать: общее кол-во локаций/предметов, скрытые/завершенные локации, потраченные предметы
- Настройкой `storyConfig.showScoreToTeam` можно решить, показывать ли баллы во время игры

### UI организатора
- В `GameControl` для `story` нужен отдельный режим контроля
- Организатор видит: список команд, статус, активные/завершенные локации, предметы, баллы, историю
- Организатор может: выдать/забрать предмет, открыть/завершить локацию, изменить баллы, завершить игру

### Заявки и создание игры
- Роли `admin` и `dev` могут выбрать тип `story` прямо в окне создания пустой игры.
- Для `admin` вариант создания `story` пока не показывается и отклоняется API.
- При конвертации заявки в `story`:
  ```javascript
  {
    type: 'story',
    hidden: true,
    isPrivate: true,
    isRated: false,
    orderType: 'corporate',
  }
  ```
