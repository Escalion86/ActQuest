# Task Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать линейное и случайное блочное распределение заданий с индивидуальными шаблонами команд, серверной блокировкой старта без распределения и корректной статистикой по исходным индексам заданий.

**Architecture:** Порядок прохождения хранится как `GamesTeams.taskSequence`, где `activeNum` остается шагом команды, а прогресс пишется по исходному индексу задания из `Games.tasks`. Общая логика нормализации, валидации, генерации и разрешения активного задания живет в одном helper-е, который используют серверный игровой процесс, Game Control, результаты и API распределения.

**Tech Stack:** Next.js 16 App Router, React 19, Mongoose 9, MongoDB, node:test, existing cabinet API patterns.

---

## File Map

- Create `helpers/taskDistribution.js`: pure helper для шаблонов, sequence, locked prefix и маппинга шагов в исходные индексы.
- Create `scripts/taskDistribution.test.js`: unit tests для helper-а.
- Modify `schemas/gamesSchema.js`: поля `taskDistributionMode`, `taskDistributionTemplate`.
- Modify `schemas/gamesTeamsSchema.js`: поля `taskDistributionTemplate`, `taskSequence`, `taskSequenceGeneratedAt`, `taskSequenceSource`.
- Modify `helpers/normalizeGameForCabinet.js`: нормализация новых полей игры для кабинета.
- Modify `components/cabinet/app-router/GamesPageClient.js`: draft/payload новых полей, статусное действие распределения.
- Modify `components/modals/game-edit/GameEditModal.js`: подключить секцию распределения и модалку конструктора.
- Create `components/modals/game-edit/sections/TaskDistributionSection.js`: UI выбора режима и конструктора общего шаблона.
- Modify `app/api/[location]/games/[id]/route.js`: sanitize/write новых полей игры.
- Create `app/api/cabinet/admin/task-distribution/route.js`: распределение для всех команд или одной команды.
- Modify `app/api/cabinet/games/[gameId]/teams/route.js`: отдача/сохранение индивидуального шаблона команды.
- Modify `components/modals/GameTeamsModal.js`: UI индивидуального шаблона и кнопка распределения для команды.
- Modify `server/gameStart.js`: серверная блокировка старта random-игры без валидных sequences.
- Modify `server/buildGameStartProgressUpdate.js`: не стирать `taskSequence` при старте.
- Modify `server/webGameProcess.js`: активное задание через sequence, прогресс по исходному индексу.
- Modify `server/getTeamGameTaskState.js`: состояние, капитанские действия, перерывы и автопереходы через sequence.
- Modify `app/api/cabinet/admin/game-status/action/route.js`: force/apply actions через active source task index.
- Modify `app/api/cabinet/admin/game-status/route.js`: Game Control status через sequence, stats по исходным индексам.
- Modify `server/buildGameResultComputed.js`: duration/result helpers учитывают sequence при определении “пройдено/не начато”.
- Modify `docs/game-logic.md`: кратко описать новый инвариант.

---

### Task 1: Pure Task Distribution Helper

**Files:**
- Create: `helpers/taskDistribution.js`
- Test: `scripts/taskDistribution.test.js`

- [ ] **Step 1: Write failing helper tests**

Create `scripts/taskDistribution.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLinearTaskSequence,
  buildTaskSequenceFromTemplate,
  formatTaskDistributionTemplate,
  getLockedTaskSequencePrefix,
  getTaskIndexForStep,
  getTeamTaskSequence,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '../helpers/taskDistribution.js'

test('normalizes mixed UI template to zero-based blocks', () => {
  assert.deepEqual(
    normalizeTaskDistributionTemplate([[1, 2, 3], [4, 5], 6, [7, 8]], 8),
    [[0, 1, 2], [3, 4], [5], [6, 7]],
  )
})

test('formats normalized template for cabinet UI', () => {
  assert.equal(
    formatTaskDistributionTemplate([[0, 1, 2], [3, 4], [5], [6, 7]]),
    '[1,2,3],[4,5],6,[7,8]',
  )
})

test('validates missing duplicate out-of-range and empty blocks', () => {
  const result = validateTaskDistributionTemplate([[0, 1], [], [1], [5]], 4)

  assert.equal(result.valid, false)
  assert.deepEqual(result.missingTaskNumbers, [3, 4])
  assert.deepEqual(result.duplicateTaskNumbers, [2])
  assert.deepEqual(result.outOfRangeTaskNumbers, [6])
  assert.equal(result.hasEmptyBlock, true)
  assert.match(result.messages.join('\n'), /отсутствуют задания: 3, 4/)
  assert.match(result.messages.join('\n'), /Задание 2 указано несколько раз/)
  assert.match(result.messages.join('\n'), /несуществующие задания: 6/)
  assert.match(result.messages.join('\n'), /пустой блок/)
})

test('builds sequence by shuffling inside blocks only', () => {
  const sequence = buildTaskSequenceFromTemplate(
    [[0, 1, 2], [3, 4], [5]],
    () => 0.99,
  )

  assert.deepEqual(sequence.slice(0, 3).sort((a, b) => a - b), [0, 1, 2])
  assert.deepEqual(sequence.slice(3, 5).sort((a, b) => a - b), [3, 4])
  assert.equal(sequence[5], 5)
})

test('uses team template before game template and falls back to linear', () => {
  const game = {
    tasks: [{}, {}, {}],
    taskDistributionMode: 'random',
    taskDistributionTemplate: [[0], [1], [2]],
  }

  assert.deepEqual(
    getTeamTaskSequence(game, { taskSequence: [2, 1, 0] }),
    [2, 1, 0],
  )
  assert.deepEqual(getTeamTaskSequence({ tasks: [{}, {}] }, {}), [0, 1])
  assert.deepEqual(buildLinearTaskSequence(3), [0, 1, 2])
})

test('maps active step to source task index', () => {
  const game = { tasks: [{}, {}, {}] }
  const gameTeam = { taskSequence: [2, 0, 1] }

  assert.equal(getTaskIndexForStep(game, gameTeam, 0), 2)
  assert.equal(getTaskIndexForStep(game, gameTeam, 1), 0)
  assert.equal(getTaskIndexForStep(game, gameTeam, 9), null)
})

test('locks tasks that already have progress', () => {
  assert.deepEqual(
    getLockedTaskSequencePrefix({
      taskSequence: [2, 0, 1, 3],
      startTime: [new Date('2026-01-01T00:00:00Z'), null, new Date('2026-01-01T00:00:00Z'), null],
      endTime: [null, null, null, null],
      findedCodes: [[], [], [], []],
      wrongCodes: [[], [], [], []],
      findedBonusCodes: [[], [], [], []],
      findedPenaltyCodes: [[], [], [], []],
      photos: [{ photos: [] }, { photos: [] }, { photos: [] }, { photos: [] }],
      taskFailures: [],
    }),
    [2, 0],
  )
})
```

- [ ] **Step 2: Run helper test and verify RED**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` for `helpers/taskDistribution.js`.

- [ ] **Step 3: Implement helper**

Create `helpers/taskDistribution.js`:

```js
const toIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const integer = Math.trunc(numeric)
  return integer === numeric ? integer : null
}

