# Handoff-промпт для реализации investigation mode

Ниже находится готовый промпт, который можно передать другому ИИ вместе с
репозиторием ActQuest.

---

Ты работаешь в монорепозитории ActQuest. Реализуй новый investigation mode для
существующего типа игры `story` и подготовь оригинальный цифровой детектив
«Последний эфир» как эталонный сценарий.

Перед любыми изменениями обязательно:

1. Полностью прочитай корневой `AGENTS.md` и соблюдай его инструкции.
2. Проверь `git status`; существующие изменения принадлежат пользователю. Не
   перезаписывай, не откатывай и не форматируй несвязанные файлы.
3. Прочитай документы:
   - `docs/story-engine.md`;
   - `docs/story-quest-design.md`;
   - `docs/roadmap.md`;
   - `docs/story-detective-implementation-plan.md`;
   - `docs/story-detective-last-broadcast-scenario.md`.
4. Через `rg` уточни все фактические story-пути, API и tests. План является
   целевой спецификацией, но код репозитория — источник истины для текущих
   контрактов.
5. Запусти текущий story baseline и зафиксируй уже существующие падения отдельно
   от новых.

## Цель

Добавь в `storyConfig` аддитивный режим:

```js
experienceMode: 'quest' | 'investigation'
```

`quest` должен сохранить текущее поведение. `investigation` должен поддерживать:

- текущую и открытые локации на базе `storyNodes`;
- справочники персонажей и тем;
- interactions вида `location + character + topic`, а также осмотры/анализы;
- action-based игровое время и серверный deadline;
- открытие тем, персонажей, локаций, улик и journal entries;
- бесплатное повторное воспроизведение уже открытого ответа;
- обвинение `culprit + motive + selected evidence`;
- приоритетные outcome rules и несколько endings;
- Story Control, результаты, редактор, валидацию и security sanitization.

Голосовой ввод не нужен для MVP. Аудио обязательно имеет текстовую
альтернативу.

## Обязательные архитектурные решения

- Не создавай новый `Games.type`; это остаётся `story`.
- Переиспользуй `storyNodes` как локации.
- Не моделируй доказательства как расходуемые `storyItems`; используй отдельный
  справочник evidence.
- Время продвигается только принятым серверным действием. Не используй cron,
  wall-clock таймер или доверенное клиентское время.
- Все мутации проходят существующий `runLockedStoryMutation`.
- Недоступное, повторное или конфликтующее действие не списывает время.
- Effects, journal, evidence, время и ending применяются атомарно.
- Ошибочное обвинение ведёт к сюжетной ending, а не к HTTP error.
- `correctCulpritId`, `correctMotiveId`, outcome conditions, скрытые responses и
  неоткрытые evidence не должны попадать в игроковый/public payload.
- Запущенный или завершённый сценарий остаётся неизменяемым.
- Не опирайся на Telegram legacy.

## Порядок реализации

Работай инкрементально, но доведи задачу до полной Definition of Done из
`docs/story-detective-implementation-plan.md`.

### 1. Tests и данные

- Сначала добавь failing unit tests для clock, travel, interaction, evidence,
  journal, accusation, deadline и сохранения quest behavior.
- Расширь `schemas/gamesSchema.js` и `schemas/gamesTeamsSchema.js` безопасными
  defaults.
- Добавь чистый `server/storyInvestigationEngine.js`.

### 2. Validation и editor API

- Добавь normalize/validation всех новых справочников и ссылок.
- Проверяй уникальность ID, outcomes, deadline и грубую достижимость решения.
- Не ломай текущую story reachability.

### 3. Player API

Добавь:

```txt
POST /api/cabinet/games/[gameId]/story/travel
POST /api/cabinet/games/[gameId]/story/interaction
POST /api/cabinet/games/[gameId]/story/accusation
```

Расширь `story-state` безопасным investigation payload. Используй текущие access
checks, lock и agent notification.

### 4. Player UI

- Вынеси story UI из разрастающегося `GameTeamPageClient.js` в отдельные
  компоненты.
- Сохрани текущий quest UI.
- Реализуй часы, переходы, персонажей/темы, осмотры, последний ответ, журнал,
  evidence board, обвинение и ending.
- Проверь мобильный layout, refresh recovery и отсутствие autoplay ошибок.

### 5. Editor, Control, Results

- Добавь настройки investigation и редакторы characters/topics/interactions/
  evidence/accusation.
- Минимально допустим список interactions с фильтрами; matrix можно добавить
  вторым инкрементом, если список уже позволяет полностью собрать сценарий.
- Добавь admin location/time/unlock/evidence mutations.
- Расширь `buildGameResultComputed` и публичный story result.

### 6. Эталонный сценарий

- Перенеси «Последний эфир» из сценарного документа в поддерживаемый seed/import
  формат, соответствующий фактически реализованной схеме.
- Не вставляй бинарные аудиофайлы. Используй текстовые сценарии и пустые/явно
  помеченные media placeholders.
- Добавь автоматизированный тест минимального доказательного маршрута и всех
  основных endings.
- Если создаёшь import script, он должен быть идемпотентным или работать только
  с явно переданным game ID; не модифицируй production данные автоматически.

## Критичные сценарии времени

- Обычное действие допустимо при `elapsed + cost <= deadline`.
- Если оно завершилось ровно на deadline без ending, затем применяется timeout.
- Обвинение при `elapsed + cost <= deadline` оценивается до timeout.
- Действие, выводящее за deadline, не применяется; расследование завершается
  timeout-ending.
- Повторный запрос после ending ничего не меняет.

## Проверки

Добавь/обнови tests для:

- сохранения старого quest behavior;
- всех чистых функций investigation engine;
- validation и broken references;
- отсутствия секретов в state/public payload;
- доступа только своей команды;
- started-only mutations;
- параллельных одинаковых POST;
- подделанного evidence в accusation;
- exact deadline race;
- минимального и идеального маршрутов «Последнего эфира»;
- wrong culprit, wrong motive, weak case и timeout endings.

Запусти как минимум:

```txt
npm run test:story-engine
npm run verify:api-contracts
npm run verify:critical-security
npm run lint
npm run build
```

Перед завершением запусти `npm run premerge:app`, если окружение позволяет.
Не исправляй несвязанные baseline-проблемы без необходимости; опиши их отдельно.

## Документация

После реализации синхронизируй:

- `docs/story-engine.md`;
- `docs/story-quest-design.md`;
- `docs/roadmap.md`.

В документации должны быть фактические API paths, schema fields, ограничения и
команды проверки. Отметь roadmap `[x]` только для реально завершённых частей,
`[~]` — для частично готовых.

## Формат финального отчёта

Сообщи:

1. Что реализовано по слоям: data/engine/API/UI/editor/control/results.
2. Какие ключевые архитектурные решения приняты.
3. Какие файлы изменены.
4. Какие проверки запущены и их результат.
5. Есть ли baseline или внешние блокеры.
6. Как импортировать/создать и вручную пройти «Последний эфир».

Не объявляй задачу завершённой, пока не выполнена Definition of Done либо пока
не будет конкретного внешнего блокера, который нельзя обойти безопасно.

---

## Примечание владельцу проекта

Если полная реализация слишком велика для одного прохода, безопасная точка
разделения — после этапа 3: схема, чистый движок, валидация и Player API уже
должны быть закончены и протестированы. Не оставлять частично включённый UI,
который показывает investigation mode без рабочих серверных мутаций.
