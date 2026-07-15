# Story-квесты ActQuest

## Цель

`story` — отдельный тип игры для сценарных квестов с графом локаций, предметами, баллами, подсказками, действиями и несколькими концовками.

Формат отличается от `classic` и `photo`:

- нет соревнования по местам;
- команды проходят независимые копии сценария;
- команда видит только активные локации;
- скрытые и завершенные локации игрокам не показываются;
- предметы могут открывать локации, выдаваться и тратиться;
- подсказки не привязаны ко времени и списывают баллы;
- итогом является концовка и набранные баллы.

## Основные решения

- Тип игры: `story`.
- Название узла по умолчанию: `Локация`.
- Географическую карту в MVP не делаем.
- Графический редактор нужен сразу.
- Для графа использовать библиотеку уровня `@xyflow/react`.
- Описания локаций и предметов используют rich-text и медиа.
- У каждой команды своя независимая копия мира.
- Организатор видит полное состояние команды и историю событий.

## Game schema

В `Games` добавить story-поля.

```js
{
  type: 'story',

  storyConfig: {
    nodeLabel: 'Локация',
    startMode: 'common' | 'individual',
    hideTotalNodes: true,
    hideTotalItems: true,
    showInventory: true,
    showScoreToTeam: false,
    showFinalHistoryToTeam: false,
  },

  storyItems: [],
  storyNodes: [],
  storyEdges: [],
  storyEndings: [],
}
```

### storyItems

```js
{
  id,
  title,
  image,
  descriptionRich,
  media: [
    {
      id,
      type: 'image' | 'audio' | 'video',
      url,
      title,
      mime,
      size,
      duration,
      path,
    }
  ],
  consumableOnUse: true,
  hiddenUntilObtained: true,
}
```

Предмет может быть электронным аналогом физического предмета. Физическое подтверждение организатором не требуется, но организатор может вручную выдать или изъять предмет через контроль игры.

### storyEndings

```js
{
  id,
  title,
  type: 'success' | 'failed' | 'neutral' | 'secret',
  manualOnly: false,
  descriptionRich,
  media: [],
  conditions: {
    minScore: null,
    requiredItemIds: [],
    requiredCompletedNodeIds: [],
  },
}
```

Для MVP концовки достигаются явно через код, действие или ручное завершение организатором. Концовки с `manualOnly: true` не требуют игрокового пути и доступны для аварийного или сюжетного решения организатора. Автоматический выбор концовки по баллам можно добавить вторым этапом.

### storyNodes

```js
{
  id,
  title,
  descriptionRich,
  media: [],
  coordinates: {
    latitude: null,
    longitude: null,
    radius: null,
  },

  position: {
    x: 0,
    y: 0,
  },

  visibility: {
    startVisible: false,
    requiredNodeIds: [],
    requiredItemIds: [],
    hiddenUntilUnlocked: true,
  },

  scoring: {
    scoreForComplete: 0,
  },

  clues: [
    {
      id,
      title,
      contentRich,
      media: [],
      scorePenalty: 0,
    }
  ],

  codes: [
    {
      id,
      code,
      type: 'complete' | 'bonus' | 'effect',
      scoreBonus: 0,
      scorePenalty: 0,
      grantsItemIds: [],
      consumesItemIds: [],
      unlocksNodeIds: [],
      completesNode: true,
      repeatable: false,
      endingId: null,
      resultMessageRich,
    }
  ],

  actions: [
    {
      id,
      label,
      descriptionRich,
      requiredItemIds: [],
      grantsItemIds: [],
      consumesItemIds: [],
      unlocksNodeIds: [],
      scoreBonus: 0,
      scorePenalty: 0,
      completesNode: false,
      repeatable: false,
      endingId: null,
      resultMessageRich,
    }
  ],
}
```

Один код или одно действие может одновременно:

- выдать предмет;
- потратить предмет;
- открыть одну или несколько локаций;
- начислить или списать баллы;
- завершить локацию;
- привести к концовке.

### storyEdges