export const buildLinearTaskSequence = (tasksCount) =>
  Array.from({ length: Math.max(0, Number(tasksCount) || 0) }, (_, index) => index)

export const normalizeTaskDistributionMode = (value) =>
  value === 'random' ? 'random' : 'linear'

export const normalizeTaskDistributionTemplate = (value, tasksCount = 0) => {
  const source = Array.isArray(value) ? value : []
  return source.map((block) => {
    const blockItems = Array.isArray(block) ? block : [block]
    return blockItems
      .map((item) => {
        const integer = toIntegerOrNull(item)
        if (integer === null) return null
        if (integer >= 1 && integer <= tasksCount) return integer - 1
        return integer
      })
      .filter((item) => item !== null)
  })
}

export const formatTaskDistributionTemplate = (template) =>
  (Array.isArray(template) ? template : [])
    .map((block) => {
      const numbers = (Array.isArray(block) ? block : [block]).map(
        (index) => Number(index) + 1,
      )
      return numbers.length === 1 ? String(numbers[0]) : `[${numbers.join(',')}]`
    })
    .join(',')

export const validateTaskDistributionTemplate = (template, tasksCount) => {
  const count = Math.max(0, Number(tasksCount) || 0)
  const blocks = Array.isArray(template) ? template : []
  const seen = new Map()
  const outOfRangeTaskNumbers = []
  const hasEmptyBlock = blocks.some((block) => !Array.isArray(block) || block.length === 0)

  blocks.forEach((block) => {
    ;(Array.isArray(block) ? block : []).forEach((index) => {
      const taskIndex = toIntegerOrNull(index)
      if (taskIndex === null) return
      if (taskIndex < 0 || taskIndex >= count) {
        outOfRangeTaskNumbers.push(taskIndex + 1)
        return
      }
      seen.set(taskIndex, (seen.get(taskIndex) || 0) + 1)
    })
  })

  const missingTaskNumbers = []
  const duplicateTaskNumbers = []
  for (let index = 0; index < count; index += 1) {
    const hits = seen.get(index) || 0
    if (hits === 0) missingTaskNumbers.push(index + 1)
    if (hits > 1) duplicateTaskNumbers.push(index + 1)
  }

  const messages = []
  if (count === 0) messages.push('Для случайного распределения нужны задания.')
  if (missingTaskNumbers.length > 0) {
    messages.push(`В шаблоне отсутствуют задания: ${missingTaskNumbers.join(', ')}`)
  }
  if (outOfRangeTaskNumbers.length > 0) {
    messages.push(
      `В шаблоне указаны несуществующие задания: ${[...new Set(outOfRangeTaskNumbers)].join(', ')}`,
    )
  }
  duplicateTaskNumbers.forEach((number) => {
    messages.push(`Задание ${number} указано несколько раз`)
  })
  if (hasEmptyBlock) messages.push('В шаблоне есть пустой блок')

  return {
    valid: messages.length === 0,
    messages,
    missingTaskNumbers,
    duplicateTaskNumbers,
    outOfRangeTaskNumbers: [...new Set(outOfRangeTaskNumbers)],
    hasEmptyBlock,
  }
}

export const buildTaskSequenceFromTemplate = (template, random = Math.random) =>
  (Array.isArray(template) ? template : []).flatMap((block) => {
    const items = Array.isArray(block) ? [...block] : [block]
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1))
      ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
    }
    return items
  })

export const isValidTaskSequence = (sequence, tasksCount) => {
  const expected = buildLinearTaskSequence(tasksCount)
  if (!Array.isArray(sequence) || sequence.length !== expected.length) return false
  return sequence.every((item, index) => item === expected[index] || expected.includes(item)) &&
    new Set(sequence).size === expected.length
}

export const getTeamTaskSequence = (game, gameTeam) => {
  const tasksCount = Array.isArray(game?.tasks) ? game.tasks.length : 0
  const sequence = Array.isArray(gameTeam?.taskSequence)
    ? gameTeam.taskSequence.map((item) => Number(item))
    : []
  return isValidTaskSequence(sequence, tasksCount)
    ? sequence
    : buildLinearTaskSequence(tasksCount)
}

export const getTaskIndexForStep = (game, gameTeam, step) => {
  const sequence = getTeamTaskSequence(game, gameTeam)
  const index = Number(step)
  if (!Number.isInteger(index) || index < 0 || index >= sequence.length) return null
  return sequence[index]
}

const hasArrayProgress = (value, index) =>
  Array.isArray(value?.[index]) && value[index].length > 0

export const taskHasProgress = (gameTeam, taskIndex) => {
  if (Array.isArray(gameTeam?.startTime) && gameTeam.startTime[taskIndex]) return true
  if (Array.isArray(gameTeam?.endTime) && gameTeam.endTime[taskIndex]) return true
  if (hasArrayProgress(gameTeam?.findedCodes, taskIndex)) return true
  if (hasArrayProgress(gameTeam?.wrongCodes, taskIndex)) return true
  if (hasArrayProgress(gameTeam?.findedBonusCodes, taskIndex)) return true
  if (hasArrayProgress(gameTeam?.findedPenaltyCodes, taskIndex)) return true
  if (Array.isArray(gameTeam?.photos) && Array.isArray(gameTeam.photos[taskIndex]?.photos) && gameTeam.photos[taskIndex].photos.length > 0) return true
  return (Array.isArray(gameTeam?.taskFailures) ? gameTeam.taskFailures : []).some(
    (item) => Number(item?.taskIndex) === taskIndex && item?.failedAt,
  )
}

export const getLockedTaskSequencePrefix = (gameTeam) => {
  const sequence = Array.isArray(gameTeam?.taskSequence) ? gameTeam.taskSequence : []
  const locked = []
  for (const taskIndex of sequence) {
    if (!taskHasProgress(gameTeam, taskIndex)) break
    locked.push(taskIndex)
  }
  return locked
}
```

- [ ] **Step 4: Run helper test and verify GREEN**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add helpers/taskDistribution.js scripts/taskDistribution.test.js
git commit -m "feat: add task distribution helper"
```

---

### Task 2: Schema and Cabinet Normalization

**Files:**
- Modify: `schemas/gamesSchema.js`
- Modify: `schemas/gamesTeamsSchema.js`
- Modify: `helpers/normalizeGameForCabinet.js`
- Modify: `components/cabinet/app-router/GamesPageClient.js`
- Test: `scripts/taskDistribution.test.js`

- [ ] **Step 1: Add failing normalization assertions**

Append to `scripts/taskDistribution.test.js`:

```js
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'

test('normalizes game distribution fields for cabinet', () => {
  const game = normalizeGameForCabinet({
    _id: 'game-1',
    name: 'Game',
    type: 'classic',
    tasks: [{ title: 'A' }, { title: 'B' }],
    taskDistributionMode: 'random',
    taskDistributionTemplate: [[0, 1]],
  })

  assert.equal(game.taskDistributionMode, 'random')
  assert.deepEqual(game.taskDistributionTemplate, [[0, 1]])
})
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: assertion fails because normalized game does not expose `taskDistributionMode`.

- [ ] **Step 3: Add schema fields**

In `schemas/gamesSchema.js`, add near `tasks` or game timing settings:

```js
  taskDistributionMode: {
    type: String,
    enum: ['linear', 'random'],
    default: 'linear',
  },
  taskDistributionTemplate: {
    type: [[Number]],
    default: [],
  },
