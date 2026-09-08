import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveClosedGameUpdateViolation } from '../helpers/closedGameUpdateProtection.js'

const fakeObjectId = (value) => ({
  toString: () => value,
  toHexString: () => value,
})

const buildExistingGame = () => ({
  type: 'classic',
  status: 'closed',
  taskDuration: 60,
  cluesDuration: 30,
  breakDuration: 15,
  taskFailurePenalty: 20,
  manyCodesPenalty: [5, 10],
  clueEarlyAccessMode: 'off',
  clueEarlyPenalty: 0,
  clueEarlyAccessFrom: 1,
  allowCaptainForceClue: false,
  allowCaptainFailTask: false,
  allowCaptainFinishBreak: false,
  useCustomTaskPublicTitles: false,
  individualStart: false,
  startingPlace: 'Парк',
  finishingPlace: 'Площадь',
  showFinishingPlace: true,
  taskDistributionMode: 'common',
  taskDistributionTemplate: [],
  tasks: [
    {
      _id: fakeObjectId('507f1f77bcf86cd799439011'),
      title: 'Первое задание',
      task: 'Найдите вход',
      codes: ['КОД1', ' КОД2 '],
      clues: [{ _id: fakeObjectId('507f1f77bcf86cd799439012'), clue: 'Север' }],
      coordinates: { latitude: 55.7, longitude: 37.6, radius: 30 },
      canceled: false,
      isBonusTask: false,
      taskBonusForComplite: 0,
      agentUserIds: [fakeObjectId('507f1f77bcf86cd799439013')],
    },
    {
      _id: fakeObjectId('507f1f77bcf86cd799439014'),
      title: 'Второе задание',
      task: 'Сфотографируйте',
      codes: [],
      clues: [],
      coordinates: { latitude: null, longitude: null, radius: null },
      canceled: false,
      isBonusTask: false,
      taskBonusForComplite: 0,
      agentUserIds: [],
    },
  ],
  prequel: {
    enabled: true,
    openAt: new Date('2026-09-01T10:00:00.000Z'),
    description: 'Разминка',
    descriptionRich: '<p>Разминка</p>',
    descriptionMedia: [{ url: 'https://example.com/prequel.jpg' }],
    mode: 'multi_hit',
    bonusCodes: [
      {
        _id: fakeObjectId('507f1f77bcf86cd799439015'),
        code: 'БОНУС',
        value: 5,
        description: '',
        image: '',
        storyEffects: [],
      },
    ],
    penaltyCodes: [],
    wrongAttemptsLimit: null,
    wrongAttemptsPenalty: 0,
    wrongAttemptsStoryEffects: [],
  },
  prequels: [],
})

const normalizeTaskForPayload = (task) => ({
  _id: String(task._id),
  title: task.title,
  task: task.task,
  codes: task.codes.map((code) => String(code).trim()),
  clues: task.clues.map((clue) => ({
    _id: String(clue._id),
    clue: clue.clue,
  })),
  coordinates: { ...task.coordinates },
  canceled: task.canceled,
  isBonusTask: task.isBonusTask,
  taskBonusForComplite: task.taskBonusForComplite,
  agentUserIds: task.agentUserIds.map(String),
})

const normalizePrequelForPayload = (prequel) => ({
  _id: prequel._id ? String(prequel._id) : undefined,
  enabled: prequel.enabled,
  openAt: new Date(prequel.openAt).toISOString(),
  description: prequel.description,
  descriptionRich: prequel.descriptionRich,
  descriptionMedia: (prequel.descriptionMedia ?? []).map((media) => ({
    url: media.url,
  })),
  mode: prequel.mode,
  bonusCodes: prequel.bonusCodes.map((code) => ({
    _id: String(code._id),
    code: code.code,
    value: code.value,
    description: code.description,
    image: code.image,
    storyEffects: code.storyEffects,
  })),
  penaltyCodes: prequel.penaltyCodes.map((code) => ({
    _id: String(code._id),
    code: code.code,
    value: code.value,
    description: code.description,
    image: code.image,
    storyEffects: code.storyEffects,
  })),
  wrongAttemptsLimit: prequel.wrongAttemptsLimit,
  wrongAttemptsPenalty: prequel.wrongAttemptsPenalty,
  wrongAttemptsStoryEffects: prequel.wrongAttemptsStoryEffects,
})

