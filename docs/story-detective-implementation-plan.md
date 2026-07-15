# Investigation mode для Story — план реализации

## 1. Цель

Расширить существующий `story`-режим ActQuest так, чтобы он поддерживал
цифровые детективы следующего типа:

- открываемые локации, персонажи и темы;
- вопросы как сочетание `локация + персонаж + тема`;
- осмотры и анализы без персонажа;
- заранее записанные текстовые и медиаответы;
- игровое время, которое расходуется только на сервере;
- журнал уже полученных показаний и улик;
- структурированное обвинение `подозреваемый + мотив + доказательства`;
- несколько концовок, зависящих от версии, качества доказательств, времени и
  подсказок.

Эталонный контент: `docs/story-detective-last-broadcast-scenario.md`.

## 2. Текущая база, которую нужно сохранить

В проекте уже реализованы:

- `Games.storyConfig`, `storyItems`, `storyNodes`, `storyEdges`, `storyEndings`;
- `GamesTeams.storyProgress`;
- чистые функции движка в `server/storyEngine.js`;
- блокировка конкурентных мутаций через `runLockedStoryMutation`;
- игроковые `story-state`, `story/code`, `story/action`, `story/clue` API;
- Story Control;
- графический редактор;
- story-представление результата;
- серверная проверка достижимости и глобальной уникальности ID;
- story-тесты в `scripts/storyEngine.test.js` и
  `scripts/storyValidation.test.js`;
- защита скрытого story-контента в публичных payload.

Новая функциональность должна быть аддитивной. Обычные story-квесты обязаны
продолжить работать без миграции контента.

## 3. Архитектурное решение

### 3.1. Режим опыта

Добавить в `storyConfig` поле:

```js
experienceMode: 'quest' | 'investigation'
```

- `quest` — текущее поведение и значение по умолчанию;
- `investigation` — новый детективный интерфейс и новые мутации.

Не создавать новый тип игры. На уровне `Games.type` это по-прежнему `story`,
поэтому сохраняются существующие запуск, команды, права, контроль и результаты.

### 3.2. Story nodes остаются локациями

Не дублировать `storyNodes` отдельным справочником locations.

- `storyNodes` продолжают описывать локации, rich-text, медиа, координаты и
  открытие.
- В investigation-режиме локации не завершаются после каждого посещения.
- Текущая локация команды хранится в `storyProgress.currentNodeId`.
- `unlockedNodeIds` остаётся источником открытых локаций.
- Существующие `codes`, `actions` и `clues` можно оставить доступными для
  гибридных сценариев, но основной интерфейс использует interactions.

### 3.3. Новые корневые справочники Games

Добавить:

```js
storyCharacters: [],
storyTopics: [],
storyInteractions: [],
storyEvidence: [],
storyAccusation: {},
```

Причина вынесения interactions из `storyNodes.actions`: один персонаж и одна
тема могут использоваться во многих локациях, а редактору нужна матрица и
фильтры. Сотни вложенных `actions` плохо редактируются и не выражают предметную
модель расследования.

## 4. Контракт данных Games

### 4.1. Конфигурация

```js
storyConfig: {
  // существующие поля
  experienceMode: 'quest',

  investigation: {
    startNodeId: null,
    startClockMinutes: 0,
    deadlineMinutes: null,
    defaultTravelTimeMinutes: 10,
    defaultInteractionTimeMinutes: 10,
    accusationTimeMinutes: 10,
    allowFreeReplay: true,
    showClockToTeam: true,
    showEvidenceToTeam: true,
    autoFailOnDeadline: true,
  },
}
```

`startClockMinutes` — минуты от начала суток, например `1220` для 20:20.
`deadlineMinutes` — длительность расследования, например `240`.

Часы являются action-based, а не wall-clock. Фоновый cron или таймер MongoDB не
нужен. Сервер продвигает время только при принятой мутации.

### 4.2. Персонажи

```js
storyCharacters: [
  {
    id: 'char_marina_lebedeva',
    title: 'Марина Лебедева',
    subtitle: 'исполнительный продюсер',
    descriptionRich: '',
    image: '',
    media: [],
    startVisible: true,
    hiddenUntilUnlocked: false,
    defaultNodeId: 'loc_reception',
    position: { x: 0, y: 0 },
  },
]
```