```

In `schemas/gamesTeamsSchema.js`, add after `activeNum`:

```js
  taskDistributionTemplate: {
    type: [[Number]],
    default: [],
  },
  taskSequence: {
    type: [Number],
    default: [],
  },
  taskSequenceGeneratedAt: {
    type: Date,
    default: null,
  },
  taskSequenceSource: {
    type: String,
    enum: ['game_template', 'team_template', 'linear'],
    default: 'linear',
  },
```

- [ ] **Step 4: Normalize cabinet game fields**

In `helpers/normalizeGameForCabinet.js`, import helper:

```js
import {
  normalizeTaskDistributionMode,
  normalizeTaskDistributionTemplate,
} from './taskDistribution.js'
```

In the returned game object, add:

```js
    taskDistributionMode: normalizeTaskDistributionMode(
      game.taskDistributionMode,
    ),
    taskDistributionTemplate: normalizeTaskDistributionTemplate(
      game.taskDistributionTemplate,
      Array.isArray(game.tasks) ? game.tasks.length : 0,
    ),
```

- [ ] **Step 5: Preserve fields in draft and save payload**

In `components/cabinet/app-router/GamesPageClient.js`, add imports:

```js
import {
  normalizeTaskDistributionMode,
  normalizeTaskDistributionTemplate,
} from '@helpers/taskDistribution'
```

In `createGame` base draft, add:

```js
        taskDistributionMode: 'linear',
        taskDistributionTemplate: [],
```

In `prepareGameDraftForModal`, add:

```js
    taskDistributionMode: normalizeTaskDistributionMode(game.taskDistributionMode),
    taskDistributionTemplate: normalizeTaskDistributionTemplate(
      game.taskDistributionTemplate,
      Array.isArray(game.tasks) ? game.tasks.length : 0,
    ),
```

In `buildUpdatePayload`, add:

```js
    taskDistributionMode: normalizeTaskDistributionMode(
      game.taskDistributionMode,
    ),
    taskDistributionTemplate:
      normalizeTaskDistributionMode(game.taskDistributionMode) === 'random'
        ? normalizeTaskDistributionTemplate(
            game.taskDistributionTemplate,
            Array.isArray(game.tasks) ? game.tasks.length : 0,
          )
        : [],
```

- [ ] **Step 6: Run test and verify GREEN**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add schemas/gamesSchema.js schemas/gamesTeamsSchema.js helpers/normalizeGameForCabinet.js components/cabinet/app-router/GamesPageClient.js scripts/taskDistribution.test.js
git commit -m "feat: persist task distribution settings"
```

---

### Task 3: Game Save API Validation

**Files:**
- Modify: `app/api/[location]/games/[id]/route.js`
- Test: `scripts/taskDistribution.test.js`

- [ ] **Step 1: Add helper test for invalid templates**

Append to `scripts/taskDistribution.test.js`:

```js
test('random template must cover every task exactly once', () => {
  const normalized = normalizeTaskDistributionTemplate([[1, 2], [4]], 4)
  const result = validateTaskDistributionTemplate(normalized, 4)

  assert.equal(result.valid, false)
  assert.deepEqual(result.missingTaskNumbers, [3])
})
```

- [ ] **Step 2: Run test and verify behavior**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: pass. This protects the validation helper before wiring the API.

- [ ] **Step 3: Wire validation into game save route**

In `app/api/[location]/games/[id]/route.js`, import:

```js
import {
  normalizeTaskDistributionMode,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'
```

Before writing `updateData`, normalize fields:

```js
        const tasksCount = Array.isArray(updateData.tasks)
          ? updateData.tasks.length
          : Array.isArray(existingGame?.tasks)
            ? existingGame.tasks.length
            : 0
        const taskDistributionMode = normalizeTaskDistributionMode(
          updateData.taskDistributionMode,
        )
        const taskDistributionTemplate =
          taskDistributionMode === 'random'
            ? normalizeTaskDistributionTemplate(
                updateData.taskDistributionTemplate,
                tasksCount,
              )
            : []

        if (taskDistributionMode === 'random') {
          const distributionValidation = validateTaskDistributionTemplate(
            taskDistributionTemplate,
            tasksCount,
          )
          if (!distributionValidation.valid) {
            return NextResponse.json(
              {
                success: false,
                error: distributionValidation.messages[0] || 'Некорректный шаблон распределения заданий',
              },
              { status: 400 },
            )
          }
        }

        updateData.taskDistributionMode = taskDistributionMode
        updateData.taskDistributionTemplate = taskDistributionTemplate
```

- [ ] **Step 4: Run API contract verifier**

Run:

```bash
npm run verify:api-contracts
```

Expected: verifier passes; failed JSON responses include `success: false`, `error`, and HTTP status.

- [ ] **Step 5: Commit**

```bash
git add app/api/[location]/games/[id]/route.js scripts/taskDistribution.test.js
git commit -m "feat: validate game task distribution template"
```

---

### Task 4: Distribution Admin API

**Files:**
- Create: `app/api/cabinet/admin/task-distribution/route.js`
- Modify: `app/api/cabinet/games/[gameId]/teams/route.js`
- Test: `scripts/taskDistribution.test.js`

- [ ] **Step 1: Add sequence generation test for team override**

Append to `scripts/taskDistribution.test.js`:

```js
test('team template can be used to build an individual sequence', () => {
  const gameTemplate = normalizeTaskDistributionTemplate([[1, 2], [3]], 3)
  const teamTemplate = normalizeTaskDistributionTemplate([[3, 2], [1]], 3)

  assert.deepEqual(buildTaskSequenceFromTemplate(gameTemplate, () => 0), [1, 0, 2])
  assert.deepEqual(buildTaskSequenceFromTemplate(teamTemplate, () => 0), [1, 2, 0])
})
```

- [ ] **Step 2: Run test**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: pass.

- [ ] **Step 3: Create distribution route**

Create `app/api/cabinet/admin/task-distribution/route.js` with this shape:

```js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'
import { toStringId } from '@helpers/idAndDate'
import {
  buildTaskSequenceFromTemplate,
  getLockedTaskSequencePrefix,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeString = (value) =>
  value === null || value === undefined ? '' : String(value).trim()

const buildSourceTemplate = ({ game, gameTeam, tasksCount }) => {
  const teamTemplate = normalizeTaskDistributionTemplate(
    gameTeam?.taskDistributionTemplate,
    tasksCount,
  )
  if (teamTemplate.length > 0) {
    return { template: teamTemplate, source: 'team_template' }
  }

  return {
    template: normalizeTaskDistributionTemplate(
      game?.taskDistributionTemplate,
      tasksCount,
    ),
    source: 'game_template',
  }
}

const mergeWithLockedPrefix = ({ gameTeam, nextSequence }) => {
  const lockedPrefix = getLockedTaskSequencePrefix(gameTeam)
  if (lockedPrefix.length === 0) return { ok: true, sequence: nextSequence }

  const nextPrefix = nextSequence.slice(0, lockedPrefix.length)
  const isSamePrefix = lockedPrefix.every((taskIndex, index) => taskIndex === nextPrefix[index])
  if (!isSamePrefix) {
    return {
      ok: false,
      message: `Нельзя изменить уже начатые задания: ${lockedPrefix.map((index) => index + 1).join(', ')}`,
    }
  }

  return { ok: true, sequence: nextSequence }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const gameId = normalizeString(payload?.gameId)
  const teamId = normalizeString(payload?.teamId)

  if (!gameId) {
    return NextResponse.json({ success: false, error: 'Не указана игра' }, { status: 400 })
  }

  const db = await dbConnectGlobal()
  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')

  const game = await Games.findById(gameId).select({
    _id: 1,
    location: 1,
    status: 1,
    tasks: 1,
    moderators: 1,
    taskDistributionMode: 1,
    taskDistributionTemplate: 1,
  }).lean()

  if (!game?._id) {
    return NextResponse.json({ success: false, error: 'Игра не найдена' }, { status: 404 })
  }

  const role = String(session.user.role || '').trim().toLowerCase()
  const currentUserId = normalizeString(
    session.user.globalUserId ?? session.user.userId ?? session.user._id,
  )
  if (!canAccessGameAsModerator({ userRole: role, currentUserId, game })) {
    return NextResponse.json({ success: false, error: 'Нет доступа к этой игре' }, { status: 403 })
  }

  if (game.taskDistributionMode !== 'random') {
    return NextResponse.json({ success: false, error: 'Для игры выбран линейный порядок заданий' }, { status: 400 })
  }

  const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
  const query = teamId ? { gameId, $or: [{ _id: teamId }, { teamId }] } : { gameId }
  const gameTeams = await GamesTeams.find(query).lean()

  if (gameTeams.length === 0) {
    return NextResponse.json({ success: false, error: 'Команды игры не найдены' }, { status: 404 })
  }

  const updates = []
  for (const gameTeam of gameTeams) {
    const { template, source } = buildSourceTemplate({ game, gameTeam, tasksCount })
    const validation = validateTaskDistributionTemplate(template, tasksCount)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Команда ${toStringId(gameTeam.teamId) || toStringId(gameTeam._id)}: ${validation.messages[0]}`,
        },
        { status: 400 },
      )
    }

    const generatedSequence = buildTaskSequenceFromTemplate(template)
    const merged = mergeWithLockedPrefix({ gameTeam, nextSequence: generatedSequence })
    if (!merged.ok) {
      return NextResponse.json({ success: false, error: merged.message }, { status: 400 })
    }

    updates.push({
      id: gameTeam._id,
      taskSequence: merged.sequence,
      taskSequenceSource: source,
    })
  }

  const generatedAt = new Date()
  await Promise.all(
    updates.map((item) =>
      GamesTeams.findByIdAndUpdate(item.id, {
        $set: {
          taskSequence: item.taskSequence,
          taskSequenceSource: item.taskSequenceSource,
          taskSequenceGeneratedAt: generatedAt,
        },
      }),
    ),
  )

  return NextResponse.json({
    success: true,
    data: {
      distributedTeamsCount: updates.length,
      generatedAt: generatedAt.toISOString(),
    },
  })
}
```

- [ ] **Step 4: Include distribution fields in teams API**

In `app/api/cabinet/games/[gameId]/teams/route.js`, extend `normalizeGameTeamEntry` response:

```js
    taskDistributionTemplate: normalizeTaskDistributionTemplate(
      doc?.taskDistributionTemplate,
      Array.isArray(game?.tasks) ? game.tasks.length : 0,
    ),
    taskSequence: Array.isArray(doc?.taskSequence)
      ? doc.taskSequence.map((item) => Number(item)).filter(Number.isInteger)
      : [],
    taskSequenceGeneratedAt: doc?.taskSequenceGeneratedAt || null,
    taskSequenceSource: doc?.taskSequenceSource || 'linear',
```

Add `update_task_distribution_template` action:

```js
    if (action === 'update_task_distribution_template') {
      const template = normalizeTaskDistributionTemplate(
        payload?.taskDistributionTemplate,
        Array.isArray(game?.tasks) ? game.tasks.length : 0,
      )
      const validation = template.length > 0
        ? validateTaskDistributionTemplate(template, Array.isArray(game?.tasks) ? game.tasks.length : 0)
        : { valid: true, messages: [] }
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.messages[0] }, { status: 400 })
      }
      await GamesTeamsModel.findByIdAndUpdate(gameTeam._id, {
        $set: { taskDistributionTemplate: template },
      })
      return NextResponse.json({ success: true, data: { taskDistributionTemplate: template } })
    }
