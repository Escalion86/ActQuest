import test from 'node:test'
import assert from 'node:assert/strict'

import buildStoryRecords from '../server/buildStoryRecords.js'

const game = {
  type: 'story',
  participationMode: 'team',
  storyEndings: [{ id: 'win', title: 'Победа' }],
}

const teams = [
  { _id: 'a', name: 'Альфа' },
  { _id: 'b', name: 'Бета' },
  { _id: 'c', name: 'Гамма' },
]

const progress = ({ score, minutes, clues = 0, status = 'completed' }) => ({
  status,
  score,
  startedAt: new Date('2026-08-01T10:00:00.000Z'),
  finishedAt: new Date(`2026-08-01T10:${String(minutes).padStart(2, '0')}:00.000Z`),
  currentEndingId: 'win',
  usedClueIds: Array.from({ length: clues }, (_, index) => `clue-${index}`),
  completedNodeIds: ['one'],
})

test('story records calculate summary and stable record orders', () => {
  const result = buildStoryRecords({
    game,
    teams,
    gameTeams: [
      { teamId: 'a', storyProgress: progress({ score: 10, minutes: 20 }) },
      { teamId: 'b', storyProgress: progress({ score: 20, minutes: 30 }) },
      { teamId: 'c', storyProgress: progress({ score: 20, minutes: 15, clues: 1 }) },
    ],
  })

  assert.equal(result.summary.completedCount, 3)
  assert.equal(result.summary.averageDurationSeconds, 1300)
  assert.deepEqual(
    result.records.bestScore.map((entry) => entry.teamName),
    ['Гамма', 'Бета', 'Альфа'],
  )
  assert.deepEqual(
    result.records.fastestCompletion.map((entry) => entry.teamName),
    ['Гамма', 'Альфа', 'Бета'],
  )
})

test('failed runs affect summary but do not enter success records', () => {
  const result = buildStoryRecords({
    game,
    teams,
    gameTeams: [
      { teamId: 'a', storyProgress: progress({ score: 10, minutes: 20 }) },
      {
        teamId: 'b',
        storyProgress: progress({ score: 100, minutes: 5, status: 'failed' }),
      },
    ],
  })

  assert.equal(result.summary.finishedCount, 2)
  assert.equal(result.summary.failedCount, 1)
  assert.equal(result.records.bestScore.length, 1)
  assert.equal(result.records.bestScore[0].teamName, 'Альфа')
})

test('anonymous records do not expose team names or identifiers', () => {
  const result = buildStoryRecords({
    game,
    teams,
    showNames: false,
    gameTeams: [
      { teamId: 'a', storyProgress: progress({ score: 10, minutes: 20 }) },
    ],
  })

  assert.equal(result.records.bestScore[0].teamName, 'Команда #1')
  assert.equal(result.records.bestScore[0].teamId, null)
})