`defaultNodeId` — редакторская подсказка и базовое место персонажа. Источник
допустимости конкретного вопроса — interaction, поэтому впоследствии можно
создать одному персонажу ответы в нескольких локациях без миграции схемы.

### 4.3. Темы

```js
storyTopics: [
  {
    id: 'topic_voice_2005',
    title: 'Голос в 20:05',
    descriptionRich: '',
    icon: '',
    startVisible: false,
    hiddenUntilUnlocked: true,
    position: { x: 0, y: 0 },
  },
]
```

### 4.4. Доказательства

Не моделировать доказательства через `storyItems`: предмет может тратиться, а
доказательство является неизменяемым знанием и выбирается в обвинении.

```js
storyEvidence: [
  {
    id: 'ev_echo_queue_log',
    title: 'Журнал очереди Эхо-9',
    descriptionRich: '',
    media: [],
    tags: ['opportunity', 'false-timeline'],
    weight: 1,
    isKey: true,
    hiddenUntilDiscovered: true,
  },
]
```

Поля `isKey`, `weight` и внутренние tags не возвращать игроку до финала, если
они раскрывают авторскую оценку улики.

### 4.5. Interactions

```js
storyInteractions: [
  {
    id: 'int_marina_timeline',
    kind: 'question', // question | examine | analysis | system
    locationId: 'loc_reception',
    characterId: 'char_marina_lebedeva', // null для осмотра
    topicId: 'topic_timeline', // null для самостоятельного осмотра
    label: 'Спросить, где Марина была вечером',
    promptRich: '',
    responseRich: '',
    media: [],
    timeCostMinutes: 10,
    repeatable: false,

    conditions: {
      requiredItemIds: [],
      requiredEvidenceIds: [],
      requiredTopicIds: [],
      requiredCharacterIds: [],
      requiredInteractionIds: [],
      requiredFlagIds: [],
      minElapsedMinutes: null,
      maxElapsedMinutes: null,
    },

    effects: {
      grantsItemIds: [],
      consumesItemIds: [],
      grantsEvidenceIds: [],
      unlocksNodeIds: [],
      unlocksCharacterIds: [],
      unlocksTopicIds: [],
      setsFlagIds: [],
      scoreBonus: 0,
      scorePenalty: 0,
      endingId: null,
    },

    journal: {
      title: '',
      summaryRich: '',
      kind: 'testimony', // testimony | evidence | observation | system
    },
  },
]
```

Правила:

- ID interactions глобально уникальны в сценарии.
- `responseRich` и media не попадают в state до успешного выполнения.
- Недоступное, повторное или конфликтующее действие не списывает время.
- Все effects, время, журнал и автофинал применяются одной атомарной мутацией.
- Для `repeatable: true` повтор может снова применять effects только если это
  явно разрешено дополнительным полем `reapplyEffects: true`; по умолчанию
  повторяемость означает бесплатное воспроизведение уже открытого ответа через
  журнал, а не повторную серверную мутацию.

### 4.6. Финальное обвинение

```js
storyAccusation: {
  enabled: true,
  requiredNodeId: 'loc_reception',
  unlockTopicId: 'topic_final_accusation',
  availability: {
    minKeyEvidence: 3,
    requiredEvidenceIds: [],
    requiredInteractionIds: [],
  },
  culpritCharacterIds: [],
  motives: [
    { id: 'motive_charity_fraud', title: 'Скрыть хищение...' },
  ],
  minSelectableEvidence: 0,
  maxSelectableEvidence: 5,

  // Только сервер и редактор с правами управления.
  correctCulpritId: 'char_marina_lebedeva',
  correctMotiveId: 'motive_charity_fraud',

  outcomes: [
    {
      id: 'outcome_perfect',
      priority: 100,
      endingId: 'ending_perfect_case',
      conditions: {
        culprit: 'correct',
        motive: 'correct',
        minSelectedEvidence: 4,
        requiredEvidenceIds: [],
        requiredEvidenceTags: ['time', 'opportunity', 'motive', 'weapon'],
        maxElapsedMinutes: 230,
        maxUsedClues: 1,
      },
    },
  ],
  fallbackEndingId: 'ending_wrong_accusation',
  timeoutEndingId: 'ending_timeout',
}
```