// Полный payload, как его отправляет кабинет: задания и приквел приведены к
// клиентской нормализованной форме (id строками, даты ISO, сгенерированные
// media-id опущены — сравнение по контенту).
const buildUpdateData = (game) => {
  const prequelList =
    Array.isArray(game.prequels) && game.prequels.length > 0
      ? game.prequels
      : [game.prequel]

  return {
    name: game.name,
    status: 'closed',
    type: game.type,
    taskDuration: game.taskDuration,
    cluesDuration: game.cluesDuration,
    breakDuration: game.breakDuration,
    taskFailurePenalty: game.taskFailurePenalty,
    manyCodesPenalty: [...game.manyCodesPenalty],
    clueEarlyAccessMode: game.clueEarlyAccessMode,
    clueEarlyPenalty: game.clueEarlyPenalty,
    clueEarlyAccessFrom: game.clueEarlyAccessFrom,
    allowCaptainForceClue: game.allowCaptainForceClue,
    allowCaptainFailTask: game.allowCaptainFailTask,
    allowCaptainFinishBreak: game.allowCaptainFinishBreak,
    useCustomTaskPublicTitles: game.useCustomTaskPublicTitles,
    individualStart: game.individualStart,
    startingPlace: game.startingPlace,
    finishingPlace: game.finishingPlace,
    showFinishingPlace: game.showFinishingPlace,
    taskDistributionMode: game.taskDistributionMode,
    taskDistributionTemplate: [...game.taskDistributionTemplate],
    tasks: game.tasks.map(normalizeTaskForPayload),
    prequel: normalizePrequelForPayload(game.prequel),
    prequels: prequelList.map(normalizePrequelForPayload),
  }
}

test('смена статуса закрытой игры (reopen) разрешена', () => {
  const existingGame = buildExistingGame()
  const violation = resolveClosedGameUpdateViolation({
    updateData: { status: 'reopen' },
    existingGame,
  })
  assert.equal(violation, null)
})

test('полный payload без изменений заданий и настроек проходит проверку', () => {
  const existingGame = buildExistingGame()
  const violation = resolveClosedGameUpdateViolation({
    updateData: buildUpdateData(existingGame),
    existingGame,
  })
  assert.equal(violation, null)
})

test('изменение текста задания отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.tasks[0].task = 'Другой текст задания'
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'задания')
})

test('добавление задания отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.tasks.push({
    title: 'Третье задание',
    task: 'Новое',
    codes: [],
    clues: [],
    coordinates: { latitude: null, longitude: null, radius: null },
    canceled: false,
    isBonusTask: false,
    taskBonusForComplite: 0,
    agentUserIds: [],
  })
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'задания')
})

test('перестановка заданий местами отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.tasks.reverse()
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'задания')
})

test('изменение кодов задания отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.tasks[0].codes = ['КОД1', 'ДРУГОЙ']
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'задания')
})

test('изменение координат задания отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.tasks[0].coordinates = {
    latitude: 56.8,
    longitude: 37.6,
    radius: 30,
  }
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'задания')
})

test('изменение приквела отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.prequel.bonusCodes[0].code = 'НОВЫЙКОД'
  updateData.prequels[0].bonusCodes[0].code = 'НОВЫЙКОД'
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'приквел')
})

test('изменение длительности задания отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.taskDuration = 90
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'длительность задания')
})

test('изменение штрафа за лишние коды отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.manyCodesPenalty = [5, 15]
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'штраф за лишние коды')
})

test('включение капитанского слива задания отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.allowCaptainFailTask = true
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'капитанское действие «слить задание»')
})

test('изменение типа игры отклоняется', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.type = 'photo'
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'тип игры')
})

test('легитимное обновление финансов с неизменными заданиями разрешено', () => {
  const existingGame = buildExistingGame()
  const updateData = buildUpdateData(existingGame)
  updateData.finances = [
    {
      id: 'fin-1',
      type: 'expense',
      sum: 5000,
      date: null,
      description: 'Аренда',
    },
  ]
  updateData.moderators = ['507f1f77bcf86cd799439020']
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, null)
})

test('перестановка приквелов в коллекции отклоняется', () => {
  const existingGame = buildExistingGame()
  existingGame.prequels = [
    {
      ...existingGame.prequel,
      _id: fakeObjectId('507f1f77bcf86cd799439016'),
      description: 'Первый приквел',
    },
    {
      ...existingGame.prequel,
      _id: fakeObjectId('507f1f77bcf86cd799439017'),
      description: 'Второй приквел',
    },
  ]
  const updateData = buildUpdateData(existingGame)
  updateData.prequels.reverse()
  const violation = resolveClosedGameUpdateViolation({ updateData, existingGame })
  assert.equal(violation, 'приквел')
})