```

- [ ] **Step 5: Run verifiers**

Run:

```bash
node scripts/taskDistribution.test.js
npm run verify:api-contracts
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/cabinet/admin/task-distribution/route.js app/api/cabinet/games/[gameId]/teams/route.js scripts/taskDistribution.test.js
git commit -m "feat: add task distribution admin api"
```

---

### Task 5: Server Start Guard

**Files:**
- Modify: `server/gameStart.js`
- Modify: `server/buildGameStartProgressUpdate.js`
- Test: `scripts/gameStartProgress.test.js`

- [ ] **Step 1: Add failing start progress test**

Append to `scripts/gameStartProgress.test.js`:

```js
test('game start progress preserves generated task sequence metadata', () => {
  const result = buildGameStartProgressUpdate({
    gameTasksCount: 3,
    startImmediately: true,
    timeAddings: [],
    taskSequence: [2, 0, 1],
    taskSequenceSource: 'game_template',
    taskSequenceGeneratedAt: new Date('2026-06-29T00:00:00Z'),
  })

  assert.deepEqual(result.taskSequence, [2, 0, 1])
  assert.equal(result.taskSequenceSource, 'game_template')
  assert.equal(
    result.taskSequenceGeneratedAt.toISOString(),
    '2026-06-29T00:00:00.000Z',
  )
})
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node scripts/gameStartProgress.test.js
```

Expected: fails because `buildGameStartProgressUpdate` drops sequence metadata.

- [ ] **Step 3: Preserve sequence in progress reset**

Change `server/buildGameStartProgressUpdate.js` signature:

```js
const buildGameStartProgressUpdate = ({
  gameTasksCount,
  startImmediately,
  timeAddings = [],
  taskSequence = [],
  taskSequenceSource = 'linear',
  taskSequenceGeneratedAt = null,
}) => {
```

Add to returned object:

```js
    taskSequence,
    taskSequenceSource,
    taskSequenceGeneratedAt,
```

In `server/gameStart.js`, pass existing team metadata:

```js
          taskSequence: Array.isArray(team.taskSequence) ? team.taskSequence : [],
          taskSequenceSource: team.taskSequenceSource || 'linear',
          taskSequenceGeneratedAt: team.taskSequenceGeneratedAt || null,
```

- [ ] **Step 4: Add start guard**

In `server/gameStart.js`, before status update, add:

```js
  if (game.taskDistributionMode === 'random') {
    const gameTeams = await db.model('GamesTeams').find({
      gameId: jsonCommand.gameId,
    })
    const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
    const hasMissingDistribution = gameTeams.some((team) => {
      const sequence = Array.isArray(team.taskSequence) ? team.taskSequence : []
      return sequence.length !== tasksCount || new Set(sequence).size !== tasksCount
    })

    if (hasMissingDistribution) {
      return {
        success: false,
        error: 'Сначала распределите задания для всех команд',
        message: 'Сначала распределите задания для всех команд',
      }
    }
  }
```

Reuse the already loaded `gameTeams` later in the function to avoid a second query.

- [ ] **Step 5: Run test**

Run:

```bash
node scripts/gameStartProgress.test.js
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add server/gameStart.js server/buildGameStartProgressUpdate.js scripts/gameStartProgress.test.js
git commit -m "feat: require task distribution before random game start"
```

---

### Task 6: Web Game Process Sequence Mapping

**Files:**
- Modify: `server/webGameProcess.js`
- Modify: `server/getTeamGameTaskState.js`
- Test: `scripts/taskDistribution.test.js`

- [ ] **Step 1: Add source-index helper test**

Append to `scripts/taskDistribution.test.js`:

```js
test('source task progress remains indexed by original task number', () => {
  const game = { tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }
  const gameTeam = {
    activeNum: 0,
    taskSequence: [1, 2, 0],
    findedCodes: [[], ['code-b'], []],
  }

  const activeTaskIndex = getTaskIndexForStep(game, gameTeam, gameTeam.activeNum)
  assert.equal(activeTaskIndex, 1)
  assert.deepEqual(gameTeam.findedCodes[activeTaskIndex], ['code-b'])
})
```

- [ ] **Step 2: Run test**

Run:

```bash
node scripts/taskDistribution.test.js
```

Expected: pass.

- [ ] **Step 3: Update `webGameProcess.js` imports and active index**

Import:

```js
import { getTaskIndexForStep } from '@helpers/taskDistribution'
```

Replace active task resolution:

```js
  const activeStepRaw = Number.isInteger(resolvedGameTeam.activeNum)
    ? resolvedGameTeam.activeNum
    : 0
  const activeStep = Math.min(Math.max(activeStepRaw, 0), tasksCount)
  const activeTaskIndex = getTaskIndexForStep(
    resolvedGame,
    resolvedGameTeam,
    activeStep,
  )
```

When deciding the next task, keep step movement:

```js
    const nextTaskStep = activeStep + 1
    const nextTaskIndex = getTaskIndexForStep(
      resolvedGame,
      resolvedGameTeam,
      nextTaskStep,
    )
```

Use `activeTaskIndex` for every progress array access and `nextTaskIndex` for the next start time slot. Use `activeNum: nextTaskStep` when advancing.

- [ ] **Step 4: Update `getTeamGameTaskState.js` active index helpers**

Import:

```js
import { getTaskIndexForStep } from '@helpers/taskDistribution'
```

For every block that currently does:

```js
const activeTaskIndex = Number.isInteger(gameTeam?.activeNum) ? gameTeam.activeNum : 0
```

replace with:

```js
const activeStep = Number.isInteger(gameTeam?.activeNum) ? gameTeam.activeNum : 0
const activeTaskIndex = getTaskIndexForStep(game, gameTeam, activeStep)
```

When advancing:

```js
const nextStep = activeStep + 1
const nextTaskIndex = getTaskIndexForStep(game, teamState, nextStep)
```

Write `activeNum: nextStep`, but write `startTime[nextTaskIndex]`.

- [ ] **Step 5: Run focused tests and lint target files**

Run:

```bash
node scripts/taskDistribution.test.js
npx eslint server/webGameProcess.js server/getTeamGameTaskState.js --ext .js --no-error-on-unmatched-pattern
```

Expected: tests pass; eslint reports no errors for touched files.

- [ ] **Step 6: Commit**

```bash
git add server/webGameProcess.js server/getTeamGameTaskState.js scripts/taskDistribution.test.js
git commit -m "feat: use task sequence in web game process"
```

---

### Task 7: Admin Actions and Game Control Status

**Files:**
- Modify: `app/api/cabinet/admin/game-status/action/route.js`
- Modify: `app/api/cabinet/admin/game-status/route.js`
- Modify: `components/cabinet/app-router/GameControlPageClient.js`
- Modify: `components/modals/GameControlTeamStatsModal.js`

- [ ] **Step 1: Update admin action route**

Import in `app/api/cabinet/admin/game-status/action/route.js`:

```js
import { getTaskIndexForStep } from '@helpers/taskDistribution'
```

In `forceCompleteActiveTask` and `forceFailActiveTask`, compute:

```js
  const activeStepRaw = Number.isInteger(gameTeam?.activeNum) ? gameTeam.activeNum : 0
  if (activeStepRaw >= tasksCount) {
    return { success: false, message: 'Команда уже завершила игру.' }
  }
  const activeTaskIndex = getTaskIndexForStep(game, gameTeam, activeStepRaw)
  if (activeTaskIndex === null) {
    return { success: false, message: 'Текущее задание не найдено.' }
  }
  const nextTaskStep = activeStepRaw + 1
  const nextTaskIndex = getTaskIndexForStep(game, gameTeam, nextTaskStep)
```

Write `activeNum: nextTaskStep`; write next `startTime` at `nextTaskIndex` when it exists.

- [ ] **Step 2: Update Game Control status route**

Import:

```js
import {
  getTaskIndexForStep,
  getTeamTaskSequence,
} from '@helpers/taskDistribution'
```

In `syncGameTeamProgressForStatus`, treat `activeNum` as step:

```js
    const activeStep = Number.isInteger(teamState?.activeNum)
      ? teamState.activeNum
      : 0
    if (activeStep >= tasksCount) return teamState

    const taskIndex = getTaskIndexForStep(game, teamState, activeStep)
    const nextStep = activeStep + 1
    const nextIndex = getTaskIndexForStep(game, teamState, nextStep)
```

Return status fields:

```js
        activeTaskStep: activeNum,
        activeTaskIndex,
        taskSequence: getTeamTaskSequence(game, gt),
        taskSequenceLabels: getTeamTaskSequence(game, gt).map((taskIndex, step) => ({
          step,
          taskIndex,
          label: `${taskIndex + 1}. ${normalizeText(game.tasks?.[taskIndex]?.title) || 'Без названия'}`,
        })),
```

Keep `teamProgressStats.tasks` generated with `taskIndex` loop over original `game.tasks`.

- [ ] **Step 3: Update Game Control client labels**

In `components/cabinet/app-router/GameControlPageClient.js`, when rendering current task label, replace plain:

```js
`${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`
```

with:

```js
Number.isInteger(team.activeTaskStep) &&
Number.isInteger(team.activeTaskIndex)
  ? `Шаг ${team.activeTaskStep + 1}/${Number(data?.tasksCount || 0)}: задание ${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`
  : `${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`
```

In `GameControlTeamStatsModal`, show `task.taskIndex + 1` as source task number, not row index.

- [ ] **Step 4: Run lint and API verifier**

Run:

```bash
npx eslint app/api/cabinet/admin/game-status/action/route.js app/api/cabinet/admin/game-status/route.js components/cabinet/app-router/GameControlPageClient.js components/modals/GameControlTeamStatsModal.js --ext .js --no-error-on-unmatched-pattern
npm run verify:api-contracts
```

Expected: no eslint errors; API verifier passes.

- [ ] **Step 5: Commit**

```bash
git add app/api/cabinet/admin/game-status/action/route.js app/api/cabinet/admin/game-status/route.js components/cabinet/app-router/GameControlPageClient.js components/modals/GameControlTeamStatsModal.js
git commit -m "feat: show sequenced tasks in game control"
```

---

### Task 8: Results Computation by Source Task Index

**Files:**
- Modify: `server/buildGameResultComputed.js`
- Test: `scripts/taskDistributionResult.test.js`

- [ ] **Step 1: Write failing result test**

Create `scripts/taskDistributionResult.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameResultComputed from '../server/buildGameResultComputed.js'

test('result columns stay bound to source task indexes with custom sequence', async () => {
  const game = {
    type: 'classic',
    taskDuration: 3600,
    tasks: [
      { title: 'Task 1' },
      { title: 'Task 2' },
      { title: 'Task 3' },
    ],
    result: {
      teams: [{ _id: 'team-1', name: 'Team' }],
      teamsUsers: [{ teamId: 'team-1', userId: 'user-1' }],
      gameTeams: [
        {
          teamId: 'team-1',
          activeNum: 3,
          taskSequence: [1, 0, 2],
          startTime: [
            new Date('2026-01-01T00:10:00Z'),
            new Date('2026-01-01T00:00:00Z'),
            new Date('2026-01-01T00:20:00Z'),
          ],
          endTime: [
            new Date('2026-01-01T00:15:00Z'),
            new Date('2026-01-01T00:05:00Z'),
            new Date('2026-01-01T00:25:00Z'),
          ],
          findedPenaltyCodes: [[], [], []],
          findedBonusCodes: [[], [], []],
          wrongCodes: [[], [], []],
          timeAddings: [],
          taskFailures: [],
        },
      ],
    },
  }

  const result = await buildGameResultComputed({ game })
  const team = result.computed.teams[0]

  assert.deepEqual(
    team.taskResults.map((task) => task.taskTitle),
    ['Task 1', 'Task 2', 'Task 3'],
  )
  assert.deepEqual(
    team.taskResults.map((task) => task.seconds),
    [300, 300, 300],
  )
  assert.deepEqual(team.taskSequence, [1, 0, 2])
})
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node scripts/taskDistributionResult.test.js
```

Expected: fails because `taskSequence` is not included or active-step logic still assumes source index.

- [ ] **Step 3: Update result computation**

Import:

```js
import { getTeamTaskSequence } from '@helpers/taskDistribution'
```

In `buildTeamResult` and `buildPhotoTeamResult`, add:

```js
  const taskSequence = getTeamTaskSequence(game, gameTeam)
```

In returned team result, add:

```js
    taskSequence,
```

In `buildTaskDurations`, determine task completion by source index:

```js
  const taskSequence = getTeamTaskSequence(game, gameTeam)
  const completedTaskIndexes = new Set(taskSequence.slice(0, activeNum))
```

Replace `if (activeNum > index)` with:

```js
    if (completedTaskIndexes.has(index)) {
```

Replace `if (activeNum === index)` with:

```js
    if (taskSequence[activeNum] === index) {
```

- [ ] **Step 4: Run result test**

Run:

```bash
node scripts/taskDistributionResult.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/buildGameResultComputed.js scripts/taskDistributionResult.test.js
git commit -m "feat: compute results by source task index"
```

---

### Task 9: Game Editor UI for Global Template

**Files:**
- Create: `components/modals/game-edit/sections/TaskDistributionSection.js`
- Modify: `components/modals/game-edit/GameEditModal.js`
- Modify: `components/modals/game-edit/sections/GameBasicInfoSection.js`
- Modify: `components/cabinet/app-router/GamesPageClient.js`

- [ ] **Step 1: Create TaskDistributionSection**

Create `components/modals/game-edit/sections/TaskDistributionSection.js`:

```js
import PropTypes from 'prop-types'
import { useMemo, useState } from 'react'

import Modal from '@components/Modal'
import {
  formatTaskDistributionTemplate,
  normalizeTaskDistributionMode,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'

const buildLinearTemplate = (tasksCount) =>
  Array.from({ length: tasksCount }, (_, index) => [index])

const TaskDistributionSection = ({ selectedGame, updateSelectedGame, disabled }) => {
  const [isConstructorOpen, setIsConstructorOpen] = useState(false)
  const tasks = Array.isArray(selectedGame?.tasks) ? selectedGame.tasks : []
  const tasksCount = tasks.length
  const mode = normalizeTaskDistributionMode(selectedGame?.taskDistributionMode)
  const template = normalizeTaskDistributionTemplate(
    selectedGame?.taskDistributionTemplate,
    tasksCount,
  )
  const effectiveTemplate = template.length > 0 ? template : buildLinearTemplate(tasksCount)
  const validation = validateTaskDistributionTemplate(effectiveTemplate, tasksCount)
  const preview = formatTaskDistributionTemplate(effectiveTemplate)

  const taskOptions = useMemo(
    () =>
      tasks.map((task, index) => ({
        taskIndex: index,
        label: `${index + 1}. ${String(task?.title || '').trim() || 'Без названия'}`,
      })),
    [tasks],
  )

  const handleModeChange = (event) => {
    const nextMode = event.target.value === 'random' ? 'random' : 'linear'
    updateSelectedGame({
      taskDistributionMode: nextMode,
      taskDistributionTemplate:
        nextMode === 'random' ? effectiveTemplate : [],
    })
  }

  const moveTaskToBlock = (taskIndex, blockIndex) => {
    const nextTemplate = effectiveTemplate
      .map((block) => block.filter((item) => item !== taskIndex))
      .filter((block) => block.length > 0)
    while (nextTemplate.length <= blockIndex) nextTemplate.push([])
    nextTemplate[blockIndex] = [...nextTemplate[blockIndex], taskIndex]
    updateSelectedGame({ taskDistributionTemplate: nextTemplate })
  }

  const addBlock = () => {
    updateSelectedGame({ taskDistributionTemplate: [...effectiveTemplate, []] })
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Распределение заданий
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Квадратные скобки перемешиваются внутри блока, блоки идут по порядку.
          </p>
        </div>
        <select
          value={mode}
          onChange={handleModeChange}
          disabled={disabled}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="linear">Линейное</option>
          <option value="random">Случайное</option>
        </select>
      </div>

      {mode === 'random' ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
            {preview || 'Шаблон не задан'}
          </div>
          {validation.messages.length > 0 ? (
            <p className="text-xs text-rose-600 dark:text-rose-300">
              {validation.messages[0]}
            </p>
          ) : null}
          <button
            type="button"
            className="aq-modal-btn aq-modal-btn-secondary"
            onClick={() => setIsConstructorOpen(true)}
            disabled={disabled || tasksCount === 0}
          >
            Конструктор блоков
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Задания выдаются в порядке редактора заданий.
        </p>
      )}

      <Modal
        isOpen={isConstructorOpen}
        onClose={() => setIsConstructorOpen(false)}
        title="Конструктор распределения"
      >
        <div className="space-y-4">
          <div className="text-sm font-mono text-slate-700 dark:text-slate-200">
            {preview}
          </div>
          <div className="space-y-3">
            {effectiveTemplate.map((block, blockIndex) => (
              <div key={`distribution-block-${blockIndex}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Блок {blockIndex + 1}
                </p>
                <div className="flex flex-wrap gap-2">
                  {block.map((taskIndex) => (
                    <span key={taskIndex} className="rounded-lg bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">
                      {taskOptions.find((item) => item.taskIndex === taskIndex)?.label}
                    </span>
                  ))}
                </div>
                <select
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value=""
                  onChange={(event) => {
                    const taskIndex = Number(event.target.value)
                    if (Number.isInteger(taskIndex)) moveTaskToBlock(taskIndex, blockIndex)
                  }}
                >
                  <option value="">Добавить задание в блок</option>
                  {taskOptions.map((task) => (
                    <option key={task.taskIndex} value={task.taskIndex}>
                      {task.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button type="button" className="aq-modal-btn aq-modal-btn-secondary" onClick={addBlock}>
            Добавить блок
          </button>
        </div>
      </Modal>
    </section>
  )
}

TaskDistributionSection.propTypes = {
  selectedGame: PropTypes.object,
  updateSelectedGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

TaskDistributionSection.defaultProps = {
  selectedGame: null,
  disabled: false,
}

export default TaskDistributionSection
```

- [ ] **Step 2: Mount section in GameEditModal**

In `components/modals/game-edit/GameEditModal.js`, import:

```js
import TaskDistributionSection from './sections/TaskDistributionSection'
```

Render it after basic/settings sections:

```jsx
              {selectedGame?.type !== 'story' ? (
                <TaskDistributionSection
                  selectedGame={selectedGame}
                  updateSelectedGame={updateSelectedGame}
                  disabled={isReadOnly}
                />
              ) : null}
```

- [ ] **Step 3: Validate before save**

In `GamesPageClient.js`, inside `handleSaveChanges`, before mutation:

```js
    if (normalizeTaskDistributionMode(gameToSave.taskDistributionMode) === 'random') {
      const distributionTemplate = normalizeTaskDistributionTemplate(
        gameToSave.taskDistributionTemplate,
        Array.isArray(gameToSave.tasks) ? gameToSave.tasks.length : 0,
      )
      const distributionValidation = validateTaskDistributionTemplate(
        distributionTemplate,
        Array.isArray(gameToSave.tasks) ? gameToSave.tasks.length : 0,
      )
      if (!distributionValidation.valid) {
        setFeedback({
          type: 'error',
          message: distributionValidation.messages[0],
        })
        return
      }
    }
```

Add `validateTaskDistributionTemplate` to imports.

- [ ] **Step 4: Run lint**

Run:

```bash
npx eslint components/modals/game-edit/GameEditModal.js components/modals/game-edit/sections/TaskDistributionSection.js components/cabinet/app-router/GamesPageClient.js --ext .js --no-error-on-unmatched-pattern
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/modals/game-edit/GameEditModal.js components/modals/game-edit/sections/TaskDistributionSection.js components/cabinet/app-router/GamesPageClient.js
git commit -m "feat: add game task distribution editor"
```

---

### Task 10: Team Editor UI for Individual Template

**Files:**
- Modify: `components/modals/GameTeamsModal.js`
- Modify: `components/cabinet/app-router/GamesPageClient.js`

- [ ] **Step 1: Add team distribution controls**

In `components/modals/GameTeamsModal.js`, import:

```js
import {
  formatTaskDistributionTemplate,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'
```

Add state:

```js
  const [teamDistributionTarget, setTeamDistributionTarget] = useState(null)
  const [teamDistributionTemplate, setTeamDistributionTemplate] = useState([])
  const [isSavingTeamDistribution, setIsSavingTeamDistribution] = useState(false)
  const [teamDistributionError, setTeamDistributionError] = useState('')
```

Add open handler:

```js
  const handleOpenTeamDistributionModal = useCallback((team) => {
    const tasksCount = Array.isArray(selectedGame?.tasks) ? selectedGame.tasks.length : 0
    setTeamDistributionTarget(team)
    setTeamDistributionTemplate(
      normalizeTaskDistributionTemplate(team?.taskDistributionTemplate, tasksCount),
    )
    setTeamDistributionError('')
  }, [selectedGame?.tasks])
```

Add save handler:

```js
  const handleSaveTeamDistributionTemplate = useCallback(async () => {
    if (!teamDistributionTarget?.id || !selectedGame?.id) return
    const tasksCount = Array.isArray(selectedGame?.tasks) ? selectedGame.tasks.length : 0
    const validation = teamDistributionTemplate.length > 0
      ? validateTaskDistributionTemplate(teamDistributionTemplate, tasksCount)
      : { valid: true, messages: [] }
    if (!validation.valid) {
      setTeamDistributionError(validation.messages[0])
      return
    }

    setIsSavingTeamDistribution(true)
    try {
      await requestApiJson(`/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'update_task_distribution_template',
          gameTeamId: teamDistributionTarget.id,
          taskDistributionTemplate: teamDistributionTemplate,
        }),
        fallbackMessage: 'Не удалось сохранить шаблон команды',
      })
      setTeamDistributionTarget(null)
      handleRefreshTeamsModalData?.()
    } catch (error) {
      setTeamDistributionError(error?.message || 'Не удалось сохранить шаблон команды')
    } finally {
      setIsSavingTeamDistribution(false)
    }
  }, [handleRefreshTeamsModalData, selectedGame?.id, selectedGame?.tasks, teamDistributionTarget, teamDistributionTemplate])
```

Add distribute handler:

```js
  const handleDistributeTeamTasks = useCallback(async (team) => {
    if (!team?.id || !selectedGame?.id) return
    await requestApiJson('/api/cabinet/admin/task-distribution', {
      method: 'POST',
      body: JSON.stringify({ gameId: selectedGame.id, teamId: team.id }),
      fallbackMessage: 'Не удалось распределить задания команды',
    })
    handleRefreshTeamsModalData?.()
  }, [handleRefreshTeamsModalData, selectedGame?.id])
```

- [ ] **Step 2: Render buttons for random games**

In each team card, render when `selectedGame.taskDistributionMode === 'random'`:

```jsx
<div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
  <p>
    Шаблон: {team.taskDistributionTemplate?.length
      ? formatTaskDistributionTemplate(team.taskDistributionTemplate)
      : 'общий шаблон игры'}
  </p>
  <p>
    Маршрут: {team.taskSequence?.length
      ? team.taskSequence.map((index) => index + 1).join(' → ')
      : 'не распределён'}
  </p>
  <div className="mt-2 flex flex-wrap gap-2">
    <button type="button" className="aq-modal-btn aq-modal-btn-secondary" onClick={() => handleOpenTeamDistributionModal(team)}>
      Изменить шаблон
    </button>
    <button type="button" className="aq-modal-btn aq-modal-btn-primary" onClick={() => handleDistributeTeamTasks(team)}>
      Распределить для команды
    </button>
  </div>
</div>
```

- [ ] **Step 3: Add modal**

Add a `Modal` at the bottom of `GameTeamsModal`:

```jsx
<Modal
  isOpen={Boolean(teamDistributionTarget)}
  onClose={() => setTeamDistributionTarget(null)}
  title="Индивидуальный шаблон команды"
  footer={
    <>
      <button type="button" className="aq-modal-btn aq-modal-btn-secondary" onClick={() => setTeamDistributionTarget(null)}>
        Отмена
      </button>
      <button type="button" className="aq-modal-btn aq-modal-btn-primary" onClick={handleSaveTeamDistributionTemplate} disabled={isSavingTeamDistribution}>
        Сохранить
      </button>
    </>
  }
>
  <div className="space-y-3">
    <p className="text-sm text-slate-500 dark:text-slate-300">
      Пустой индивидуальный шаблон означает общий шаблон игры.
    </p>
    <textarea
      className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      value={formatTaskDistributionTemplate(teamDistributionTemplate)}
      onChange={(event) => {
        const raw = event.target.value
        const parsed = raw
          .split('],')
          .map((part) => part.replace(/[\[\]]/g, '').split(',').map((item) => Number(item.trim())).filter(Number.isFinite))
        setTeamDistributionTemplate(normalizeTaskDistributionTemplate(parsed, Array.isArray(selectedGame?.tasks) ? selectedGame.tasks.length : 0))
      }}
    />
    {teamDistributionError ? <p className="text-sm text-rose-600">{teamDistributionError}</p> : null}
  </div>
</Modal>
```

- [ ] **Step 4: Run lint**

Run:

```bash
npx eslint components/modals/GameTeamsModal.js --ext .js --no-error-on-unmatched-pattern
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/modals/GameTeamsModal.js
git commit -m "feat: edit team task distribution template"
```

---

### Task 11: Pre-start Distribution Button and Status Action

**Files:**
- Modify: `components/cabinet/app-router/GamesPageClient.js`
- Modify: `components/modals/GameStatusModal.js`

- [ ] **Step 1: Add distribution mutation**

In `GamesPageClient.js`, add mutation:

```js
  const distributeTasksMutation = useMutation({
    mutationFn: async ({ gameId }) => {
      const { json } = await requestApiJson('/api/cabinet/admin/task-distribution', {
        method: 'POST',
        body: JSON.stringify({ gameId }),
        fallbackMessage: 'Не удалось распределить задания',
      })
      return json?.data || {}
    },
    onSuccess: (_data, variables) => {
      setToastEvent({
        id: `task-distribution-${Date.now()}`,
        type: 'success',
        message: 'Задания распределены',
      })
      queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
      if (variables?.gameId) {
        removeGameResultsQueries(queryClient, variables.gameId)
      }
    },
  })
```

- [ ] **Step 2: Add status modal action**

When building `statusModalActions`, include before `start_game` for active random games:

```js
  if (
    normalizedStatus === 'active' &&
    selectedGame?.taskDistributionMode === 'random'
  ) {
    actions.push({
      id: 'distribute_tasks',
      label: distributeTasksMutation.isPending ? 'Распределяем...' : 'Распределить задания',
      description: 'Создать индивидуальную последовательность заданий для каждой команды.',
      variant: 'secondary',
      disabled: distributeTasksMutation.isPending,
    })
  }
```

In `handleStatusAction`, add:

```js
        if (actionId === 'distribute_tasks') {
          await distributeTasksMutation.mutateAsync({ gameId: statusModalGame.id })
          return
        }
```

- [ ] **Step 3: Run lint**

Run:

```bash
npx eslint components/cabinet/app-router/GamesPageClient.js components/modals/GameStatusModal.js --ext .js --no-error-on-unmatched-pattern
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/cabinet/app-router/GamesPageClient.js components/modals/GameStatusModal.js
git commit -m "feat: add pre-start task distribution action"
```

---

### Task 12: Documentation and Final Verification

**Files:**
- Modify: `docs/game-logic.md`

- [ ] **Step 1: Update docs**

In `docs/game-logic.md`, add:

```md
## Распределение заданий

Для web/cabinet-ветки задания могут идти линейно или по случайному блочному распределению.

- `Games.taskDistributionMode = linear` сохраняет порядок `Games.tasks`.
- `Games.taskDistributionMode = random` требует валидный `Games.taskDistributionTemplate`.
- `GamesTeams.taskSequence` хранит индивидуальный маршрут команды в исходных индексах `Games.tasks`.
- `GamesTeams.activeNum` хранит шаг команды в маршруте, а не исходный индекс задания.
- Все массивы прогресса (`startTime`, `endTime`, `findedCodes`, `photos`, `taskFailures`) индексируются исходным индексом задания.
- Перед стартом random-игры сервер блокирует запуск, если хотя бы у одной команды нет валидного `taskSequence`.
```

- [ ] **Step 2: Run all focused tests**

Run:

```bash
node scripts/taskDistribution.test.js
node scripts/taskDistributionResult.test.js
node scripts/gameStartProgress.test.js
npm run verify:api-contracts
```

Expected: all pass.

- [ ] **Step 3: Run project lint**

Run:

```bash
npm run lint
```

Expected: lint passes. If lint scope misses newly created files, also run:

```bash
npx eslint helpers/taskDistribution.js components/modals/game-edit/sections/TaskDistributionSection.js app/api/cabinet/admin/task-distribution/route.js --ext .js --no-error-on-unmatched-pattern
```

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: production build completes.

- [ ] **Step 5: Commit docs and verification fixes**

```bash
git add docs/game-logic.md
git commit -m "docs: describe task distribution flow"
```

---

## Manual QA Checklist

- [ ] Create or open a classic game with 10 tasks.
- [ ] Set distribution mode to `Случайное`.
- [ ] Configure template `[1,2,3],[4,5,6,7],[8,9],10`.
- [ ] Save game.
- [ ] Open status modal before start and click `Распределить задания`.
- [ ] Confirm every registered team has a route with all 10 task numbers exactly once.
- [ ] Try starting a random game before distribution in a fresh copy; confirm server returns `Сначала распределите задания для всех команд`.
- [ ] Start the distributed game.
- [ ] Open team game page and confirm first displayed task follows that team's route.
- [ ] Complete first task and confirm next task remains inside the first block until block is exhausted.
- [ ] Open Game Control and confirm current task shows `Шаг X/10: задание Y`.
- [ ] Use `force_complete` and confirm the next step starts but progress remains tied to source task index.
- [ ] Generate results and confirm task columns remain in original task-editor order.