Outcomes проверяются по убыванию `priority`. Выбранные evidence должны уже быть
открыты командой; сервер не доверяет client payload.

После каждого открытия evidence движок проверяет `availability`. Когда условия
выполнены, он один раз открывает `unlockTopicId` и пишет системное событие
`accusation_unlocked`. Это позволяет выразить правило «обвинение доступно после
трёх существенных улик» без сценарного hardcode.

Условия и правильные ответы не должны попадать в игроковый state. Игрок получает
только список допустимых подозреваемых, формулировки мотивов, открытые
доказательства и ограничения выбора.

## 5. Контракт GamesTeams.storyProgress

Расширить существующий subdocument аддитивно:

```js
storyProgress: {
  // существующие поля
  currentNodeId: null,
  elapsedMinutes: 0,

  unlockedCharacterIds: [],
  unlockedTopicIds: [],
  usedInteractionIds: [],
  discoveredEvidenceIds: [],
  flags: [],

  journal: [
    {
      id,
      interactionId,
      kind,
      title,
      summaryRich,
      media: [],
      characterId,
      topicId,
      locationId,
      evidenceId,
      discoveredAtMinute,
      createdAt,
    },
  ],

  accusation: {
    submittedAt: null,
    submittedAtMinute: null,
    culpritId: null,
    motiveId: null,
    evidenceIds: [],
    outcomeId: null,
  },
}
```

Расширить записи `history` опциональными полями:

```js
interactionId, characterId, topicId, evidenceId,
fromNodeId, toNodeId, minutes, elapsedMinutes
```

История — административный аудит. Журнал — безопасный игроковый контент. Не
возвращать игроку raw history во время прохождения.

## 6. Серверный движок

### 6.1. Новый модуль

Создать `server/storyInvestigationEngine.js` с чистыми функциями:

```js
buildInitialInvestigationProgress(game, options)
getInvestigationClock(game, progress)
getUnlockedInvestigationLocations(game, progress)
getAvailableInvestigationInteractions(game, progress)
unlockInvestigationAccusationIfAvailable({ game, progress, actor, now })
travelInvestigation({ game, progress, targetNodeId, actor, now })
applyInvestigationInteraction({ game, progress, interactionId, actor, now })
submitInvestigationAccusation({
  game, progress, culpritId, motiveId, evidenceIds, actor, now
})
evaluateInvestigationOutcome({ game, progress, accusation })
applyInvestigationDeadline({ game, progress, now })
```

Модуль может вызывать публичные функции `grantStoryItem`, `consumeStoryItem`,
`unlockStoryNode`, `changeStoryScore`, `reachStoryEnding` из
`server/storyEngine.js`, но при любой ошибке обязан вернуть исходный progress.

Не мутировать входные объекты. Все функции должны быть детерминируемыми через
переданный `now`.

### 6.2. Инициализация

При `experienceMode === 'investigation'`:

- стандартный `buildInitialStoryProgress` создаёт базовый progress;
- investigation initializer устанавливает `currentNodeId`;
- открывает стартовых персонажей и темы;
- устанавливает `elapsedMinutes = 0`;
- создаёт history `investigation_started`;
- не дублирует стартовые ID.

Интегрировать это в `ensureStoryProgress` без изменения поведения `quest`.

### 6.3. Переход между локациями

`travelInvestigation` проверяет:

- игра и progress активны;
- target существует и открыт;
- target отличается от `currentNodeId`;
- после стоимости перехода обвинение ещё не завершено.

При успехе:

- увеличивает `elapsedMinutes`;
- меняет `currentNodeId`;
- пишет history `investigation_travelled`;
- проверяет дедлайн.

Повторный переход в текущую локацию отклоняется с
`reason: 'already_at_location'` и не списывает время.

### 6.4. Взаимодействие

Порядок атомарной операции:

1. Проверить статус и текущую локацию.
2. Найти interaction и проверить все conditions.
3. Проверить одноразовость.
4. Проверить, что стоимость не начинается после дедлайна.
5. Добавить interaction в `usedInteractionIds`.
6. Применить existing item/node/score effects.
7. Открыть персонажей, темы, evidence и flags.
8. Добавить безопасную journal entry.
9. Увеличить `elapsedMinutes`.
10. Добавить history.
11. Если ending ещё нет — применить дедлайн.