```js
{
  id,
  fromNodeId,
  toNodeId,
  type: 'unlock' | 'requires_item' | 'ending',
  itemId: null,
  actionId: null,
  codeId: null,
}
```

`storyEdges` нужны для графического редактора. Источник истины для движка — правила внутри `storyNodes`.

Связь `A -> B` в редакторе должна редактировать правило:

```js
A.codes/actions[].unlocksNodeIds includes B.id
```

## GamesTeams schema

В `GamesTeams` добавить `storyProgress`.

```js
{
  storyProgress: {
    status: 'not_started' | 'in_progress' | 'completed' | 'failed',

    startedAt,
    finishedAt,
    currentEndingId: null,

    unlockedNodeIds: [],
    completedNodeIds: [],

    inventory: [
      {
        itemId,
        status: 'active' | 'consumed',
        obtainedAt,
        sourceNodeId,
        consumedAt,
        consumedAtNodeId,
        consumedByActionId,
      }
    ],

    score: 0,
    usedClueIds: [],
    usedCodeIds: [],
    usedBonusCodeIds: [],
    usedActionIds: [],

    history: [
      {
        id,
        type:
          | 'story_started'
          | 'node_unlocked'
          | 'node_completed'
          | 'clue_used'
          | 'code_entered'
          | 'bonus_code_entered'
          | 'action_used'
          | 'item_obtained'
          | 'item_consumed'
          | 'score_changed'
          | 'ending_reached'
          | 'admin_item_granted'
          | 'admin_item_consumed'
          | 'admin_node_unlocked'
          | 'admin_finished_story',
        at,
        nodeId,
        itemId,
        actionId,
        codeId,
        clueId,
        endingId,
        points,
        message,
        actor: 'team' | 'admin' | 'system',
      }
    ],
  }
}
```

Игроки видят только активные предметы. Потраченные предметы остаются в истории для организатора.

## Story engine

Создать отдельный модуль:

`server/storyEngine.js`

Основные функции:

```js
buildInitialStoryProgress(game)
getAvailableStoryNodes(game, progress)
getActiveStoryInventory(progress)
applyStoryCode({ game, progress, nodeId, code })
applyStoryAction({ game, progress, nodeId, actionId })
useStoryClue({ game, progress, nodeId, clueId })
grantStoryItem({ game, progress, itemId, actor, nodeId })
consumeStoryItem({ game, progress, itemId, actor, nodeId, actionId })
unlockStoryNode({ game, progress, nodeId, actor })
completeStoryNode({ game, progress, nodeId, actor })
changeStoryScore({ progress, points, reason, actor })
reachStoryEnding({ game, progress, endingId, actor })
```

Правила:

- UI не применяет правила самостоятельно.
- Клиент отправляет намерение: код, действие, подсказка.
- Сервер проверяет доступность локации, наличие предметов и применяет эффекты.
- Бонусные коды одноразовые на команду.
- Коды и действия одноразовые по умолчанию; повторное выполнение требует `repeatable: true`.
- Применение эффектов атомарно: при ошибке или невыполненной концовке частичные изменения не сохраняются.
- Если код или действие имеет `completesNode: true`, локация попадает в `completedNodeIds` и исчезает у команды из активных.
- Завершенную локацию в MVP повторно активировать нельзя.
- Локация доступна, если она открыта и не завершена.

### Investigation engine

Для детективов с дискретным внутриигровым временем используется
`storyConfig.experienceMode: 'investigation'` и отдельный модуль
`server/storyInvestigationEngine.js`. Сценарий задаёт старт и дедлайн,
локации, персонажей, темы, взаимодействия, улики, обвинение и таблицу исходов.

Движок отвечает за инициализацию прогресса, переходы, вопросы и осмотры,
ведение журнала, открытие сущностей, выдачу улик, проверку обвинения и timeout.
Клиент не вычисляет доступность и не увеличивает время самостоятельно.
Выполнение взаимодействия атомарно; повторный запрос не начисляет эффекты и
время ещё раз.

## UI игрока

В `/game/[id]/process/[teamId]` для `type === 'story'` нужен отдельный режим.

Показывать:

- заголовок блока из `storyConfig.nodeLabel`;
- только активные локации;
- rich-text описание выбранной локации;
- медиа локации;
- подсказки, если есть;
- стоимость подсказки в баллах;
- ввод кода;
- доступные действия;
- активный инвентарь;
- медиа предметов, включая аудио;
- экран концовки.

MVP клиентского режима добавлен в `components/location-game/GameTeamPageClient.js`:

- загружает состояние через `/api/cabinet/games/[gameId]/story-state`;
- отправляет коды, действия и подсказки через story API;
- показывает активные локации, активный инвентарь, открытые подсказки и концовку;
- скрывает classic/photo блоки задания и ответа для `type === 'story'`.

В режиме расследования игрок дополнительно видит часы и дедлайн, текущую
локацию, доступные переходы, персонажей и темы, осмотры, журнал и доску улик.
Финальное обвинение открывается по серверным условиям и отправляет выбранного
подозреваемого, мотив и улики одним запросом. Аудио не запускается
автоматически и сопровождается текстовой альтернативой.

Не показывать:

- общее количество локаций;
- скрытые локации;
- завершенные локации;
- общее количество предметов;
- потраченные предметы;
- полный граф сценария.

Настройкой можно решить, показывать ли текущие баллы команде во время игры:

```js
storyConfig.showScoreToTeam
```

## UI организатора

В `GameControl` для `story` нужен отдельный режим контроля.

Организатор видит:

- список команд;
- статус каждой команды;
- активные локации;
- завершенные локации;
- активные предметы;
- потраченные предметы в истории;
- баллы;
- использованные подсказки;
- введенные коды;
- достигнутую концовку;
- полную историю событий.

Организатор может:

- выдать предмет;
- потратить/забрать предмет;
- открыть локацию;
- завершить локацию;
- начислить или списать баллы;
- завершить игру выбранной концовкой.

MVP story-контроля добавлен в `components/cabinet/app-router/GameControlPageClient.js`.
Для `gameType === 'story'` страница использует `/api/cabinet/admin/story-control`
и показывает отдельную панель вместо classic/photo статусов.

Для расследования Story Control также показывает локацию, время, улики и
обвинение команды. Организатор может переместить команду, скорректировать время,
открыть персонажа или тему и выдать улику. Все эти команды проходят через ту
же блокировку прогресса, что и игроковые действия.

## Графический редактор

Страница:

`/cabinet/admin/story-editor?gameId=...`

Для графа использовать `@xyflow/react`.

MVP редактора:

- canvas с узлами;
- drag/drop узлов;
- создание локации;
- удаление локации;
- редактирование позиции узла;
- создание связи `unlock`;
- боковая панель выбранной локации;
- rich-text описание локации;
- коды локации;
- действия локации;
- подсказки локации;
- справочник предметов;
- rich-text и медиа предметов;
- справочник концовок;
- сохранение в `Game`.

Актуальный редактор также покрывает условия предметов, выдачу и расходование
предметов, открытие локаций, баллы, переходы к концовкам, повторяемость,
результирующие сообщения, условия концовок и геокоординаты. При удалении
локации, предмета или концовки связанные ссылки очищаются каскадно.

Сохранённый граф проверяется на достижимость от стартовых локаций с учётом
предметов, завершения узлов, явных открытий и возможных prequel-эффектов.
Запущенные и завершённые сценарии заблокированы для редактирования. Для новой
редакции создаётся отдельная игра или копия существующей.

Режим расследования выбирается в том же редакторе. Его словари редактируются в
отдельных фильтруемых JSON-секциях, а сервер валидирует уникальность ID,
ссылочную целостность, диапазоны времени, текстовую альтернативу аудио,
достижимость улик и корректность вариантов обвинения и исходов.

Шаблоны действий:

- `Открыть локацию`;
- `Получить предмет`;
- `Отдать предмет`;
- `Получить и потратить предмет`;
- `Начислить баллы`;
- `Списать баллы`;
- `Перейти к концовке`.

## API

### Игрок

