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

## API для Story

**Игрок:**
- `GET /api/cabinet/games/[gameId]/story-state?teamId=...` — получить состояние
- `POST /api/cabinet/games/[gameId]/story/code` — ввести код
- `POST /api/cabinet/games/[gameId]/story/action` — выполнить действие
- `POST /api/cabinet/games/[gameId]/story/clue` — использовать подсказку

**Организатор:**
- `GET /api/cabinet/admin/story-control?gameId=...` — просмотр команд
- `POST /api/cabinet/admin/story-control/grant-item` — выдать предмет
- `POST /api/cabinet/admin/story-control/consume-item` — забрать предмет
- `POST /api/cabinet/admin/story-control/unlock-node` — открыть локацию
- `POST /api/cabinet/admin/story-control/complete-node` — завершить локацию
- `POST /api/cabinet/admin/story-control/adjust-score` — изменить баллы
- `POST /api/cabinet/admin/story-control/finish` — завершить игру с концовкой

**Редактор:**
- `GET /api/cabinet/admin/story-editor?gameId=...` — получить сценарий
- `PATCH /api/cabinet/admin/story-editor` — сохранить сценарий

Графический редактор: `/cabinet/admin/story-editor?gameId=...` (текущая реализация использует собственный canvas; миграция на `@xyflow/react` остаётся возможным улучшением)

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
- Роль `dev` может выбрать тип `story` прямо в окне создания пустой игры.
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