Если любой пункт 6–8 не может быть применён, полностью откатить операцию,
включая время и `usedInteractionIds`.

POST-ответ возвращает `responseRich`, media и созданную journal entry. Следующий
GET возвращает эту информацию только через journal.

### 6.5. Граница дедлайна

Зафиксировать единое правило:

- Обычное действие допустимо, если `elapsed + cost <= deadline`.
- Если обычное действие завершилось ровно на дедлайне и не достигло ending,
  после его effects применяется `timeoutEndingId`.
- Обвинение допустимо, если `elapsed + accusationCost <= deadline`; его outcome
  вычисляется до timeout.
- Если стоимость выводит за дедлайн, сервер не применяет действие, а завершает
  расследование timeout-концовкой отдельной атомарной мутацией.
- Повторный запрос после финала отклоняется без дополнительных событий.

### 6.6. Обвинение

Проверки:

- обвинение включено и ещё не отправлялось;
- команда находится в `requiredNodeId`;
- тема финального обвинения открыта;
- culprit и motive входят в опубликованные options;
- evidence IDs уникальны, открыты командой и укладываются в min/max;
- время позволяет завершить действие.

После проверки сохранить обвинение полностью, выбрать outcome на сервере и
вызвать `reachStoryEnding`. Даже ошибочная версия является успешной мутацией с
failed/neutral ending, а не HTTP-ошибкой.

## 7. API

### 7.1. Существующий state

Расширить:

```txt
GET /api/cabinet/games/[gameId]/story-state?teamId=...
```

Для investigation вернуть:

```js
{
  mode: 'investigation',
  clock: {
    startClockMinutes,
    elapsedMinutes,
    deadlineMinutes,
    currentClockMinutes,
    remainingMinutes,
    formattedCurrentTime,
    formattedDeadline,
  },
  currentLocation,
  availableLocations,
  characters,
  topics,
  availableInteractions,
  discoveredEvidence,
  journal,
  accusation: {
    available,
    requiredNodeId,
    culpritOptions,
    motiveOptions,
    minSelectableEvidence,
    maxSelectableEvidence,
  },
}
```

`availableInteractions` содержит label, kind, character/topic references,
стоимость и требования, которые можно безопасно показать. Не содержит ответ и
скрытые effects.

### 7.2. Новые routes

```txt
POST /api/cabinet/games/[gameId]/story/travel
POST /api/cabinet/games/[gameId]/story/interaction
POST /api/cabinet/games/[gameId]/story/accusation
```

Payload:

```js
// travel
{ teamId, targetNodeId }

// interaction
{ teamId, interactionId }

// accusation
{ teamId, culpritId, motiveId, evidenceIds }
```

Все routes:

- используют `loadPlayerStoryContext({ requireStarted: true })`;
- используют `runLockedStoryMutation`;
- возвращают единый `{ applied, reason, state }`;
- interaction дополнительно возвращает response и journal entry;
- вызывают `notifyAgentsForGameTeamProgress` после применённой мутации;
- не раскрывают stack/error details клиенту.

### 7.3. Admin API

Добавить в Story Control:

```txt
POST /api/cabinet/admin/story-control/set-location
POST /api/cabinet/admin/story-control/adjust-time
POST /api/cabinet/admin/story-control/unlock-character
POST /api/cabinet/admin/story-control/unlock-topic
POST /api/cabinet/admin/story-control/grant-evidence
```

Все операции проходят существующий lock и пишут actor `admin` в history.
Отрицательная корректировка времени допустима только администратору, но не может
перевести `elapsedMinutes` ниже нуля. Уже достигнутую концовку она не отменяет.

## 8. Игроковый UI

### 8.1. Разделение компонентов

Текущий `StoryQuestProcess` в
`components/location-game/GameTeamPageClient.js` уже велик. Не добавлять весь
investigation UI внутрь него.

Предлагаемая структура:

```txt
components/location-game/story/
  StoryExperienceRouter.js
  StoryQuestProcess.js
  StoryInvestigationProcess.js
  StoryInvestigationClock.js
  StoryLocationNavigator.js
  StoryCharacterTopics.js
  StoryInteractionResult.js
  StoryJournal.js
  StoryEvidenceBoard.js
  StoryAccusationPanel.js
  StoryMediaList.js
```