```txt
GET  /api/cabinet/games/[gameId]/story-state?teamId=...
POST /api/cabinet/games/[gameId]/story/code
POST /api/cabinet/games/[gameId]/story/action
POST /api/cabinet/games/[gameId]/story/clue
POST /api/cabinet/games/[gameId]/story/travel
POST /api/cabinet/games/[gameId]/story/interaction
POST /api/cabinet/games/[gameId]/story/accusation
```

Игроковые `POST` принимают `teamId`, `nodeId` и соответствующий payload
(`code`, `actionId` или `clueId`). Ответ возвращает обновленный `state` без
скрытых локаций, кодов и потраченных предметов.

### Организатор

```txt
GET  /api/cabinet/admin/story-control?gameId=...
POST /api/cabinet/admin/story-control/grant-item
POST /api/cabinet/admin/story-control/consume-item
POST /api/cabinet/admin/story-control/unlock-node
POST /api/cabinet/admin/story-control/complete-node
POST /api/cabinet/admin/story-control/adjust-score
POST /api/cabinet/admin/story-control/finish
POST /api/cabinet/admin/story-control/set-location
POST /api/cabinet/admin/story-control/adjust-time
POST /api/cabinet/admin/story-control/unlock-character
POST /api/cabinet/admin/story-control/unlock-topic
POST /api/cabinet/admin/story-control/grant-evidence
```

Админские `POST` принимают `gameId`, `teamId` или `gameTeamId` и параметры
действия. Ответ возвращает обновленный team payload с полным `storyProgress`.

### Редактор

```txt
GET   /api/cabinet/admin/story-editor?gameId=...
PATCH /api/cabinet/admin/story-editor
```

## Заявки и создание игры

При создании пустой игры роль `dev` может сразу выбрать тип `story`. Для роли
`admin` этот вариант пока скрыт и дополнительно запрещён серверным API.

В форме заявки добавить формат:

- `Автоквест`;
- `Фотоквест`;
- `Сценарный квест`;
- `Помогите выбрать`.

При конвертации заявки в `story`:

```js
{
  type: 'story',
  hidden: true,
  isPrivate: true,
  isRated: false,
  orderType: 'corporate',
}
```

## Этапы внедрения

### Этап 1. Данные и движок

- Добавить `type: 'story'`.
- Добавить story-поля в `Games`.
- Добавить `storyProgress` в `GamesTeams`.
- Реализовать `server/storyEngine.js`.
- Покрыть smoke-сценарии:
  - стартовые локации;
  - выдача предмета;
  - трата предмета;
  - открытие локации;
  - подсказка со списанием баллов;
  - бонусный код;
  - концовка.

### Этап 2. Графический редактор

- Подключить `@xyflow/react`.
- Создать `/cabinet/admin/story-editor`.
- Реализовать canvas, узлы, связи, свойства узла, предметы и концовки.

### Этап 3. Игровой UI

- Добавить story-режим на странице прохождения.
- Реализовать активные локации, действия, коды, подсказки и инвентарь.
- Реализовать экран концовки.

### Этап 4. Контроль организатора

- Добавить story-режим в `GameControl`.
- Реализовать просмотр команд, предметов, баллов и истории.
- Реализовать ручные действия организатора.

### Этап 5. Интеграция с заявками

- Добавить `Сценарный квест` в форму заявки.
- Добавить конвертацию заявки в `type: 'story'`.

### Этап 6. Детективное расследование

- [x] Добавить action-based часы, переходы, вопросы, осмотры и журнал.
- [x] Добавить безопасную игроковую проекцию, обвинение и шесть типов исхода.
- [x] Расширить редактор, Story Control и результат расследования.
- [x] Добавить эталонный сценарий «Последний эфир» и идемпотентный импортёр.
- [x] Покрыть движок, дедлайн, защиту секретов и основные ветки сценария тестами.
- [ ] Провести полный ручной прогон всех концовок на авторизованном стенде.

## Открытые решения

- Показывать ли баллы команде во время игры по умолчанию.
- Нужен ли автоматический выбор концовки по баллам на первом релизе.
- Нужен ли финальный экран истории для игроков.
- Нужно ли позднее добавить географическую карту активных локаций.