`GameTeamPageClient.js` определяет mode и рендерит router. При переносе текущего
quest-компонента не менять его API-поведение.

### 8.2. Экран расследования

Порядок блоков:

1. Название дела, часы и оставшееся время.
2. Текущая локация и доступные переходы с ценой времени.
3. Персонажи в текущей локации.
4. Для выбранного персонажа — только доступные темы.
5. Осмотры текущей локации.
6. Последний ответ с текстом и media player.
7. Журнал.
8. Доска открытых доказательств.
9. Финальное обвинение, когда оно доступно.

### 8.3. UX-инварианты

- Перед платным действием показывать `+10 минут`, но не требовать confirm для
  каждого вопроса.
- Для перехода и обвинения использовать confirm, потому что это меняет контекст
  или завершает игру.
- Блокировать повторный submit локально и полагаться на серверный lock как на
  окончательную защиту.
- После мутации заменять state ответом API; не вычислять время или открытия на
  клиенте.
- Аудио не запускать без пользовательского жеста, чтобы не конфликтовать с
  browser autoplay policy.
- Обеспечить текстовую альтернативу всем аудио.
- Журнал должен сохранять воспроизведённые ответы после refresh.
- На мобильном обвинение открывать отдельной полноэкранной панелью или modal,
  чтобы игрок не отправил его случайно.

## 9. Story Editor

### 9.1. Новые разделы

В `StoryEditorPageClient.js` добавить для investigation mode:

- «Настройки расследования»;
- «Персонажи»;
- «Темы»;
- «Взаимодействия»;
- «Доказательства»;
- «Обвинение».

Существующий canvas локаций и концовок сохранить.

### 9.2. Interaction matrix

Минимальный удобный редактор:

- фильтр по локации;
- строки — персонажи;
- столбцы — темы;
- ячейка показывает наличие вопроса;
- клик создаёт/редактирует interaction;
- отдельный список осмотров без персонажа;
- поиск по ID/названию;
- индикаторы time cost, evidence и unlock effects.

На первом этапе можно реализовать список с фильтрами. Матрица — следующий
инкремент, но схема и API сразу должны поддерживать её без миграции.

### 9.3. Сохранение

Расширить normalize-функции в
`app/api/cabinet/admin/story-editor/route.js`:

- обрезать строки и rich-text по разумным лимитам;
- нормализовать ID массивы;
- разрешать только известные enum;
- отбрасывать ссылки на отсутствующие сущности;
- не принимать служебные поля MongoDB из клиента;
- сохранить существующую блокировку редактирования started/finished/closed.

## 10. Валидация сценария

Расширить `getStoryValidationErrors` и reachability report.

Проверять:

1. investigation имеет start node и корректный deadline;
2. `startNodeId` существует и достижим;
3. ID персонажей, тем, interactions, evidence, motives и outcomes уникальны;
4. все ссылки interaction существуют;
5. нет двух одноразовых interactions с одинаковым сочетанием
   `locationId + characterId + topicId + kind`, если это не разрешено явно;
6. time cost — конечное неотрицательное число;
7. accusation options существуют;
8. correct culprit входит в options;
9. correct motive входит в motives;
10. каждый outcome ведёт к существующей ending;
11. timeout ending существует при включённом auto timeout;
12. скрытые темы/персонажи могут быть открыты хотя бы одним достижимым effect;
13. evidence из outcome может быть получено достижимым interaction;
14. существует хотя бы один грубый путь к success ending до deadline.

Полный поиск всех состояний может быть экспоненциальным. Для MVP достаточно
консервативного reachability без перебора порядка и отдельного сценарного теста
минимального маршрута «Последнего эфира». Не блокировать сохранение только из-за
того, что статический анализ не может доказать оптимальность.

## 11. Story Control и агенты

Для каждой команды показывать:

- текущую локацию;
- текущее и оставшееся игровое время;
- открытых персонажей/тем;
- последние interactions;
- обнаруженные доказательства;
- журнал и полную history;
- обвинение после отправки.

Агентские уведомления не должны срабатывать на бесплатное локальное повторное
воспроизведение. Для travel/interaction/evidence/accusation использовать
существующую инфраструктуру `notifyAgentsForGameTeamProgress` и добавить новые
типы событий только если они нужны тексту уведомления.

## 12. Результаты

Расширить `buildGameResultComputed` для investigation:

```js
investigation: {
  currentNodeId,
  elapsedMinutes,
  deadlineMinutes,
  accusation: {
    culpritId,
    motiveId,
    evidenceIds,
    outcomeId,
  },
  discoveredEvidenceCount,
  usedInteractionCount,
  journalEntryCount,
}
```

Публичный story-result показывает:

- концовку;
- потраченное игровое время;
- выбранную версию;
- число найденных доказательств;
- выбранные доказательства, если настройка разрешает спойлеры после игры;
- правильное решение только если ending/config разрешает его раскрытие.

Не добавлять соревновательные места: `scoringMode` остаётся `story`.

## 13. Безопасность и конкурентность

Обязательные инварианты:

- correct culprit, correct motive, скрытые outcome conditions, responseRich и
  неоткрытые evidence никогда не попадают в игроковый state;
- client не может открыть interaction произвольным ID из другой локации;
- client не может выбрать недоступное evidence;
- client не управляет стоимостью времени;
- все мутации используют `runLockedStoryMutation`;
- два параллельных запроса одного вопроса применяются один раз;
- timeout и обвинение не могут одновременно создать две endings;
- сценарий после старта неизменяем;
- public game sanitizer удаляет новые секретные поля;
- rich-text проходит существующую sanitization-цепочку;
- media URLs формируются тем же безопасным способом, что текущие story media.

## 14. Файлы, которые предположительно изменятся

| Область | Файлы |
| --- | --- |
| Mongoose | `schemas/gamesSchema.js`, `schemas/gamesTeamsSchema.js` |
| Engine | `server/storyEngine.js`, новый `server/storyInvestigationEngine.js` |
| State/API helpers | `app/api/cabinet/_lib/storyApi.js` |
| Player API | новые routes в `app/api/cabinet/games/[gameId]/story/*` |
| Editor API | `app/api/cabinet/admin/story-editor/route.js` |
| Validation | `helpers/isGameHaveErrors.js` и связанные story helpers |
| Player UI | `components/location-game/GameTeamPageClient.js`, новые story components |
| Editor UI | `components/cabinet/app-router/StoryEditorPageClient.js` |
| Control | `components/cabinet/app-router/GameControlPageClient.js`, admin story-control routes |
| Results | `server/buildGameResultComputed.js`, `app/[location]/game/result/[id]/page.js` |
| Sanitizer/security | public game sanitizer и contract scripts |
| Tests | новые investigation tests + текущие story tests |
| Docs/roadmap | `docs/story-engine.md`, `docs/story-quest-design.md`, `docs/roadmap.md` |

Фактический список уточнить через `rg` перед изменениями. Не трогать legacy
Telegram gameplay.

## 15. Этапы реализации

### Этап 0. Baseline

- Зафиксировать `git status` и не перезаписывать пользовательские изменения.
- Запустить текущие story tests.
- Добавить failing tests для новых контрактов до production-кода.

Критерий готовности: известен baseline, существующие падения отделены от новых.

### Этап 1. Схема и чистый движок

- Добавить schema fields с безопасными defaults.
- Реализовать initializer, clock, travel, interaction, accusation и deadline.
- Добавить unit tests без MongoDB/Next.js.
- Сохранить поведение `quest` byte-for-byte по API насколько возможно.

Критерий готовности: все чистые функции проходят тесты, включая concurrency-
независимую идемпотентность.

### Этап 2. Валидация и редакторский API

- Добавить normalize/validate для новых сущностей.
- Проверить ссылки, ID, outcomes и секретные поля.
- Возвращать validation errors в существующем editor payload.

Критерий готовности: некорректный investigation нельзя запустить, корректный
можно сохранить и перечитать без потери данных.

### Этап 3. Игроковый API

- Расширить state payload.
- Добавить travel/interaction/accusation routes.
- Применить lock и agent notification.
- Добавить security contract tests.

Критерий готовности: полный минимальный маршрут сценария проходит только через
HTTP API, секреты не утекли.

### Этап 4. Игроковый UI

- Вынести story components.
- Сделать часы, навигацию, вопросы, осмотры, журнал и evidence board.
- Сделать финальное обвинение и ending screen.
- Проверить мобильный экран и refresh recovery.

Критерий готовности: сценарий можно пройти без devtools и ручных API-запросов.

### Этап 5. Editor UI

- Добавить настройки investigation.
- Добавить справочники и список/matrix interactions.
- Добавить outcome editor с явным предупреждением о секретных данных.
- Добавить импорт/экспорт JSON сценария, если это согласуется с текущим editor.

Критерий готовности: «Последний эфир» создаётся или импортируется без правки БД.

### Этап 6. Story Control, результаты и полировка

- Добавить admin mutations и dashboard.
- Расширить computed result и публичный result UI.
- Обновить документацию и roadmap.
- Выполнить полный premerge набор.

Критерий готовности: команда, организатор, редактор и результат видят
согласованное состояние.

## 16. Тестовый план

### 16.1. Unit tests движка

- investigation defaults не меняют quest;
- старт открывает правильную локацию, персонажей и темы;
- travel списывает время один раз;
- travel в текущую/закрытую локацию не списывает время;
- недоступный interaction не списывает время;
- interaction атомарно применяет все effects;
- повторный interaction не применяет effects и время;
- journal сохраняет безопасный открытый ответ;
- hidden response не присутствует до выполнения;
- evidence нельзя подделать в accusation;
- outcomes выбираются по priority;
- exact deadline обрабатывается по зафиксированному правилу;
- timeout и accusation взаимоисключаемы;
- мутации после ending отклоняются.

### 16.2. Validation tests

- дубли ID;
- битые ссылки location/character/topic/evidence/ending;
- неизвестный correct culprit/motive;
- недостижимая success ending;
- недостижимое required evidence;
- отрицательные и нечисловые time costs;
- отсутствие timeout ending;
- quest-сценарий без investigation проходит старые проверки.

### 16.3. API/security tests

- чужая команда и пользователь без доступа получают отказ;
- started-only mutations;
- client time cost игнорируется;
- hidden fields отсутствуют в state и public game;
- два параллельных POST одного interaction дают одно применение;
- accusation принимает только discovered evidence;
- invalid payload ограничен по размеру и типам.

### 16.4. Сценарные tests «Последнего эфира»

Автоматизировать десять прогонов из раздела 19 сценарного документа. Особенно
важен тест минимального маршрута: он служит интеграционным доказательством, что
данные, движок и deadline согласованы.

### 16.5. Команды проверки

Минимум:

```txt
npm run test:story-engine
npm run verify:api-contracts
npm run verify:critical-security
npm run lint
npm run build
```

Перед передачей в merge — `npm run premerge:app`, если окружение и время
позволяют. Любое baseline-падение описать отдельно, не маскировать изменением
несвязанных тестов.

## 17. Рекомендуемая нарезка коммитов

1. `feat(story): add investigation schemas and engine`
2. `test(story): cover investigation validation and security`
3. `feat(story): add investigation player api`
4. `feat(story): add investigation player experience`
5. `feat(story): extend editor for investigation content`
6. `feat(story): add investigation control and results`
7. `docs(story): document investigation mode and sample case`

Не смешивать финансовые, classic/photo или legacy Telegram изменения.

## 18. Definition of Done

Функциональность завершена, когда одновременно выполнено следующее:

- старые story-квесты работают без изменения данных;
- «Последний эфир» можно создать/импортировать через поддерживаемый интерфейс;
- команда проходит дело от старта до любой концовки;
- время и открытия вычисляются только сервером;
- журнал восстанавливается после refresh;
- организатор видит и корректирует состояние;
- результат сохраняет версию обвинения;
- скрытый контент не обнаруживается в игроковых/public payload;
- параллельные мутации идемпотентны;
- новые и существующие story tests проходят;
- документация и roadmap отражают фактические пути API и UI.

## 19. Решения, которые не следует менять без отдельного согласования

- Investigation остаётся подтипом `story`, а не новым `Games.type`.
- `storyNodes` переиспользуются как локации.
- Игровое время action-based, не wall-clock.
- Голосовой ввод не входит в обязательный MVP.
- Текст является обязательной альтернативой аудио.
- Правильный ответ и скрытые responses никогда не доверяются клиенту.
- Ошибочное обвинение является сюжетной концовкой, а не технической ошибкой.
- Орудие убийства усиливает дело, но базовая разгадка требует независимой связки
  «время + возможность + мотив».
